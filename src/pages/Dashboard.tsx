import React, { useEffect, useState } from 'react';
import type { Quote, Invoice } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase, fromDbQuote, fromDbInvoice } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Plus, Banknote, Search, Download, Copy, Check, BarChart3, Trash2, ArrowUpRight, TrendingUp, MessageCircle, AlertCircle, Files } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { getCurrencySymbol } from '../lib/currencies';
import { getUserFriendlyError } from '../lib/errorHandler';
import { formatZAR, statusBadgeStyles } from '../lib/theme';
import { generateWhatsAppShareLink, trackWhatsAppShare } from '../lib/whatsapp';
import { FollowUpCopilot } from '../components/dashboard/FollowUpCopilot';

const DEMO_QUOTES: Quote[] = [
  { id: 'demo1', uid: '', clientName: 'Local Repairs Co', clientEmail: 'owner@example.co.za', status: 'viewed', total: 12500.00, subtotal: 12500.00, taxRate: 0, taxAmount: 0, createdAt: new Date(Date.now() - 86400000).toISOString(), currency: 'ZAR' },
  { id: 'demo2', uid: '', clientName: 'Urban Design Studio', clientEmail: 'info@example.co.za', status: 'sent', total: 4500.00, subtotal: 4500.00, taxRate: 0, taxAmount: 0, createdAt: new Date(Date.now() - 172800000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), currency: 'ZAR' },
  { id: 'demo3', uid: '', clientName: 'Heritage Restoration', clientEmail: 'office@example.co.za', status: 'approved', total: 6800.00, subtotal: 6800.00, taxRate: 0, taxAmount: 0, createdAt: new Date(Date.now() - 259200000).toISOString(), currency: 'ZAR' },
  { id: 'demo4', uid: '', clientName: 'Peak Performance Inc', clientEmail: 'admin@example.co.za', status: 'draft', total: 2400.00, subtotal: 2400.00, taxRate: 0, taxAmount: 0, createdAt: new Date(Date.now() - 345600000).toISOString(), currency: 'ZAR' },
];

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [recentQuotes, setRecentQuotes] = useState<Quote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({ pendingCount: 0, billedThisMonth: 0, avgJobValue: 0, profitThisMonth: 0, billedLastMonth: 0, completedJobs: 0, outstandingBalance: 0 });

  const defaultCurrency = profile?.defaultCurrency || 'ZAR';
  const formatCurrency = (amount: number, curr?: string) => {
    const selectedCurrency = curr || defaultCurrency;
    if (selectedCurrency === 'ZAR') return formatZAR(amount);
    return `${getCurrencySymbol(selectedCurrency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isQuoteExpired = (q: Quote) => {
    if (!q.expiresAt) return false;
    if (['approved', 'rejected', 'converted'].includes(q.status)) return false;
    return new Date() > new Date(q.expiresAt);
  };

  const computeStats = (quotesList: Quote[], invoicesList: Invoice[]) => {
    let pending = 0;
    let billed = 0;
    let totalValue = 0;
    let approvedCount = 0;
    let billedLastMonth = 0;
    let completedJobs = 0;
    let outstandingBalance = 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();
    const invoiceQuoteIds = new Set<string>();

    for (const inv of invoicesList) {
      if (inv.status !== 'paid' && inv.status !== 'cancelled') outstandingBalance += inv.total || 0;
      if (!inv.createdAt) continue;
      const invDate = new Date(inv.createdAt);
      if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
        billed += inv.total || 0;
        completedJobs++;
        if (inv.quoteId) invoiceQuoteIds.add(inv.quoteId);
        if (inv.estimateId) invoiceQuoteIds.add(inv.estimateId);
      }
      if (invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear) billedLastMonth += inv.total || 0;
    }

    for (const q of quotesList) {
      if ((q.status === 'sent' || q.status === 'viewed') && !isQuoteExpired(q)) pending++;
      if (q.status === 'approved' || q.status === 'converted') {
        totalValue += q.total || 0;
        approvedCount++;
        const updateDateStr = q.approvedAt || q.updatedAt || q.createdAt;
        if (updateDateStr) {
          const updateDate = new Date(updateDateStr);
          if (updateDate.getMonth() === currentMonth && updateDate.getFullYear() === currentYear && !invoiceQuoteIds.has(q.id)) {
            billed += q.total || 0;
            completedJobs++;
          }
        }
      }
    }

    setStats({ pendingCount: pending, billedThisMonth: billed, avgJobValue: approvedCount > 0 ? totalValue / approvedCount : 0, profitThisMonth: billed, billedLastMonth, completedJobs, outstandingBalance });
    setLoading(false);
  };

  const loadDashboard = async () => {
    if (!user) { setRecentQuotes(DEMO_QUOTES); computeStats(DEMO_QUOTES, []); return; }
    try {
      const [{ data: quoteRows }, { data: invoiceRows }] = await Promise.all([
        supabase.from('quotes').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }).limit(50),
        supabase.from('invoices').select('*').eq('user_id', user.uid),
      ]);
      const quotesList = (quoteRows || []).map(fromDbQuote);
      const invoicesList = (invoiceRows || []).map(fromDbInvoice);
      setRecentQuotes(quotesList);
      computeStats(quotesList, invoicesList);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Dashboard load error:', error);
      toast.error(getUserFriendlyError(error));
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    if (!user) return;
    const quotesChannel = supabase.channel(`dashboard-quotes-${user.uid}`).on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `user_id=eq.${user.uid}` }, loadDashboard).subscribe();
    const invoicesChannel = supabase.channel(`dashboard-invoices-${user.uid}`).on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.uid}` }, loadDashboard).subscribe();
    return () => { supabase.removeChannel(quotesChannel); supabase.removeChannel(invoicesChannel); };
  }, [user]);

  const filteredQuotes = recentQuotes.filter(q => (q.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (q.status || '').toLowerCase().includes(searchQuery.toLowerCase()));

  const handleExportCSV = () => {
    const headers = ['ID', 'Client Name', 'Client Email', 'Status', 'Total', 'Created At'];
    const csvData = filteredQuotes.map(q => [q.id, `"${q.clientName || ''}"`, `"${q.clientEmail || ''}"`, q.status, q.total || 0, q.createdAt ? new Date(q.createdAt).toISOString() : '']);
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `quotes_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = (id: string) => { navigator.clipboard.writeText(`${window.location.origin}/client/quote/${id}`); setCopiedId(id); toast.success('Client closing-room link copied'); setTimeout(() => setCopiedId(null), 2000); };
  const handleWhatsAppShare = (quote: Quote) => {
    try { const share = generateWhatsAppShareLink({ ...quote, contractorBusinessName: profile?.businessName }, window.location.origin); trackWhatsAppShare(quote.id, 'follow_up_copilot'); window.open(share.href, '_blank', 'noopener,noreferrer'); toast.success('WhatsApp opened — tap Send to deliver.'); }
    catch (error: any) { toast.error(error?.message || 'Could not open WhatsApp. Check the client phone number.'); }
  };

  const handleDuplicateQuote = async (q: Quote) => {
    if (!user) return;
    try {
      const { v4: uuidv4 } = await import('uuid');
      const newId = uuidv4();
      const { data: itemRows } = await supabase.from('line_items').select('*').eq('quote_id', q.id).order('sort_order', { ascending: true });
      const { error: qErr } = await supabase.from('quotes').insert({ id: newId, user_id: user.uid, client_id: q.clientId || null, client_name: q.clientName || '', client_email: q.clientEmail || '', client_phone: q.clientPhone || '', notes: q.notes || '', tax_rate: q.taxRate ?? 0, subtotal: q.subtotal ?? 0, tax_amount: q.taxAmount ?? 0, total: q.total ?? 0, currency: q.currency || 'ZAR', validity_days: q.validityDays || '7', status: 'draft', contractor_business_name: q.contractorBusinessName || '', contractor_logo_url: q.contractorLogoUrl || '', contractor_terms: q.contractorTerms || '', is_milestone: q.isMilestone || false, progress_percent: q.progressPercent || 0 });
      if (qErr) throw qErr;
      if (itemRows && itemRows.length > 0) {
        const liRows = itemRows.map((item: any, i: number) => ({ id: uuidv4(), quote_id: newId, description: item.description, qty: item.qty, unit_cost: item.unit_cost, type: item.type, markup_percent: item.markup_percent, sort_order: i }));
        const { error: liErr } = await supabase.from('line_items').insert(liRows);
        if (liErr) throw liErr;
      }
      toast.success('Quote duplicated — editing new draft');
      navigate(`/quotes/${newId}`);
    } catch (err) { if (import.meta.env.DEV) console.error('Duplicate error:', err); toast.error('Failed to duplicate quote'); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId || !user) return;
    try { setIsDeleting(true); const { error } = await supabase.from('quotes').delete().eq('id', deleteId); if (error) throw error; toast.success('Quote deleted successfully'); setDeleteId(null); await loadDashboard(); }
    catch (error) { if (import.meta.env.DEV) console.error('Error deleting quote:', error); toast.error('Failed to delete quote'); }
    finally { setIsDeleting(false); }
  };

  const getStatusBadgeClassAndLabel = (status: string, isExpired: boolean) => {
    const activeStatus = isExpired ? 'expired' : (status || 'draft').toLowerCase();
    const labels: Record<string, string> = { approved: 'Approved', sent: 'Sent', viewed: 'Viewed', converted: 'Invoiced', rejected: 'Declined', expired: 'Expired', draft: 'Draft' };
    const style = statusBadgeStyles[activeStatus] || statusBadgeStyles.draft;
    const label = labels[activeStatus] || activeStatus.replace(/_/g, ' ');
    return { style, label };
  };

  if (loading) {
    return <div className="space-y-8 animate-pulse"><div className="h-16 bg-zinc-200 w-full max-w-xl rounded-3xl" /><div className="h-52 bg-zinc-200 rounded-3xl" /><div className="grid grid-cols-1 md:grid-cols-3 gap-5">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-zinc-200 rounded-3xl" />)}</div></div>;
  }

  const primaryStats = [
    { title: 'Active Quotes', value: stats.pendingCount.toString(), icon: MessageCircle, accent: 'bg-emerald-50 text-emerald-900 border-emerald-200/50', href: '/dashboard', sub: 'Needs follow-up' },
    { title: 'Outstanding', value: formatCurrency(stats.outstandingBalance), icon: AlertCircle, accent: stats.outstandingBalance > 0 ? 'bg-amber-50 text-amber-800 border-amber-200/50' : 'bg-zinc-50 text-zinc-500 border-zinc-200/50', href: '/invoices', sub: 'Invoice balance' },
    { title: 'Billed This Month', value: formatCurrency(stats.billedThisMonth), icon: Banknote, accent: 'bg-teal-50 text-teal-900 border-teal-200/50', href: '/invoices', sub: `${stats.completedJobs} completed job${stats.completedJobs === 1 ? '' : 's'}` },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }} className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400 mb-1.5">Quote closing workspace</p><h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-zinc-900">{user ? `Welcome, ${profile?.businessName || 'Business Owner'}` : 'SoloBid Dashboard'}</h1><p className="text-zinc-500 mt-1.5 text-base font-normal">{user ? 'Start with follow-ups, then review pipeline health and quote records.' : 'See how SoloBid turns quote links into signed work.'}</p></div>
        <Button asChild size="lg" className="w-full md:w-auto bg-primary hover:bg-[#03362f] text-white font-medium shadow-sm active:scale-[0.985] cursor-pointer"><Link to="/quotes/new"><Plus className="w-5 h-5 mr-2 stroke-[2.5]" />{user ? 'New Quote' : 'Start Free Account'}</Link></Button>
      </div>

      {!user && <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white border-none overflow-hidden relative group rounded-3xl shadow-xl"><div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity duration-500"><BarChart3 className="w-48 h-48 rotate-12" /></div><CardContent className="p-8 md:p-10 relative z-10"><div className="max-w-3xl"><span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-4"><TrendingUp className="w-3.5 h-3.5" /> Demo Workspace</span><h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">Quote closing room + follow-up copilot</h2><p className="text-zinc-300 text-base mb-6 leading-relaxed max-w-2xl font-light">Create a quote, share a client approval link on WhatsApp, get a digital sign-off, then invoice and track EFT/payment status manually.</p><div className="flex flex-wrap gap-3"><Button variant="outline" className="bg-white text-zinc-900 border-none hover:bg-zinc-100 font-medium" asChild><Link to="/">Create Free Account</Link></Button><Button variant="ghost" className="text-white hover:bg-white/10 font-medium" asChild><Link to="/">Sign In</Link></Button></div></div></CardContent></Card>}

      <FollowUpCopilot quotes={recentQuotes} formatCurrency={formatCurrency} onCopyLink={handleCopyLink} onWhatsAppShare={handleWhatsAppShare} copiedId={copiedId} />

      <section className="space-y-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Pipeline Health</p><p className="mt-1 text-sm text-zinc-500">A compact overview. Detailed action chasing lives in the copilot and Today.</p></div><div className="grid grid-cols-1 gap-5 md:grid-cols-3">{primaryStats.map((stat, i) => <Link key={i} to={stat.href} className="block rounded-3xl border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.035)] hover:-translate-y-0.5 group cursor-pointer"><div className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 group-hover:text-zinc-600 transition-colors">{stat.title}</span><div className={`p-2 rounded-xl border ${stat.accent} flex items-center justify-center`}><stat.icon className="w-4 h-4 stroke-[2]" /></div></div><p className="text-2xl font-bold tracking-tight text-zinc-900 whitespace-nowrap">{stat.value}</p><p className="text-xs text-zinc-400">{stat.sub}</p></div></Link>)}</div></section>

      <Card className="rounded-3xl border border-zinc-100 bg-white overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-zinc-50 bg-zinc-50/40"><div><CardTitle className="text-xl font-semibold text-zinc-900">Recent Quote Ledger</CardTitle><CardDescription className="text-zinc-500 text-xs mt-0.5">Search, edit, resend and duplicate quote-closing links.</CardDescription></div><div className="flex items-center gap-2.5 w-full sm:w-auto"><div className="relative flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" /><Input type="search" placeholder="Search clients or status..." className="pl-9 h-9.5 rounded-xl border-zinc-200 bg-white shadow-sm font-normal text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div><Button variant="outline" size="icon" className="h-9.5 w-9.5 rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 cursor-pointer shadow-sm active:scale-95" onClick={handleExportCSV} title="Export CSV"><Download className="h-4.5 w-4.5" /></Button></div></CardHeader>
        <CardContent className="p-0">{filteredQuotes.length === 0 ? <div className="py-12"><EmptyState icon={searchQuery ? <Search className="w-10 h-10 text-zinc-400" /> : <BarChart3 className="w-10 h-10 text-zinc-400" />} title={searchQuery ? 'No matches found' : 'No quotes yet'} description={searchQuery ? 'Try altering your filters or search keywords.' : 'Create your first quote and send it for client approval in minutes.'} action={!searchQuery ? { label: 'Create Quote', onClick: () => navigate('/quotes/new') } : undefined} /></div> : <div className="divide-y divide-zinc-50">{filteredQuotes.map((q) => { const expired = isQuoteExpired(q); const badge = getStatusBadgeClassAndLabel(q.status, expired); return <div key={q.id} className="grid gap-4 p-5 transition-all hover:bg-zinc-50/60 md:grid-cols-[1.25fr_0.8fr_0.55fr_0.7fr] md:items-center"><div><Link to={`/quotes/${q.id}`} className="font-semibold text-zinc-900 hover:text-primary transition-colors text-base line-clamp-1">{q.clientName || 'Unnamed Client'}</Link><p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{q.clientEmail || 'No email registered'}</p></div><div className="text-xs text-zinc-500 space-y-0.5"><p>Created: {q.createdAt ? format(new Date(q.createdAt), 'MMM d, yyyy') : '-'}</p>{q.expiresAt && <p className={expired ? 'text-red-500 font-semibold' : 'text-zinc-400'}>Expiry: {format(new Date(q.expiresAt), 'MMM d, yyyy')}</p>}</div><div><span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wider border uppercase ${badge.style}`}>{badge.label}</span></div><div className="flex flex-wrap items-center justify-start gap-1.5 md:justify-end"><span className="mr-1 text-sm font-semibold text-zinc-900">{formatCurrency(q.total || 0, q.currency)}</span><Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-zinc-800 bg-white border-zinc-200 shadow-sm" onClick={() => handleCopyLink(q.id)} title="Copy client closing-room link">{copiedId === q.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}</Button><Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl border-[#25D366] bg-[#25D366] text-white hover:bg-[#1fb958] hover:border-[#1fb958] shadow-sm" onClick={() => handleWhatsAppShare(q)} title="Share on WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></Button><Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-primary bg-white border-zinc-200 hover:bg-teal-100/40 hover:border-primary/20 shadow-sm" onClick={() => navigate(`/quotes/${q.id}`)} title="Edit quote"><ArrowUpRight className="h-3.5 w-3.5" /></Button>{user && <Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 bg-white border-zinc-200 shadow-sm" onClick={() => handleDuplicateQuote(q)} title="Duplicate quote"><Files className="h-3.5 w-3.5" /></Button>}{user && <Button variant="outline" size="icon" className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 bg-white border-zinc-200 shadow-sm" onClick={() => setDeleteId(q.id)} title="Delete quote"><Trash2 className="h-3.5 w-3.5" /></Button>}</div></div>; })}</div>}</CardContent>
      </Card>

      <ConfirmDialog open={!!deleteId} title="Delete Quote Log" description="Are you sure you want to delete this quote record permanently? All referenced line items, materials, and internal expense trackers will be deleted. This cannot be undone." confirmLabel="Confirm Delete" cancelLabel="Keep Safe" isDangerous={true} isLoading={isDeleting} onConfirm={handleConfirmDelete} onCancel={() => setDeleteId(null)} />
    </motion.div>
  );
}
