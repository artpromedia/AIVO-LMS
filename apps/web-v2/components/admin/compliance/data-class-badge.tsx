import { Badge } from "@/components/ui/badge";
import type { Sensitivity } from "@/lib/compliance/governance-store";

function sensitivityTone(s: Sensitivity): "danger" | "warning" | "neutral" | "success" {
  if (s === "restricted") return "danger";
  if (s === "high") return "warning";
  if (s === "moderate") return "neutral";
  return "success";
}

export function DataClassBadge({
  dataClass,
  owningService,
  sensitivity,
}: {
  dataClass: string;
  owningService: string;
  sensitivity: Sensitivity;
}) {
  return (
    <Badge tone={sensitivityTone(sensitivity)} className="gap-1.5 font-mono text-xs">
      <span>{dataClass}</span>
      <span className="opacity-60">·</span>
      <span className="font-normal opacity-80">{owningService}</span>
    </Badge>
  );
}
