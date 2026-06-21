import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase, fromDbQuote, fromDbInvoice } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Plus, FileText, Banknote, Clock, Search, Download, Copy, Check, BarChart3, Trash2, ArrowUpRight, TrendingUp, MessageCircle, AlertCircle, Files, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { getCurrencySymbol } from '../lib/currencies';
import { getUserFriendlyError } from '../lib/errorHandler';
import { formatZAR, statusBadgeStyles } from '../lib/theme';
import { generateWhatsAppShareLink, trackWhatsAppShare } from '../lib/whatsapp';

const DEMO_QUOTES = [
  { id: 'demo1', clientName: 'Global Tech Solutions', clientEmail: 'contact@globaltech.com', status: 'approved', total: 12500.00, createdAt: new Date().toISOString(), currency: 'USD' },
  { id: 'demo2', clientName: 'Urban Design Studio', clientEmail: 'info@urbandesign.io', status: 'sent', total: 4500.00, createdAt: new Date(Date.now() - 86400000).toISOString(), currency: 'USD' },
  { id: 'demo3', clientName: 'Heritage Restoration', clientEmail: 'office@heritagerest.com', status: 'converted', total: 6800.00, createdAt: new Date(Date.now() - 172800000).toISOString(), currency: 'USD' },
  { id: 'demo4', clientName: 'Peak Performance Inc', clientEmail: 'admin@peakperf.com', status: 'draft', total: 2400.00, createdAt: new Date(Date.now() - 259200000).toISOString(), currency: 'USD' },
];

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    pendingCount: 0,
    billedThisMonth: 0,
    avgJobValue: 0,
    profitThisMonth: 0,
    billedLastMonth: 0,
    completedJobs: 0,
    outstandingBalance: 0,
  });

  const defaultCurrency = profile?.defaultCurrency || 'ZAR';

  const formatCurrency = (amount: number, curr?: string) => {
    const selectedCurrency = curr || defaultCurrency;
    if (selectedCurrency === 'ZAR') {
      return formatZAR(amount);
    }
    return `${getCurrencySymbol(selectedCurrency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isQuoteExpired = (q: any) => {
    if (!q.expiresAt) return false;
    if (['approved', 'rejected', 'paid', 'converted'].includes(q.status)) return false;
    return new Date() > new Date(q.expiresAt);
  };

  const handleDuplicateQuote = async (q: any) => {
    if (!user) return;
    try {
      const { v4: uuidv4 } = await import('uuid');
      const newId = uuidv4();

      const { data: itemRows } = await supabase.from('line_items').select('*').eq('quote_id', q.id).order('sort_order', { ascending: true });

      const { error: qErr } = await supabase.from('quotes').insert({
        id: newId,
        user_id: user.uid,
        client_id: q.clientId || null,
        client_name: q.clientName || '',
        client_email: q.clientEmail || '',
        client_phone: q.clientPhone || '',
        notes: q.notes || '',
        tax_rate: q.taxRate ?? 0,
        subtotal: q.subtotal ?? 0,
        tax_amount: q.taxAmount ?? 0,
        total: q.total ?? 0,
        currency: q.currency || 'ZAR',
        validity_days: q.validityDays || '7',
        status: 'draft',
        contractor_business_name: q.contractorBusinessName || '',
        contractor_logo_url: q.contractorLogoUrl || '',
        contractor_terms: q.contractorTerms || '',
        is_milestone: q.isMilestone || false,
        progress_percent: q.progressPercent || 0,
      });
      if (qErr) throw qErr;

      if (itemRows && itemRows.length > 0) {
        const liRows = itemRows.map((item: any, i: number) => ({
          id: uuidv4(),
          quote_id: newId,
          description: item.description,
          qty: item.qty,
          unit_cost: item.unit_cost,
          type: item.type,
          markup_percent: item.markup_percent,
          sort_order: i,
        }));
        const { error: liErr } = await supabase.from('line_items').insert(liRows);
        if (liErr) throw liErr;
      }

      toast.success('Quote duplicated — editing new draft');
      navigate(`/quotes/${newId}`);
    } catch (err) {
      console.error('Duplicate error:', err);
      toast.error('Failed to duplicate quote');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId || !user) return;
    try {
      setIsDeleting(true);
      // Supabase CASCADE deletes line_items and expenses automatically
      const { error } = await supabase.from('quotes').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success("Quote deleted successfully");
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting quote:", error);
      toast.error("Failed to delete quote");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setRecentQuotes(DEMO_QUOTES);
      setStats({
        pendingCount: 1,
        billedThisMonth: 19300,
        avgJobValue: 7933.33,
        profitThisMonth: 12450,
        billedLastMonth: 14200,
        completedJobs: 3,
        outstandingBalance: 6800,
      });
      setLoading(false);
      return;
    }

    let quotesList: any[] = [];
    let invoicesList: any[] = [];

    const computeAndSetStats = async () => {
      let pending = 0;
      let billed = 0;
      let totalValue = 0;
      let approvedCount = 0;
      let billedLastMonth = 0;
      let completedJobs = 0;
      let totalExpensesThisMonth = 0;
      let outstandingBalance = 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
      const lastMonth = lastMonthDate.getMonth();
      const lastMonthYear = lastMonthDate.getFullYear();

      try {
        const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
        const { data: expensesData } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.uid)
          .gte('created_at', startOfMonth);
        if (expensesData) {
          expensesData.forEach(exp => {
            totalExpensesThisMonth += exp.amount || 0;
          });
        }
      } catch (err) {
        console.error("Failed to fetch expenses", err);
      }

      for (const q of quotesList) {
        if (q.status === 'sent' && !isQuoteExpired(q)) pending++;
        if (q.status === 'approved' || q.status === 'converted') {
          totalValue += q.total || 0;
          approvedCount++;
        }
      }

      const invoiceQuoteIds = new Set<string>();

      for (const inv of invoicesList) {
        if (inv.status !== 'paid' && inv.status !== 'cancelled') {
          outstandingBalance += inv.total || 0;
        }
      }

      for (const inv of invoicesList) {
        if (inv.createdAt) {
          const invDate = new Date(inv.createdAt);
          if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
            billed += inv.total || 0;
            completedJobs++;
            if (inv.quoteId) {
              invoiceQuoteIds.add(inv.quoteId);
            } else if (inv.estimateId) {
              invoiceQuoteIds.add(inv.estimateId);
            }
          }
          if (invDate.getMonth() === lastMonth && invDate.getFullYear() === lastMonthYear) {
            billedLastMonth += inv.total || 0;
          }
        }
      }

      for (const q of quotesList) {
        if (q.status === 'approved' || q.status === 'converted') {
          const updateDateStr = q.approvedAt || q.createdAt;
          if (updateDateStr) {
            const updateDate = new Date(updateDateStr);
            if (updateDate.getMonth() === currentMonth && updateDate.getFullYear() === currentYear) {
              if (!invoiceQuoteIds.has(q.id)) {
                billed += q.total || 0;
                completedJobs++;
              }
            }
          }
        }
      }

      setStats({
        pendingCount: pending,
        billedThisMonth: billed,
        avgJobValue: approvedCount > 0 ? totalValue / approvedCount : 0,
        profitThisMonth: billed - totalExpensesThisMonth,
        billedLastMonth,
        completedJobs,
        outstandingBalance,
      });
      setLoading(false);
    };

    const fetchQuotes = async () => {
      const { data } = await supabase
        .from('quotes')
        .select('*')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        quotesList = data.map(fromDbQuote);
        setRecentQuotes(quotesList);
        await computeAndSetStats();
      }
    };

    const fetchInvoices = async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.uid);
      if (data) {
        invoicesList = data.map(fromDbInvoice);
        await computeAndSetStats();
      }
    };

    // Initial fetches
    fetchQuotes().catch((error) => {
      console.error("Dashboard quotes fetch error:", error);
      toast.error(getUserFriendlyError(error));
      setLoading(false);
    });
    fetchInvoices().catch((error) => {
      console.error("Dashboard invoices fetch error:", error);
    });

    // Realtime subscription for quotes
    const quotesChannel = supabase
      .channel(`dashboard-quotes-${user.uid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'quotes',
        filter: `user_id=eq.${user.uid}`,
      }, async () => {
        await fetchQuotes();
      })
      .subscribe();

    // Realtime subscription for invoices
    const invoicesChannel = supabase
      .channel(`dashboard-invoices-${user.uid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'invoices',
        filter: `user_id=eq.${user.uid}`,
      }, async () => {
        await fetchInvoices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(invoicesChannel);
    };
  }, [user]);

  const filteredQuotes = recentQuotes.filter(q =>
    (q.clientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.status || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['ID', 'Client Name', 'Client Email', 'Status', 'Total', 'Created At'];
    const csvData = filteredQuotes.map(q => [
      q.id,
      `"${q.clientName || ''}"`,
      `"${q.clientEmail || ''}"`,
      q.status,
      q.total || 0,
      q.createdAt ? new Date(q.createdAt).toISOString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `quotes_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/client/quote/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Client link copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleWhatsAppShare = (quote: any) => {
    try {
      const share = generateWhatsAppShareLink(
        { ...quote, contractorBusinessName: profile?.businessName },
        window.location.origin
      );
      trackWhatsAppShare(quote.id, 'quote_list');
      window.open(share.href, '_blank', 'noopener,noreferrer');
      toast.success('WhatsApp opened — tap Send to deliver.');
    } catch (error: any) {
      toast.error(error?.message || 'Could not open WhatsApp. Check the client phone number.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex flex-col gap-2">
          <div className="h-9 bg-zinc-200 w-64 rounded-xl"></div>
          <div className="h-4 bg-zinc-200 w-96 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-zinc-200 rounded-3xl"></div>
          ))}
        </div>
        <div className="h-96 bg-zinc-200 rounded-3xl"></div>
      </div>
    );
  }

  const getStatusBadgeClassAndLabel = (status: string, isExpired: boolean) => {
    const activeStatus = isExpired ? 'expired' : (status || 'draft').toLowerCase();

    switch (activeStatus) {
      case 'approved':
        return { style: statusBadgeStyles.approved, label: 'Approved' };
      case 'sent':
        return { style: statusBadgeStyles.sent, label: 'Sent' };
      case 'converted':
        return { style: statusBadgeStyles.converted, label: 'Converted' };
      case 'paid':
        return { style: statusBadgeStyles.paid, label: 'Paid' };
      case 'overdue':
        return { style: statusBadgeStyles.overdue, label: 'Overdue' };
      case 'rejected':
        return { style: statusBadgeStyles.rejected, label: 'Declined' };
      case 'expired':
        return { style: 'bg-red-50 text-red-700 border border-red-200', label: 'Expired' };
      default:
        return { style: statusBadgeStyles.draft, label: 'Draft' };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-zinc-900">
            {user ? `Welcome, ${profile?.businessName || 'Business Owner'}` : 'SoloBid Dashboard'}
          </h1>
          <p className="text-zinc-500 mt-1.5 text-base font-normal">
            {user ? "Manage your quotes, track billing, and review active client pipelines." : "Get a high-level view of your business pipeline instantly."}
          </p>
        </div>

        <Button
          asChild
          size="lg"
          className="w-full md:w-auto bg-primary hover:bg-[#03362f] text-white font-medium shadow-sm active:scale-[0.985] cursor-pointer"
        >
          <Link to="/quotes/new">
            <Plus className="w-5 h-5 mr-2 stroke-[2.5]" />
            {user ? 'New Quote' : 'Start Professional Account'}
          </Link>
        </Button>
      </div>

      {!user && (
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 text-white border-none overflow-hidden relative group rounded-3xl shadow-xl">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
            <BarChart3 className="w-48 h-48 rotate-12" />
          </div>
          <CardContent className="p-8 md:p-10 relative z-10">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-4">
                <TrendingUp className="w-3.5 h-3.5" />
                Demo Workspace
              </span>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">Professional Quote Control In Demo Mode</h2>
              <p className="text-zinc-300 text-base mb-6 leading-relaxed max-w-2xl font-light">
                Secure your database, gain offline client invoice generators, customizable templates, automatic currency conversion, and direct payment integrations.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="bg-white text-zinc-900 border-none hover:bg-zinc-100 font-medium" asChild>
                  <Link to="/">Create Free Account</Link>
                </Button>
                <Button variant="ghost" className="text-white hover:bg-white/10 font-medium" asChild>
                  <Link to="/">Sign In</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
        {[
          {
            title: "Billed This Month",
            value: formatCurrency(stats.billedThisMonth),
            icon: Banknote,
            accent: "bg-teal-50 text-teal-900 border-teal-200/50"
          },
          {
            title: "Outstanding",
            value: formatCurrency(stats.outstandingBalance),
            icon: AlertCircle,
            accent: stats.outstandingBalance > 0 ? "bg-amber-50 text-amber-800 border-amber-200/50" : "bg-zinc-50 text-zinc-500 border-zinc-200/50"
          },
          {
            title: "Vs Last Month",
            value: `${stats.billedLastMonth > 0 ? Math.round(((stats.billedThisMonth - stats.billedLastMonth) / stats.billedLastMonth) * 100) : 0}%`,
            icon: TrendingUp,
            accent: stats.billedThisMonth >= stats.billedLastMonth ? "bg-emerald-50 text-emerald-900 border-emerald-200/50" : "bg-amber-50 text-amber-800 border-amber-200/50"
          },
          {
            title: "Jobs Completed",
            value: stats.completedJobs.toString(),
            icon: Check,
            accent: "bg-blue-50 text-blue-700 border-blue-100/50"
          },
          {
            title: "Average Job Value",
            value: formatCurrency(stats.avgJobValue),
            icon: FileText,
            accent: "bg-purple-50 text-purple-700 border-purple-100/50"
          }
        ].map((stat, i) => (
          <Card key={i} className={`rounded-3xl border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.035)] hover:-translate-y-0.5 group${i === 4 ? ' col-span-2 lg:col-span-1' : ''}`}>
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400 group-hover:text-zinc-500 transition-colors">{stat.title}</span>
                <p className="text-xl md:text-3xl font-semibold tracking-tight text-zinc-900">{stat.value}</p>
                {stat.title === 'Vs Last Month' && (
                  <p className="text-[11px] text-zinc-400">Last month: {formatCurrency(stats.billedLastMonth)}</p>
                )}
              </div>
              <div className={`p-2.5 rounded-2xl border ${stat.accent} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 stroke-[2]" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Recent Quotes Panel */}
      <Card className="rounded-3xl border border-zinc-100 bg-white overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-zinc-50 bg-zinc-50/40">
          <div>
            <CardTitle className="text-xl font-semibold text-zinc-900">Recent Quote Ledger</CardTitle>
            <CardDescription className="text-zinc-500 text-xs mt-0.5">Edit, track, replicate and share quotes directly with your clients.</CardDescription>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                type="search"
                placeholder="Search clients or status..."
                className="pl-9 h-9.5 rounded-xl border-zinc-200 bg-white shadow-sm font-normal text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9.5 w-9.5 rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 cursor-pointer shadow-sm active:scale-95"
              onClick={handleExportCSV}
              title="Export CSV"
            >
              <Download className="h-4.5 w-4.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredQuotes.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={searchQuery ? <Search className="w-10 h-10 text-zinc-400" /> : <BarChart3 className="w-10 h-10 text-zinc-400" />}
                title={searchQuery ? "No matches found" : "No quotes yet"}
                description={searchQuery ? "Try altering your filters or search keywords." : "Create your first quote and send it for client approval in minutes."}
                action={!searchQuery ? { label: 'Create Quote', onClick: () => navigate('/quotes/new') } : undefined}
              />
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {/* Mobile Card Row View */}
              <div className="md:hidden divide-y divide-zinc-50">
                {filteredQuotes.map((q) => {
                  const isExpired = isQuoteExpired(q);
                  const badge = getStatusBadgeClassAndLabel(q.status, isExpired);
                  return (
                    <div key={q.id} className="p-5 bg-white bg-slate-50/10 hover:bg-zinc-50/30 transition-all duration-300 space-y-3 relative">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-0.5">
                          <Link to={`/quotes/${q.id}`} className="font-semibold text-zinc-900 hover:text-primary transition-colors text-base line-clamp-1">
                            {q.clientName || 'Unnamed Client'}
                          </Link>
                          <div className="text-xs text-zinc-400 space-y-0.5">
                            <p className="flex items-center gap-1.5">
                              <span>Sent: {q.createdAt ? format(new Date(q.createdAt), 'yyyy/MM/dd') : '-'}</span>
                            </p>
                            {q.expiresAt && (
                              <p className={isExpired ? 'text-red-500 font-medium' : 'text-zinc-400'}>
                                Valid: {format(new Date(q.expiresAt), 'yyyy/MM/dd')}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border uppercase shrink-0 ${badge.style}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-50">
                        <span className="font-semibold text-zinc-900 text-lg">
                          {formatCurrency(q.total || 0, q.currency)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8.5 w-8.5 rounded-lg border-[#25D366] bg-[#25D366] text-white hover:bg-[#1fb958] hover:border-[#1fb958]"
                            onClick={() => handleWhatsAppShare(q)}
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8.5 rounded-lg text-xs border-zinc-200 text-zinc-700 hover:bg-teal-50 hover:text-primary hover:border-primary/20 px-2.5"
                            onClick={() => navigate(`/quotes/${q.id}`)}
                          >
                            Open
                            <ArrowUpRight className="w-3 h-3 ml-1" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="outline" className="h-8.5 w-8.5 rounded-lg border-zinc-200 text-zinc-500">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => handleCopyLink(q.id)}>
                                {copiedId === q.id ? <Check className="w-3.5 h-3.5 mr-2 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
                                Copy Link
                              </DropdownMenuItem>
                              {user && (
                                <DropdownMenuItem onClick={() => handleDuplicateQuote(q)}>
                                  <Files className="w-3.5 h-3.5 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                              )}
                              {user && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setDeleteId(q.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/50 text-xs font-semibold tracking-wider text-zinc-400 border-b border-zinc-100">
                      <th className="px-6 py-4">Client Detail</th>
                      <th className="px-6 py-4">Dates & Validity</th>
                      <th className="px-6 py-4">Status Flag</th>
                      <th className="px-6 py-4 text-right">Aggregate Total</th>
                      <th className="px-6 py-4 text-right">Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 bg-white">
                    {filteredQuotes.map((q) => {
                      const isExpired = isQuoteExpired(q);
                      const badge = getStatusBadgeClassAndLabel(q.status, isExpired);
                      return (
                        <tr key={q.id} className="hover:bg-zinc-50/50 transition-colors group">
                          <td className="px-6 py-4.5">
                            <div className="flex flex-col max-w-sm">
                              <Link to={`/quotes/${q.id}`} className="font-semibold text-zinc-800 hover:text-primary transition-colors text-base line-clamp-1">
                                {q.clientName || 'Unnamed Client'}
                              </Link>
                              <span className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{q.clientEmail || 'No Email Registered'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex flex-col text-xs text-zinc-500 space-y-0.5">
                              <span className="font-medium text-zinc-600">Created: {q.createdAt ? format(new Date(q.createdAt), 'MMM d, yyyy') : '-'}</span>
                              {q.expiresAt && (
                                <span className={`flex items-center gap-1 ${isExpired ? 'text-red-500 font-semibold' : 'text-zinc-400'}`}>
                                  Expiry: {format(new Date(q.expiresAt), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4.5">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wider border uppercase ${badge.style}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-6 py-4.5 text-right font-semibold text-zinc-800 text-base tabular-nums">
                            {formatCurrency(q.total || 0, q.currency)}
                          </td>
                          <td className="px-6 py-4.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-zinc-800 bg-white border-zinc-200 shadow-sm"
                                onClick={() => handleCopyLink(q.id)}
                                title="Copy Secure Client Link"
                              >
                                {copiedId === q.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8.5 w-8.5 rounded-xl border-[#25D366] bg-[#25D366] text-white hover:bg-[#1fb958] hover:border-[#1fb958] shadow-sm"
                                onClick={() => handleWhatsAppShare(q)}
                                title="Share on WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-primary bg-white border-zinc-200 hover:bg-teal-100/40 hover:border-primary/20 shadow-sm"
                                onClick={() => navigate(`/quotes/${q.id}`)}
                                title="Edit and Revise Quote"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </Button>
                              {user && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 bg-white border-zinc-200 shadow-sm"
                                  onClick={() => handleDuplicateQuote(q)}
                                  title="Duplicate Quote"
                                >
                                  <Files className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {user && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8.5 w-8.5 rounded-xl text-zinc-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 bg-white border-zinc-200 shadow-sm"
                                  onClick={() => setDeleteId(q.id)}
                                  title="Delete Permanent Archive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Quote Log"
        description="Are you sure you want to delete this quote record permanently? All referenced dynamic line items, materials, and internal expense trackers will be deleted. This cannot be undone."
        confirmLabel="Confirm Delete"
        cancelLabel="Keep Safe"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </motion.div>
  );
}
