import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, Loader2, UserRound, ArrowLeft, Trash2, Search, CheckSquare, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { messageSchema } from "@/lib/validation";
import { OfflineNotice } from "@/components/OfflineNotice";
import { EmptyState as SharedEmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { Skeleton } from "@/components/ui/skeleton";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/mensagens")({
  component: MensagensPage,
});

type ChatPartner = { id: string; display_name: string | null };

function MensagensPage() {
  const { user, isTrainer } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const [activeStudent, setActiveStudent] = useState<ChatPartner | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Aluno: busca professor vinculado
  const { data: myTrainer, isLoading: loadingTrainer } = useQuery({
    enabled: !isTrainer,
    queryKey: ["my-trainer-simple", user.id],
    queryFn: async (): Promise<ChatPartner | null> => {
      const { data: link } = await supabase
        .from("trainer_students")
        .select("trainer_id")
        .eq("student_id", user.id)
        .maybeSingle();
      if (!link) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", link.trainer_id)
        .maybeSingle();
      return p ?? null;
    },
  });

  // Treinador: lista de alunos
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    enabled: isTrainer,
    queryKey: ["trainer-students-simple", user.id],
    queryFn: async (): Promise<ChatPartner[]> => {
      const { data: links } = await supabase
        .from("trainer_students")
        .select("student_id, created_at")
        .eq("trainer_id", user.id)
        .order("created_at", { ascending: false });
      const ids = (links ?? []).map((l) => l.student_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      return (profiles ?? []) as ChatPartner[];
    },
  });

  // --- Renderização ---
  if (!isTrainer) {
    if (loadingTrainer) return <div className="app-container pt-8"><ListSkeleton rows={3} /></div>;
    if (!myTrainer) return <EmptyState title="Nenhum professor vinculado" message="Vincule um professor no seu Perfil para poder conversar." />;
    return (
      <div className="app-container pt-8">
        <Chat me={user.id} partner={myTrainer} subtitle="Seu professor" onBack={null} />
      </div>
    );
  }

  // Treinador
  if (activeStudent) {
    return (
      <div className="app-container pt-8">
        <Chat me={user.id} partner={activeStudent} subtitle="Aluno" onBack={() => setActiveStudent(null)} />
      </div>
    );
  }

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const orFilter = ids
        .map((sid) => `and(sender_id.eq.${user.id},receiver_id.eq.${sid}),and(sender_id.eq.${sid},receiver_id.eq.${user.id})`)
        .join(",");
      const { error } = await supabase.from("messages").delete().or(orFilter);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(ids.length === 1 ? "Conversa excluída" : `${ids.length} conversas excluídas`);
      qc.invalidateQueries({ queryKey: ["msg-preview"] });
      qc.invalidateQueries({ queryKey: ["messages"] });
      setSelectedIds(new Set());
      setSelectMode(false);
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao excluir"),
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const q = studentSearch.trim().toLowerCase();
  const filtered = q ? students.filter((s) => (s.display_name ?? "").toLowerCase().includes(q)) : students;

  return (
    <div className="app-container pt-8 pb-24">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
          <p className="text-xs text-muted-foreground">
            {selectMode ? `${selectedIds.size} selecionada${selectedIds.size === 1 ? "" : "s"}` : "Converse com seus alunos"}
          </p>
        </div>
        {students.length > 0 && (
          selectMode ? (
            <button
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              aria-label="Cancelar seleção"
            >
              <X className="size-5" />
            </button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              aria-label="Selecionar conversas"
            >
              <CheckSquare className="size-5" />
            </button>
          )
        )}
      </div>

      <OfflineNotice feature="Mensagens" className="mt-4" />



      {students.length > 0 && !selectMode && (
        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            placeholder="Buscar aluno pelo nome..."
            className="h-11 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      {selectMode && filtered.length > 0 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          <button
            onClick={() => {
              if (selectedIds.size === filtered.length) setSelectedIds(new Set());
              else setSelectedIds(new Set(filtered.map((s) => s.id)));
            }}
            className="font-semibold text-primary"
          >
            {selectedIds.size === filtered.length ? "Desmarcar todas" : "Selecionar todas"}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {loadingStudents && <ListSkeleton rows={3} />}
        {!loadingStudents && students.length === 0 && (
          <EmptyState title="Nenhum aluno vinculado" message="Vincule alunos pelo código de convite em Alunos." />
        )}
        {students.length > 0 && filtered.length === 0 && (
          <SharedEmptyState compact title="Nenhum aluno encontrado" message={`Não achamos ninguém para "${studentSearch}".`} />
        )}
        {filtered.map((s) => (
          <StudentRow
            key={s.id}
            student={s}
            meId={user.id}
            selectMode={selectMode}
            selected={selectedIds.has(s.id)}
            onOpen={() => (selectMode ? toggleSelect(s.id) : setActiveStudent(s))}
          />
        ))}
      </div>

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur sm:left-auto sm:right-6 sm:bottom-6 sm:rounded-xl sm:border sm:shadow-lg">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{selectedIds.size}</span> selecionada{selectedIds.size === 1 ? "" : "s"}
            </p>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Excluir
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedIds.size} conversa{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens trocadas com {selectedIds.size === 1 ? "este aluno" : "estes alunos"} serão apagadas. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDelete.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StudentRow({ student, meId, onOpen, selectMode, selected }: { student: ChatPartner; meId: string; onOpen: () => void; selectMode: boolean; selected: boolean }) {
  const { data: preview } = useQuery({
    queryKey: ["msg-preview", meId, student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("content, created_at, sender_id, read_at, receiver_id")
        .or(`and(sender_id.eq.${meId},receiver_id.eq.${student.id}),and(sender_id.eq.${student.id},receiver_id.eq.${meId})`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 15000,
  });
  const unread = preview && preview.receiver_id === meId && !preview.read_at;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "card-soft flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40",
        selectMode && selected && "ring-2 ring-primary",
      )}
    >
      {selectMode && (
        <Checkbox checked={selected} className="shrink-0" tabIndex={-1} aria-label="Selecionar conversa" />
      )}
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
        <UserRound className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{student.display_name ?? "Aluno"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {preview?.content ?? "Sem mensagens ainda"}
        </p>
      </div>
      {unread && !selectMode && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
    </button>
  );
}

function Header({ partner, subtitle, onBack }: { partner: ChatPartner; subtitle: string; onBack: (() => void) | null }) {
  return (
    <div className="flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
          <ArrowLeft className="size-5" />
        </button>
      )}
      <div className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground">
        <UserRound className="size-5" />
      </div>
      <div>
        <h1 className="text-xl font-bold leading-tight tracking-tight">{partner.display_name ?? "Contato"}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="app-container pt-8">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
          <MessageCircle className="size-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
      </div>
      <div className="card-soft mt-6 p-6 text-center">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

function Chat({ me, partner, subtitle, onBack }: { me: string; partner: ChatPartner; subtitle: string; onBack: (() => void) | null }) {
  const partnerId = partner.id;
  const partnerName = partner.display_name;
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const queryKey = ["messages", me, partnerId];

  const deleteConversation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("messages")
        .delete()
        .or(`and(sender_id.eq.${me},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${me})`);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.setQueryData<Message[]>(queryKey, []);
      qc.invalidateQueries({ queryKey: ["msg-preview"] });
      toast.success("Conversa excluída");
      if (onBack) onBack();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao excluir"),
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, content, created_at, read_at")
        .or(`and(sender_id.eq.${me},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${me})`)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: INSERTs e DELETEs desta conversa
  useEffect(() => {
    const isThisChat = (m: Partial<Message>) =>
      (m.sender_id === me && m.receiver_id === partnerId) ||
      (m.sender_id === partnerId && m.receiver_id === me);

    const channel = supabase
      .channel(`dm:${[me, partnerId].sort().join(":")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          if (!isThisChat(m)) return;
          qc.setQueryData<Message[]>(queryKey, (old = []) => {
            if (old.some((x) => x.id === m.id)) return old;
            return [...old, m];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const old = payload.old as Partial<Message>;
          // Com REPLICA IDENTITY FULL, old contém sender/receiver
          if (old.sender_id && old.receiver_id && !isThisChat(old)) return;
          qc.setQueryData<Message[]>(queryKey, (curr = []) =>
            old.id ? curr.filter((x) => x.id !== old.id) : [],
          );
          qc.invalidateQueries({ queryKey: ["msg-preview"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, partnerId, qc]);

  // Marcar recebidas como lidas
  useEffect(() => {
    const unread = messages.filter((m) => m.receiver_id === me && !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {
      qc.invalidateQueries({ queryKey: ["msg-preview"] });
    });
  }, [messages, me, qc]);

  // Scroll para o fim
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from("messages")
        .insert({ sender_id: me, receiver_id: partnerId, content })
        .select("id, sender_id, receiver_id, content, created_at, read_at")
        .single();
      if (error) throw error;
      return data as Message;
    },
    onSuccess: (m) => {
      qc.setQueryData<Message[]>(queryKey, (old = []) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
      setText("");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao enviar"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (send.isPending) return;
    const parsed = messageSchema.safeParse(text);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Mensagem inválida.");
      return;
    }
    send.mutate(parsed.data);
  }


  return (
    <>
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="size-5" />
          </button>
        )}
        <div className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <UserRound className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-tight tracking-tight">{partnerName ?? "Contato"}</h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              aria-label="Excluir conversa"
              disabled={messages.length === 0 || deleteConversation.isPending}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="size-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso apagará todas as mensagens trocadas entre você e {partnerName ?? "este contato"}. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConversation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    <div className="mt-4 flex h-[calc(100dvh-16rem)] flex-col">
      <div
        ref={listRef}
        className="card-soft flex-1 space-y-2 overflow-y-auto p-3"
      >
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
            <Skeleton className="h-10 w-1/2 rounded-2xl" />
            <Skeleton className="ml-auto h-10 w-3/5 rounded-2xl" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="mt-6">
            <SharedEmptyState
              icon={MessageCircle}
              title="Nenhuma mensagem ainda"
              message={`Diga oi para ${partnerName ?? "seu contato"}!`}
            />
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div
              key={m.id}
              className={cn("flex", mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug",
                  mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-secondary text-secondary-foreground",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={cn("mt-1 text-[10px] opacity-60", mine ? "text-right" : "")}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva sua mensagem..."
          rows={1}
          maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e as any); }
          }}
          className="min-h-10 flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
        />

        <Button type="submit" size="icon" disabled={send.isPending || !text.trim()}>
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
    </>
  );
}
