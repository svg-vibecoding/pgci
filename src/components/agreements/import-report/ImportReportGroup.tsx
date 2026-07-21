import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

/**
 * ImportReportGroup — acordeón uniforme para cada grupo del reporte.
 * Colapsado por defecto. Fila limpia: título + conteo + chevron.
 * El toolbar (atajos) se muestra al abrir, dentro del cuerpo, no en el header,
 * para no competir con el clic del acordeón.
 */
export function ImportReportGroup({
  id,
  icon,
  title,
  count,
  hint,
  toolbar,
  children,
  tone = "default",
}: {
  id: string;
  icon?: ReactNode;
  title: string;
  count: number;
  hint?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <Accordion type="multiple" className="w-full">
      <AccordionItem
        value={id}
        className={cn(
          "overflow-hidden rounded-lg border !border-b",
          tone === "muted"
            ? "border-border/60 bg-muted/20"
            : "border-border bg-white",
        )}
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:hidden">
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <span className="text-text-tertiary shrink-0">{icon}</span>
              )}
              <span className="suma-h4 text-text-primary truncate">
                {title}
              </span>
              <span className="tabular-nums text-text-tertiary font-normal">
                {count}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-0">
          {(hint || toolbar) && (
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              {hint ? (
                <p className="suma-caption text-text-tertiary max-w-2xl">
                  {hint}
                </p>
              ) : (
                <span />
              )}
              {toolbar && (
                <div className="flex flex-wrap items-center gap-2">
                  {toolbar}
                </div>
              )}
            </div>
          )}
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
