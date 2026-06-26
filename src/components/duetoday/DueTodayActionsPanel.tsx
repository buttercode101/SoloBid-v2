import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAuth } from '../../lib/auth';
import { getSoloBidDueTodayActions, type DueTodayAction } from '../../lib/duetoday';
import { formatZAR } from '../../lib/theme';
import { getCurrencySymbol } from '../../lib/currencies';

function formatMoney(value: number | null, currency: string | null) {
  if (!value) return null;
  if ((currency || 'ZAR') === 'ZAR') return formatZAR(value);
  return `${getCurrencySymbol(currency || 'ZAR')}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isOverdue(action: DueTodayAction) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return new Date(action.due_date) < todayStart;
}

function categoryLabel(category: DueTodayAction['category']) {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DueTodayActionsPanel() {
  const { user } = useAuth();
  const [actions, setActions] = useState<DueTodayAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setActions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getSoloBidDueTodayActions({ userId: user.uid, baseUrl: window.location.origin })
      .then((nextActions) => {
        if (!cancelled) setActions(nextActions);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[DueToday] Failed to load actions', err);
        if (!cancelled) setError('Could not load DueToday actions yet.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const summary = useMemo(() => {
    const overdue = actions.filter(isOverdue).length;
    const totalValue = actions.reduce((sum, action) => sum + (action.money_value || 0), 0);
    return { overdue, totalValue };
  }, [actions]);

  if (!user) return null;

  return (
    <Card className="rounded-3xl border border-zinc-100 bg-white overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
      <CardHeader className="flex flex-col gap-4 border-b border-zinc-50 bg-zinc-50/40 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-800">
            <CalendarClock className="h-3.5 w-3.5" /> Powered by DueToday
          </div>
          <CardTitle className="text-xl font-semibold text-zinc-900">Today&apos;s Money Actions</CardTitle>
          <CardDescription className="mt-0.5 text-xs text-zinc-500">Read-only view of quote, invoice and recurring-invoice actions from SoloBid.</CardDescription>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-zinc-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Actions</p>
            <p className="text-lg font-semibold text-zinc-900">{actions.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Overdue</p>
            <p className="text-lg font-semibold text-red-600">{summary.overdue}</p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Value</p>
            <p className="text-lg font-semibold text-zinc-900">{formatMoney(summary.totalValue, 'ZAR') || 'R0,00'}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading DueToday actions…</div>
        ) : error ? (
          <div className="p-6 text-sm text-amber-700">{error}</div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-500" /><p className="text-sm font-semibold text-zinc-800">Nothing needs chasing right now</p><p className="max-w-md text-xs text-zinc-500">Sent quotes, overdue invoices and due recurring invoices will appear here automatically.</p></div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {actions.slice(0, 8).map((action) => {
              const money = formatMoney(action.money_value, action.currency);
              return (
                <div key={action.external_key} className="flex flex-col gap-3 p-5 transition-colors hover:bg-zinc-50/60 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">{categoryLabel(action.category)}</span><span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{action.priority}</span></div>
                    <p className="mt-2 truncate text-sm font-semibold text-zinc-900">{action.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Due {new Date(action.due_date).toLocaleDateString()} {money ? `· ${money}` : ''}</p>
                  </div>
                  {action.source_url && <Button asChild variant="outline" size="sm" className="rounded-full border-zinc-200 text-xs"><Link to={new URL(action.source_url).pathname}>Open Source <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
