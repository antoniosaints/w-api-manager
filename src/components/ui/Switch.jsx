import React from 'react';
import { Switch as ShadcnSwitch } from '../shadcn/switch.jsx';

export function Switch({ label, help, checked, onChange, ...props }) {
  return (
    <label className="switch-control">
      <ShadcnSwitch
        checked={checked}
        onCheckedChange={(next) => onChange?.({ target: { checked: Boolean(next), name: props.name } })}
        {...props}
      />
      <span className="switch-copy">
        <strong>{label}</strong>
        {help && <small>{help}</small>}
      </span>
    </label>
  );
}
