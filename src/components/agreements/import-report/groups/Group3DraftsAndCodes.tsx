import type { ClassifiedRow, PositionSnapshot } from "@/lib/agreement-import";
import type { DecisionsState } from "../state";
import { ChangesGroup } from "./ChangesGroup";

export function Group3DraftsAndCodes({
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
      id="g3"
      icon={icon}
      title="Cambios en posiciones en gestión"
      rows={rows}
      positionsById={positionsById}
      decisions={decisions}
      emptyMessage="Sin cambios sobre posiciones en gestión."
    />
  );
}
