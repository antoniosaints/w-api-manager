import React from 'react';
import { FormField } from './FormField.jsx';
import { cn } from '../../lib/utils.js';
import { Input as ShadcnInput } from '../shadcn/input.jsx';

export function Input({ label, help, error, wide, icon: Icon, className = '', ...props }) {
  const generatedId = React.useId();
  const id = props.id || props.name || generatedId;

  return (
    <FormField label={label} help={help} error={error} wide={wide} htmlFor={id}>
      <span className={Icon ? 'input-shell has-icon' : 'input-shell'}>
        {Icon && <Icon size={17} />}
        <ShadcnInput id={id} className={cn('app-input', Icon && 'border-0 bg-transparent shadow-none focus-visible:ring-0', className)} {...props} />
      </span>
    </FormField>
  );
}
