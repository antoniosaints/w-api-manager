import React from 'react';
import { Badge as ShadcnBadge } from '../shadcn/badge.jsx';

export function Badge({ children, tone = 'neutral', className = '' }) {
  const variant = tone === 'danger' ? 'destructive' : tone === 'inactive' || tone === 'muted' ? 'secondary' : 'default';
  return <ShadcnBadge variant={variant} className={['badge', `badge-${tone}`, 'px-3', className].filter(Boolean).join(' ')}>{children}</ShadcnBadge>;
}
