import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { z } from 'zod';
import { useAuth } from '../lib/auth';

const approvalSchema = z.object({
  signatureName: z.string().min(2, "Please enter your full name to sign"),
  signatureDataUrl: z.string().min(20, "Please draw your signature"),
  agreed: z.boolean().refine(val => val === true, "You must agree to the terms and conditions")
});

import { getCurrencySymbol } from '../lib/currencies';

import { SafeHtml } from '../components/SafeHtml';
import { SignaturePad } from '../components/SignaturePad';

export default function ClientView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<any>(null); // keeping the state name "estimate" internal to avoid wide changes, but display labels as Quotation
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [contractor, setContractor] = useState<any>(null);
  
  const [signatureName, setSignatureName] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  useEffect(() => {
    if (estimate && contractor) {
      document.title = `Quotation from ${contractor.businessName || 'Your Contractor'} — SoloBid`;
    }
    return () => { document.title = 'SoloBid'; };
  }, [estimate, contractor]);

  const loadData = async (estimateId: string) => {
    try {
      setLoading(true);
      // Try quotes collection first
      let docRef = doc(db, 'quotes', estimateId);
      let docSnap = await getDoc(docRef);
      let collectionName = 'quotes';
      
      if (!docSnap.exists()) {
        // Fallback to legacy estimates collection
        docRef = doc(db, 'estimates', estimateId);
        docSnap = await getDoc(docRef);
        collectionName = 'estimates';
      }
      
      if (docSnap.exists()) {
        const estData = docSnap.data();
        setEstimate({ id: docSnap.id, ...estData, _collectionName: collectionName });
        
        setContractor({
          businessName: estData.contractorBusinessName,
          logoUrl: estData.contractorLogoUrl,
          terms: estData.contractorTerms,
          defaultCurrency: estData.currency || 'ZAR',
          saTaxInvoiceMode: estData.isSATaxInvoice || false
        });

        // Load line items
        const itemsRef = collection(db, collectionName, estimateId, 'lineItems');
        const itemsSnap = await getDocs(itemsRef);
        setLineItems(itemsSnap.docs.map(d => d.data()));
      }
    } catch (error) {
      console.error("Error loading quote:", error);
      toast.error("An unexpected error occurred while loading this quote. Please try again or contact the sender.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (estimate?.status !== 'sent') {
      toast.error('This quotation is not currently open for approval.');
      return;
    }
    if (isExpired) {
      toast.error('This quotation has expired and can no longer be approved. Contact the contractor for a renewed quote.');
      return;
    }

    const validationResult = approvalSchema.safeParse({ signatureName, signatureDataUrl, agreed });
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => err.message);
      toast.error(errors[0]);
      return;
    }

    try {
      setApproving(true);
      const collectionName = estimate?._collectionName || 'quotes';
      const docRef = doc(db, collectionName, id!);
      const approvedAt = new Date().toISOString();
      await updateDoc(docRef, {
        status: 'approved',
        signatureName: signatureName.trim(),
        signatureDataUrl,
        approvedAt
      });
      
      setEstimate({ ...estimate, status: 'approved', signatureName: signatureName.trim(), signatureDataUrl, approvedAt });
      toast.success("Quotation approved successfully!");
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve quotation. Please refresh the link and try again, or contact the sender.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (estimate?.status !== 'sent') {
      toast.error('This quotation is not currently open for rejection.');
      return;
    }
    if (isExpired) {
      toast.error('This quotation has already expired.');
      return;
    }

    try {
      setRejecting(true);
      const collectionName = estimate?._collectionName || 'quotes';
      const docRef = doc(db, collectionName, id!);
      const rejectedAt = new Date().toISOString();
      const trimmedReason = rejectionReason.trim();
      await updateDoc(docRef, {
        status: 'rejected',
        rejectionReason: trimmedReason,
        rejectedAt
      });

      setEstimate({ ...estimate, status: 'rejected', rejectionReason: trimmedReason, rejectedAt });
      toast.success('Quotation declined. The sender can review your response.');
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Failed to decline quotation. Please refresh the link and try again, or contact the sender.');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-600">Loading quotation details...</div>;
  if (!estimate) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="text-4xl mb-4">📄</div>
      <h2 className="text-2xl font-bold text-zinc-900 mb-2">Quotation Not Found</h2>
      <p className="text-zinc-500 max-w-md">We couldn't find the quotation you're looking for. It may have been deleted or the link might be incorrect. Please contact the person who sent you this link.</p>
    </div>
  );

  const currencySymbol = getCurrencySymbol(estimate?.currency || contractor?.defaultCurrency || 'ZAR');
  const isSATaxInvoice = estimate?.currency === 'ZAR' && contractor?.saTaxInvoiceMode;

  const isExpired = estimate?.expiresAt && 
                    !['approved', 'rejected', 'paid', 'converted'].includes(estimate.status) && 
                    new Date() > new Date(estimate.expiresAt);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        
        {user && (
          <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-md flex items-center justify-between gap-3 border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <p className="text-xs sm:text-sm font-medium text-zinc-300">
                Preview Mode. Client-facing layout is active.
              </p>
            </div>
            <Button 
              size="sm" 
              className="text-xs h-8 text-zinc-900 bg-white hover:bg-zinc-100 border-none font-semibold px-3"
              onClick={() => navigate(`/quotes/${id}`)}
            >
              Back to Editor
            </Button>
          </div>
        )}

        {isExpired && (
          <div className="bg-red-50 text-red-800 px-5 py-4 rounded-xl shadow-sm border border-red-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5 text-red-800">
                ⚠️ This quotation has expired
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                The offer was valid until {new Date(estimate.expiresAt).toLocaleDateString(undefined, { dateStyle: 'long' })}. Please contact {contractor?.businessName || 'the contractor'} if you require an updated or renewed copy.
              </p>
            </div>
          </div>
        )}
        
        {/* Top bar with status and actions */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold">
              {contractor?.businessName?.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900">{contractor?.businessName}</p>
              <p className="text-xs text-zinc-500">Quotation #{estimate.id.substring(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {(() => {
                const statusConfig = {
                  draft: { bg: 'bg-zinc-100', text: 'text-zinc-800', icon: '⊙', label: 'Draft' },
                  sent: { bg: 'bg-blue-50', text: 'text-blue-700', icon: '✉', label: 'Reviewing' },
                  approved: { bg: 'bg-green-50', text: 'text-green-700', icon: '✓', label: 'Approved' },
                  paid: { bg: 'bg-green-50', text: 'text-green-700', icon: '✓', label: 'Paid' },
                  converted: { bg: 'bg-purple-50', text: 'text-purple-700', icon: '✓', label: 'Invoiced' },
                  overdue: { bg: 'bg-red-50', text: 'text-red-700', icon: '!', label: 'Overdue' },
                  rejected: { bg: 'bg-red-50', text: 'text-red-700', icon: '×', label: 'Declined' },
                  expired: { bg: 'bg-red-50', text: 'text-red-700', icon: '⏰', label: 'Expired' }
                };
                const activeStatus = isExpired ? 'expired' : estimate.status;
                const config = statusConfig[activeStatus as keyof typeof statusConfig] || statusConfig.draft;
                return (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 ${config.bg} ${config.text}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {activeStatus === 'converted' ? 'Approved' : config.label}
                  </span>
                );
              })()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {/* Header */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-100">
              <div className="flex justify-between items-start mb-8">
                <div>
                  {contractor?.logoUrl ? (
                    <img src={contractor.logoUrl} alt={contractor.businessName} className="h-16 object-contain mb-4" />
                  ) : null}
                  <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{contractor?.businessName}</h1>
                  {isSATaxInvoice && contractor?.vatNumber && (
                    <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider font-semibold">VAT No: {contractor.vatNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">Quotation</h2>
                  <p className="text-lg font-mono text-zinc-900">#{estimate.id.substring(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-zinc-500 mt-1">{new Date(estimate.updatedAt || estimate.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 py-8 border-t border-b border-zinc-50">
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Prepared for</h3>
                  <p className="font-bold text-zinc-900">{estimate.clientName}</p>
                  <p className="text-sm text-zinc-600">{estimate.clientEmail}</p>
                  {estimate.clientAddress && (
                     <p className="text-sm text-zinc-500 mt-2 whitespace-pre-line leading-relaxed">{estimate.clientAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Total Amount</h3>
                  <p className="text-3xl font-bold text-zinc-900">{currencySymbol}{(estimate.total || 0).toFixed(2)}</p>
                  <p className="text-xs text-zinc-500 mt-1">Inclusive of {isSATaxInvoice ? '15% VAT' : `${estimate.taxRate}% Tax`}</p>
                </div>
              </div>

              {/* Line Items */}
              <div className="py-8">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-6">Scope of Work</h3>
                <div className="space-y-4">
                  {lineItems.map((item, i) => {
                    const baseCost = item.qty * item.unitCost;
                    const markup = item.type === 'material' ? baseCost * (item.markupPercent / 100) : 0;
                    const lineTotal = baseCost + markup;
                    
                    return (
                      <div key={i} className="flex justify-between items-start py-3 group">
                        <div className="flex-1 pr-8">
                          <p className="font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors">{item.description}</p>
                          <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                            <span className="capitalize px-2 py-0.5 bg-zinc-100 rounded text-zinc-600">{item.type}</span>
                            <span>{item.qty} × {currencySymbol}{item.unitCost.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{currencySymbol}{lineTotal.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-12 space-y-3 pt-6 border-t border-zinc-50 max-w-[240px] ml-auto">
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Subtotal</span>
                    <span className="font-medium text-zinc-900">{currencySymbol}{(estimate.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>{isSATaxInvoice ? 'VAT (15%)' : `Tax (${estimate.taxRate || 0}%)`}</span>
                    <span className="font-medium text-zinc-900">{currencySymbol}{(estimate.taxAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-4">
                    <span className="font-bold text-zinc-900">Total Due</span>
                    <span className="font-bold text-zinc-900">{currencySymbol}{(estimate.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {estimate.notes && (
                <div className="mt-8 pt-8 border-t border-zinc-50">
                   <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Contractor Notes</h3>
                   <div className="p-4 bg-zinc-50 rounded-xl">
                    <SafeHtml html={estimate.notes} className="text-sm text-zinc-600 leading-relaxed" />
                   </div>
                </div>
              )}
            </div>

            {contractor?.terms && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-100">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-6">Terms & Conditions</h3>
                <SafeHtml html={contractor.terms} className="text-sm text-zinc-500 leading-relaxed whitespace-pre-line" />
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            {/* Workflow indicator */}
            <Card className="border-none shadow-sm overflow-hidden">
               <CardHeader className="bg-zinc-900 text-white py-4">
                <CardTitle className="text-sm uppercase tracking-widest font-bold">Project Progress</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {[
                    { key: 'draft', label: 'Quotation Prepared', icon: '📝' },
                    { key: 'sent', label: 'Quotation Sent', icon: '✉️' },
                    { key: 'approved', label: 'Awaiting Approval', icon: '✍️' },
                    { key: 'converted', label: 'Job Scheduled', icon: '🗓️' },
                  ].map((step, i) => {
                    const sequence = ['draft', 'sent', 'approved', 'converted'];
                    const currentIndex = sequence.indexOf(estimate.status === 'paid' ? 'converted' : estimate.status);
                    const stepIndex = sequence.indexOf(step.key);
                    const isCompleted = stepIndex < currentIndex || estimate.status === 'converted' || estimate.status === 'paid';
                    const isCurrent = stepIndex === currentIndex && estimate.status !== 'converted' && estimate.status !== 'paid';

                    return (
                      <div key={step.key} className="flex gap-4 relative">
                        {i < 3 && (
                          <div className={`absolute left-[15px] top-8 w-0.5 h-10 ${isCompleted ? 'bg-green-500' : 'bg-zinc-100'}`} />
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs' font-bold z-10 transition-all duration-500 shadow-sm
                          ${isCompleted ? 'bg-green-500 text-sm text-white' : 
                            isCurrent ? 'bg-blue-500 text-white ring-4 ring-blue-50' : 
                            'bg-zinc-100 text-zinc-400'}`}>
                          {isCompleted ? '✓' : i + 1}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isCompleted ? 'text-zinc-900' : isCurrent ? 'text-blue-600' : 'text-zinc-400'}`}>
                            {step.label}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {isCompleted ? 'Action completed' : isCurrent ? 'Action required' : 'Upcoming'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Approval Section */}
            {isExpired ? (
              <div className="sticky top-20">
                <Card className="border-red-200 shadow-xl overflow-hidden ring-1 ring-red-100 bg-red-50/20">
                  <CardHeader className="bg-zinc-900 text-white">
                    <CardTitle className="text-lg">Quotation Expired</CardTitle>
                    <p className="text-xs text-red-200">This quotation has reached its expiration date.</p>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-center">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <span className="text-xl">⏰</span>
                    </div>
                    <p className="text-sm text-zinc-600 leading-relaxed font-semibold">
                      This quotation was valid until {new Date(estimate.expiresAt).toLocaleDateString(undefined, { dateStyle: 'long' })} and is no longer open for approval.
                    </p>
                    <p className="text-xs text-zinc-500">
                      Please reach out to <span className="font-bold">{contractor?.businessName}</span> directly to request a renewed proposal.
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : estimate.status === 'sent' ? (
              <div className="sticky top-20">
                <Card className="border-none shadow-xl shadow-zinc-200 overflow-hidden ring-1 ring-zinc-200">
                  <CardHeader className="bg-zinc-900 text-white">
                    <CardTitle className="text-lg">Approve or Decline Quotation</CardTitle>
                    <p className="text-xs text-zinc-400">Please review the details, then sign to approve or decline with an optional note.</p>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="signature" className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Full Name for Signature</Label>
                      <Input 
                        id="signature" 
                        value={signatureName}
                        onChange={e => setSignatureName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="font-serif text-lg py-6 bg-zinc-50 border-zinc-200 focus:ring-zinc-900 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Draw Signature</Label>
                      <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} />
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <input 
                        type="checkbox" 
                        id="agree" 
                        className="mt-1 w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        checked={agreed}
                        onChange={e => setAgreed(e.target.checked)}
                      />
                      <Label htmlFor="agree" className="text-xs text-zinc-500 leading-relaxed font-medium">
                        I authorize {contractor?.businessName} to proceed for {currencySymbol}{(estimate.total || 0).toFixed(2)}.
                      </Label>
                    </div>
                    <Button 
                      className="w-full py-7 text-lg font-bold rounded-xl shadow-lg shadow-zinc-200 transition-all active:scale-[0.98]" 
                      onClick={handleApprove}
                      disabled={approving || rejecting || !signatureName.trim() || !signatureDataUrl || !agreed}
                    >
                      {approving ? 'Approving...' : 'Sign & Approve'}
                    </Button>
                    <p className="text-[10px] text-zinc-400 text-center uppercase tracking-widest leading-relaxed">
                      By clicking approve, you electronically sign this agreement.
                    </p>
                    <div className="border-t border-zinc-100 pt-5 space-y-3">
                      <Label htmlFor="rejectionReason" className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Decline Note (Optional)</Label>
                      <Textarea
                        id="rejectionReason"
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value.slice(0, 1000))}
                        placeholder="Add a short reason or requested change for the sender."
                        className="min-h-24 rounded-xl bg-zinc-50 text-sm"
                      />
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                        onClick={handleReject}
                        disabled={approving || rejecting}
                      >
                        {rejecting ? 'Declining...' : 'Decline Quotation'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : estimate.status === 'rejected' ? (
              <div className="sticky top-20">
                <Card className="bg-red-50 border-red-200 shadow-sm border-2">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-100 text-3xl font-bold">
                      ×
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-red-900 tracking-tight">Declined</h3>
                      <p className="text-red-700 text-sm mt-1">
                        This quotation was declined by the client.
                      </p>
                      {estimate.rejectionReason && (
                        <p className="mt-3 rounded-xl bg-white/70 p-3 text-left text-sm text-red-800">
                          {estimate.rejectionReason}
                        </p>
                      )}
                      {estimate.rejectedAt && (
                        <p className="text-xs text-red-600 mt-2 font-medium bg-red-100/50 py-1 px-2 rounded-full inline-block">
                          {new Date(estimate.rejectedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : estimate.status !== 'approved' && estimate.status !== 'converted' && estimate.status !== 'paid' ? (
              <div className="sticky top-20">
                <Card className="border-zinc-200 shadow-sm border-2">
                  <CardContent className="p-8 text-center space-y-3">
                    <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Not yet available</h3>
                    <p className="text-sm text-zinc-500">
                      This quotation hasn't been sent yet. Contact <span className="font-semibold text-zinc-700">{contractor?.businessName || 'the contractor'}</span> directly if you were expecting to receive it.
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="sticky top-20">
                <Card className="bg-green-50 border-green-200 shadow-sm border-2">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-100">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-green-900 tracking-tight">Approved!</h3>
                      <p className="text-green-700 text-sm mt-1">
                        Digitally signed by <span className="font-serif italic font-bold">{estimate.signatureName}</span>
                      </p>
                      {estimate.signatureDataUrl && (
                        <img src={estimate.signatureDataUrl} alt="Client signature" className="mx-auto mt-3 h-16 max-w-48 object-contain rounded-lg bg-white/70 p-2" />
                      )}
                      <p className="text-xs text-green-600 mt-2 font-medium bg-green-100/50 py-1 px-2 rounded-full inline-block">
                        {new Date(estimate.approvedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white/80 rounded-xl p-4 text-left space-y-1 border border-green-100">
                      <p className="text-sm font-semibold text-green-900">What happens next?</p>
                      <p className="text-xs text-green-700 leading-relaxed">
                        {contractor?.businessName || 'The contractor'} has been notified of your approval and will be in touch shortly to confirm the start date and next steps.
                      </p>
                    </div>
                    <p className="text-[11px] text-green-600">You can safely close this page.</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
