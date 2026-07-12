import * as React from "react";
import { cn } from "@/lib/utils";

export function InfoField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <p className="suma-overline text-text-secondary">{label}</p>
      <div className="suma-body text-text-primary break-words">{children}</div>
    </div>
  );
}

export function InfoSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {title && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/70">
          {title}
        </h3>
      )}
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
