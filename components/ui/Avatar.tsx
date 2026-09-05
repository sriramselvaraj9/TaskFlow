import type React from 'react';
import { cn, getUserInitials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 'md', className }) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }[size];

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold bg-indigo-600 text-white border border-indigo-500/30 select-none shrink-0 shadow-xs',
        sizeClasses,
        className,
      )}
      title={name}
    >
      {getUserInitials(name)}
    </div>
  );
};
