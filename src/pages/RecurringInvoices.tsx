import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { supabase, fromDbRecurring, fromDbRecurringQuote, fromDbClient, fromDbTemplate, fromDbLineItem, fromDbQuote } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RefreshCw, Plus, Trash2, Edit, Play, Pause, CalendarClock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { format } from 'date-fns';
import { getCurrencySymbol } from '../lib/currencies';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

export default function RecurringInvoices() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoices');
  const [recurring, setRecurring] = useState<any[]>([]);
  const [recurringQuotes, setRecurringQuotes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    templateId: '',
    frequency: 'monthly',
    nextIssueDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const [quoteFormData, setQuoteFormData] = useState({
    clientId: '',
    templateQuoteId: '',
    frequency: 'monthly',
    nextIssueDate: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (!user) return;

    // Load recurring invoices
    const fetchRecurring = async () => {
      const { data } = await supabase.from('recurring_invoices').select('*').eq('user_id', user.uid).order('created_at', { ascending: false });
      setRecurring((data || []).map(row => fromDbRecurring(row)));
    };
    fetchRecurring();
    const channel = supabase.channel(`recurring-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_invoices', filter: `user_id=eq.${user.uid}` }, fetchRecurring)
      .subscribe();

    // Load recurring quotes
    const fetchRecurringQuotes = async () => {
      const { data } = await supabase.from('recurring_quotes').select('*').eq('user_id', user.uid).order('created_at', { ascending: false });
      setRecurringQuotes((data || []).map(fromDbRecurringQuote));
    };
    fetchRecurringQuotes();
    const quoteChannel = supabase.channel(`recurring-quotes-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_quotes', filter: `user_id=eq.${user.uid}` }, fetchRecurringQuotes)
      .subscribe();

    // Load clients
    supabase.from('clients').select('*').eq('user_id', user.uid).then(({ data }) => {
      setClients((data || []).map(fromDbClient));
    });

    // Load templates with line items
    supabase.from('templates').select('*').eq('user_id', user.uid).then(async ({ data: tplData }) => {
      if (!tplData) return;
      const { data: liData } = await supabase.from('line_items').select('*').in('template_id', tplData.map(t => t.id));
      setTemplates(tplData.map(t => fromDbTemplate(t, (liData || []).filter(li => li.template_id === t.id))));
    });

    // Load quotes for recurring quote templates
    supabase.from('quotes').select('id, client_name, quote_number, total').eq('user_id', user.uid).order('created_at', { ascending: false }).then(({ data }) => {
      setQuotes((data || []).map(fromDbQuote));
    });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(quoteChannel);
    };
  }, [user]);

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const client = clients.find(c => c.id === formData.clientId);
      const template = templates.find(t => t.id === formData.templateId);
      
      if (!client || !template) {
        toast.error("Please select a client and a template");
        return;
      }

      const recurringId = uuidv4();

      // Calculate total from template line items
      const total = template.lineItems.reduce((sum: number, item: any) => {
        const baseCost = item.qty * item.unitCost;
        const markup = item.type === 'material' ? baseCost * (item.markupPercent / 100) : 0;
        return sum + baseCost + markup;
      }, 0);

      const { error } = await supabase.from('recurring_invoices').upsert({
        id: recurringId,
        user_id: user.uid,
        client_id: client.id,
        client_name: client.name,
        client_email: client.email || '',
        frequency: formData.frequency,
        next_issue_date: formData.nextIssueDate,
        status: 'active',
        total: total,
        currency: template.currency || 'ZAR',
      });
      if (error) throw error;

      // Copy line items
      if (template.lineItems && template.lineItems.length > 0) {
        const liRows = template.lineItems.map((item: any) => ({
          id: crypto.randomUUID(),
          recurring_invoice_id: recurringId,
          quote_id: null,
          template_id: null,
          description: item.description,
          qty: parseFloat(item.qty) || 1,
          unit_cost: parseFloat(item.unitCost) || 0,
          type: item.type || 'labor',
          markup_percent: parseFloat(item.markupPercent) || 0,
          sort_order: item.sortOrder ?? 0,
        }));
        await supabase.from('line_items').insert(liRows);
      }

      toast.success("Recurring invoice schedule created");
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save recurring invoice");
    }
  };

  const handleSaveRecurringQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const client = clients.find(c => c.id === quoteFormData.clientId);
      if (!client || !quoteFormData.templateQuoteId) {
        toast.error("Please select a client and a template quote");
        return;
      }
      const { error } = await supabase.from('recurring_quotes').insert({
        id: uuidv4(),
        user_id: user.uid,
        client_id: client.id,
        client_name: client.name,
        template_quote_id: quoteFormData.templateQuoteId,
        frequency: quoteFormData.frequency,
        next_issue_date: quoteFormData.nextIssueDate,
        status: 'active',
      });
      if (error) throw error;
      toast.success("Recurring quote schedule created");
      setIsQuoteDialogOpen(false);
      setQuoteFormData({ clientId: '', templateQuoteId: '', frequency: 'monthly', nextIssueDate: format(new Date(), 'yyyy-MM-dd') });
    } catch (error) {
      toast.error("Failed to save recurring quote");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('recurring_invoices').delete().eq('id', id);
      toast.success("Recurring schedule deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleDeleteQuote = async (id: string) => {
    try {
      await supabase.from('recurring_quotes').delete().eq('id', id);
      toast.success("Recurring quote schedule deleted");
      setDeleteQuoteId(null);
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const toggleStatus = async (item: any) => {
    try {
      const newStatus = item.status === 'active' ? 'paused' : 'active';
      await supabase.from('recurring_invoices').update({ status: newStatus }).eq('id', item.id);
      toast.success(`Schedule ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const toggleQuoteStatus = async (item: any) => {
    try {
      const newStatus = item.status === 'active' ? 'paused' : 'active';
      await supabase.from('recurring_quotes').update({ status: newStatus }).eq('id', item.id);
      toast.success(`Schedule ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">Recurring Schedules</h1>
          <p className="text-zinc-500 text-xs mt-0.5">Automate your billing and quoting for ongoing services.</p>
        </div>

        {activeTab === 'invoices' ? (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Recurring Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveRecurring} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <select 
                  id="client"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.clientId}
                  onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                  required
                  aria-label="Select client"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template">Template *</Label>
                <select 
                  id="template"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.templateId}
                  onChange={(e) => setFormData({...formData, templateId: e.target.value})}
                  required
                >
                  <option value="">Select a template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500">The template's line items will be used for each generated invoice.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <select 
                  id="frequency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.frequency}
                  onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextIssueDate">First Issue Date *</Label>
                <Input 
                  id="nextIssueDate" 
                  type="date"
                  value={formData.nextIssueDate}
                  onChange={(e) => setFormData({...formData, nextIssueDate: e.target.value})}
                  required 
                />
              </div>
              
              <Button type="submit" className="w-full">Create Schedule</Button>
            </form>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Recurring Quote
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Recurring Quote</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveRecurringQuote} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="rq-client">Client *</Label>
                <select
                  id="rq-client"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={quoteFormData.clientId}
                  onChange={(e) => setQuoteFormData({...quoteFormData, clientId: e.target.value})}
                  required
                  aria-label="Select client"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rq-template">Template Quote *</Label>
                <select
                  id="rq-template"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={quoteFormData.templateQuoteId}
                  onChange={(e) => setQuoteFormData({...quoteFormData, templateQuoteId: e.target.value})}
                  required
                >
                  <option value="">Select a quote...</option>
                  {quotes.map(q => (
                    <option key={q.id} value={q.id}>{q.quoteNumber || q.id.substring(0, 8).toUpperCase()} — {q.clientName}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500">The selected quote's line items will be copied for each generated quote.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rq-frequency">Frequency *</Label>
                <select
                  id="rq-frequency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={quoteFormData.frequency}
                  onChange={(e) => setQuoteFormData({...quoteFormData, frequency: e.target.value})}
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rq-nextIssueDate">First Issue Date *</Label>
                <Input
                  id="rq-nextIssueDate"
                  type="date"
                  value={quoteFormData.nextIssueDate}
                  onChange={(e) => setQuoteFormData({...quoteFormData, nextIssueDate: e.target.value})}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Create Schedule</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-zinc-200 pb-0">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'invoices' ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
        >
          Recurring Invoices
        </button>
        <button
          onClick={() => setActiveTab('quotes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'quotes' ? 'border-primary text-primary' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
        >
          Recurring Quotes
        </button>
      </div>

      {activeTab === 'invoices' && (
        <Card className="rounded-3xl border border-zinc-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
          <CardHeader className="p-6 border-b border-zinc-50">
            <CardTitle className="text-sm font-semibold text-zinc-800">Active Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            {recurring.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="w-8 h-8" />}
                title="No schedules active"
                description="Automate your billing by creating a recurring schedule. Perfect for retainers and subscriptions."
                action={{
                  label: "Create Schedule",
                  onClick: () => setIsDialogOpen(true)
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 uppercase bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-md">Client</th>
                      <th className="px-4 py-3">Frequency</th>
                      <th className="px-4 py-3">Next Issue</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right rounded-tr-md">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-medium">{item.clientName}</td>
                        <td className="px-4 py-3 capitalize">{item.frequency}</td>
                        <td className="px-4 py-3">{item.nextIssueDate ? format(new Date(item.nextIssueDate), 'MMM d, yyyy') : 'No date set'}</td>
                        <td className="px-4 py-3 font-medium">{getCurrencySymbol(item.currency || 'ZAR')}{(item.total || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-800'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => toggleStatus(item)} title={item.status === 'active' ? 'Pause' : 'Resume'}>
                              {item.status === 'active' ? <Pause className="w-4 h-4 text-zinc-500" /> : <Play className="w-4 h-4 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'quotes' && (
        <Card className="rounded-3xl border border-zinc-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
          <CardHeader className="p-6 border-b border-zinc-50">
            <CardTitle className="text-sm font-semibold text-zinc-800">Recurring Quote Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            {recurringQuotes.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="No recurring quotes set up"
                description="Automatically generate quotes on a recurring schedule for ongoing clients."
                action={{
                  label: "New Recurring Quote",
                  onClick: () => setIsQuoteDialogOpen(true)
                }}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 uppercase bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-md">Client</th>
                      <th className="px-4 py-3">Frequency</th>
                      <th className="px-4 py-3">Next Issue</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right rounded-tr-md">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringQuotes.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-medium">{item.clientName}</td>
                        <td className="px-4 py-3 capitalize">{item.frequency}</td>
                        <td className="px-4 py-3">{item.nextIssueDate ? format(new Date(item.nextIssueDate), 'MMM d, yyyy') : 'No date set'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-800'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => toggleQuoteStatus(item)} title={item.status === 'active' ? 'Pause' : 'Resume'}>
                              {item.status === 'active' ? <Pause className="w-4 h-4 text-zinc-500" /> : <Play className="w-4 h-4 text-green-600" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteQuoteId(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Schedule?"
        description="Are you sure you want to delete this recurring schedule? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={!!deleteQuoteId}
        title="Delete Recurring Quote Schedule?"
        description="Are you sure you want to delete this recurring quote schedule? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={() => deleteQuoteId && handleDeleteQuote(deleteQuoteId)}
        onCancel={() => setDeleteQuoteId(null)}
      />
    </motion.div>
  );
}
