/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Sparkles, ShoppingCart, AlertCircle } from 'lucide-react';
import { supabase } from './App';
import type { AppSession, Theme } from './App';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProductoIA {
  merchant_id:    string;
  merchant_name:  string;
  product_id:     string;
  product_name:   string;
  price:          number;
  quantity:       number;
  emoji?:         string;
}

interface Mensaje {
  id:     string;
  rol:    'user' | 'assistant' | 'sistema';
  texto:  string;
  items?: ProductoIA[];
  hora:   string;
}

interface Props {
  session:               AppSession;
  theme:                 Theme;
  carritoGlobal:         any[];
  onAddToCart:           (items: ProductoIA[]) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function horaActual(): string {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

const EJEMPLOS = [
  'Una crepa de Nutella y unos tacos de Trípoli',
  'Algo para cenar de Los Cubiertos',
  'Unas memelas de cecina y un frappe',
  'Una comida corrida y un refresco',
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ChanguitoAI(props: Props) {
  const [abierto, setAbierto]       = useState(false);
  const [mensajes, setMensajes]     = useState<Mensaje[]>([]);
  const [input, setInput]           = useState('');
  const [cargando, setCargando]     = useState(false);
  const [productos, setProductos]   = useState<any[]>([]);
  const [error, setError]           = useState('');
  const [pulso, setPulso]           = useState(false);
  const chatEndRef                  = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);
  const isDark = props.theme === 'dark';

  // Pulso cada 8 seg para llamar la atención
  useEffect(function() {
    if (abierto) return;
    const t = setInterval(function() {
      setPulso(true);
      setTimeout(function() { setPulso(false); }, 1000);
    }, 8000);
    return function() { clearInterval(t); };
  }, [abierto]);

  // Scroll al último mensaje
  useEffect(function() {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Foco en input al abrir
  useEffect(function() {
    if (abierto) {
      setTimeout(function() { inputRef.current?.focus(); }, 300);
      if (mensajes.length === 0) {
        setMensajes([{
          id: 'bienvenida',
          rol: 'sistema',
          texto: '¡Hola! Soy Changuito 🐒 Tu asistente inteligente. Dime qué se te antoja y armo tu carrito al instante.',
          hora: horaActual(),
        }]);
      }
    }
  }, [abierto]);

  // Cargar productos de Supabase
  const cargarProductos = useCallback(async function() {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, merchant_id, name, price, category, is_available, merchants(name)')
        .eq('is_available', true)
        .limit(500);
      setProductos(data ?? []);
    } catch(e) { console.error('Error cargando productos:', e); }
  }, []);

  useEffect(function() { cargarProductos(); }, [cargarProductos]);

  // Construir contexto para Claude
  function construirContexto(): string {
    const mapa: Record<string, { merchant_name: string; productos: string[] }> = {};
    productos.forEach(function(p) {
      const mName = (p.merchants as any)?.name ?? 'Desconocido';
      if (!mapa[p.merchant_id]) mapa[p.merchant_id] = { merchant_name: mName, productos: [] };
      mapa[p.merchant_id].productos.push(p.name + ' ($' + p.price + ')');
    });

    let ctx = 'NEGOCIOS Y PRODUCTOS DISPONIBLES EN CHANGUITO EXPRESS:\n\n';
    Object.entries(mapa).slice(0, 30).forEach(function([mid, info]) {
      ctx += '🏪 ' + info.merchant_name + ' (ID: ' + mid + ')\n';
      info.productos.slice(0, 10).forEach(function(pr) { ctx += '  • ' + pr + '\n'; });
      ctx += '\n';
    });
    return ctx;
  }

  // Llamar a Claude API
  async function llamarClaude(textoUsuario: string): Promise<ProductoIA[]> {
    const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
    if (!apiKey) throw new Error('VITE_CLAUDE_API_KEY no configurada en Replit Secrets');

    const contexto = construirContexto();

    const systemPrompt = `Eres el asistente de pedidos de Changuito Express, una app de delivery en Lomas de Angelópolis, Puebla, México.

${contexto}

Tu única tarea es: cuando el usuario pida algo, encontrar los productos más cercanos en la lista y responder EXCLUSIVAMENTE con un JSON válido, sin texto adicional, sin markdown, sin explicaciones.

Formato de respuesta (SOLO JSON, nada más):
[{"merchant_id":"uuid-real","merchant_name":"nombre exacto","product_id":"uuid-real","product_name":"nombre exacto","price":99.99,"quantity":1}]

REGLAS:
- Usa SOLO los IDs y nombres que aparecen en la lista
- Si el usuario pide "tacos de Trípoli", busca el negocio que contenga "Trípoli" y el producto más parecido a tacos
- Si pides algo que no existe, no lo incluyas en el JSON
- Siempre devuelve un array JSON válido, aunque esté vacío: []
- NO uses markdown, NO uses bloques de código, SOLO el array JSON puro`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: textoUsuario }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message ?? 'Error en la API de Claude');
    }

    const data = await response.json();
    const texto = data.content?.[0]?.text ?? '[]';

    // Limpiar markdown si viene
    const limpio = texto.replace(/```json|```/g, '').trim();

    try {
      const items = JSON.parse(limpio) as ProductoIA[];
      // Enriquecer con datos reales de Supabase
      return items.map(function(item) {
        const prodReal = productos.find(function(p) { return p.id === item.product_id; });
        return {
          ...item,
          price:    prodReal?.price ?? item.price,
          emoji:    '🍽️',
        };
      }).filter(function(item) { return item.product_id && item.merchant_id; });
    } catch(e) {
      console.error('Error parseando JSON de Claude:', texto);
      return [];
    }
  }

  async function enviarMensaje() {
    const texto = input.trim();
    if (!texto || cargando) return;
    setInput('');
    setError('');

    // Agregar mensaje del usuario
    const msgUser: Mensaje = { id: 'u-' + Date.now(), rol: 'user', texto, hora: horaActual() };
    setMensajes(function(prev) { return [...prev, msgUser]; });
    setCargando(true);

    try {
      const items = await llamarClaude(texto);

      if (items.length === 0) {
        setMensajes(function(prev) {
          return [...prev, {
            id: 'a-' + Date.now(),
            rol: 'assistant',
            texto: 'No encontré exactamente lo que buscas 😅 ¿Puedes ser más específico? Por ejemplo: "una crepa de Nutella de La Crepa Fresa"',
            hora: horaActual(),
          }];
        });
        return;
      }

      // Calcular total
      const total = items.reduce(function(a, i) { return a + i.price * i.quantity; }, 0);
      const resumen = items.map(function(i) {
        return '• ' + i.quantity + 'x ' + i.product_name + ' de ' + i.merchant_name + ' — $' + (i.price * i.quantity).toFixed(2);
      }).join('\n');

      setMensajes(function(prev) {
        return [...prev, {
          id: 'a-' + Date.now(),
          rol: 'assistant',
          texto: '¡Listo! Encontré esto para ti:\n\n' + resumen + '\n\n💰 Total estimado: $' + total.toFixed(2),
          items,
          hora: horaActual(),
        }];
      });

    } catch(e: any) {
      setError(e.message ?? 'Error inesperado');
      setMensajes(function(prev) {
        return [...prev, {
          id: 'err-' + Date.now(),
          rol: 'sistema',
          texto: '⚠️ Hubo un error al procesar tu pedido. Intenta de nuevo.',
          hora: horaActual(),
        }];
      });
    } finally {
      setCargando(false);
    }
  }

  function agregarAlCarrito(items: ProductoIA[]) {
    // Convertir formato IA al formato del carritoGlobal
    const itemsCarrito = items.map(function(item) {
      return {
        id:          item.product_id,
        nombre:      item.product_name,
        precio:      item.price,
        cantidad:    item.quantity,
        negocio:     item.merchant_name,
        negocio_id:  item.merchant_id,
        tipo:        'producto',
      };
    });
    props.onAddToCart(itemsCarrito);
    setMensajes(function(prev) {
      return [...prev, {
        id: 'ok-' + Date.now(),
        rol: 'sistema',
        texto: '✅ ' + items.length + ' producto' + (items.length > 1 ? 's' : '') + ' agregado' + (items.length > 1 ? 's' : '') + ' al carrito. ¡A disfrutar! 🛵',
        hora: horaActual(),
      }];
    });
  }

  // ── BOTÓN FLOTANTE ─────────────────────────────────────────────────────────
  if (!abierto) {
    return (
      <button
        onClick={function() { setAbierto(true); }}
        style={{
          position: 'fixed', bottom: '88px', right: '16px', zIndex: 250,
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #facc15, #f59e0b)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: pulso
            ? '0 0 0 8px rgba(250,204,21,0.3), 0 8px 24px rgba(250,204,21,0.5)'
            : '0 8px 24px rgba(250,204,21,0.4)',
          transition: 'box-shadow 0.3s ease',
          fontSize: '22px',
        }}
        title="Asistente Changuito IA"
      >
        🐒
      </button>
    );
  }

  // ── PANEL CHAT ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 0, left: 0, zIndex: 350,
      display: 'flex', flexDirection: 'column',
      maxWidth: '480px', margin: '0 auto',
      height: '75vh',
      background: isDark ? '#0f0f1a' : '#ffffff',
      borderRadius: '24px 24px 0 0',
      border: '1px solid rgba(250,204,21,0.3)',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px',
        background: 'linear-gradient(135deg, rgba(250,204,21,0.15), rgba(250,204,21,0.05))',
        borderBottom: '1px solid rgba(250,204,21,0.15)',
        flexShrink: 0,
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #facc15, #f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', boxShadow: '0 4px 12px rgba(250,204,21,0.4)', flexShrink: 0,
        }}>🐒</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Changuito IA</p>
          <p style={{ fontSize: '10px', color: 'var(--color-yellow)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            {cargando ? '✨ Buscando...' : '● Listo para ordenar'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
            background: 'rgba(250,204,21,0.15)', color: 'var(--color-yellow)',
            border: '1px solid rgba(250,204,21,0.3)',
          }}>
            🛒 {props.carritoGlobal.length} items
          </div>
          <button onClick={function() { setAbierto(false); }}
            style={{ width: '32px', height: '32px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Ejemplos si no hay mensajes de usuario */}
        {mensajes.filter(function(m) { return m.rol === 'user'; }).length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>Intenta decir:</p>
            {EJEMPLOS.map(function(ej) {
              return (
                <button key={ej} onClick={function() { setInput(ej); inputRef.current?.focus(); }}
                  style={{
                    padding: '8px 12px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer',
                    background: isDark ? 'rgba(250,204,21,0.06)' : 'rgba(250,204,21,0.08)',
                    border: '1px solid rgba(250,204,21,0.2)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500,
                  }}>
                  💬 {ej}
                </button>
              );
            })}
          </div>
        )}

        {mensajes.map(function(m) {
          const esUser = m.rol === 'user';
          const esSistema = m.rol === 'sistema';

          if (esSistema) return (
            <div key={m.id} style={{ textAlign: 'center', padding: '8px 16px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{m.texto}</p>
            </div>
          );

          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: esUser ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '12px 14px',
                borderRadius: esUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: esUser
                  ? 'linear-gradient(135deg, #facc15, #f59e0b)'
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                border: esUser ? 'none' : '1px solid var(--border-subtle)',
              }}>
                <p style={{ fontSize: '13px', color: esUser ? '#020617' : 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.texto}</p>

                {/* Botón agregar al carrito */}
                {m.items && m.items.length > 0 && (
                  <button onClick={function() { agregarAlCarrito(m.items!); }}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      background: 'var(--color-green)', color: 'white', fontSize: '12px', fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      boxShadow: '0 4px 12px rgba(34,197,94,0.35)', marginTop: '4px',
                    }}>
                    <ShoppingCart style={{ width: '14px', height: '14px' }} />
                    Agregar al carrito
                  </button>
                )}

                <p style={{ fontSize: '9px', color: esUser ? 'rgba(2,6,23,0.5)' : 'var(--text-muted)', margin: '6px 0 0 0', textAlign: 'right' }}>{m.hora}</p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {cargando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: '1px solid var(--border-subtle)', display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0, 1, 2].map(function(i) {
                return (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-yellow)',
                    animation: 'pulse 1.2s ease-in-out ' + (i * 0.2) + 's infinite',
                  }} />
                );
              })}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0 16px 8px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <AlertCircle style={{ width: '13px', height: '13px', color: '#ef4444', flexShrink: 0 }} />
          <p style={{ fontSize: '11px', color: '#ef4444', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Sparkles style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: 'var(--color-yellow)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              value={input}
              onChange={function(e) { setInput(e.target.value); }}
              onKeyPress={function(e) { if (e.key === 'Enter') enviarMensaje(); }}
              placeholder="¿Qué se te antoja hoy?"
              disabled={cargando}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px 12px 34px',
                borderRadius: '14px', border: '1px solid rgba(250,204,21,0.3)',
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
              }}
            />
          </div>
          <button onClick={enviarMensaje} disabled={cargando || !input.trim()}
            style={{
              width: '44px', height: '44px', borderRadius: '14px', border: 'none', cursor: cargando || !input.trim() ? 'not-allowed' : 'pointer',
              background: cargando || !input.trim() ? 'rgba(250,204,21,0.3)' : 'linear-gradient(135deg, #facc15, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: cargando || !input.trim() ? 'none' : '0 4px 12px rgba(250,204,21,0.4)',
              flexShrink: 0,
            }}>
            <Send style={{ width: '16px', height: '16px', color: '#020617' }} />
          </button>
        </div>
        <p style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 0 0', letterSpacing: '0.05em' }}>
          ✨ POWERED BY CLAUDE AI · CHANGUITO EXPRESS
        </p>
      </div>
    </div>
  );
}
