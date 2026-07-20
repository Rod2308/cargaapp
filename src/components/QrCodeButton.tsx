import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Renders a button that opens a dialog with a QR code for the given URL.
 * Useful on devices that block Clipboard/Web Share APIs.
 */
export function QrCodeButton({
  url,
  label = "Convite",
  triggerLabel = "QR Code",
}: {
  url: string;
  label?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !url) return;
    let alive = true;
    setError(null);
    setDataUrl(null);
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    })
      .then((d) => {
        if (alive) setDataUrl(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : "Falha ao gerar QR");
      });
    return () => {
      alive = false;
    };
  }, [open, url]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${label.toLowerCase().replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="size-3.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Escaneie com a câmera do celular para abrir o convite. Ideal quando o botão
            "Compartilhar" ou "Copiar" está bloqueado pelo navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-border bg-white p-3">
            {dataUrl ? (
              <img
                src={dataUrl}
                alt={`QR code para ${label}`}
                className="block h-64 w-64 max-w-full"
                loading="lazy"
              />
            ) : error ? (
              <div className="flex h-64 w-64 items-center justify-center px-4 text-center text-xs text-destructive">
                <X className="mr-1 size-4" /> {error}
              </div>
            ) : (
              <div className="h-64 w-64 animate-pulse rounded-lg bg-muted" />
            )}
          </div>

          <p className="w-full break-all rounded-lg bg-muted px-3 py-2 text-center text-[11px] text-muted-foreground">
            {url}
          </p>

          <div className="flex w-full gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={download} disabled={!dataUrl}>
              <Download className="size-3.5" /> Baixar PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
