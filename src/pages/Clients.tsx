import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, fromDbClient, fromDbQuote } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Users, Plus, Trash2, Edit, Mail, Phone, MapPin, Notebook, ArrowRight, Eye, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { motion, AnimatePresence } from 'motion/react';
import { formatZAR, statusBadgeStyles } from '../lib/theme';
import { Link } from 'react-router-dom';

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [clientStats, setClientStats] = useState<Record<string, { totalBilled: number; lastJobDate?: string }>>({});
  const [clientQuotes, setClientQuotes] = useState<Record<string, any[]>>({});
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    vatNumber: '',
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [{ data: clientData }, { data: quotesData }] = await Promise.all([
        supabase.from('clients').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }),
        supabase.from('quotes').select('*').eq('user_id', user.uid),
      ]);
      if (clientData) setClients(clientData.map(fromDbClient));

      if (quotesData) {
        const mapped = quotesData.map(fromDbQuote);
        const stats: Record<string, { totalBilled: number; lastJobDate?: string }> = {};
        const byClient: Record<string, any[]> = {};

        mapped.forEach((quote: any) => {
          const key = quote.clientId || quote.clientEmail || quote.clientName;
          if (!key) return;

          // Build quote history per client id (primary key), fallback to email/name
          const clientKey = quote.clientId || key;
          if (!byClient[clientKey]) byClient[clientKey] = [];
          byClient[clientKey].push(quote);

          if (['approved', 'converted', 'paid'].includes(quote.status)) {
            const current = stats[key] || { totalBilled: 0 };
            current.totalBilled += quote.total || 0;
            const jobDate = quote.approvedAt || quote.updatedAt || quote.createdAt;
            if (jobDate && (!current.lastJobDate || new Date(jobDate) > new Date(current.lastJobDate))) {
              current.lastJobDate = jobDate;
            }
            stats[key] = current;
          }
        });

        // Sort each client's quotes newest first
        Object.keys(byClient).forEach(k => {
          byClient[k].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        });

        setClientStats(stats);
        setClientQuotes(byClient);
      }
    };

    fetchData();

    const channel = supabase
      .channel('clients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients', filter: `user_id=eq.${user.uid}` },
        () => fetchData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleOpenDialog = (client?: any) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
        vatNumber: client.vatNumber || '',
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
        vatNumber: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const clientId = editingClient ? editingClient.id : uuidv4();

      const { error } = await supabase.from('clients').upsert({
        id: clientId,
        user_id: user.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        notes: formData.notes,
        vat_number: formData.vatNumber || null,
      });

      if (error) throw error;
      toast.success(`Client ${editingClient ? 'updated' : 'added'}`);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save client profile");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      toast.success("Client profile removed successfully");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete client record");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-zinc-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">Customer Directory</h1>
          <p className="text-zinc-500 text-xs mt-0.5 font-normal">Save customer details, installation addresses, and notes in one place.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 bg-primary hover:bg-[#03362f] text-white font-medium rounded-xl text-sm active:scale-95 transition-all shadow-sm">
              <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border border-zinc-100 p-6 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-zinc-900">
                {editingClient ? 'Edit Customer' : 'Add New Customer'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveClient} className="space-y-4 pt-4 text-left">
              <div className="space-y-1.5 animate-none">
                <Label htmlFor="name" className="text-xs text-zinc-500 font-medium">Customer Full Name (Required)</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Richard Hendricks"
                  className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-zinc-500 font-medium">Email Address</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="e.g. richard@piedpiper.com"
                  className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs text-zinc-500 font-medium">Phone Number</Label>
                <Input 
                  id="phone" 
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="e.g. +27 82 123 4567"
                  className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs text-zinc-500 font-medium">Installation Address</Label>
                <Textarea 
                  id="address" 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="e.g. 523 Palo Alto Road, California"
                  rows={2}
                  className="rounded-xl border-zinc-200 text-sm p-2.5 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vatNumber" className="text-xs text-zinc-500 font-medium">VAT Number (optional)</Label>
                <Input
                  id="vatNumber"
                  value={formData.vatNumber}
                  onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
                  placeholder="e.g. 4123456789"
                  className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs text-zinc-500 font-medium">Private Customer Notes</Label>
                <Textarea 
                  id="notes" 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="e.g. Gate passcode is #4010. Prefer weekend morning callbacks."
                  rows={2}
                  className="rounded-xl border-zinc-200 text-sm p-2.5 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="pt-2">
                <Button type="submit" className="w-full h-10.5 bg-primary hover:bg-[#03362f] text-white font-medium rounded-xl text-sm transition-all">
                  Save Customer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {clients.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={<Users className="w-8 h-8 text-zinc-400" />}
                title="No clients added yet"
                description="Add your customers to easily create quotes and invoices for them."
                action={{
                  label: "Add First Customer",
                  onClick: () => handleOpenDialog()
                }}
              />
            </div>
          ) : (
            clients.map(client => {
              const stats = clientStats[client.id] || clientStats[client.email] || clientStats[client.name] || { totalBilled: 0 };
              return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={client.id}
                className="group"
              >
                <Card className="rounded-3xl border border-zinc-200 bg-white hover:border-primary/50 hover:shadow-xl transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between">
                  <div className="p-6 pb-2">
                    <div className="flex justify-between items-start gap-4">
                      {/* Avatar Placeholder */}
                      <div className="h-11 w-11 rounded-full bg-teal-100/30 text-primary flex items-center justify-center font-bold text-sm tracking-tight border border-teal-100">
                        {client.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8.5 w-8.5 rounded-lg text-zinc-400 hover:text-primary hover:bg-teal-100/40 transition-colors" 
                          onClick={() => handleOpenDialog(client)}
                          title="Edit Customer Profile"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8.5 w-8.5 rounded-lg text-zinc-400 hover:text-red-700 hover:bg-red-50 transition-colors" 
                          onClick={() => setDeleteId(client.id)}
                          title="Remove Client"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-0.5">
                      <h3 className="font-semibold text-zinc-900 text-lg group-hover:text-primary transition-colors line-clamp-1">{client.name}</h3>
                      <p className="text-[11px] font-semibold text-zinc-400 tracking-wider">CUSTOMER PROFILE</p>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-b border-zinc-50 bg-zinc-50/10 space-y-3 flex-grow">
                    {client.email && (
                      <div className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
                        <Mail className="w-4 h-4 text-zinc-400 stroke-[1.5]" />
                        <a href={`mailto:${client.email}`} className="truncate font-medium">{client.email}</a>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
                        <Phone className="w-4 h-4 text-zinc-400 stroke-[1.5]" />
                        <a href={`tel:${client.phone}`} className="font-medium tracking-tight">{client.phone}</a>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-100 bg-white p-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total billed</p>
                        <p className="text-sm font-semibold text-zinc-900">{formatZAR(stats.totalBilled)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Last job</p>
                        <p className="text-sm font-semibold text-zinc-900">{stats.lastJobDate ? new Date(stats.lastJobDate).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                    {client.address && (
                      <div className="flex items-start gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors border-t border-zinc-100/50 pt-2 pb-0.5">
                        <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5 stroke-[1.5]" />
                        <span className="line-clamp-2 leading-relaxed text-xs">{client.address}</span>
                      </div>
                    )}
                  </div>

                  {client.notes ? (
                    <div className="px-6 py-4 flex items-start gap-2 bg-zinc-50/35 border-b border-zinc-100/50">
                      <Notebook className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0 stroke-[1.5]" />
                      <p className="text-zinc-400 italic text-[11px] line-clamp-2 leading-relaxed">"{client.notes}"</p>
                    </div>
                  ) : (
                    <div className="min-h-[10px]" />
                  )}

                  {(() => {
                    const quotes = clientQuotes[client.id] || clientQuotes[client.email] || clientQuotes[client.name] || [];
                    const isExpanded = expandedQuotes[client.id];
                    const shown = isExpanded ? quotes : quotes.slice(0, 2);
                    if (quotes.length === 0) return null;
                    const statusLabel: Record<string, string> = { draft: 'Draft', sent: 'Sent', approved: 'Approved', converted: 'Invoiced', paid: 'Paid', rejected: 'Declined', expired: 'Expired', overdue: 'Overdue' };
                    const statusStyle: Record<string, string> = { approved: 'bg-emerald-50 text-emerald-700', converted: 'bg-purple-50 text-purple-700', paid: 'bg-emerald-100 text-emerald-800', sent: 'bg-blue-50 text-blue-700', draft: 'bg-zinc-100 text-zinc-500', rejected: 'bg-red-50 text-red-700', expired: 'bg-red-50 text-red-600', overdue: 'bg-amber-50 text-amber-700' };
                    return (
                      <div className="border-t border-zinc-100 px-6 py-4 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Quote History ({quotes.length})
                          </p>
                          {quotes.length > 2 && (
                            <button onClick={() => setExpandedQuotes(prev => ({ ...prev, [client.id]: !isExpanded }))} className="text-[10px] text-primary font-semibold flex items-center gap-0.5">
                              {isExpanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />+{quotes.length - 2} more</>}
                            </button>
                          )}
                        </div>
                        {shown.map((q: any) => (
                          <Link key={q.id} to={`/quotes/${q.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-zinc-50 transition-colors gap-2 group">
                            <span className="text-xs text-zinc-700 font-medium truncate group-hover:text-primary transition-colors">{q.clientName || 'Quote'}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusStyle[q.status] || 'bg-zinc-100 text-zinc-500'}`}>{statusLabel[q.status] || q.status}</span>
                              <span className="text-xs font-semibold text-zinc-800 tabular-nums">{formatZAR(q.total || 0)}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="p-6 pt-0">
                    <Button
                      variant="outline"
                      onClick={() => handleOpenDialog(client)}
                      className="w-full text-zinc-700 hover:text-zinc-900 border-zinc-200 h-9.5 rounded-xl text-xs font-semibold hover:bg-zinc-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Edit Details
                    </Button>
                  </div>
                </Card>
              </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Customer Profile"
        description="Are you sure you want to permanently delete this customer profile? You will not be able to auto-fill their info on future quotes."
        confirmLabel="Delete Permanently"
        cancelLabel="Keep Record"
        isDangerous={true}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </motion.div>
  );
}
