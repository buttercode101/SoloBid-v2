import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { FileText, Plus, Trash2, Edit, Loader2, Sparkles, ClipboardCopy, ChevronRight, Layers } from 'lucide-react';
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
          { id: uuidv4(), description: 'Standard Labor Rate', qty: 1, unitCost: profile?.defaultLaborRate || 750, type: 'labor', markupPercent: 0 },
          { id: uuidv4(), description: 'Required Project Materials', qty: 1, unitCost: 1500, type: 'material', markupPercent: profile?.defaultMarkup || 15 }
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
      
      const itemsRef = collection(db, 'quotes', quoteId, 'lineItems');
      for (const item of template.lineItems || []) {
        const newItem = { ...item, id: uuidv4() };
        await setDoc(doc(itemsRef, newItem.id), newItem);
      }

      toast.success("Created new quote draft from current template layout");
      navigate(`/quotes/${quoteId}`);
    } catch (error) {
      toast.error("Failed to compile layout from template");
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
          description: 'Standard diagnostic session and common repair call-out package.',
          lineItems: [
            { id: uuidv4(), description: 'Diagnostic & Trip Call Fee', qty: 1, unitCost: 450, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Specialist Work-Hours', qty: 1.5, unitCost: profile?.defaultLaborRate || 650, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Consumables & Hardware Fittings', qty: 1, unitCost: 320, type: 'material', markupPercent: profile?.defaultMarkup || 15 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          uid: user.uid,
          name: 'Premium Renovation Bid',
          description: 'Structured layout plan for comprehensive renovation detailing materials, and extensive hours.',
          lineItems: [
            { id: uuidv4(), description: 'Interior Layout Planning & Measurements', qty: 1, unitCost: 1500, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Primary Artisan Refined Labor Hours', qty: 32, unitCost: profile?.defaultLaborRate || 550, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Raw Supplies & Decorative Panel Materials', qty: 1, unitCost: 8500, type: 'material', markupPercent: profile?.defaultMarkup || 15 },
            { id: uuidv4(), description: 'Debris Disposal & Cleanup Surcharge', qty: 1, unitCost: 1200, type: 'labor', markupPercent: 0 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: uuidv4(),
          uid: user.uid,
          name: 'Fixed Monthly Retainer',
          description: 'Contractor recurring retainer for technical and priority upkeep services.',
          lineItems: [
            { id: uuidv4(), description: 'Upkeep Priority SLA Retainer Fee', qty: 1, unitCost: 3500, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Scheduled Inspection Hours Accrued', qty: 4, unitCost: 0, type: 'labor', markupPercent: 0 },
            { id: uuidv4(), description: 'Necessary Filter/Material Replacements', qty: 1, unitCost: 450, type: 'material', markupPercent: profile?.defaultMarkup || 10 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      for (const template of starterTemplates) {
        await setDoc(doc(db, 'templates', template.id), template);
      }
      toast.success("Premium starter templates loaded successfully");
    } catch (error) {
      toast.error("Failed to seed premium starter templates");
    } finally {
      setIsLoadingStarters(false);
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
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">Bid Templates</h1>
          <p className="text-zinc-455 text-xs mt-0.5">Save templates of your services to create and send quotes in under 30 seconds.</p>
        </div>
        
        <div className="flex gap-2.5">
          {templates.length > 0 && templates.length < 5 && (
            <Button 
              variant="outline" 
              onClick={loadStarterTemplates} 
              disabled={isLoadingStarters} 
              className="h-10 rounded-xl border-zinc-200/80 bg-white hover:bg-zinc-50 font-medium text-zinc-700 text-sm active:scale-95 transition-all shadow-sm"
            >
              {isLoadingStarters ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardCopy className="w-4 h-4 mr-2 text-zinc-400" />}
              Import Starters
            </Button>
          )}
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 bg-primary hover:bg-[#03362f] text-white font-medium rounded-xl text-sm active:scale-95 transition-all shadow-sm">
                <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" /> Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl border border-zinc-100 max-w-md p-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-zinc-900">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveTemplate} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs text-zinc-500 font-medium">Template Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Standard Service Template"
                    className="h-10 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs text-zinc-500 font-medium">Description or Notes (Optional)</Label>
                  <Textarea 
                    id="description" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="e.g. Standard labor rate and material costs..."
                    rows={3}
                    className="rounded-xl border-zinc-250 text-sm p-2.5 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="pt-2">
                  <Button type="submit" className="w-full h-10.5 bg-primary hover:bg-[#03362f] text-white font-medium rounded-xl text-sm transition-all">
                    Save Template
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {templates.map(template => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={template.id}
              className="group"
            >
              <Card className="rounded-3xl border border-zinc-150 bg-white hover:border-primary/50 hover:shadow-xl transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between">
                <div className="p-6 pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-teal-100/30 flex items-center justify-center text-primary shrink-0">
                      <FileText className="w-5 h-5 stroke-[2]" />
                    </div>
                    
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8.5 w-8.5 rounded-lg text-zinc-400 hover:text-primary hover:bg-teal-100/40 transition-colors" 
                        onClick={() => handleOpenDialog(template)}
                        title="Edit Template Properties"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8.5 w-8.5 rounded-lg text-zinc-400 hover:text-red-650 hover:bg-red-50 transition-colors" 
                        onClick={() => setDeleteId(template.id)}
                        title="Delete Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-1">
                    <h3 className="font-semibold text-zinc-900 text-lg group-hover:text-primary transition-colors line-clamp-1">{template.name}</h3>
                    <p className="text-zinc-455 text-xs line-clamp-2 min-h-[32px] leading-relaxed">{template.description || "No notes added for this template."}</p>
                  </div>
                </div>

                <div className="px-6 py-4">
                  <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-50 pb-2 mb-3">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      Included Items
                    </span>
                    <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full text-[10px]">{template.lineItems?.length || 0} items</span>
                  </div>
                  
                  <div className="space-y-2.5 min-h-[85px] max-h-[140px] overflow-hidden relative">
                    {template.lineItems?.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm text-zinc-700">
                        <span className="truncate max-w-[180px] font-medium text-zinc-850">↳ {item.description}</span>
                        <span className="text-xs text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-md border border-zinc-100">{item.type}</span>
                      </div>
                    ))}
                    {template.lineItems?.length > 3 && (
                      <div className="text-[11px] font-semibold text-primary italic pt-1.5">
                        + {template.lineItems.length - 3} more items
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2">
                  <Button 
                    className="w-full h-10 bg-zinc-900 hover:bg-primary text-white font-semibold rounded-xl text-xs transition-all active:scale-[0.985]" 
                    onClick={() => handleUseTemplate(template)}
                  >
                    Use Template
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {templates.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={<FileText className="w-8 h-8 text-zinc-350" />}
              title="No templates saved yet"
              description="Create your own templates or load our starter templates to create quotes faster."
              action={{
                label: isLoadingStarters ? "Loading..." : "Load Starter Templates",
                onClick: loadStarterTemplates
              }}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Template"
        description="Are you sure you want to permanently delete this template? This cannot be undone."
        confirmLabel="Delete Permanently"
        cancelLabel="Keep It"
        isDangerous={true}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </motion.div>
  );
}
