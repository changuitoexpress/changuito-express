/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { supabase } from './App';
import type { AppSession, Theme } from './App';

// ─── Tipos ────────────────────────────────────────────────────────────────────
// Debe coincidir con CartItem de Dashboard/App (checkout usa negocio, negocio_id, phone_number)
interface ItemCarrito {
  id:           string;
  nombre:       string;
  precio:       number;
  cantidad:     number;
  negocio:      string;
  negocio_id:   string;
  phone_number: string;
  tipo:         'producto' | 'mandadito';
}

const PHONE_OPERATIVO = '522223339999';

interface Mensaje {
  id:    string;
  rol:   'user' | 'bot';
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

interface EstadoConversacion {
  ultimoTema:      string;
  sugeridos:       any[];
  carritoTemporal: ItemCarrito[];
}

interface RespuestaIA {
  texto:  string;
  items?: ItemCarrito[];
}

// ─── Constantes de lenguaje ───────────────────────────────────────────────────
const NUMEROS_PALABRA: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, docena: 12,
};

const STOPWORDS = [
  'quiero', 'dame', 'pide', 'pedir', 'agrega', 'agregar', 'añade', 'anade',
  'por', 'favor', 'porfa', 'plis', 'con', 'sin', 'del', 'las', 'los', 'unos',
  'unas', 'para', 'que', 'quisiera', 'ocupo', 'necesito', 'tengo', 'antojo',
  'antoja', 'tambien', 'ademas', 'mas', 'algo', 'cosa', 'cosas', 'hacer',
];

const CONFIRM_PALABRAS = [
  'si', 'listo', 'ok', 'okay', 'dale', 'confirmar', 'confirma', 'confirmo',
  'proceder', 'procede', 'pagar', 'paga', 'finalizar',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function horaActual(): string {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function dinero(n: number): string {
  return '$' + (Math.round(n * 100) / 100);
}

function incluyeAlguna(texto: string, claves: string[]): boolean {
  for (let i = 0; i < claves.length; i++) {
    if (texto.indexOf(claves[i]) !== -1) return true;
  }
  return false;
}

function partirPalabras(texto: string): string[] {
  return texto.split(/[^a-z0-9]+/).filter(function(p) { return p.length > 0; });
}

function tokensSignificativos(texto: string): string[] {
  const crudos = partirPalabras(texto);
  const out: string[] = [];
  for (let i = 0; i < crudos.length; i++) {
    const t = crudos[i];
    if (t.length >= 3 && STOPWORDS.indexOf(t) === -1 && CONFIRM_PALABRAS.indexOf(t) === -1 && !/^\d+$/.test(t)) {
      out.push(t);
    }
  }
  return out;
}

function extraerCantidad(texto: string): number {
  const m = texto.match(/\d+/);
  if (m) {
    const n = parseInt(m[0], 10);
    if (n > 0 && n < 100) return n;
  }
  const palabras = partirPalabras(texto);
  for (let i = 0; i < palabras.length; i++) {
    if (NUMEROS_PALABRA[palabras[i]] !== undefined) return NUMEROS_PALABRA[palabras[i]];
  }
  return 1;
}

function esConfirmacion(texto: string): boolean {
  const palabras = partirPalabras(texto);
  let tieneConfirm = false;
  for (let i = 0; i < palabras.length; i++) {
    if (CONFIRM_PALABRAS.indexOf(palabras[i]) !== -1) tieneConfirm = true;
  }
  if (!tieneConfirm) return false;
  if (/\d/.test(texto)) return false;
  // No debe quedar ninguna palabra "de pedido" significativa
  return tokensSignificativos(texto).length === 0;
}

function buscarNegocio(negocios: any[], merchantId: string): any {
  for (let i = 0; i < negocios.length; i++) {
    if (negocios[i]?.id === merchantId) return negocios[i];
  }
  return null;
}

function construirItem(prod: any, negocios: any[], cantidad: number): ItemCarrito {
  const neg = buscarNegocio(negocios, prod.merchant_id);
  return {
    id:           String(prod.id),
    nombre:       String(prod.name),
    precio:       Number(prod.price) || 0,
    cantidad:     cantidad,
    negocio:      String(neg?.name ?? 'Changuito Express'),
    negocio_id:   String(prod.merchant_id),
    phone_number: String(neg?.phone_number ?? PHONE_OPERATIVO),
    tipo:         'producto',
  };
}

function buscarPorTokens(productos: any[], tokens: string[]): any[] {
  const res: any[] = [];
  for (let i = 0; i < productos.length; i++) {
    const nombre = quitarAcentos(String(productos[i]?.name ?? '').toLowerCase());
    let score = 0;
    for (let j = 0; j < tokens.length; j++) {
      if (nombre.indexOf(tokens[j]) !== -1) score++;
    }
    if (score > 0) res.push({ prod: productos[i], score: score });
  }
  res.sort(function(a, b) { return b.score - a.score; });
  return res;
}

function mejorPorToken(productos: any[], token: string): any {
  for (let i = 0; i < productos.length; i++) {
    const nombre = quitarAcentos(String(productos[i]?.name ?? '').toLowerCase());
    if (nombre.indexOf(token) !== -1) return productos[i];
  }
  return null;
}

function totalCarrito(items: ItemCarrito[]): number {
  let t = 0;
  for (let i = 0; i < items.length; i++) t += items[i].precio * items[i].cantidad;
  return t;
}

// Agrega items al carrito temporal (fusiona por id) y devuelve el total acumulado
function acumular(estado: EstadoConversacion, items: ItemCarrito[]) {
  for (let i = 0; i < items.length; i++) {
    const nuevo = items[i];
    let encontrado = false;
    for (let j = 0; j < estado.carritoTemporal.length; j++) {
      if (estado.carritoTemporal[j].id === nuevo.id) {
        estado.carritoTemporal[j].cantidad += nuevo.cantidad;
        encontrado = true;
        break;
      }
    }
    if (!encontrado) estado.carritoTemporal.push({ ...nuevo });
  }
}

function resumenLineas(items: ItemCarrito[]): string {
  return items.map(function(i) {
    return '• ' + i.cantidad + 'x ' + i.nombre + ' - ' + dinero(i.precio * i.cantidad);
  }).join('\n');
}

// ─── Motor de respuesta (IA local, sin API) ───────────────────────────────────
function generarRespuesta(input: string, estado: EstadoConversacion, productos: any[], negocios: any[]): RespuestaIA {
  const texto = quitarAcentos(input.toLowerCase().trim());

  // 1) Despedidas
  if (incluyeAlguna(texto, ['adios', 'bye', 'nos vemos', 'hasta luego'])) {
    return { texto: '¡Con gusto! 🐒 Aquí estaré cuando me necesites. ¡Disfruta tu pedido en Changuito Express!' };
  }

  // 2) Saludos
  if (incluyeAlguna(texto, ['hola', 'buenos', 'buenas', 'que onda', 'que tal', 'hey', 'ey'])) {
    estado.ultimoTema = 'saludo';
    return {
      texto: '¡Hola! 👋 Soy ChanguiBot IA, tu asistente inteligente de Changuito Express.\n\n🍕 Comida (tacos, memelas, tortas...)\n🛒 Supermercado (leche, pan, huevos...)\n💊 Farmacia (medicinas y productos)\n🚗 Traslados entre fraccionamientos\n🏠 Servicios y pagos\n📦 Mandaditos\n\n¿Qué se te antoja hoy?',
    };
  }

  // 3) Ayuda
  if (incluyeAlguna(texto, ['ayuda', 'como funciona', 'que puedes', 'que haces', 'opciones'])) {
    return {
      texto: '📋 Así te ayudo:\n\n🍕 COMIDA: dime qué se te antoja y te lo agrego al carrito\n🛒 SÚPER: dime los productos (leche, pan, huevos) y los armo\n💊 FARMACIA: medicinas y productos de salud\n🚗 TRASLADOS: mover cosas entre fraccionamientos\n🏠 SERVICIOS: pagos de luz, agua, depósitos\n📦 MANDADITOS: recados varios\n\n¿Qué necesitas?',
    };
  }

  // 4) Confirmación de pedido
  if (esConfirmacion(texto)) {
    if (estado.carritoTemporal.length > 0) {
      const total = totalCarrito(estado.carritoTemporal);
      return {
        texto: '✅ PEDIDO CONFIRMADO\n\n' + resumenLineas(estado.carritoTemporal) +
               '\n\n💰 TOTAL: ' + dinero(total) +
               '\n\nTu carrito está listo. Toca el carrito 🛒 de la app para proceder al pago.',
      };
    }
    return { texto: 'Perfecto, cuéntame qué necesitas y lo agrego a tu carrito. 🛒' };
  }

  // 5) Seguimiento: ya presentamos opciones y el usuario elige sabor/cantidad
  if (estado.sugeridos.length > 0) {
    const tokens = tokensSignificativos(texto);
    let elegido: any = null;
    for (let i = 0; i < estado.sugeridos.length && !elegido; i++) {
      const nombre = quitarAcentos(String(estado.sugeridos[i]?.name ?? '').toLowerCase());
      for (let j = 0; j < tokens.length; j++) {
        if (nombre.indexOf(tokens[j]) !== -1) { elegido = estado.sugeridos[i]; break; }
      }
    }
    if (!elegido && (/\d/.test(texto) || tokens.length === 0)) elegido = estado.sugeridos[0];
    if (elegido) {
      const cantidad = extraerCantidad(texto);
      const item = construirItem(elegido, negocios, cantidad);
      estado.sugeridos = [];
      estado.ultimoTema = 'pedido';
      acumular(estado, [item]);
      const total = totalCarrito(estado.carritoTemporal);
      return {
        items: [item],
        texto: '¡Listo! ' + cantidad + 'x ' + item.nombre + ' = ' + dinero(item.precio * cantidad) +
               '\nAcabo de agregarlo a tu carrito. 🛒\nTotal hasta ahora: ' + dinero(total) +
               '\n¿Quieres agregar algo más o confirmo tu pedido?',
      };
    }
  }

  // 6) Búsqueda de productos reales
  const tokens = tokensSignificativos(texto);
  if (tokens.length > 0 && productos.length > 0) {
    const cands = buscarPorTokens(productos, tokens);

    // 6a) Match fuerte (un producto contiene 2+ palabras): agrega directo
    if (cands.length > 0 && cands[0].score >= 2) {
      const prod = cands[0].prod;
      const cantidad = extraerCantidad(texto);
      const item = construirItem(prod, negocios, cantidad);
      estado.sugeridos = [];
      estado.ultimoTema = 'pedido';
      acumular(estado, [item]);
      const total = totalCarrito(estado.carritoTemporal);
      return {
        items: [item],
        texto: '¡Excelente! ' + cantidad + 'x ' + item.nombre + ' = ' + dinero(item.precio * cantidad) +
               '\nAgregado a tu carrito. 🛒\nTotal hasta ahora: ' + dinero(total) +
               '\n¿Algo más o confirmo tu pedido?',
      };
    }

    // 6b) Lista de varios productos distintos (ej: "leche, huevos y pan")
    if (tokens.length >= 2) {
      const distintos: any[] = [];
      const vistos: Record<string, boolean> = {};
      for (let i = 0; i < tokens.length; i++) {
        const p = mejorPorToken(productos, tokens[i]);
        if (p && !vistos[String(p.id)]) { vistos[String(p.id)] = true; distintos.push(p); }
      }
      if (distintos.length >= 2) {
        const items: ItemCarrito[] = [];
        for (let i = 0; i < distintos.length; i++) items.push(construirItem(distintos[i], negocios, 1));
        estado.sugeridos = [];
        estado.ultimoTema = 'pedido';
        acumular(estado, items);
        const total = totalCarrito(estado.carritoTemporal);
        return {
          items: items,
          texto: '¡Excelente combo! Lo armé así:\n\n' + resumenLineas(items) +
                 '\n\n💰 Total hasta ahora: ' + dinero(total) +
                 '\n¿Confirmo tu pedido o agregas algo más?',
        };
      }
    }

    // 6c) Varias variantes del mismo producto: presenta opciones
    if (cands.length >= 2) {
      const opciones = cands.slice(0, 5).map(function(c) { return c.prod; });
      estado.sugeridos = opciones;
      estado.ultimoTema = tokens[0];
      const lista = opciones.map(function(p) {
        return '• ' + p.name + ' - ' + dinero(Number(p.price) || 0);
      }).join('\n');
      return { texto: '¡Buena elección! Tengo estas opciones:\n\n' + lista + '\n\n¿Cuál quieres y cuántos?' };
    }

    // 6d) Un solo candidato: agrega directo
    if (cands.length === 1) {
      const prod = cands[0].prod;
      const cantidad = extraerCantidad(texto);
      const item = construirItem(prod, negocios, cantidad);
      estado.sugeridos = [];
      estado.ultimoTema = 'pedido';
      acumular(estado, [item]);
      const total = totalCarrito(estado.carritoTemporal);
      return {
        items: [item],
        texto: '¡Listo! ' + cantidad + 'x ' + item.nombre + ' = ' + dinero(item.precio * cantidad) +
               '\nAgregado a tu carrito. 🛒\nTotal hasta ahora: ' + dinero(total) +
               '\n¿Algo más o confirmo?',
      };
    }
  }

  // 7) Guía por categoría (cuando no hay match de producto)
  if (incluyeAlguna(texto, ['super', 'supermercado', 'compra', 'tienda', 'despensa', 'mercado'])) {
    estado.ultimoTema = 'supermercado';
    return { texto: '🛒 ¡Claro! Dime qué productos necesitas del súper (ej: leche, huevos, pan) y te los agrego al carrito.' };
  }
  if (incluyeAlguna(texto, ['farmacia', 'medicina', 'medicamento', 'pastilla', 'receta', 'jarabe'])) {
    estado.ultimoTema = 'farmacia';
    return { texto: '💊 Te ayudo con la farmacia. Dime qué medicina o producto necesitas y lo busco para agregarlo.' };
  }
  if (incluyeAlguna(texto, ['traslad', 'mover', 'llevar', 'mudanza', 'recoger', 'paquete', 'enviar'])) {
    estado.ultimoTema = 'traslados';
    return { texto: '🚗 ¡Hacemos traslados dentro de Lomas y La Vista! Dime qué necesitas mover y de dónde a dónde, y lo organizamos.' };
  }
  if (incluyeAlguna(texto, ['servicio', 'pago', 'luz', 'agua', 'recibo', 'deposito', 'banco', 'internet', 'telefono'])) {
    estado.ultimoTema = 'servicios';
    return { texto: '🏠 Te ayudamos con pagos de servicios (luz, agua, teléfono, internet) y depósitos bancarios. ¿Qué necesitas pagar?' };
  }
  if (incluyeAlguna(texto, ['mandadito', 'recado', 'encargo', 'favor'])) {
    estado.ultimoTema = 'mandaditos';
    return { texto: '📦 ¡Los mandaditos son lo nuestro! Cuéntame qué recado necesitas dentro de Lomas y La Vista y lo resolvemos.' };
  }
  if (incluyeAlguna(texto, ['comida', 'comer', 'restaurante', 'hambre', 'antojo', 'antoja'])) {
    estado.ultimoTema = 'comida';
    return { texto: '🍕 ¡Perfecto! Dime qué se te antoja (tacos, memelas, hamburguesas, tortas...) y te lo agrego al carrito.' };
  }

  // 8) Fallback
  return {
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
  const estadoRef = useRef<EstadoConversacion>({ ultimoTema: '', sugeridos: [], carritoTemporal: [] });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const isDark = props.theme === 'dark';

  // ── Scroll al último mensaje ────────────────────────────────────────────────
  useEffect(function() {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // ── Cargar datos de Supabase una sola vez ───────────────────────────────────
  useEffect(function() {
    let activo = true;
    async function cargar() {
      try {
        const prodRes = await supabase
          .from('products')
          .select('id, merchant_id, name, price, is_available')
          .eq('is_available', true)
          .limit(600);
        if (activo && prodRes.data) setProductos(prodRes.data);
      } catch(e) { console.error('Error cargando productos:', e); }
      try {
        const negRes = await supabase.from('merchants').select('*').limit(200);
        if (activo && negRes.data) setNegocios(negRes.data);
      } catch(e) { console.error('Error cargando negocios:', e); }
    }
    cargar();
    return function() { activo = false; };
  }, []);

  // ── Saludo al abrir ─────────────────────────────────────────────────────────
  useEffect(function() {
    if (props.abierto && mensajes.length === 0) {
      const saludo: Mensaje = {
        id: 'bienvenida', rol: 'bot', hora: horaActual(),
        texto: '¡Hola! 🐒 Soy ChanguiBot IA, tu asistente inteligente de Changuito Express. Dime qué se te antoja —comida, súper, farmacia, traslados o más— y lo agrego a tu carrito.',
      };
      setMensajes([saludo]);
      setTimeout(function() { inputRef.current?.focus(); }, 300);
    }
  }, [props.abierto]);

  // ── Enviar mensaje ──────────────────────────────────────────────────────────
  function enviarMensaje() {
    const texto = input.trim();
    if (!texto || cargando) return;
    setInput('');
    setMensajes(function(prev) {
      return [...prev, { id: 'u-' + Date.now(), rol: 'user', texto, hora: horaActual() }];
    });
    setCargando(true);
    setTimeout(function() {
      const r = generarRespuesta(texto, estadoRef.current, productos, negocios);
      if (r.items && r.items.length > 0) props.onAddToCart(r.items);
      setMensajes(function(prev) {
        return [...prev, { id: 'b-' + Date.now(), rol: 'bot', texto: r.texto, hora: horaActual() }];
      });
      setCargando(false);
    }, 600);
  }

  // ── Panel chat ─────────────────────────────────────────────────────────────
  if (!props.abierto) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 350,
      maxWidth: '480px', margin: '0 auto',
      height: '78vh',
      background: isDark ? '#0d0d1a' : '#FFFFFF',
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
          background: 'linear-gradient(135deg,#F59E0B,#F97316)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', boxShadow: '0 4px 12px rgba(245,158,11,0.4)', flexShrink: 0,
        }}>🐒</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>ChanguiBot IA</p>
          <p style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', margin: 0,
            color: cargando ? '#F59E0B' : 'var(--text-muted)',
          }}>
            {cargando ? '✨ Pensando...' : '● En línea'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800,
            background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
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
          const esBot = m.rol === 'bot';
          return (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: esBot ? 'flex-start' : 'flex-end',
              alignItems: 'flex-end', gap: '8px',
            }}>
              {esBot && (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: '#F59E0B', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '14px', flexShrink: 0,
                }}>🐒</div>
              )}
              <div style={{
                maxWidth: '78%', padding: '11px 14px',
                borderRadius: esBot ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                background: esBot
                  ? isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)'
                  : 'linear-gradient(135deg,#F59E0B,#F97316)',
                border: esBot ? '1px solid rgba(245,158,11,0.25)' : 'none',
              }}>
                <p style={{
                  fontSize: '13px',
                  color: esBot ? 'var(--text-primary)' : '#FFFFFF',
                  margin: '0 0 4px 0', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>{m.texto}</p>
                <p style={{ fontSize: '9px', color: esBot ? 'var(--text-muted)' : 'rgba(255,255,255,0.7)', margin: 0 }}>{m.hora}</p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {cargando && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#F59E0B', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '14px',
            }}>🐒</div>
            <div style={{
              padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
              background: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              display: 'flex', gap: '5px', alignItems: 'center',
            }}>
              {[0, 1, 2].map(function(i) {
                return (
                  <div key={i} style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: '#F59E0B', opacity: 0.6,
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
      <div style={{ padding: '12px 16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={function(e) { setInput(e.target.value); }}
            onKeyPress={function(e) { if (e.key === 'Enter') enviarMensaje(); }}
            placeholder="Cuéntame qué necesitas..."
            disabled={cargando}
            style={{
              flex: 1, padding: '12px 14px', borderRadius: '14px',
              border: '1px solid rgba(245,158,11,0.25)',
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
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
                : 'linear-gradient(135deg,#F59E0B,#F97316)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: cargando || !input.trim() ? 'none' : '0 4px 12px rgba(245,158,11,0.4)',
            }}
          >
            <Send style={{ width: '16px', height: '16px', color: '#FFFFFF' }} />
          </button>
        </div>
        <p style={{
          fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center',
          margin: '8px 0 0 0', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          🐒 CHANGUIBOT IA · ASISTENTE INTELIGENTE
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
