import React from 'react';
import { FormField } from './FormField.jsx';
import { cn } from '../../lib/utils.js';
import { Textarea as ShadcnTextarea } from '../shadcn/textarea.jsx';

export function Textarea({ label, help, error, wide = true, className = '', ...props }) {
  const generatedId = React.useId();
  const id = props.id || props.name || generatedId;

  return (
    <FormField label={label} help={help} error={error} wide={wide} htmlFor={id}>
      <ShadcnTextarea id={id} className={cn('app-textarea', className)} {...props} />
    </FormField>
  );
}
