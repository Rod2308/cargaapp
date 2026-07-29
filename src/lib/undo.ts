import { toast } from "sonner";

type UndoOptions = {
  /** Mensagem principal exibida no toast, ex.: "Exercício removido". */
  message: string;
  /** Texto auxiliar opcional (nome do item removido, por exemplo). */
  description?: string;
  /** Executado quando o usuário toca em "Desfazer". Deve restaurar o item. */
  onUndo: () => Promise<void> | void;
  /** Executado após a restauração bem-sucedida (invalidar queries, etc.). */
  onRestored?: () => void;
  /** Tempo em que o botão fica disponível (ms). Padrão: 8s. */
  duration?: number;
};

/**
 * Mostra um toast com botão "Desfazer" para ações destrutivas.
 * A exclusão já aconteceu; `onUndo` é responsável por recriar o registro.
 */
export function toastUndo({ message, description, onUndo, onRestored, duration = 8000 }: UndoOptions) {
  toast.success(message, {
    description,
    duration,
    action: {
      label: "Desfazer",
      onClick: () => {
        void (async () => {
          const loading = toast.loading("Restaurando...");
          try {
            await onUndo();
            toast.dismiss(loading);
            toast.success("Restaurado");
            onRestored?.();
          } catch (e: any) {
            toast.dismiss(loading);
            toast.error(e?.message ?? "Não foi possível restaurar");
          }
        })();
      },
    },
  });
}

/** Remove campos gerados pelo banco antes de reinserir um registro. */
export function stripGenerated<T extends Record<string, any>>(row: T, extra: string[] = []): Record<string, any> {
  const drop = new Set(["created_at", "updated_at", "client_mutation_id", ...extra]);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (drop.has(k)) continue;
    // Relações aninhadas vindas de select("*, tabela(*)") não podem ser reinseridas.
    if (v !== null && typeof v === "object" && !Array.isArray(v)) continue;
    if (Array.isArray(v) && v.some((x) => x !== null && typeof x === "object")) continue;
    out[k] = v;
  }
  return out;
}
