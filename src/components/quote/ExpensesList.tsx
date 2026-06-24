import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { NumericInput } from '../ui/numeric-input';
import { Label } from '../ui/label';
import { Plus, Trash2, ImagePlus } from 'lucide-react';
import { getCurrencySymbol } from '../../lib/currencies';

import type { EditableExpense } from '../../types';

interface Props {
  expenses: EditableExpense[];
  currency: string;
  addExpense: () => void;
  updateExpense: (id: string, field: string, value: string) => void;
  removeExpense: (id: string) => void;
  handleExpensePhotoUpload: (id: string, file: File) => void;
}

export function ExpensesList({
  expenses, currency, addExpense, updateExpense, removeExpense, handleExpensePhotoUpload,
}: Props) {
  return (
    <Card className="rounded-3xl border border-zinc-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
      <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-50 p-6">
        <div>
          <CardTitle className="text-lg font-semibold text-zinc-900">3. Material Costs &amp; Expenses</CardTitle>
          <CardDescription className="text-zinc-400 text-xs">Add receipts and track how much was spent on materials.</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={addExpense}
          className="h-8.5 rounded-lg border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5 text-primary stroke-[2.5]" /> Add Expense
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 p-6 bg-white">
        <AnimatePresence mode="popLayout">
          {expenses.map((expense) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={expense.id}
              className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4.5 border border-zinc-200 bg-zinc-50/30 rounded-2xl hover:bg-white hover:border-zinc-200 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex-1 w-full space-y-1.5">
                <Label className="text-xs text-zinc-500 font-medium">Item Name / Description</Label>
                <Input
                  value={expense.description}
                  onChange={e => updateExpense(expense.id, 'description', e.target.value)}
                  placeholder="e.g. Copper pipes and brass joints"
                  className="h-9.5 rounded-xl border-zinc-200 focus:ring-primary focus:border-primary shadow-sm"
                />
              </div>
              <div className="w-full md:w-32 space-y-1.5">
                <Label className="text-xs text-zinc-500 font-medium">Cost ({getCurrencySymbol(currency)})</Label>
                <NumericInput
                  value={expense.amount}
                  className="h-9.5 rounded-xl border-zinc-200 text-zinc-800"
                  onValueChange={value => updateExpense(expense.id, 'amount', value)}
                />
              </div>
              <div className="pt-2 md:pt-6 flex gap-2 w-full md:w-auto shrink-0 self-end md:self-auto justify-end">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleExpensePhotoUpload(expense.id, e.target.files[0]);
                      }
                    }}
                    title="Upload receipt photo"
                  />
                  <Button
                    type="button"
                    variant={expense.receiptUrl ? 'default' : 'outline'}
                    size="icon"
                    className={`h-9.5 w-9.5 rounded-xl border-zinc-200 hover:scale-95 ${expense.receiptUrl ? 'bg-emerald-800 hover:bg-emerald-900 text-white border-none shadow-sm shadow-emerald-950/20' : 'bg-white hover:bg-zinc-50'}`}
                    title={expense.receiptUrl ? 'Receipt photo saved' : 'Store receipt photo'}
                  >
                    <ImagePlus className="w-4.5 h-4.5" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9.5 w-9.5 rounded-xl text-zinc-400 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeExpense(expense.id)}
                  aria-label="Remove expense"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {expenses.length === 0 && (
          <div className="text-center py-10 text-zinc-400 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/10">
            <span className="block text-xs text-zinc-400">No expenses added yet.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
