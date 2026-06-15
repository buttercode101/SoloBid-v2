import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase, toDbUser } from '../lib/supabase';
import { ArrowRight, Building2, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { COUNTRIES, getCountryByCode, getCountryByCurrency } from '../lib/countries';

const currencyOptions = [
  { value: 'ZAR', label: 'ZAR (R)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'AUD', label: 'AUD (A$)' },
  { value: 'CAD', label: 'CAD (C$)' },
  { value: 'NZD', label: 'NZD (NZ$)' },
  { value: 'SGD', label: 'SGD (S$)' },
];

function getDefaultCountryAndCurrency(): { country: string; defaultCurrency: string; defaultTaxRate: number; saTaxInvoiceMode: boolean } {
  const lang = navigator.language || 'en-ZA';
  if (lang.includes('ZA') || lang === 'af') return { country: 'ZA', defaultCurrency: 'ZAR', defaultTaxRate: 15, saTaxInvoiceMode: true };
  if (lang.includes('GB')) return { country: 'GB', defaultCurrency: 'GBP', defaultTaxRate: 20, saTaxInvoiceMode: false };
  if (lang.includes('AU')) return { country: 'AU', defaultCurrency: 'AUD', defaultTaxRate: 10, saTaxInvoiceMode: false };
  if (lang.includes('NZ')) return { country: 'NZ', defaultCurrency: 'NZD', defaultTaxRate: 15, saTaxInvoiceMode: false };
  if (lang.includes('CA')) return { country: 'CA', defaultCurrency: 'CAD', defaultTaxRate: 5, saTaxInvoiceMode: false };
  if (lang.includes('SG')) return { country: 'SG', defaultCurrency: 'SGD', defaultTaxRate: 9, saTaxInvoiceMode: false };
  return { country: 'ZA', defaultCurrency: 'ZAR', defaultTaxRate: 15, saTaxInvoiceMode: true };
}

export default function Onboarding() {
  const { user, profile, saveProfileDraft, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const localeDefaults = getDefaultCountryAndCurrency();

  const [formData, setFormData] = useState({
    businessName: profile?.businessName || '',
    mobileNumber: profile?.mobileNumber || '',
    country: profile?.country || localeDefaults.country,
    defaultCurrency: profile?.defaultCurrency || localeDefaults.defaultCurrency,
    defaultTaxRate: profile?.defaultTaxRate ?? localeDefaults.defaultTaxRate,
    saTaxInvoiceMode: profile?.saTaxInvoiceMode ?? localeDefaults.saTaxInvoiceMode,
  });

  const handleCountryChange = (countryCode: string) => {
    const cfg = getCountryByCode(countryCode);
    setFormData(prev => ({
      ...prev,
      country: countryCode,
      ...(cfg ? { defaultCurrency: cfg.currency, defaultTaxRate: cfg.taxRate, saTaxInvoiceMode: Boolean(cfg.saTaxInvoiceMode) } : {}),
    }));
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const cfg = getCountryByCurrency(currencyCode);
    setFormData(prev => ({
      ...prev,
      defaultCurrency: currencyCode,
      ...(cfg ? { country: cfg.code, defaultTaxRate: cfg.taxRate, saTaxInvoiceMode: Boolean(cfg.saTaxInvoiceMode) } : {}),
    }));
  };

  const createDefaultTemplate = async (uid: string) => {
    const templateId = crypto.randomUUID();
    await supabase.from('templates').upsert({
      id: templateId,
      user_id: uid,
      name: 'Basic Service Call',
      description: 'Standard diagnostic and minor repair',
    });
    const lineItems = [
      { id: crypto.randomUUID(), description: 'Diagnostic Fee', qty: 1, unitCost: 85, type: 'labor', markupPercent: 0 },
      { id: crypto.randomUUID(), description: 'Minor Parts', qty: 1, unitCost: 25, type: 'material', markupPercent: 20 },
    ];
    await supabase.from('line_items').insert(lineItems.map(item => ({
      id: item.id,
      template_id: templateId,
      quote_id: null,
      recurring_invoice_id: null,
      description: item.description,
      qty: item.qty,
      unit_cost: item.unitCost,
      type: item.type,
      markup_percent: item.markupPercent || 0,
      sort_order: 0,
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const businessName = formData.businessName.trim();
    const mobileNumber = formData.mobileNumber.trim();

    if (!businessName) { toast.error('Business name is required.'); return; }
    if (!mobileNumber) { toast.error('WhatsApp number is required.'); return; }

    try {
      setLoading(true);

      await saveProfileDraft({
        businessName,
        mobileNumber,
        country: formData.country,
        defaultCurrency: formData.defaultCurrency,
        defaultTaxRate: formData.defaultTaxRate,
        saTaxInvoiceMode: formData.saTaxInvoiceMode,
        fullName: profile?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        defaultLaborRate: profile?.defaultLaborRate ?? 75,
        defaultMarkup: profile?.defaultMarkup ?? 20,
        terms: profile?.terms || 'Payment is due within 14 days of invoice date. All materials remain property of the contractor until paid in full.',
        invoicePrefix: profile?.invoicePrefix || 'INV-',
        invoiceCount: profile?.invoiceCount || 0,
        pdfStyle: profile?.pdfStyle || 'modern',
        pdfFont: profile?.pdfFont || 'Helvetica',
        onboardingStep: 'complete',
        onboardingComplete: true,
        profileComplete: true,
        profileCompletion: 100,
        subscriptionStatus: profile?.subscriptionStatus || 'trial',
      });

      if (!profile?.onboardingComplete) {
        await createDefaultTemplate(user.uid);
      }

      await refreshProfile();
      toast.success('Welcome to SoloBid!');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-white shadow-lg shadow-emerald-950/15">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">One quick step</h1>
            <p className="mt-2 text-sm text-zinc-500 leading-6">Just 2 fields and you're in. Everything else can be set up later in Settings.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-sm font-semibold text-zinc-700">
                Business Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="businessName"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="e.g. Phakoe Electrical"
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobileNumber" className="text-sm font-semibold text-zinc-700">
                WhatsApp Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mobileNumber"
                type="tel"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                placeholder="e.g. +27 82 123 4567"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Country & Currency — auto-detected, editable */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-xs font-medium text-zinc-500">Country</Label>
                <select
                  id="country"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                >
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultCurrency" className="text-xs font-medium text-zinc-500">Currency</Label>
                <select
                  id="defaultCurrency"
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.defaultCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                >
                  {currencyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 rounded-2xl font-bold text-base mt-2" loading={loading}>
              <Building2 className="h-5 w-5" />
              Start using SoloBid
              <ArrowRight className="h-5 w-5" />
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-zinc-400">
            Logo, industry, VAT, terms and more can be added in <span className="font-semibold text-zinc-600">Settings</span> any time.
          </p>
        </div>
      </div>
    </div>
  );
}
