import React from 'react';
import { Input } from './input';
import { sanitizeNumericInput } from '../../lib/calculations';

export interface NumericInputProps extends Omit<React.ComponentProps<typeof Input>, 'type' | 'inputMode' | 'value' | 'onChange'> {
  value: number | string;
  onValueChange: (value: string) => void;
}

/**
 * Text-backed decimal input for editable money/quantity fields.
 *
 * Keeping decimal fields as text while the user edits preserves partial values
 * such as an empty string or trailing decimal, while the shared sanitizer keeps
 * quote, expense, and tax-rate inputs consistent.
 */
export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onValueChange, ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(event) => {
        const sanitizedValue = sanitizeNumericInput(event.target.value);
        if (event.target.value === '' || sanitizedValue !== '') {
          onValueChange(sanitizedValue);
        }
      }}
      {...props}
    />
  ),
);

NumericInput.displayName = 'NumericInput';
