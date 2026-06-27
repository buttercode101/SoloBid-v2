import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, CheckCircle2, Flame, Loader2, WalletCards } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { useAuth } from '../../lib/auth';
import { getSoloBidDueTodayActions, type DueTodayAction } from '../../lib/duetoday';
import { formatZAR } from '../../lib/theme';
import { getCurrencySymbol } from '../../lib/currencies';

function formatMoney(value: number | null | undefined, currency: string | null = 'ZAR') {
  const amount = value ?? 0;
  if ((currency || 'ZAR') === 'ZAR') return formatZAR(amount);
  return `${getCurrencySymbol(currency || 'ZAR')}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function endOfToday() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function isOverdue(action: DueTodayAction) {
  return new Date(action.due_date) < startOfToday();
}

function isToday(action: DueTodayAction) {
  const due = new Date(action.due_date);
  return due >= startOfToday() && due <= endOfToday();
}

function categoryLabel(category: DueTodayAction['category']) {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function priorityLabel(action: DueTodayAction) {
  if (isOverdue(action)) return '🔥 Money blocked';
  if (action.priority === 'critical' || action.priority === 'high') return '⚠ Needs attention';
  if (isToday(action)) return '📅 Today';
  return '🟢 Upcoming';
}

function groupTitle(category: DueTodayAction['category']) {
  if (category === 'payment_chase' || category === 'invoice_follow_up') return 'Collect Money';
  if (category === 'quote_follow_up') return 'Quote Follow-ups';
  return categoryLabel(category);
}

function dueLabel(action: DueTodayAction) {
  if (isOverdue(action)) return 'Overdue';
  if (isToday(action)) return 'Due today';
  return `Due ${new Date(action.due_date).toLocaleDateString()}`;
}

export function DueTodayActionsPanel() {
  const { user, profile } = useAuth();
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
        if (!cancelled) setError('Could not load DueToday actions yet. Your SoloBid records are unchanged.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const summary = useMemo(() => {
    const overdue = actions.filter(isOverdue);
    const today = actions.filter((action) => !isOverdue(action) && isToday(action));
    const upcoming = actions.filter((action) => !isOverdue(action) && !isToday(action));
    const totalValue = actions.reduce((sum, action) => sum + (action.money_value || 0), 0);
    const overdueValue = overdue.reduce((sum, action) => sum + (action.money_value || 0), 0);
    const highestPriority = [...actions].sort((a, b) => {
      const score = (action: DueTodayAction) => (isOverdue(action) ? 3 : action.priority === 'critical' || action.priority === 'high' ? 2 : isToday(action) ? 1 : 0);
      return score(b) - score(a) || new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    const grouped = actions.reduce<Record<string, DueTodayAction[]>>((groups, action) => {
      const key = groupTitle(action.category);
      groups[key] = [...(groups[key] ?? []), action];
      return groups;
    }, {});

    return { overdue, today, upcoming, totalValue, overdueValue, highestPriority, grouped };
  }, [actions]);

  if (!user) return null;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-[2rem] border border-zinc-100 bg-white shadow-[0_12px_40px_rgb(0,0,0,0.03)]">
        <CardHeader className="border-b border-zinc-50 bg-gradient-to-br from-teal-50 via-white to-zinc-50 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-800">
                <CalendarClock className="h-3.5 w-3.5" /> Powered by DueToday
              </div>
              <p className="text-sm font-medium text-zinc-500">Good day{profile?.businessName ? `, ${profile.businessName}` : ''}.</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 md:text-5xl">Today&apos;s Money</h2>
              <p className="mt-3 text-sm text-zinc-500">Know which quotes, invoices and recurring invoices need attention before cash gets stuck.</p>
            </div>
            <div className="rounded-[1.75rem] border border-zinc-100 bg-white/90 p-5 text-right shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Potential cash flow</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">{formatMoney(summary.totalValue, 'ZAR')}</p>
              <p className="mt-1 text-xs text-zinc-500">{actions.length} open action{actions.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl border border-zinc-100 bg-zinc-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Overdue</p>
              <p className="mt-2 text-2xl font-semibold text-red-600">{summary.overdue.length}</p>
              <p className="mt-1 text-xs text-zinc-500">{formatMoney(summary.overdueValue, 'ZAR')} blocked</p>
            </div>
            <div className="rounded-3xl border border-zinc-100 bg-zinc-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Today</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{summary.today.length}</p>
              <p className="mt-1 text-xs text-zinc-500">Due before close</p>
            </div>
            <div className="rounded-3xl border border-zinc-100 bg-zinc-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Upcoming</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">{summary.upcoming.length}</p>
              <p className="mt-1 text-xs text-zinc-500">Coming next</p>
            </div>
            <div className="rounded-3xl border border-zinc-100 bg-zinc-950 p-4 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Start here</p>
              <p className="mt-2 text-2xl font-semibold">{summary.highestPriority.length ? 'Top 3' : 'Clear'}</p>
              <p className="mt-1 text-xs text-zinc-400">Highest priority actions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="rounded-3xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500"><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading DueToday actions…</div></Card>
      ) : error ? (
        <Card className="rounded-3xl border border-amber-100 bg-amber-50 p-6 text-sm text-amber-800">{error}</Card>
      ) : actions.length === 0 ? (
        <Card className="rounded-3xl border border-zinc-100 bg-white p-10 text-center shadow-sm"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" /><p className="mt-3 text-sm font-semibold text-zinc-800">Nothing needs chasing right now</p><p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">Sent quotes, overdue invoices and due recurring invoices will appear here automatically.</p></Card>
      ) : (
        <>
          <Card className="rounded-3xl border border-zinc-100 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-zinc-50 p-5">
              <Flame className="h-4 w-4 text-red-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-950">Highest Priority</h3>
                <p className="text-xs text-zinc-500">Start with these before moving through the full list.</p>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-zinc-50 p-0">
              {summary.highestPriority.slice(0, 3).map((action) => <ActionRow key={action.external_key} action={action} />)}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {Object.entries(summary.grouped).map(([group, groupActions]) => (
              <Card key={group} className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-50 p-5">
                  <div className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4 text-zinc-500" />
                    <h3 className="text-sm font-semibold text-zinc-950">{group}</h3>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">{groupActions.length}</span>
                </CardHeader>
                <CardContent className="divide-y divide-zinc-50 p-0">
                  {groupActions.map((action) => <ActionRow key={action.external_key} action={action} />)}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: DueTodayAction }) {
  const money = action.money_value ? formatMoney(action.money_value, action.currency) : null;
  const sourcePath = action.source_url ? new URL(action.source_url).pathname : null;

  return (
    <div className="flex flex-col gap-4 p-5 transition-colors hover:bg-zinc-50/70 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">{priorityLabel(action)}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{categoryLabel(action.category)}</span>
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-zinc-950">{action.title}</p>
        <p className="mt-1 text-xs text-zinc-500">{dueLabel(action)}{money ? ` · ${money}` : ''}</p>
      </div>
      <div className="flex items-center gap-2">
        {money && <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-right"><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Value</p><p className="text-sm font-semibold text-zinc-950">{money}</p></div>}
        {sourcePath && <Button asChild variant="outline" size="sm" className="rounded-full border-zinc-200 text-xs"><Link to={sourcePath}>Open Source <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>}
      </div>
    </div>
  );
}
