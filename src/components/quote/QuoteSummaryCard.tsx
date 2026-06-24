import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { NumericInput } from '../ui/numeric-input';
import { MessageCircle, Copy, Check, Layers, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../lib/calculations';

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

export function QuoteSummaryCard({
  subtotal, tax, total, currency, taxRate, setTaxRate,
  saTaxInvoiceMode, pdfBusy, handleWhatsAppShare, quoteId, copied, handleCopyLink,
}: Props) {
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
