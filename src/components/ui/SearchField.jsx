import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { Input } from '../shadcn/input.jsx';

export function SearchField({ className = '', inputClassName = '', ...props }) {
  return (
    <label className={cn('search-box app-search-field', className)}>
      <Search size={17} />
      <Input className={cn('app-search-input border-0 bg-transparent px-0 shadow-none focus-visible:ring-0', inputClassName)} {...props} />
    </label>
  );
}
