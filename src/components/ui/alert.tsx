import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        info: "border-l-[4px] border-l-[var(--status-info-base)] border-[var(--status-info-base)]/20 bg-[var(--status-info-soft)] text-[var(--status-info-strong)] [&>svg]:text-[var(--status-info-base)]",
        success:
          "border-l-[4px] border-l-[var(--status-success-base)] border-[var(--status-success-base)]/20 bg-[var(--status-success-soft)] text-[var(--status-success-strong)] [&>svg]:text-[var(--status-success-base)]",
        warning:
          "border-l-[4px] border-l-[var(--status-warning-base)] border-[var(--status-warning-base)]/20 bg-[var(--status-warning-soft)] text-[var(--status-warning-strong)] [&>svg]:text-[var(--status-warning-base)]",
        error: "border-l-[4px] border-l-[var(--status-danger-base)] border-[var(--status-danger-base)]/20 bg-[var(--status-danger-soft)] text-[var(--status-danger-strong)] [&>svg]:text-[var(--status-danger-base)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
