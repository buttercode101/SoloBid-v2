import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, OnboardingStep, getProfileCompletion } from '../lib/auth';
import { db, storage } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowRight, BadgeCheck, Building2, CheckCircle2, Clock, FileText, Loader2, UserRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { COUNTRIES, getCountryByCode, getCountryByCurrency } from '../lib/countries';

const stepOrder: OnboardingStep[] = ['welcome', 'profile', 'preferences', 'complete'];

const industryOptions = [
  'Electrical',
  'Plumbing',
  'HVAC',
  'General Contractor',
  'Landscaping',
  'Painting',
  'Carpentry',
  'Roofing',
  'Cleaning',
  'Other',
];

const ProgressHeader = ({ step, completion }: { step: OnboardingStep; completion: number }) => {
  const currentStep = Math.max(1, stepOrder.indexOf(step) + 1);
  const displayStep = Math.min(currentStep, 3);

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 text-white shadow-lg shadow-emerald-950/15">
        <FileText className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Step {displayStep} of 3</p>
        <div className="h-2 w-full rounded-full bg-zinc-100">
          <div className="h-2 rounded-full bg-emerald-700 transition-all" style={{ width: `${Math.max(completion, displayStep === 1 ? 12 : 0)}%` }} />
        </div>
        <p className="text-xs font-semibold text-zinc-400">Profile completion: {completion}%</p>
      </div>
    </div>
  );
};

export default function Onboarding() {
  const { user, profile, authState, refreshProfile, saveProfileDraft, error } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [step, setStep] = useState<OnboardingStep>(authState.nextOnboardingStep);

  const [formData, setFormData] = useState({
    fullName: profile?.fullName || user?.displayName || '',
    businessName: profile?.businessName || '',
    industry: profile?.industry || '',
    mobileNumber: profile?.mobileNumber || '',
    country: profile?.country || 'US',
    defaultCurrency: profile?.defaultCurrency || 'USD',
    vatNumber: profile?.vatNumber || '',
    businessRegistrationNumber: profile?.businessRegistrationNumber || '',
    address: profile?.address || '',
    defaultLaborRate: String(profile?.defaultLaborRate ?? 75),
    defaultTaxRate: String(profile?.defaultTaxRate ?? 0),
    defaultMarkup: String(profile?.defaultMarkup ?? 20),
    terms: profile?.terms || 'Payment is due within 14 days of invoice date. All materials remain property of the contractor until paid in full.',
    saTaxInvoiceMode: profile?.saTaxInvoiceMode || false,
  });

  useEffect(() => {
    setStep(authState.nextOnboardingStep);
  }, [authState.nextOnboardingStep]);

  const completion = useMemo(() => getProfileCompletion({
    uid: user?.uid || '',
    businessName: formData.businessName,
    fullName: formData.fullName,
    industry: formData.industry,
    mobileNumber: formData.mobileNumber,
    country: formData.country,
    defaultCurrency: formData.defaultCurrency,
    defaultLaborRate: Number(formData.defaultLaborRate) || 0,
    defaultTaxRate: Number(formData.defaultTaxRate) || 0,
    defaultMarkup: Number(formData.defaultMarkup) || 0,
    terms: formData.terms,
    createdAt: profile?.createdAt || new Date().toISOString(),
  }), [formData, profile?.createdAt, user?.uid]);

  const persistStep = async (nextStep: OnboardingStep, extra: Record<string, any> = {}) => {
    await saveProfileDraft({
      ...extra,
      onboardingStep: nextStep,
      onboardingComplete: false,
      profileComplete: false,
    });
    setStep(nextStep);
  };

  const handleCountryChange = (countryCode: string) => {
    const countryConfig = getCountryByCode(countryCode);
    if (countryConfig) {
      setFormData((prev) => ({
        ...prev,
        country: countryCode,
        defaultCurrency: countryConfig.currency,
        defaultTaxRate: countryConfig.taxRate.toString(),
        saTaxInvoiceMode: Boolean(countryConfig.saTaxInvoiceMode),
      }));
    } else {
      setFormData((prev) => ({ ...prev, country: countryCode }));
    }
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const countryConfig = getCountryByCurrency(currencyCode);
    setFormData((prev) => ({
      ...prev,
      defaultCurrency: currencyCode,
      ...(countryConfig ? {
        country: countryConfig.code,
        defaultTaxRate: countryConfig.taxRate.toString(),
        saTaxInvoiceMode: Boolean(countryConfig.saTaxInvoiceMode),
      } : {}),
    }));
  };

  const handleWelcomeContinue = async () => {
    try {
      setLoading(true);
      await persistStep('profile');
    } catch {
      toast.warning('We saved your progress on this device. Please continue when your connection is stable.');
      setStep('profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await persistStep('preferences', {
        fullName: formData.fullName.trim(),
        businessName: formData.businessName.trim(),
        industry: formData.industry,
        mobileNumber: formData.mobileNumber.trim(),
        country: formData.country,
        defaultCurrency: formData.defaultCurrency,
        vatNumber: formData.vatNumber.trim(),
        businessRegistrationNumber: formData.businessRegistrationNumber.trim(),
        address: formData.address.trim(),
      });
    } catch {
      toast.warning('Your profile was saved locally. We will retry syncing when the connection recovers.');
      setStep('preferences');
    } finally {
      setLoading(false);
    }
  };

  const createDefaultTemplates = async (uid: string) => {
    const templateId = crypto.randomUUID();
    await setDoc(doc(db, 'templates', templateId), {
      id: templateId,
      uid,
      name: 'Basic Service Call',
      description: 'Standard diagnostic and minor repair',
      lineItems: [
        { id: crypto.randomUUID(), description: 'Diagnostic Fee', qty: 1, unitCost: 85, type: 'labor', markupPercent: 0 },
        { id: crypto.randomUUID(), description: 'Minor Parts', qty: 1, unitCost: 25, type: 'material', markupPercent: parseFloat(formData.defaultMarkup) || 0 },
      ],
      createdAt: new Date().toISOString(),
    });
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      let logoUrl = profile?.logoUrl || '';

      if (logoFile) {
        const storageRef = ref(storage, `logos/${user.uid}/${Date.now()}-${logoFile.name}`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }

      const completedProfile = {
        fullName: formData.fullName.trim(),
        businessName: formData.businessName.trim(),
        industry: formData.industry,
        mobileNumber: formData.mobileNumber.trim(),
        country: formData.country,
        defaultCurrency: formData.defaultCurrency,
        vatNumber: formData.vatNumber.trim(),
        businessRegistrationNumber: formData.businessRegistrationNumber.trim(),
        address: formData.address.trim(),
        logoUrl,
        defaultLaborRate: parseFloat(formData.defaultLaborRate) || 0,
        defaultTaxRate: parseFloat(formData.defaultTaxRate) || 0,
        defaultMarkup: parseFloat(formData.defaultMarkup) || 0,
        terms: formData.terms,
        invoicePrefix: profile?.invoicePrefix || 'INV-',
        invoiceCount: profile?.invoiceCount || 0,
        pdfStyle: profile?.pdfStyle || 'modern',
        pdfFont: profile?.pdfFont || 'Helvetica',
        saTaxInvoiceMode: formData.saTaxInvoiceMode,
        onboardingStep: 'complete' as OnboardingStep,
        onboardingComplete: true,
        profileComplete: true,
        profileCompletion: 100,
        subscriptionStatus: profile?.subscriptionStatus || 'trial',
      };

      await saveProfileDraft(completedProfile);

      if (!profile?.onboardingComplete) {
        await createDefaultTemplates(user.uid);
      }

      await refreshProfile();
      toast.success('Profile complete. Welcome to SoloBid.');
      navigate('/dashboard', { replace: true });
    } catch (completeError: any) {
      toast.error(completeError.message || 'Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <ProgressHeader step={step} completion={completion} />

          {error && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {error}
            </div>
          )}

          {step === 'welcome' && (
            <div className="mt-10 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-800">
                <BadgeCheck className="h-8 w-8" />
              </div>
              <h1 className="text-4xl font-black tracking-tight text-zinc-950">Welcome to SoloBid</h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-zinc-500">
                Let&apos;s set up your profile so your quotes and invoices are ready from day one.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-700">
                <Clock className="h-4 w-4 text-emerald-700" />
                Less than 60 seconds
              </div>
              <Button className="mt-8 h-12 w-full rounded-2xl text-base font-bold" onClick={handleWelcomeContinue} loading={loading}>
                Set up profile
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          )}

          {step === 'profile' && (
            <form onSubmit={handleProfileContinue} className="mt-8 space-y-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-950">Profile Setup</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-500">These details appear on your professional quotes and invoices.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobileNumber">Mobile Number *</Label>
                  <Input id="mobileNumber" type="tel" value={formData.mobileNumber} onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })} required className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input id="businessName" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} required className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="industry">Industry / Trade *</Label>
                  <select id="industry" value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} required className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="" disabled>Select your trade</option>
                    {industryOptions.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <select id="country" className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={formData.country} onChange={(e) => handleCountryChange(e.target.value)} required>
                    {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultCurrency">Currency *</Label>
                  <select id="defaultCurrency" className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={formData.defaultCurrency} onChange={(e) => handleCurrencyChange(e.target.value)} required>
                    <option value="USD">USD ($)</option>
                    <option value="ZAR">ZAR (R)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="NZD">NZD (NZ$)</option>
                    <option value="SGD">SGD (S$)</option>
                  </select>
                </div>
              </div>

              <Button type="submit" className="h-12 w-full rounded-2xl font-bold" loading={loading}>
                Continue to preferences
                <ArrowRight className="h-5 w-5" />
              </Button>
            </form>
          )}

          {step === 'preferences' && (
            <form onSubmit={handleCompleteSetup} className="mt-8 space-y-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-950">Preferences</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-500">Add optional business details and defaults. You can refine them later in Settings.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="logo">Logo (Optional)</Label>
                  <Input id="logo" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">VAT Number (Optional)</Label>
                  <Input id="vatNumber" value={formData.vatNumber} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessRegistrationNumber">Business Registration Number (Optional)</Label>
                  <Input id="businessRegistrationNumber" value={formData.businessRegistrationNumber} onChange={(e) => setFormData({ ...formData, businessRegistrationNumber: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address (Optional)</Label>
                  <Textarea id="address" rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultLaborRate">Default Labor Rate (/hr)</Label>
                  <Input id="defaultLaborRate" type="number" min="0" step="0.01" value={formData.defaultLaborRate} onChange={(e) => setFormData({ ...formData, defaultLaborRate: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
                  <Input id="defaultTaxRate" type="number" min="0" step="0.01" value={formData.defaultTaxRate} onChange={(e) => setFormData({ ...formData, defaultTaxRate: e.target.value })} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="terms">Default Terms & Conditions</Label>
                  <Textarea id="terms" rows={4} value={formData.terms} onChange={(e) => setFormData({ ...formData, terms: e.target.value })} className="rounded-xl" />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <p><strong>Ready for day one.</strong> Completing setup unlocks dashboard, quotes, invoices, clients, templates, recurring invoices, and settings.</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <Button type="button" variant="outline" className="h-12 rounded-2xl font-bold" onClick={() => setStep('profile')} disabled={loading}>
                  Back
                </Button>
                <Button type="submit" className="h-12 rounded-2xl font-bold" loading={loading}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Building2 className="h-5 w-5" />}
                  Complete Setup
                </Button>
              </div>
            </form>
          )}

          {step === 'complete' && (
            <div className="mt-10 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-800">
                <UserRound className="h-8 w-8" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-950">Your profile is complete.</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">You are ready to create quotes, collect approvals, and invoice faster.</p>
              <Button className="mt-8 h-12 w-full rounded-2xl font-bold" onClick={() => navigate('/dashboard', { replace: true })}>
                Go to dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
