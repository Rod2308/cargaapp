import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "carga.installPrompt.dismissedAt";
const DISMISS_DAYS = 14;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt as any);

    const onInstalled = () => {
      setDeferred(null);
      setShowIOS(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari does not fire beforeinstallprompt — show a hint after a short delay
    let timer: number | undefined;
    if (isIOS() && !isStandalone()) {
      timer = window.setTimeout(() => setShowIOS(true), 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as any);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setDeferred(null);
    setShowIOS(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
    } else {
      dismiss();
    }
  };

  if (deferred) {
    return (
      <div className="fixed inset-x-3 bottom-16 z-50 mx-auto max-w-md rounded-2xl border border-border/60 bg-background/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" width={44} height={44} loading="lazy" decoding="async" className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Instalar Carga na tela inicial</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Abre como app e funciona offline nas telas já visitadas.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={install}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                <Download className="size-3.5" />
                Instalar
              </button>
              <button
                onClick={dismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
              >
                Agora não
              </button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (showIOS) {
    return (
      <div className="fixed inset-x-3 bottom-16 z-50 mx-auto max-w-md rounded-2xl border border-border/60 bg-background/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Instalar Carga no iPhone</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Toque em <Share className="mx-0.5 inline size-3.5 align-[-2px]" /> e depois em
              <b> Adicionar à Tela de Início</b>.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
