import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RefreshCw, Plus, Trash2, Edit, Play, Pause, CalendarClock } from 'lucide-react';
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
import { format } from 'date-fns';
import { getCurrencySymbol } from '../lib/currencies';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';

export default function RecurringInvoices() {
  const { user } = useAuth();
  const [recurring, setRecurring] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    clientId: '',
    templateId: '',
    frequency: 'monthly',
    nextIssueDate: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (!user) return;

    // Load recurring invoices
    const q = query(
      collection(db, 'recurringInvoices'),
      where('uid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecurring(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Load clients
    getDocs(query(collection(db, 'clients'), where('uid', '==', user.uid))).then(snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Load templates
    getDocs(query(collection(db, 'templates'), where('uid', '==', user.uid))).then(snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const client = clients.find(c => c.id === formData.clientId);
      const template = templates.find(t => t.id === formData.templateId);
      
      if (!client || !template) {
        toast.error("Please select a client and a template");
        return;
      }

      const recurringId = uuidv4();
      
      // Calculate total from template line items
      const total = template.lineItems.reduce((sum: number, item: any) => {
        const baseCost = item.qty * item.unitCost;
        const markup = item.type === 'material' ? baseCost * (item.markupPercent / 100) : 0;
        return sum + baseCost + markup;
      }, 0);

      const recurringData = {
        id: recurringId,
        uid: user.uid,
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.email || '',
        frequency: formData.frequency,
        nextIssueDate: formData.nextIssueDate,
        status: 'active',
        total: total,
        currency: template.currency || 'ZAR',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'recurringInvoices', recurringId), recurringData);
      
      // Copy line items
      const itemsRef = collection(db, 'recurringInvoices', recurringId, 'lineItems');
      for (const item of template.lineItems || []) {
        const newItem = { ...item, id: uuidv4() };
        await setDoc(doc(itemsRef, newItem.id), newItem);
      }

      toast.success("Recurring invoice schedule created");
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save recurring invoice");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recurringInvoices', id));
      toast.success("Recurring schedule deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const toggleStatus = async (item: any) => {
    try {
      const newStatus = item.status === 'active' ? 'paused' : 'active';
      await setDoc(doc(db, 'recurringInvoices', item.id), { status: newStatus }, { merge: true });
      toast.success(`Schedule ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Invoices</h1>
          <p className="text-zinc-500">Automate your billing for ongoing services.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Recurring Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveRecurring} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <select 
                  id="client"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.clientId}
                  onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                  required
                  aria-label="Select client"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template">Template *</Label>
                <select 
                  id="template"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.templateId}
                  onChange={(e) => setFormData({...formData, templateId: e.target.value})}
                  required
                >
                  <option value="">Select a template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500">The template's line items will be used for each generated invoice.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <select 
                  id="frequency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.frequency}
                  onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextIssueDate">First Issue Date *</Label>
                <Input 
                  id="nextIssueDate" 
                  type="date"
                  value={formData.nextIssueDate}
                  onChange={(e) => setFormData({...formData, nextIssueDate: e.target.value})}
                  required 
                />
              </div>
              
              <Button type="submit" className="w-full">Create Schedule</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {recurring.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="w-8 h-8" />}
              title="No schedules active"
              description="Automate your billing by creating a recurring schedule. Perfect for retainers and subscriptions."
              action={{
                label: "Create Schedule",
                onClick: () => setIsDialogOpen(true)
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-500 uppercase bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-md">Client</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Next Issue</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right rounded-tr-md">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {item.clientName}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {item.frequency}
                      </td>
                      <td className="px-4 py-3">
                        {item.nextIssueDate ? format(new Date(item.nextIssueDate), 'MMM d, yyyy') : 'No date set'}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {getCurrencySymbol(item.currency || 'ZAR')}{(item.total || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                          ${item.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-800'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => toggleStatus(item)}
                            title={item.status === 'active' ? 'Pause' : 'Resume'}
                          >
                            {item.status === 'active' ? <Pause className="w-4 h-4 text-zinc-500" /> : <Play className="w-4 h-4 text-green-600" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setDeleteId(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Schedule?"
        description="Are you sure you want to delete this recurring schedule? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
