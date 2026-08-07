import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepperProps {
  current: number;
  total?: number;
  labels?: string[];
}

export function Stepper({ current, total = 3, labels }: StepperProps) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="mb-2 w-full">
      <div className="flex items-center justify-center">
        {steps.map((step, idx) => {
          const isDone = step < current;
          const isActive = step === current;
          return (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  isDone || isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted text-muted-foreground'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? <Check className="h-4 w-4" /> : step}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-10 rounded-full transition-colors sm:w-16',
                    step < current ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {labels?.[current - 1] && (
        <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
          Step {current} of {total} · {labels[current - 1]}
        </p>
      )}
    </div>
  );
}

export default Stepper;
