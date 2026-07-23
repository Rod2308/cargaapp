import { Clock } from "lucide-react";

/**
 * Pequeno rótulo mostrando que um item foi criado offline e ainda não
 * sincronizou com o servidor. Use ao lado do título/timestamp de itens
 * cujo id local começa com "local-" ou que tenham client_mutation_id sem
 * eco do servidor.
 */
export function PendingBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Aguardando sincronização com o servidor"
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 ${className}`}
    >
      <Clock className="size-3" aria-hidden />
      <span>pendente</span>
    </span>
  );
}
