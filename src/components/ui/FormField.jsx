import React from 'react';
import { cn } from '../../lib/utils.js';
import { Label } from '../shadcn/label.jsx';

export function FormField({ label, help, error, wide = false, className = '', htmlFor, children }) {
  return (
    <div className={cn('form-field', wide && 'wide', className)}>
      {label && <Label className="form-field-label" htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? <small className="form-field-error">{error}</small> : help ? <small className="form-field-help">{help}</small> : null}
    </div>
  );
}
