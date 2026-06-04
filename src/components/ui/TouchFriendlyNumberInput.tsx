import React, { InputHTMLAttributes } from 'react';
import { Input } from './input';
import { Minus, Plus } from 'lucide-react';

export function TouchFriendlyNumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <button 
          type="button"
          onClick={() => {
            const current = parseFloat(props.value?.toString() || '0');
            const newVal = Math.max((props.min ? parseFloat(props.min.toString()) : 0), current - (parseFloat(props.step?.toString() || '1')));
            props.onChange?.({ target: { value: newVal.toString() } } as any);
          }}
          className="p-2 hover:bg-zinc-100 rounded text-zinc-600"
        >
          <Minus className="w-5 h-5" />
        </button>
        
        <Input 
          {...props}
          className={`text-center h-12 md:h-10 text-lg md:text-sm flex-1 ${props.className || ''}`}
        />
        
        <button 
          type="button"
          onClick={() => {
            const current = parseFloat(props.value?.toString() || '0');
            const newVal = current + (parseFloat(props.step?.toString() || '1'));
            props.onChange?.({ target: { value: newVal.toString() } } as any);
          }}
          className="p-2 hover:bg-zinc-100 rounded text-zinc-600"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
