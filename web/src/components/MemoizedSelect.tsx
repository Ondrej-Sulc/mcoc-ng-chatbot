'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Option {
  value: string;
  label: string;
}

interface MemoizedSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: Option[];
  required?: boolean;
  className?: string;
}

export const MemoizedSelect = React.memo(function MemoizedSelect({
  value,
  onValueChange,
  placeholder,
  options,
  required,
  className,
}: MemoizedSelectProps) {
  return (
    <Select onValueChange={onValueChange} value={value} required={required}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
