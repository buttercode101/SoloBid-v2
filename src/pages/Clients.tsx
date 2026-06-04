import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Plus, Trash2, Edit, Mail, Phone, MapPin } from 'lucide-react';
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

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'clients'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
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
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const clientId = editingClient ? editingClient.id : uuidv4();
      const clientData = {
        id: clientId,
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        notes: formData.notes,
        updatedAt: new Date().toISOString(),
        ...(editingClient ? {} : { createdAt: new Date().toISOString() })
      };

      await setDoc(doc(db, 'clients', clientId), clientData, { merge: true });
      toast.success(`Client ${editingClient ? 'updated' : 'added'}`);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save client");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clients', id));
      toast.success("Client deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete client");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-zinc-500">Manage your client contact information.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? 'Edit Client' : 'New Client'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveClient} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name *</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea 
                  id="address" 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea 
                  id="notes" 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full">Save Client</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="No clients yet"
              description="Start by adding your first client to speed up quotes and invoicing."
              action={{
                label: "Add Your First Client",
                onClick: () => handleOpenDialog()
              }}
            />
          </div>
        ) : (
          clients.map(client => (
            <Card key={client.id} className="hover:shadow-md transition-shadow relative group">
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-blue-600" onClick={() => handleOpenDialog(client)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-600" onClick={() => setDeleteId(client.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 pr-16">
                  <Users className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="truncate">{client.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mt-2">
                  {client.email && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                      <Mail className="w-3 h-3 text-zinc-400" />
                      <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                      <Phone className="w-3 h-3 text-zinc-400" />
                      <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
                    </div>
                  )}
                  {client.address && (
                    <div className="flex items-start gap-2 text-sm text-zinc-600">
                      <MapPin className="w-3 h-3 text-zinc-400 mt-0.5" />
                      <span className="line-clamp-2">{client.address}</span>
                    </div>
                  )}
                  {client.notes && (
                    <div className="mt-4 pt-4 border-t text-sm text-zinc-500 italic line-clamp-3">
                      "{client.notes}"
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Client?"
        description="Are you sure you want to delete this client? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
