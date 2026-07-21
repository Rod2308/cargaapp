import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  SkipForward,
  Settings2,
  BellRing,
  Volume2,
  Vibrate,
  Bell,
} from "lucide-react";
import {
  scheduleRestFinishedNotification,
  cancelRestNotification,
  requestNotificationPermission,
  checkNotificationPermission,
  ensureRestChannel,
  isNativePlatform,
} from "@/lib/local-notifications";

type Prefs = {
  sound: boolean;
  vibration: boolean;
  notification: boolean;
};

const PREFS_KEY = "restTimer.prefs.v1";

function loadPrefs(): Prefs {
  if (typeof window === "undefined") {
    return { sound: true, vibration: true, notification: false };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (raw) return { sound: true, vibration: true, notification: false, ...JSON.parse(raw) };
  } catch {}
  return { sound: true, vibration: true, notification: false };
}

function savePrefs(p: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

function beep() {
  try {
    const AC = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    // 3 beeps agudos para ser inconfundível
    const play = (t: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    };
    play(0, 880);
    play(0.28, 880);
    play(0.56, 1175);
    setTimeout(() => { void ctx.close(); }, 1200);
  } catch {}
}

function vibrate() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([180, 90, 180, 90, 300]);
    }
  } catch {}
}

function notify(exerciseName?: string) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    // Só notifica se a aba está oculta — evita duplicação com o alerta visual
    if (typeof document !== "undefined" && document.visibilityState === "visible") return;
    const n = new Notification("Descanso concluído!", {
      body: exerciseName
        ? `Hora de iniciar a próxima série de ${exerciseName}.`
        : "Hora de iniciar a próxima série.",
      tag: "rest-timer",
      icon: "/favicon.ico",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {}
}

export function RestTimer({
  seconds,
  exerciseName,
  onFinish,
}: {
  seconds: number;
  exerciseName?: string;
  onFinish: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    setTotal(seconds);
    setPaused(false);
    setDone(false);
    firedRef.current = false;
    // Agenda notificação local nativa para tocar mesmo com app minimizado / tela bloqueada.
    if (prefs.notification) {
      void ensureRestChannel().then(() =>
        scheduleRestFinishedNotification(seconds, exerciseName),
      );
    }
    return () => {
      void cancelRestNotification();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (done || paused) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (!firedRef.current) {
            firedRef.current = true;
            if (prefs.sound) beep();
            if (prefs.vibration) vibrate();
            if (prefs.notification) notify(exerciseName);
          }
          setDone(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, done, prefs.sound, prefs.vibration, prefs.notification, exerciseName]);

  // Auto-fechar após 20s no estado "concluído"
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onFinish(), 20000);
    return () => clearTimeout(t);
  }, [done, onFinish]);

  const pct = useMemo(
    () => (total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 100),
    [remaining, total],
  );


  // Se o usuário pausar, cancela a notificação agendada; ao retomar, reagenda.
  useEffect(() => {
    if (done) return;
    if (paused) {
      void cancelRestNotification();
    } else if (prefs.notification && remaining > 0) {
      void scheduleRestFinishedNotification(remaining, exerciseName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-3 z-20 mt-4 overflow-hidden rounded-xl border p-4 shadow-md transition-colors ${
        done
          ? "border-success/60 bg-success/10 animate-pulse"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`grid size-14 place-items-center rounded-full text-2xl font-bold tabular-nums ${
            done ? "bg-success text-success-foreground" : "bg-accent text-accent-foreground"
          }`}
        >
          {done ? <BellRing className="size-6" /> : remaining}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {done ? "Descanso concluído" : "Descanso"}
          </p>
          <p className="truncate text-sm font-semibold">
            {done
              ? "Hora da próxima série!"
              : paused
                ? "Pausado"
                : exerciseName
                  ? `Próximo: ${exerciseName}`
                  : "Contando..."}
          </p>
        </div>

        {!done && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRemaining((r) => Math.min(total + 60, r + 30));
                setTotal((t) => t + 30);
              }}
              aria-label="Prorrogar 30 segundos"
              title="+30s"
            >
              <Plus className="size-4" />
              30s
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Retomar" : "Pausar"}
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </Button>
          </>
        )}

        {done ? (
          <Button size="sm" onClick={onFinish} aria-label="Fechar aviso">
            <SkipForward className="size-4" /> Ok
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onFinish}
            aria-label="Pular descanso"
            title="Pular"
          >
            <RotateCcw className="size-4" />
          </Button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Configurações de alerta">
              <Settings2 className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Alerta ao fim do descanso
            </p>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <Volume2 className="size-4 text-muted-foreground" /> Som
              </span>
              <Switch
                checked={prefs.sound}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, sound: v }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <Vibrate className="size-4 text-muted-foreground" /> Vibração
              </span>
              <Switch
                checked={prefs.vibration}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, vibration: v }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" /> Notificação
              </span>
              <Switch
                checked={prefs.notification}
                onCheckedChange={async (v) => {
                  if (!v) {
                    setPrefs((p) => ({ ...p, notification: false }));
                    void cancelRestNotification();
                    return;
                  }
                  await ensureRestChannel();
                  const result = await requestNotificationPermission();
                  const granted = result === "granted";
                  setPrefs((p) => ({ ...p, notification: granted }));
                  if (!granted) return;
                  // reagenda para o timer atual
                  if (!done && remaining > 0) {
                    void scheduleRestFinishedNotification(remaining, exerciseName);
                  }
                }}
              />
              {isNativePlatform() ? null : null}
            </label>
            <p className="text-[11px] leading-snug text-muted-foreground">
              A notificação aparece quando o app está em segundo plano ou a tela está bloqueada.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* barra de progresso */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-[width] duration-500 ease-linear ${
            done ? "bg-success" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
