import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Send, ArrowLeft, Mic, GripVertical, ImagePlus, Copy, Check, FileText, Sparkles, Calendar, Receipt, Milestone, Layers, WifiOff, MessageCircle, Printer, Download, Loader2 } from 'lucide-react';
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
import { validateEmail } from '../lib/validation';
import { authorizedFetch } from '../lib/api';
import DOMPurify from 'dompurify';
import { getCurrencySymbol } from '../lib/currencies';
import { getUserFriendlyError } from '../lib/errorHandler';
import { useRateLimit } from '../hooks/useRateLimit';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { formatZAR } from '../lib/theme';
import { getPendingQuoteSaves, getQuoteDraftLocally, queueQuoteSave, removeQuoteDraftLocally, saveQuoteDraftLocally, setPendingQuoteSaves, type OfflineQuoteDraft } from '../lib/offline';
import { buildQuotePdfBlob, downloadQuotePdf } from '../lib/documentActions';
import { generateWhatsAppShareLink, trackWhatsAppShare } from '../lib/whatsapp';

const quoteSchema = z.object({
  clientName: z.string().min(1, "Client Name is required"),
  clientEmail: z.string().email("Invalid email address").or(z.literal('')),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Line item description is required"),
    qty: z.preprocess((val) => typeof val === 'string' && val.trim() === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val, z.number().min(0.01, "Quantity must be greater than 0")),
    unitCost: z.preprocess((val) => typeof val === 'string' && val.trim() === '' ? 0 : typeof val === 'string' ? parseFloat(val) : val, z.number().min(0, "Unit cost cannot be negative")),
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
      className="p-5 border border-zinc-150/80 bg-zinc-50/40 rounded-2xl space-y-4 relative group hover:bg-white hover:border-zinc-200 hover:shadow-sm transition-all duration-200"
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
        className="absolute top-3 right-3 text-zinc-400 hover:text-red-650 hover:bg-red-50 h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="h-9.5 rounded-xl border-zinc-200 text-zinc-850"
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
            className="h-9.5 rounded-xl border-zinc-200 text-zinc-850"
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
          <div className="flex items-center gap-2.5 text-xs text-zinc-450 bg-zinc-100/50 py-1 px-2.5 rounded-lg border border-zinc-200/40">
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
        
        <div className="text-sm font-semibold text-zinc-850 md:text-right w-full md:w-auto self-end">
          <span className="text-zinc-450 font-normal mr-1.5 text-xs">Line total:</span>
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
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [taxRate, setTaxRate] = useState<number | string>(profile?.defaultTaxRate || 0);
  const [currency, setCurrency] = useState(profile?.defaultCurrency || 'ZAR');
  const [isMilestone, setIsMilestone] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [quoteCreatedAt, setQuoteCreatedAt] = useState<string | null>(null);
  const [validityDays, setValidityDays] = useState('7');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localSaveStatus, setLocalSaveStatus] = useState('');
  const [pdfBusy, setPdfBusy] = useState<'download' | 'share' | null>(null);
  const isOnline = useOnlineStatus();

  const { isLimited: isSaving, execute: executeSave } = useRateLimit(1000);

  const handleCopyLink = () => {
    if (!id) return;
    const url = `${window.location.origin}/client/quote/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Secure Client Link Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user) {
      getDocs(query(collection(db, 'clients'), where('uid', '==', user.uid))).then(snap => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }
  }, [user]);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        setClientName(client.name);
        setClientEmail(client.email || '');
        setClientPhone(client.phone || '');
      }
    } else {
      setClientName('');
      setClientEmail('');
      setClientPhone('');
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
  }, [clientName, clientEmail, clientPhone, notes, lineItems, expenses, taxRate, currency, validityDays, isMilestone, progressPercent]);

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
      const docRef = doc(db, 'quotes', quoteId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setClientName(data.clientName || '');
        setClientEmail(data.clientEmail || '');
        setClientPhone(data.clientPhone || data.phone || '');
        setSelectedClientId(data.clientId || '');
        setNotes(data.notes || '');
        setTaxRate(data.taxRate !== undefined ? data.taxRate : (profile?.defaultTaxRate || 0));
        setCurrency(data.currency || profile?.defaultCurrency || 'ZAR');
        setIsMilestone(data.isMilestone || false);
        setProgressPercent(data.progressPercent || 0);
        setQuoteCreatedAt(data.createdAt || null);
        setValidityDays(data.validityDays || '7');
        
        const itemsRef = collection(db, 'quotes', quoteId, 'lineItems');
        const itemsSnap = await getDocs(itemsRef);
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LineItem));
        setLineItems(items.length > 0 ? items : []);

        const expensesRef = collection(db, 'quotes', quoteId, 'expenses');
        const expensesSnap = await getDocs(expensesRef);
        const loadedExpenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
        setExpenses(loadedExpenses);
      }
    } catch (error) {
      const localDraft = user ? getQuoteDraftLocally(user.uid, quoteId) : null;
      if (localDraft) {
        const data = localDraft.quoteData;
        setClientName(data.clientName || '');
        setClientEmail(data.clientEmail || '');
        setClientPhone(data.clientPhone || data.phone || '');
        setSelectedClientId(data.clientId || '');
        setNotes(data.notes || '');
        setTaxRate(data.taxRate !== undefined ? data.taxRate : (profile?.defaultTaxRate || 0));
        setCurrency(data.currency || profile?.defaultCurrency || 'ZAR');
        setIsMilestone(data.isMilestone || false);
        setProgressPercent(data.progressPercent || 0);
        setQuoteCreatedAt(data.createdAt || null);
        setValidityDays(data.validityDays || '7');
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
    
    let effectiveTaxRate = typeof taxRate === 'number' ? taxRate : parseFloat(taxRate) || 0;
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
        clientEmail: DOMPurify.sanitize(clientEmail),
        clientPhone: DOMPurify.sanitize(clientPhone),
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
        expiresAt
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
    const batch = writeBatch(db);
    const quoteRef = doc(db, 'quotes', draft.quoteId);
    batch.set(quoteRef, draft.quoteData, { merge: true });

    const itemsRef = collection(db, 'quotes', draft.quoteId, 'lineItems');
    const existingItemsSnap = await getDocs(itemsRef);
    const currentItemIds = new Set(draft.lineItems.map(item => item.id));
    existingItemsSnap.docs.forEach(docSnap => {
      if (!currentItemIds.has(docSnap.id)) batch.delete(docSnap.ref);
    });
    draft.lineItems.forEach(item => batch.set(doc(itemsRef, item.id), item));

    const expensesRef = collection(db, 'quotes', draft.quoteId, 'expenses');
    const existingExpensesSnap = await getDocs(expensesRef);
    const currentExpenseIds = new Set(draft.expenses.map(exp => exp.id));
    existingExpensesSnap.docs.forEach(docSnap => {
      if (!currentExpenseIds.has(docSnap.id)) batch.delete(docSnap.ref);
    });
    draft.expenses.forEach(expense => batch.set(doc(expensesRef, expense.id), expense));

    await batch.commit();
    saveQuoteDraftLocally(draft);
    removeQuoteDraftLocally(draft.uid, draft.quoteId);
  };

  const syncPendingQuoteSaves = async () => {
    if (!user || !isOnline) return;
    const pending = getPendingQuoteSaves().filter(item => item.uid === user.uid);
    if (pending.length === 0) return;
    const remaining = getPendingQuoteSaves().filter(item => item.uid !== user.uid);
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
    if (status === 'sent' && !clientEmail.trim()) {
      toast.error("Client Email Address Required to Transmit.");
      return;
    }
    executeSave(async () => {
      if (!user || !profile) return;
      
      try {
        const validationResult = quoteSchema.safeParse({
          clientName,
          clientEmail,
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

        const quoteData = {
          uid: user.uid,
          clientId: selectedClientId || null,
          clientName: DOMPurify.sanitize(clientName),
          clientEmail: DOMPurify.sanitize(clientEmail),
          clientPhone: DOMPurify.sanitize(clientPhone),
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

        const batch = writeBatch(db);
        const quoteRef = doc(db, 'quotes', quoteId);
        
        batch.set(quoteRef, quoteData, { merge: true });
        
        const itemsRef = collection(db, 'quotes', quoteId, 'lineItems');
        let existingItemIds: string[] = [];
        if (id) {
          const existingItemsSnap = await getDocs(itemsRef);
          existingItemIds = existingItemsSnap.docs.map(doc => doc.id);
        }
        const currentItemIds = new Set(lineItems.map(item => item.id));
        
        for (const itemId of existingItemIds) {
          if (!currentItemIds.has(itemId)) {
            batch.delete(doc(itemsRef, itemId));
          }
        }

        for (const item of lineItems) {
          const cleanedItem = {
            ...item,
            qty: typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0,
            unitCost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0,
            markupPercent: typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0
          };
          batch.set(doc(itemsRef, item.id), cleanedItem);
        }

        const expensesRef = collection(db, 'quotes', quoteId, 'expenses');
        let existingExpenseIds: string[] = [];
        if (id) {
          const existingExpensesSnap = await getDocs(expensesRef);
          existingExpenseIds = existingExpensesSnap.docs.map(doc => doc.id);
        }
        const currentExpenseIds = new Set(expenses.map(exp => exp.id));

        for (const expId of existingExpenseIds) {
          if (!currentExpenseIds.has(expId)) {
            batch.delete(doc(expensesRef, expId));
          }
        }

        for (const expense of expenses) {
          batch.set(doc(expensesRef, expense.id), {
            ...expense,
            amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount) || 0,
            uid: user.uid,
            quoteId,
            currency,
            createdAt: expense.createdAt || new Date().toISOString()
          });
        }

        await batch.commit();
        removeQuoteDraftLocally(user.uid, quoteId);
        setLocalSaveStatus('Synced just now');

        toast.success(`Quote ${status === 'sent' ? 'sent' : 'saved'} successfully`);
        
        if (!id) {
          navigate(`/quotes/${quoteId}`, { replace: true });
        }
        
        if (status === 'sent') {
          const clientViewUrl = `${window.location.origin}/client/quote/${quoteId}`;
          
          try {
            const response = await authorizedFetch('/api/send-email', {
              method: 'POST',
              body: JSON.stringify({
                to: clientEmail,
                subject: `Quotation from ${profile.businessName}`,
                html: `
                  <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #fafafa;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h2 style="color: #0f766e; margin: 0; font-size: 24px; font-weight: 700;">${profile.businessName}</h2>
                      <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Interactive Quotation Request</p>
                    </div>
                    <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.01);">
                      <p style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px;">Dear ${clientName},</p>
                      <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">Thank you for requesting a bid from us. We have finalized your professional quotation with a total cost outline of <strong>${formatCurrency(total, currency)}</strong>.</p>
                      <div style="text-align: center; margin: 32px 0;">
                        <a href="${clientViewUrl}" style="background-color: #0f766e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; display: inline-block; font-size: 15px; box-shadow: 0 4px 12px rgba(15,118,110,0.15);">Review Proposal & Accept</a>
                      </div>
                      <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">You can view the specific broken-down line breakdown, request revisions, and sign to accept the quotation digitally from the link above.</p>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">Securely generated and audited by SoloBid.</p>
                  </div>
                `
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Server status: ${response.status}`);
            }
            toast.success("Client notified via email");
          } catch (err: any) {
            console.error("Error sending email:", err);
            toast.error(err.message || "Quote saved, but failed to alert client");
          }
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
    toast.info("Listening... Speach converter active.");
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

  const handleExpensePhotoUpload = async (id: string, file: File) => {
    if (!user) return;
    try {
      const toastId = toast.loading("Saving digital receipt...");
      const fileExtension = file.name.split('.').pop();
      const fileName = `receipts/${user.uid}/${id}-${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      updateExpense(id, 'receiptUrl', url);
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
        
        const templateData = {
          id: templateId,
          uid: user.uid,
          name: templateName,
          description: notes || "Line items stored for fast replica bids",
          lineItems,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'templates', templateId), templateData);
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

    const fileName = `quotes/${user.uid}/${id}/Quote_${id.substring(0, 8).toUpperCase()}_${Date.now()}.pdf`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
    const pdfUrl = await getDownloadURL(storageRef);

    await setDoc(doc(db, 'quotes', id), {
      pdfUrl,
      quotePdfUrl: pdfUrl,
      pdfUpdatedAt: new Date().toISOString(),
    }, { merge: true });

    return { ...quote, pdfUrl, quotePdfUrl: pdfUrl };
  };

  const handleWhatsAppShare = async () => {
    if (!profile) return;

    try {
      setPdfBusy('share');
      const quote = currentQuoteForPdf();
      const blob = await buildQuotePdfBlob(quote, profile, lineItems);
      const quoteWithPdf = await uploadQuotePdfAndGetUrl(quote, blob);
      const share = generateWhatsAppShareLink({
        ...quoteWithPdf,
        clientPhone,
        contractorBusinessName: profile.businessName,
        lineItems,
      });

      trackWhatsAppShare(id, 'quote_preview');
      window.open(share.href, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp opened with your quote message');
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('WhatsApp share error:', error);
        toast.error(error?.message || 'Could not open WhatsApp share link');
      }
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDeleteQuote = async () => {
    if (!id || !user) return;
    try {
      setIsDeleting(true);
      const batch = writeBatch(db);
      
      const itemsRef = collection(db, 'quotes', id, 'lineItems');
      const itemsSnap = await getDocs(itemsRef);
      itemsSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      const expensesRef = collection(db, 'quotes', id, 'expenses');
      const expensesSnap = await getDocs(expensesRef);
      expensesSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      batch.delete(doc(db, 'quotes', id));

      await batch.commit();
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
            className="h-9.5 w-9.5 rounded-xl border border-zinc-200/50 hover:bg-zinc-100 cursor-pointer text-zinc-650"
            onClick={() => navigate(-1)} 
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
              {id ? 'Edit Bid Proposal' : 'Draft New Quote'}
            </h1>
            <p className="text-zinc-450 text-xs mt-0.5">Fill in the customer details, line items, and tax rate.</p>
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
                className="h-10 text-red-650 rounded-xl hover:bg-red-50 hover:text-red-700 font-medium px-4 border border-transparent hover:border-red-100 active:scale-95 transition-all text-sm"
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
                {pdfBusy === 'share' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />} Share on WhatsApp
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
            className="h-10 bg-primary hover:bg-[#03362f] text-white font-medium rounded-xl px-5 text-sm"
            onClick={() => handleSave('sent')} 
            loading={loading}
          >
            <Send className="w-4 h-4 mr-2 stroke-[2.5]" /> Send Proposal
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
                  className="rounded border-zinc-350 text-primary focus:ring-primary h-3.5 w-3.5"
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
                  <Label className="text-xs text-zinc-500 font-medium">Customer Email (Optional for draft)</Label>
                  <Input 
                    type="email"
                    value={clientEmail} 
                    onChange={e => setClientEmail(e.target.value)} 
                    placeholder="e.g. richard@piedpiper.com"
                    className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    disabled={!!selectedClientId}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-zinc-500 font-medium">Customer WhatsApp Number</Label>
                  <Input 
                    type="tel"
                    value={clientPhone} 
                    onChange={e => setClientPhone(e.target.value)} 
                    placeholder="e.g. +27 82 123 4567"
                    className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    disabled={!!selectedClientId}
                  />
                  <p className="text-[11px] text-zinc-400">Used for Share on WhatsApp. SoloBid will clean local SA numbers into +27 format.</p>
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
                    className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4.5 border border-zinc-150 bg-zinc-50/30 rounded-2xl hover:bg-white hover:border-zinc-200 hover:shadow-sm transition-all duration-200"
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
                        className="h-9.5 rounded-xl border-zinc-200 text-zinc-850"
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
                        className="h-9.5 w-9.5 rounded-xl text-zinc-400 hover:text-red-650 hover:bg-red-50"
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
                <div className="text-center py-10 text-zinc-400 border border-dashed border-zinc-150 rounded-2xl bg-zinc-50/10">
                  <span className="block text-xs text-zinc-400">No expenses added yet.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card className="rounded-3xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <CardHeader className="p-6 border-b border-zinc-50">
              <CardTitle className="text-lg font-semibold text-zinc-900">4. Notes and Terms</CardTitle>
              <CardDescription className="text-zinc-400 text-xs text-left">Add any comments, exclusions, or payment terms.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <Textarea 
                rows={4} 
                className="rounded-xl border-zinc-250 font-normal focus:ring-primary focus:border-primary text-sm p-3 shadow-inner bg-zinc-50/10"
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
                <div className="flex justify-between items-center text-zinc-550">
                  <span>Subtotal</span>
                  <span className="font-semibold text-zinc-750 tabular-nums">{formatCurrency(subtotal, currency)}</span>
                </div>
                
                <div className="flex justify-between items-center text-zinc-550 border-t border-zinc-50 pt-2.5">
                  <span className="text-zinc-500 flex items-center gap-1">
                    {currency === 'ZAR' && profile?.saTaxInvoiceMode ? (
                      <span>VAT (15%)</span>
                    ) : (
                      <>
                        <span className="mr-1 shrink-0">Tax</span>
                        <div className="inline-flex items-center gap-1 text-zinc-700 bg-zinc-50 border border-zinc-150 rounded-lg px-2 py-0.5 font-bold">
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
                  <span className="font-semibold text-zinc-750 tabular-nums">{formatCurrency(tax, currency)}</span>
                </div>

                <div className="pt-4 border-t border-zinc-150 flex justify-between items-baseline gap-2">
                  <span className="font-bold text-zinc-900 text-base">Grand Total</span>
                  <span className="text-3xl font-bold tracking-tight text-[#03423a] tabular-nums self-end">
                    {formatCurrency(total, currency)}
                  </span>
                </div>
              </div>
              
              <div className="pt-6 space-y-2.5 border-t border-zinc-100">
                <Button 
                  className="w-full bg-primary hover:bg-[#03362f] text-white font-semibold rounded-2xl h-11.5 text-sm cursor-pointer shadow-md shadow-teal-950/10 active:scale-[0.985]"
                  size="lg" 
                  onClick={() => handleSave('sent')} 
                  disabled={loading}
                >
                  <Send className="w-4.5 h-4.5 mr-2 stroke-[2.5]" /> Send Quote to Client
                </Button>
                
                {id && (
                  <>
                    <Button 
                      variant="outline" 
                      className="w-full h-11 rounded-xl text-zinc-750 border-zinc-200 font-medium hover:bg-zinc-50 cursor-pointer" 
                      asChild
                    >
                      <Link to={`/client/quote/${id}`}>
                        Preview Client Page
                      </Link>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full h-11 rounded-xl bg-[#25D366] text-white border-[#25D366] font-semibold hover:bg-[#1fb958] hover:border-[#1fb958] cursor-pointer shadow-md shadow-emerald-950/10" 
                      onClick={handleWhatsAppShare}
                      disabled={!!pdfBusy}
                    >
                      {pdfBusy === 'share' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
                      Share on WhatsApp
                    </Button>
                  </>
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
