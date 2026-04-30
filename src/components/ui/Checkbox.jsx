import React from 'react';
import { Checkbox as ShadcnCheckbox } from '../shadcn/checkbox.jsx';

export function Checkbox({ label, help, checked, onChange, ...props }) {
  return (
    <label className="check-control">
      <ShadcnCheckbox
        checked={checked}
        onCheckedChange={(next) => onChange?.({ target: { checked: Boolean(next), name: props.name } })}
        {...props}
      />
      <span>
        <strong>{label}</strong>
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}
