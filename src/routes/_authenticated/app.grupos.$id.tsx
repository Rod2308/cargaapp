import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft, Copy, Flame, Trophy, Share2, LogOut, Archive, Loader2, Crown,
  Clock, Send, Settings, MessageCircle, BarChart3, Trash2, Check, X, UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNotificationPrefs } from "@/hooks/useNotificationPrefs";
import { NotificationSettingsDialog } from "@/components/NotificationSettingsDialog";
import { toast } from "sonner";
import {
  format, startOfWeek, startOfMonth, differenceInCalendarDays, isAfter,
} from "date-fns";
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
  starts_at: string | null;
  ends_at: string | null;
  daily_points_cap: number | null;
  weekly_points_cap: number | null;
  join_mode: "open" | "approval";
  monthly_points_cap: number | null;
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

type ChatMsg = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
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
        .limit(500);
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

  const myRank = useMemo(() => {
    const idx = ranking.findIndex((r) => r.user_id === user.id);
    return idx >= 0 ? { position: idx + 1, points: ranking[idx].points } : null;
  }, [ranking, user.id]);

  // Personal stats (all-time within group)
  const myStats = useMemo(() => {
    const mine = points.filter((p) => p.user_id === user.id);
    const totalPoints = mine.reduce((s, p) => s + p.points, 0);
    const checkins = mine.filter((p) => p.reason === "checkin").length;
    const activeDays = new Set(mine.filter((p) => p.reason === "checkin").map((p) => p.checkin_date)).size;
    const me = members.find((m) => m.user_id === user.id);
    const joined = me ? new Date(me.joined_at) : null;
    const spanDays = joined
      ? Math.max(1, differenceInCalendarDays(new Date(), joined) + 1)
      : 1;
    const avgPerDay = checkins / spanDays;
    return { totalPoints, checkins, activeDays, avgPerDay };
  }, [points, members, user.id]);

  // Deadline
  const deadline = group?.ends_at ? new Date(group.ends_at) : null;
  const startsAt = group?.starts_at ? new Date(group.starts_at) : null;
  const daysLeft = deadline ? differenceInCalendarDays(deadline, new Date()) : null;
  const expired = deadline ? isAfter(new Date(), deadline) : false;
  const notStarted = startsAt ? isAfter(startsAt, new Date()) : false;

  // Per-member all-time stats
  const memberStats = useMemo(() => {
    const map = new Map<string, { checkins: number; activeDays: number; points: number; avg: number }>();
    for (const m of members) {
      const mine = points.filter((p) => p.user_id === m.user_id);
      const checkins = mine.filter((p) => p.reason === "checkin").length;
      const activeDays = new Set(mine.filter((p) => p.reason === "checkin").map((p) => p.checkin_date)).size;
      const pts = mine.reduce((s, p) => s + p.points, 0);
      const joined = new Date(m.joined_at);
      const span = Math.max(1, differenceInCalendarDays(new Date(), joined) + 1);
      map.set(m.user_id, { checkins, activeDays, points: pts, avg: checkins / span });
    }
    return map;
  }, [members, points]);

  // Notifications: rank changes, deadline approaching, other members' check-ins
  const { prefs: notifPrefs } = useNotificationPrefs();
  const notifyBrowser = (title: string, body: string) => {
    if (!notifPrefs.webPush) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden) return;
    try { new Notification(title, { body }); } catch {}
  };

  const prevRankRef = useRef<number | null>(null);
  useEffect(() => {
    if (!myRank) return;
    const prev = prevRankRef.current;
    if (prev !== null && prev !== myRank.position && notifPrefs.rankChange) {
      if (myRank.position < prev) {
        toast.success(`Você subiu para #${myRank.position} no ranking!`);
        notifyBrowser("Subiu no ranking", `Agora você está em #${myRank.position}`);
      } else {
        toast.info(`Você caiu para #${myRank.position} no ranking`);
        notifyBrowser("Mudança no ranking", `Você caiu para #${myRank.position}`);
      }
    }
    prevRankRef.current = myRank.position;
  }, [myRank, notifPrefs.rankChange, notifPrefs.webPush]);

  const deadlineWarnedRef = useRef(false);
  useEffect(() => {
    if (deadlineWarnedRef.current || daysLeft === null || expired) return;
    if (!notifPrefs.deadline) return;
    if (daysLeft >= 0 && daysLeft <= 3) {
      const msg = daysLeft === 0 ? "O desafio termina hoje!" : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} para o fim do desafio`;
      toast.warning(msg);
      notifyBrowser("Prazo se aproximando", msg);
      deadlineWarnedRef.current = true;
    }
  }, [daysLeft, expired, notifPrefs.deadline, notifPrefs.webPush]);

  useEffect(() => {
    const ch = supabase
      .channel(`group-points-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_points", filter: `group_id=eq.${id}` },
        (payload) => {
          const row = payload.new as PointRow;
          qc.invalidateQueries({ queryKey: ["group-points", id] });
          qc.invalidateQueries({ queryKey: ["group-members", id] });
          if (row.user_id !== user.id && row.reason === "checkin" && notifPrefs.otherCheckins) {
            const name = profileById[row.user_id] ?? "Um membro";
            toast(`${name} fez check-in (+${row.points} pts)`, { icon: "🏋️" });
            notifyBrowser("Novo check-in no grupo", `${name} +${row.points} pts`);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc, user.id, profileById, notifPrefs.otherCheckins, notifPrefs.webPush]);


  const isOwner = group?.owner_id === user.id;
  const inviteUrl = typeof window !== "undefined" && group
    ? `${window.location.origin}/g/${group.invite_code}`
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

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desafio apagado");
      qc.invalidateQueries({ queryKey: ["my-groups"] });
      navigate({ to: "/app/grupos" });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao apagar"),
  });

  async function copyToClipboard(value: string): Promise<boolean> {
    try {
      if (navigator?.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function share() {
    if (!group) return;
    const text = `Bora treinar comigo no Carga? Entre no grupo "${group.name}" com o código ${group.invite_code} ou pelo link: ${inviteUrl}`;
    const payload = { title: `Grupo ${group.name}`, text, url: inviteUrl };
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function"
          && (!navigator.canShare || navigator.canShare(payload))) {
        await navigator.share(payload);
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // iOS/Android podem falhar com NotAllowedError em iframes — cai no fallback.
    }
    const ok = await copyToClipboard(text);
    if (ok) toast.success("Convite copiado para a área de transferência");
    else toast.error(`Não foi possível copiar. Código: ${group.invite_code}`);
  }

  async function copyCode() {
    if (!group) return;
    const ok = await copyToClipboard(group.invite_code);
    if (ok) toast.success("Código copiado");
    else toast.error("Não foi possível copiar o código");
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
              {group.points_per_checkin} pts por treino · bônus {group.streak_bonus_points} pts a cada {group.streak_bonus_every_days} dias
            </p>
          </div>
        </div>

        {/* Deadline + my rank */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className={`rounded-xl border p-3 ${expired ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"}`}>
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
              <Clock className="size-3" /> Prazo
            </p>
            {deadline ? (
              expired ? (
                <p className="mt-0.5 text-sm font-bold text-destructive">Encerrado</p>
              ) : notStarted ? (
                <>
                  <p className="mt-0.5 text-sm font-bold">Aguardando início</p>
                  <p className="text-[11px] text-muted-foreground">começa {format(startsAt!, "d MMM", { locale: ptBR })}</p>
                </>
              ) : daysLeft === 0 ? (
                <>
                  <p className="mt-0.5 text-lg font-bold text-amber-600">Termina hoje!</p>
                  <p className="text-[11px] text-muted-foreground">até {format(deadline, "d MMM yyyy HH:mm", { locale: ptBR })}</p>
                </>
              ) : (
                <>
                  <p className="mt-0.5 text-lg font-bold">{daysLeft} {daysLeft === 1 ? "dia" : "dias"}</p>
                  <p className="text-[11px] text-muted-foreground">até {format(deadline, "d MMM yyyy", { locale: ptBR })}</p>
                </>
              )
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">Sem prazo</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Sua posição</p>
            {myRank ? (
              <>
                <p className="mt-0.5 text-lg font-bold">#{myRank.position} <span className="text-xs font-normal text-muted-foreground">de {ranking.length}</span></p>
                <p className="text-[11px] text-muted-foreground">{myRank.points} pts {period === "week" ? "na semana" : period === "month" ? "no mês" : "no total"}</p>
              </>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {(group.daily_points_cap || group.weekly_points_cap || group.monthly_points_cap) && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Limites de pontos —
            {group.daily_points_cap ? ` ${group.daily_points_cap}/dia` : ""}
            {group.weekly_points_cap ? ` · ${group.weekly_points_cap}/semana` : ""}
            {group.monthly_points_cap ? ` · ${group.monthly_points_cap}/mês` : ""}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 font-mono text-sm font-semibold text-primary hover:bg-primary/20"
          >
            {group.invite_code} <Copy className="size-3.5" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!inviteUrl) return;
              const ok = await copyToClipboard(inviteUrl);
              if (ok) toast.success("Link de convite copiado");
              else toast.error("Não foi possível copiar o link");
            }}
          >

            <Copy className="size-3.5" /> Copiar link
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="size-3.5" /> Compartilhar
          </Button>
          <NotificationSettingsDialog />
          {isOwner && <GroupSettingsDialog group={group} />}
          {isOwner ? (
            <>
              <ArchiveDialog onConfirm={() => archive.mutate()} pending={archive.isPending} />
              <DeleteGroupDialog onConfirm={() => remove.mutate()} pending={remove.isPending} />
            </>
          ) : (
            <LeaveDialog onConfirm={() => leave.mutate()} pending={leave.isPending} />
          )}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          Modo de entrada: <span className="font-semibold">{group.join_mode === "approval" ? "requer aprovação do dono" : "aberto por código"}</span>
        </p>

        {isOwner && <PendingRequestsPanel groupId={group.id} />}
      </div>

      <Tabs defaultValue="ranking" className="mt-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="chat"><MessageCircle className="size-3.5" /></TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="size-3.5" /></TabsTrigger>
          <TabsTrigger value="atividade">Feed</TabsTrigger>
          <TabsTrigger value="membros">Membros</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex flex-1 gap-1 rounded-lg bg-muted p-1">
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
            <Button asChild size="sm" variant="outline">
              <Link to="/app/grupos/$id/classificacao" params={{ id: group.id }}>
                Ver classificação completa
              </Link>
            </Button>
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

        <TabsContent value="chat" className="mt-4">
          <GroupChat groupId={id} userId={user.id} isOwner={isOwner} profileById={profileById} />
        </TabsContent>

        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Check-ins totais" value={myStats.checkins} />
            <StatCard label="Dias ativos" value={myStats.activeDays} />
            <StatCard label="Média check-ins/dia" value={myStats.avgPerDay.toFixed(2)} />
            <StatCard label="Pontos totais" value={myStats.totalPoints} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Estatísticas contadas desde que você entrou no grupo.
          </p>
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
            {members.map((m) => {
              const s = memberStats.get(m.user_id);
              return (
                <li key={m.user_id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold uppercase">
                      {(profileById[m.user_id] ?? "?").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        {profileById[m.user_id] ?? "Aluno"}
                        {m.user_id === group.owner_id && <Crown className="size-3.5 text-amber-500" />}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Maior sequência: {m.longest_streak} dias · desde {format(new Date(m.joined_at), "d MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {s && (
                    <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                      <MiniStat label="Check-ins" value={s.checkins} />
                      <MiniStat label="Dias ativos" value={s.activeDays} />
                      <MiniStat label="Média/dia" value={s.avg.toFixed(2)} />
                      <MiniStat label="Pontos" value={s.points} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-1 py-1.5">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function PendingRequestsPanel({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const { data: requests = [] } = useQuery({
    queryKey: ["group-requests", groupId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_join_requests")
        .select("id, user_id, created_at, status")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Array<{ id: string; user_id: string; created_at: string; status: string }>;
    },
  });

  const ids = requests.map((r) => r.user_id);
  const { data: profs = [] } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["group-requests-profiles", groupId, ids.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
  const nameById = Object.fromEntries((profs as any[]).map((p) => [p.id, p.display_name || "Aluno"]));

  useEffect(() => {
    const ch = supabase
      .channel(`group-requests-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_join_requests", filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ["group-requests", groupId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, qc]);

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await (supabase as any).rpc("decide_join_request", { _id: id, _approve: approve });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Membro aprovado" : "Pedido recusado");
      qc.invalidateQueries({ queryKey: ["group-requests", groupId] });
      qc.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  if (requests.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-500">
        <UserPlus className="size-3.5" /> {requests.length} pedido{requests.length > 1 ? "s" : ""} de entrada
      </p>
      <ul className="mt-2 space-y-1.5">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-lg bg-background p-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
              {(nameById[r.user_id] ?? "?").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{nameById[r.user_id] ?? "Aluno"}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(r.created_at), "d MMM HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: r.id, approve: false })} disabled={decide.isPending}>
              <X className="size-3.5" />
            </Button>
            <Button size="sm" onClick={() => decide.mutate({ id: r.id, approve: true })} disabled={decide.isPending}>
              <Check className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}



function GroupChat({
  groupId, userId, isOwner, profileById,
}: {
  groupId: string; userId: string; isOwner: boolean; profileById: Record<string, string>;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: msgs = [] } = useQuery({
    queryKey: ["group-chat", groupId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_messages")
        .select("id, user_id, content, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ChatMsg[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as ChatMsg;
          qc.setQueryData(["group-chat", groupId], (prev: ChatMsg[] = []) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
          if (m.user_id !== userId && "Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification(profileById[m.user_id] ?? "Nova mensagem", { body: m.content.slice(0, 120) });
          }
        },
      )
      .on(
        "postgres_changes",
        // No filter: DELETE payloads only carry the PK unless REPLICA IDENTITY FULL,
        // so we accept all deletes on the table and drop by id from our local list.
        { event: "DELETE", schema: "public", table: "group_messages" },
        (payload) => {
          const old = payload.old as { id?: string };
          if (!old?.id) {
            qc.invalidateQueries({ queryKey: ["group-chat", groupId] });
            return;
          }
          qc.setQueryData(["group-chat", groupId], (prev: ChatMsg[] = []) => prev.filter((x) => x.id !== old.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, qc, userId, profileById]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.length]);

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      if (!content) return;
      const { error } = await (supabase as any).from("group_messages").insert({
        group_id: groupId, user_id: userId, content,
      });
      if (error) throw error;
    },
    onSuccess: () => setText(""),
    onError: (e: any) => toast.error(e.message ?? "Falha ao enviar"),
  });

  const del = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await (supabase as any).from("group_messages").delete().eq("id", msgId);
      if (error) throw error;
      return msgId;
    },
    onSuccess: (msgId) => {
      qc.setQueryData(["group-chat", groupId], (prev: ChatMsg[] = []) => prev.filter((x) => x.id !== msgId));
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao remover"),
  });

  function askNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div ref={scrollRef} className="max-h-[420px] min-h-[240px] space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda. Diga oi!</p>
        ) : (
          msgs.map((m, i) => {
            const mine = m.user_id === userId;
            const canDelete = mine || isOwner;
            const name = mine ? "Você" : (profileById[m.user_id] ?? "Aluno");
            const initials = (profileById[m.user_id] ?? "?")
              .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "?";
            const prev = msgs[i - 1];
            const showHeader = !prev || prev.user_id !== m.user_id ||
              (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60 * 1000;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                <Avatar className={`size-7 shrink-0 ${showHeader ? "" : "invisible"}`}>
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <div className={`group flex max-w-[75%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  {showHeader && (
                    <p className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">{name}</p>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
                    <span title={format(new Date(m.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}>
                      {format(new Date(m.created_at), "d MMM HH:mm", { locale: ptBR })}
                    </span>
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            aria-label="Apagar mensagem"
                            className="text-muted-foreground hover:text-destructive md:opacity-0 md:transition md:group-hover:opacity-100"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A mensagem será removida para todos do grupo.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del.mutate(m.id)}>Apagar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send.mutate(); }}
        onFocus={askNotifications}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem para o grupo…"
          maxLength={1000}
        />
        <Button type="submit" size="sm" disabled={!text.trim() || send.isPending}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

function GroupSettingsDialog({ group }: { group: Group }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState<string>(group.starts_at ? group.starts_at.slice(0, 10) : "");
  const [endsAt, setEndsAt] = useState<string>(group.ends_at ? group.ends_at.slice(0, 10) : "");
  const [daily, setDaily] = useState<string>(group.daily_points_cap?.toString() ?? "");
  const [weekly, setWeekly] = useState<string>(group.weekly_points_cap?.toString() ?? "");
  const [monthly, setMonthly] = useState<string>(group.monthly_points_cap?.toString() ?? "");
  const [joinMode, setJoinMode] = useState<"open" | "approval">(group.join_mode ?? "open");

  const save = useMutation({
    mutationFn: async () => {
      if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
        throw new Error("A data final não pode ser antes da data de início.");
      }
      const patch = {
        starts_at: startsAt ? new Date(startsAt + "T00:00:00").toISOString() : null,
        ends_at: endsAt ? new Date(endsAt + "T23:59:59").toISOString() : null,
        daily_points_cap: daily ? Math.max(0, parseInt(daily, 10)) : null,
        weekly_points_cap: weekly ? Math.max(0, parseInt(weekly, 10)) : null,
        monthly_points_cap: monthly ? Math.max(0, parseInt(monthly, 10)) : null,
        join_mode: joinMode,
      };
      const { error } = await (supabase as any).from("groups").update(patch).eq("id", group.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["group", group.id] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Settings className="size-3.5" /> Configurar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações do desafio</DialogTitle>
          <DialogDescription>Prazo e limites de pontuação por período.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="starts">Início</Label>
              <Input id="starts" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ends">Término</Label>
              <Input id="ends" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Deixe em branco para desafio contínuo (sem prazo).</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="daily">Limite/dia</Label>
              <Input id="daily" type="number" min="0" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="—" />
            </div>
            <div>
              <Label htmlFor="weekly">Limite/semana</Label>
              <Input id="weekly" type="number" min="0" value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="—" />
            </div>
            <div>
              <Label htmlFor="monthly">Limite/mês</Label>
              <Input id="monthly" type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="—" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao atingir o limite, novos check-ins do período não geram mais pontos (mas continuam contando o streak).
          </p>

          <div className="border-t border-border pt-3">
            <Label>Quem pode entrar</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setJoinMode("open")}
                className={`rounded-lg border p-2 text-left text-xs ${joinMode === "open" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <p className="font-semibold text-sm">Aberto</p>
                <p className="text-muted-foreground">Qualquer pessoa com o código entra direto.</p>
              </button>
              <button
                type="button"
                onClick={() => setJoinMode("approval")}
                className={`rounded-lg border p-2 text-left text-xs ${joinMode === "approval" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <p className="font-semibold text-sm">Requer aprovação</p>
                <p className="text-muted-foreground">Você aprova cada solicitação.</p>
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function DeleteGroupDialog({ onConfirm, pending }: { onConfirm: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm"><Trash2 className="size-3.5" /> Apagar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apagar desafio permanentemente?</DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. Todos os membros, pontos, pedidos e mensagens serão removidos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="confirm-delete" className="text-sm">Digite <span className="font-mono font-semibold">APAGAR</span> para confirmar</Label>
          <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="APAGAR" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={pending || confirmText.trim().toUpperCase() !== "APAGAR"}
            onClick={onConfirm}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Apagar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
