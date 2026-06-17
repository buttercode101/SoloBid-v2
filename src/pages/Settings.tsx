import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, toDbUser } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, RefreshCw, Landmark, Sliders, Briefcase, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { COUNTRIES, getCountryByCode, getCountryByCurrency } from '../lib/countries';

const settingsSchema = z.object({
  businessName: z.string().min(1, "Business Name is required"),
  defaultLaborRate: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Labor rate must be a positive number"),
  defaultTaxRate: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Tax rate must be a positive number"),
  defaultMarkup: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Markup must be a positive number"),
  invoicePrefix: z.string().min(1, "Invoice prefix is required"),
  quotePrefix: z.string().min(1, "Quote prefix is required"),
});

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    bankName: profile?.bankName || '',
    accountNumber: profile?.accountNumber || '',
    accountType: profile?.accountType || 'Cheque',
    branchCode: profile?.branchCode || '',
  });
  const [purgeType, setPurgeType] = useState<'profile' | 'data' | null>(null);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  
  const [formData, setFormData] = useState({
    businessName: profile?.businessName || '',
    fullName: profile?.fullName || '',
    industry: profile?.industry || '',
    mobileNumber: profile?.mobileNumber || '',
    address: profile?.address || '',
    businessRegistrationNumber: profile?.businessRegistrationNumber || '',
    defaultLaborRate: profile?.defaultLaborRate?.toString() || '750',
    defaultTaxRate: profile?.defaultTaxRate?.toString() || '15',
    defaultMarkup: profile?.defaultMarkup?.toString() || '20',
    terms: profile?.terms || '',
    invoicePrefix: profile?.invoicePrefix || 'INV-',
    quotePrefix: profile?.quotePrefix || 'QTE-',
    pdfStyle: profile?.pdfStyle || 'modern',
    pdfFont: profile?.pdfFont || 'Helvetica',
    defaultCurrency: profile?.defaultCurrency || 'ZAR',
    country: profile?.country || 'ZA',
    vatNumber: profile?.vatNumber || '',
    saTaxInvoiceMode: profile?.saTaxInvoiceMode !== undefined ? profile.saTaxInvoiceMode : true,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const handleCountryChange = (countryCode: string) => {
    const countryConfig = getCountryByCode(countryCode);
    if (countryConfig) {
      setFormData(prev => ({
        ...prev,
        country: countryCode,
        defaultCurrency: countryConfig.currency,
        defaultTaxRate: countryConfig.taxRate.toString(),
        saTaxInvoiceMode: !!countryConfig.saTaxInvoiceMode,
      }));
      toast.info(`Updated default currency to ${countryConfig.currency} and tax rate to ${countryConfig.taxRate}% for ${countryConfig.name}.`);
    } else {
      setFormData(prev => ({ ...prev, country: countryCode }));
    }
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const countryConfig = getCountryByCurrency(currencyCode);
    if (countryConfig) {
      setFormData(prev => ({
        ...prev,
        defaultCurrency: currencyCode,
        country: countryConfig.code,
        defaultTaxRate: countryConfig.taxRate.toString(),
        saTaxInvoiceMode: !!countryConfig.saTaxInvoiceMode,
      }));
      toast.info(`Updated country to ${countryConfig.name} and tax rate to ${countryConfig.taxRate}% based on currency.`);
    } else {
      setFormData(prev => ({ ...prev, defaultCurrency: currencyCode }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const validationResult = settingsSchema.safeParse(formData);
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map(err => err.message);
        toast.error(errors[0]);
        return;
      }

      setLoading(true);
      let logoUrl = profile?.logoUrl || '';

      if (logoFile) {
        const filePath = `${user.uid}/${Date.now()}_${logoFile.name}`;
        const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        logoUrl = supabase.storage.from('logos').getPublicUrl(filePath).data.publicUrl;
      }

      const profileData = {
        uid: user.uid,
        businessName: formData.businessName,
        fullName: formData.fullName,
        industry: formData.industry,
        mobileNumber: formData.mobileNumber,
        address: formData.address,
        businessRegistrationNumber: formData.businessRegistrationNumber,
        logoUrl,
        defaultLaborRate: parseFloat(formData.defaultLaborRate) || 0,
        defaultTaxRate: parseFloat(formData.defaultTaxRate) || 0,
        defaultMarkup: parseFloat(formData.defaultMarkup) || 0,
        terms: formData.terms,
        invoicePrefix: formData.invoicePrefix,
        quotePrefix: formData.quotePrefix,
        pdfStyle: formData.pdfStyle,
        pdfFont: formData.pdfFont,
        defaultCurrency: formData.defaultCurrency,
        country: formData.country,
        vatNumber: formData.vatNumber,
        saTaxInvoiceMode: formData.saTaxInvoiceMode,
        updatedAt: new Date().toISOString(),
      };

      const dbRow = toDbUser({ ...profileData, uid: user.uid });
      dbRow.id = user.uid;
      const { error: upsertError } = await supabase.from('users').upsert(dbRow);
      if (upsertError) throw upsertError;
      await refreshProfile();
      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!user) return;
    setIsPurging(true);

    try {
      const isFactoryReset = purgeType === 'profile';

      // Delete all quotes (CASCADE deletes line_items and expenses)
      await supabase.from('quotes').delete().eq('user_id', user.uid);
      // Delete invoices, clients, templates, recurring_invoices
      await supabase.from('invoices').delete().eq('user_id', user.uid);
      await supabase.from('clients').delete().eq('user_id', user.uid);
      await supabase.from('templates').delete().eq('user_id', user.uid);
      await supabase.from('recurring_invoices').delete().eq('user_id', user.uid);

      if (isFactoryReset) {
        await supabase.from('users').update({
          business_name: '',
          mobile_number: null,
          logo_url: null,
          onboarding_step: 'welcome',
          onboarding_complete: false,
          profile_complete: false,
        }).eq('id', user.uid);

        setFormData({
          businessName: '',
          fullName: '',
          industry: '',
          mobileNumber: '',
          address: '',
          businessRegistrationNumber: '',
          defaultLaborRate: '750',
          defaultTaxRate: '15',
          defaultMarkup: '20',
          terms: '',
          invoicePrefix: 'INV-',
          quotePrefix: 'QTE-',
          pdfStyle: 'modern',
          pdfFont: 'Helvetica',
          defaultCurrency: 'ZAR',
          country: 'ZA',
          vatNumber: '',
          saTaxInvoiceMode: true,
        });

        setLogoFile(null);
        await refreshProfile();
        toast.success("Factory reset complete. All settings and databases wiped perfectly.");
      } else {
        toast.success("Transactions, clients, and templates database cleared successfully. Business profile saved.");
      }
      setPurgeType(null);
      setResetConfirmInput('');
    } catch (error: any) {
      console.error("Purge error:", error);
      toast.error(error.message || "An error occurred during factory reset");
    } finally {
      setIsPurging(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setBankLoading(true);
      const dbRow = toDbUser({
        uid: user.uid,
        bankName: bankFormData.bankName,
        accountNumber: bankFormData.accountNumber,
        accountType: bankFormData.accountType,
        branchCode: bankFormData.branchCode,
      });
      dbRow.id = user.uid;
      const { error } = await supabase.from('users').upsert(dbRow);
      if (error) throw error;
      await refreshProfile();
      toast.success('Bank details saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save bank details');
    } finally {
      setBankLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      <div className="pb-2 border-b border-zinc-100">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">Account Preferences</h1>
        <p className="text-zinc-455 text-xs mt-0.5">Configure default currencies, corporate markups, standard terms, and taxes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border border-zinc-150 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <CardHeader className="p-6 border-b border-zinc-50 flex flex-row items-center justify-between bg-zinc-50/10">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Corporate Identity
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">These properties populate your document headers and invoices.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-white space-y-5">
              <form onSubmit={handleSubmit} className="space-y-6 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="businessName" className="text-xs text-zinc-500 font-medium">Official Company Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                      placeholder="e.g. Acme Contracting Services"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs text-zinc-500 font-medium">Your Full Name (Optional)</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      placeholder="e.g. Thabo Smit"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="settingsMobile" className="text-xs text-zinc-500 font-medium">WhatsApp Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="settingsMobile"
                      type="tel"
                      value={formData.mobileNumber}
                      onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})}
                      placeholder="e.g. +27 82 123 4567"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="industry" className="text-xs text-zinc-500 font-medium">Industry / Trade (Optional)</Label>
                    <select
                      id="industry"
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                      className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                    >
                      <option value="">— Select trade —</option>
                      {['Electrical','Plumbing','HVAC','General Contractor','Landscaping','Painting','Carpentry','Roofing','Cleaning','Other'].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="businessReg" className="text-xs text-zinc-500 font-medium">Business Registration Number (Optional)</Label>
                    <Input
                      id="businessReg"
                      value={formData.businessRegistrationNumber}
                      onChange={(e) => setFormData({...formData, businessRegistrationNumber: e.target.value})}
                      placeholder="e.g. 2023/012345/07"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="address" className="text-xs text-zinc-500 font-medium">Business Address (Optional)</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      placeholder="e.g. 12 Main Street, Pretoria, 0001"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    />
                  </div>
                </div>

                <div className="p-4 border border-zinc-100 rounded-2xl bg-zinc-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="logo" className="text-xs text-zinc-500 font-medium block">Corporate Logo Mark</Label>
                    <span className="text-[10px] text-zinc-400 leading-normal block max-w-sm">We recommend transparent background high-resolution PNG sizes under 2MB for layout alignments.</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {profile?.logoUrl && !logoFile && (
                      <div className="h-12 w-12 rounded-xl bg-white border border-zinc-150 p-1 overflow-hidden flex items-center justify-center shrink-0">
                        <img src={profile.logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                      </div>
                    )}
                    <label className="relative flex items-center justify-center bg-white hover:bg-zinc-50 text-zinc-700 h-9 px-4.5 rounded-xl border border-zinc-250 cursor-pointer font-semibold text-xs active:scale-95 transition-all shadow-inner">
                      Browse File
                      <input 
                        id="logo" 
                        type="file" 
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="country" className="text-xs text-zinc-500 font-medium">Primary Locale</Label>
                    <select
                      id="country"
                      className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                      value={formData.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="defaultCurrency" className="text-xs text-zinc-500 font-medium">Currency</Label>
                    <select 
                      id="defaultCurrency"
                      className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                      value={formData.defaultCurrency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                    >
                      <option value="ZAR">ZAR (R)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="AUD">AUD (A$)</option>
                      <option value="CAD">CAD (C$)</option>
                      <option value="NZD">NZD (NZ$)</option>
                      <option value="SGD">SGD (S$)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-50">
                  <div className="space-y-1.5 animate-none">
                    <Label htmlFor="vatNumber" className="text-xs text-zinc-500 font-medium">VAT / Tax Identification Number (Optional)</Label>
                    <Input 
                      id="vatNumber" 
                      placeholder="e.g. 4010203040"
                      value={formData.vatNumber}
                      onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm font-mono"
                    />
                  </div>
                  <div className="flex flex-col justify-center pt-2">
                    <label className="flex items-start space-x-2.5 h-10 cursor-pointer group bg-zinc-50/50 py-2.5 px-3.5 rounded-2xl border border-zinc-200/40 hover:bg-zinc-50 transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded border-zinc-350 text-primary focus:ring-primary mt-1 h-4 w-4"
                        checked={formData.saTaxInvoiceMode}
                        onChange={(e) => setFormData({...formData, saTaxInvoiceMode: e.target.checked})}
                      />
                      <div className="leading-tight">
                        <span className="text-xs font-semibold text-zinc-800 group-hover:text-zinc-950 block">Lock SA Tax Invoice Format</span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">Enforces VAT descriptions and standard South Africa compliance.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-50">
                  <div className="space-y-1.5">
                    <Label htmlFor="defaultLaborRate" className="text-xs text-zinc-500 font-medium">Default Labor Rate (/hr)</Label>
                    <Input 
                      id="defaultLaborRate" 
                      type="number" 
                      min="0" step="0.01"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                      value={formData.defaultLaborRate}
                      onChange={(e) => setFormData({...formData, defaultLaborRate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="defaultTaxRate" className="text-xs text-zinc-500 font-medium">Default Tax Rate (%)</Label>
                    <Input 
                      id="defaultTaxRate" 
                      type="number" 
                      min="0" step="0.01"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                      value={formData.defaultTaxRate}
                      onChange={(e) => setFormData({...formData, defaultTaxRate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="defaultMarkup" className="text-xs text-zinc-500 font-medium">Default Markup (%)</Label>
                    <Input 
                      id="defaultMarkup" 
                      type="number" 
                      min="0" step="0.01"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                      value={formData.defaultMarkup}
                      onChange={(e) => setFormData({...formData, defaultMarkup: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-50">
                  <div className="space-y-1.5 animate-none">
                    <Label htmlFor="quotePrefix" className="text-xs text-zinc-500 font-medium">Quote Prefix</Label>
                    <Input
                      id="quotePrefix"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm font-mono uppercase"
                      value={formData.quotePrefix}
                      onChange={(e) => setFormData({...formData, quotePrefix: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5 animate-none">
                    <Label htmlFor="invoicePrefix" className="text-xs text-zinc-500 font-medium">Invoice Prefix</Label>
                    <Input
                      id="invoicePrefix"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm font-mono uppercase"
                      value={formData.invoicePrefix}
                      onChange={(e) => setFormData({...formData, invoicePrefix: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pdfStyle" className="text-xs text-zinc-500 font-medium">PDF Layout Style</Label>
                    <select 
                      id="pdfStyle"
                      className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                      value={formData.pdfStyle}
                      onChange={(e) => setFormData({...formData, pdfStyle: e.target.value})}
                    >
                      <option value="modern font-semibold">Modern Layout</option>
                      <option value="classic">Classic Layout</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pdfFont" className="text-xs text-zinc-500 font-medium">PDF Font</Label>
                    <select 
                      id="pdfFont"
                      className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                      value={formData.pdfFont}
                      onChange={(e) => setFormData({...formData, pdfFont: e.target.value})}
                    >
                      <option value="Helvetica">Helvetica</option>
                      <option value="Times-Roman">Times New Roman</option>
                      <option value="Courier">Courier Monospace</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="terms" className="text-xs text-zinc-500 font-medium">Standard Terms and Conditions</Label>
                  <Textarea 
                    id="terms" 
                    rows={4}
                    className="rounded-xl border-zinc-250 font-normal focus:ring-primary focus:border-primary text-sm p-3 shadow-inner bg-zinc-50/10"
                    placeholder="e.g. Terms are strictly 14 days from statement conversion."
                    value={formData.terms}
                    onChange={(e) => setFormData({...formData, terms: e.target.value})}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={loading} className="h-10.5 bg-primary hover:bg-[#03362f] text-white font-medium rounded-xl text-sm transition-all shadow-sm active:scale-95 px-8">
                    {loading ? 'Saving Settings...' : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          {/* Payment Methods — Bank Details */}
          <Card className="rounded-3xl border border-zinc-150 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            <CardHeader className="p-6 border-b border-zinc-50 flex flex-row items-center justify-between bg-zinc-50/10">
              <div>
                <CardTitle className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-primary" />
                  Payment Methods
                </CardTitle>
                <CardDescription className="text-zinc-400 text-xs">Bank Details for EFT Payments — Add your bank details so clients can pay via EFT.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <form onSubmit={handleBankSubmit} className="space-y-4 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bankName" className="text-xs text-zinc-500 font-medium">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={bankFormData.bankName}
                      onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                      placeholder="e.g. FNB, Absa, Standard Bank"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accountNumber" className="text-xs text-zinc-500 font-medium">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={bankFormData.accountNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                      placeholder="e.g. 62012345678"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accountType" className="text-xs text-zinc-500 font-medium">Account Type</Label>
                    <select
                      id="accountType"
                      value={bankFormData.accountType}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountType: e.target.value })}
                      className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                    >
                      <option value="Cheque">Cheque</option>
                      <option value="Current">Current</option>
                      <option value="Savings">Savings</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branchCode" className="text-xs text-zinc-500 font-medium">Branch Code</Label>
                    <Input
                      id="branchCode"
                      value={bankFormData.branchCode}
                      onChange={(e) => setBankFormData({ ...bankFormData, branchCode: e.target.value })}
                      placeholder="e.g. 250655"
                      className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm font-mono"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button type="submit" disabled={bankLoading} className="h-10.5 bg-primary hover:bg-[#03362f] text-white font-medium rounded-xl text-sm transition-all shadow-sm active:scale-95 px-8">
                    {bankLoading ? 'Saving...' : 'Save Bank Details'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info & Danger Zone */}
        <div className="space-y-6">
          <Card className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm overflow-hidden text-left">
            <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-primary" />
              Settings Guide
            </h3>
            <p className="text-xs text-zinc-450 mt-1 lines-clamp-2">Set your default rates and terms to create quotes and invoices faster.</p>
            
            <div className="mt-4 pt-4 border-t space-y-3 text-xs leading-relaxed text-zinc-600 font-medium">
              <div className="flex gap-2">
                <span className="text-primary font-bold">✓</span>
                <span>Labor rates are automatically applied to your labor items.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-primary font-bold">✓</span>
                <span>VAT Mode sets South Africa 15% tax compliance.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-primary font-bold">✓</span>
                <span>Material markup is added to material costs automatically.</span>
              </div>
            </div>
          </Card>

          {user && (
            <Card className="rounded-3xl border border-red-200 bg-red-50/10 shadow-sm overflow-hidden text-left relative">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />
              <CardHeader className="p-6 pb-2 border-b border-red-100">
                <CardTitle className="text-red-900 flex items-center gap-2 text-base font-bold">
                  <Trash2 className="text-red-600 w-4 h-4" /> Danger Zone
                </CardTitle>
                <CardDescription className="text-red-750 text-xs font-normal">Permanently delete your account data.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-5 bg-white">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-zinc-850 text-xs">Delete All Quotes & Invoices</h4>
                  </div>
                  <p className="text-[10px] text-zinc-450 leading-relaxed">
                    Permanently deletes all quotes, invoices, clients, templates, and expenses. Your profile settings will stay intact.
                  </p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-8 px-3 rounded-lg text-red-600 border-red-250 hover:bg-red-50 text-[11px] font-semibold active:scale-95 transition-all text-center flex justify-center cursor-pointer"
                    onClick={() => {
                      setPurgeType('data');
                      setResetConfirmInput('');
                    }}
                  >
                    Delete Quotes & Invoices Only
                  </Button>
                </div>

                <div className="space-y-2 pt-4 border-t border-zinc-100">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-red-950 text-xs">Full Factory Reset</h4>
                  </div>
                  <p className="text-[10px] text-zinc-450 leading-relaxed">
                    Deletes all your data, resets your rates to default, removes your business logo, and wipes all clients and templates.
                  </p>
                  <Button 
                    type="button" 
                    className="w-full h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white hover:text-white border-none text-[11px] font-bold active:scale-95 transition-all text-center flex justify-center cursor-pointer"
                    onClick={() => {
                      setPurgeType('profile');
                      setResetConfirmInput('');
                    }}
                  >
                    Wipe Everything (Factory Reset)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!purgeType} onOpenChange={() => { setPurgeType(null); setResetConfirmInput(''); }}>
        <DialogContent className="sm:max-w-md rounded-3xl border border-zinc-100 p-6">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-red-650 flex items-center gap-2 text-md font-bold">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              {purgeType === 'profile' ? "Factory Reset Account" : "Delete All Data"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-left">
            <p className="text-xs text-zinc-600 leading-relaxed">
              {purgeType === 'profile' ? (
                <>
                  You are resetting your account. This will permanently clear <strong>ALL</strong> quotes, invoices, expenses, clients, templates, and rates.
                </>
              ) : (
                <>
                  You are deleting all invoices and quotes. Your business profile and settings will remain stored.
                </>
              )}
            </p>
            <p className="text-[10px] text-red-650 font-semibold bg-red-50 p-3 rounded-xl border border-red-100 leading-relaxed">
              ⚠️ WARNING: This action cannot be undone. This data will be permanently wiped.
            </p>
            <div className="space-y-2">
              <Label htmlFor="safety-input" className="text-[11px] font-semibold text-zinc-650">
                Type <span className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-red-600 font-bold">{purgeType === 'profile' ? 'RESET' : 'DELETE'}</span> to confirm:
              </Label>
              <Input
                id="safety-input"
                autoComplete="off"
                placeholder={purgeType === 'profile' ? "RESET" : "DELETE"}
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                className="font-mono uppercase tracking-widest text-center h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end flex-row">
            <Button
              variant="outline"
              disabled={isPurging}
              onClick={() => { setPurgeType(null); setResetConfirmInput(''); }}
              className="h-10 rounded-xl font-medium text-xs border-zinc-200"
            >
              Discard
            </Button>
            <Button
              variant="destructive"
              className={`h-10 rounded-xl font-bold text-xs ${purgeType === 'profile' ? "bg-red-600 hover:bg-red-700" : "bg-red-500 hover:bg-red-600"}`}
              disabled={isPurging || resetConfirmInput.toUpperCase() !== (purgeType === 'profile' ? 'RESET' : 'DELETE')}
              onClick={handlePurge}
            >
              {isPurging ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Executing reset...
                </span>
              ) : (
                purgeType === 'profile' ? 'Confirm Reset' : 'Confirm Delete All Data'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
