import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ProgressStepsProps {
  current: number; // 1-based
  steps: string[];
}

export const ProgressSteps = ({ current, steps }: ProgressStepsProps) => {
  return (
    <div className="w-full">
      <ol className="flex items-center justify-between gap-2">
        {steps.map((label, i) => {
          const step = i + 1;
          const isDone = step < current;
          const isActive = step === current;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-initial">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                    isDone && "border-primary bg-primary text-primary-foreground",
                    isActive && "border-accent bg-accent text-accent-foreground shadow-gold scale-110",
                    !isDone && !isActive && "border-border bg-card text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="h-4 w-4" /> : <span className="num">{step}</span>}
                </div>
                <span
                  className={cn(
                    "hidden text-[11px] font-medium sm:block whitespace-nowrap",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="h-0.5 flex-1 rounded-full bg-border overflow-hidden">
                  <div
                    className={cn(
                      "h-full bg-primary transition-all duration-500",
                      isDone ? "w-full" : "w-0"
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
