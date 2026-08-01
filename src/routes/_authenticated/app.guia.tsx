import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, ChevronDown, Dumbbell, Search } from "lucide-react";
import {
  GUIDE_EXERCISES,
  GUIDE_IMAGE_BASE,
  GUIDE_MUSCLES,
  type GuideExercise,
  type GuideMuscle,
} from "@/lib/exercise-guide";

export const Route = createFileRoute("/_authenticated/app/guia")({
  component: ExerciseGuidePage,
  head: () => ({
    meta: [
      { title: "Guia de exercícios em máquinas · Carga" },
      {
        name: "description",
        content:
          "Guia visual das máquinas mais comuns da academia: execução passo a passo, respiração, dicas de segurança e erros comuns, com demonstração animada de cada exercício.",
      },
      { property: "og:title", content: "Guia de exercícios em máquinas · Carga" },
      {
        property: "og:description",
        content:
          "Como usar leg press, puxada alta, peck deck, extensora e outras máquinas com técnica correta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/** Alterna os dois quadros (início/fim) para simular a animação do movimento. */
function ExerciseFrames({ ex }: { ex: GuideExercise }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPlaying(false);
      return;
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 1100);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
      <div className="relative aspect-[4/3] w-full">
        {[0, 1].map((i) => (
          <img
            key={i}
            src={`${GUIDE_IMAGE_BASE}/${ex.imageId}/${i}.jpg`}
            alt={
              i === 0
                ? `Posição inicial do exercício ${ex.name} na ${ex.machine}`
                : `Posição final do exercício ${ex.name} na ${ex.machine}`
            }
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${
              frame === i ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className="absolute bottom-2 right-2 rounded-full bg-background/85 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur"
      >
        {playing ? "Pausar" : "Animar"}
      </button>
      <span className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">
        {frame === 0 ? "Início" : "Final"}
      </span>
    </div>
  );
}

function ExerciseCard({ ex }: { ex: GuideExercise }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="card-lift overflow-hidden p-4">
      <header className="mb-3">
        <p className="text-eyebrow uppercase text-muted-foreground">{ex.muscle}</p>
        <h3 className="font-display text-lg font-black leading-tight text-foreground">{ex.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Máquina: {ex.machine}</p>
      </header>

      <ExerciseFrames ex={ex} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-3 flex w-full items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-foreground"
      >
        {open ? "Ocultar execução" : "Ver execução, dicas e erros"}
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-4 text-sm">
          <section>
            <h4 className="font-display text-sm font-bold text-foreground">
              Descrição detalhada da execução
            </h4>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Ajuste da máquina:</span> {ex.setup}
              </li>
              <li>
                <span className="font-semibold text-foreground">Posicionamento inicial:</span>{" "}
                {ex.start}
              </li>
              <li>
                <span className="font-semibold text-foreground">Execução do movimento:</span>{" "}
                {ex.movement}
              </li>
              <li>
                <span className="font-semibold text-foreground">Respiração:</span> {ex.breathing}
              </li>
            </ol>
          </section>

          <section>
            <h4 className="font-display text-sm font-bold text-foreground">
              Dicas essenciais de segurança e eficiência
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
              {ex.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="font-display text-sm font-bold text-foreground">
              Erros comuns a evitar
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
              {ex.mistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
}

function ExerciseGuidePage() {
  const [muscle, setMuscle] = useState<GuideMuscle | "Todos">("Todos");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return GUIDE_EXERCISES.filter(
      (e) =>
        (muscle === "Todos" || e.muscle === muscle) &&
        (term === "" ||
          e.name.toLowerCase().includes(term) ||
          e.machine.toLowerCase().includes(term) ||
          e.muscle.toLowerCase().includes(term)),
    );
  }, [muscle, q]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6">
      <Link
        to="/app"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <header className="mt-3 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary">
          <BookOpen className="size-5" strokeWidth={2.5} />
        </span>
        <div>
          <h1 className="font-display text-xl font-black leading-tight text-foreground sm:text-2xl">
            Guia de exercícios em máquinas
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {GUIDE_EXERCISES.length} exercícios das máquinas mais comuns, com demonstração animada,
            passo a passo, respiração, dicas e erros comuns.
          </p>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar exercício ou máquina…"
          aria-label="Buscar exercício ou máquina"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["Todos", ...GUIDE_MUSCLES] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle(m)}
            aria-pressed={muscle === m}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              muscle === m
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Nenhum exercício encontrado para essa busca.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((ex) => (
            <ExerciseCard key={ex.slug} ex={ex} />
          ))}
        </div>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Dumbbell className="size-3.5" />
        Em caso de dor ou dúvida na execução, procure a orientação de um profissional.
      </p>
    </div>
  );
}
