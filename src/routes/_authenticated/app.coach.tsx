import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/coach")({
  component: CoachPage,
});

function CoachPage() {
  return (
    <div className="app-container pt-8">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coach de IA</h1>
          <p className="text-xs text-muted-foreground">Baseado no seu perfil e histórico</p>
        </div>
      </div>

      <div className="card-lift relative mt-6 overflow-hidden p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand/20 text-foreground">
          <Lock className="size-6" strokeWidth={2.5} />
        </div>
        <span className="mt-4 inline-flex items-center rounded-full bg-brand/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground">
          PRO em breve
        </span>
        <h2 className="mt-3 font-display text-xl leading-snug text-foreground">
          O Coach de IA está temporariamente bloqueado
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Estamos preparando um plano <strong>PRO</strong> com respostas personalizadas do coach
          baseadas no seu perfil, histórico e evolução. Você será avisado assim que ele for liberado.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Enquanto isso, continue registrando seus treinos — todo esse histórico será usado para
          gerar recomendações ainda mais precisas.
        </p>
      </div>
    </div>
  );
}
