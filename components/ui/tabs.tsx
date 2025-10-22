'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type Tab = { value: string; label: string };
export function Tabs({ tabs, value, onChange, className }: { tabs: Tab[]; value: string; onChange: (v: string)=>void; className?: string }) {
  return (
    <div className={cn('flex items-stretch gap-2 border-b border-gray-200', className)}>
      {tabs.map(t => (
        <button key={t.value}
          className={cn('px-3 py-2 text-sm border-b-2',
            value === t.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900')}
          onClick={()=>onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
