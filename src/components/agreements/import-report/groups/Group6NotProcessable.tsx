import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { ClassifiedRow } from "@/lib/agreement-import";
import { Button } from "@/components/ui/button";
import { GroupShell, EnrichedRow, ChangeKindChip } from "../parts";
import { describeRowReason, reasonKind } from "../labels";
import { EmptyGroup } from "./Group1RequiresDecision";

export function Group6NotProcessable({ rows }: { rows: ClassifiedRow[] }) {
  const [filter, setFilter] = useState<string>("all");

  const kinds = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = reasonKind(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries());
  }, [rows]);

  const visible = rows.filter(
    (r) => filter === "all" || reasonKind(r) === filter,
  );

  function downloadCsv() {
    const header = ["fila", "sku", "codigo_cliente", "motivo"].join(",");
    const body = rows
      .map((r) =>
        [
          r.sourceRow,
          csv(r.row.sku ?? ""),
          csv(r.row.client_code ?? ""),
          csv(describeRowReason(r)),
        ].join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + "\n" + body], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "no_procesables.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <GroupShell
      title="No procesables"
      count={rows.length}
      hint="Filas que el sistema no puede clasificar. Corrige el archivo y vuelve a subirlo."
      tone="muted"
      toolbar={
        rows.length > 0 && (
          <>
            <ChangeKindChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Todos
            </ChangeKindChip>
            {kinds.map(([k, n]) => (
              <ChangeKindChip
                key={k}
                active={filter === k}
                onClick={() => setFilter(k)}
                count={n}
              >
                {k}
              </ChangeKindChip>
            ))}
            <Button size="sm" variant="outline" onClick={downloadCsv}>
              <Download className="mr-1 h-3.5 w-3.5" /> Descargar CSV
            </Button>
          </>
        )
      }
    >
      {rows.length === 0 ? (
        <EmptyGroup message="Todas las filas se pudieron procesar." />
      ) : (
        <div>
          {visible.slice(0, 300).map((r) => (
            <EnrichedRow
              key={r.sourceRow}
              sourceRow={r.sourceRow}
              sku={r.row.sku ?? null}
              extra={
                <div className="mt-0.5 suma-caption text-warning-strong">
                  {describeRowReason(r)}
                </div>
              }
            />
          ))}
          {visible.length > 300 && (
            <p className="mt-2 suma-caption text-text-tertiary">
              …y {visible.length - 300} más.
            </p>
          )}
        </div>
      )}
    </GroupShell>
  );
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
