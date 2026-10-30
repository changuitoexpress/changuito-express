import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ImagePlus, Mic, Paperclip, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { YarvisHistoryEntry, YarvisPendingAction, YarvisReply } from '../yarvisTypes';
import { useVoiceConversation } from '../../hooks/useVoiceConversation';

type Props = {
  theme: 'light' | 'dark';
  onClose: () => void;
  onSendMessage: (message: string, history: YarvisHistoryEntry[], imageName: string | null) => Promise<YarvisReply>;
  onConfirmAction: (action: YarvisPendingAction, image: File | null) => Promise<string>;
  onRefresh: () => void;
};

type Message = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
};

function actionLabel(type: YarvisPendingAction['type']): string {
  const labels: Record<YarvisPendingAction['type'], string> = {
    assign_order: 'Asignación de pedido',
    change_order_status: 'Cambio de estado',
    toggle_merchant: 'Disponibilidad de negocio',
    update_merchant: 'Actualización de negocio',
    update_product: 'Actualización de producto',
    upload_merchant_photo: 'Foto de negocio',
    upload_product_photo: 'Foto de producto',
  };
  return labels[type];
}

export default function YarvisPanel(props: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', text: 'Hola. Cuéntame qué necesitas resolver y lo revisamos antes de cambiar nada.' },
  ]);
  const [draft, setDraft] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [pendingAction, setPendingAction] = useState<YarvisPendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [result, setResult] = useState('');
  const [executionAttempted, setExecutionAttempted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void; onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null } | null>(null);
  const conversationRef = useRef<ReturnType<typeof useVoiceConversation> | null>(null);

  const dark = props.theme === 'dark';
  const colors = {
    panel: dark ? 'var(--bg-card, #202b27)' : 'var(--bg-card, #fffaf0)',
    surface: dark ? 'rgba(255,255,255,.045)' : 'rgba(90,74,42,.045)',
    raised: dark ? 'rgba(255,255,255,.075)' : '#fffdf7',
    border: 'var(--border-subtle, rgba(123,103,62,.16))',
    text: 'var(--text-primary, #27342e)',
    muted: 'var(--text-muted, #788078)',
    accent: 'var(--color-yellow, #f1bd39)',
    accentText: dark ? '#241d08' : '#33270b',
    green: 'var(--color-green, #438a60)',
    greenSoft: 'var(--color-green-dim, rgba(67,138,96,.12))',
    red: 'var(--color-red, #bd5145)',
    redSoft: 'var(--color-red-dim, rgba(189,81,69,.1))',
  };
  const panelStyle: React.CSSProperties = {
    position: 'fixed', zIndex: 300, right: 'clamp(12px, 3vw, 30px)', bottom: 'clamp(12px, 3vh, 28px)',
    width: 'min(448px, calc(100vw - 24px))', height: 'min(760px, calc(100dvh - 24px))',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '24px',
    background: colors.panel, color: colors.text, border: '1px solid ' + colors.border,
    boxShadow: dark ? '0 24px 80px rgba(0,0,0,.42)' : '0 24px 70px rgba(77,60,26,.2)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };
  const buttonBase: React.CSSProperties = {
    border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', transition: 'transform .16s ease, opacity .16s ease, background .16s ease',
  };
  const conversation = useVoiceConversation({
    open: true,
    busy: busy || !!pendingAction,
    assistantName: 'YARVIS',
    onTurn: async function (text) {
      const spokenReply = await sendMessage(text);
      if (spokenReply) conversationRef.current?.speak(spokenReply);
    },
    onNotice: function (text) { setVoiceError(text); },
  });
  conversationRef.current = conversation;

  useEffect(function () {
    bottomRef.current?.scrollIntoView({ behavior: pendingAction ? 'auto' : 'smooth', block: 'end' });
  }, [messages, busy, pendingAction]);

  useEffect(function () {
    if (!image) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return function () { URL.revokeObjectURL(url); };
  }, [image]);

  useEffect(function () {
    return function () {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  async function sendMessage(messageOverride?: string): Promise<string> {
    const text = (messageOverride ?? draft).trim();
    if (!text || busy || pendingAction) return '';
    setError('');
    setVoiceError('');
    setResult('');
    const history: YarvisHistoryEntry[] = messages.slice(-12).map(function (message) {
      return { role: message.role, text: message.text };
    });
    setMessages(function (current) {
      return current.concat({ id: Date.now(), role: 'user', text: text });
    });
    setDraft('');
    setBusy(true);
    try {
      const reply = await props.onSendMessage(text, history, image ? image.name : null);
      setMessages(function (current) {
        return current.concat({ id: Date.now() + 1, role: 'assistant', text: reply.reply });
      });
      setPendingAction(reply.action);
      setExecutionAttempted(false);
      if (reply.action) {
        return reply.reply + ' ' + reply.action.summary + ' Para aplicarlo, toca «Confirmar cambio». No ejecutaré ningún cambio solo por escucharlo.';
      }
      return reply.reply;
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setDraft(text);
      const message = detail ? 'No se pudo enviar. ' + detail : 'No se pudo enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.';
      setError(message);
      return message;
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction || busy) return;
    setBusy(true);
    setExecutionAttempted(true);
    setError('');
    setResult('');
    try {
      const confirmation = await props.onConfirmAction(pendingAction, image);
      setMessages(function (current) {
        return current.concat({ id: Date.now(), role: 'assistant', text: confirmation || 'El cambio se confirmó correctamente.' });
      });
      setPendingAction(null);
      setImage(null);
      setResult('Cambio confirmado. La información del panel se actualizará.');
      props.onRefresh();
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setError(detail ? 'No pude confirmar el resultado. ' + detail : 'No pude confirmar el resultado. Revisa el panel antes de reintentar.');
    } finally {
      setBusy(false);
    }
  }

  function cancelAction() {
    setPendingAction(null);
    setImage(null);
    setError('');
    setResult('');
    setMessages(function (current) {
      return current.concat({
        id: Date.now(),
        role: 'assistant',
        text: executionAttempted
          ? 'Propuesta descartada. Como intentaste aplicarla, revisa el estado del panel; puede haberse completado antes de perder la respuesta.'
          : 'Acción cancelada. No se realizó ningún cambio.',
      });
    });
    setExecutionAttempted(false);
  }

  function chooseImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(file.type)) {
      setError('Usa una imagen JPG, PNG, WebP o HEIC.');
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError('La imagen debe pesar menos de 5 MB.');
      return;
    }
    setError('');
    setImage(file);
  }

  function toggleVoice() {
    if (conversation.enabled) conversation.stop();
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('El dictado por voz no está disponible en este navegador. Puedes escribir tu solicitud.');
      return;
    }
    setVoiceError('');
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = function (event: any) {
      const transcript = event.results && event.results[0] && event.results[0][0] ? event.results[0][0].transcript : '';
      if (transcript) setDraft(function (current) { return current ? current.trimEnd() + ' ' + transcript : transcript; });
    };
    recognition.onerror = function () {
      setVoiceError('No se entendió el dictado. Inténtalo de nuevo o escribe tu solicitud.');
      setListening(false);
    };
    recognition.onend = function () { setListening(false); };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceError('No se pudo iniciar el micrófono. Revisa el permiso del navegador.');
    }
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <section role="dialog" aria-modal="false" aria-label="Asistente YARVIS" aria-busy={busy} style={panelStyle}>
      <header style={{ padding: '18px 18px 15px', background: dark ? 'linear-gradient(135deg, rgba(241,189,57,.12), rgba(67,138,96,.08))' : 'linear-gradient(135deg, #fff4d5, #f5f3e5)', borderBottom: '1px solid ' + colors.border }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: 15, display: 'grid', placeItems: 'center', flexShrink: 0, color: colors.accentText, background: colors.accent, boxShadow: '0 6px 16px rgba(180,130,24,.18)' }}>
              <Sparkles size={19} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <h2 style={{ margin: 0, fontSize: 16, lineHeight: 1.15, letterSpacing: '-.02em', fontWeight: 850 }}>YARVIS</h2>
                <span style={{ padding: '3px 7px', borderRadius: 999, background: colors.greenSoft, color: colors.green, fontSize: 9, fontWeight: 850, letterSpacing: '.08em' }}>MODO FUNDADOR</span>
              </div>
              <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: 11 }}>Asistencia operativa, con tu aprobación</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar YARVIS" disabled={busy && !!pendingAction} onClick={props.onClose} style={{ ...buttonBase, width: 34, height: 34, borderRadius: 12, background: colors.surface, color: colors.muted }}>
            <X size={17} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14, color: colors.muted, fontSize: 10 }}>
          <ShieldCheck size={14} color={colors.green} />
          <span>Ningún cambio se aplica sin tu confirmación</span>
        </div>
      </header>

      <div aria-live="polite" aria-relevant="additions text" style={{ flex: 1, overflowY: 'auto', padding: '17px 15px 10px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {messages.map(function (message) {
          const fromUser = message.role === 'user';
          return (
            <div key={message.id} style={{ display: 'flex', justifyContent: fromUser ? 'flex-end' : 'flex-start', animation: 'yarvisIn .2s ease both' }}>
              <div style={{ maxWidth: '86%', padding: '11px 13px', borderRadius: fromUser ? '16px 16px 5px 16px' : '16px 16px 16px 5px', background: fromUser ? (dark ? '#596d4d' : '#e6edda') : colors.surface, color: colors.text, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {!fromUser && <div style={{ color: colors.green, fontSize: 9, fontWeight: 850, letterSpacing: '.1em', marginBottom: 4 }}>YARVIS</div>}
                {message.text}
              </div>
            </div>
          );
        })}
        {busy && (
          <div role="status" aria-label={pendingAction ? 'Aplicando cambio' : 'YARVIS está pensando'} style={{ display: 'flex', gap: 5, width: 'fit-content', padding: '12px 14px', borderRadius: '15px', background: colors.surface }}>
            <span style={{ ...dotStyle(colors.muted), animationDelay: '0ms' }} />
            <span style={{ ...dotStyle(colors.muted), animationDelay: '150ms' }} />
            <span style={{ ...dotStyle(colors.muted), animationDelay: '300ms' }} />
          </div>
        )}
        {pendingAction && (
          <div style={{ borderRadius: 18, padding: 14, border: '1px solid ' + (dark ? 'rgba(241,189,57,.34)' : 'rgba(190,144,32,.32)'), background: dark ? 'rgba(241,189,57,.07)' : '#fff8e7', boxShadow: '0 8px 24px rgba(110,82,22,.06)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(194,148,36,.14)', color: dark ? '#f2c956' : '#946c12', flexShrink: 0 }}>
                <ShieldCheck size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: '1px 0 5px', fontSize: 10, fontWeight: 850, letterSpacing: '.08em', textTransform: 'uppercase', color: dark ? '#f2c956' : '#946c12' }}>Revisión requerida · {actionLabel(pendingAction.type)}</p>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, fontWeight: 650, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{pendingAction.summary}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={busy} onClick={confirmAction} style={{ ...buttonBase, flex: 1, gap: 7, minHeight: 40, borderRadius: 12, background: colors.green, color: '#fff', fontSize: 12, fontWeight: 800, opacity: busy ? .65 : 1 }}>
                <Check size={15} /> {busy ? 'Aplicando…' : 'Confirmar cambio'}
              </button>
              <button type="button" disabled={busy} onClick={cancelAction} style={{ ...buttonBase, padding: '0 14px', minHeight: 40, borderRadius: 12, background: colors.surface, color: colors.text, fontSize: 12, fontWeight: 750, opacity: busy ? .65 : 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        {result && <div role="status" style={{ padding: '10px 12px', borderRadius: 12, background: colors.greenSoft, color: colors.green, fontSize: 12, fontWeight: 700 }}>{result}</div>}
        {error && <div role="alert" style={{ padding: '10px 12px', borderRadius: 12, background: colors.redSoft, color: colors.red, border: '1px solid rgba(189,81,69,.18)', fontSize: 12, lineHeight: 1.45 }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <footer style={{ padding: '11px 14px 14px', borderTop: '1px solid ' + colors.border, background: colors.panel }}>
        {image && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 9px', marginBottom: 9, borderRadius: 13, background: colors.surface, border: '1px solid ' + colors.border }}>
            {previewUrl ? <img src={previewUrl} alt="Vista previa de la imagen adjunta" style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 9 }} /> : <Paperclip size={17} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{image.name}</div>
              <div style={{ fontSize: 10, color: colors.muted }}>Adjunta en este dispositivo; aún no se ha enviado</div>
            </div>
            <button type="button" aria-label="Quitar imagen adjunta" disabled={busy || !!pendingAction} onClick={function () { setImage(null); }} style={{ ...buttonBase, width: 28, height: 28, borderRadius: 9, background: 'transparent', color: colors.muted, opacity: busy || pendingAction ? .45 : 1 }}>
              <X size={15} />
            </button>
          </div>
        )}
        {voiceError && <p role="status" style={{ margin: '0 0 8px', color: colors.red, fontSize: 11, lineHeight: 1.4 }}>{voiceError}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, padding: '9px 10px', borderRadius: 14, border: '1px solid ' + colors.border, background: colors.surface }}>
          <div style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, flexShrink: 0, borderRadius: 11, color: conversation.enabled ? colors.green : colors.muted, background: conversation.enabled ? colors.greenSoft : 'transparent' }}>
            <Mic size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800 }}>Conversación hablada</div>
            <div role="status" aria-live="polite" aria-atomic="true" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, color: colors.muted, fontSize: 10 }}>
              {conversation.transcript ? 'Te escuché: ' + conversation.transcript : conversation.status}
            </div>
          </div>
          {conversation.enabled && conversation.status.includes('te está hablando') && (
            <button type="button" aria-label="Interrumpir a YARVIS" onClick={conversation.interrupt} style={{ ...buttonBase, minHeight: 34, padding: '0 10px', borderRadius: 10, background: colors.surface, color: colors.text, fontSize: 10, fontWeight: 750 }}>
              Interrumpir
            </button>
          )}
          <button
            type="button"
            aria-label={conversation.enabled ? 'Terminar conversación hablada con YARVIS' : 'Iniciar conversación hablada con YARVIS'}
            title={conversation.enabled ? 'Terminar conversación' : 'Habla con YARVIS; las acciones siempre requieren confirmación manual'}
            disabled={!conversation.enabled && (busy || !!pendingAction || listening)}
            onClick={function () {
              if (conversation.enabled) conversation.stop();
              else conversation.start();
            }}
            style={{ ...buttonBase, minHeight: 36, gap: 6, padding: '0 12px', borderRadius: 11, background: conversation.enabled ? colors.redSoft : colors.accent, color: conversation.enabled ? colors.red : colors.accentText, fontSize: 10, fontWeight: 850, opacity: !conversation.enabled && (busy || !!pendingAction || listening) ? .48 : 1 }}
          >
            <Mic size={15} /> {conversation.enabled ? 'Terminar' : 'Conversar'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, padding: 7, borderRadius: 18, border: '1px solid ' + colors.border, background: colors.surface, boxShadow: 'inset 0 1px 2px rgba(50,40,20,.025)' }}>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" aria-label="Adjuntar imagen" onChange={chooseImage} style={{ display: 'none' }} />
          <button type="button" aria-label="Adjuntar imagen" title="Adjuntar imagen" disabled={busy || !!pendingAction} onClick={function () { fileInputRef.current?.click(); }} style={{ ...buttonBase, width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: 'transparent', color: colors.muted, opacity: busy || pendingAction ? .45 : 1 }}>
            <ImagePlus size={18} />
          </button>
          <textarea value={draft} onChange={function (event) { setDraft(event.target.value); }} onKeyDown={onComposerKeyDown} disabled={busy || !!pendingAction} placeholder={pendingAction ? 'Confirma o cancela la acción pendiente' : 'Escribe o dicta tu solicitud…'} rows={1} aria-label="Mensaje para YARVIS" style={{ flex: 1, minWidth: 0, resize: 'none', maxHeight: 100, padding: '8px 2px', border: 0, outline: 0, background: 'transparent', color: colors.text, font: 'inherit', fontSize: 13, lineHeight: 1.4, opacity: pendingAction ? .55 : 1 }} />
          <button type="button" aria-label={listening ? 'Detener dictado' : 'Dictar por voz'} title={listening ? 'Detener dictado' : 'Dictar por voz'} disabled={busy || !!pendingAction || conversation.enabled} onClick={toggleVoice} style={{ ...buttonBase, width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: listening ? colors.redSoft : 'transparent', color: listening ? colors.red : colors.muted, opacity: busy || pendingAction || conversation.enabled ? .45 : 1 }}>
            <Mic size={17} />
          </button>
          <button type="button" aria-label="Enviar mensaje" disabled={busy || !!pendingAction || !draft.trim()} onClick={function () { void sendMessage(); }} style={{ ...buttonBase, width: 36, height: 36, borderRadius: 12, flexShrink: 0, background: colors.accent, color: colors.accentText, opacity: busy || pendingAction || !draft.trim() ? .48 : 1 }}>
            <ArrowUp size={18} strokeWidth={2.6} />
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 3px 0', color: colors.muted, fontSize: 10 }}>
          <span>{listening ? 'Escuchando… habla ahora' : 'Enter para enviar · Shift + Enter para salto'}</span>
          <span>Changuito Express</span>
        </div>
      </footer>
      <style>{'@keyframes yarvisIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@keyframes yarvisPulse{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}button:hover:not(:disabled){transform:translateY(-1px)}button:focus-visible,textarea:focus-visible{outline:2px solid rgba(194,148,36,.75);outline-offset:2px}'}</style>
    </section>
  );
}

function dotStyle(color: string): React.CSSProperties {
  return { width: 6, height: 6, borderRadius: 999, background: color, animation: 'yarvisPulse 1s ease-in-out infinite' };
}
