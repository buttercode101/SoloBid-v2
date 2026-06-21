import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { subDays, subMonths, format, isAfter, differenceInDays, startOfMonth, isSameMonth } from 'date-fns';
import { Download, TrendingUp, Banknote, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrencySymbol } from '../lib/currencies';
import { formatZAR } from '../lib/theme';

type DateRange = '30d' | '90d' | '12m';

export default function Reports() {
  const { user, profile } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const defaultCurrency = profile?.defaultCurrency || 'ZAR';

  const formatCurrency = (amount: number) => {
    if (defaultCurrency === 'ZAR') return formatZAR(amount);
    return `${getCurrencySymbol(defaultCurrency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    if (!user) return;
    async function fetchData() {
      setLoading(true);
      try {
        const [{ data: quotesData, error: qErr }, { data: invoicesData, error: iErr }] = await Promise.all([
          supabase.from('quotes').select('*').eq('user_id', user!.uid),
          supabase.from('invoices').select('*').eq('user_id', user!.uid),
        ]);
        if (qErr || iErr) throw qErr ?? iErr;
        setQuotes(quotesData ?? []);
        setInvoices(invoicesData ?? []);
      } catch {
        toast.error('Failed to load report data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const cutoffDate = useMemo(() => {
    if (dateRange === '30d') return subDays(new Date(), 30);
    if (dateRange === '90d') return subDays(new Date(), 90);
    return subMonths(new Date(), 12);
  }, [dateRange]);

  const filteredQuotes = useMemo(
    () => quotes.filter((q) => isAfter(new Date(q.created_at), cutoffDate)),
    [quotes, cutoffDate]
  );

  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => isAfter(new Date(inv.created_at ?? inv.issue_date ?? 0), cutoffDate)),
    [invoices, cutoffDate]
  );

  const totalBilled = useMemo(
    () => filteredInvoices.reduce((sum, inv) => sum + (inv.total ?? 0), 0),
    [filteredInvoices]
  );

  const totalCollected = useMemo(
    () =>
      filteredInvoices
        .filter((inv) => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.total ?? 0), 0),
    [filteredInvoices]
  );

  const outstanding = useMemo(
    () =>
      filteredInvoices
        .filter((inv) => ['sent', 'overdue'].includes(inv.status))
        .reduce((sum, inv) => sum + (inv.total ?? 0), 0),
    [filteredInvoices]
  );

  const conversionRate = useMemo(() => {
    const sent = filteredQuotes.filter((q) => q.status !== 'draft').length;
    const converted = filteredQuotes.filter((q) => ['approved', 'converted'].includes(q.status)).length;
    if (sent === 0) return 0;
    return Math.round((converted / sent) * 100);
  }, [filteredQuotes]);

  // Monthly revenue chart (last 12 months always)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i);
      return { month: format(d, 'MMM yy'), billed: 0, collected: 0, _date: d };
    });

    for (const inv of invoices) {
      const invDate = new Date(inv.created_at ?? inv.issue_date ?? 0);
      const bucket = months.find((m) => isSameMonth(m._date, invDate));
      if (bucket) {
        bucket.billed += inv.total ?? 0;
        if (inv.status === 'paid') bucket.collected += inv.total ?? 0;
      }
    }

    return months.map(({ month, billed, collected }) => ({ month, billed, collected }));
  }, [invoices]);

  // Outstanding invoices table
  const outstandingInvoices = useMemo(
    () =>
      invoices
        .filter((inv) => ['sent', 'overdue'].includes(inv.status))
        .sort((a, b) => new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime()),
    [invoices]
  );

  // Top clients by total quote value
  const topClients = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of quotes) {
      const name = q.client_name || 'Unknown';
      map[name] = (map[name] ?? 0) + (q.total ?? 0);
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [quotes]);

  const handleExportCSV = () => {
    const headers = ['Invoice ID', 'Client', 'Status', 'Total', 'Issue Date', 'Due Date'];
    const rows = invoices.map((inv) => [
      inv.id,
      inv.client_name ?? '',
      inv.status ?? '',
      inv.total ?? 0,
      inv.issue_date ?? inv.created_at ?? '',
      inv.due_date ?? '',
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
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

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-zinc-100 rounded-xl w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-zinc-100 rounded-2xl" />)}
        </div>
        <div className="h-72 bg-zinc-100 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-zinc-100 rounded-2xl" />
          <div className="h-64 bg-zinc-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Financial overview and performance metrics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['30d', '90d', '12m'] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateRange === r
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
          <Button variant="outline" size="sm" className="rounded-lg text-xs font-semibold" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
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

      {/* Revenue chart */}
      <Card className="border-zinc-200 rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-800">Monthly Revenue (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${getCurrencySymbol(defaultCurrency)}${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e4e4e7', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="billed" name="Billed" fill="#088b7e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding invoices */}
        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-800">Outstanding Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {outstandingInvoices.length === 0 ? (
              <p className="text-sm text-zinc-400 px-6 pb-6">No outstanding invoices.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {outstandingInvoices.map((inv) => {
                  const daysOverdue = inv.due_date
                    ? differenceInDays(new Date(), new Date(inv.due_date))
                    : null;
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50/60 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{inv.client_name || 'Unknown'}</p>
                        {daysOverdue !== null && daysOverdue > 0 ? (
                          <p className="text-xs text-red-500 font-medium">{daysOverdue}d overdue</p>
                        ) : (
                          <p className="text-xs text-zinc-400">Due {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yyyy') : '—'}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-bold text-zinc-900">{formatCurrency(inv.total ?? 0)}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${inv.status === 'overdue' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card className="border-zinc-200 rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-800">Top Clients by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topClients.length === 0 ? (
              <p className="text-sm text-zinc-400 px-6 pb-6">No client data yet.</p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {topClients.map(([name, total], i) => (
                  <div key={name} className="flex items-center justify-between px-6 py-3.5 hover:bg-zinc-50/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-zinc-400 w-4 shrink-0">{i + 1}</span>
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
    </motion.div>
  );
}
