import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from '../components/InvoicePDF';
import { Download, Mail, DollarSign, ArrowRight, Loader2, Landmark, CheckCircle, Clock, MessageCircle, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrencySymbol } from '../lib/currencies';
import { authorizedFetch } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { formatZAR, statusBadgeStyles } from '../lib/theme';
import { sharePdfViaWhatsApp } from '../lib/documentActions';

export default function Invoices() {
  const { user, profile } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [approvedEstimates, setApprovedEstimates] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);

  const formatCurrency = (amount: number, curr: string) => {
    if (curr === 'ZAR') {
      return formatZAR(amount);
    }
    return `${getCurrencySymbol(curr)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    if (!user) return;

    let invLoaded = false;
    let quotesLoaded = false;
    let estLoaded = false;

    const checkLoaded = () => {
      if (invLoaded && quotesLoaded && estLoaded) setInitialLoading(false);
    };

    const invQ = query(
      collection(db, 'invoices'),
      where('uid', '==', user.uid)
    );

    const unsubInv = onSnapshot(invQ, (snapshot) => {
      const invs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      invs.sort((a: any, b: any) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setInvoices(invs);
      invLoaded = true;
      checkLoaded();
    });

    let quotesList: any[] = [];
    let estimatesList: any[] = [];

    const updateApproved = () => {
      setApprovedEstimates([...quotesList, ...estimatesList]);
    };

    const quotesQ = query(
      collection(db, 'quotes'),
      where('uid', '==', user.uid),
      where('status', '==', 'approved')
    );

    const unsubQuotes = onSnapshot(quotesQ, (snapshot) => {
      quotesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), _collectionName: 'quotes' }));
      quotesLoaded = true;
      updateApproved();
      checkLoaded();
    });

    const estQ = query(
      collection(db, 'estimates'),
      where('uid', '==', user.uid),
      where('status', '==', 'approved')
    );

    const unsubEst = onSnapshot(estQ, (snapshot) => {
      estimatesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), _collectionName: 'estimates' }));
      estLoaded = true;
      updateApproved();
      checkLoaded();
    });

    return () => {
      unsubInv();
      unsubQuotes();
      unsubEst();
    };
  }, [user]);

  const handleConvert = async (estimate: any) => {
    try {
      if (!user?.uid) throw new Error("Authentication required");
      
      setLoading(true);
      const invoiceId = uuidv4();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const userRef = doc(db, 'users', user.uid);
      const collectionName = estimate._collectionName || 'quotes';
      const estimateRef = doc(db, collectionName, estimate.id);
      
      let invoiceNumber = '';
      
      await runTransaction(db, async (transaction) => {
        const [userDoc, estDoc] = await Promise.all([
          transaction.get(userRef),
          transaction.get(estimateRef)
        ]);
        
        if (!userDoc.exists()) {
          throw new Error("Your profile is missing. Please go to Settings and save your profile.");
        }

        if (!estDoc.exists()) {
          throw new Error("The quotation could not be found.");
        }
        
        const estData = estDoc.data();
        if (estData.uid !== user.uid) {
          throw new Error("You don't have permission to convert this quotation.");
        }

        if (estData.status === 'converted') {
          throw new Error("This quotation has already been converted to an invoice.");
        }

        if (estData.status !== 'approved') {
          throw new Error("Only approved quotations can be converted to invoices.");
        }
        
        const userData = userDoc.data();
        const currentCount = userData.invoiceCount || 0;
        const newCount = currentCount + 1;
        const prefix = userData.invoicePrefix || 'INV-';
        invoiceNumber = `${prefix}${newCount.toString().padStart(4, '0')}`;
        
        transaction.update(userRef, { invoiceCount: newCount });
        
        const invoiceData = {
          id: invoiceId,
          uid: user.uid,
          estimateId: estimate.id,
          invoiceNumber,
          clientName: estData.clientName,
          clientEmail: estData.clientEmail,
          total: estData.total,
          currency: estData.currency || 'ZAR',
          status: 'draft',
          dueDate: dueDate.toISOString(),
          createdAt: new Date().toISOString()
        };
        
        const invoiceRef = doc(db, 'invoices', invoiceId);
        transaction.set(invoiceRef, invoiceData);
        
        transaction.update(estimateRef, { status: 'converted' });
      });
      
      toast.success(`Invoice ${invoiceNumber} created successfully`);
    } catch (error: any) {
      const errorMessage = 
        error.message?.includes("Transaction") 
          ? "Failed to create invoice. Please try again or contact support."
          : error.message;
      
      console.error("Invoice conversion error:", {
        estimateId: estimate.id,
        userId: user?.uid,
        error: error.message,
        code: error.code
      });
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (invoice: any) => {
    try {
      setPdfProgress(0);
      setGeneratingPdf(invoice.id);
      
      setPdfProgress(20);
      let estDoc = await getDoc(doc(db, 'quotes', invoice.estimateId));
      let collectionName = 'quotes';
      if (!estDoc.exists()) {
        estDoc = await getDoc(doc(db, 'estimates', invoice.estimateId));
        collectionName = 'estimates';
      }
      const estimate = estDoc.data();
      
      setPdfProgress(40);
      const itemsRef = collection(db, collectionName, invoice.estimateId, 'lineItems');
      const itemsSnap = await getDocs(itemsRef);
      const lineItems = itemsSnap.docs.map(d => d.data());

      setPdfProgress(60);
      const blob = await pdf(
        <InvoicePDF 
          invoice={invoice} 
          estimate={estimate} 
          contractor={profile} 
          lineItems={lineItems} 
        />
      ).toBlob();
      
      setPdfProgress(100);
      const invoiceNum = invoice.invoiceNumber || invoice.id.substring(0, 8).toUpperCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invoiceNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Invoice PDF exported");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setPdfProgress(null);
      setGeneratingPdf(null);
    }
  };

  const getInvoicePdfBlob = async (invoice: any) => {
    let estDoc = await getDoc(doc(db, 'quotes', invoice.estimateId));
    let collectionName = 'quotes';
    if (!estDoc.exists()) {
      estDoc = await getDoc(doc(db, 'estimates', invoice.estimateId));
      collectionName = 'estimates';
    }
    const estimate = estDoc.data();
    const itemsRef = collection(db, collectionName, invoice.estimateId, 'lineItems');
    const itemsSnap = await getDocs(itemsRef);
    const lineItems = itemsSnap.docs.map(d => d.data());
    return pdf(<InvoicePDF invoice={invoice} estimate={estimate} contractor={profile} lineItems={lineItems} />).toBlob();
  };

  const handleShareInvoiceWhatsApp = async (invoice: any) => {
    try {
      setGeneratingPdf(invoice.id);
      const blob = await getInvoicePdfBlob(invoice);
      const invoiceNum = invoice.invoiceNumber || invoice.id.substring(0, 8).toUpperCase();
      await sharePdfViaWhatsApp(
        blob,
        `Invoice_${invoiceNum}.pdf`,
        `Hi ${invoice.clientName || 'there'}, here is invoice ${invoiceNum} from ${profile?.businessName || 'SoloBid'}.`
      );
    } catch (error: any) {
      if (error?.name !== 'AbortError') toast.error('Could not open share sheet');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handlePrintInvoice = async (invoice: any) => {
    await handleDownloadPdf(invoice);
    window.setTimeout(() => window.print(), 150);
  };

  const handleSendInvoice = async (invoice: any) => {
    try {
      setGeneratingPdf(invoice.id);
      
      const response = await authorizedFetch('/api/send-invoice', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: invoice.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server status: ${response.status}`);
      }
      
      await response.json();
      toast.success("Invoice sent to client");
    } catch (error: any) {
      console.error("Invoice send error:", {
        invoiceId: invoice.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      toast.error(error.message || "Failed to transmit invoice");
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await setDoc(doc(db, 'invoices', invoiceId), { 
        status: 'paid',
        paidAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Invoice record updated to PAID");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  if (initialLoading) {
    return (
      <div className="space-y-8 animate-pulse max-w-7xl mx-auto">
        <div className="h-10 bg-zinc-150 rounded-xl w-1/4"></div>
        <div className="h-40 bg-zinc-100 rounded-3xl"></div>
        <div className="h-64 bg-zinc-100 rounded-3xl"></div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const style = statusBadgeStyles[status as keyof typeof statusBadgeStyles] || statusBadgeStyles.draft;
    const labelMap: Record<string, string> = {
      draft: 'Draft',
      sent: 'Sent',
      approved: 'Approved',
      paid: 'Paid',
      converted: 'Invoiced',
      overdue: 'Overdue'
    };
    const label = labelMap[status.toLowerCase()] || status;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold capitalize border ${style}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      <div className="pb-2 border-b border-zinc-100">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">Billing & Invoices</h1>
        <p className="text-zinc-455 text-xs mt-0.5">Track payments, send invoices, and update payment status.</p>
      </div>

      <AnimatePresence mode="popLayout">
        {approvedEstimates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="rounded-3xl border border-teal-200/80 bg-teal-50/10 shadow-sm overflow-hidden">
              <CardHeader className="p-6 pb-2 border-b border-teal-100/40">
                <CardTitle className="text-[#03423a] text-base font-semibold flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                  Approved Quotes
                </CardTitle>
                <CardDescription className="text-zinc-650 text-xs font-normal">These quotes have been approved and can now be turned into invoices.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {approvedEstimates.map(est => (
                  <div key={est.id} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-teal-100/50 shadow-sm hover:shadow-md transition-all">
                    <div>
                      <div className="font-semibold text-zinc-900 text-sm md:text-base">{est.clientName || "Unnamed Customer"}</div>
                      <div className="text-xs text-zinc-450 mt-0.5">Approved {format(new Date(est.approvedAt || est.updatedAt), 'MMM d, yyyy')}</div>
                    </div>
                    <div className="flex items-center gap-4.5 w-full md:w-auto justify-between md:justify-end">
                      <div className="font-bold text-[#03423a] tracking-tight text-sm md:text-base tabular-nums">
                        {formatCurrency(est.total, est.currency || profile?.defaultCurrency || 'ZAR')}
                      </div>
                      <Button 
                        size="sm" 
                        className="h-9 bg-primary hover:bg-[#03362f] text-white rounded-xl text-xs font-semibold px-4 cursor-pointer active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                        onClick={() => handleConvert(est)} 
                        loading={loading}
                      >
                        Generate Invoice
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice Directory */}
      <Card className="rounded-3xl border border-zinc-150 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)] overflow-hidden">
        <CardHeader className="p-6 border-b border-zinc-50 bg-zinc-50/15">
          <CardTitle className="text-lg font-semibold text-zinc-900">Saved Invoices</CardTitle>
          <CardDescription className="text-zinc-400 text-xs text-left">View, download, or mark invoices as paid.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<DollarSign className="w-8 h-8 text-zinc-350" />}
                title="No Invoices Found"
                description="Once a client approves a quote, you can turn it into an invoice here."
              />
            </div>
          ) : (
            <div className="w-full">
              {/* Mobile ledger cards */}
              <div className="md:hidden divide-y divide-zinc-100 p-4 space-y-4">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-4 bg-zinc-50/20 border border-zinc-100 rounded-2xl shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-zinc-900 text-sm">{inv.clientName || 'Custom Client'}</p>
                        <p className="text-[11px] font-mono text-zinc-400 font-bold mt-0.5">
                          #{inv.invoiceNumber || inv.id.substring(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-zinc-450 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-405" />
                          Due: {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {getStatusBadge(inv.status)}
                    </div>
                    <div className="flex justify-between items-center pt-3.5 border-t border-zinc-100">
                      <span className="font-bold text-zinc-850 text-sm tabular-nums">
                        {formatCurrency(inv.total || 0, inv.currency || profile?.defaultCurrency || 'ZAR')}
                      </span>
                      <div className="flex gap-1.5">
                        {inv.status === 'draft' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8.5 rounded-lg text-[11px] border-zinc-200 text-zinc-700 bg-white"
                            onClick={() => handleSendInvoice(inv)}
                            loading={generatingPdf === inv.id}
                          >
                            <Mail className="w-3.5 h-3.5 mr-1 text-zinc-450" /> Send
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8.5 w-8.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100"
                          onClick={() => handleDownloadPdf(inv)}
                          loading={generatingPdf === inv.id}
                          title="Download Invoice PDF"
                        >
                          {!generatingPdf && <Download className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50" onClick={() => handleShareInvoiceWhatsApp(inv)} disabled={generatingPdf === inv.id} title="Share via WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100" onClick={() => handlePrintInvoice(inv)} disabled={generatingPdf === inv.id} title="Print invoice">
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        {inv.status !== 'paid' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8.5 rounded-lg text-[11px] border-zinc-200 text-zinc-700 bg-white hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => handleMarkPaid(inv.id)}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop tabular view */}
              <table className="hidden md:table w-full text-sm text-left">
                <thead className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest bg-zinc-50/50 border-b border-zinc-100">
                  <tr>
                    <th className="px-6 py-3.5">Invoice #</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Due Date</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Amount</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50/40 transition-colors duration-150">
                      <td className="px-6 py-4 font-bold text-zinc-400 font-mono text-xs">
                        {inv.invoiceNumber || inv.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-900">
                        {inv.clientName || 'Unnamed Client'}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 text-xs">
                        {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-zinc-900 tabular-nums text-sm">
                        {formatCurrency(inv.total || 0, inv.currency || profile?.defaultCurrency || 'ZAR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {inv.status === 'draft' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8.5 rounded-lg border-zinc-200 font-semibold text-xs text-zinc-750 bg-white hover:bg-zinc-50 cursor-pointer"
                              onClick={() => handleSendInvoice(inv)}
                              loading={generatingPdf === inv.id}
                            >
                              <Mail className="w-3.5 h-3.5 mr-1 text-zinc-400" /> Send
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8.5 w-8.5 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-zinc-50 cursor-pointer"
                            onClick={() => handleDownloadPdf(inv)}
                            disabled={generatingPdf === inv.id}
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer" onClick={() => handleShareInvoiceWhatsApp(inv)} disabled={generatingPdf === inv.id} title="Share via WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-zinc-50 cursor-pointer" onClick={() => handlePrintInvoice(inv)} disabled={generatingPdf === inv.id} title="Print invoice">
                            <Printer className="w-4 h-4" />
                          </Button>
                          {inv.status !== 'paid' && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8.5 rounded-lg border-zinc-200 font-bold text-xs text-zinc-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer transition-all active:scale-95"
                              onClick={() => handleMarkPaid(inv.id)}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PDF Generation Popups */}
      {pdfProgress !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <Card className="w-80 rounded-3xl border border-zinc-100 shadow-2xl bg-white p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center text-primary shrink-0 animate-spin">
                <Loader2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Preparing PDF</h3>
                <p className="text-zinc-400 text-[11px]">Creating invoice PDF...</p>
              </div>
            </div>
            <div className="space-y-1.5 pt-1.5">
              <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${pdfProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-zinc-450 tracking-wider">
                <span>PROGRESS</span>
                <span>{pdfProgress}%</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
