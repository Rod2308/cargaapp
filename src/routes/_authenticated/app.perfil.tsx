import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { LogOut, Smartphone, Share, MoreVertical, UserPlus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getMyTrainer, linkTrainerByCode, unlinkMyTrainer, linkStudentByCode } from "@/lib/trainer.functions";


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
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!profile) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="app-container max-w-2xl pt-8 sm:max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      {isTrainer ? (
        <TrainerProfile profile={profile} update={update} userId={user.id} />
      ) : (
        <StudentProfile profile={profile} update={update} />
      )}

      <InstallInstructions />

      <Button variant="outline" onClick={signOut} className="mt-6 w-full">
        <LogOut className="size-4" /> Sair da conta
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
            <Select value={profile.sex ?? undefined} onValueChange={(v) => update.mutate({ sex: v })}>
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
          <p className="text-xs text-muted-foreground">O coach evita movimentos que agravem essas áreas.</p>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium">Uso anabolizantes ou SARMs</p>
            <p className="text-xs text-muted-foreground">Substâncias que aceleram ganho de massa (ex: esteroides). O coach aumenta o volume dos treinos.</p>

          </div>
          <Switch
            checked={!!profile.uses_enhancers}
            onCheckedChange={(v) => update.mutate({ uses_enhancers: v })}
          />
        </div>
      </div>
    </>
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

      <div className="card-soft mt-6 space-y-5 p-5">
        <h2 className="text-lg font-semibold">Dados profissionais</h2>

        <div className="space-y-1.5">
          <Label>Nome público</Label>
          <Input
            defaultValue={profile.display_name ?? ""}
            placeholder="Como seus alunos te encontram"
            onBlur={(e) => e.target.value !== (profile.display_name ?? "") && update.mutate({ display_name: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>CREF (opcional)</Label>
            <Input
              defaultValue={profile.cref ?? ""}
              placeholder="Ex.: 123456-G/SP"
              onBlur={(e) => e.target.value !== (profile.cref ?? "") && update.mutate({ cref: e.target.value || null })}
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
                if (n !== profile.years_experience && (n === null || (n >= 0 && n <= 70))) update.mutate({ years_experience: n });
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
              onBlur={(e) => e.target.value !== (profile.city ?? "") && update.mutate({ city: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp / contato</Label>
            <Input
              defaultValue={profile.contact_phone ?? ""}
              placeholder="Ex.: (11) 99999-9999"
              onBlur={(e) => e.target.value !== (profile.contact_phone ?? "") && update.mutate({ contact_phone: e.target.value || null })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Especialidades</Label>
          <Input
            defaultValue={profile.specialties ?? ""}
            placeholder="Ex.: hipertrofia, emagrecimento, reabilitação"
            onBlur={(e) => e.target.value !== (profile.specialties ?? "") && update.mutate({ specialties: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">Separe por vírgulas.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Bio</Label>
          <Textarea
            rows={4}
            placeholder="Fale um pouco sobre sua abordagem, formação e como você trabalha com os alunos…"
            defaultValue={profile.bio ?? ""}
            onBlur={(e) => e.target.value !== (profile.bio ?? "") && update.mutate({ bio: e.target.value || null })}
          />
        </div>
      </div>
    </>
  );
}

function MyTrainerCard() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);

  const getFn = useServerFn(getMyTrainer);
  const linkFn = useServerFn(linkTrainerByCode);
  const unlinkFn = useServerFn(unlinkMyTrainer);

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
    return <div className="card-soft mt-5 p-4 text-sm text-muted-foreground">Carregando...</div>;
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

