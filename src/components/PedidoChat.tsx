/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { supabase } from "../App";
import type { AppSession, Theme } from "../App";
import { clearFormDraft, readFormDraft, writeFormDraft } from "../formDrafts";

type ChatRole = "cliente" | "repartidor" | "admin";

interface ChatOrder {
  id: string;
  negocio_nombre?: string | null;
}

interface ChatMessage {
  id: string;
  pedido_id: string;
  autor_id: string;
  autor_rol: ChatRole;
  texto: string;
  created_at: string;
  adjunto_path: string | null;
  adjunto_nombre: string | null;
  signedUrl?: string;
}

interface Props {
  session: AppSession;
  theme: Theme;
  pedido: ChatOrder;
  role: ChatRole;
  onBack: () => void;
}

const CHAT_BUCKET = "chat-pedidos";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

function courierChatDraftId(orderId: string): string {
  return "courier-chat:" + encodeURIComponent(orderId);
}

export default function PedidoChat(props: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState(function () {
    if (props.role !== "repartidor") return "";
    const savedMessage = readFormDraft<unknown>(
      props.session.user.id,
      courierChatDraftId(props.pedido.id),
    );
    return typeof savedMessage === "string" ? savedMessage : "";
  });
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isDark = props.theme === "dark";
  const ownId = props.session.user.id;
  const imagePreview = useMemo(
    function () { return image ? URL.createObjectURL(image) : ""; },
    [image],
  );

  const loadMessages = useCallback(async function () {
    const { data, error: queryError } = await supabase
      .from("mensajes_chat")
      .select("id, pedido_id, autor_id, autor_rol, texto, created_at, adjunto_path, adjunto_nombre")
      .eq("pedido_id", props.pedido.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (queryError) {
      setError("No se pudo abrir el chat. Ejecuta supabase_admin_upgrade.sql en Supabase.");
      setLoading(false);
      return;
    }

    const rows = ((data ?? []) as ChatMessage[]).reverse();
    const imagePaths = rows
      .map(function (message) { return message.adjunto_path; })
      .filter(function (path): path is string { return Boolean(path); });
    let signedByPath = new Map<string, string>();
    if (imagePaths.length > 0) {
      const { data: signedFiles } = await supabase.storage
        .from(CHAT_BUCKET)
        .createSignedUrls(imagePaths, 60 * 60);
      signedByPath = new Map(
        (signedFiles ?? [])
          .filter(function (file) { return Boolean(file.path && file.signedUrl); })
          .map(function (file) { return [file.path!, file.signedUrl!]; }),
      );
    }
    setMessages(rows.map(function (message) {
      return {
        ...message,
        signedUrl: message.adjunto_path ? signedByPath.get(message.adjunto_path) : undefined,
      };
    }));
    setError("");
    setLoading(false);
  }, [props.pedido.id]);

  useEffect(function () {
    let active = true;
    void loadMessages();
    const channel = supabase
      .channel("pedido-chat-" + props.pedido.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "mensajes_chat",
        filter: "pedido_id=eq." + props.pedido.id,
      }, function () {
        if (active) void loadMessages();
      })
      .subscribe();

    return function () {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [loadMessages, props.pedido.id]);

  useEffect(function () {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(function () {
    if (!imagePreview) return;
    return function () { URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  async function enviarMensaje() {
    const messageText = text.trim();
    if ((!messageText && !image) || sending) return;
    setSending(true);
    setError("");
    let uploadedPath: string | null = null;

    try {
      if (image) {
        const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
        uploadedPath = [
          props.pedido.id,
          ownId,
          crypto.randomUUID() + "." + extension,
        ].join("/");
        const { error: uploadError } = await supabase.storage
          .from(CHAT_BUCKET)
          .upload(uploadedPath, image, {
            cacheControl: "3600",
            upsert: false,
            contentType: image.type,
          });
        if (uploadError) throw uploadError;
      }

      const { error: insertError } = await supabase.from("mensajes_chat").insert({
        pedido_id: props.pedido.id,
        autor_id: ownId,
        autor_rol: props.role,
        texto: messageText || "📷 Foto del pedido",
        adjunto_path: uploadedPath,
        adjunto_nombre: image?.name ?? null,
      });
      if (insertError) throw insertError;

      if (props.role === "repartidor") {
        clearFormDraft(ownId, courierChatDraftId(props.pedido.id));
      }
      setText("");
      setImage(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      await loadMessages();
    } catch (sendError: any) {
      if (uploadedPath) {
        await supabase.storage.from(CHAT_BUCKET).remove([uploadedPath]);
      }
      setError(sendError?.message || "No se pudo enviar el mensaje. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  function seleccionarImagen(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Elige una imagen JPG, PNG, WebP o HEIC.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("La foto debe pesar 5 MB o menos.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    setError("");
    setImage(file);
  }

  function nombreAutor(message: ChatMessage) {
    if (message.autor_id === ownId) return "Tú";
    if (message.autor_rol === "repartidor") return "Repartidor";
    if (message.autor_rol === "cliente") return "Cliente";
    return "Changuito Express";
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-base)", color: "var(--text-primary)", fontFamily: "system-ui,sans-serif", maxWidth: "480px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--bg-nav)", borderBottom: "1px solid var(--border-subtle)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <button type="button" onClick={props.onBack} aria-label="Volver" style={{ width: 38, height: 38, border: 0, borderRadius: 12, background: "var(--border-subtle)", color: "var(--text-primary)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em" }}>Chat del pedido</p>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{props.pedido.negocio_nombre ?? "Pedido"}</h1>
        </div>
      </header>

      <main aria-live="polite" style={{ flex: 1, overflowY: "auto", padding: "16px 14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {error && <div role="alert" style={{ padding: 12, borderRadius: 12, background: "var(--color-red-dim)", color: "var(--color-red)", fontSize: 12 }}>{error}</div>}
        {loading && <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Cargando conversación…</p>}
        {!loading && messages.length === 0 && !error && (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
            <p style={{ fontSize: 30, margin: "0 0 8px" }}>💬</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px" }}>Conversa sobre este pedido</p>
            <p style={{ fontSize: 12, margin: 0 }}>Puedes enviar mensajes y fotos directamente.</p>
          </div>
        )}
        {messages.map(function (message) {
          const mine = message.autor_id === ownId;
          return (
            <article key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", width: "fit-content", maxWidth: "82%", padding: 10, borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: mine ? "var(--color-yellow)" : "var(--bg-card)", color: mine ? "#111827" : "var(--text-primary)", border: "1px solid var(--border-subtle)" }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 800, opacity: .72 }}>{nombreAutor(message)}</p>
              {message.signedUrl && (
                <a href={message.signedUrl} target="_blank" rel="noreferrer" aria-label={message.adjunto_nombre ?? "Abrir imagen adjunta"}>
                  <img src={message.signedUrl} alt={message.adjunto_nombre ?? "Imagen del pedido"} style={{ display: "block", width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 9, marginBottom: message.texto ? 7 : 0 }} />
                </a>
              )}
              {message.adjunto_path && !message.signedUrl && <p style={{ margin: "0 0 6px", fontSize: 11 }}>No se pudo cargar la foto adjunta.</p>}
              {message.texto && <p style={{ margin: "0 0 5px", fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.texto}</p>}
              <time style={{ display: "block", fontSize: 9, opacity: .65, textAlign: "right" }}>{new Date(message.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</time>
            </article>
          );
        })}
        <div ref={endRef} />
      </main>

      <footer style={{ position: "sticky", bottom: 0, padding: "10px 12px max(12px, env(safe-area-inset-bottom))", background: "var(--bg-nav)", borderTop: "1px solid var(--border-subtle)" }}>
        {image && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: 7, borderRadius: 12, background: "var(--bg-card)" }}>
            <img src={imagePreview} alt="Vista previa de la foto" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{image.name}</span>
            <button type="button" onClick={function () { setImage(null); if (imageInputRef.current) imageInputRef.current.value = ""; }} aria-label="Quitar foto" style={{ border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={function (event) { seleccionarImagen(event.target.files?.[0]); }} style={{ display: "none" }} />
          <button type="button" onClick={function () { imageInputRef.current?.click(); }} disabled={sending} aria-label="Adjuntar foto" title="Adjuntar foto" style={{ width: 42, height: 42, flexShrink: 0, border: "1px solid var(--border-subtle)", borderRadius: 13, background: "var(--bg-card)", color: "var(--text-primary)", display: "grid", placeItems: "center", cursor: "pointer" }}><ImagePlus size={19} /></button>
          <textarea value={text} onChange={function (event) {
            const nextText = event.target.value;
            setText(nextText);
            if (props.role === "repartidor") {
              if (nextText) {
                writeFormDraft(
                  ownId,
                  courierChatDraftId(props.pedido.id),
                  nextText,
                );
              } else {
                clearFormDraft(ownId, courierChatDraftId(props.pedido.id));
              }
            }
          }} onKeyDown={function (event) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void enviarMensaje(); } }} rows={1} maxLength={1000} disabled={sending} placeholder="Escribe un mensaje…" aria-label="Escribe un mensaje" style={{ flex: 1, minWidth: 0, resize: "none", padding: "12px", borderRadius: 14, border: "1px solid var(--border-subtle)", outline: "none", background: isDark ? "rgba(255,255,255,0.05)" : "white", color: "var(--text-primary)", font: "inherit", fontSize: 13 }} />
          <button type="button" onClick={function () { void enviarMensaje(); }} disabled={sending || (!text.trim() && !image)} aria-label="Enviar mensaje" style={{ width: 44, height: 44, flexShrink: 0, border: 0, borderRadius: 14, background: sending || (!text.trim() && !image) ? "var(--border-subtle)" : "var(--color-yellow)", color: "#111827", display: "grid", placeItems: "center", cursor: sending || (!text.trim() && !image) ? "not-allowed" : "pointer" }}>
            {sending ? <LoaderCircle size={19} className="spin" /> : <Send size={18} />}
          </button>
        </div>
        <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 10 }}>Fotos JPG, PNG, WebP o HEIC · máximo 5 MB</p>
      </footer>
    </div>
  );
}
