import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/mcp-teste")({
  component: McpTestPage,
});

type ToolResult<T> = { ok: boolean; count: number; sample: T | null; error?: string };

async function runListWorkouts(): Promise<ToolResult<unknown>> {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, label, name, notes, order_idx, updated_at")
    .order("order_idx", { ascending: true })
    .limit(50);
  if (error) return { ok: false, count: 0, sample: null, error: error.message };
  return { ok: true, count: data?.length ?? 0, sample: data?.[0] ?? null };
}

async function runGetWorkout(): Promise<ToolResult<unknown>> {
  const { data: w, error: wErr } = await supabase
    .from("workouts")
    .select("id, label, name, notes")
    .order("order_idx", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (wErr) return { ok: false, count: 0, sample: null, error: wErr.message };
  if (!w) return { ok: true, count: 0, sample: null, error: "Nenhum treino cadastrado — crie um em Treinos para testar." };
  const { data: ex, error: eErr } = await supabase
    .from("workout_exercises")
    .select("id, order_idx, target_sets, target_reps, target_weight_kg, target_rest_seconds, notes, exercises(name, muscle_group)")
    .eq("workout_id", w.id)
    .order("order_idx", { ascending: true });
  if (eErr) return { ok: false, count: 0, sample: null, error: eErr.message };
  return { ok: true, count: ex?.length ?? 0, sample: { workout: w, exercises: ex ?? [] } };
}

async function runListRecentSessions(): Promise<ToolResult<unknown>> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, started_at, ended_at, perceived_effort, notes, workouts(label, name)")
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) return { ok: false, count: 0, sample: null, error: error.message };
  return { ok: true, count: data?.length ?? 0, sample: data?.[0] ?? null };
}

function McpTestPage() {
  const { user } = AuthedRoute.useRouteContext();
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/mcp` : "/mcp";

  const lw = useQuery({ queryKey: ["mcp-test", "list_workouts", user.id], queryFn: runListWorkouts });
  const gw = useQuery({ queryKey: ["mcp-test", "get_workout", user.id], queryFn: runGetWorkout });
  const lrs = useQuery({ queryKey: ["mcp-test", "list_recent_sessions", user.id], queryFn: runListRecentSessions });

  const tools = [
    { name: "list_workouts", q: lw },
    { name: "get_workout", q: gw },
    { name: "list_recent_sessions", q: lrs },
  ] as const;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Teste das ferramentas MCP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Executa as mesmas consultas que as ferramentas MCP rodam para o seu usuário,
          respeitando o RLS. Se aparecerem dados aqui, um cliente MCP conectado via OAuth
          receberá o mesmo resultado.
        </p>
      </header>

      <Card className="p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Endpoint MCP</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all">{mcpUrl}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(mcpUrl);
                toast.success("URL copiada");
              }}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Conecte em ChatGPT / Claude / Cursor como MCP server. Ao autorizar, você será
          redirecionado para a tela de consentimento e retornará como usuário autenticado.
        </p>
      </Card>

      <section className="space-y-3">
        {tools.map(({ name, q }) => (
          <Card key={name} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {q.isPending ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : q.data?.ok ? (
                  <CheckCircle2 className="size-4 text-primary" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
                <code className="text-sm font-medium">{name}</code>
              </div>
              <div className="text-xs text-muted-foreground">
                {q.isPending
                  ? "executando..."
                  : q.data?.ok
                    ? `${q.data.count} ${name === "get_workout" ? "exercícios" : "registros"}`
                    : "erro"}
              </div>
            </div>
            {q.data?.error && (
              <p className="mt-2 text-xs text-destructive">{q.data.error}</p>
            )}
            {q.data?.ok && q.data.sample !== null && (
              <SamplePreview data={q.data.sample} />
            )}
            <div className="mt-3">
              <Button size="sm" variant="ghost" onClick={() => void q.refetch()} disabled={q.isFetching}>
                {q.isFetching ? "Executando..." : "Executar novamente"}
              </Button>
            </div>
          </Card>
        ))}
      </section>
    </main>
  );
}

function SamplePreview({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary hover:underline"
      >
        {open ? "Ocultar amostra" : "Ver amostra do retorno"}
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-[11px] leading-snug">
{JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
