import React from 'react';
import { cn } from '../../lib/utils.js';
import { Card as ShadcnCard } from '../shadcn/card.jsx';

const variantClass = {
  panel: 'app-card app-card-panel',
  metric: 'app-card app-card-metric',
  row: 'app-card app-card-row',
  auth: 'app-card app-card-auth'
};

export const Card = React.forwardRef(function Card(
  { as: Comp = ShadcnCard, variant = 'panel', className = '', children, ...props },
  ref
) {
  return (
    <Comp ref={ref} className={cn(variantClass[variant] || variantClass.panel, className)} {...props}>
      {children}
    </Comp>
  );
});
