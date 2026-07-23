import type { ClassifiedRow, PositionSnapshot } from "@/lib/agreement-import";
import type { DecisionsState } from "../state";
import { ChangesGroup } from "./ChangesGroup";

export function Group2ModifiesPublished({
  rows,
  positionsById,
  clientsById,
  decisions,
  icon,
}: {
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  clientsById: Map<string, string>;
  decisions: DecisionsState;
  icon?: React.ReactNode;
}) {
  return (
    <ChangesGroup
      id="g2"
      icon={icon}
      title="Actualizaciones en posiciones publicadas en el acuerdo"
      rows={rows}
      positionsById={positionsById}
      clientsById={clientsById}
      decisions={decisions}
      emptyMessage="Sin cambios sobre posiciones publicadas."
    />
  );
}
