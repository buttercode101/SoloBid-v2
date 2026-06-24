import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { NumericInput } from '../ui/numeric-input';
import { MessageCircle, Copy, Check, Layers, Loader2, WalletCards } from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';
import { convertCurrency, formatCurrency as formatApiCurrency } from '../../lib/integrations/currency';
import { buildQuotePaymentPlanSummary, type QuotePaymentPlanSummary } from '../../lib/paymentFlow';

interface Props {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  taxRate: number | string;
  setTaxRate: (v: string) => void;
  saTaxInvoiceMode?: boolean;
  pdfBusy: 'download' | 'share' | null;
  handleWhatsAppShare: () => void;
  quoteId?: string;
  copied: boolean;
  handleCopyLink: () => void;
}

type FxEstimate = {
  currency: string;
  amount: number;
};

export function QuoteSummaryCard({
  subtotal, tax, total, currency, taxRate, setTaxRate,
  saTaxInvoiceMode, pdfBusy, handleWhatsAppShare, quoteId, copied, handleCopyLink,
}: Props) {
  const [fxEstimates, setFxEstimates] = useState<FxEstimate[]>([]);
  const [fxStatus, setFxStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [paymentPlan, setPaymentPlan] = useState<QuotePaymentPlanSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFxEstimates() {
      const baseCurrency = currency || 'ZAR';
      const targetCurrencies = baseCurrency === 'ZAR' ? ['USD', 'EUR', 'GBP'] : ['ZAR'];
      if (!total || total <= 0) {
        setFxEstimates([]);
        setFxStatus('idle');
        return;
      }

      try {
        setFxStatus('loading');
        const values = await Promise.all(
          targetCurrencies.map(async (target) => ({
            currency: target,
            amount: await convertCurrency(total, baseCurrency, target),
          })),
        );
        if (!cancelled) {
          setFxEstimates(values);
          setFxStatus('idle');
        }
      } catch (error) {
        if (!cancelled) {
          setFxEstimates([]);
          setFxStatus('error');
        }
      }
    }

    const timeout = window.setTimeout(loadFxEstimates, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [currency, total]);

  useEffect(() => {
    let cancelled = false;

    async function loadPaymentPlan() {
      if (!total || total <= 0) {
        setPaymentPlan(null);
        return;
      }

      const summary = await buildQuotePaymentPlanSummary({
        total,
        currency,
        depositPercent: 50,
        dueBusinessDays: 7,
      });

      if (!cancelled) setPaymentPlan(summary);
    }

    loadPaymentPlan().catch(() => setPaymentPlan(null));
    return () => {
      cancelled = true;
    };
  }, [currency, total]);

  return (
    <Card className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl relative sticky top-6 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />
      <div className="space-y-6 pt-2">
        <div className="border-b border-zinc-100 pb-4">
          <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" />
            Total Summary
          </h3>
          <p className="text-xs text-zinc-400 mt-1">Calculated in real time.</p>
        </div>

        <div className="space-y-3 font-normal text-sm">
          <div className="flex justify-between items-center text-zinc-500">
            <span>Subtotal</span>
            <span className="font-semibold text-zinc-700 tabular-nums">{formatCurrency(subtotal, currency)}</span>
          </div>

          <div className="flex justify-between items-center text-zinc-500 border-t border-zinc-50 pt-2.5">
            <span className="text-zinc-500 flex items-center gap-1">
              {currency === 'ZAR' && saTaxInvoiceMode ? (
                <span title="SA Tax Invoice mode forces 15% VAT. Change in Settings if needed.">VAT (15%) ⓘ</span>
              ) : (
                <>
                  <span className="mr-1 shrink-0">Tax</span>
                  <div className="inline-flex items-center gap-1 text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-0.5 font-bold">
                    <NumericInput
                      className="w-10 h-6 text-center text-xs border-none p-0 focus:ring-0 focus:outline-none focus:border-none font-bold"
                      value={taxRate}
                      onValueChange={setTaxRate}
                    />
                    <span className="text-xs font-bold font-mono">%</span>
                  </div>
                </>
              )}
            </span>
            <span className="font-semibold text-zinc-700 tabular-nums">{formatCurrency(tax, currency)}</span>
          </div>

          <div className="pt-4 border-t border-zinc-200 flex justify-between items-baseline gap-2">
            <span className="font-bold text-zinc-900 text-base">Grand Total</span>
            <span className="text-3xl font-bold tracking-tight text-primary tabular-nums self-end">
              {formatCurrency(total, currency)}
            </span>
          </div>

          {paymentPlan && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-900">
              <p className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-emerald-700">
                <WalletCards className="h-3.5 w-3.5" /> Suggested payment plan
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/80 p-2 ring-1 ring-emerald-100">
                  <p className="text-[10px] font-bold uppercase text-emerald-500">Deposit</p>
                  <p className="font-bold text-emerald-950">{formatCurrency(paymentPlan.depositAmount, currency)}</p>
                </div>
                <div className="rounded-xl bg-white/80 p-2 ring-1 ring-emerald-100">
                  <p className="text-[10px] font-bold uppercase text-emerald-500">Balance</p>
                  <p className="font-bold text-emerald-950">{formatCurrency(paymentPlan.balanceAmount, currency)}</p>
                </div>
              </div>
              <p className="mt-2 leading-relaxed">Suggested due date: <strong>{paymentPlan.dueDateLabel}</strong>. Dates are adjusted to business days where needed.</p>
            </div>
          )}

          {(fxEstimates.length > 0 || fxStatus !== 'idle') && (
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3 text-xs text-zinc-500">
              <p className="font-bold uppercase tracking-wide text-zinc-400">FX estimate</p>
              {fxStatus === 'loading' && <p className="mt-1">Loading latest free exchange-rate estimate…</p>}
              {fxStatus === 'error' && <p className="mt-1">Exchange-rate estimate unavailable right now.</p>}
              {fxEstimates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {fxEstimates.map((estimate) => (
                    <span key={estimate.currency} className="rounded-full bg-white px-2.5 py-1 font-semibold text-zinc-700 ring-1 ring-zinc-200">
                      ≈ {formatApiCurrency(estimate.amount, estimate.currency, estimate.currency === 'ZAR' ? 'en-ZA' : 'en-US')}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 leading-relaxed">Indicative only. Final payment should follow the quoted currency and agreed terms.</p>
            </div>
          )}
        </div>

        <div className="pt-6 space-y-2.5 border-t border-zinc-100">
          <Button
            className="w-full h-12 rounded-2xl bg-[#25D366] text-white border-[#25D366] font-bold hover:bg-[#1fb958] hover:border-[#1fb958] cursor-pointer shadow-md shadow-emerald-950/10 active:scale-[0.985] text-sm"
            onClick={handleWhatsAppShare}
            disabled={!!pdfBusy}
          >
            {pdfBusy === 'share' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            Send via WhatsApp
          </Button>

          {quoteId && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl text-zinc-700 border-zinc-200 font-medium hover:bg-zinc-50 cursor-pointer text-sm"
                onClick={handleCopyLink}
              >
                {copied ? <Check className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5 text-zinc-500" />}
                Copy Link
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl text-zinc-700 border-zinc-200 font-medium hover:bg-zinc-50 cursor-pointer text-sm"
                asChild
              >
                <Link to={`/client/quote/${quoteId}`}>Preview</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
