import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  className?: string;
  text?: string;
}

export function LoadingSpinner({ className, text }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16', className)}>
      <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-3" />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}
