import { CloudOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/**
 * Inline notice explaining that a feature requires internet.
 * Renders only when the device is offline; otherwise returns null.
 */
export function OfflineNotice({
  feature,
  className = "",
}: {
  feature: string;
  className?: string;
}) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 ${className}`}
    >
      <CloudOff className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <b>{feature}</b> precisa de internet. Reconecte para continuar.
      </span>
    </div>
  );
}
