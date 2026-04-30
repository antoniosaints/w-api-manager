import React from 'react';
import { cn } from '../../lib/utils.js';
import { Button as ShadcnButton } from '../shadcn/button.jsx';

export function Button({
  children,
  variant = 'secondary',
  compact = false,
  danger = false,
  iconOnly = false,
  className = '',
  size,
  ...props
}) {
  const shadcnVariant = danger
    ? 'destructive'
    : variant === 'primary'
      ? 'default'
      : variant === 'secondary'
        ? 'outline'
        : variant;
  const buttonSize = size || (iconOnly ? 'icon' : compact ? 'sm' : 'default');

  return (
    <ShadcnButton
      variant={shadcnVariant}
      size={buttonSize}
      className={cn('app-button', compact && 'compact-action', iconOnly && 'icon-only', className)}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
}
