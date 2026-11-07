import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Archive, ArrowLeft, Check, CheckCheck, Clock3, ImagePlus,
  LoaderCircle, MessageCircle, RefreshCw, Send, ShieldCheck, UserRound,
  X,
} from "lucide-react";
import {
  whatsappGet, whatsappPost,
} from "../whatsappCrmApi";
import type {
  WaAssignment, WaConfig, WaConversation, WaDetail, WaList, WaMessage,
} from "../whatsappCrmApi";
import "./WhatsAppCrm.css";

type Props = { isAdmin: boolean };
type Scope = "active" | "archived";

const POLL_MS = 6000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function displayName(conversation: WaConversation): string {
  return conversation.contact.display_name?.trim() || conversation.contact.phone || "Contacto sin nombre";
}

function shortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function messagePreview(message?: WaMessage): string {
  if (!message) return "Abre para ver el historial";
  if (message.kind === "image") return message.body || "Imagen";
  if (message.kind === "unsupported") return message.body || "Mensaje no compatible";
  return message.body || "Mensaje sin texto";
}

function friendlyStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (["sent", "delivered", "read", "ok", "success", "enviado", "entregado", "leido", "leído"].includes(normalized)) {
    if (normalized === "read" || normalized === "leido" || normalized === "leído") return "Leído";
    if (normalized === "delivered" || normalized === "entregado") return "Entregado";
    return "Enviado";
  }
  if (["failed", "error", "rejected", "fallido", "failed_permanent"].includes(normalized)) return "Falló";
  if (["pending", "queued", "sending", "pendiente"].includes(normalized)) return "Pendiente";
  return status || "Registrado";
}

function serviceWindow(lastInbound: string | null, now: number): { expired: boolean; label: string } {
  if (!lastInbound) return { expired: true, label: "No disponible" };
  const expiresAt = new Date(lastInbound).getTime() + 24 * 60 * 60 * 1000;
  const left = expiresAt - now;
  if (!Number.isFinite(expiresAt) || left <= 0) return { expired: true, label: "Vencida" };
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  return { expired: false, label: hours > 0 ? `${hours} h ${minutes} min restantes` : `${minutes} min restantes` };
}

function mergeMessages(...groups: WaMessage[][]): WaMessage[] {
  const byId = new Map<string, WaMessage>();
  groups.forEach((group) => group.forEach((message) => byId.set(message.id, message)));
  return Array.from(byId.values()).sort((a, b) => {
    const order = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return order || a.id.localeCompare(b.id);
  });
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const comma = value.indexOf(",");
      if (comma < 0) reject(new Error("No se pudo preparar la imagen."));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function WhatsAppCrm({ isAdmin }: Props) {
  const [scope, setScope] = useState<Scope>("active");
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [couriers, setCouriers] = useState<WaList["couriers"]>([]);
  const [config, setConfig] = useState<WaConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WaDetail | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [operationError, setOperationError] = useState("");
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(Date.now());
  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const draftsByConversation = useRef(new Map<string, string>());
  const imagesByConversation = useRef(new Map<string, File>());
  const olderCursor = useRef<string | null>(null);
  const hasLoadedOlder = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreview = useMemo(() => image ? URL.createObjectURL(image) : "", [image]);
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? detail?.conversation ?? null,
    [conversations, detail?.conversation, selectedId],
  );
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (!imagePreview) return undefined;
    return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const clearPrivateData = useCallback(() => {
    detailGeneration.current += 1;
    setConversations([]);
    setCouriers([]);
    setConfig(null);
    setSelectedId(null);
    setDetail(null);
    setMessages([]);
    setImageUrls({});
    setImageErrors({});
    setDraft("");
    setImage(null);
    draftsByConversation.current.clear();
    imagesByConversation.current.clear();
    if (fileInputRef.current) fileInputRef.current.value = "";
    setListError("");
    setDetailError("");
    olderCursor.current = null;
  }, []);

  const loadList = useCallback(async (initial = false) => {
    const generation = ++listGeneration.current;
    if (initial) setLoadingList(true);
    try {
      const result = await whatsappGet<WaList>("list", { archived: scope === "archived" ? "true" : "false" });
      if (generation !== listGeneration.current) return;
      const nextConversations = result.conversations ?? [];
      const selected = selectedIdRef.current;
      if (selected && !nextConversations.some((conversation) => conversation.id === selected)) {
        setSelectedId(null);
        setDetail(null);
        setMessages([]);
        setImageUrls({});
        setImageErrors({});
        draftsByConversation.current.delete(selected);
        imagesByConversation.current.delete(selected);
        setDraft("");
        setImage(null);
      }
      setConversations(nextConversations);
      setCouriers(result.couriers ?? []);
      setConfig(result.config ?? null);
      setListError("");
    } catch (error) {
      if (generation !== listGeneration.current) return;
      // A failed scoped read may mean access was revoked. Do not leave prior contacts visible.
      clearPrivateData();
      setListError(error instanceof Error ? error.message : "No se pudo cargar el CRM.");
    } finally {
      if (generation === listGeneration.current) setLoadingList(false);
    }
  }, [clearPrivateData, scope]);

  useEffect(() => {
    clearPrivateData();
    setLoadingList(true);
    void loadList(true);
    const timer = window.setInterval(() => { void loadList(false); }, POLL_MS);
    return () => {
      window.clearInterval(timer);
      listGeneration.current += 1;
    };
  }, [clearPrivateData, loadList]);

  const loadDetail = useCallback(async (id: string, preserveOlder = true, initial = false) => {
    const generation = ++detailGeneration.current;
    if (initial) setLoadingDetail(true);
    try {
      const result = await whatsappGet<WaDetail>("detail", { id });
      if (generation !== detailGeneration.current || id !== selectedId) return;
      setDetail(result);
      setMessages((current) => preserveOlder ? mergeMessages(current, result.messages ?? []) : mergeMessages(result.messages ?? []));
      if (!loadingOlderRef.current && !hasLoadedOlder.current) olderCursor.current = result.nextBefore ?? null;
      setDetailError("");
    } catch (error) {
      if (generation !== detailGeneration.current || id !== selectedId) return;
      setMessages([]);
      setDetail(null);
      setImageUrls({});
      setImageErrors({});
      draftsByConversation.current.delete(id);
      imagesByConversation.current.delete(id);
      setDraft("");
      setImage(null);
      setDetailError(error instanceof Error ? error.message : "No se pudo abrir la conversación.");
    } finally {
      if (generation === detailGeneration.current) setLoadingDetail(false);
    }
  }, [selectedId]);

  useEffect(() => {
    detailGeneration.current += 1;
    stickToBottom.current = true;
    setDetail(null);
    setMessages([]);
    setImageUrls({});
    setImageErrors({});
    loadingOlderRef.current = false;
    setLoadingOlder(false);
    setDetailError("");
    setOperationError("");
    setDraft(selectedId ? draftsByConversation.current.get(selectedId) ?? "" : "");
    setImage(selectedId ? imagesByConversation.current.get(selectedId) ?? null : null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    olderCursor.current = null;
    hasLoadedOlder.current = false;
    if (!selectedId) {
      setLoadingDetail(false);
      return undefined;
    }
    setLoadingDetail(true);
    void loadDetail(selectedId, false, true);
    const timer = window.setInterval(() => { void loadDetail(selectedId, true, false); }, POLL_MS);
    return () => {
      window.clearInterval(timer);
      detailGeneration.current += 1;
    };
  }, [loadDetail, selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedId || messages.length === 0) return;
    let active = true;
    const missing = messages.filter((message) => message.kind === "image" && message.image_path && !imageUrls[message.id] && !imageErrors[message.id]);
    if (!missing.length) return;
    void Promise.all(missing.map(async (message) => {
      try {
        const result = await whatsappGet<{ url: string }>("media", { id: message.id });
        if (active && result.url) setImageUrls((current) => ({ ...current, [message.id]: result.url }));
      } catch {
        if (active) setImageErrors((current) => ({ ...current, [message.id]: true }));
      }
    }));
    return () => { active = false; };
  }, [imageErrors, imageUrls, messages, selectedId]);

  useEffect(() => {
    if (stickToBottom.current) {
      historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const selectedDetail = detail?.conversation.id === selectedId ? detail : null;
  const currentMessages = messages;
  const windowInfo = serviceWindow(selectedConversation?.last_inbound_at ?? null, now);
  const canSend = Boolean(
    selectedConversation
    && selectedConversation.status !== "archivada"
    && config?.configured
    && !windowInfo.expired
    && !sending
    && (draft.trim() || image),
  );

  async function loadOlder() {
    if (!selectedId || !olderCursor.current || loadingOlder) return;
    const cursor = olderCursor.current;
    const requestedId = selectedId;
    stickToBottom.current = false;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    setDetailError("");
    try {
      const result = await whatsappGet<WaDetail>("detail", { id: requestedId, before: cursor });
      if (selectedIdRef.current !== requestedId || requestedId !== result.conversation.id) return;
      setMessages((current) => mergeMessages(result.messages ?? [], current));
      olderCursor.current = result.nextBefore ?? null;
      hasLoadedOlder.current = true;
    } catch (error) {
      if (selectedIdRef.current === requestedId) {
        setDetailError(error instanceof Error ? error.message : "No se pudieron cargar mensajes anteriores.");
      }
    } finally {
      if (selectedIdRef.current === requestedId) setLoadingOlder(false);
      loadingOlderRef.current = false;
    }
  }

  async function assignCourier(value: string) {
    if (!isAdmin || !selectedId || assigning || selectedConversation?.status === "archivada") return;
    const requestedId = selectedId;
    setAssigning(true);
    setOperationError("");
    try {
      await whatsappPost("assign", { id: requestedId, courierId: value || null });
      if (selectedIdRef.current === requestedId) await loadDetail(requestedId, true);
      await loadList(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "No se pudo cambiar la asignación.");
    } finally {
      setAssigning(false);
    }
  }

  async function archiveConversation() {
    if (!isAdmin || !selectedId || !selectedConversation || archiving || selectedConversation.status === "archivada") return;
    if (!window.confirm(`¿Archivar la conversación con ${displayName(selectedConversation)}?`)) return;
    setArchiving(true);
    setOperationError("");
    try {
      await whatsappPost("archive", { id: selectedId });
      setSelectedId(null);
      await loadList(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "No se pudo archivar la conversación.");
    } finally {
      setArchiving(false);
    }
  }

  async function retryEvents() {
    if (!isAdmin || retrying) return;
    setRetrying(true);
    setOperationError("");
    try {
      const result = await whatsappPost<{ processed: number; failed: number }>("retry", {});
      if (result.failed) throw new Error("El evento sigue pendiente: no se pudo procesar. Revisa la configuración de Meta y vuelve a intentarlo.");
      await loadList(false);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "No se pudieron procesar eventos pendientes.");
    } finally {
      setRetrying(false);
    }
  }

  function selectImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setOperationError("Selecciona una imagen JPG o PNG.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      setOperationError("La imagen debe pesar 2 MB o menos.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setOperationError("");
    setImage(file);
    if (selectedId) imagesByConversation.current.set(selectedId, file);
  }

  async function sendMessage() {
    const text = draft.trim();
    if ((!text && !image) || !selectedId || !canSend) return;
    const sendingForId = selectedId;
    setSending(true);
    setOperationError("");
    let requestStarted = false;
    try {
      let imagePayload: { base64: string; mime: "image/jpeg" | "image/png"; name: string } | undefined;
      if (image) {
        imagePayload = {
          base64: await toBase64(image),
          mime: image.type as "image/jpeg" | "image/png",
          name: image.name,
        };
      }
      requestStarted = true;
      const result = await whatsappPost<{ message: WaMessage }>("send", {
        id: sendingForId,
        text,
        nonce: crypto.randomUUID(),
        ...(imagePayload ? { image: imagePayload } : {}),
      });
      draftsByConversation.current.delete(sendingForId);
      imagesByConversation.current.delete(sendingForId);
      if (selectedIdRef.current === sendingForId) {
        setMessages((current) => mergeMessages(current, [result.message]));
        // A background send must not erase text or a photo edited while waiting.
        setDraft(current => {
          if (current.trim() === text) return "";
          draftsByConversation.current.set(sendingForId, current);
          return current;
        });
        setImage(current => {
          if (current === image) return null;
          if (current) imagesByConversation.current.set(sendingForId, current);
          return current;
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      window.setTimeout(() => historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" }), 30);
      if (selectedIdRef.current === sendingForId) await loadDetail(sendingForId, true);
      await loadList(false);
    } catch (error) {
      // A transport failure can happen after the server accepted the message. Never send again automatically.
      const reason = error instanceof Error ? error.message : "La solicitud no se confirmó.";
      setOperationError(requestStarted
        ? reason + " No se confirmó el resultado; el mensaje podría haberse entregado. Revisa la conversación antes de volver a enviarlo."
        : reason);
    } finally {
      setSending(false);
    }
  }

  const assignmentNames = useMemo(() => new Map(couriers.map((courier) => [
    courier.id, courier.nombre?.trim() || "Repartidor sin nombre",
  ] as const)), [couriers]);
  const lastMessageByConversation = useMemo(() => {
    const latest = new Map<string, WaMessage>();
    // List payload is intentionally scoped; message previews are sourced from the current detail when available.
    if (detail) {
      const last = detail.messages[detail.messages.length - 1];
      if (last) latest.set(detail.conversation.id, last);
    }
    return latest;
  }, [detail]);
  const sortedConversations = useMemo(() => [...conversations].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
  ), [conversations]);
  const groupedMessages = useMemo(() => {
    const groups: Array<{ day: string; key: string; message: WaMessage }> = [];
    let previousDay = "";
    currentMessages.forEach((message) => {
      const day = formatDay(message.created_at);
      if (day !== previousDay) groups.push({ day, key: `day-${message.id}`, message });
      groups.push({ day: "", key: message.id, message });
      previousDay = day;
    });
    return groups;
  }, [currentMessages]);
  const archivedView = scope === "archived";

  return (
    <section className={`wa-crm${selectedId ? " has-thread" : ""}`} aria-label="CRM de WhatsApp">
      <header className="wa-crm__masthead">
        <div className="wa-crm__brand">
          <div className="wa-crm__mark" aria-hidden="true"><MessageCircle size={20} /></div>
          <div>
            <p className="wa-crm__eyebrow">Changuito Express · Bandeja de atención</p>
            <h1 className="wa-crm__title">WhatsApp CRM</h1>
            <p className="wa-crm__subline">Clientes y repartidores en contacto, con supervisión del administrador.</p>
          </div>
        </div>
        <div className="wa-crm__head-actions">
          <span className="wa-crm__mode" aria-label="Canal de prueba; no hay número comercial confirmado">
            <ShieldCheck size={13} /> Solo prueba
          </span>
          <button type="button" className="wa-crm__refresh" onClick={() => { void loadList(false); if (selectedId) void loadDetail(selectedId, true); }} aria-label="Actualizar conversaciones">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {config && <div className="wa-crm__notice" role="status">
        <strong>Canal de prueba.</strong> No se confirma la conexión de un número comercial.
        {!config.configured && <span> Envío desactivado: faltan {config.missing?.length ? config.missing.join(", ") : "datos de configuración"}.</span>}
        {config.configured && <span> La configuración está disponible, pero el canal sigue marcado como prueba.</span>}
        {isAdmin && config.pendingEvents > 0 && <span> {config.pendingEvents} eventos webhook pendientes.</span>}
      </div>}

      {isAdmin && config && config.pendingEvents > 0 && (
        <div className="wa-crm__notice" role="status">
          <strong>Eventos entrantes pendientes</strong> · Reprocesar un evento guardado por intento.
          <button type="button" className="wa-crm__action" style={{ marginLeft: 9 }} onClick={() => void retryEvents()} disabled={retrying}>
            {retrying ? <LoaderCircle size={13} /> : <RefreshCw size={13} />} {retrying ? "Procesando" : "Reprocesar"}
          </button>
        </div>
      )}
      {operationError && !selectedId && <div className="wa-crm__alert" style={{ margin: "10px 18px 0" }} role="alert">{operationError}</div>}

      <div className="wa-crm__workspace">
        <aside className="wa-crm__list-panel" aria-label="Lista de conversaciones">
          <div className="wa-crm__list-top">
            <div className="wa-crm__list-heading">
              <h2>Conversaciones</h2>
              <span className="wa-crm__count">{conversations.length} casos</span>
            </div>
            <div className="wa-crm__filters" role="group" aria-label="Filtrar conversaciones">
              <button type="button" className="wa-crm__filter" aria-pressed={!archivedView} onClick={() => { setSelectedId(null); setScope("active"); }}>Activas</button>
              <button type="button" className="wa-crm__filter" aria-pressed={archivedView} onClick={() => { setSelectedId(null); setScope("archived"); }}>Archivadas</button>
            </div>
          </div>

          <div className="wa-crm__conversation-list" aria-live="polite">
            {loadingList && conversations.length === 0 && [0, 1, 2, 3].map((item) => <div className="wa-crm__skeleton" key={item} aria-hidden="true" />)}
            {listError && (
              <div className="wa-crm__empty-list" role="alert">
                <AlertCircle size={24} />
                <h3>No se pudo cargar la bandeja</h3>
                <p>{listError}</p>
                <button type="button" className="wa-crm__action" style={{ marginTop: 12 }} onClick={() => void loadList(true)}>Reintentar</button>
              </div>
            )}
            {!loadingList && !listError && sortedConversations.length === 0 && (
              <div className="wa-crm__empty-list">
                <MessageCircle size={26} />
                <h3>{archivedView ? "Sin conversaciones archivadas" : "La bandeja está vacía"}</h3>
                <p>{archivedView ? "Las conversaciones archivadas aparecerán aquí." : "Las conversaciones aparecerán cuando llegue un mensaje por WhatsApp. No se crean desde este panel."}</p>
              </div>
            )}
            {!listError && sortedConversations.map((conversation) => {
              const lastMessage = lastMessageByConversation.get(conversation.id);
              const courierName = conversation.assigned_to ? assignmentNames.get(conversation.assigned_to) : null;
              return (
                <button
                  type="button"
                  key={conversation.id}
                  className={`wa-crm__conversation${selectedId === conversation.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(conversation.id)}
                  aria-current={selectedId === conversation.id ? "true" : undefined}
                  aria-label={`Abrir conversación con ${displayName(conversation)}, ${conversation.contact.phone}`}
                >
                  <span className="wa-crm__avatar" aria-hidden="true">
                    {displayName(conversation).slice(0, 1).toLocaleUpperCase("es-MX")}
                  </span>
                  <span className="wa-crm__conversation-copy">
                    <span className="wa-crm__conversation-line">
                      <span className="wa-crm__contact">{displayName(conversation)}</span>
                      <time className="wa-crm__list-time" dateTime={conversation.last_message_at}>{shortTime(conversation.last_message_at)}</time>
                    </span>
                    <span className="wa-crm__preview">{messagePreview(lastMessage)}</span>
                    <span className="wa-crm__tags">
                      <span className={`wa-crm__tag ${conversation.status === "abierta" ? "wa-crm__tag--open" : "wa-crm__tag--closed"}`}>
                        {conversation.status === "abierta" ? "Abierta" : "Archivada"}
                      </span>
                      <span className="wa-crm__tag">{courierName ?? (conversation.assigned_to ? "Repartidor asignado" : "Sin asignar")}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="wa-crm__detail" aria-label="Detalle de conversación">
          {!selectedId && (
            <div className="wa-crm__empty-thread">
              <div className="wa-crm__empty-inner">
                <div className="wa-crm__empty-icon"><MessageCircle size={23} /></div>
                <h3>Elige una conversación</h3>
                <p>Consulta el historial, el responsable de entrega y el tiempo disponible para responder.</p>
              </div>
            </div>
          )}
          {selectedId && selectedConversation && (
            <>
              <header className="wa-crm__thread-head">
                <button type="button" className="wa-crm__back" onClick={() => setSelectedId(null)} aria-label="Volver a conversaciones"><ArrowLeft size={17} /></button>
                <span className="wa-crm__avatar" aria-hidden="true">{displayName(selectedConversation).slice(0, 1).toLocaleUpperCase("es-MX")}</span>
                <div className="wa-crm__thread-person">
                  <h2 className="wa-crm__thread-name">{displayName(selectedConversation)}</h2>
                  <p className="wa-crm__thread-phone">{selectedConversation.contact.phone}</p>
                </div>
                <div className="wa-crm__thread-actions">
                  {isAdmin && selectedConversation.status !== "archivada" && (
                    <button type="button" className="wa-crm__action" onClick={() => void archiveConversation()} disabled={archiving} aria-label="Archivar conversación">
                      {archiving ? <LoaderCircle size={14} /> : <Archive size={14} />} <span>{archiving ? "Archivando" : "Archivar"}</span>
                    </button>
                  )}
                </div>
              </header>
              <div className="wa-crm__assignment">
                <div className="wa-crm__assignment-row">
                  <UserRound size={14} aria-hidden="true" />
                  <span className="wa-crm__assignment-label">Reparto</span>
                  {isAdmin ? (
                    <select
                      className="wa-crm__select"
                      value={selectedConversation.assigned_to ?? ""}
                      onChange={(event) => void assignCourier(event.target.value)}
                      disabled={assigning || selectedConversation.status === "archivada"}
                      aria-label="Asignar repartidor"
                    >
                      <option value="">Sin asignar</option>
                      {couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.nombre?.trim() || "Repartidor sin nombre"}</option>)}
                      {selectedConversation.assigned_to && !couriers.some((courier) => courier.id === selectedConversation.assigned_to) && (
                        <option value={selectedConversation.assigned_to}>Repartidor asignado</option>
                      )}
                    </select>
                  ) : (
                    <strong className="wa-crm__contact">{selectedConversation.assigned_to ? assignmentNames.get(selectedConversation.assigned_to) ?? "Repartidor asignado" : "Sin asignar"}</strong>
                  )}
                  <span className={`wa-crm__window${windowInfo.expired ? " is-expired" : ""}`}>
                    <strong><Clock3 size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />{windowInfo.label}</strong>
                    Ventana de servicio de 24 h
                  </span>
                </div>
                {isAdmin && (selectedDetail?.assignments.length ?? 0) > 0 && (
                  <p className="wa-crm__assignment-log">
                    Cambios: {(selectedDetail?.assignments ?? []).slice(0, 3).map((entry: WaAssignment, index) => {
                      const from = entry.previous_courier ? assignmentNames.get(entry.previous_courier) ?? "Repartidor asignado" : "Sin asignar";
                      const to = entry.next_courier ? assignmentNames.get(entry.next_courier) ?? "Repartidor asignado" : "Sin asignar";
                      return <React.Fragment key={entry.id}>{index > 0 ? " · " : ""}{from} → {to} · {shortTime(entry.created_at)}</React.Fragment>;
                    })}
                  </p>
                )}
              </div>

              <div className="wa-crm__history" ref={historyRef} onScroll={(event) => {
                const target = event.currentTarget;
                stickToBottom.current = target.scrollHeight - target.scrollTop - target.clientHeight < 70;
              }} aria-label="Historial de mensajes" aria-live="polite">
                {olderCursor.current && (
                  <div className="wa-crm__history-loader">
                    <button type="button" className="wa-crm__load-older" onClick={() => void loadOlder()} disabled={loadingOlder}>
                      {loadingOlder ? "Cargando anteriores…" : "Cargar mensajes anteriores"}
                    </button>
                  </div>
                )}
                {loadingDetail && currentMessages.length === 0 && [0, 1, 2].map((item) => <div key={item} className="wa-crm__skeleton" style={{ width: item === 1 ? "72%" : "53%", borderRadius: 9, margin: "8px 0" }} />)}
                {detailError && <div className="wa-crm__alert" role="alert">{detailError}<button type="button" className="wa-crm__action" style={{ marginLeft: 8 }} onClick={() => void loadDetail(selectedId, true)}>Reintentar</button></div>}
                {!loadingDetail && !detailError && currentMessages.length === 0 && (
                  <div className="wa-crm__empty-list"><h3>Aún no hay mensajes</h3><p>El historial se actualizará cuando llegue actividad por este canal.</p></div>
                )}
                <div className="wa-crm__messages">
                  {groupedMessages.map(({ day, key, message }) => {
                    if (key.startsWith("day-")) return <div className="wa-crm__date" key={key}>{day}</div>;
                    const outgoing = message.direction === "out";
                    const failed = friendlyStatus(message.status) === "Falló";
                    return (
                      <article key={message.id} className={`wa-crm__bubble${outgoing ? " wa-crm__bubble--out" : ""}${message.kind === "unsupported" ? " wa-crm__bubble--unsupported" : ""}`}>
                        {message.kind === "image" && (
                          imageUrls[message.id]
                            ? <a href={imageUrls[message.id]} target="_blank" rel="noreferrer" aria-label="Abrir imagen recibida"><img className="wa-crm__bubble-image" src={imageUrls[message.id]} alt="Imagen de la conversación" /></a>
                            : <p className="wa-crm__bubble-body">{imageErrors[message.id] || !message.image_path ? "No se pudo cargar la imagen." : "Cargando imagen autorizada…"}</p>
                        )}
                        {message.kind === "unsupported" && <p className="wa-crm__bubble-body">Tipo de mensaje no compatible{message.body ? `: ${message.body}` : "."}</p>}
                        {message.kind === "text" && message.body && <p className="wa-crm__bubble-body">{message.body}</p>}
                        <div className="wa-crm__bubble-meta">
                          <time dateTime={message.created_at}>{shortTime(message.created_at)}</time>
                          <span aria-label={`Estado: ${friendlyStatus(message.status)}`} title={friendlyStatus(message.status)}>{failed ? <AlertCircle size={11} /> : outgoing && message.status.toLowerCase() === "read" ? <CheckCheck size={11} /> : <Check size={11} />} {friendlyStatus(message.status)}</span>
                        </div>
                        {(message.error || (outgoing && failed)) && <span className="wa-crm__delivery-error">{message.error || "El proveedor reportó un error de entrega."}</span>}
                      </article>
                    );
                  })}
                </div>
              </div>

              <footer className="wa-crm__send-area">
                {image && (
                  <div className="wa-crm__photo-preview">
                    <img src={imagePreview} alt="Vista previa de la imagen que se enviará" />
                    <span className="wa-crm__photo-name">{image.name}</span>
                    <button type="button" className="wa-crm__remove-photo" onClick={() => { setImage(null); if (selectedId) imagesByConversation.current.delete(selectedId); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Quitar imagen"><X size={16} /></button>
                  </div>
                )}
                <div className="wa-crm__composer">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={(event) => selectImage(event.target.files?.[0])} aria-label="Seleccionar imagen JPG o PNG" />
                  <button type="button" className="wa-crm__attach" onClick={() => fileInputRef.current?.click()} disabled={sending || selectedConversation.status === "archivada" || !config?.configured || windowInfo.expired} aria-label="Adjuntar imagen JPG o PNG">
                    <ImagePlus size={17} />
                  </button>
                  <textarea
                    className="wa-crm__compose"
                    rows={1}
                    maxLength={4096}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (selectedId) draftsByConversation.current.set(selectedId, event.target.value);
                    }}
                    onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
                    placeholder="Escribe una respuesta…"
                    aria-label="Escribe un mensaje de WhatsApp"
                    disabled={sending || selectedConversation.status === "archivada" || !config?.configured || windowInfo.expired}
                  />
                  <button type="button" className="wa-crm__send" onClick={() => void sendMessage()} disabled={!canSend} aria-label="Enviar mensaje">
                    {sending ? <LoaderCircle size={16} /> : <Send size={16} />}
                  </button>
                </div>
                <div className={`wa-crm__send-help${!config?.configured || windowInfo.expired || selectedConversation.status === "archivada" ? " wa-crm__send-help--blocked" : ""}`}>
                  <span>
                    {selectedConversation.status === "archivada" ? <strong>Conversación archivada; no admite respuestas.</strong>
                      : !config?.configured ? <strong>Envío desactivado: falta configuración.</strong>
                        : windowInfo.expired ? <strong>Ventana de 24 h vencida; no se puede responder.</strong>
                          : "JPG o PNG · hasta 2 MB · Enter para enviar"}
                  </span>
                  <span>{draft.length}/4096</span>
                </div>
                {operationError && <div className="wa-crm__alert" role="alert">{operationError}</div>}
              </footer>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
