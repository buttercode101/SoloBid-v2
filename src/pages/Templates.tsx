import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { FileText, Plus, Trash2, Edit, Loader2 } from 'lucide-react';
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

export default function Templates() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isLoadingStarters, setIsLoadingStarters] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'templates'),
      where('uid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [user]);

  const handleOpenDialog = (template?: any) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const templateId = editingTemplate ? editingTemplate.id : uuidv4();
      const templateData = {
        id: templateId,
        uid: user.uid,
        name: formData.name,
        description: formData.description,
        lineItems: editingTemplate ? editingTemplate.lineItems : [
          { id: uuidv4(), description: 'Sample Labor', qty: 1, unitCost: profile?.defaultLaborRate || 75, type: 'labor', markupPercent: 0 },
          { id: uuidv4(), description: 'Sample Material', qty: 1, unitCost: 100, type: 'material', markupPercent: profile?.defaultMarkup || 20 }
        ],
        updatedAt: new Date().toISOString(),
        ...(editingTemplate ? {} : { createdAt: new Date().toISOString() })
      };

      await setDoc(doc(db, 'templates', templateId), templateData, { merge: true });
      toast.success(`Template ${editingTemplate ? 'updated' : 'created'}`);
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save template");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'templates', id));
      toast.success("Template deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleUseTemplate = async (template: any) => {
    try {
      const quoteId = uuidv4();
      
      let subtotal = 0;
      for (const item of template.lineItems || []) {
        const baseCost = (item.qty || 1) * (item.unitCost || 0);
        const markup = baseCost * ((item.markupPercent || 0) / 100);
        subtotal += baseCost + markup;
      }
      
      const taxRate = profile?.defaultTaxRate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      
      const quoteData = {
        uid: user!.uid,
        clientName: '',
        clientEmail: '',
        notes: template.description || '',
        taxRate,
        subtotal,
        taxAmount,
        total,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'quotes', quoteId), quoteData);
      
      // Copy line items
      const itemsRef = collection(db, 'quotes', quoteId, 'lineItems');
      for (const item of template.lineItems || []) {
        const newItem = { ...item, id: uuidv4() };
        await setDoc(doc(itemsRef, newItem.id), newItem);
      }

      toast.success("Created new quote from template");
      navigate(`/quotes/${quoteId}`);
    } catch (error) {
      toast.error("Failed to use template");
    }
  };

  const loadStarterTemplates = async () => {
    if (!user) return;
    setIsLoadingStarters(true);
    try {
      const starterTemplates = [
        {
          id: uuidv4(),
          uid: user.uid,
          name: 'Basic Service Call',
          description: 'Standard diagnostic and service call.',
          lineItems: [
            { id: uuidv4(), description: 'Service Call Fee', qty: 1, unitCost: 150, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Standard Labor', qty: 1, unitCost: profile?.defaultLaborRate || 85, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Miscellaneous Materials', qty: 1, unitCost: 50, type: 'material', markupPercent: profile?.defaultMarkup || 20 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          uid: user.uid,
          name: 'Standard Project Proposal',
          description: 'Comprehensive project quote including planning, labor, and materials.',
          lineItems: [
            { id: uuidv4(), description: 'Project Planning & Design', qty: 1, unitCost: 500, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'General Labor', qty: 40, unitCost: profile?.defaultLaborRate || 75, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Project Materials', qty: 1, unitCost: 1500, type: 'material', markupPercent: profile?.defaultMarkup || 15 },
            { id: uuidv4(), description: 'Project Management', qty: 1, unitCost: 300, type: 'labor', markupPercent: 0 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          uid: user.uid,
          name: 'Monthly Retainer',
          description: 'Recurring monthly service agreement.',
          lineItems: [
            { id: uuidv4(), description: 'Monthly Retainer Fee', qty: 1, unitCost: 1000, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Priority Support Hours', qty: 5, unitCost: 0, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Software/Hosting Subscriptions', qty: 1, unitCost: 150, type: 'material', markupPercent: profile?.defaultMarkup || 10 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const template of starterTemplates) {
        await setDoc(doc(db, 'templates', template.id), template);
      }
      toast.success("Starter templates loaded successfully");
    } catch (error) {
      toast.error("Failed to load starter templates");
    } finally {
      setIsLoadingStarters(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-zinc-500">Manage your reusable quote templates.</p>
        </div>
        
        <div className="flex gap-2">
          {templates.length > 0 && templates.length < 5 && (
            <Button variant="outline" onClick={loadStarterTemplates} disabled={isLoadingStarters} className="flex">
              {isLoadingStarters ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Load Starters
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" /> Create Template
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveTemplate} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea 
                  id="description" 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full">Save Template</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <Card key={template.id} className="hover:shadow-md transition-shadow relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-blue-600" onClick={() => handleOpenDialog(template)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-600" onClick={() => setDeleteId(template.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 pr-16">
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="truncate">{template.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-500 mb-4 line-clamp-2 min-h-[40px]">{template.description}</p>
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                {template.lineItems?.length || 0} Line Items
              </div>
              <div className="space-y-1 min-h-[60px]">
                {template.lineItems?.slice(0, 3).map((item: any, i: number) => (
                  <div key={i} className="text-sm truncate text-zinc-700">
                    • {item.description}
                  </div>
                ))}
                {template.lineItems?.length > 3 && (
                  <div className="text-sm text-zinc-400 italic">
                    + {template.lineItems.length - 3} more items
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button className="w-full" onClick={() => handleUseTemplate(template)}>
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title="No templates found."
              description="Create a template or load our ready-to-use starter templates to quickly build quotes."
              action={{
                label: isLoadingStarters ? "Loading..." : "Load 3 Starter Templates",
                onClick: loadStarterTemplates
              }}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Template?"
        description="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
