import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { SafeHtml } from '../SafeHtml';

type ClosingRoomProps = {
  estimate: any;
  contractor: any;
  lineItems: any[];
  totalLabel: string;
  currencySymbol: string;
  quoteReference: string;
  isExpired: boolean;
  isReviewable: boolean;
  activeWorkflowStatus: string;
};

function formatDate(value?: string) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function getRoomTone(status: string, isExpired: boolean) {
  if (isExpired) {
    return {
      label: 'Needs renewal',
      title: 'This quote is no longer open for sign-off.',
      helper: 'Ask the sender for a renewed quote before approving scope, price or timing.',
      className: 'border-red-200 bg-red-50 text-red-900',
    };
  }

  if (status === 'approved' || status === 'converted' || status === 'paid') {
    return {
      label: 'Signed off',
      title: 'The work has client approval.',
      helper: 'The sender can now invoice, confirm start details, and track EFT/payment status separately.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    };
  }

  if (status === 'rejected') {
    return {
      label: 'Declined',
      title: 'The sender can revise the scope or pricing.',
      helper: 'The decline note gives the sender a path to update and resend a better quote.',
      className: 'border-red-200 bg-red-50 text-red-900',
    };
  }

  return {
    label: 'Decision room',
    title: 'Review scope, price and terms before signing.',
    helper: 'Approval records a digital sign-off. Payment is still handled separately through invoice/EFT follow-up.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  };
}

export function ClientClosingRoom({
  estimate,
  contractor,
  lineItems,
  totalLabel,
  currencySymbol,
  quoteReference,
  isExpired,
  isReviewable,
  activeWorkflowStatus,
}: ClosingRoomProps) {
  const tone = getRoomTone(activeWorkflowStatus, isExpired);
  const materialTotal = lineItems
    .filter(item => item.type === 'material')
    .reduce((sum, item) => {
      const baseCost = (item.qty || 0) * (item.unitCost || 0);
      return sum + baseCost + (baseCost * ((item.markupPercent || 0) / 100));
    }, 0);
  const laborTotal = lineItems
    .filter(item => item.type !== 'material')
    .reduce((sum, item) => sum + ((item.qty || 0) * (item.unitCost || 0)), 0);

  const decisionChecklist = [
    {
      label: 'Scope reviewed',
      helper: `${lineItems.length || 0} line item${lineItems.length === 1 ? '' : 's'} included in this quote.`,
      done: true,
    },
    {
      label: 'Price visible',
      helper: `${totalLabel} total before any separate invoice/payment follow-up.`,
      done: true,
    },
    {
      label: 'Terms available',
      helper: contractor?.terms ? 'Terms are included below for review.' : 'No extra terms were added by the sender.',
      done: Boolean(contractor?.terms),
    },
    {
      label: isReviewable ? 'Decision needed' : 'Decision recorded',
      helper: isReviewable ? 'Approve with signature or decline with a note.' : 'The current status is already recorded.',
      done: !isReviewable,
    },
  ];

  return (
    <Card className="overflow-hidden border-emerald-100 shadow-sm">
      <CardHeader className="border-b border-emerald-50 bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Quote Closing Room</p>
            <CardTitle className="mt-2 text-2xl font-black tracking-[-0.04em] text-zinc-950">
              One place to review, sign off, and move to invoice.
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              SoloBid turns this quote into a clear client decision: scope, total, terms, approval record, and next payment step without forcing the client to create an account.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm ${tone.className}`}>
            <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">{tone.label}</p>
            <p className="mt-1 font-bold">{tone.title}</p>
            <p className="mt-1 max-w-xs text-xs leading-5 opacity-80">{tone.helper}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Quote', value: quoteReference, helper: 'Reference' },
            { label: 'Scope', value: String(lineItems.length || 0), helper: 'Line items' },
            { label: 'Total', value: totalLabel, helper: 'To approve' },
            { label: 'Valid until', value: formatDate(estimate.expiresAt), helper: isExpired ? 'Expired' : 'Offer validity' },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{item.label}</p>
              <p className="mt-2 break-words text-lg font-black text-zinc-950">{item.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.helper}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-zinc-100 bg-white p-5">
            <p className="text-sm font-black text-zinc-950">Decision checklist</p>
            <div className="mt-4 space-y-3">
              {decisionChecklist.map(item => (
                <div key={item.label} className="flex gap-3 rounded-2xl bg-zinc-50 p-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${item.done ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                    {item.done ? '✓' : '•'}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{item.label}</p>
                    <p className="text-xs leading-5 text-zinc-500">{item.helper}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-100 bg-zinc-950 p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Approval does not collect payment</p>
            <p className="mt-3 text-lg font-black tracking-tight">After approval, the sender invoices and tracks EFT/payment separately.</p>
            <div className="mt-5 space-y-3 text-sm text-zinc-300">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <span>Labor</span>
                <span className="font-bold text-white">{currencySymbol}{laborTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <span>Materials</span>
                <span className="font-bold text-white">{currencySymbol}{materialTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4 pt-1 text-base">
                <span className="font-bold">Total</span>
                <span className="font-black text-emerald-200">{totalLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {contractor?.terms && (
          <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-5">
            <p className="text-sm font-black text-zinc-950">Terms snapshot</p>
            <SafeHtml html={contractor.terms} className="mt-3 line-clamp-6 text-sm leading-6 text-zinc-600" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
