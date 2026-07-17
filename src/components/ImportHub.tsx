import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Camera, Type, FileUp } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { OfflineNotice } from "@/components/OfflineNotice";
import { ImportPhotoTab } from "./ImportPhotoTab";
import { ImportPdfTab } from "./ImportPdfTab";
import { ImportFreeTextTab } from "./ImportFreeTextTab";
import { ImportWorkoutDialog } from "./ImportWorkoutDialog";

type Props = { userId: string; variant?: "primary" | "outline" };

export function ImportHub({ userId, variant = "outline" }: Props) {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"file" | "photo" | "pdf" | "text">("file");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={variant === "primary" ? "default" : "outline"}
          disabled={!online}
          title={!online ? "Requer internet" : undefined}
        >
          <Upload className="size-3.5" /> Importar treino
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar treino</DialogTitle>
        </DialogHeader>
        <OfflineNotice feature="Importação de treino" />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="file" className="text-xs">
              <FileUp className="size-3.5" /> Arquivo
            </TabsTrigger>
            <TabsTrigger value="photo" className="text-xs">
              <Camera className="size-3.5" /> Foto
            </TabsTrigger>
            <TabsTrigger value="pdf" className="text-xs">
              <FileText className="size-3.5" /> PDF
            </TabsTrigger>
            <TabsTrigger value="text" className="text-xs">
              <Type className="size-3.5" /> Texto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-3">
            <p className="mb-2 text-sm text-muted-foreground">
              Envie um arquivo <b>.fit</b>, <b>.gpx</b> ou <b>.tcx</b> exportado do seu relógio ou app.
            </p>
            {/* Reaproveita o diálogo antigo apenas como conteúdo — abre dentro do hub. */}
            <div className="[&>*:first-child>button]:hidden">
              <ImportWorkoutDialog userId={userId} onImported={() => setOpen(false)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Clique no botão abaixo para abrir o seletor de arquivo.
            </p>
          </TabsContent>

          <TabsContent value="photo" className="mt-3">
            <ImportPhotoTab userId={userId} onDone={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="pdf" className="mt-3">
            <ImportPdfTab userId={userId} onDone={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="text" className="mt-3">
            <ImportFreeTextTab userId={userId} onDone={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
