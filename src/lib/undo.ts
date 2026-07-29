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
  /** Executado quando o usuário toca em "Refazer". Deve remover o item de novo. */
  onRedo?: () => Promise<void> | void;
  /** Executado após o "Refazer" bem-sucedido. */
  onRedone?: () => void;
  /** Tempo em que o botão fica disponível (ms). Padrão: 30s. */
  duration?: number;
};

/**
 * Mostra um toast com botão "Desfazer" para ações destrutivas.
 * A exclusão já aconteceu; `onUndo` é responsável por recriar o registro.
 * Se `onRedo` for informado, após desfazer aparece um toast com "Refazer",
 * e o ciclo pode ser repetido quantas vezes o usuário quiser.
 */
export function toastUndo(options: UndoOptions) {
  const { message, description, onUndo, onRestored, onRedo, onRedone, duration = 30000 } = options;

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
            onRestored?.();
            if (onRedo) {
              toastRedo(options);
            } else {
              toast.success("Restaurado");
            }
          } catch (e: any) {
            toast.dismiss(loading);
            toast.error(e?.message ?? "Não foi possível restaurar");
          }
        })();
      },
    },
  });
}

/** Toast exibido depois de um "Desfazer", oferecendo "Refazer" (repetir a exclusão). */
function toastRedo(options: UndoOptions) {
  const { description, onRedo, onRedone, duration = 8000 } = options;
  toast.success("Restaurado", {
    description,
    duration,
    action: {
      label: "Refazer",
      onClick: () => {
        void (async () => {
          const loading = toast.loading("Refazendo...");
          try {
            await onRedo?.();
            toast.dismiss(loading);
            onRedone?.();
            // Permite desfazer novamente o que acabou de ser refeito.
            toastUndo(options);
          } catch (e: any) {
            toast.dismiss(loading);
            toast.error(e?.message ?? "Não foi possível refazer");
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
