import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Copy, Flame, Trophy, Share2, LogOut, Archive, Loader2, Crown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/grupos/$id")({
  component: GroupDetail,
});

type Group = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  invite_code: string;
  owner_id: string;
  archived_at: string | null;
  points_per_checkin: number;
  streak_bonus_points: number;
  streak_bonus_every_days: number;
};

type Member = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null;
  joined_at: string;
};

type PointRow = {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  checkin_date: string;
  created_at: string;
  session_id: string | null;
};

function GroupDetail() {
  const { id } = Route.useParams();
  const { user } = AuthedRoute.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");

  const { data: group, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("groups").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Group | null;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_members")
        .select("user_id, current_streak, longest_streak, last_checkin_date, joined_at")
        .eq("group_id", id);
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const memberIds = members.map((m) => m.user_id);

  const { data: profiles = [] } = useQuery({
    enabled: memberIds.length > 0,
    queryKey: ["group-profiles", id, memberIds.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", memberIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const profileById = useMemo(
    () => Object.fromEntries((profiles as any[]).map((p) => [p.id, p.display_name || "Aluno"])),
    [profiles],
  );

  const { data: points = [] } = useQuery({
    queryKey: ["group-points", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_points")
        .select("id, user_id, points, reason, checkin_date, created_at, session_id")
        .eq("group_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as PointRow[];
    },
  });

  const ranking = useMemo(() => {
    const cutoff =
      period === "week"
        ? startOfWeek(new Date(), { weekStartsOn: 1 })
        : period === "month"
          ? startOfMonth(new Date())
          : new Date(0);
    const totals = new Map<string, number>();
    for (const p of points) {
      if (new Date(p.created_at) < cutoff) continue;
      totals.set(p.user_id, (totals.get(p.user_id) ?? 0) + p.points);
    }
    const rows = members.map((m) => ({
      ...m,
      points: totals.get(m.user_id) ?? 0,
      name: profileById[m.user_id] ?? "Aluno",
    }));
    return rows.sort((a, b) => b.points - a.points || b.current_streak - a.current_streak);
  }, [points, members, profileById, period]);

  const isOwner = group?.owner_id === user.id;
  const inviteUrl = typeof window !== "undefined" && group
    ? `${window.location.origin}/app/grupos?codigo=${group.invite_code}`
    : "";

  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("group_members")
        .delete()
        .eq("group_id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Você saiu do grupo");
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      navigate({ to: "/app/grupos" });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao sair"),
  });

  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("groups")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo arquivado");
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      navigate({ to: "/app/grupos" });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao arquivar"),
  });

  function share() {
    const text = `Bora treinar comigo no Carga? Entre no grupo "${group?.name}" com o código ${group?.invite_code} ou pelo link: ${inviteUrl}`;
    if (navigator.share) {
      navigator.share({ title: `Grupo ${group?.name}`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Convite copiado");
    }
  }

  function copyCode() {
    if (!group) return;
    navigator.clipboard.writeText(group.invite_code);
    toast.success("Código copiado");
  }

  if (isLoading) {
    return <div className="flex justify-center p-10"><Loader2 className="size-5 animate-spin" /></div>;
  }
  if (!group) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p>Grupo não encontrado.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/app/grupos" })}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/grupos" })} className="mb-2">
        <ArrowLeft className="size-4" /> Voltar
      </Button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-3xl">
            {group.emoji ?? "🏆"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{group.name}</h1>
            {group.description && <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {group.points_per_checkin} pts por treino · bônus de {group.streak_bonus_points} pts a cada {group.streak_bonus_every_days} dias
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 font-mono text-sm font-semibold text-primary hover:bg-primary/20"
          >
            {group.invite_code} <Copy className="size-3.5" />
          </button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="size-3.5" /> Compartilhar
          </Button>
          {isOwner ? (
            <ArchiveDialog onConfirm={() => archive.mutate()} pending={archive.isPending} />
          ) : (
            <LeaveDialog onConfirm={() => leave.mutate()} pending={leave.isPending} />
          )}
        </div>
      </div>

      <Tabs defaultValue="ranking" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="atividade">Atividade</TabsTrigger>
          <TabsTrigger value="membros">Membros</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1">
            {(["week", "month", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                  period === p ? "bg-background shadow-soft" : "text-muted-foreground"
                }`}
              >
                {p === "week" ? "Semana" : p === "month" ? "Mês" : "Geral"}
              </button>
            ))}
          </div>
          <ol className="space-y-2">
            {ranking.map((r, i) => {
              const isMe = r.user_id === user.id;
              const isGroupOwner = r.user_id === group.owner_id;
              return (
                <li
                  key={r.user_id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    isMe ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-full font-bold ${
                    i === 0 ? "bg-amber-500/20 text-amber-600" :
                    i === 1 ? "bg-slate-400/20 text-slate-500" :
                    i === 2 ? "bg-orange-700/20 text-orange-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {r.name}
                      {isGroupOwner && <Crown className="size-3.5 text-amber-500" />}
                      {isMe && <span className="text-xs font-normal text-primary">(você)</span>}
                    </p>
                    {r.current_streak > 0 && (
                      <p className="flex items-center gap-1 text-xs text-orange-500">
                        <Flame className="size-3" /> {r.current_streak} dias seguidos
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{r.points}</p>
                    <p className="text-[10px] text-muted-foreground">pts</p>
                  </div>
                </li>
              );
            })}
            {ranking.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Sem pontos no período.</p>
            )}
          </ol>
        </TabsContent>

        <TabsContent value="atividade" className="mt-4">
          {points.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem atividade ainda.</p>
          ) : (
            <ul className="space-y-2">
              {points.slice(0, 60).map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className={`flex size-9 items-center justify-center rounded-full ${
                    p.reason === "streak_bonus" ? "bg-orange-500/10 text-orange-500" : "bg-primary/10 text-primary"
                  }`}>
                    {p.reason === "streak_bonus" ? <Flame className="size-4" /> : <Trophy className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{profileById[p.user_id] ?? "Aluno"}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.reason === "streak_bonus" ? "Bônus de streak" : "Check-in de treino"} ·{" "}
                      {format(new Date(p.checkin_date), "d MMM", { locale: ptBR })}
                    </p>
                  </div>
                  <span className="font-bold text-primary">+{p.points}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="membros" className="mt-4">
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold uppercase">
                  {(profileById[m.user_id] ?? "?").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {profileById[m.user_id] ?? "Aluno"}
                    {m.user_id === group.owner_id && <Crown className="size-3.5 text-amber-500" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maior sequência: {m.longest_streak} dias · entrou em {format(new Date(m.joined_at), "d MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaveDialog({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><LogOut className="size-3.5" /> Sair</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sair do grupo?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Você pode voltar depois usando o código de convite. Seu streak reinicia.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Sair"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Archive className="size-3.5" /> Arquivar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arquivar grupo?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Ninguém mais consegue entrar via código. Os membros atuais ainda veem o histórico.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Arquivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
