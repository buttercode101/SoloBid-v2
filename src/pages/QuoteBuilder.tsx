import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Send, ArrowLeft, Mic, GripVertical, ImagePlus, Copy, Check, FileText } from 'lucide-react';
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
import { motion } from 'motion/react';
import { z } from 'zod';
import { validateEmail } from '../lib/validation';
import { authorizedFetch } from '../lib/api';
import DOMPurify from 'dompurify';
import { getCurrencySymbol } from '../lib/currencies';
import { getUserFriendlyError } from '../lib/errorHandler';
import { useRateLimit } from '../hooks/useRateLimit';

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

function SortableLineItem({ item, updateLineItem, removeLineItem, handleVoiceInput, currencySymbol }: any) {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow keyboard users to access drag functionality
    if (e.key === 'Enter' && e.ctrlKey) {
      // Ctrl+Enter to focus drag handle
      setIsFocused(!isFocused);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="p-4 border rounded-lg bg-zinc-50/50 space-y-4 relative group"
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={`Line item: ${item.description}`}
    >
      <div 
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 cursor-grab text-zinc-400 hover:text-zinc-900" 
        {...attributes} 
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label="Drag to reorder line item"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => removeLineItem(item.id)}
        aria-label="Remove line item"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pl-6">
        <div className="lg:col-span-5 space-y-2">
          <Label>Description</Label>
          <div className="relative">
            <Input 
              value={item.description} 
              onChange={e => updateLineItem(item.id, 'description', e.target.value)}
              placeholder="e.g. Replace master bathroom toilet"
              className="pr-10"
              aria-label="Line item description"
            />
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              className="absolute right-0 top-0 text-zinc-400 hover:text-zinc-900"
              onClick={() => handleVoiceInput(item.id)}
              aria-label="Voice input for description"
            >
              <Mic className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="lg:col-span-2 space-y-2">
          <Label>Type</Label>
          <select 
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={item.type}
            onChange={e => updateLineItem(item.id, 'type', e.target.value)}
          >
            <option value="labor">Labor</option>
            <option value="material">Material</option>
          </select>
        </div>

        <div className="lg:col-span-2 space-y-2">
          <Label>Qty/Hrs</Label>
          <Input 
            type="text"
            inputMode="decimal"
            value={item.qty} 
            onChange={e => {
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                updateLineItem(item.id, 'qty', sanitizeNumericInput(val));
              }
            }}
          />
        </div>

        <div className="lg:col-span-3 space-y-2">
          <Label>Cost ({currencySymbol})</Label>
          <Input 
            type="text"
            inputMode="decimal"
            value={item.unitCost} 
            onChange={e => {
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                updateLineItem(item.id, 'unitCost', sanitizeNumericInput(val));
              }
            }}
          />
        </div>
      </div>
      
      <div className="pl-6">
        {item.type === 'material' && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>Markup %:</span>
            <Input 
              type="text"
              inputMode="decimal"
              className="w-20 h-8" 
              value={item.markupPercent}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  updateLineItem(item.id, 'markupPercent', sanitizeNumericInput(val));
                }
              }}
            />
            <span className="ml-auto font-medium text-zinc-900">
              Line Total: {currencySymbol}{(((typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0) * (typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0)) * (1 + (typeof item.markupPercent === 'number' ? item.markupPercent : parseFloat(item.markupPercent) || 0) / 100)).toFixed(2)}
            </span>
          </div>
        )}
        {item.type === 'labor' && (
          <div className="flex justify-end text-sm font-medium text-zinc-900">
            Line Total: {currencySymbol}{((typeof item.qty === 'number' ? item.qty : parseFloat(item.qty) || 0) * (typeof item.unitCost === 'number' ? item.unitCost : parseFloat(item.unitCost) || 0)).toFixed(2)}
          </div>
        )}
      </div>
    </div>
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

  const { isLimited: isSaving, execute: executeSave } = useRateLimit(1000);

  const handleCopyLink = () => {
    if (!id) return;
    const url = `${window.location.origin}/client/quote/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard");
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
      }
    } else {
      setClientName('');
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
      // Initialize with one empty line item
      addLineItem();
    }
  }, [id, user, profile]);

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
      // Stop timer and add line item
      setTimerActive(false);
      const hours = elapsedTime / (1000 * 60 * 60);
      
      if (hours > 0.01) { // Only add if more than ~36 seconds
        setLineItems([...lineItems, {
          id: uuidv4(),
          description: `Labor - ${clientName || 'Job'}`,
          qty: parseFloat(hours.toFixed(2)),
          unitCost: profile?.defaultLaborRate || 0,
          type: 'labor',
          markupPercent: 0
        }]);
        toast.success(`Added ${hours.toFixed(2)} hours of labor`);
      }
      
      setTimerStart(null);
      setElapsedTime(0);
    } else {
      // Start timer
      setTimerActive(true);
      setTimerStart(Date.now());
      toast.info("Labor timer started");
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
        setNotes(data.notes || '');
        setTaxRate(data.taxRate !== undefined ? data.taxRate : (profile?.defaultTaxRate || 0));
        setCurrency(data.currency || profile?.defaultCurrency || 'ZAR');
        setIsMilestone(data.isMilestone || false);
        setProgressPercent(data.progressPercent || 0);
        setQuoteCreatedAt(data.createdAt || null);
        setValidityDays(data.validityDays || '7');
        
        // Load line items
        const itemsRef = collection(db, 'quotes', quoteId, 'lineItems');
        const itemsSnap = await getDocs(itemsRef);
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LineItem));
        setLineItems(items.length > 0 ? items : []);

        // Load expenses
        const expensesRef = collection(db, 'quotes', quoteId, 'expenses');
        const expensesSnap = await getDocs(expensesRef);
        const loadedExpenses = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
        setExpenses(loadedExpenses);
      }
    } catch (error) {
      console.error("Error loading quote:", error);
      toast.error("Failed to load quote");
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

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    if (status === 'sent' && !clientEmail.trim()) {
      toast.error("Client email is required to send the quote.");
      return;
    }
    executeSave(async () => {
      if (!user || !profile) return;
      
      try {
        // Validate input
        const validationResult = quoteSchema.safeParse({
          clientName,
          clientEmail,
          lineItems,
          expenses
        });

        if (!validationResult.success) {
          const errors = validationResult.error.issues.map(err => err.message);
          toast.error(errors[0]); // Show the first error
          return;
        }

        setLoading(true);
        const quoteId = id || uuidv4();
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
        
        // Save line items
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

        // Save expenses
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

        toast.success(`Quote ${status === 'sent' ? 'sent' : 'saved'} successfully`);
        
        if (!id) {
          navigate(`/quotes/${quoteId}`, { replace: true });
        }
        
        if (status === 'sent') {
          // Send email via our API
          const clientViewUrl = `${window.location.origin}/client/quote/${quoteId}`;
          
          try {
            const response = await authorizedFetch('/api/send-email', {
              method: 'POST',
              body: JSON.stringify({
                to: clientEmail,
                subject: `Quotation from ${profile.businessName}`,
                html: `
                  <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #333;">Quotation from ${profile.businessName}</h2>
                    <p>Hi ${clientName},</p>
                    <p>Here is your quote for <strong>${currencySymbol}${total.toFixed(2)}</strong>.</p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${clientViewUrl}" style="background-color: #18181b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View & Approve Quotation</a>
                    </div>
                    <p>If you have any questions, please don't hesitate to reply to this email.</p>
                    <p>Thanks,<br>${profile.businessName}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="color: #666; font-size: 14px; text-align: center;">Powered by SoloBid</p>
                  </div>
                `
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            toast.success("Client notified via email");
          } catch (err: any) {
            console.error("Error sending email:", err);
            toast.error(err.message || "Quote saved, but failed to send email");
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
  const currencySymbol = getCurrencySymbol(currency);

  // Simple speech recognition (browser support varies)
  const handleVoiceInput = (itemId: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      updateLineItem(itemId, 'description', transcript);
    };
    recognition.start();
    toast.info("Listening...");
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
      const toastId = toast.loading("Uploading receipt...");
      const fileExtension = file.name.split('.').pop();
      const fileName = `receipts/${user.uid}/${id}-${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      updateExpense(id, 'receiptUrl', url);
      toast.success("Receipt uploaded", { id: toastId });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload receipt");
    }
  };

  const handleSaveAsTemplate = () => {
    executeSave(async () => {
      if (!user) return;
      
      try {
        const templateName = window.prompt("Enter a name for this template:", "My Custom Template");
        if (!templateName) return;

        setLoading(true);
        const templateId = uuidv4();
        
        const templateData = {
          id: templateId,
          uid: user.uid,
          name: templateName,
          description: notes || "Template saved from quote",
          lineItems,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'templates', templateId), templateData);
        toast.success("Saved as template successfully");
      } catch (error) {
        console.error("Error saving template:", error);
        toast.error("Failed to save template");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleWhatsAppShare = () => {
    const url = `${window.location.origin}/client/quote/${id}`;
    const text = `Hi ${clientName}, here is your quote from ${profile?.businessName}: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDeleteQuote = async () => {
    if (!id || !user) return;
    try {
      setIsDeleting(true);
      const batch = writeBatch(db);
      
      // Delete lineItems
      const itemsRef = collection(db, 'quotes', id, 'lineItems');
      const itemsSnap = await getDocs(itemsRef);
      itemsSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // Delete expenses
      const expensesRef = collection(db, 'quotes', id, 'expenses');
      const expensesSnap = await getDocs(expensesRef);
      expensesSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // Delete quote document
      batch.delete(doc(db, 'quotes', id));

      await batch.commit();
      toast.success("Quote deleted successfully");
      navigate('/');
    } catch (error) {
      console.error("Error deleting quote:", error);
      toast.error("Failed to delete quote");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-24"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {id ? 'Edit Quote' : 'New Quote'}
          </h1>
          <div className="flex items-center gap-2 ml-4">
            <Label htmlFor="quote-currency" className="sr-only">Currency</Label>
            <select 
              id="quote-currency"
              className="flex h-9 w-24 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="flex flex-wrap gap-2 items-center">
          {id && (
            <>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} title="Delete Quote" className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-sm">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
              <Button variant="outline" onClick={handleCopyLink} title="Copy Client Link">
                {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy Link
              </Button>
            </>
          )}
          <Button 
            variant={timerActive ? "destructive" : "outline"} 
            onClick={toggleTimer}
            className="w-32 flex justify-center"
          >
            {timerActive ? formatTime(elapsedTime) : 'Start Timer'}
          </Button>
          <Button variant="outline" onClick={handleSaveAsTemplate} loading={loading} title="Save current line items as a reusable template">
            <FileText className="w-4 h-4 mr-2" /> Save as Template
          </Button>
          <Button variant="outline" onClick={() => handleSave('draft')} loading={loading}>
            <Save className="w-4 h-4 mr-2" /> Save Draft
          </Button>
          <Button onClick={() => handleSave('sent')} loading={loading}>
            <Send className="w-4 h-4 mr-2" /> Send to Client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Client Details</CardTitle>
              <label className="flex items-center space-x-2 text-sm font-medium">
                <input 
                  type="checkbox" 
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                />
                <span>Milestone Job</span>
              </label>
            </CardHeader>
            <CardContent className="space-y-4">
              {isMilestone && (
                <div className="space-y-2 pb-4 border-b">
                  <div className="flex justify-between">
                    <Label>Progress</Label>
                    <span className="text-sm font-medium">{progressPercent}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="100" step="5"
                    className="w-full accent-zinc-900"
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(parseInt(e.target.value))}
                  />
                </div>
              )}
              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Existing Client</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                  >
                    <option value="">-- Custom Client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                    placeholder="John Doe"
                    disabled={!!selectedClientId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Email</Label>
                  <Input 
                    type="email"
                    value={clientEmail} 
                    onChange={e => setClientEmail(e.target.value)} 
                    placeholder="john@example.com"
                    disabled={!!selectedClientId}
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validity-days">Quote Validity / Expiration</Label>
                    <select
                      id="validity-days"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={validityDays}
                      onChange={(e) => setValidityDays(e.target.value)}
                      aria-label="Quote expiration period"
                    >
                      <option value="3">Expires after 3 days</option>
                      <option value="7">Expires after 7 days</option>
                      <option value="14">Expires after 14 days</option>
                      <option value="30">Expires after 30 days</option>
                      <option value="never">No Expiration (Never)</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center text-xs text-zinc-500">
                    <p>Clients will see an "expired" status and won't be able to sign or accept quotes past this deadline.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={lineItems.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {lineItems.map((item) => (
                    <SortableLineItem 
                      key={item.id} 
                      item={item} 
                      updateLineItem={updateLineItem}
                      removeLineItem={removeLineItem}
                      handleVoiceInput={handleVoiceInput}
                      currencySymbol={currencySymbol}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              
              {lineItems.length === 0 && (
                <div className="text-center py-8 text-zinc-500 border rounded-lg border-dashed">
                  No line items added yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Expenses</CardTitle>
              <Button variant="outline" size="sm" onClick={addExpense}>
                <Plus className="w-4 h-4 mr-2" /> Add Expense
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-4 p-4 border rounded-lg bg-zinc-50/50">
                  <div className="flex-1 space-y-2">
                    <Label>Description</Label>
                    <Input 
                      value={expense.description} 
                      onChange={e => updateExpense(expense.id, 'description', e.target.value)}
                      placeholder="e.g. Materials from Home Depot"
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label>Amount ({currencySymbol})</Label>
                    <Input 
                      type="text"
                      inputMode="decimal"
                      value={expense.amount} 
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          updateExpense(expense.id, 'amount', sanitizeNumericInput(val));
                        }
                      }}
                    />
                  </div>
                  <div className="pt-6 flex gap-2">
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleExpensePhotoUpload(expense.id, e.target.files[0]);
                          }
                        }}
                        title="Upload receipt"
                      />
                      <Button 
                        type="button"
                        variant={expense.receiptUrl ? "default" : "outline"} 
                        size="icon"
                        className={expense.receiptUrl ? "bg-green-600 hover:bg-green-700" : ""}
                        title={expense.receiptUrl ? "Receipt uploaded" : "Upload receipt"}
                      >
                        <ImagePlus className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-zinc-400 hover:text-red-600"
                      onClick={() => removeExpense(expense.id)}
                      aria-label="Remove expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && (
                <div className="text-center py-8 text-zinc-500 border rounded-lg border-dashed">
                  No expenses added yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes & Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                rows={4} 
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional notes for the client..."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="md:sticky md:top-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-medium">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500 flex items-center gap-2">
                  {currency === 'ZAR' && profile?.saTaxInvoiceMode ? 'VAT (15%)' : 'Tax Rate'}
                  {!(currency === 'ZAR' && profile?.saTaxInvoiceMode) && (
                    <>
                      <Input 
                        type="text"
                        inputMode="decimal"
                        className="w-16 h-7 text-xs" 
                        value={taxRate}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            setTaxRate(sanitizeNumericInput(val));
                          }
                        }}
                      />%
                    </>
                  )}
                </span>
                <span className="font-medium">{currencySymbol}{tax.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t flex justify-between items-center">
                <span className="font-bold">Total</span>
                <span className="text-2xl font-bold">{currencySymbol}{total.toFixed(2)}</span>
              </div>
              
              <div className="pt-6 space-y-2">
                <Button className="w-full" size="lg" onClick={() => handleSave('sent')} disabled={loading}>
                  <Send className="w-4 h-4 mr-2" /> Send Quote
                </Button>
                {id && (
                  <>
                    <Button variant="outline" className="w-full" asChild>
                      <Link to={`/client/quote/${id}`}>
                        Preview Client View
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleWhatsAppShare}>
                      Share via WhatsApp
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Quote"
        description="Are you sure you want to delete this quote? This will permanently delete the quote database document, all of its saved line items, and any related expense records. This action cannot be undone."
        confirmLabel="Delete Quote"
        cancelLabel="Keep Quote"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteQuote}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </motion.div>
  );
}
