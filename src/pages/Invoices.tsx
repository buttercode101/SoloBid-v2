import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase, fromDbInvoice, fromDbQuote, fromDbLineItem } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from '../components/InvoicePDF';
import { Download, DollarSign, ArrowRight, Loader2, Landmark, CheckCircle, Clock, MessageCircle, Printer, CreditCard, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { initializePaystackPayment, generatePaymentReference } from '../lib/paystack';
import { motion, AnimatePresence } from 'motion/react';
import { getCurrencySymbol } from '../lib/currencies';
import { EmptyState } from '../components/EmptyState';
import { formatZAR, statusBadgeStyles } from '../lib/theme';
import { sharePdfViaWhatsApp } from '../lib/documentActions';
import { AttachmentUploader, type Attachment } from '../components/AttachmentUploader';

export default function Invoices() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [approvedEstimates, setApprovedEstimates] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<number | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [invoiceAttachments, setInvoiceAttachments] = useState<Record<string, Attachment[]>>({});

  const formatCurrency = (amount: number, curr: string) => {
    if (curr === 'ZAR') {
      return formatZAR(amount);
    }
    return `${getCurrencySymbol(curr)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      const [{ data: invData }, { data: quoteData }] = await Promise.all([
        supabase.from('invoices').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }),
        supabase.from('quotes').select('*').eq('user_id', user.uid).eq('status', 'approved'),
      ]);
      setInvoices((invData || []).map(fromDbInvoice));
      setApprovedEstimates((quoteData || []).map(fromDbQuote));
      setInitialLoading(false);
    };

    fetchAll();

    const invChannel = supabase
      .channel(`invoices-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.uid}` }, fetchAll)
      .subscribe();

    const quotesChannel = supabase
      .channel(`invoices-quotes-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `user_id=eq.${user.uid}` }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(invChannel);
      supabase.removeChannel(quotesChannel);
    };
  }, [user]);

  const handleConvert = async (estimate: any) => {
    try {
      if (!user?.uid) throw new Error("Authentication required");
      setLoading(true);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const { data: invoiceId, error } = await supabase.rpc('convert_quote_to_invoice', {
        p_quote_id: estimate.id,
        p_due_date: dueDate.toISOString(),
      });
      if (error) throw new Error(error.message);
      toast.success('Invoice created successfully');
    } catch (error: any) {
      console.error("Invoice conversion error:", error);
      toast.error(error.message || "Failed to create invoice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchQuoteAndLineItems = async (quoteId: string) => {
    const [{ data: quoteRow }, { data: itemRows }] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', quoteId).single(),
      supabase.from('line_items').select('*').eq('quote_id', quoteId).order('sort_order', { ascending: true }),
    ]);
    return {
      estimate: quoteRow ? fromDbQuote(quoteRow) : null,
      lineItems: (itemRows || []).map(fromDbLineItem),
    };
  };

  const handleDownloadPdf = async (invoice: any) => {
    try {
      setPdfProgress(0);
      setGeneratingPdf(invoice.id);
      setPdfProgress(20);
      const { estimate, lineItems } = await fetchQuoteAndLineItems(invoice.quoteId || invoice.estimateId);
      setPdfProgress(60);
      const blob = await pdf(
        <InvoicePDF invoice={invoice} estimate={estimate} contractor={profile} lineItems={lineItems} />
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
    const { estimate, lineItems } = await fetchQuoteAndLineItems(invoice.quoteId || invoice.estimateId);
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

  const handlePayNow = async (inv: any) => {
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      toast.error('Paystack is not configured. Add VITE_PAYSTACK_PUBLIC_KEY to your environment.');
      return;
    }
    const email = inv.clientEmail;
    if (!email) {
      toast.error('No client email on this invoice. Cannot initiate payment.');
      return;
    }
    const reference = generatePaymentReference(inv.invoiceNumber || inv.id.substring(0, 8).toUpperCase());
    try {
      await initializePaystackPayment({
        email,
        amountZAR: inv.total || 0,
        reference,
        invoiceId: inv.id,
        publicKey,
        onSuccess: async (ref) => {
          try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const resp = await fetch(`/api/invoices/${inv.id}/mark-paid`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ reference: ref }),
            });
            if (!resp.ok) throw new Error('Server error');
            toast.success('Payment recorded!');
          } catch {
            toast.error('Payment succeeded but failed to update invoice. Please refresh.');
          }
        },
        onClose: () => {
          toast.info('Payment cancelled.');
        },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize payment');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId);
      toast.success("Invoice record updated to PAID");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleToggleAttachments = async (invoiceId: string) => {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null);
      return;
    }
    setExpandedInvoiceId(invoiceId);
    if (!invoiceAttachments[invoiceId]) {
      const { data: rows } = await supabase.from('quote_attachments').select('*').eq('invoice_id', invoiceId);
      const mapped: Attachment[] = (rows || []).map((r: any) => ({
        id: r.id,
        fileName: r.file_name,
        filePath: r.file_path,
        fileType: r.file_type,
        fileSize: r.file_size,
        url: supabase.storage.from('quote-attachments').getPublicUrl(r.file_path).data.publicUrl,
      }));
      setInvoiceAttachments(prev => ({ ...prev, [invoiceId]: mapped }));
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
                title="No invoices yet"
                description="Create your first invoice by converting an approved quote, or start by creating a new quote."
                action={{
                  label: 'Create Quote',
                  onClick: () => navigate('/quotes/new')
                }}
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
                      <div className="flex items-center gap-2">
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <Button
                            size="sm"
                            className="h-8 rounded-lg text-[11px] bg-primary text-white hover:bg-[#03362f] flex items-center gap-1 px-3"
                            onClick={() => handlePayNow(inv)}
                          >
                            <CreditCard className="w-3 h-3" />
                            Pay Now
                          </Button>
                        )}
                        {inv.status !== 'paid' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-[11px] border-zinc-200 text-zinc-700 bg-white hover:bg-emerald-50 hover:text-emerald-700 px-3"
                            onClick={() => handleMarkPaid(inv.id)}
                          >
                            Mark Paid
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg border-zinc-200 text-zinc-500" disabled={generatingPdf === inv.id}>
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleDownloadPdf(inv)}>
                              <Download className="w-3.5 h-3.5 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleShareInvoiceWhatsApp(inv)}>
                              <MessageCircle className="w-3.5 h-3.5 mr-2 text-[#25D366]" />
                              Share via WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintInvoice(inv)}>
                              <Printer className="w-3.5 h-3.5 mr-2" />
                              Print
                            </DropdownMenuItem>
                            {inv.status !== 'paid' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleMarkPaid(inv.id)}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                  Mark as Paid
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  {user && (
                    <div className="pt-3 border-t border-zinc-100 mt-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline mb-2 flex items-center gap-1"
                        onClick={() => handleToggleAttachments(inv.id)}
                      >
                        {expandedInvoiceId === inv.id ? "Hide Attachments" : "Site Photos \& Attachments"}
                      </button>
                      {expandedInvoiceId === inv.id && (
                        <AttachmentUploader
                          invoiceId={inv.id}
                          userId={user.uid}
                          attachments={invoiceAttachments[inv.id] || []}
                          onAttachmentsChange={(atts) => setInvoiceAttachments(prev => ({ ...prev, [inv.id]: atts }))}
                        />
                      )}
                    </div>
                  )}
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
                          {(inv.status === 'sent' || inv.status === 'overdue') && (
                            <Button
                              size="sm"
                              className="h-8.5 rounded-lg font-bold text-xs bg-primary text-white hover:bg-[#03362f] cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                              onClick={() => handlePayNow(inv)}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Pay Now
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
