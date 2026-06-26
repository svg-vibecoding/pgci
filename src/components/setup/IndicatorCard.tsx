import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function IndicatorCard({
  label,
  value,
  hint,
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {children && (
          <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
