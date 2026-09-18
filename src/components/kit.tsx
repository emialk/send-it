import { cva, type VariantProps } from "class-variance-authority";
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";
import type { CompetitionStatus } from "@/lib/db-types";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline: "border border-border bg-transparent text-foreground hover:bg-accent",
        ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        top: "bg-top text-top-foreground hover:bg-top/90",
        zone: "bg-zone text-zone-foreground hover:bg-zone/90",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-14 px-6 text-base",
        touch: "h-16 px-6 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("panel p-4 sm:p-5", className)}>{children}</section>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

export function Input({
  className,
  name,
  defaultValue,
  value,
  type = "text",
  placeholder,
  disabled,
  required,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const isolateBrowserEvent = (event: Event) => {
      event.stopImmediatePropagation();
    };
    const eventTypes = ["focus", "blur", "beforeinput", "input", "change", "keydown", "keyup"];
    for (const eventType of eventTypes) {
      input.addEventListener(eventType, isolateBrowserEvent, true);
    }
    return () => {
      for (const eventType of eventTypes) {
        input.removeEventListener(eventType, isolateBrowserEvent, true);
      }
    };
  }, []);

  return (
    <input
      ref={inputRef}
      className={cn(controlClass, className)}
      name={name}
      {...props}
      type={type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      value={value}
      disabled={disabled}
      required={required}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlClass, "h-10", className)} {...props} />;
}

const statusLabels: Record<CompetitionStatus, string> = {
  draft: "Draft",
  registration: "Registration open",
  active: "Live",
  finished: "Finished",
  archived: "Archived",
};

const statusClass: Record<CompetitionStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  registration: "bg-zone/20 text-zone",
  active: "bg-live/20 text-live",
  finished: "bg-top/20 text-top",
  archived: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: CompetitionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
        statusClass[status],
      )}
    >
      {status === "active" ? (
        <span className="h-2 w-2 rounded-full bg-live motion-safe:animate-pulse" />
      ) : null}
      {statusLabels[status]}
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="panel px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-3xl leading-tight tabular">{value}</div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="font-display text-xl">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
