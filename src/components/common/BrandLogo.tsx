import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { cn } from '../../utils';

interface BrandLogoProps {
  name?: string;
  tagline?: string;
  logo?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  name = 'Grocery Point',
  tagline = 'Fresh Products • Better Life',
  logo,
  size = 'md',
  showTagline = true,
  className
}) => {
  const cleanName = (name || 'Grocery Point').trim();
  const parts = cleanName.split(/\s+/);
  const firstWord = parts[0] || 'Grocery';
  const remainingWords = parts.slice(1).join(' ');

  const iconBoxSize = size === 'sm' ? 'w-8 h-8 rounded-xl' : size === 'lg' ? 'w-11 h-11 rounded-2xl' : 'w-10 h-10 rounded-2xl';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  const titleSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-lg';
  const taglineSize = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-[11px]' : 'text-[10px]';

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      {/* Icon or Logo Image */}
      <div className={cn(iconBoxSize, "bg-emerald-500 text-white flex items-center justify-center shadow-xs overflow-hidden shrink-0")}>
        {logo ? (
          <img src={logo} alt={cleanName} className="w-full h-full object-cover" />
        ) : (
          <ShoppingCart className={cn(iconSize, "text-white stroke-[2.2]")} />
        )}
      </div>

      {/* Dynamic Name & Tagline */}
      <div className="text-left min-w-0">
        <div className="flex items-center gap-1 leading-none">
          <span className={cn(titleSize, "font-black text-emerald-600 tracking-tight shrink-0")}>
            {firstWord}
          </span>
          {remainingWords && (
            <span className={cn(titleSize, "font-black text-slate-900 tracking-tight truncate")}>
              {remainingWords}
            </span>
          )}
        </div>
        {showTagline && tagline && (
          <p className={cn(taglineSize, "text-slate-500 font-semibold tracking-wide mt-1 whitespace-nowrap truncate")}>
            {tagline}
          </p>
        )}
      </div>
    </div>
  );
};
