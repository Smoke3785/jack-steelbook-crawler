import { Badge } from "./badge";
import {
  stockStateHint,
  stockStateLabel,
  type StockState,
} from "@/shared/lib/stock-state";

type Tone = "neutral" | "label" | "available" | "sold-out" | "new";

const STATE_TONES: Record<StockState, Tone> = {
  "pre-order": "new",
  "in-stock": "available",
  "sold-out": "sold-out",
  tba: "neutral",
  unknown: "neutral",
};

export function StockBadge({
  state,
  inStock,
  total,
}: {
  state: StockState | string | null;
  /** Shown for in-stock: "2/3 in stock". */
  inStock?: number;
  total?: number;
}) {
  const resolved = (state ?? "unknown") as StockState;

  let label = stockStateLabel(resolved);

  if (resolved === "in-stock" && inStock !== undefined && total !== undefined) {
    label = `${inStock}/${total} in stock`;
  }

  return (
    <Badge tone={STATE_TONES[resolved] ?? "neutral"} >
      <span title={stockStateHint(resolved)}>{label}</span>
    </Badge>
  );
}
