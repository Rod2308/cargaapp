import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trophy, Plus, LogIn, Flame, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/grupos/")({
  validateSearch: (s: Record<string, unknown>) => ({
    codigo: typeof s.codigo === "string" ? s.codigo : undefined,
  }),
  component: GruposIndex,
});


const EMOJIS = ["🏆", "🔥", "💪", "🏋️", "🥇", "⚡", "🚀", "🎯", "🏃", "🧗"];

type GroupRow = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  invite_code: string;
  owner_id: string;
  archived_at: string | null;
};

type MemberRow = {
  group_id: string;
  current_streak: number;
  longest_streak: number;
  groups: GroupRow | null;
};

function GruposIndex() {
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const { codigo } = Route.useSearch();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [prefillCode, setPrefillCode] = useState<string | undefined>(codigo);

  useEffect(() => {
    if (codigo) {
      setPrefillCode(codigo);
      setJoinOpen(true);
    }
  }, [codigo]);


  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["my-groups", user.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_members")
        .select("group_id, current_streak, longest_streak, groups(*)")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });

  const active = memberships.filter((m) => m.groups && !m.groups.archived_at);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Trophy className="size-6 text-amber-500" /> Grupos
          </h1>
          <p className="text-sm text-muted-foreground">
            Compita com amigos: cada treino registrado vira pontos.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["my-groups"] })} />
        <JoinGroupDialog open={joinOpen} onOpenChange={setJoinOpen} initialCode={prefillCode} onJoined={() => qc.invalidateQueries({ queryKey: ["my-groups"] })} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin" /></div>
      ) : active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Trophy className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="font-semibold">Você ainda não está em nenhum grupo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie um novo ou entre em um com um código de convite.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {active.map((m) => (
            <li key={m.group_id}>
              <Link
                to="/app/grupos/$id"
                params={{ id: m.group_id }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl">
                  {m.groups?.emoji ?? "🏆"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.groups?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Código: <span className="font-mono">{m.groups?.invite_code}</span>
                  </p>
                </div>
                {m.current_streak > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-500">
                    <Flame className="size-3.5" /> {m.current_streak}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🏆");

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("create_group", {
        _name: name.trim(),
        _description: description.trim() || null,
        _emoji: emoji,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Grupo criado!");
      setName("");
      setDescription("");
      setEmoji("🏆");
      onOpenChange(false);
      onCreated();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> Criar grupo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo grupo</DialogTitle>
          <DialogDescription>Convide amigos para competir com você.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Emoji</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`flex size-9 items-center justify-center rounded-lg border text-lg transition ${
                    emoji === e ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >{e}</button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="g-name">Nome</Label>
            <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Squad da Academia" />
          </div>
          <div>
            <Label htmlFor="g-desc">Descrição (opcional)</Label>
            <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JoinGroupDialog({
  open,
  onOpenChange,
  onJoined,
  initialCode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onJoined: () => void;
  initialCode?: string;
}) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10));
    }
  }, [initialCode]);


  const join = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("request_or_join_by_code", {
        _code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      return data as { status: string; name?: string };
    },
    onSuccess: (res) => {
      if (res?.status === "joined") toast.success(`Entrou em ${res.name ?? "grupo"}!`);
      else if (res?.status === "pending") toast.success("Pedido enviado — aguardando aprovação do dono.");
      else if (res?.status === "already_member") toast.info("Você já é membro deste grupo.");
      else toast.success("OK");
      setCode("");
      onOpenChange(false);
      onJoined();
    },
    onError: (e: any) => toast.error(e.message ?? "Código inválido"),
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><LogIn className="size-4" /> Entrar com código</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar em um grupo</DialogTitle>
          <DialogDescription>Cole o código do convite (ex.: CRG-AB23).</DialogDescription>
        </DialogHeader>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10))}
          placeholder="CRG-XXXX"
          className="text-center font-mono text-lg tracking-widest"
          maxLength={10}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={code.trim().length < 4 || join.isPending} onClick={() => join.mutate()}>

            {join.isPending ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
