import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStudents, linkStudentByCode, unlinkStudent } from "@/lib/trainer.functions";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ChevronRight, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { redirect } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/app/alunos/")({
  beforeLoad: ({ context }) => {
    if (!context.isTrainer) throw redirect({ to: "/app" });
  },
  component: AlunosList,
});

function AlunosList() {
  const { isTrainer } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const list = useServerFn(listStudents);
  const link = useServerFn(linkStudentByCode);
  const unlink = useServerFn(unlinkStudent);

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["students"],
    queryFn: () => list(),
    enabled: isTrainer,
  });

  const linkM = useMutation({
    mutationFn: (invite_code: string) => link({ data: { invite_code } }),
    onSuccess: (res) => {
      toast.success(`Aluno vinculado: ${res.student.display_name ?? "aluno"}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      setOpen(false);
      setCode("");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível vincular."),
  });

  const unlinkM = useMutation({
    mutationFn: (student_id: string) => unlink({ data: { student_id } }),
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="app-container pt-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus alunos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Alunos vinculados por código de convite.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="size-4" /> Vincular</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Vincular aluno</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Código de convite do aluno</Label>
              <Input
                placeholder="CRG-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">Peça ao aluno o código que aparece no perfil dele.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => linkM.mutate(code)} disabled={!code || linkM.isPending}>Vincular</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="mt-6 grid gap-3">
        {isLoading && <ListSkeleton rows={3} />}
        {!isLoading && (data?.students.length ?? 0) === 0 && (
          <EmptyState
            icon={Users}
            title="Nenhum aluno vinculado"
            message="Peça o código de convite (ex: CRG-XXXX) que aparece no perfil do aluno."
          />
        )}
        {data?.students.map((s) => (
          <div key={s.id} className="card-soft flex items-center gap-3 p-4">
            <span className="grid size-11 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
              {(s.display_name ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <Link to="/app/alunos/$id" params={{ id: s.id }} className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.display_name ?? "Sem nome"}</p>
              <p className="text-xs text-muted-foreground">Vinculado em {new Date(s.created_at).toLocaleDateString("pt-BR")}</p>
            </Link>
            <button
              onClick={() => { if (confirm("Remover vínculo com este aluno?")) unlinkM.mutate(s.id); }}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
            <Link to="/app/alunos/$id" params={{ id: s.id }} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
              <ChevronRight className="size-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
