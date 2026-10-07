"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/purchases/whatsapp";

/**
 * S26-03: PDF y WhatsApp de la orden. En el celular (Web Share con archivos) se comparte el PDF y
 * uno elige WhatsApp; en el computador se descarga el PDF y se abre el chat del proveedor (el
 * archivo se adjunta a mano: WhatsApp Web no acepta adjuntos por enlace).
 */
export function PurchaseShare({
  purchaseId,
  number,
  total,
  supplierPhone,
}: {
  purchaseId: string;
  number: string;
  total: string;
  supplierPhone: string | null;
}) {
  const t = useTranslations("purchases");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  // iOS: si el permiso del toque venció mientras bajaba el PDF, un segundo toque comparte el archivo ya listo.
  const [ready, setReady] = useState<File | null>(null);
  const pdfUrl = `/compras/ordenes/${purchaseId}/pdf`;
  const text = t("whatsappText", { number, total });

  function downloadAndOpenChat() {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${number}.pdf`;
    a.click();
    window.open(whatsappUrl(supplierPhone, text), "_blank", "noopener");
  }

  async function shareFile(file: File) {
    try {
      await navigator.share({ files: [file], text });
      setReady(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setReady(file);
        return;
      }
      // Cerrar el menú de compartir no es un error.
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(true);
    }
  }

  async function share() {
    if (ready) {
      await shareFile(ready);
      return;
    }
    const probe = new File([""], `${number}.pdf`, { type: "application/pdf" });
    if (!navigator.canShare?.({ files: [probe] })) {
      downloadAndOpenChat();
      return;
    }
    setPending(true);
    setError(false);
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error(String(res.status));
      await shareFile(new File([await res.blob()], `${number}.pdf`, { type: "application/pdf" }));
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
        <a href={pdfUrl} download={`${number}.pdf`} aria-label={t("pdfLabel", { number })}>
          {t("pdfButton")}
        </a>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        disabled={pending}
        aria-label={t("whatsappLabel", { number })}
        onClick={share}
      >
        {pending ? "..." : ready ? t("shareNow") : t("whatsapp")}
      </Button>
      {error ? (
        <p role="alert" className="w-full text-right text-[10px] text-destructive">
          {t("whatsappFailed")}
        </p>
      ) : null}
    </>
  );
}
