/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
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
  id:    string;
  rol:   'user' | 'bot' | 'sistema';
  texto: string;
  hora:  string;
}

interface Props {
  session:       AppSession;
  theme:         Theme;
  carritoGlobal: any[];
  onAddToCart:   (items: ItemCarrito[]) => void;
  abierto:       boolean;
  onCerrar:      () => void;
}

interface ContextoIA {
  negocios:  any[];
  productos: any[];
  ultimoTema: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function horaActual(): string {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function incluyeAlguna(texto: string, claves: string[]): boolean {
  for (let i = 0; i < claves.length; i++) {
    if (texto.indexOf(claves[i]) !== -1) return true;
  }
  return false;
}

// Coincidencia por palabra completa (evita falsos positivos con palabras cortas como "si", "va", "ok")
function tienePalabraExacta(texto: string, claves: string[]): boolean {
  const palabras = texto.split(/[^a-z0-9]+/);
  for (let i = 0; i < palabras.length; i++) {
    for (let j = 0; j < claves.length; j++) {
      if (palabras[i] === claves[j]) return true;
    }
  }
  return false;
}

// Busca hasta "limite" nombres de negocios cuyo nombre o categoría contenga alguna palabra clave
function negociosPorTema(negocios: any[], claves: string[], limite: number): string[] {
  const encontrados: string[] = [];
  for (let i = 0; i < negocios.length; i++) {
    const n = negocios[i];
    const nombre = quitarAcentos(String(n?.name ?? '').toLowerCase());
    const categoria = quitarAcentos(String(n?.category ?? n?.type ?? '').toLowerCase());
    if (incluyeAlguna(nombre, claves) || incluyeAlguna(categoria, claves)) {
      if (n?.name) encontrados.push(n.name);
    }
    if (encontrados.length >= limite) break;
  }
  return encontrados;
}

function listaNegocios(nombres: string[]): string {
  if (nombres.length === 0) return '';
  return ' Por ejemplo: ' + nombres.join(', ') + '.';
}

// ─── Base de conocimiento IA (LOCAL, sin API) ─────────────────────────────────
function respuestaIA(input: string, contexto: ContextoIA): { texto: string; tema: string } {
  const texto = quitarAcentos(input.toLowerCase().trim());

  // Despedidas
  if (incluyeAlguna(texto, ['adios', 'gracias', 'bye', 'nos vemos', 'hasta luego'])) {
    return {
      tema: 'despedida',
      texto: '¡Con gusto! 🐒 Aquí estaré cuando me necesites. ¡Que disfrutes tu pedido en Changuito Express!',
    };
  }

  // Saludos
  if (incluyeAlguna(texto, ['hola', 'buenos', 'buenas', 'que onda', 'que tal', 'hey', 'qué onda'])) {
    return {
      tema: 'saludo',
      texto: '¡Hola! 👋 Soy ChanguiBot, tu asistente de Changuito Express. Puedo ayudarte con comida, súper, farmacia, traslados, servicios y mandaditos. ¿Qué se te antoja hoy?',
    };
  }

  // Ayuda / cómo funciona
  if (incluyeAlguna(texto, ['ayuda', 'como funciona', 'que puedes', 'que haces', 'opciones', 'menu de opciones'])) {
    return {
      tema: 'ayuda',
      texto: '📋 Aquí va lo que puedo hacer:\n\n🍕 COMIDA: pide de restaurantes\n🛒 SÚPER: compra en supermercados\n💊 FARMACIA: medicinas y productos\n🚗 TRASLADOS: mover cosas entre fraccionamientos\n🏠 SERVICIOS: pagos de luz, agua, depósitos\n📦 MANDADITOS: recados varios\n\n¿Qué necesitas?',
    };
  }

  // Memelas / tortillas (caso específico)
  if (incluyeAlguna(texto, ['memela', 'tortilla', 'tlacoyo'])) {
    const negs = negociosPorTema(contexto.negocios, ['tortil', 'memela', 'maiz', 'antojito'], 3);
    return {
      tema: 'comida',
      texto: '¡Perfecto! 😋 Tengo tortillería con memelas deliciosas de cecina, rajas, queso y más.' +
             listaNegocios(negs) +
             '\n\nAbre el menú en la app (toca 🍕 Comida) para agregar exactamente lo que quieres al carrito. ¿Te ayudo con algo más?',
    };
  }

  // Tacos / hamburguesas / comida en general
  if (incluyeAlguna(texto, ['comida', 'comer', 'restaurante', 'taco', 'hamburguesa', 'pizza', 'antojo', 'hambre', 'pedido'])) {
    const negs = negociosPorTema(contexto.negocios, ['taco', 'burger', 'pizza', 'rest', 'comida', 'food'], 4);
    return {
      tema: 'comida',
      texto: '¡Excelente! 🍕 Tenemos restaurantes increíbles para ti.' +
             listaNegocios(negs) +
             '\n\nToca el botón 🍕 Comida en la pantalla para ver todos los menús y agregar al carrito. ¿Qué se te antoja?',
    };
  }

  // Súper / supermercado
  if (incluyeAlguna(texto, ['super', 'supermercado', 'compra', 'mandado', 'soriana', 'chedraui', 'despensa'])) {
    const negs = negociosPorTema(contexto.negocios, ['super', 'soriana', 'chedraui', 'city', 'market', 'merc'], 4);
    return {
      tema: 'super',
      texto: '¡Claro! 🛒 Para tus compras de súper tenemos varias tiendas.' +
             listaNegocios(negs) +
             '\n\nToca el botón 🛒 Mi Súper para ver las tiendas y armar tu lista. ¿Algo más?',
    };
  }

  // Farmacia
  if (incluyeAlguna(texto, ['farmacia', 'medicina', 'medicamento', 'pastilla', 'receta'])) {
    const negs = negociosPorTema(contexto.negocios, ['farmac', 'salud', 'botica'], 3);
    return {
      tema: 'farmacia',
      texto: '💊 Te ayudo con la farmacia. Tenemos medicinas y productos de salud.' +
             listaNegocios(negs) +
             '\n\nToca el botón 💊 Farmacia para ver las opciones. Si necesitas algo con receta, indícalo al hacer el pedido.',
    };
  }

  // Traslados
  if (incluyeAlguna(texto, ['traslado', 'mover', 'llevar', 'recoger', 'paquete', 'enviar', 'mandar algo'])) {
    return {
      tema: 'traslados',
      texto: '🚗 ¡Hacemos traslados entre fraccionamientos! Movemos objetos, documentos o paquetes dentro de Lomas y La Vista. Dime de dónde a dónde y qué necesitas mover, y lo organizamos.',
    };
  }

  // Servicios / pagos / depósitos
  if (incluyeAlguna(texto, ['servicio', 'pago', 'luz', 'agua', 'deposito', 'banco', 'recibo', 'telefono', 'internet'])) {
    return {
      tema: 'servicios',
      texto: '🏠 Te ayudamos con pagos de servicios (luz, agua, teléfono, internet) y depósitos bancarios. Toca el botón 🏠 Servicios para empezar, o dime qué necesitas pagar y te guío.',
    };
  }

  // Mandaditos
  if (incluyeAlguna(texto, ['mandadito', 'recado', 'favor', 'encargo'])) {
    return {
      tema: 'mandaditos',
      texto: '📦 ¡Los mandaditos son lo nuestro! Hacemos recados varios dentro de Lomas y La Vista. Cuéntame qué necesitas y lo resolvemos. Toca el botón 📦 Mandaditos para más opciones.',
    };
  }

  // Cobertura / zonas
  if (incluyeAlguna(texto, ['cobertura', 'zona', 'llegan', 'donde', 'lomas', 'vista', 'fraccionamiento'])) {
    return {
      tema: 'cobertura',
      texto: '📍 Damos servicio en Lomas 1, Lomas 2, Lomas 3 y La Vista, además de Sonata, Victoria, Toscana y Cluster. ¿En cuál fraccionamiento estás?',
    };
  }

  // Confirmación (palabra completa para evitar falsos positivos)
  if (tienePalabraExacta(texto, ['listo', 'si', 'confirmar', 'confirmo', 'proceder', 'dale', 'ok', 'okay', 'perfecto', 'va', 'adelante'])) {
    if (contexto.ultimoTema === 'comida' || contexto.ultimoTema === 'super' || contexto.ultimoTema === 'farmacia') {
      return {
        tema: contexto.ultimoTema,
        texto: '¡Genial! 🙌 Abre el botón correspondiente en la pantalla para agregar los productos a tu carrito. Cada producto puede personalizarse ahí. ¿Te ayudo con algo más?',
      };
    }
    return {
      tema: 'confirmacion',
      texto: '¡Perfecto! 🙌 ¿Con qué te ayudo? Puedo guiarte con comida, súper, farmacia, traslados, servicios o mandaditos.',
    };
  }

  // Fallback
  return {
    tema: 'general',
    texto: 'Entiendo. 🐒 Cuéntame un poco más para ayudarte mejor. Puedo apoyarte con comida, súper, farmacia, traslados, servicios o mandaditos. ¿Qué necesitas?',
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ChanguitoAI(props: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput]       = useState('');
  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);
  const [negocios, setNegocios]   = useState<any[]>([]);
  const ultimoTemaRef = useRef<string>('');
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const isDark = props.theme === 'dark';

  // ── Scroll al último mensaje ────────────────────────────────────────────────
  useEffect(function() {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ── Saludo al abrir ─────────────────────────────────────────────────────────
  useEffect(function() {
    if (props.abierto && mensajes.length === 0) {
      const saludo: Mensaje = {
        id: 'bienvenida', rol: 'bot', hora: horaActual(),
        texto: '¡Hola! 🐒 Soy ChanguiBot, tu asistente de Changuito Express. Puedo ayudarte con comida, súper, farmacia, traslados, servicios y mandaditos. ¿Qué se te antoja hoy?',
      };
      setMensajes([saludo]);
      setTimeout(function() { inputRef.current?.focus(); }, 300);
    }
  }, [props.abierto]);

  // ── Cargar datos de Supabase una sola vez ───────────────────────────────────
  useEffect(function() {
    let activo = true;
    async function cargarDatos() {
      try {
        const resNeg = await supabase.from('merchants').select('*').limit(200);
        if (activo && resNeg.data) setNegocios(resNeg.data);
      } catch(e) { console.error('Error cargando negocios:', e); }
      try {
        const resProd = await supabase
          .from('products')
          .select('id, merchant_id, name, price, is_available')
          .eq('is_available', true)
          .limit(600);
        if (activo && resProd.data) setProductos(resProd.data);
      } catch(e) { console.error('Error cargando productos:', e); }
    }
    cargarDatos();
    return function() { activo = false; };
  }, []);

  // ── Enviar mensaje ──────────────────────────────────────────────────────────
  function enviarMensaje(textoForzado?: string) {
    const texto = (textoForzado ?? input).trim();
    if (!texto || cargando) return;
    setInput('');
    setMensajes(function(prev) {
      return [...prev, { id: 'u-' + Date.now(), rol: 'user', texto, hora: horaActual() }];
    });
    setCargando(true);
    setTimeout(function() {
      const resultado = respuestaIA(texto, {
        negocios: negocios,
        productos: productos,
        ultimoTema: ultimoTemaRef.current,
      });
      ultimoTemaRef.current = resultado.tema;
      setMensajes(function(prev) {
        return [...prev, { id: 'b-' + Date.now(), rol: 'bot', texto: resultado.texto, hora: horaActual() }];
      });
      setCargando(false);
    }, 500);
  }

  // ── Panel chat ─────────────────────────────────────────────────────────────
  if (!props.abierto) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 350,
      maxWidth: '480px', margin: '0 auto',
      height: '78vh',
      background: isDark ? '#0d0d1a' : '#ffffff',
      borderRadius: '24px 24px 0 0',
      border: '1px solid rgba(245,158,11,0.25)',
      boxShadow: '0 -12px 48px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px',
        background: 'linear-gradient(135deg,rgba(245,158,11,0.12),transparent)',
        borderBottom: '1px solid rgba(245,158,11,0.15)', flexShrink: 0,
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '50%',
          background: 'linear-gradient(135deg,#facc15,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', boxShadow: '0 4px 12px rgba(245,158,11,0.4)', flexShrink: 0,
        }}>🐒</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>ChanguiBot</p>
          <p style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', margin: 0,
            color: cargando ? '#f59e0b' : '#22c55e',
          }}>
            {cargando ? '✨ Pensando...' : '● Tu asistente personal'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800,
            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.25)',
          }}>
            🛒 {props.carritoGlobal.length}
          </div>
          <button
            onClick={function() { props.onCerrar(); }}
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
                  margin: '0 0 4px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>{m.texto}</p>
                <p style={{ fontSize: '9px', color: esUser ? 'rgba(2,6,23,0.5)' : 'var(--text-muted)', margin: 0 }}>{m.hora}</p>
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

      {/* Input area */}
      <div style={{ padding: '10px 16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={function(e) { setInput(e.target.value); }}
            onKeyPress={function(e) { if (e.key === 'Enter') enviarMensaje(); }}
            placeholder="Escribe tu mensaje..."
            disabled={cargando}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: '16px',
              border: '1px solid #e5e7eb',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
            }}
          />
          <button
            onClick={function() { enviarMensaje(); }}
            disabled={cargando || !input.trim()}
            style={{
              width: '44px', height: '44px', borderRadius: '14px',
              border: 'none', flexShrink: 0,
              cursor: cargando || !input.trim() ? 'not-allowed' : 'pointer',
              background: cargando || !input.trim()
                ? 'rgba(245,158,11,0.25)'
                : 'linear-gradient(135deg,#facc15,#f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: cargando || !input.trim() ? 'none' : '0 4px 12px rgba(245,158,11,0.4)',
            }}
          >
            <Send style={{ width: '16px', height: '16px', color: '#020617' }} />
          </button>
        </div>
        <p style={{
          fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center',
          margin: '8px 0 0 0', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          🐒 CHANGUIBOT · CHANGUITO EXPRESS
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
