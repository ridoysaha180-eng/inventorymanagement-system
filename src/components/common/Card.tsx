import React from 'react';
import { cn } from '../../utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, title, subtitle }) => {
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden', className)}>
      {(title || subtitle) && (
        <div className="px-6 py-5 border-b border-slate-100/60">
          {title && <h3 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};
