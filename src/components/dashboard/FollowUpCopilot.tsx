import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Copy, MessageCircle, ReceiptText, Send, TimerReset } from 'lucide-react';
import type { Quote } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

type FollowUpCopilotProps = {
  quotes: Quote[];
  formatCurrency: (amount: number, currency?: string) => string;
  onCopyLink: (id: string) => void;
  onWhatsAppShare: (quote: Quote) => void;
  copiedId: string | null;
};

function daysBetween(from?: string, to = new Date()) {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86400000));
}

function daysUntil(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function getFollowUpAction(quote: Quote) {
  const status = quote.status || 'draft';
  const ageDays = daysBetween(quote.updatedAt || quote.createdAt);
  const expiryDays = daysUntil(quote.expiresAt);

  if (status === 'viewed') {
    return {
      priority: 1,
      tone: 'hot',
      label: 'Viewed, not signed',
      title: `${quote.clientName || 'Client'} opened the quote. Follow up while it is warm.`,
      helper: 'Send a short WhatsApp nudge asking if they are ready to approve or need a change.',
      cta: 'Send WhatsApp nudge',
    };
  }

  if (status === 'sent' && expiryDays !== null && expiryDays <= 2 && expiryDays >= 0) {
    return {
      priority: 2,
      tone: 'urgent',
      label: 'Expires soon',
      title: `${quote.clientName || 'Client'} has ${expiryDays === 0 ? 'today' : `${expiryDays} day${expiryDays === 1 ? '' : 's'}`} left to approve.`,
      helper: 'Remind them the quote is still open and can be signed online without an account.',
      cta: 'Remind client',
    };
  }

  if (status === 'sent' && ageDays >= 2) {
    return {
      priority: 3,
      tone: 'wait',
      label: 'Needs follow-up',
      title: `${quote.clientName || 'Client'} has not approved yet.`,
      helper: 'Copy or resend the closing-room link so the decision stays easy.',
      cta: 'Resend quote link',
    };
  }

  if (status === 'approved') {
    return {
      priority: 4,
      tone: 'win',
      label: 'Approved, invoice next',
      title: `${quote.clientName || 'Client'} approved ${quote.quoteNumber || 'the quote'}.`,
      helper: 'Generate the invoice next. Invoice sending, chasing, partial payment and recurring invoice actions now live in DueToday.',
      cta: 'Open quote',
    };
  }

  if (status === 'rejected') {
    return {
      priority: 5,
      tone: 'revise',
      label: 'Revision opportunity',
      title: `${quote.clientName || 'Client'} declined.`,
      helper: quote.rejectionReason ? `Reason: ${quote.rejectionReason}` : 'Open the quote, revise scope or pricing, then resend.',
      cta: 'Revise quote',
    };
  }

  return null;
}

export function FollowUpCopilot({ quotes, formatCurrency, onCopyLink, onWhatsAppShare, copiedId }: FollowUpCopilotProps) {
  const actions = quotes
    .map(quote => ({ quote, action: getFollowUpAction(quote) }))
    .filter((item): item is { quote: Quote; action: NonNullable<ReturnType<typeof getFollowUpAction>> } => Boolean(item.action))
    .sort((a, b) => a.action.priority - b.action.priority)
    .slice(0, 4);

  const activeValue = actions.reduce((sum, item) => sum + (item.quote.total || 0), 0);

  return (
    <Card className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-950 to-zinc-950 text-white shadow-xl shadow-emerald-950/10">
      <CardHeader className="border-b border-white/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
              <Send className="h-3.5 w-3.5" />
              Quote Copilot
            </div>
            <CardTitle className="text-2xl font-black tracking-[-0.04em] text-white">Turn sent quotes into signed work.</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/70">
              This dashboard lane handles quote nudges and approvals. Open DueToday for the Invoice Copilot lane: draft invoices, due invoices, overdue invoices, partial payments, and recurring invoices.
            </CardDescription>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/80">Active opportunity</p>
            <p className="mt-1 text-2xl font-black text-white">{formatCurrency(activeValue)}</p>
            <p className="mt-1 text-xs text-emerald-50/60">Top quote actions</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {actions.length === 0 ? (
          <div className="flex flex-col gap-2 p-6 text-sm text-emerald-50/75">
            <p className="font-bold text-white">No urgent quote follow-ups right now.</p>
            <p>Send a quote, get it viewed, then SoloBid will surface the next best quote action here.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {actions.map(({ quote, action }) => (
              <div key={quote.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    {action.tone === 'win' ? <Check className="h-4 w-4 text-emerald-200" /> : <TimerReset className="h-4 w-4 text-emerald-200" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">{action.label}</span>
                      <span className="text-xs font-semibold text-emerald-50/60">{formatCurrency(quote.total || 0, quote.currency)}</span>
                    </div>
                    <p className="mt-2 text-sm font-bold text-white">{action.title}</p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-50/65">{action.helper}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Button
                    size="sm"
                    className="rounded-xl bg-[#25D366] text-white hover:bg-[#1fb958]"
                    onClick={() => onWhatsAppShare(quote)}
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                    {action.cta}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-white/15 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => onCopyLink(quote.id)}
                  >
                    {copiedId === quote.id ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-200" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                    Copy link
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-white/15 bg-white/10 text-white hover:bg-white/20"
                    asChild
                  >
                    <Link to={`/quotes/${quote.id}`}>
                      Open <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-white/10 bg-white/[0.06] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <ReceiptText className="h-4 w-4 text-emerald-200" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Invoice Copilot lives in DueToday.</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/65">Use it for draft invoices, due invoices, overdue invoices, partial payments, and recurring invoice issue actions.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl border-white/15 bg-white/10 text-white hover:bg-white/20" asChild>
              <Link to="/due-today">Open Invoice Copilot <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
