import { bridged } from "@/lib/server-bridge";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Smartphone, Share, MoreVertical, UserPlus, Unlink, Bell, ChevronRight, Ruler, BarChart3 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { syncInvalidate, RECOVERY_SYNC_KEYS } from "@/lib/cross-tab-sync";
import { getMyTrainer, linkTrainerByCode, unlinkMyTrainer, linkStudentByCode } from "@/lib/trainer.functions";
import { computeCyclePhase } from "@/lib/cycle";
import { DataManagement } from "@/components/DataManagement";
import { StravaConnect } from "@/components/StravaConnect";
import { Skeleton } from "@/components/ui/skeleton";
import { performLogout } from "@/lib/logout";
import { saveUserAiConfig, getUserAiConfig, deleteUserAiConfig, validateAiKey } from "@/lib/ai-config.functions";
import { Eye, EyeOff, Check, X, Shield, Trash2, Save, RefreshCw } from "lucide-react";




function calcAge(birth?: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}


export const Route = createFileRoute("/_authenticated/app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user, isTrainer } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { writeUpdate } = await import("@/lib/offline-writes");
      await writeUpdate("profiles", { id: user.id }, patch);
    },
    onMutate: async (patch: any) => {
      await qc.cancelQueries({ queryKey: ["profile", user.id] });
      const prev = qc.getQueryData<any>(["profile", user.id]);
      qc.setQueryData<any>(["profile", user.id], (old: any) => ({ ...(old ?? {}), ...patch }));
      return { prev };
    },
    onError: (e: any, _patch, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["profile", user.id], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => {
      syncInvalidate(qc, [["profile"], ...RECOVERY_SYNC_KEYS]);
      toast.success("Perfil atualizado");
    },
  });

  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await performLogout(qc, { unsubscribePush: true });
    } catch (e: any) {
      setSigningOut(false);
      toast.error(e?.message ?? "Não foi possível sair. Tente novamente.");
    }
  }

  if (!profile) {
    return (
      <div className="app-container max-w-2xl space-y-4 pt-8 sm:max-w-2xl" aria-busy>
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="card-soft h-32 w-full" />
        <Skeleton className="card-soft h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="app-container max-w-2xl pt-8 sm:max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      {isTrainer ? (
        <TrainerProfile profile={profile} update={update} userId={user.id} />
      ) : (
        <StudentProfile profile={profile} update={update} />
      )}

      <Link
        to="/app/notificacoes"
        className="card-soft mt-4 flex items-center gap-3 p-4 hover:bg-accent/40 transition"
      >
        <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Bell className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Notificações</p>
          <p className="text-xs text-muted-foreground">Ative ou desative por categoria</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <Link
        to="/app/medidas"
        className="card-soft mt-3 flex items-center gap-3 p-4 hover:bg-accent/40 transition"
      >
        <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Ruler className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Medidas e fotos</p>
          <p className="text-xs text-muted-foreground">Peso, medidas corporais e fotos de progresso</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <Link
        to="/app/volume"
        className="card-soft mt-3 flex items-center gap-3 p-4 hover:bg-accent/40 transition"
      >
        <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
          <BarChart3 className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Volume semanal</p>
          <p className="text-xs text-muted-foreground">Séries por grupo muscular na semana</p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <DataManagement userId={user.id} displayName={profile.display_name ?? null} />

      <StravaConnect />


      <InstallInstructions />

      <AiKeyManager />


      <Button variant="outline" onClick={signOut} disabled={signingOut} className="mt-6 w-full">
        <LogOut className="size-4" /> {signingOut ? "Saindo…" : "Sair da conta"}
      </Button>
    </div>
  );
}

function StudentProfile({ profile, update }: { profile: any; update: any }) {
  return (
    <>
      {profile.invite_code && (
        <div className="card-soft mt-5 p-4">
          <p className="text-eyebrow text-muted-foreground">Seu código de convite</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="font-display text-2xl font-black tracking-widest">{profile.invite_code}</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(profile.invite_code!);
                toast.success("Código copiado");
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              Copiar
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Envie ao seu professor, ou use o código dele abaixo para vincular vocês dois.</p>
        </div>
      )}

      <MyTrainerCard />





      <div className="card-soft mt-6 space-y-5 p-5">
        <div className="space-y-1.5">
          <Label>Como podemos te chamar?</Label>
          <Input
            defaultValue={profile.display_name ?? ""}
            onBlur={(e) => e.target.value !== (profile.display_name ?? "") && update.mutate({ display_name: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sexo biológico</Label>
            <Select
              value={profile.sex ?? undefined}
              onValueChange={(v) =>
                update.mutate(
                  v !== "feminino"
                    ? { sex: v, cycle_tracking_enabled: false }
                    : { sex: v },
                )
              }
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro / prefiro não dizer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data de nascimento{profile.birth_date ? ` · ${calcAge(profile.birth_date)} anos` : ""}</Label>
            <Input
              type="date"
              defaultValue={profile.birth_date ?? ""}
              max={new Date().toISOString().slice(0, 10)}
              onBlur={(e) => e.target.value !== (profile.birth_date ?? "") && update.mutate({ birth_date: e.target.value || null })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Altura (cm)</Label>
            <Input
              type="number"
              step="0.1"
              min={100}
              max={250}
              defaultValue={profile.height_cm ?? ""}
              onBlur={(e) => {
                const n = e.target.value ? Number(e.target.value) : null;
                if (n !== profile.height_cm && (n === null || (n >= 100 && n <= 250))) update.mutate({ height_cm: n });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.1"
              min={30}
              max={300}
              defaultValue={profile.weight_kg ?? ""}
              onBlur={(e) => {
                const n = e.target.value ? Number(e.target.value) : null;
                if (n !== profile.weight_kg && (n === null || (n >= 30 && n <= 300))) update.mutate({ weight_kg: n });
              }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Nível de experiência</Label>
          <Select value={profile.experience_level ?? "iniciante"} onValueChange={(v) => update.mutate({ experience_level: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="iniciante">Iniciante (0-1 ano)</SelectItem>
              <SelectItem value="intermediario">Intermediário (1-3 anos)</SelectItem>
              <SelectItem value="avancado">Avançado (3+ anos)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Objetivo principal</Label>
          <Select value={profile.goal ?? "hipertrofia"} onValueChange={(v) => update.mutate({ goal: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hipertrofia">Hipertrofia (ganho de massa)</SelectItem>
              <SelectItem value="forca">Força</SelectItem>
              <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
              <SelectItem value="condicionamento">Condicionamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nível de atividade fora do treino</Label>
          <Select value={profile.activity_level ?? undefined} onValueChange={(v) => update.mutate({ activity_level: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentario">Sedentário (trabalho parado, pouca caminhada)</SelectItem>
              <SelectItem value="leve">Leve (caminhadas ocasionais)</SelectItem>
              <SelectItem value="moderado">Moderado (em pé / andando boa parte do dia)</SelectItem>
              <SelectItem value="ativo">Ativo (trabalho físico ou muitos passos)</SelectItem>
              <SelectItem value="muito_ativo">Muito ativo (trabalho braçal pesado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Frequência semanal (dias)</Label>
          <Input
            type="number"
            min={1}
            max={7}
            defaultValue={profile.weekly_frequency ?? 4}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 7 && n !== profile.weekly_frequency) update.mutate({ weekly_frequency: n });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Lesões, dores ou limitações</Label>
          <Textarea
            rows={3}
            placeholder="Ex.: dor lombar, tendinite no ombro direito, joelho sensível a agachamento profundo…"
            defaultValue={profile.injuries ?? ""}
            onBlur={(e) => e.target.value !== (profile.injuries ?? "") && update.mutate({ injuries: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">O app evita movimentos que agravem essas áreas.</p>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium">Uso anabolizantes ou SARMs</p>
            <p className="text-xs text-muted-foreground">Substâncias que aceleram ganho de massa (ex: esteroides). O app aumenta o volume dos treinos.</p>

          </div>
          <Switch
            checked={!!profile.uses_enhancers}
            onCheckedChange={(v) => update.mutate({ uses_enhancers: v })}
          />
        </div>
      </div>

      {profile.sex === "feminino" && <CycleCard profile={profile} update={update} />}
    </>
  );
}

function CycleCard({ profile, update }: { profile: any; update: any }) {
  const enabled = !!profile.cycle_tracking_enabled;
  const info = enabled
    ? computeCyclePhase({
        lastPeriodStart: profile.cycle_last_period_start,
        cycleLength: profile.cycle_length_days,
        periodLength: profile.cycle_period_length_days,
      })
    : null;

  return (
    <div className="card-soft relative mt-5 overflow-hidden p-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden />
      <div className="pl-2 space-y-5">
        <div>
          <p className="text-eyebrow text-muted-foreground">Ciclo menstrual</p>
          <p className="mt-1 font-display text-lg font-bold leading-tight">Acompanhamento do ciclo</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O app ajusta carga e descanso conforme sua fase (menstrual, folicular, ovulação, lútea).
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium">Acompanhar ciclo menstrual</p>
            <p className="text-xs text-muted-foreground">Ative pra ver a fase atual no Início e ter treinos adaptados.</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => update.mutate({ cycle_tracking_enabled: v })}
          />
        </div>

        {enabled && (
          <>
            <div className="space-y-1.5">
              <Label>Último início da menstruação</Label>
              <Input
                type="date"
                defaultValue={profile.cycle_last_period_start ?? ""}
                max={new Date().toISOString().slice(0, 10)}
                onBlur={(e) =>
                  e.target.value !== (profile.cycle_last_period_start ?? "") &&
                  update.mutate({ cycle_last_period_start: e.target.value || null })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Duração do ciclo (dias)</Label>
                <Input
                  type="number"
                  min={20}
                  max={45}
                  defaultValue={profile.cycle_length_days ?? 28}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 20 && n <= 45 && n !== profile.cycle_length_days) update.mutate({ cycle_length_days: n });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duração da menstruação (dias)</Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  defaultValue={profile.cycle_period_length_days ?? 5}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 2 && n <= 10 && n !== profile.cycle_period_length_days)
                      update.mutate({ cycle_period_length_days: n });
                  }}
                />
              </div>
            </div>

            {info && (
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-eyebrow text-muted-foreground">Fase atual</p>
                <p className="mt-1 font-display text-base font-bold">
                  {info.phaseLabel} · dia {info.dayInCycle}/{info.cycleLength}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{info.recommendation}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TrainerProfile({ profile, update, userId }: { profile: any; update: any; userId: string }) {
  const { data: studentCount } = useQuery({
    queryKey: ["trainer-student-count", userId],
    queryFn: async () => {
      const { count } = await supabase
        .from("trainer_students")
        .select("*", { count: "exact", head: true })
        .eq("trainer_id", userId);
      return count ?? 0;
    },
  });

  return (
    <>
      <div className="card-soft mt-5 flex items-center gap-3 p-4">
        <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground text-lg">👨‍🏫</div>
        <div className="flex-1">
          <p className="font-semibold">Você é professor(a)</p>
          <p className="text-xs text-muted-foreground">
            {studentCount ?? 0} {studentCount === 1 ? "aluno vinculado" : "alunos vinculados"} · use a aba <b>Alunos</b> para gerenciar.
          </p>
        </div>
      </div>

      <LinkStudentCard userId={userId} />


      <div className="card-soft mt-6 space-y-5 p-5">
        <h2 className="text-lg font-semibold">Dados profissionais</h2>

        <div className="space-y-1.5">

          <Label>Nome público</Label>
          <Input
            defaultValue={profile.display_name ?? ""}
            placeholder="Como seus alunos te encontram"
            maxLength={60}
            onBlur={(e) => e.target.value !== (profile.display_name ?? "") && update.mutate({ display_name: e.target.value.trim().slice(0, 60) })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>CREF (opcional)</Label>
            <Input
              defaultValue={profile.cref ?? ""}
              placeholder="Ex.: 123456-G/SP"
              maxLength={20}
              onBlur={(e) => e.target.value !== (profile.cref ?? "") && update.mutate({ cref: e.target.value.trim().slice(0, 20) || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Anos de experiência</Label>
            <Input
              type="number"
              min={0}
              max={70}
              defaultValue={profile.years_experience ?? ""}
              onBlur={(e) => {
                const n = e.target.value ? Number(e.target.value) : null;
                if (n !== profile.years_experience && (n === null || (Number.isFinite(n) && n >= 0 && n <= 70))) update.mutate({ years_experience: n });
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input
              defaultValue={profile.city ?? ""}
              placeholder="Ex.: São Paulo, SP"
              maxLength={80}
              onBlur={(e) => e.target.value !== (profile.city ?? "") && update.mutate({ city: e.target.value.trim().slice(0, 80) || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp / contato</Label>
            <Input
              defaultValue={profile.contact_phone ?? ""}
              placeholder="Ex.: (11) 99999-9999"
              maxLength={20}
              onBlur={(e) => e.target.value !== (profile.contact_phone ?? "") && update.mutate({ contact_phone: e.target.value.trim().slice(0, 20) || null })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Especialidades</Label>
          <Input
            defaultValue={profile.specialties ?? ""}
            placeholder="Ex.: hipertrofia, emagrecimento, reabilitação"
            maxLength={120}
            onBlur={(e) => e.target.value !== (profile.specialties ?? "") && update.mutate({ specialties: e.target.value.trim().slice(0, 120) || null })}
          />
          <p className="text-xs text-muted-foreground">Separe por vírgulas.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Bio</Label>
          <Textarea
            rows={4}
            maxLength={500}
            placeholder="Fale um pouco sobre sua abordagem, formação e como você trabalha com os alunos…"
            defaultValue={profile.bio ?? ""}
            onBlur={(e) => e.target.value !== (profile.bio ?? "") && update.mutate({ bio: e.target.value.trim().slice(0, 500) || null })}
          />
        </div>
      </div>
    </>
  );
}


function LinkStudentCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const linkFn = bridged("trainer.linkStudentByCode", linkStudentByCode);

  const link = useMutation({
    mutationFn: (invite_code: string) => linkFn({ data: { invite_code } }),
    onSuccess: (res: any) => {
      setCode("");
      qc.invalidateQueries({ queryKey: ["trainer-student-count", userId] });
      qc.invalidateQueries({ queryKey: ["trainer-students"] });
      toast.success(`Aluno ${res?.student?.display_name ?? ""} vinculado!`);
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível vincular."),
  });

  return (
    <div className="card-soft mt-5 p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4" />
        <p className="text-eyebrow text-muted-foreground">Vincular um aluno</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Peça o código do aluno (formato <b>CRG-XXXX</b>) e insira abaixo para vinculá-lo à sua lista.
      </p>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = code.trim();
          if (trimmed.length < 4) {
            toast.error("Código inválido.");
            return;
          }
          link.mutate(trimmed);
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CRG-XXXX"
          maxLength={20}
          className="uppercase"
        />
        <Button type="submit" disabled={link.isPending}>
          {link.isPending ? "Vinculando..." : "Vincular"}
        </Button>
      </form>
    </div>
  );
}

function MyTrainerCard() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);

  const getFn = bridged("trainer.getMyTrainer", getMyTrainer);
  const linkFn = bridged("trainer.linkTrainerByCode", linkTrainerByCode);
  const unlinkFn = bridged("trainer.unlinkMyTrainer", unlinkMyTrainer);

  const { data, isLoading } = useQuery({
    queryKey: ["my-trainer"],
    queryFn: () => getFn(),
  });

  const link = useMutation({
    mutationFn: (invite_code: string) => linkFn({ data: { invite_code } }),
    onSuccess: () => {
      setCode("");
      qc.invalidateQueries({ queryKey: ["my-trainer"] });
      toast.success("Professor vinculado!");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível vincular."),
  });

  const unlink = useMutation({
    mutationFn: () => unlinkFn(),
    onSuccess: () => {
      setConfirmingUnlink(false);
      qc.invalidateQueries({ queryKey: ["my-trainer"] });
      toast.success("Vínculo removido.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao desvincular."),
  });

  if (isLoading) {
    return (
      <div className="card-soft mt-5 flex items-center gap-3 p-4" aria-busy>
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }

  const trainer = data?.trainer;

  if (trainer) {
    return (
      <div className="card-soft mt-5 p-4">
        <p className="text-eyebrow text-muted-foreground">Seu professor</p>
        <div className="mt-2 flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground text-lg">👨‍🏫</div>
          <div className="flex-1">
            <p className="font-semibold">{trainer.display_name ?? "Professor(a)"}</p>
            {trainer.cref && <p className="text-xs text-muted-foreground">CREF {trainer.cref}</p>}
            {trainer.city && <p className="text-xs text-muted-foreground">{trainer.city}</p>}
            {trainer.specialties && <p className="mt-1 text-xs text-muted-foreground">Especialidades: {trainer.specialties}</p>}
            {trainer.contact_phone && <p className="mt-1 text-xs text-muted-foreground">Contato: {trainer.contact_phone}</p>}
          </div>
        </div>
        {confirmingUnlink ? (
          <div className="mt-3 flex items-center gap-2">
            <Button variant="destructive" size="sm" disabled={unlink.isPending} onClick={() => unlink.mutate()}>
              Confirmar desvincular
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmingUnlink(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingUnlink(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive"
          >
            <Unlink className="size-3.5" /> Desvincular professor
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card-soft mt-5 p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4" />
        <p className="text-eyebrow text-muted-foreground">Vincular um professor</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Insira o código do seu professor (formato <b>CRG-XXXX</b>) para receber treinos direto no app.
      </p>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const c = code.trim().toUpperCase();
          if (c.length < 4) return toast.error("Código inválido.");
          link.mutate(c);
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CRG-XXXX"
          maxLength={20}
          className="font-mono tracking-widest uppercase"
        />
        <Button type="submit" disabled={link.isPending || code.trim().length < 4}>
          {link.isPending ? "Vinculando..." : "Vincular"}
        </Button>
      </form>
    </div>
  );
}

function InstallInstructions() {

  return (
    <div className="card-soft mt-6 p-5">
      <div className="flex items-center gap-2">
        <div className="grid size-10 place-items-center rounded-lg bg-secondary">
          <Smartphone className="size-5" />
        </div>
        <h2 className="text-lg font-semibold">Instale o Carga como app</h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        O Carga funciona como um aplicativo no seu celular — com ícone na tela inicial e abertura em tela cheia, sem baixar nada da loja. Faça uma única vez:
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="size-4" /> No Android
          </h3>
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>1. Abra este site no seu navegador (Chrome, Edge, Samsung Internet, Opera, Brave…).</li>
            <li>2. Toque no menu <MoreVertical className="inline size-4 align-text-bottom" /> (geralmente três pontinhos, no canto superior).</li>
            <li>3. Escolha <strong>“Instalar aplicativo”</strong> ou <strong>“Adicionar à tela inicial”</strong>.</li>
            <li>4. Confirme. O ícone aparece na tela inicial como qualquer app.</li>
          </ol>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="size-4" /> No iPhone
          </h3>
          <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>1. Abra este site no seu navegador (Safari, Chrome, Edge, Firefox…).</li>
            <li>2. Toque no botão <strong>Compartilhar</strong> <Share className="inline size-4 align-text-bottom" /> (quadrado com seta pra cima — no Safari fica na barra de baixo; no Chrome/Edge, dentro do menu <MoreVertical className="inline size-4 align-text-bottom" />).</li>
            <li>3. Role até <strong>“Adicionar à Tela de Início”</strong> e toque.</li>
            <li>4. Confirme em <strong>“Adicionar”</strong>. Pronto.</li>
          </ol>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Depois de instalado, abra sempre pelo ícone do Carga para ter a experiência em tela cheia.
      </p>
    </div>
  );
}

function AiKeyManager() {
  const qc = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [apiKey, setApiKey] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["user-ai-config"],
    queryFn: () => getUserAiConfig(),
  });

  const validate = useMutation({
    mutationFn: (data: { provider: any; api_key: string }) => validateAiKey({ data }),
    onSuccess: (res) => {
      if (res.valid) {
        setIsValidated(true);
        toast.success("Chave válida ✅");
      } else {
        setIsValidated(false);
        toast.error("Chave inválida ❌");
      }
    },
    onError: (e: any) => {
      setIsValidated(false);
      toast.error(e.message || "Erro ao validar chave");
    },
  });

  const save = useMutation({
    mutationFn: (data: { provider: any; api_key: string }) => saveUserAiConfig({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-ai-config"] });
      toast.success("Configurações de IA salvas");
      setIsValidated(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteUserAiConfig(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-ai-config"] });
      setApiKey("");
      setIsValidated(false);
      toast.success("Chave removida");
    },
  });

  if (isLoading) return null;

  return (
    <div className="card-soft mt-6 p-5">
      <div className="flex items-center gap-2">
        <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Shield className="size-5" />
        </div>
        <h2 className="text-lg font-semibold">Configurações de IA Própria</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Use sua própria chave de API para ter sugestões personalizadas e recursos avançados.
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label>Provedor</Label>
          <Select
            value={config?.provider || provider}
            onValueChange={(v: any) => {
              setProvider(v);
              setIsValidated(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI (GPT-4o, GPT-3.5)</SelectItem>
              <SelectItem value="anthropic">Anthropic (Claude 3.5 Sonnet, Haiku)</SelectItem>
              <SelectItem value="google">Google Gemini (1.5 Pro, Flash)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Chave de API</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={config?.api_key ? "••••••••••••••••" : "Cole sua chave aqui"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setIsValidated(false);
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button
              variant="outline"
              size="icon"
              disabled={validate.isPending || !apiKey}
              onClick={() => validate.mutate({ provider, api_key: apiKey })}
            >
              {validate.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : isValidated ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          {config ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="mr-2 size-4" /> Remover chave
            </Button>
          ) : (
            <div />
          )}
          
          <Button
            size="sm"
            disabled={!isValidated || save.isPending}
            onClick={() => save.mutate({ provider, api_key: apiKey })}
          >
            <Save className="mr-2 size-4" /> {save.isPending ? "Salvando..." : "Salvar Chave"}
          </Button>
        </div>

        {config && !apiKey && (
          <p className="text-center text-[10px] text-muted-foreground">
            Uma chave já está salva. Para alterá-la, cole a nova acima e valide.
          </p>
        )}
      </div>
    </div>
  );
}


