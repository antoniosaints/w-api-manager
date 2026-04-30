import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '../shadcn/tabs.jsx';

export function Toggle({ options = [], value, onChange, className = '' }) {
  return (
    <Tabs value={value} onValueChange={onChange} className={className}>
      <TabsList className="toggle-group">
      {options.map((option) => (
        <TabsTrigger key={option.value} value={option.value} className={value === option.value ? 'active' : ''}>
          {option.label}
        </TabsTrigger>
      ))}
      </TabsList>
    </Tabs>
  );
}
