import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase, fromDbQuote, fromDbLineItem, fromDbExpense, fromDbAttachment, toDbQuote, toDbLineItem, toDbExpense } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Send, ArrowLeft, Mic, GripVertical, ImagePlus, Copy, Check, FileText, Sparkles, Calendar, Receipt, Milestone, Layers, WifiOff, MessageCircle, Printer, Download, Loader2, Mail } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { getCurrencySymbol } from '../lib/currencies';
import { getUserFriendlyError } from '../lib/errorHandler';
import { useRateLimit } from '../hooks/useRateLimit';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatZAR } from '../lib/theme';
import { getPendingQuoteSaves, getQuoteDraftLocally, queueQuoteSave, removeQuoteDraftLocally, saveQuoteDraftLocally, setPendingQuoteSaves, type OfflineQuoteDraft } from '../lib/offline';
import { buildQuotePdfBlob, downloadQuotePdf } from '../lib/documentActions';
import { formatWhatsAppPhoneNumber, generateWhatsAppShareLink, getQuotePdfUrl, trackWhatsAppShare, validateWhatsAppPhoneNumber } from '../lib/whatsapp';
import { AttachmentUploader, type Attachment } from '../components/AttachmentUploader';

const quoteSchema = z.object({
  clientName: z.string().min(1, "Client Name is required"),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Line item description is required"),
    qty: z.preprocess((val) => typeof val === 'string' && val.trim() === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val, z.number().min(0.01, "Quantity must be greater than 0")),
    unitCost: z.preprocess((val) => typeof val === 'string' && val.trim() === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val, z.number().min(0.01, "Unit cost must be greater than 0")),
  })).min(1, "At least one line item is required"),
  expenses: z.array(z.object({
    description: z.string().min(1, "Expense description is required"),
    amount: z.preprocess((val) => typeof val === 'string' && val.trim() === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val, z.number().min(0, "Expense amount cannot be negative")),
  }))
});

interface LineItem {
  id: string;
  description: string;
  qty: number | string;
  unitCost: number | string;
  type: 'labor' | 'material';
  markupPercent: number | string;
}

interface Expense {
  id: string;
  description: string;
  amount: number | string;
  receiptUrl?: string;
  createdAt?: string;
}

const sanitizeNumericInput = (val: string): string => {
  if (val === '') return '';
  if (/^\d*\.?\d*$/.test(val)) {
    if (/^0\d+/.test(val)) {
      return val.replace(/^0+/, '');
    }
    if (/^0+$/.test(val)) {
      return '0';
    }
    return val;
  }
  return '';
};

function SortableLineItem({ item, updateLineItem, removeLineItem, handleVoiceInput, currency }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const roundedTotal = () => {
    const qty = typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0;
    const cost = typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0;
    const markup = typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0;
    
    if (item.type === 'material') {
      return (qty * cost) * (1 + markup / 100);
    }
    return qty * cost;
  };

  const formatCurrencyValue = (amount: number) => {
    if (currency === 'ZAR') {
      return formatZAR(amount);
    }
    return `${getCurrencySymbol(currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      setIsFocused(!isFocused);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={setNodeRef} 
      style={style} 
      className="p-5 border border-zinc-200/80 bg-zinc-50/40 rounded-2xl space-y-4 relative group hover:bg-white hover:border-zinc-200 hover:shadow-sm transition-all duration-200"
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={`Line item: ${item.description}`}
    >
      <div 
        className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 cursor-grab text-zinc-400 hover:text-zinc-800 transition-opacity p-1.5 rounded-lg hover:bg-zinc-100" 
        {...attributes} 
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label="Drag to reorder line item"
      >
        <GripVertical className="w-4 h-4 stroke-[2.5]" />
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-3 right-3 text-zinc-400 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => removeLineItem(item.id)}
        aria-label="Remove line item"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pl-7 pr-4">
        <div className="lg:col-span-5 space-y-1.5 animate-none">
          <Label className="text-zinc-500 font-medium text-xs">Line Description</Label>
          <div className="relative">
            <Input 
              value={item.description} 
              onChange={e => updateLineItem(item.id, 'description', e.target.value)}
              placeholder="e.g. Core system design & development"
              className="pr-10 h-9.5 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary"
              aria-label="Line item description"
            />
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7.5 w-7.5 rounded-lg text-zinc-400 hover:text-zinc-900"
              onClick={() => handleVoiceInput(item.id)}
              aria-label="Voice input for description"
            >
              <Mic className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        <div className="lg:col-span-2 space-y-1.5">
          <Label className="text-zinc-500 font-medium text-xs">Work Category</Label>
          <select 
            className="flex h-9.5 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            value={item.type}
            onChange={e => updateLineItem(item.id, 'type', e.target.value)}
          >
            <option value="labor">Labor / Fee</option>
            <option value="material">Material / Supply</option>
          </select>
        </div>

        <div className="lg:col-span-2 space-y-1.5">
          <Label className="text-zinc-500 font-medium text-xs">Quantity / Hours</Label>
          <Input 
            type="text"
            inputMode="decimal"
            value={item.qty} 
            className="h-9.5 rounded-xl border-zinc-200 text-zinc-800"
            onChange={e => {
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                updateLineItem(item.id, 'qty', sanitizeNumericInput(val));
              }
            }}
          />
        </div>

        <div className="lg:col-span-3 space-y-1.5">
          <Label className="text-zinc-500 font-medium text-xs">Unit Price ({getCurrencySymbol(currency)})</Label>
          <Input 
            type="text"
            inputMode="decimal"
            value={item.unitCost} 
            className="h-9.5 rounded-xl border-zinc-200 text-zinc-800"
            onChange={e => {
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                updateLineItem(item.id, 'unitCost', sanitizeNumericInput(val));
              }
            }}
          />
        </div>
      </div>
      
      <div className="pl-7 pr-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-1">
        {item.type === 'material' ? (
          <div className="flex items-center gap-2.5 text-xs text-zinc-400 bg-zinc-100/50 py-1 px-2.5 rounded-lg border border-zinc-200/40">
            <span className="font-medium text-zinc-500">Material Markup %:</span>
            <Input 
              type="text"
              inputMode="decimal"
              className="w-16 h-7.5 rounded-md text-xs border-zinc-200 bg-white" 
              value={item.markupPercent}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  updateLineItem(item.id, 'markupPercent', sanitizeNumericInput(val));
                }
              }}
            />
          </div>
        ) : <div className="hidden md:block" />}
        
        <div className="text-sm font-semibold text-zinc-800 md:text-right w-full md:w-auto self-end">
          <span className="text-zinc-400 font-normal mr-1.5 text-xs">Line total:</span>
          <span className="text-zinc-900 tabular-nums font-semibold">{formatCurrencyValue(roundedTotal())}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function QuoteBuilder() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [taxRate, setTaxRate] = useState<number | string>(profile?.defaultTaxRate ?? 0);
  const [currency, setCurrency] = useState(profile?.defaultCurrency || 'ZAR');
  const [isMilestone, setIsMilestone] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [quoteCreatedAt, setQuoteCreatedAt] = useState<string | null>(null);
  const [validityDays, setValidityDays] = useState('7');
  const [quotePdfUrl, setQuotePdfUrl] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState('');
  const [pdfBusy, setPdfBusy] = useState<'download' | 'share' | null>(null);
  const isOnline = useOnlineStatus();
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const { isLimited: isSaving, execute: executeSave } = useRateLimit(1000);

  const handleCopyLink = () => {
    if (!id) return;
    const url = `${window.location.origin}/client/quote/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Secure Client Link Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendByEmail = async () => {
    if (!id) { toast.error('Save the quote first before sending by email'); return; }
    if (!clientEmail.trim()) { toast.error('Add the client email address above first'); return; }
    try {
      setIsSendingEmail(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/quotes/${id}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ clientEmail: clientEmail.trim(), clientName: clientName.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to send email');
      toast.success(`Quote emailed to ${clientEmail.trim()}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user) {
      supabase.from('clients').select('*').eq('user_id', user.uid).order('name').then(({ data }) => {
        setClients((data || []).map(row => ({ id: row.id, name: row.name, phone: row.phone, email: row.email, address: row.address })));
      });
    }
  }, [user]);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setClientName(client.name);
        setClientPhone(client.phone || '');
        setClientEmail(client.email || '');
      }
    } else {
      setClientName('');
      setClientPhone('');
      setClientEmail('');
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setLineItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  useEffect(() => {
    if (id && user) {
      loadQuote(id);
    } else if (profile && lineItems.length === 0) {
      addLineItem();
    }
  }, [id, user, profile]);

  useEffect(() => {
    syncPendingQuoteSaves();
  }, [isOnline, user?.uid]);

  useEffect(() => {
    if (!user || !profile || lineItems.length === 0) return;
    const timeout = window.setTimeout(() => {
      const quoteId = id || 'new';
      const draft = buildOfflineDraft(quoteId, 'draft');
      saveQuoteDraftLocally(draft);
      setLocalSaveStatus(`Saved locally ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [clientName, clientPhone, notes, lineItems, expenses, taxRate, currency, validityDays, isMilestone, progressPercent]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerStart) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - timerStart);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerStart]);

  const toggleTimer = () => {
    if (timerActive) {
      setTimerActive(false);
      const hours = elapsedTime / (1000 * 60 * 60);
      
      if (hours > 0.01) {
        setLineItems([...lineItems, {
          id: uuidv4(),
          description: `Labor - ${clientName || 'Job'}`,
          qty: parseFloat(hours.toFixed(2)),
          unitCost: profile?.defaultLaborRate || 0,
          type: 'labor',
          markupPercent: 0
        }]);
        toast.success(`Logged ${hours.toFixed(2)} hours`);
      }
      
      setTimerStart(null);
      setElapsedTime(0);
    } else {
      setTimerActive(true);
      setTimerStart(Date.now());
      toast.info("Labor Stopwatch Engaged");
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const loadQuote = async (quoteId: string) => {
    try {
      setLoading(true);

      const [
        { data: quoteRow, error: quoteError },
        { data: itemRows },
        { data: expRows },
      ] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).single(),
        supabase.from('line_items').select('*').eq('quote_id', quoteId).order('sort_order', { ascending: true }),
        supabase.from('expenses').select('*').eq('quote_id', quoteId),
      ]);

      if (quoteError) throw quoteError;

      if (quoteRow) {
        const data = fromDbQuote(quoteRow);
        setClientName(data.clientName || '');
        setClientPhone(data.clientPhone || '');
        setClientEmail(data.clientEmail || '');
        setSelectedClientId(data.clientId || '');
        setNotes(data.notes || '');
        setTaxRate(data.taxRate !== undefined ? data.taxRate : (profile?.defaultTaxRate || 0));
        setCurrency(data.currency || profile?.defaultCurrency || 'ZAR');
        setIsMilestone(data.isMilestone || false);
        setProgressPercent(data.progressPercent || 0);
        setQuoteCreatedAt(data.createdAt || null);
        setValidityDays(String(data.validityDays ?? '7'));
        setQuotePdfUrl(data.pdfUrl || '');
        setQuoteNumber(data.quoteNumber || '');

        const items = (itemRows || []).map(fromDbLineItem) as LineItem[];
        setLineItems(items.length > 0 ? items : []);

        const loadedExpenses = (expRows || []).map(fromDbExpense) as Expense[];
        setExpenses(loadedExpenses);
        const { data: attRows } = await supabase.from('quote_attachments').select('*').eq('quote_id', quoteId);
        const loadedAttachments = (attRows || []).map((r: any) => ({
          id: r.id,
          fileName: r.file_name,
          filePath: r.file_path,
          fileType: r.file_type,
          fileSize: r.file_size,
          url: supabase.storage.from('quote-attachments').getPublicUrl(r.file_path).data.publicUrl,
        })) as Attachment[];
        setAttachments(loadedAttachments);
      }
    } catch (error) {
      const localDraft = user ? getQuoteDraftLocally(user.uid, quoteId) : null;
      if (localDraft) {
        const data = localDraft.quoteData;
        setClientName(data.clientName || '');
        setClientPhone(data.clientPhone || data.phone || '');
        setSelectedClientId(data.clientId || '');
        setNotes(data.notes || '');
        setTaxRate(data.taxRate !== undefined ? data.taxRate : (profile?.defaultTaxRate || 0));
        setCurrency(data.currency || profile?.defaultCurrency || 'ZAR');
        setIsMilestone(data.isMilestone || false);
        setProgressPercent(data.progressPercent || 0);
        setQuoteCreatedAt(data.createdAt || null);
        setValidityDays(String(data.validityDays ?? '7'));
        setQuotePdfUrl(data.pdfUrl || data.quotePdfUrl || data.publicPdfUrl || '');
        setLineItems(localDraft.lineItems as LineItem[]);
        setExpenses(localDraft.expenses as Expense[]);
        setLocalSaveStatus('Restored from local draft');
        toast.info('Loaded your local draft while offline.');
      } else {
        console.error("Error loading quote:", error);
        toast.error("Failed to load quote");
      }
    } finally {
      setLoading(false);
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: uuidv4(),
      description: '',
      qty: 1,
      unitCost: 0,
      type: 'labor',
      markupPercent: profile?.defaultMarkup || 0
    }]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    lineItems.forEach(item => {
      const q = typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0;
      const c = typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0;
      const m = typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0;
      const baseCost = q * c;
      const markup = baseCost * (m / 100);
      subtotal += baseCost + markup;
    });

    // Include tracked expenses in subtotal
    expenses.forEach(exp => {
      const a = typeof exp.amount === 'number' ? exp.amount : parseFloat(exp.amount) || 0;
      subtotal += a;
    });

    let effectiveTaxRate = typeof taxRate === 'number' ? taxRate : parseFloat(taxRate) || 0;
    // Warn user if SA mode overrides their tax rate
    if (currency === 'ZAR' && profile?.saTaxInvoiceMode) {
      effectiveTaxRate = 15;
    }

    const tax = subtotal * (effectiveTaxRate / 100);
    const total = subtotal + tax;

    return { subtotal, tax, total, effectiveTaxRate };
  };

  const buildOfflineDraft = (quoteId: string, status: 'draft' | 'sent'): OfflineQuoteDraft => {
    const { subtotal, tax, total, effectiveTaxRate } = calculateTotals();
    const originalCreatedAtStr = quoteCreatedAt || new Date().toISOString();
    let expiresAt: string | null = null;
    if (validityDays !== 'never') {
      const daysNum = parseInt(validityDays, 10);
      const dt = new Date(originalCreatedAtStr);
      dt.setDate(dt.getDate() + daysNum);
      expiresAt = dt.toISOString();
    }

    return {
      quoteId,
      uid: user!.uid,
      status,
      savedAt: new Date().toISOString(),
      quoteData: {
        id: quoteId,
        uid: user!.uid,
        clientId: selectedClientId || null,
        clientName: DOMPurify.sanitize(clientName),
        clientPhone: DOMPurify.sanitize(clientPhone),
        clientEmail: DOMPurify.sanitize(clientEmail),
        notes: DOMPurify.sanitize(notes),
        taxRate: effectiveTaxRate,
        subtotal,
        taxAmount: tax,
        total,
        currency,
        vatAmount: currency === 'ZAR' && profile?.saTaxInvoiceMode ? tax : 0,
        isSATaxInvoice: currency === 'ZAR' && profile?.saTaxInvoiceMode,
        isMilestone,
        progressPercent,
        status,
        contractorBusinessName: profile?.businessName || '',
        contractorLogoUrl: profile?.logoUrl || '',
        contractorTerms: profile?.terms || '',
        updatedAt: new Date().toISOString(),
        createdAt: originalCreatedAtStr,
        validityDays,
        expiresAt,
        pdfUrl: quotePdfUrl || undefined,
        quotePdfUrl: quotePdfUrl || undefined
      },
      lineItems: lineItems.map(item => ({
        ...item,
        qty: typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0,
        unitCost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0,
        markupPercent: typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0
      })),
      expenses: expenses.map(expense => ({
        ...expense,
        amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount) || 0,
        uid: user!.uid,
        quoteId,
        currency,
        createdAt: expense.createdAt || new Date().toISOString()
      }))
    };
  };

  const commitQuoteDraft = async (draft: OfflineQuoteDraft) => {
    // Upsert quote
    const dbQuote = toDbQuote({ ...draft.quoteData, uid: draft.uid });
    dbQuote.id = draft.quoteId;
    const { error: quoteError } = await supabase.from('quotes').upsert(dbQuote);
    if (quoteError) throw quoteError;

    // Replace all line items
    await supabase.from('line_items').delete().eq('quote_id', draft.quoteId);
    if (draft.lineItems.length > 0) {
      const liRows = draft.lineItems.map((item, index) => ({
        id: item.id || crypto.randomUUID(),
        quote_id: draft.quoteId,
        template_id: null,
        recurring_invoice_id: null,
        description: item.description,
        qty: parseFloat(item.qty as any) || 1,
        unit_cost: parseFloat(item.unitCost as any) || 0,
        type: item.type || 'labor',
        markup_percent: parseFloat(item.markupPercent as any) || 0,
        sort_order: index,
      }));
      const { error: liError } = await supabase.from('line_items').insert(liRows);
      if (liError) throw liError;
    }

    // Replace all expenses
    await supabase.from('expenses').delete().eq('quote_id', draft.quoteId);
    for (const expense of draft.expenses) {
      await supabase.from('expenses').upsert({
        id: expense.id || crypto.randomUUID(),
        user_id: draft.uid,
        quote_id: draft.quoteId,
        description: expense.description,
        amount: parseFloat(expense.amount as any) || 0,
        currency: expense.currency || 'ZAR',
        receipt_url: expense.receiptUrl || null,
      });
    }

    saveQuoteDraftLocally(draft);
    removeQuoteDraftLocally(draft.uid, draft.quoteId);
  };

  const syncPendingQuoteSaves = async () => {
    if (!user || !isOnline) return;
    const all = await getPendingQuoteSaves();
    const pending = all.filter(item => item.uid === user.uid);
    if (pending.length === 0) return;
    const remaining = all.filter(item => item.uid !== user.uid);
    for (const draft of pending) {
      try {
        await commitQuoteDraft(draft);
      } catch (error) {
        remaining.push(draft);
      }
    }
    setPendingQuoteSaves(remaining);
    if (remaining.length === 0) toast.success('Local quote changes synced');
  };

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    executeSave(async () => {
      if (!user || !profile) return;
      
      try {
        const validationResult = quoteSchema.safeParse({
          clientName,
          lineItems,
          expenses
        });

        if (!validationResult.success) {
          const errors = validationResult.error.issues.map(err => err.message);
          toast.error(errors[0]);
          return;
        }

        const quoteId = id || uuidv4();
        const localDraft = buildOfflineDraft(quoteId, status);
        saveQuoteDraftLocally(localDraft);
        setLocalSaveStatus(`Saved locally ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);

        if (!isOnline) {
          queueQuoteSave(localDraft);
          toast.success('Saved locally. SoloBid will sync when you are back online.');
          if (!id) navigate(`/quotes/${quoteId}`, { replace: true });
          return;
        }

        setLoading(true);
        const { subtotal, tax, total, effectiveTaxRate } = calculateTotals();

        const originalCreatedAtStr = quoteCreatedAt || new Date().toISOString();
        let expiresAt: string | null = null;
        if (validityDays !== 'never') {
          const daysNum = parseInt(validityDays, 10);
          const dt = new Date(originalCreatedAtStr);
          dt.setDate(dt.getDate() + daysNum);
          expiresAt = dt.toISOString();
        }

        const quotePayload = {
          uid: user.uid,
          clientId: selectedClientId || null,
          clientName: DOMPurify.sanitize(clientName),
          clientPhone: DOMPurify.sanitize(clientPhone),
          clientEmail: DOMPurify.sanitize(clientEmail),
          notes: DOMPurify.sanitize(notes),
          taxRate: effectiveTaxRate,
          subtotal,
          taxAmount: tax,
          total,
          currency,
          vatAmount: currency === 'ZAR' && profile?.saTaxInvoiceMode ? tax : 0,
          isMilestone,
          progressPercent,
          status,
          contractorBusinessName: profile.businessName || '',
          contractorLogoUrl: profile.logoUrl || '',
          contractorTerms: profile.terms || '',
          updatedAt: new Date().toISOString(),
          createdAt: originalCreatedAtStr,
          validityDays,
          expiresAt
        };

        // 1. Upsert quote
        const dbQuote = toDbQuote(quotePayload);
        dbQuote.id = quoteId;
        const { error: quoteError } = await supabase.from('quotes').upsert(dbQuote);
        if (quoteError) throw quoteError;

        // 2. Replace line items (delete then insert)
        await supabase.from('line_items').delete().eq('quote_id', quoteId);
        if (lineItems.length > 0) {
          const liRows = lineItems.map((item, index) => ({
            id: item.id || crypto.randomUUID(),
            quote_id: quoteId,
            template_id: null,
            recurring_invoice_id: null,
            description: item.description,
            qty: typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 1,
            unit_cost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0,
            type: item.type || 'labor',
            markup_percent: typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0,
            sort_order: index,
          }));
          const { error: liError } = await supabase.from('line_items').insert(liRows);
          if (liError) throw liError;
        }

        // 3. Replace expenses (delete then upsert)
        await supabase.from('expenses').delete().eq('quote_id', quoteId);
        for (const expense of expenses) {
          await supabase.from('expenses').upsert({
            id: expense.id || crypto.randomUUID(),
            user_id: user.uid,
            quote_id: quoteId,
            description: expense.description,
            amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount) || 0,
            currency,
            receipt_url: expense.receiptUrl || null,
          });
        }

        // Assign a sequential quote number the first time a quote is sent
        if (status === 'sent' && !quoteNumber) {
          const { data: assignedNum } = await supabase.rpc('assign_quote_number', { p_quote_id: quoteId });
          if (assignedNum) setQuoteNumber(assignedNum);
        }

        removeQuoteDraftLocally(user.uid, quoteId);
        setLocalSaveStatus('Synced just now');

        toast.success(`Quote ${status === 'sent' ? 'sent' : 'saved'} successfully`);
        
        if (!id) {
          navigate(`/quotes/${quoteId}`, { replace: true });
        }
      } catch (error: any) {
        toast.error(getUserFriendlyError(error));
        if (process.env.NODE_ENV === 'development') {
          console.error("Full error: ", error);
        }
      } finally {
        setLoading(false);
      }
    });
  };

  const { subtotal, tax, total, effectiveTaxRate } = calculateTotals();

  const formatCurrency = (amount: number, curr: string) => {
    if (curr === 'ZAR') {
      return formatZAR(amount);
    }
    return `${getCurrencySymbol(curr)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleVoiceInput = (itemId: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Browser voice processing not supported");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      updateLineItem(itemId, 'description', transcript);
    };
    recognition.start();
    toast.info("Listening... Speech recognition active.");
  };

  const addExpense = () => {
    setExpenses([...expenses, {
      id: uuidv4(),
      description: '',
      amount: 0
    }]);
  };

  const updateExpense = (id: string, field: keyof Expense, value: any) => {
    setExpenses(expenses.map(exp => 
      exp.id === id ? { ...exp, [field]: value } : exp
    ));
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  const handleExpensePhotoUpload = async (expenseId: string, file: File) => {
    if (!user) return;
    try {
      const toastId = toast.loading("Saving digital receipt...");
      const filePath = `${user.uid}/${id || 'new'}/${expenseId}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const receiptUrl = supabase.storage.from('receipts').getPublicUrl(filePath).data.publicUrl;
      updateExpense(expenseId, 'receiptUrl', receiptUrl);
      toast.success("Receipt saved securely", { id: toastId });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to archive receipt photo");
    }
  };

  const handleSaveAsTemplate = () => {
    executeSave(async () => {
      if (!user) return;

      try {
        const templateName = window.prompt("Design Template Name:", "My Bid Template");
        if (!templateName) return;

        setLoading(true);
        const templateId = uuidv4();

        // Insert template row
        const { error: tplError } = await supabase.from('templates').insert({
          id: templateId,
          user_id: user.uid,
          name: templateName,
          description: notes || "Line items stored for fast replica bids",
        });
        if (tplError) throw tplError;

        // Insert line items linked to template
        if (lineItems.length > 0) {
          const liRows = lineItems.map((item, index) => ({
            id: item.id || crypto.randomUUID(),
            template_id: templateId,
            quote_id: null,
            recurring_invoice_id: null,
            description: item.description,
            qty: typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 1,
            unit_cost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0,
            type: item.type || 'labor',
            markup_percent: typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0,
            sort_order: index,
          }));
          const { error: liError } = await supabase.from('line_items').insert(liRows);
          if (liError) throw liError;
        }

        toast.success("Line layout saved as template");
      } catch (error) {
        console.error("Error saving template:", error);
        toast.error("Failed to create layout template");
      } finally {
        setLoading(false);
      }
    });
  };

  const currentQuoteForPdf = () => ({
    ...(buildOfflineDraft(id || 'draft', 'draft').quoteData),
    id: id || 'draft'
  });

  const handleDownloadQuotePdf = async () => {
    if (!profile) return;
    try {
      setPdfBusy('download');
      await downloadQuotePdf(currentQuoteForPdf(), profile, lineItems);
      toast.success('Quotation PDF downloaded');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to create quotation PDF');
    } finally {
      setPdfBusy(null);
    }
  };

  const handlePrintQuote = async () => {
    await handleDownloadQuotePdf();
    window.setTimeout(() => window.print(), 150);
  };

  const uploadQuotePdfAndGetUrl = async (quote: any, blob: Blob) => {
    if (!user || !id) {
      throw new Error('Save the quote before sharing it on WhatsApp so SoloBid can create a secure PDF link.');
    }

    const filePath = `${user.uid}/${id}/Quote_${id.substring(0, 8).toUpperCase()}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, blob, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    const pdfUrl = supabase.storage.from('pdfs').getPublicUrl(filePath).data.publicUrl;

    await supabase.from('quotes').update({
      pdf_url: pdfUrl,
      pdf_updated_at: new Date().toISOString(),
    }).eq('id', id);

    setQuotePdfUrl(pdfUrl);
    return { ...quote, pdfUrl, quotePdfUrl: pdfUrl };
  };

  const handleWhatsAppShare = async () => {
    if (!profile) {
      toast.error('Your business profile is still loading. Please try again in a moment.');
      return;
    }

    // Validate phone up front
    const cleanedPhone = formatWhatsAppPhoneNumber(clientPhone);
    try {
      validateWhatsAppPhoneNumber(cleanedPhone);
    } catch (err: any) {
      toast.error(err.message);
      return;
    }

    // Validate form fields
    const validationResult = quoteSchema.safeParse({ clientName, lineItems, expenses });
    if (!validationResult.success) {
      toast.error(validationResult.error.issues[0].message);
      return;
    }

    const quoteId = id || uuidv4();
    const isNewQuote = !id;

    // Offline guard — client link won't resolve until Supabase is written
    if (!isOnline) {
      const localDraft = buildOfflineDraft(quoteId, 'sent');
      saveQuoteDraftLocally(localDraft);
      if (isNewQuote) {
        queueQuoteSave(localDraft);
        navigate(`/quotes/${quoteId}`, { replace: true });
      }
      toast.warning("You're offline. Quote saved locally — share via WhatsApp once back online.");
      return;
    }

    setPdfBusy('share');
    try {
      // Always save to Supabase with status 'sent' before opening WhatsApp.
      // This ensures: (a) new quotes are created, (b) existing draft quotes are
      // promoted to 'sent' so the client can approve/sign on the client view page.
      setLoading(true);
      const { subtotal, tax, total, effectiveTaxRate } = calculateTotals();
      const originalCreatedAtStr = quoteCreatedAt || new Date().toISOString();
      let expiresAt: string | null = null;
      if (validityDays !== 'never') {
        const dt = new Date(originalCreatedAtStr);
        dt.setDate(dt.getDate() + parseInt(validityDays, 10));
        expiresAt = dt.toISOString();
      }
      const quoteData = {
        uid: user!.uid, clientId: selectedClientId || null,
        clientName: DOMPurify.sanitize(clientName),
        clientPhone: DOMPurify.sanitize(clientPhone), notes: DOMPurify.sanitize(notes),
        taxRate: effectiveTaxRate, subtotal, taxAmount: tax, total, currency,
        vatAmount: currency === 'ZAR' && profile?.saTaxInvoiceMode ? tax : 0,
        isMilestone, progressPercent, status: 'sent',
        contractorBusinessName: profile.businessName || '', contractorLogoUrl: profile.logoUrl || '',
        contractorTerms: profile.terms || '', updatedAt: new Date().toISOString(),
        createdAt: originalCreatedAtStr, validityDays, expiresAt
      };
      // 1. Upsert quote
      const dbQuote = toDbQuote(quoteData);
      dbQuote.id = quoteId;
      const { error: wsQuoteError } = await supabase.from('quotes').upsert(dbQuote);
      if (wsQuoteError) throw wsQuoteError;

      // 2. Replace line items (delete then insert)
      await supabase.from('line_items').delete().eq('quote_id', quoteId);
      if (lineItems.length > 0) {
        const liRows = lineItems.map((item, index) => ({
          id: item.id || crypto.randomUUID(),
          quote_id: quoteId,
          template_id: null,
          recurring_invoice_id: null,
          description: item.description,
          qty: typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 1,
          unit_cost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0,
          type: item.type || 'labor',
          markup_percent: typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0,
          sort_order: index,
        }));
        const { error: wsLiError } = await supabase.from('line_items').insert(liRows);
        if (wsLiError) throw wsLiError;
      }

      // 3. Replace expenses (delete then upsert)
      await supabase.from('expenses').delete().eq('quote_id', quoteId);
      for (const expense of expenses) {
        await supabase.from('expenses').upsert({
          id: expense.id || crypto.randomUUID(),
          user_id: user!.uid,
          quote_id: quoteId,
          description: expense.description,
          amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount) || 0,
          currency,
          receipt_url: expense.receiptUrl || null,
        });
      }
      removeQuoteDraftLocally(user!.uid, quoteId);
      setLocalSaveStatus('Synced just now');

      if (isNewQuote) navigate(`/quotes/${quoteId}`, { replace: true });

      // Generate link AFTER confirmed Supabase write so client view resolves
      const quote = currentQuoteForPdf();
      const share = generateWhatsAppShareLink(
        { ...quote, id: quoteId, clientPhone, contractorBusinessName: profile.businessName, lineItems },
        window.location.origin
      );
      trackWhatsAppShare(quoteId, 'quote_builder');
      window.open(share.href, '_blank', 'noopener,noreferrer');
      toast.success('Quote saved and sent via WhatsApp — tap Send in the app to deliver.');
    } catch (error: any) {
      console.error('[WhatsApp Share] Failed:', { clientPhone, error });
      toast.error(error?.message || 'Could not open WhatsApp. Check the client phone number.');
    } finally {
      setLoading(false);
      setPdfBusy(null);
    }
  };

  const handleDeleteQuote = async () => {
    if (!id || !user) return;
    try {
      setIsDeleting(true);
      // Supabase cascades deletes for line_items and expenses via FK constraints,
      // but explicitly delete them first for safety.
      await supabase.from('line_items').delete().eq('quote_id', id);
      await supabase.from('expenses').delete().eq('quote_id', id);
      const { error: deleteError } = await supabase.from('quotes').delete().eq('id', id);
      if (deleteError) throw deleteError;
      toast.success("Quote log purged");
      navigate('/');
    } catch (error) {
      console.error("Error deleting quote:", error);
      toast.error("Failed to purge quote logs");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-6 pb-24 max-w-7xl mx-auto"
    >
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 pb-2 border-b border-zinc-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9.5 w-9.5 rounded-xl border border-zinc-200/50 hover:bg-zinc-100 cursor-pointer text-zinc-600"
            onClick={() => navigate(-1)} 
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
              {id ? 'Edit Bid Proposal' : 'Draft New Quote'}
              {quoteNumber && <span className="ml-3 text-base font-mono text-zinc-400 tracking-wide">{quoteNumber}</span>}
            </h1>
            <p className="text-zinc-400 text-xs mt-0.5">Fill in the customer details, line items, and tax rate.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!isOnline && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
              {localSaveStatus && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  <Check className="h-3 w-3" /> {localSaveStatus}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-4">
            <select 
              id="quote-currency"
              className="flex h-9.5 w-26 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Select currency for quote"
            >
              <option value="ZAR">ZAR (R)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="NZD">NZD (NZ$)</option>
              <option value="SGD">SGD (S$)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
          {id && (
            <>
              <Button 
                variant="ghost" 
                onClick={() => setDeleteDialogOpen(true)} 
                title="Delete Quote" 
                className="h-10 text-red-600 rounded-xl hover:bg-red-50 hover:text-red-700 font-medium px-4 border border-transparent hover:border-red-100 active:scale-95 transition-all text-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Quote
              </Button>
              <Button 
                variant="outline" 
                className="h-10 border-zinc-200 text-zinc-700 rounded-xl px-4 hover:bg-zinc-50 active:scale-95 transition-all text-sm"
                onClick={handleCopyLink} 
                title="Copy Client Link"
              >
                {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2 text-zinc-500" />}
                Copy Link
              </Button>
              <Button variant="outline" className="h-10 border-zinc-200 text-zinc-700 rounded-xl px-4 hover:bg-zinc-50 active:scale-95 transition-all text-sm" onClick={handleDownloadQuotePdf} disabled={!!pdfBusy} title="Download polished PDF">
                {pdfBusy === 'download' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2 text-zinc-500" />} PDF
              </Button>
              <Button variant="outline" className="h-10 border-zinc-200 text-zinc-700 rounded-xl px-4 hover:bg-zinc-50 active:scale-95 transition-all text-sm" onClick={handlePrintQuote} disabled={!!pdfBusy} title="Print quote">
                <Printer className="w-4 h-4 mr-2 text-zinc-500" /> Print
              </Button>
              <Button variant="outline" className="h-10 border-[#25D366] bg-[#25D366] text-white rounded-xl px-4 hover:bg-[#1fb958] hover:border-[#1fb958] active:scale-95 transition-all text-sm shadow-sm shadow-emerald-900/10" onClick={handleWhatsAppShare} disabled={!!pdfBusy} title="Share on WhatsApp">
                {pdfBusy === 'share' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />} WhatsApp
              </Button>
              <Button variant="outline" className="h-10 border-zinc-200 text-zinc-700 rounded-xl px-4 hover:bg-zinc-50 active:scale-95 transition-all text-sm" onClick={handleSendByEmail} disabled={isSendingEmail || !clientEmail.trim()} title={clientEmail.trim() ? 'Send quote link by email' : 'Add client email first'}>
                {isSendingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2 text-zinc-500" />} Email
              </Button>
            </>
          )}

          <Button 
            variant={timerActive ? "destructive" : "outline"} 
            onClick={toggleTimer}
            className={`h-10 rounded-xl px-4 text-sm font-medium transition-all ${timerActive ? 'bg-red-500 text-white border-none shadow-md shadow-red-200' : 'border-zinc-200 text-zinc-700'}`}
          >
            {timerActive ? (
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                {formatTime(elapsedTime)}
              </span>
            ) : 'Stopwatch'}
          </Button>

          <Button 
            variant="outline" 
            className="h-10 border-zinc-200 text-zinc-700 rounded-xl px-4 hover:bg-zinc-50 text-sm font-medium"
            onClick={handleSaveAsTemplate} 
            loading={loading} 
            title="Save current line items as template"
          >
            <FileText className="w-4 h-4 mr-2 text-zinc-500" /> Template
          </Button>

          <Button 
            variant="outline" 
            className="h-10 border-zinc-200 text-zinc-700 rounded-xl px-4 hover:bg-zinc-50 text-sm font-medium"
            onClick={() => handleSave('draft')} 
            loading={loading}
          >
            <Save className="w-4 h-4 mr-2 text-zinc-500" /> Save Draft
          </Button>

          <Button
            className="h-10 bg-[#25D366] hover:bg-[#1fb958] text-white font-medium rounded-xl px-5 text-sm"
            onClick={handleWhatsAppShare}
            disabled={!!pdfBusy}
          >
            <MessageCircle className="w-4 h-4 mr-2" /> Send via WhatsApp
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Client Setup Card */}
          <Card className="rounded-3xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-50 p-6">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-900">1. Customer Details</CardTitle>
                <CardDescription className="text-zinc-400 text-xs">Choose a saved customer or enter new details below.</CardDescription>
              </div>
              <label className="flex items-center space-x-2 text-xs font-semibold text-zinc-600 bg-zinc-100/60 hover:bg-zinc-100 py-1.5 px-3 rounded-full cursor-pointer transition-colors border border-zinc-200/50">
                <input 
                  type="checkbox" 
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-3.5 w-3.5"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                />
                <span className="flex items-center gap-1">
                  <Milestone className="w-3.5 h-3.5" />
                  Milestone
                </span>
              </label>
            </CardHeader>
            <CardContent className="space-y-5 p-6 bg-white">
              {isMilestone && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2 pb-5 border-b border-zinc-100 overflow-hidden"
                >
                  <div className="flex justify-between items-center">
                    <Label className="text-xs text-zinc-500">Work Completed Percentage</Label>
                    <span className="text-sm font-semibold text-primary">{progressPercent}% Completed</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="100" step="5"
                    className="w-full accent-primary h-2 bg-zinc-100 rounded-lg cursor-pointer"
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(parseInt(e.target.value))}
                  />
                </motion.div>
              )}
              
              {clients.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500 font-medium">Link Saved Client</Label>
                  <select 
                    className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                  >
                    <option value="">-- Custom Client Entry --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500 font-medium">Customer Full Name (Required)</Label>
                  <Input 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                    placeholder="e.g. Richard Hendricks"
                    className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    disabled={!!selectedClientId}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500 font-medium">Customer WhatsApp Number</Label>
                  <Input
                    type="tel"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="e.g. +27 82 123 4567"
                    className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    disabled={!!selectedClientId}
                  />
                  <p className="text-[11px] text-zinc-400">Used for Share on WhatsApp.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500 font-medium">Customer Email</Label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="e.g. client@example.com"
                    className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    disabled={!!selectedClientId}
                  />
                  <p className="text-[11px] text-zinc-400">Used for Send by Email.</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-zinc-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="validity-days" className="text-xs text-zinc-500 font-medium">Validity Period</Label>
                    <select
                      id="validity-days"
                      className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                    >
                      <option value="3">3 Days Validity</option>
                      <option value="7">7 Days Validity</option>
                      <option value="14">14 Days Validity</option>
                      <option value="30">30 Days Validity</option>
                      <option value="never">No Expiration Date</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center text-[11px] text-zinc-400 leading-normal">
                    <p className="flex items-start gap-1">
                      <span className="text-amber-500 mt-0.5">⚠️</span>
                      Clients will not be able to approve this quote once the validity period ends.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items Card */}
          <Card className="rounded-3xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-50 p-6 bg-zinc-50/20">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <span>2. Billable Items</span>
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">Add your labor services, rates, and items below.</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addLineItem}
                className="h-8.5 rounded-lg border-zinc-200/80 bg-white hover:bg-zinc-50 text-zinc-700 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5 text-primary stroke-[2.5]" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-6 bg-white">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={lineItems.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {lineItems.map((item) => (
                        <SortableLineItem 
                          key={item.id} 
                          item={item} 
                          updateLineItem={updateLineItem}
                          removeLineItem={removeLineItem}
                          handleVoiceInput={handleVoiceInput}
                          currency={currency}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </SortableContext>
              </DndContext>
              
              {lineItems.length === 0 && (
                <div className="text-center py-12 text-zinc-400 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/10">
                  <span className="block text-sm font-medium text-zinc-500 mb-1">No items added yet</span>
                  <span className="block text-xs text-zinc-400">Click Add Item to start adding pricing.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses Card */}
          <Card className="rounded-3xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-50 p-6">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-900">3. Material Costs & Expenses</CardTitle>
                <CardDescription className="text-zinc-400 text-xs">Add receipts and track how much was spent on materials.</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addExpense}
                className="h-8.5 rounded-lg border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5 text-primary stroke-[2.5]" /> Add Expense
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-6 bg-white">
              <AnimatePresence mode="popLayout">
                {expenses.map((expense) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={expense.id} 
                    className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4.5 border border-zinc-200 bg-zinc-50/30 rounded-2xl hover:bg-white hover:border-zinc-200 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex-1 w-full space-y-1.5">
                      <Label className="text-xs text-zinc-500 font-medium">Item Name / Description</Label>
                      <Input 
                        value={expense.description} 
                        onChange={e => updateExpense(expense.id, 'description', e.target.value)}
                        placeholder="e.g. Copper pipes and brass joints"
                        className="h-9.5 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                      />
                    </div>
                    <div className="w-full md:w-32 space-y-1.5">
                      <Label className="text-xs text-zinc-500 font-medium">Cost ({getCurrencySymbol(currency)})</Label>
                      <Input 
                        type="text"
                        inputMode="decimal"
                        value={expense.amount} 
                        className="h-9.5 rounded-xl border-zinc-200 text-zinc-800"
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            updateExpense(expense.id, 'amount', sanitizeNumericInput(val));
                          }
                        }}
                      />
                    </div>
                    <div className="pt-2 md:pt-6 flex gap-2 w-full md:w-auto shrink-0 self-end md:self-auto justify-end">
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleExpensePhotoUpload(expense.id, e.target.files[0]);
                            }
                          }}
                          title="Upload receipt photo"
                        />
                        <Button 
                          type="button"
                          variant={expense.receiptUrl ? "default" : "outline"} 
                          size="icon"
                          className={`h-9.5 w-9.5 rounded-xl border-zinc-200 hover:scale-95 ${expense.receiptUrl ? "bg-emerald-800 hover:bg-emerald-900 text-white border-none shadow-sm shadow-emerald-950/20" : "bg-white hover:bg-zinc-50"}`}
                          title={expense.receiptUrl ? "Receipt photo saved" : "Store receipt photo"}
                        >
                          <ImagePlus className="w-4.5 h-4.5" />
                        </Button>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9.5 w-9.5 rounded-xl text-zinc-400 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeExpense(expense.id)}
                        aria-label="Remove expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {expenses.length === 0 && (
                <div className="text-center py-10 text-zinc-400 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/10">
                  <span className="block text-xs text-zinc-400">No expenses added yet.</span>
                </div>
              )}
            </CardContent>
          </Card>


          {/* Attachments Card */}
          {id && user && (
            <Card className="rounded-3xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
              <CardHeader className="p-6 border-b border-zinc-50">
                <CardTitle className="text-lg font-semibold text-zinc-900">Site Photos &amp; Attachments</CardTitle>
                <CardDescription className="text-zinc-400 text-xs text-left">Attach site photos, PDFs, or documents to this quote.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 bg-white">
                <AttachmentUploader
                  quoteId={id}
                  userId={user.uid}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                />
              </CardContent>
            </Card>
          )}

          {/* Notes Card */}
          <Card className="rounded-3xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <CardHeader className="p-6 border-b border-zinc-50">
              <CardTitle className="text-lg font-semibold text-zinc-900">4. Notes and Terms</CardTitle>
              <CardDescription className="text-zinc-400 text-xs text-left">Add any comments, exclusions, or payment terms.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <Textarea 
                rows={4} 
                className="rounded-xl border-zinc-200 font-normal focus:ring-primary focus:border-primary text-sm p-3 shadow-inner bg-zinc-50/10"
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                placeholder="Exclusions: Structural wall remodeling is not covered. Terms: 50% retainer due on approval, remainder on project signoff."
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar Summary */}
        <div className="space-y-6">
          <Card className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl relative sticky top-6 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
            <div className="space-y-6 pt-2">
              <div className="border-b border-zinc-100 pb-4">
                <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  Total Summary
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Calculated in real time.</p>
              </div>
              
              <div className="space-y-3 font-normal text-sm">
                <div className="flex justify-between items-center text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-zinc-700 tabular-nums">{formatCurrency(subtotal, currency)}</span>
                </div>
                
                <div className="flex justify-between items-center text-zinc-500 border-t border-zinc-50 pt-2.5">
                  <span className="text-zinc-500 flex items-center gap-1">
                    {currency === 'ZAR' && profile?.saTaxInvoiceMode ? (
                      <span title="SA Tax Invoice mode forces 15% VAT. Change in Settings if needed.">VAT (15%) ⓘ</span>
                    ) : (
                      <>
                        <span className="mr-1 shrink-0">Tax</span>
                        <div className="inline-flex items-center gap-1 text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-0.5 font-bold">
                          <Input 
                            type="text"
                            inputMode="decimal"
                            className="w-10 h-6 text-center text-xs border-none p-0 focus:ring-0 focus:outline-none focus:border-none font-bold" 
                            value={taxRate}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                setTaxRate(sanitizeNumericInput(val));
                              }
                            }}
                          />
                          <span className="text-xs font-bold font-mono">%</span>
                        </div>
                      </>
                    )}
                  </span>
                  <span className="font-semibold text-zinc-700 tabular-nums">{formatCurrency(tax, currency)}</span>
                </div>

                <div className="pt-4 border-t border-zinc-200 flex justify-between items-baseline gap-2">
                  <span className="font-bold text-zinc-900 text-base">Grand Total</span>
                  <span className="text-3xl font-bold tracking-tight text-primary tabular-nums self-end">
                    {formatCurrency(total, currency)}
                  </span>
                </div>
              </div>
              
              <div className="pt-6 space-y-2.5 border-t border-zinc-100">
                <Button
                  className="w-full h-12 rounded-2xl bg-[#25D366] text-white border-[#25D366] font-bold hover:bg-[#1fb958] hover:border-[#1fb958] cursor-pointer shadow-md shadow-emerald-950/10 active:scale-[0.985] text-sm"
                  onClick={handleWhatsAppShare}
                  disabled={!!pdfBusy}
                >
                  {pdfBusy === 'share' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                  Send via WhatsApp
                </Button>

                {id && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl text-zinc-700 border-zinc-200 font-medium hover:bg-zinc-50 cursor-pointer text-sm"
                      onClick={handleCopyLink}
                    >
                      {copied ? <Check className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5 text-zinc-500" />}
                      Copy Link
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl text-zinc-700 border-zinc-200 font-medium hover:bg-zinc-50 cursor-pointer text-sm"
                      asChild
                    >
                      <Link to={`/client/quote/${id}`}>
                        Preview
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Quote"
        description="Are you sure you want to delete this quote record? This will permanently delete all items and expenses. This action cannot be undone."
        confirmLabel="Wipe Permanently"
        cancelLabel="Keep Record"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteQuote}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </motion.div>
  );
}
