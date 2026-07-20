import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Crown, Medal, Flame, Loader2 } from "lucide-react";
import { startOfWeek, startOfMonth, differenceInCalendarDays } from "date-fns";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/app/grupos/$id/classificacao")({
  component: ClassificacaoPage,
});

type Period = "all" | "month" | "week";

function ClassificacaoPage() {
  const { id } = Route.useParams();
  const { user } = AuthedRoute.useRouteContext();
  const [period, setPeriod] = useState<Period>("all");

  const { data: group } = useQuery({
    queryKey: ["group", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("groups").select("id, name, emoji").eq("id", id).single();
      if (error) throw error;
      return data as { id: string; name: string; emoji: string };
    },
  });

  const { data: members = [], isLoading: mLoading } = useQuery({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_members")
        .select("user_id, current_streak, longest_streak, last_checkin_date, joined_at")
        .eq("group_id", id);
      if (error) throw error;
      return data as Array<{
        user_id: string;
        current_streak: number;
        longest_streak: number;
        last_checkin_date: string | null;
        joined_at: string;
      }>;
    },
  });

  const ids = members.map((m) => m.user_id);
  const { data: profiles = [] } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["group-profiles", id, ids.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
  const profileById = Object.fromEntries((profiles as any[]).map((p) => [p.id, p.display_name || "Aluno"]));

  const { data: points = [], isLoading: pLoading } = useQuery({
    queryKey: ["group-points-full", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_points")
        .select("user_id, points, reason, checkin_date, created_at")
        .eq("group_id", id)
        .limit(2000);
      if (error) throw error;
      return data as Array<{ user_id: string; points: number; reason: string; checkin_date: string; created_at: string }>;
    },
  });

  const cutoff = useMemo(() => {
    if (period === "week") return startOfWeek(new Date(), { weekStartsOn: 1 });
    if (period === "month") return startOfMonth(new Date());
    return new Date(0);
  }, [period]);

  const ranking = useMemo(() => {
    const rows = members.map((m) => {
      const mine = points.filter((p) => p.user_id === m.user_id && new Date(p.created_at) >= cutoff);
      const total = mine.reduce((s, p) => s + p.points, 0);
      const checkinDays = new Set(mine.filter((p) => p.reason === "checkin").map((p) => p.checkin_date));
      const daysSinceJoin = Math.max(1, differenceInCalendarDays(new Date(), new Date(m.joined_at)) + 1);
      const avg = mine.length ? total / Math.max(1, checkinDays.size || 1) : 0;
      return {
        ...m,
        name: profileById[m.user_id] ?? "Aluno",
        total,
        checkins: checkinDays.size,
        activeDays: checkinDays.size,
        avg,
        daysSinceJoin,
      };
    });
    return rows.sort(
      (a, b) => b.total - a.total || b.checkins - a.checkins || b.current_streak - a.current_streak,
    );
  }, [members, points, profileById, cutoff]);

  const myIdx = ranking.findIndex((r) => r.user_id === user.id);
  const myRow = myIdx >= 0 ? ranking[myIdx] : null;
  const loading = mLoading || pLoading;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 pb-24">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/app/grupos/$id" params={{ id }}>
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
      </div>

      <header className="mb-4">
        <p className="text-2xl">{group?.emoji ?? "🏆"}</p>
        <h1 className="text-2xl font-bold">Classificação geral</h1>
        <p className="text-sm text-muted-foreground">{group?.name ?? "Grupo"}</p>
      </header>

      {myRow && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Sua posição</p>
          <p className="mt-1 text-3xl font-bold">
            {myIdx + 1}º <span className="text-base font-normal text-muted-foreground">de {ranking.length}</span>
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Pontos" value={myRow.total} />
            <MiniStat label="Check-ins" value={myRow.checkins} />
            <MiniStat label="Sequência" value={`${myRow.current_streak}🔥`} />
          </div>
        </div>
      )}

      <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1 text-xs">
        {(["all", "month", "week"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-md px-2 py-1.5 font-medium ${period === p ? "bg-background shadow" : "text-muted-foreground"}`}
          >
            {p === "all" ? "Total" : p === "month" ? "Mês" : "Semana"}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton rows={5} className="mt-2" />
      ) : ranking.length === 0 ? (
        <EmptyState icon={Trophy} title="Sem participantes ainda" message="Assim que alguém pontuar, a classificação aparece aqui." />
      ) : (
        <ul className="space-y-1.5">
          {ranking.map((r, i) => {
            const pos = i + 1;
            const isMe = r.user_id === user.id;
            return (
              <li
                key={r.user_id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isMe ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <PositionBadge position={pos} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {r.name} {isMe && <span className="text-xs text-primary">(você)</span>}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{r.checkins} check-ins</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5"><Flame className="size-3" />{r.current_streak}</span>
                    {r.avg > 0 && <><span>•</span><span>média {r.avg.toFixed(1)}/dia</span></>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{r.total}</p>
                  <p className="text-[10px] uppercase text-muted-foreground">pts</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <div className="flex size-10 items-center justify-center rounded-full bg-yellow-400/20 text-yellow-600 dark:text-yellow-400"><Crown className="size-5" /></div>;
  if (position === 2) return <div className="flex size-10 items-center justify-center rounded-full bg-slate-400/20 text-slate-500 dark:text-slate-300"><Medal className="size-5" /></div>;
  if (position === 3) return <div className="flex size-10 items-center justify-center rounded-full bg-amber-600/20 text-amber-700 dark:text-amber-500"><Trophy className="size-5" /></div>;
  return <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">{position}</div>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-background/70 px-2 py-1.5">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="mt-1 text-[9px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}
