import type { ClassifiedRow, PositionSnapshot } from "@/lib/agreement-import";
import type { DecisionsState } from "../state";
import { ChangesGroup } from "./ChangesGroup";

export function Group2ModifiesPublished({
  rows,
  positionsById,
  decisions,
  icon,
}: {
  rows: ClassifiedRow[];
  positionsById: Map<string, PositionSnapshot>;
  decisions: DecisionsState;
  icon?: React.ReactNode;
}) {
  return (
    <ChangesGroup
      id="g2"
      icon={icon}
      title="Cambios en posiciones publicadas en el acuerdo"
      rows={rows}
      positionsById={positionsById}
      decisions={decisions}
      emptyMessage="Sin cambios sobre posiciones publicadas."
    />
  );
}
