/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Send, ShoppingCart, AlertCircle, Volume2 } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './App';
import type { AppSession, Theme } from './App';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ItemCarrito {
  id:           string;
  merchant_id:  string;
  merchant_name:string;
  nombre:       string;
  precio:       number;
  cantidad:     number;
  negocio_id:   string;
  tipo:         string;
}

interface Mensaje {
  id:     string;
  rol:    'user' | 'bot' | 'sistema';
  texto:  string;
  items?: ItemCarrito[];
  hora:   string;
}

interface HistorialItem {
  role:  'user' | 'model';
  parts: { text: string }[];
}

interface Props {
  session:       AppSession;
  theme:         Theme;
  carritoGlobal: any[];
  onAddToCart:   (items: ItemCarrito[]) => void;
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres ChanguiBot 🐒, el asistente cajero de Changuito Express — delivery premium en Lomas de Angelópolis, Puebla, México. Eres amable, eficiente y conoces todos los servicios.

SERVICIOS:
1. 🍽️ PEDIDOS DE RESTAURANTES — 85+ negocios en la app
2. 🛒 MANDADITOS — compras en supermercados y tiendas en Lomas
3. 💡 PAGOS DE SERVICIOS — luz, agua, teléfono, internet (OXXO / 7-Eleven)
4. 🏦 DEPÓSITOS BANCARIOS — llevamos tu efectivo al banco o cajero
5. 📦 RECOLECCIÓN DE PAQUETES — recogemos en cualquier dirección de Lomas
6. 🚗 TRASLADOS — movemos objetos o documentos entre fraccionamientos

ZONAS DE COBERTURA: Lomas 1, Lomas 2, Lomas 3, La Vista, Sonata, Victoria, Toscana, Cluster. Si piden fuera de estas zonas, di amablemente que no tenemos cobertura aún.

REGLAS:
- Habla en español mexicano, amigable y profesional, máximo 3 oraciones
- Si piden comida de un negocio en el sistema, incluye al FINAL de tu respuesta: CARRITO_JSON:[{"merchant_id":"id","merchant_name":"nombre","product_id":"id","product_name":"nombre","price":99,"quantity":1}]
- Si piden algo fuera de la app pero en Lomas, ofrece mandadito
- Si piden pago de servicios, traslado o depósito, confirma y pide dirección
- NO uses markdown ni bloques de código

NEGOCIOS DISPONIBLES:
{{PRODUCTOS_CONTEXT}}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function horaActual(): string {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ChanguitoAI(props: Props) {
  const [abierto, setAbierto]       = useState(false);
  const [mensajes, setMensajes]     = useState<Mensaje[]>([]);
  const [input, setInput]           = useState('');
  const [cargando, setCargando]     = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [productos, setProductos]   = useState<any[]>([]);
  const [error, setError]           = useState('');
  const [historial, setHistorial]   = useState<HistorialItem[]>([]);
  const [pulso, setPulso]           = useState(false);
  const chatEndRef                  = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);
  const recognitionRef              = useRef<any>(null);
  const isDark = props.theme === 'dark';

  // ── Pulso periódico para llamar la atención ─────────────────────────────────
  useEffect(function() {
    if (abierto) return;
    const t = setInterval(function() {
      setPulso(true);
      setTimeout(function() { setPulso(false); }, 1200);
    }, 6000);
    return function() { clearInterval(t); };
  }, [abierto]);

  // ── Scroll al último mensaje ────────────────────────────────────────────────
  useEffect(function() {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ── Saludo al abrir ─────────────────────────────────────────────────────────
  useEffect(function() {
    if (abierto && mensajes.length === 0) {
      const saludo: Mensaje = {
        id: 'bienvenida', rol: 'bot', hora: horaActual(),
        texto: '¡Hola! 🐒 Soy ChanguiBot. ¿Qué se te antoja hoy? Puedo tomarte pedidos de comida, hacer mandaditos, pagos de servicios, depósitos y traslados. ¡Habla o escribe!',
      };
      setMensajes([saludo]);
      hablar(saludo.texto);
      setTimeout(function() { inputRef.current?.focus(); }, 300);
    }
  }, [abierto]);

  // ── Cargar productos de Supabase ────────────────────────────────────────────
  const cargarProductos = useCallback(async function() {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, merchant_id, name, price, is_available, merchants(name)')
        .eq('is_available', true)
        .limit(600);
      setProductos(data ?? []);
    } catch(e) { console.error('Error cargando productos:', e); }
  }, []);

  useEffect(function() { cargarProductos(); }, [cargarProductos]);

  // ── Text-to-speech ──────────────────────────────────────────────────────────
  function hablar(texto: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const limpio = texto
      .replace(/CARRITO_JSON:\[.*?\]/gs, '')
      .replace(/[🐒🍽️🛒💡🏦📦🚗✅⚠️]/g, '');
    const utt = new SpeechSynthesisUtterance(limpio);
    utt.lang = 'es-MX'; utt.rate = 1.05; utt.pitch = 1.1;
    const voces = window.speechSynthesis.getVoices();
    const voz = voces.find(function(v) { return v.lang.startsWith('es'); });
    if (voz) utt.voice = voz;
    window.speechSynthesis.speak(utt);
  }

  // ── Speech recognition ──────────────────────────────────────────────────────
  function toggleVoz() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('Usa Chrome o Safari actualizado para voz.'); return; }
    if (escuchando) {
      recognitionRef.current?.stop();
      setEscuchando(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'es-MX';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = function() { setEscuchando(true); setError(''); };
    rec.onresult = function(e: any) {
      const texto = e.results[0][0].transcript;
      setInput(texto);
      setEscuchando(false);
      setTimeout(function() { enviarMensaje(texto); }, 200);
    };
    rec.onerror = function(e: any) {
      setEscuchando(false);
      setError(e.error === 'not-allowed'
        ? 'Permite el micrófono en tu navegador.'
        : 'Error de micrófono: ' + e.error);
    };
    rec.onend = function() { setEscuchando(false); };
    recognitionRef.current = rec;
    rec.start();
  }

  // ── Construir contexto de productos para Gemini ─────────────────────────────
  function construirContexto(): string {
    const mapa: Record<string, { name: string; prods: string[] }> = {};
    productos.forEach(function(p) {
      const mn = (p.merchants as any)?.name ?? 'Desconocido';
      if (!mapa[p.merchant_id]) mapa[p.merchant_id] = { name: mn, prods: [] };
      mapa[p.merchant_id].prods.push(p.id + '|' + p.name + '|$' + p.price);
    });
    let ctx = '';
    Object.entries(mapa).slice(0, 35).forEach(function([mid, info]) {
      ctx += '[' + mid + '] ' + info.name + ': ' + info.prods.slice(0, 8).join(' / ') + '\n';
    });
    return ctx;
  }

  // ── Llamar a Gemini via SDK ─────────────────────────────────────────────────
  async function llamarGemini(textoUsuario: string): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Agrega VITE_GEMINI_API_KEY en Replit Secrets');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT.replace('{{PRODUCTOS_CONTEXT}}', construirContexto()),
    });

    const chat = model.startChat({ history: historial });
    const result = await chat.sendMessage(textoUsuario);
    const respuesta = result.response.text();

    setHistorial(function(prev) {
      return [
        ...prev,
        { role: 'user' as const,  parts: [{ text: textoUsuario }] },
        { role: 'model' as const, parts: [{ text: respuesta }] },
      ];
    });

    return respuesta;
  }

  // ── Extraer items del JSON embebido en la respuesta ─────────────────────────
  function extraerItems(respuesta: string): ItemCarrito[] {
    const match = respuesta.match(/CARRITO_JSON:(\[.*?\])/s);
    if (!match) return [];
    try {
      const items = JSON.parse(match[1]);
      return items.map(function(item: any) {
        const prodReal = productos.find(function(p) { return p.id === item.product_id; });
        return {
          id:            item.product_id,
          merchant_id:   item.merchant_id,
          merchant_name: item.merchant_name,
          nombre:        item.product_name,
          precio:        prodReal?.price ?? item.price,
          cantidad:      item.quantity ?? 1,
          negocio_id:    item.merchant_id,
          tipo:          'producto',
        };
      }).filter(function(i: ItemCarrito) { return i.id && i.negocio_id; });
    } catch(e) { return []; }
  }

  // ── Enviar mensaje ──────────────────────────────────────────────────────────
  async function enviarMensaje(textoForzado?: string) {
    const texto = (textoForzado ?? input).trim();
    if (!texto || cargando) return;
    setInput('');
    setError('');
    setMensajes(function(prev) {
      return [...prev, { id: 'u-' + Date.now(), rol: 'user', texto, hora: horaActual() }];
    });
    setCargando(true);
    try {
      const respuesta = await llamarGemini(texto);
      const items = extraerItems(respuesta);
      const textoLimpio = respuesta.replace(/CARRITO_JSON:\[.*?\]/gs, '').trim();
      setMensajes(function(prev) {
        return [...prev, {
          id:    'b-' + Date.now(),
          rol:   'bot',
          texto: textoLimpio,
          items: items.length > 0 ? items : undefined,
          hora:  horaActual(),
        }];
      });
      hablar(textoLimpio);
    } catch(e: any) {
      const msg = e.message ?? 'Error inesperado';
      setError(msg);
      setMensajes(function(prev) {
        return [...prev, { id: 'err-' + Date.now(), rol: 'sistema', texto: '⚠️ ' + msg, hora: horaActual() }];
      });
    } finally {
      setCargando(false);
    }
  }

  // ── Agregar al carrito ──────────────────────────────────────────────────────
  function agregarAlCarrito(items: ItemCarrito[]) {
    props.onAddToCart(items);
    setMensajes(function(prev) {
      return [...prev, {
        id:    'ok-' + Date.now(),
        rol:   'sistema',
        hora:  horaActual(),
        texto: '✅ ' + items.length + ' producto' + (items.length > 1 ? 's' : '') +
               ' agregado' + (items.length > 1 ? 's' : '') + ' al carrito.',
      }];
    });
    hablar('Listo, agregué los productos a tu carrito.');
  }

  // ── Botón flotante (cerrado) ────────────────────────────────────────────────
  if (!abierto) {
    return (
      <button
        onClick={function() { setAbierto(true); }}
        title="ChanguiBot IA"
        style={{
          position: 'fixed',
          top:      '115px',
          right:    '16px',
          zIndex:   90,
          width:    '44px',
          height:   '44px',
          borderRadius: '50%',
          border:   'none',
          cursor:   'pointer',
          background: 'linear-gradient(135deg,#facc15,#f59e0b)',
          display:  'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          boxShadow: pulso
            ? '0 0 0 8px rgba(250,204,21,0.25),0 0 0 16px rgba(250,204,21,0.1),0 6px 20px rgba(250,204,21,0.5)'
            : '0 6px 20px rgba(250,204,21,0.4)',
          transition: 'box-shadow 0.4s ease',
        }}
      >
        🐒
      </button>
    );
  }

  // ── Panel chat (abierto) ────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 350,
      maxWidth: '480px', margin: '0 auto',
      height: '78vh',
      background: isDark ? '#0d0d1a' : '#ffffff',
      borderRadius: '24px 24px 0 0',
      border: '1px solid rgba(250,204,21,0.25)',
      boxShadow: '0 -12px 48px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px',
        background: 'linear-gradient(135deg,rgba(250,204,21,0.12),transparent)',
        borderBottom: '1px solid rgba(250,204,21,0.15)', flexShrink: 0,
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: 'linear-gradient(135deg,#facc15,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', boxShadow: '0 4px 12px rgba(250,204,21,0.4)', flexShrink: 0,
        }}>🐒</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>ChanguiBot</p>
          <p style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', margin: 0,
            color: cargando ? 'var(--color-yellow)' : escuchando ? '#22c55e' : 'var(--text-muted)',
          }}>
            {cargando ? '✨ Pensando...' : escuchando ? '🎤 Escuchando...' : '● Tu asistente personal'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800,
            background: 'rgba(250,204,21,0.12)', color: 'var(--color-yellow)',
            border: '1px solid rgba(250,204,21,0.25)',
          }}>
            🛒 {props.carritoGlobal.length}
          </div>
          <button
            onClick={function() { window.speechSynthesis?.cancel(); setAbierto(false); }}
            style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              border: 'none', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {mensajes.map(function(m) {
          const esUser = m.rol === 'user';
          if (m.rol === 'sistema') {
            return (
              <div key={m.id} style={{
                textAlign: 'center', padding: '6px 14px', borderRadius: '12px',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                border: '1px solid var(--border-subtle)',
              }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{m.texto}</p>
              </div>
            );
          }
          return (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: esUser ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end', gap: '8px',
            }}>
              {!esUser && (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: '#facc15', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '14px', flexShrink: 0,
                }}>🐒</div>
              )}
              <div style={{
                maxWidth: '78%', padding: '11px 14px',
                borderRadius: esUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: esUser
                  ? 'linear-gradient(135deg,#facc15,#f59e0b)'
                  : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                border: esUser ? 'none' : '1px solid var(--border-subtle)',
              }}>
                <p style={{
                  fontSize: '13px',
                  color: esUser ? '#020617' : 'var(--text-primary)',
                  margin: '0 0 6px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>{m.texto}</p>
                {m.items && m.items.length > 0 && (
                  <button
                    onClick={function() { agregarAlCarrito(m.items!); }}
                    style={{
                      width: '100%', padding: '9px 14px', borderRadius: '12px',
                      border: 'none', cursor: 'pointer', background: '#22c55e',
                      color: 'white', fontSize: '12px', fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '6px', boxShadow: '0 4px 12px rgba(34,197,94,0.35)',
                    }}
                  >
                    <ShoppingCart style={{ width: '13px', height: '13px' }} />
                    Agregar {m.items.length} producto{m.items.length > 1 ? 's' : ''} al carrito
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <p style={{ fontSize: '9px', color: esUser ? 'rgba(2,6,23,0.5)' : 'var(--text-muted)', margin: 0 }}>{m.hora}</p>
                  {!esUser && (
                    <button
                      onClick={function() { hablar(m.texto); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 0 }}
                    >
                      <Volume2 style={{ width: '11px', height: '11px', color: 'var(--text-muted)' }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {cargando && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#facc15', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '14px',
            }}>🐒</div>
            <div style={{
              padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
              background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              border: '1px solid var(--border-subtle)',
              display: 'flex', gap: '5px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(function(i) {
                return (
                  <div key={i} style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: '#facc15', opacity: 0.6,
                    animation: 'changuiPulse 1.2s ease-in-out ' + (i * 0.2) + 's infinite',
                  }} />
                );
              })}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          margin: '0 16px 8px', padding: '8px 12px', borderRadius: '10px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0,
        }}>
          <AlertCircle style={{ width: '13px', height: '13px', color: '#ef4444', flexShrink: 0 }} />
          <p style={{ fontSize: '11px', color: '#ef4444', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: '10px 16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        {escuchando && (
          <div style={{
            textAlign: 'center', padding: '8px', marginBottom: '8px',
            borderRadius: '12px', background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}>
            <p style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700, margin: 0 }}>
              🎤 Escuchando... habla ahora
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Mic button */}
          <button
            onClick={toggleVoz}
            style={{
              width: '44px', height: '44px', borderRadius: '14px', border: 'none',
              cursor: 'pointer', flexShrink: 0,
              background: escuchando ? '#22c55e' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: escuchando ? '0 0 0 4px rgba(34,197,94,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {escuchando
              ? <MicOff style={{ width: '18px', height: '18px', color: 'white' }} />
              : <Mic style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }} />
            }
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            value={input}
            onChange={function(e) { setInput(e.target.value); }}
            onKeyPress={function(e) { if (e.key === 'Enter') enviarMensaje(); }}
            placeholder="Escribe o toca el mic 🎤"
            disabled={cargando || escuchando}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: '14px',
              border: '1px solid rgba(250,204,21,0.25)',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
            }}
          />

          {/* Send button */}
          <button
            onClick={function() { enviarMensaje(); }}
            disabled={cargando || !input.trim()}
            style={{
              width: '44px', height: '44px', borderRadius: '14px',
              border: 'none', flexShrink: 0,
              cursor: cargando || !input.trim() ? 'not-allowed' : 'pointer',
              background: cargando || !input.trim()
                ? 'rgba(250,204,21,0.25)'
                : 'linear-gradient(135deg,#facc15,#f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: cargando || !input.trim() ? 'none' : '0 4px 12px rgba(250,204,21,0.4)',
            }}
          >
            <Send style={{ width: '16px', height: '16px', color: '#020617' }} />
          </button>
        </div>
        <p style={{
          fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center',
          margin: '8px 0 0 0', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          ✨ POWERED BY GEMINI AI · CHANGUITO EXPRESS
        </p>
      </div>

      <style>{`
        @keyframes changuiPulse {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
