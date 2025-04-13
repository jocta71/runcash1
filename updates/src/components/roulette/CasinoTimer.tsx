
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CasinoTimerProps {
  initialSeconds: number;
  onComplete?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'urgent' | 'gold';
}

const CasinoTimer = ({ 
  initialSeconds = 30, 
  onComplete, 
  size = 'md', 
  variant = 'default' 
}: CasinoTimerProps) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prevSeconds => {
          if (prevSeconds <= 1) {
            clearInterval(interval!);
            setIsRunning(false);
            onComplete && onComplete();
            return 0;
          }
          return prevSeconds - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, onComplete]);
  
  // Calculate progress percentage
  const progressPercentage = (seconds / initialSeconds) * 100;
  
  // Determine size classes
  const sizeClasses = {
    sm: 'w-16 h-16 text-sm',
    md: 'w-20 h-20 text-base',
    lg: 'w-24 h-24 text-lg'
  };
  
  // Determine variant classes
  const getVariantClasses = () => {
    const urgency = seconds < initialSeconds * 0.3;
    
    if (variant === 'gold' || (!urgency && variant === 'default')) {
      return {
        ring: 'border-vegas-gold',
        text: 'text-vegas-gold',
        pulse: seconds < 10 ? 'animate-pulse-gold' : ''
      };
    } else if (variant === 'urgent' || urgency) {
      return {
        ring: 'border-red-500',
        text: 'text-red-500',
        pulse: 'animate-pulse'
      };
    } else {
      return {
        ring: 'border-vegas-green',
        text: 'text-vegas-green',
        pulse: ''
      };
    }
  };
  
  const variantClasses = getVariantClasses();
  
  return (
    <div className={`${sizeClasses[size]} ${variantClasses.pulse} relative rounded-full border-4 ${variantClasses.ring} flex items-center justify-center`}>
      <div className={`font-mono font-bold ${variantClasses.text}`}>
        {seconds}s
      </div>
      <div className="absolute -top-1 -right-1">
        <Clock size={size === 'sm' ? 14 : size === 'md' ? 18 : 22} className={variantClasses.text} />
      </div>
      <svg className="absolute top-0 left-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray="289.02652413026095"
          strokeDashoffset={289.02652413026095 * (1 - progressPercentage / 100)}
          className={variantClasses.text}
          opacity="0.3"
        />
      </svg>
    </div>
  );
};

export default CasinoTimer;
