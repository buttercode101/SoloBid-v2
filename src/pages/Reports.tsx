import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { fromDbInvoice, fromDbQuote, supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { subDays, subMonths, format, isAfter, differenceInDays, isSameMonth } from 'date-fns';
import { Download, TrendingUp, Banknote, AlertCircle, Users } from 'lucide-react';
import { getCurrencySymbol } from '../lib/currencies';
import { formatZAR } from '../lib/theme';
import { toast } from 'sonner';

const ReportsRevenueChart = lazy(() =>
  import('../components/ReportsRevenueChart').then((module) => ({ default: module.ReportsRevenueChart }))
);

type DateRange = '30d' | '90d' | '12m';

type ReportQuote = ReturnType<typeof fromDbQuote>;
type ReportInvoice = ReturnType<typeof fromDbInvoice>;

const QUOTE_REPORT_COLUMNS = 'id,user_id,client_name,status,total,currency,created_at,approved_at,updated_at';
const INVOICE_REPORT_COLUMNS = 'id,user_id,quote_id,invoice_number,client_name,total,currency,status,due_date,paid_at,created_at,updated_at';

function getCreatedDate(record: { createdAt?: string | null; created_at?: string | null }) {
  return new Date(record.createdAt || record.created_at || 0);
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function Reports() {
  const { user, profile } = useAuth();
  const [quotes, setQuotes] = useState<ReportQuote[]>([]);
  const [invoices, setInvoices] = useState<ReportInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const defaultCurrency = profile?.defaultCurrency || 'ZAR';

  const formatCurrency = useCallback((amount: number, currency = defaultCurrency) => {
    if (currency === 'ZAR') return formatZAR(amount);
    return `${getCurrencySymbol(currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [defaultCurrency]);

  const fetchReportData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [{ data: quotesData, error: quotesError }, { data: invoicesData, error: invoicesError }] = await Promise.all([
        supabase
          .from('quotes')
          .select(QUOTE_REPORT_COLUMNS)
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select(INVOICE_REPORT_COLUMNS)
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false }),
      ]);

      if (quotesError) throw quotesError;
      if (invoicesError) throw invoicesError;

      setQuotes((quotesData || []).map(fromDbQuote));
      setInvoices((invoicesData || []).map(fromDbInvoice));
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Could not load reports. Please try again.');
      setQuotes([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchReportData();

    const channel = supabase
      .channel(`reports-sync-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `user_id=eq.${user.uid}` }, fetchReportData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.uid}` }, fetchReportData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReportData, user]);

  const cutoffDate = useMemo(() => {
    if (dateRange === '30d') return subDays(new Date(), 30);
    if (dateRange === '90d') return subDays(new Date(), 90);
    return subMonths(new Date(), 12);
  }, [dateRange]);

  const filteredQuotes = useMemo(
    () => quotes.filter((quote) => isAfter(getCreatedDate(quote), cutoffDate)),
    [quotes, cutoffDate]
  );

  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => isAfter(getCreatedDate(invoice), cutoffDate)),
    [invoices, cutoffDate]
  );

  const totalBilled = useMemo(
    () => filteredInvoices.reduce((sum, invoice) => sum + (invoice.total ?? 0), 0),
    [filteredInvoices]
  );

  const totalCollected = useMemo(
    () => filteredInvoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + (invoice.total ?? 0), 0),
    [filteredInvoices]
  );

  const outstanding = useMemo(
    () => filteredInvoices.filter((invoice) => ['sent', 'overdue'].includes(invoice.status)).reduce((sum, invoice) => sum + (invoice.total ?? 0), 0),
    [filteredInvoices]
  );

  const conversionRate = useMemo(() => {
    const sent = filteredQuotes.filter((quote) => quote.status !== 'draft').length;
    const converted = filteredQuotes.filter((quote) => ['approved', 'converted'].includes(quote.status)).length;
    if (sent === 0) return 0;
    return Math.round((converted / sent) * 100);
  }, [filteredQuotes]);

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, index) => {
      const date = subMonths(new Date(), 11 - index);
      return { month: format(date, 'MMM yy'), billed: 0, collected: 0, _date: date };
    });

    for (const invoice of invoices) {
      const invoiceDate = getCreatedDate(invoice);
      const bucket = months.find((month) => isSameMonth(month._date, invoiceDate));
      if (bucket) {
        bucket.billed += invoice.total ?? 0;
        if (invoice.status === 'paid') bucket.collected += invoice.total ?? 0;
      }
    }

    return months.map(({ month, billed, collected }) => ({ month, billed, collected }));
  }, [invoices]);

  const outstandingInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => ['sent', 'overdue'].includes(invoice.status))
        .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()),
    [invoices]
  );

  const topClients = useMemo(() => {
    const totalsByClient: Record<string, number> = {};
    for (const invoice of invoices) {
      const name = invoice.clientName || 'Unknown';
      totalsByClient[name] = (totalsByClient[name] ?? 0) + (invoice.total ?? 0);
    }
    return Object.entries(totalsByClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [invoices]);

  const handleExportCSV = () => {
    const headers = ['Invoice ID', 'Invoice Number', 'Client', 'Status', 'Total', 'Currency', 'Created Date', 'Due Date', 'Paid Date'];
    const rows = invoices.map((invoice) => [
      invoice.id,
      invoice.invoiceNumber ?? '',
      invoice.clientName ?? '',
      invoice.status ?? '',
      invoice.total ?? 0,
      invoice.currency ?? defaultCurrency,
      invoice.createdAt ?? '',
      invoice.dueDate ?? '',
      invoice.paidAt ?? '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solobid-invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabels: Record<DateRange, string> = {
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    '12m': 'Last 12 months',
  };

  if (initialLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">Reports</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Loading financial overview and performance metrics…</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-zinc-200 rounded-2xl shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                <div className="h-7 w-32 animate-pulse rounded bg-zinc-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Financial overview and performance metrics synced from your invoices and quotes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['30d', '90d', '12m'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateRange === range
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {rangeLabels[range]}
            </button>
          ))}
          <Button variant="outline" size="sm" className="rounded-lg text-xs font-semibold" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Total Billed</span>
            </div>
            <p className="text-xl font-black text-zinc-900">{formatCurrency(totalBilled)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Collected</span>
            </div>
            <p className="text-xl font-black text-zinc-900">{formatCurrency(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Outstanding</span>
            </div>
            <p className="text-xl font-black text-zinc-900">{formatCurrency(outstanding)}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Conversion</span>
            </div>
            <p className="text-xl font-black text-zinc-900">{conversionRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-zinc-800">Monthly Revenue (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-[260px] w-full animate-pulse rounded-2xl bg-zinc-100" />}>
            <ReportsRevenueChart data={monthlyData} currency={defaultCurrency} formatCurrency={formatCurrency} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-zinc-800">Outstanding Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {outstandingInvoices.length === 0 ? (
              <p className="text-sm text-zinc-400 px-6 pb-6">No outstanding invoices.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {outstandingInvoices.map((invoice) => {
                  const daysOverdue = invoice.dueDate ? differenceInDays(new Date(), new Date(invoice.dueDate)) : null;
                  return (
                    <div key={invoice.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50/60 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{invoice.clientName || 'Unknown'}</p>
                        {daysOverdue !== null && daysOverdue > 0 ? (
                          <p className="text-xs text-red-500 font-medium">{daysOverdue}d overdue</p>
                        ) : (
                          <p className="text-xs text-zinc-400">Due {invoice.dueDate ? format(new Date(invoice.dueDate), 'dd MMM yyyy') : '—'}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold text-zinc-900">{formatCurrency(invoice.total ?? 0, invoice.currency)}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${invoice.status === 'overdue' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-zinc-800">Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topClients.length === 0 ? (
              <p className="text-sm text-zinc-400 px-6 pb-6">No client data yet.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {topClients.map(([name, total], index) => (
                  <div key={name} className="flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-zinc-400 w-4 shrink-0">{index + 1}</span>
                      <p className="text-sm font-semibold text-zinc-900 truncate">{name}</p>
                    </div>
                    <p className="text-sm font-bold text-zinc-900 shrink-0 ml-4">{formatCurrency(total)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
