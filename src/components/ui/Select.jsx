import React from 'react';
import { FormField } from './FormField.jsx';
import { cn } from '../../lib/utils.js';
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../shadcn/select.jsx';

const EMPTY_VALUE = '__wapi_empty__';

export function Select({ label, help, error, wide, children, className = '', triggerClassName = '', ...props }) {
  const generatedId = React.useId();
  const id = props.id || props.name || generatedId;
  const options = React.Children.toArray(children).filter((child) => React.isValidElement(child) && child.type === 'option');
  const value = props.value === undefined || props.value === null || props.value === '' ? EMPTY_VALUE : String(props.value);
  const placeholder = options.find((option) => String(option.props.value ?? '') === '')?.props.children || 'Selecionar';
  const handleValueChange = (nextValue) => {
    const resolvedValue = nextValue === EMPTY_VALUE ? '' : nextValue;
    props.onChange?.({ target: { value: resolvedValue, name: props.name } });
  };

  return (
    <FormField label={label} help={help} error={error} wide={wide} className={className} htmlFor={id}>
      <ShadcnSelect value={value} onValueChange={handleValueChange} disabled={props.disabled}>
        <SelectTrigger id={id} className={cn('app-select-trigger shadcn-select-trigger', triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const optionValue = String(option.props.value ?? '');
            return (
              <SelectItem key={optionValue || EMPTY_VALUE} value={optionValue || EMPTY_VALUE} disabled={option.props.disabled}>
                {option.props.children}
              </SelectItem>
            );
          })}
        </SelectContent>
      </ShadcnSelect>
    </FormField>
  );
}
