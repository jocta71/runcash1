
import React from 'react';
import { VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Bell, BellRing } from 'lucide-react';

const notificationVariants = cva(
  "inline-flex items-center justify-center rounded-full relative",
  {
    variants: {
      variant: {
        default: "bg-vegas-gold text-black",
        gold: "bg-yellow-500 text-black",
        green: "bg-green-500 text-black",
        red: "bg-red-500 text-white",
        blue: "bg-blue-500 text-white",
      },
      size: {
        sm: "w-4 h-4 text-[8px]",
        md: "w-5 h-5 text-[10px]",
        lg: "w-6 h-6 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface NotificationBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof notificationVariants> {
  count?: number;
  showBell?: boolean;
  animate?: boolean;
  max?: number;
}

const NotificationBadge = ({
  className,
  variant,
  size,
  count = 0,
  showBell = false,
  animate = true,
  max = 99,
  ...props
}: NotificationBadgeProps) => {
  const displayCount = count > max ? `${max}+` : count;
  
  return (
    <div className="relative inline-block">
      {showBell && (
        <div className={`text-vegas-gold ${animate && count > 0 ? 'animate-bell-shake' : ''}`}>
          {count > 0 ? <BellRing size={20} /> : <Bell size={20} />}
        </div>
      )}
      
      {count > 0 && (
        <div
          className={cn(
            notificationVariants({ variant, size }),
            animate ? "animate-pulse" : "",
            className
          )}
          {...props}
        >
          {displayCount}
        </div>
      )}
    </div>
  );
};

export { NotificationBadge, notificationVariants };
