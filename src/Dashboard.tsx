/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  Search, Star, Clock, ChevronRight, WifiOff, RefreshCw, X,
  ChevronDown, ChevronUp, ShoppingBag, Plus, Minus, MessageCircle,
  Trash2, MapPin, CreditCard, Plus as PlusIcon, Check,
  Menu, LogOut, Store, Bike, ShoppingCart, Briefcase, Sparkles, Shield,
  Building2, Car, ShoppingBasket
} from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';
import VistaNegocio from './VistaNegocio';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Merchant {
  id:            string;
  name:          string;
  category:      string;
  rating:        number | null;
  delivery_time: string | null;
  image_url:     string | null;
  is_open:       boolean;
  phone_number:  string | null;
  commission:    number | null;
}

export interface CartItem {
  id:           string;
  nombre:       string;
  precio:       number;
  cantidad:     number;
  negocio:      string;
  negocio_id:   string;
  phone_number: string;
  tipo:         'producto' | 'mandadito';
  emoji?:       string;
}

interface Direccion {
  id:                    string;
  alias:                 string;
  calle:                 string;
  numero_casa:           string;
  referencias:           string | null;
  preferencias_entrega:  string | null;
  es_principal:          boolean;
}

interface DashboardProps {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onIrBazar?:     () => void;
  onIrServicios?: () => void;
  onIrAdmin?:     () => void;
  onIrShopping?:  () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const COSTO_ENVIO     = 50;
const PHONE_OPERATIVO = '522223339999';

const FORMAS_PAGO = [
  { id: 'efectivo',      label: 'Efectivo',         emoji: '💵' },
  { id: 'tarjeta',       label: 'Tarjeta',           emoji: '💳' },
  { id: 'transferencia', label: 'Transferencia',     emoji: '📲' },
  { id: 'en_linea',      label: 'Pago en línea',     emoji: '🌐' },
];

// ─── Secciones Restaurantes ───────────────────────────────────────────────────
const SECCIONES_REST = [
  { titulo: 'Desayunos y Comidas', cats: ['desayunos y comidas'],   emoji: '🍳' },
  { titulo: 'Cemitas',             cats: ['cemitas'],               emoji: '🫓' },
  { titulo: 'Tortas',              cats: ['tortas', 'cemitas'],     emoji: '🥖' },
  { titulo: 'Taquerías',           cats: ['taqueria'],              emoji: '🌮' },
  { titulo: 'Pizzerías',           cats: ['pizzeria'],              emoji: '🍕' },
  { titulo: 'Hamburguesas',        cats: ['hamburguesas'],          emoji: '🍔' },
  { titulo: 'Comida Asiática',     cats: ['comida asiatica'],       emoji: '🍜' },
  { titulo: 'Pollos Preparados',   cats: ['pollos preparados'],     emoji: '🍗' },
  { titulo: 'Pescados y Mariscos', cats: ['pescados y mariscos'],   emoji: '🦐' },
  { titulo: 'Pozolería',           cats: ['pozoleria'],             emoji: '🍲' },
  { titulo: 'Cochinita Pibil',     cats: ['cochinita pibil'],       emoji: '🫙' },
  { titulo: 'Carnitas',            cats: ['carnitas'],              emoji: '🥩' },
  { titulo: 'Barbacoa',            cats: ['barbacoa'],              emoji: '🫕' },
  { titulo: 'Birria',              cats: ['birria'],                emoji: '🌶️' },
  { titulo: 'Alitas y Boneless',   cats: ['alitas y boneless'],     emoji: '🍗' },
  { titulo: 'Elotes y Antojitos',  cats: ['elotes y antojitos'],    emoji: '🌽' },
  { titulo: 'Cafeterías',          cats: ['cafeteria'],             emoji: '☕' },
];

const SECCIONES_MAND = [
  { titulo: 'Desayunos',           keys: ['toks','viejo','ocho','tagers','almorzero'],                                       emoji: '🍳' },
  { titulo: 'Taquerías',           keys: ['oriental','pastor','suprema'],                                                    emoji: '🌮' },
  { titulo: 'Pizzerías',           keys: ['caesar','domino'],                                                                emoji: '🍕' },
  { titulo: 'Comida Asiática',     keys: ['sushiitto','sushi seven','rock n wok'],                                           emoji: '🍜' },
  { titulo: 'Hamburguesas',        keys: ['mcdonald','carl','burger','mccarthy','arby'],                                     emoji: '🍔' },
  { titulo: 'Pollos y Flautas',    keys: ['pollo feliz','flautlan'],                                                         emoji: '🍗' },
  { titulo: 'Cafeterías',          keys: ['starbucks','italian coffee'],                                                     emoji: '☕' },
  { titulo: 'Saludable',           keys: ['greenbite'],                                                                      emoji: '🥗' },
  { titulo: 'Panaderías',          keys: ['hackl','rosario','almendra'],                                                     emoji: '🥖' },
  { titulo: 'Pastelerías',         keys: ['zarza','europea','therese'],                                                      emoji: '🎂' },
  { titulo: 'Heladerías',          keys: ['santa clara','biancolatte'],                                                      emoji: '🍦' },
  { titulo: 'Bebidas',             keys: ['rapichela','clama'],                                                               emoji: '🧃' },
  { titulo: 'Comida Libanesa',     keys: ['biblos'],                                                                         emoji: '🫔' },
  { titulo: 'Carnicerías',         keys: ['lulu','maravillas','ryc','wild fork'],                                            emoji: '🥩' },
  { titulo: 'Pollerías',           keys: ['gallo giro'],                                                                     emoji: '🐓' },
  { titulo: 'Pescados y Mariscos', keys: ['almeja','taco cabo'],                                                             emoji: '🐟' },
  { titulo: 'Frutas y Verduras',   keys: ['canasta'],                                                                        emoji: '🥦' },
  { titulo: 'Lácteos',             keys: ['pastora','piccolina'],                                                            emoji: '🧀' },
  { titulo: 'Farmacias',           keys: ['farmacia','farmacias','farmadrogueria','benavides','similares','ahorro','pablo'], emoji: '💊' },
  { titulo: 'Papelerías',          keys: ['papelomas','depot','ofix'],                                                       emoji: '📎' },
  { titulo: 'Lavandería',          keys: ['yumikos'],                                                                        emoji: '👕' },
  { titulo: 'Mascotas',            keys: ['petco'],                                                                          emoji: '🐾' },
  { titulo: 'Supermercados',       keys: ['chedraui','comer','walmart'],                                                     emoji: '🛒' },
  { titulo: 'Conveniencia',        keys: ['oxxo','seven','circle'],                                                          emoji: '🏪' },
  { titulo: 'Barbacoa',            keys: ['barbaquita'],                                                                     emoji: '🫕' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEmoji(cat: string): string {
  const m: Record<string, string> = {
    'desayunos y comidas':'🍳','cemitas':'🫓','tortas':'🥖','taqueria':'🌮',
    'pizzeria':'🍕','hamburguesas':'🍔','comida asiatica':'🍜','pollos preparados':'🍗',
    'pescados y mariscos':'🦐','pozoleria':'🍲','cochinita pibil':'🫙','carnitas':'🥩',
    'barbacoa':'🫕','birria':'🌶️','alitas y boneless':'🍗','elotes y antojitos':'🌽',
    'cafeteria':'☕','mandaditos':'🛒','tiendita':'🏪',
  };
  return m[cat?.toLowerCase().trim()] ?? '🍽️';
}

function buildGrad(cat: string): string {
  const m: Record<string, string> = {
    'desayunos y comidas':'linear-gradient(135deg,#1e3a5f,#1d4ed8)',
    'cemitas':'linear-gradient(135deg,#713f12,#a16207)',
    'tortas':'linear-gradient(135deg,#713f12,#b45309)',
    'taqueria':'linear-gradient(135deg,#7c2d12,#c2410c)',
    'pizzeria':'linear-gradient(135deg,#7f1d1d,#b91c1c)',
    'hamburguesas':'linear-gradient(135deg,#1c1917,#78350f)',
    'comida asiatica':'linear-gradient(135deg,#134e4a,#0f766e)',
    'pollos preparados':'linear-gradient(135deg,#78350f,#b45309)',
    'pescados y mariscos':'linear-gradient(135deg,#0c4a6e,#0369a1)',
    'pozoleria':'linear-gradient(135deg,#2e1065,#7c3aed)',
    'cochinita pibil':'linear-gradient(135deg,#713f12,#a16207)',
    'carnitas':'linear-gradient(135deg,#7f1d1d,#b91c1c)',
    'barbacoa':'linear-gradient(135deg,#431407,#92400e)',
    'birria':'linear-gradient(135deg,#500724,#be123c)',
    'alitas y boneless':'linear-gradient(135deg,#7c2d12,#c2410c)',
    'elotes y antojitos':'linear-gradient(135deg,#713f12,#ca8a04)',
    'cafeteria':'linear-gradient(135deg,#1c1917,#44403c)',
    'mandaditos':'linear-gradient(135deg,#14532d,#15803d)',
    'tiendita':'linear-gradient(135deg,#1e3a5f,#0369a1)',
  };
  return m[cat?.toLowerCase().trim()] ?? 'linear-gradient(135deg,#1a1a2e,#2d2d44)';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ minWidth:'160px', width:'160px', borderRadius:'18px', overflow:'hidden', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', flexShrink:0 }}>
      <div className="skeleton" style={{ height:'90px' }} />
      <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:'6px' }}>
        <div className="skeleton" style={{ height:'12px', width:'70%' }} />
        <div className="skeleton" style={{ height:'10px', width:'50%' }} />
      </div>
    </div>
  );
}

// ─── Tarjeta Negocio ──────────────────────────────────────────────────────────
function TarjetaNegocio(props: { merchant: Merchant; onClick: () => void }) {
  const m = props.merchant;
  const isClosed = !m.is_open;
  return (
    <div onClick={props.onClick} style={{ minWidth:'160px', width:'160px', borderRadius:'18px', overflow:'hidden', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', cursor:'pointer', flexShrink:0, filter:isClosed?'grayscale(0.7) opacity(0.6)':'none' }}>
      <div style={{ height:'90px', background:buildGrad(m.category), position:'relative', overflow:'hidden' }}>
        {m.image_url
          ? <img src={m.image_url} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={function(e){ (e.currentTarget as HTMLImageElement).style.display='none'; }} />
          : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', opacity:0.4 }}>{getEmoji(m.category)}</div>
        }
        <div style={{ position:'absolute', top:'6px', right:'6px', padding:'2px 7px', borderRadius:'12px', background:isClosed?'rgba(0,0,0,0.6)':'rgba(34,197,94,0.85)', fontSize:'8px', fontWeight:900, color:'white', textTransform:'uppercase' }}>
          {isClosed ? 'Cerrado' : '● Abierto'}
        </div>
      </div>
      <div style={{ padding:'10px 10px 12px' }}>
        <p style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 3px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</p>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          <span style={{ fontSize:'10px', color:'var(--color-yellow)', fontWeight:700 }}>★ {(m.rating??4.5).toFixed(1)}</span>
          <span style={{ fontSize:'9px', color:'var(--text-muted)' }}>· {m.delivery_time??'25-35 min'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Sección Horizontal ───────────────────────────────────────────────────────
function SeccionH(props: { titulo: string; emoji: string; merchants: Merchant[]; loading: boolean; onSelect: (m: Merchant) => void }) {
  if (!props.loading && props.merchants.length === 0) return null;
  return (
    <div style={{ marginBottom:'24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'0 16px', marginBottom:'12px' }}>
        <span style={{ fontSize:'20px' }}>{props.emoji}</span>
        <h2 style={{ fontSize:'15px', fontWeight:800, color:'var(--text-primary)', margin:0 }}>{props.titulo}</h2>
        {!props.loading && <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>({props.merchants.length})</span>}
      </div>
      <div style={{ overflowX:'auto', paddingLeft:'16px', paddingRight:'16px', paddingBottom:'4px', display:'flex', gap:'12px', scrollbarWidth:'none' }}>
        {props.loading
          ? [1,2,3].map(function(i){ return <Skeleton key={i} />; })
          : props.merchants.map(function(m){ return <TarjetaNegocio key={m.id} merchant={m} onClick={function(){ props.onSelect(m); }} />; })
        }
      </div>
    </div>
  );
}

// ─── Banner rotativo ──────────────────────────────────────────────────────────
function Banner() {
  const [slide, setSlide] = useState(0);
  const slides = [
    { bg:'linear-gradient(135deg,#facc15,#f59e0b)', t:'⭐ Espacio Patrocinado',  s:'Tu negocio aquí · 222-100-0014' },
    { bg:'linear-gradient(135deg,#ef4444,#b91c1c)', t:'🚀 ¿Tienes un negocio?',  s:'Únete a Changuito Express' },
    { bg:'linear-gradient(135deg,#22c55e,#15803d)', t:'📍 Zona Lomas y Toscana', s:'Cobertura exclusiva residencial' },
    { bg:'linear-gradient(135deg,#3b82f6,#1d4ed8)', t:'💎 Delivery de Lujo',     s:'Para residentes de alto nivel' },
  ];
  useEffect(function(){
    const t = setInterval(function(){ setSlide(function(p){ return (p+1)%slides.length; }); }, 4500);
    return function(){ clearInterval(t); };
  }, []);
  const s = slides[slide];
  return (
    <div style={{ margin:'0 16px 20px', borderRadius:'18px', background:s.bg, padding:'18px 20px', position:'relative', overflow:'hidden', cursor:'pointer' }}>
      <div style={{ position:'absolute', right:'-8px', top:'-8px', width:'80px', height:'80px', borderRadius:'50%', background:'rgba(255,255,255,0.12)' }} />
      <p style={{ fontSize:'9px', fontWeight:900, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.2em', margin:'0 0 4px 0' }}>Publicidad</p>
      <h3 style={{ fontSize:'16px', fontWeight:900, color:'white', margin:'0 0 3px 0' }}>{s.t}</h3>
      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.75)', margin:0 }}>{s.s}</p>
      <div style={{ position:'absolute', bottom:'10px', right:'14px', display:'flex', gap:'4px' }}>
        {slides.map(function(_,i){ return <span key={i} style={{ width:i===slide?'14px':'5px', height:'5px', borderRadius:'3px', background:i===slide?'white':'rgba(255,255,255,0.35)', transition:'width 0.3s' }} />; })}
      </div>
    </div>
  );
}

// ─── Modal Mandadito ──────────────────────────────────────────────────────────
function ModalMandadito(props: { merchant: Merchant; onClose: () => void; onAgregar: (texto: string) => void }) {
  const [texto, setTexto] = useState('');
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:400, display:'flex', alignItems:'flex-end' }} onClick={props.onClose}>
      <div style={{ width:'100%', maxWidth:'480px', margin:'0 auto', background:'var(--bg-card)', borderRadius:'28px 28px 0 0', padding:'24px 20px 40px' }}
        onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-medium)', margin:'0 auto 20px' }} />
        <h2 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:'0 0 4px 0' }}>{props.merchant.name}</h2>
        <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'0 0 16px 0' }}>Escribe lo que necesitas — se agregará a tu carrito</p>
        <textarea value={texto} onChange={function(e){ setTexto(e.target.value); }}
          placeholder="Ej: 1 pizza pepperoni mediana, 2 refrescos de cola..."
          rows={4}
          style={{ width:'100%', boxSizing:'border-box', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:'14px', padding:'14px', color:'var(--text-primary)', fontSize:'14px', outline:'none', resize:'none', fontFamily:'system-ui,sans-serif', marginBottom:'12px' }}
        />
        <button onClick={function(){ if(texto.trim()==='') return; props.onAgregar(texto.trim()); }} disabled={texto.trim()===''} style={{ width:'100%', background:texto.trim()===''?'rgba(250,204,21,0.4)':'var(--color-yellow)', color:'#020617', fontWeight:900, fontSize:'13px', textTransform:'uppercase', letterSpacing:'0.1em', padding:'14px', borderRadius:'14px', border:'none', cursor:texto.trim()===''?'not-allowed':'pointer' }}>
          Agregar al carrito
        </button>
      </div>
    </div>
  );
}

// ─── Modal Checkout (Dirección + Pago + Confirmar) ────────────────────────────
function ModalCheckout(props: {
  carrito:      CartItem[];
  clienteId:    string;
  clienteEmail: string;
  onClose:      () => void;
  onPedidoOk:   () => void;
}) {
  const [paso, setPaso]                     = useState<'direccion' | 'pago' | 'resumen'>('direccion');
  const [direcciones, setDirecciones]       = useState<Direccion[]>([]);
  const [dirSeleccionada, setDirSel]        = useState<Direccion | null>(null);
  const [formaNueva, setFormaNueva]         = useState(false);
  const [alias, setAlias]                   = useState('Casa');
  const [calle, setCalle]                   = useState('');
  const [numero, setNumero]                 = useState('');
  const [referencias, setReferencias]       = useState('');
  const [preferencias, setPreferencias]     = useState('');
  const [formaPago, setFormaPago]           = useState('efectivo');
  const [enviando, setEnviando]             = useState(false);
  const [error, setError]                   = useState('');

  const subtotal   = props.carrito.reduce(function(a,i){ return a+i.precio*i.cantidad; }, 0);
  const total      = subtotal + COSTO_ENVIO;

  // Cargar direcciones guardadas
  useEffect(function(){
    supabase.from('direcciones_cliente')
      .select('*')
      .eq('cliente_id', props.clienteId)
      .order('es_principal', { ascending:false })
      .then(function(r){
        if (r.data && r.data.length > 0) {
          setDirecciones(r.data as Direccion[]);
          setDirSel(r.data.find(function(d: Direccion){ return d.es_principal; }) ?? r.data[0]);
        } else {
          setFormaNueva(true);
        }
      });
  }, []);

  async function guardarDireccionNueva(): Promise<Direccion | null> {
    if (!calle || !numero) { setError('Ingresa calle y número.'); return null; }
    const { data, error: err } = await supabase.from('direcciones_cliente').insert({
      cliente_id:           props.clienteId,
      alias,
      calle,
      numero_casa:          numero,
      referencias,
      preferencias_entrega: preferencias,
      es_principal:         direcciones.length === 0,
    }).select().single();
    if (err) { setError(err.message); return null; }
    return data as Direccion;
  }

  async function confirmarPedido() {
    setEnviando(true); setError('');
    try {
      let dir = dirSeleccionada;
      if (formaNueva) {
        dir = await guardarDireccionNueva();
        if (!dir) { setEnviando(false); return; }
      }

      // Agrupar por negocio e insertar en pedidos
      const porNegocio: Record<string, CartItem[]> = {};
      props.carrito.forEach(function(item){
        if (!porNegocio[item.negocio_id]) porNegocio[item.negocio_id] = [];
        porNegocio[item.negocio_id].push(item);
      });

      for (const negId of Object.keys(porNegocio)) {
        const items   = porNegocio[negId];
        const detalle = items.map(function(i){ return i.nombre + (i.tipo==='producto'?' x'+i.cantidad:''); }).join(', ');
        const sub     = items.reduce(function(a,i){ return a+i.precio*i.cantidad; }, 0);
        await supabase.from('pedidos').insert({
          cliente_id:     props.clienteId,
          negocio_id:     negId,
          negocio_nombre: items[0].negocio,
          detalle, subtotal:sub, costo_envio:COSTO_ENVIO, total:sub+COSTO_ENVIO,
          estatus:'pendiente', canal:'webapp',
          cliente_email:  props.clienteEmail,
          forma_pago:     formaPago,
          direccion:      dir ? dir.calle + ' ' + dir.numero_casa : '',
        });
      }

      // Mensaje WhatsApp estructurado
      const linea = '━━━━━━━━━━━━━━━━━━━━━━';
      let msg = '*🛵 CHANGUITO EXPRESS*\n' + linea + '\n';
      msg += '👤 *Cliente:* ' + props.clienteEmail + '\n';
      msg += '📍 *Dirección:* ' + (dir ? dir.calle + ' ' + dir.numero_casa + (dir.referencias?', '+dir.referencias:'') : '') + '\n';
      if (dir?.preferencias_entrega) msg += '🔔 *Instrucciones:* ' + dir.preferencias_entrega + '\n';
      msg += '💳 *Pago:* ' + FORMAS_PAGO.find(function(f){ return f.id===formaPago; })?.label + '\n';
      msg += linea + '\n\n';

      Object.entries(porNegocio).forEach(function([_, items]) {
        msg += '🍽️ *' + items[0].negocio.toUpperCase() + '*\n';
        items.forEach(function(item){
          if (item.tipo === 'mandadito') {
            msg += '   📝 ' + item.nombre + '\n';
          } else {
            msg += '   • ' + item.nombre + ' x' + item.cantidad + ' = $' + (item.precio*item.cantidad).toFixed(2) + '\n';
          }
        });
        msg += linea + '\n';
      });

      msg += '\n🚚 *Envío:* $' + COSTO_ENVIO.toFixed(2) + '\n';
      msg += '*💰 TOTAL A PAGAR: $' + total.toFixed(2) + '*\n' + linea;

      window.open('https://wa.me/' + PHONE_OPERATIVO + '?text=' + encodeURIComponent(msg), '_blank');
      props.onPedidoOk();

    } catch(err: any) {
      setError(err.message ?? 'Error al procesar el pedido.');
    } finally {
      setEnviando(false);
    }
  }

  const bgCard    = 'var(--bg-card)';
  const bgBase    = 'var(--bg-base)';
  const textPrim  = 'var(--text-primary)';
  const textMuted = 'var(--text-muted)';
  const border    = 'var(--border-subtle)';

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:500, display:'flex', alignItems:'flex-end' }} onClick={props.onClose}>
      <div style={{ width:'100%', maxWidth:'480px', margin:'0 auto', background:bgCard, borderRadius:'28px 28px 0 0', padding:'24px 20px 40px', maxHeight:'90vh', overflowY:'auto' }}
        onClick={function(e){ e.stopPropagation(); }}>

        {/* Handle + título */}
        <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-medium)', margin:'0 auto 20px' }} />

        {/* Pasos */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
          {(['direccion','pago','resumen'] as const).map(function(p, i){
            const activo = paso === p;
            const done   = (paso==='pago'&&i===0)||(paso==='resumen'&&i<=1);
            const labels = ['📍 Dirección','💳 Pago','✅ Confirmar'];
            return (
              <div key={p} style={{ flex:1, textAlign:'center', padding:'8px 4px', borderRadius:'12px', background:activo?'var(--color-yellow-dim)':done?'rgba(34,197,94,0.1)':'var(--bg-base)', border:`1px solid ${activo?'var(--color-yellow)':done?'var(--color-green)':border}` }}>
                <p style={{ fontSize:'10px', fontWeight:700, color:activo?'var(--color-yellow)':done?'var(--color-green)':textMuted, margin:0 }}>{labels[i]}</p>
              </div>
            );
          })}
        </div>

        {/* ── PASO 1: DIRECCIÓN ── */}
        {paso === 'direccion' && (
          <div>
            <h3 style={{ fontSize:'17px', fontWeight:900, color:textPrim, margin:'0 0 14px 0' }}>¿Dónde entregamos?</h3>

            {/* Direcciones guardadas */}
            {!formaNueva && direcciones.map(function(d){
              const sel = dirSeleccionada?.id === d.id;
              return (
                <div key={d.id} onClick={function(){ setDirSel(d); }}
                  style={{ padding:'14px 16px', borderRadius:'16px', marginBottom:'10px', cursor:'pointer', border:`2px solid ${sel?'var(--color-yellow)':border}`, background:sel?'var(--color-yellow-dim)':bgBase }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                    <p style={{ fontSize:'13px', fontWeight:800, color:textPrim, margin:0 }}>
                      <MapPin style={{ width:'13px', height:'13px', display:'inline', marginRight:'5px', verticalAlign:'middle' }} />
                      {d.alias}
                    </p>
                    {sel && <Check style={{ width:'16px', height:'16px', color:'var(--color-yellow)' }} />}
                  </div>
                  <p style={{ fontSize:'12px', color:textMuted, margin:0 }}>{d.calle} {d.numero_casa}</p>
                  {d.referencias && <p style={{ fontSize:'11px', color:textMuted, margin:'2px 0 0 0' }}>{d.referencias}</p>}
                </div>
              );
            })}

            {/* Botón agregar nueva */}
            {!formaNueva && (
              <button onClick={function(){ setFormaNueva(true); setDirSel(null); }}
                style={{ width:'100%', padding:'12px', borderRadius:'14px', border:`1px dashed ${border}`, background:'transparent', color:textMuted, fontSize:'13px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginBottom:'16px' }}>
                <PlusIcon style={{ width:'14px', height:'14px' }} />
                Agregar nueva dirección
              </button>
            )}

            {/* Formulario nueva dirección */}
            {formaNueva && (
              <div style={{ background:bgBase, borderRadius:'16px', padding:'16px', border:`1px solid ${border}`, marginBottom:'16px' }}>
                <p style={{ fontSize:'13px', fontWeight:700, color:textPrim, margin:'0 0 12px 0' }}>Nueva dirección</p>
                {[
                  { label:'Alias (Casa, Trabajo...)', val:alias,       set:setAlias,       ph:'Casa' },
                  { label:'Calle *',                  val:calle,        set:setCalle,       ph:'Av. Principal' },
                  { label:'Número / Depto *',         val:numero,       set:setNumero,      ph:'123 Torre A' },
                  { label:'Referencias',              val:referencias,  set:setReferencias, ph:'Junto al parque' },
                  { label:'Instrucciones de entrega', val:preferencias, set:setPreferencias,ph:'No tocar timbre' },
                ].map(function(f){
                  return (
                    <div key={f.label} style={{ marginBottom:'10px' }}>
                      <p style={{ fontSize:'11px', fontWeight:600, color:textMuted, margin:'0 0 4px 0' }}>{f.label}</p>
                      <input value={f.val} onChange={function(e){ f.set(e.target.value); }} placeholder={f.ph}
                        style={{ width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:'12px', border:`1px solid ${border}`, background:'var(--bg-card)', color:textPrim, fontSize:'13px', outline:'none' }} />
                    </div>
                  );
                })}
                {direcciones.length > 0 && (
                  <button onClick={function(){ setFormaNueva(false); setDirSel(direcciones[0]); }}
                    style={{ fontSize:'12px', color:textMuted, background:'none', border:'none', cursor:'pointer', padding:0, marginTop:'4px' }}>
                    ← Usar dirección guardada
                  </button>
                )}
              </div>
            )}

            {error && <p style={{ fontSize:'12px', color:'var(--color-red)', marginBottom:'10px' }}>{error}</p>}

            <button onClick={function(){ setError(''); setPaso('pago'); }}
              disabled={!formaNueva && !dirSeleccionada}
              style={{ width:'100%', background:'var(--color-yellow)', color:'#020617', fontWeight:900, fontSize:'14px', padding:'15px', borderRadius:'16px', border:'none', cursor:'pointer' }}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── PASO 2: FORMA DE PAGO ── */}
        {paso === 'pago' && (
          <div>
            <h3 style={{ fontSize:'17px', fontWeight:900, color:textPrim, margin:'0 0 14px 0' }}>¿Cómo vas a pagar?</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px' }}>
              {FORMAS_PAGO.map(function(f){
                const sel = formaPago === f.id;
                return (
                  <button key={f.id} onClick={function(){ setFormaPago(f.id); }}
                    style={{ padding:'16px 12px', borderRadius:'16px', border:`2px solid ${sel?'var(--color-yellow)':border}`, background:sel?'var(--color-yellow-dim)':bgBase, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}>
                    <span style={{ fontSize:'24px' }}>{f.emoji}</span>
                    <span style={{ fontSize:'12px', fontWeight:700, color:sel?'var(--color-yellow)':textPrim }}>{f.label}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={function(){ setPaso('direccion'); }}
                style={{ flex:1, padding:'14px', borderRadius:'14px', border:`1px solid ${border}`, background:'transparent', color:textMuted, fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                ← Atrás
              </button>
              <button onClick={function(){ setPaso('resumen'); }}
                style={{ flex:2, background:'var(--color-yellow)', color:'#020617', fontWeight:900, fontSize:'14px', padding:'14px', borderRadius:'14px', border:'none', cursor:'pointer' }}>
                Ver resumen →
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: RESUMEN ── */}
        {paso === 'resumen' && (
          <div>
            <h3 style={{ fontSize:'17px', fontWeight:900, color:textPrim, margin:'0 0 14px 0' }}>Resumen del pedido</h3>

            {/* Dirección */}
            <div style={{ padding:'12px 14px', borderRadius:'14px', background:bgBase, border:`1px solid ${border}`, marginBottom:'10px' }}>
              <p style={{ fontSize:'11px', color:textMuted, margin:'0 0 3px 0', fontWeight:700, textTransform:'uppercase' }}>📍 Entrega</p>
              {dirSeleccionada
                ? <p style={{ fontSize:'13px', color:textPrim, margin:0 }}>{dirSeleccionada.calle} {dirSeleccionada.numero_casa}</p>
                : <p style={{ fontSize:'13px', color:textPrim, margin:0 }}>{calle} {numero}</p>
              }
            </div>

            {/* Pago */}
            <div style={{ padding:'12px 14px', borderRadius:'14px', background:bgBase, border:`1px solid ${border}`, marginBottom:'14px' }}>
              <p style={{ fontSize:'11px', color:textMuted, margin:'0 0 3px 0', fontWeight:700, textTransform:'uppercase' }}>💳 Pago</p>
              <p style={{ fontSize:'13px', color:textPrim, margin:0 }}>
                {FORMAS_PAGO.find(function(f){ return f.id===formaPago; })?.emoji} {FORMAS_PAGO.find(function(f){ return f.id===formaPago; })?.label}
              </p>
            </div>

            {/* Items */}
            <div style={{ marginBottom:'14px' }}>
              {props.carrito.map(function(item){
                return (
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${border}` }}>
                    <div>
                      <p style={{ fontSize:'12px', fontWeight:700, color:textPrim, margin:0 }}>{item.emoji ?? '🍽️'} {item.nombre}</p>
                      <p style={{ fontSize:'11px', color:textMuted, margin:0 }}>{item.negocio} {item.tipo==='producto'?'· x'+item.cantidad:''}</p>
                    </div>
                    {item.tipo === 'producto' && <span style={{ fontSize:'13px', fontWeight:800, color:'var(--color-yellow)' }}>${(item.precio*item.cantidad).toFixed(2)}</span>}
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div style={{ padding:'12px 14px', borderRadius:'14px', background:bgBase, border:`1px solid ${border}`, marginBottom:'14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <span style={{ fontSize:'13px', color:textMuted }}>Subtotal</span>
                <span style={{ fontSize:'13px', fontWeight:700, color:textPrim }}>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'13px', color:textMuted }}>Envío</span>
                <span style={{ fontSize:'13px', fontWeight:700, color:textPrim }}>${COSTO_ENVIO.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'8px', borderTop:`1px solid ${border}` }}>
                <span style={{ fontSize:'15px', fontWeight:800, color:textPrim }}>Total</span>
                <span style={{ fontSize:'18px', fontWeight:900, color:'var(--color-yellow)' }}>${total.toFixed(2)}</span>
              </div>
            </div>

            {error && <p style={{ fontSize:'12px', color:'var(--color-red)', marginBottom:'10px' }}>{error}</p>}

            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={function(){ setPaso('pago'); }}
                style={{ flex:1, padding:'14px', borderRadius:'14px', border:`1px solid ${border}`, background:'transparent', color:textMuted, fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                ← Atrás
              </button>
              <button onClick={confirmarPedido} disabled={enviando}
                style={{ flex:2, background:enviando?'rgba(37,211,102,0.5)':'#25D366', color:'white', fontWeight:900, fontSize:'13px', padding:'14px', borderRadius:'14px', border:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', cursor:enviando?'not-allowed':'pointer' }}>
                {enviando ? <span className="spinner" /> : <MessageCircle style={{ width:'16px', height:'16px' }} />}
                {enviando ? 'Procesando...' : 'Confirmar por WhatsApp'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────
type MainTab = 'restaurantes' | 'mandaditos' | 'tiendita';

export default function Dashboard(props: DashboardProps) {
  const [merchants, setMerchants]               = useState<Merchant[]>([]);
  const [loading, setLoading]                   = useState<boolean>(true);
  const [error, setError]                       = useState<string>('');
  const [tabActiva, setTabActiva]               = useState<MainTab>('restaurantes');
  const [search, setSearch]                     = useState<string>('');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [seccionAbierta, setSeccionAbierta]     = useState<string | null>(null);
  const [carrito, setCarrito]                   = useState<CartItem[]>([]);
  const [modalMandadito, setModalMandadito]     = useState<Merchant | null>(null);
  const [modalCheckout, setModalCheckout]       = useState(false);
  const [menuAbierto, setMenuAbierto]           = useState(false);
  const esAdmin = props.session.user.email === 'uliseseven.7@gmail.com';

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  // FIX PARPADEO: aplicar el tema ANTES del primer paint
  useLayoutEffect(function(){
    document.documentElement.setAttribute('data-theme', props.theme);
  }, [props.theme]);

  const isDark   = props.theme === 'dark';
  const username = props.session.user.email?.split('@')[0] ?? 'usuario';
  const totalItems = carrito.reduce(function(a,i){ return a+i.cantidad; }, 0);
  const totalPrecio = carrito.reduce(function(a,i){ return a+i.precio*i.cantidad; }, 0) + COSTO_ENVIO;

  const fetchMerchants = useCallback(async function(){
    setLoading(true); setError('');
    try {
      const { data, error: err } = await supabase
        .from('merchants')
        .select('id,name,category,rating,delivery_time,image_url,is_open,phone_number,commission')
        .order('is_open', { ascending:false })
        .order('name',    { ascending:true });
      if (err) throw err;
      setMerchants(data ?? []);
    } catch(e: any) {
      setError(e.message ?? 'Error al cargar negocios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(function(){ fetchMerchants(); }, [fetchMerchants]);

  if (selectedMerchant !== null) {
    return (
      <VistaNegocio
        merchant={selectedMerchant}
        theme={props.theme}
        onThemeToggle={props.onThemeToggle}
        clienteEmail={props.session.user.email}
        carritoGlobal={carrito}
        onUpdateCarritoGlobal={setCarrito}
        onVolver={function(){ setSelectedMerchant(null); }}
      />
    );
  }

  function porCats(cats: string[]): Merchant[] {
    return merchants.filter(function(m){
      return cats.some(function(c){ return m.category?.toLowerCase().trim() === c.toLowerCase(); });
    });
  }

  function porKeys(keys: string[]): Merchant[] {
    return merchants.filter(function(m){
      if (m.category?.toLowerCase() !== 'mandaditos') return false;
      const n = m.name.toLowerCase();
      return keys.some(function(k){ return n.includes(k.toLowerCase()); });
    });
  }

  function agregarMandadito(merchant: Merchant, texto: string) {
    const item: CartItem = {
      id: merchant.id + '-' + Date.now(), nombre: texto, precio: 0, cantidad: 1,
      negocio: merchant.name, negocio_id: merchant.id,
      phone_number: merchant.phone_number ?? PHONE_OPERATIVO,
      tipo: 'mandadito', emoji: '📝',
    };
    setCarrito(function(prev){ return [...prev, item]; });
  }

  function tabStyle(t: MainTab): React.CSSProperties {
    const active = tabActiva === t;
    return { flex:1, padding:'10px 4px', border:'none', borderRadius:'14px', cursor:'pointer', fontSize:'11px', fontWeight:active?900:600, background:active?'var(--color-yellow)':'transparent', color:active?'#020617':'var(--text-muted)', boxShadow:active?'0 4px 12px rgba(250,204,21,0.3)':'none', transition:'all 0.2s' };
  }

  function renderContenido() {
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const res = merchants.filter(function(m){ return m.name.toLowerCase().includes(q)||(m.category??'').toLowerCase().includes(q); });
      return (
        <div style={{ padding:'0 16px 40px' }}>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'0 0 14px 0' }}>{res.length} resultados para "{search}"</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {res.map(function(m){ return <TarjetaNegocio key={m.id} merchant={m} onClick={function(){ m.category?.toLowerCase()==='mandaditos'?setModalMandadito(m):setSelectedMerchant(m); }} />; })}
          </div>
        </div>
      );
    }

    if (tabActiva === 'restaurantes') {
      return (
        <div style={{ paddingBottom:'40px' }}>
          <Banner />
          {SECCIONES_REST.map(function(sec){
            const lista = porCats(sec.cats);
            if (!loading && lista.length === 0) return null;
            return <SeccionH key={sec.titulo} titulo={sec.titulo} emoji={sec.emoji} merchants={lista} loading={loading} onSelect={setSelectedMerchant} />;
          })}
        </div>
      );
    }

    if (tabActiva === 'mandaditos') {
      return (
        <div style={{ paddingBottom:'40px' }}>
          <div style={{ margin:'0 16px 16px', padding:'12px 16px', borderRadius:'14px', background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', border:'1px solid var(--border-subtle)' }}>
            <p style={{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.5, margin:0 }}>
              ✍️ <strong style={{ color:'var(--text-primary)' }}>Cómo funciona:</strong> Toca el negocio, escribe tu pedido y se guarda en el carrito. Puedes pedir de varios negocios a la vez.
            </p>
          </div>
          {SECCIONES_MAND.map(function(sec){
            const lista = porKeys(sec.keys);
            if (!loading && lista.length === 0) return null;
            const abierta = seccionAbierta === sec.titulo;
            return (
              <div key={sec.titulo} style={{ marginBottom:'8px', padding:'0 16px' }}>
                <button onClick={function(){ setSeccionAbierta(abierta?null:sec.titulo); }}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderRadius:'16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'20px' }}>{sec.emoji}</span>
                    <span style={{ fontSize:'14px', fontWeight:700, color:'var(--text-primary)' }}>{sec.titulo}</span>
                    <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>({lista.length})</span>
                  </div>
                  {abierta ? <ChevronUp style={{ width:'16px', height:'16px', color:'var(--text-muted)' }} /> : <ChevronDown style={{ width:'16px', height:'16px', color:'var(--text-muted)' }} />}
                </button>
                {abierta && (
                  <div style={{ paddingTop:'8px', overflowX:'auto', display:'flex', gap:'12px', scrollbarWidth:'none', paddingBottom:'8px' }}>
                    {lista.map(function(m){ return <TarjetaNegocio key={m.id} merchant={m} onClick={function(){ setModalMandadito(m); }} />; })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (tabActiva === 'tiendita') {
      const lista = merchants.filter(function(m){ return m.category?.toLowerCase()==='tiendita'; });
      return (
        <div style={{ padding:'16px 16px 40px' }}>
          <div style={{ background:'linear-gradient(135deg,#facc15,#f59e0b)', borderRadius:'20px', padding:'20px', marginBottom:'20px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', right:'-10px', top:'-10px', width:'80px', height:'80px', borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />
            <p style={{ fontSize:'9px', fontWeight:900, color:'rgba(2,6,23,0.5)', textTransform:'uppercase', letterSpacing:'0.2em', margin:'0 0 4px 0' }}>Exclusivo Changuito</p>
            <h2 style={{ fontSize:'20px', fontWeight:900, color:'#020617', margin:'0 0 4px 0' }}>🛒 Tiendita Changuito</h2>
            <p style={{ fontSize:'12px', color:'rgba(2,6,23,0.6)', margin:0 }}>Entrega express · Todo lo que necesitas</p>
          </div>
          {lista.map(function(m){
            return (
              <div key={m.id} onClick={function(){ setSelectedMerchant(m); }}
                style={{ background:'var(--bg-card)', borderRadius:'18px', padding:'16px', display:'flex', alignItems:'center', gap:'14px', border:'1px solid var(--border-subtle)', cursor:'pointer', marginBottom:'10px' }}>
                <div style={{ width:'52px', height:'52px', borderRadius:'14px', background:'linear-gradient(135deg,#facc15,#f59e0b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', flexShrink:0 }}>🛒</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'15px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 3px 0' }}>{m.name}</p>
                  <span style={{ fontSize:'11px', color:'var(--color-yellow)', fontWeight:700 }}>★ {(m.rating??4.9).toFixed(1)}</span>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)' }}> · {m.delivery_time??'10-20 min'}</span>
                </div>
                <ChevronRight style={{ width:'16px', height:'16px', color:'var(--text-muted)' }} />
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', color:'var(--text-primary)', fontFamily:'system-ui,sans-serif', maxWidth:'480px', margin:'0 auto' }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--bg-nav)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', padding:'14px 16px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', gap:'10px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:0 }}>
            <button onClick={function(){ setMenuAbierto(true); }} aria-label="Abrir menú" style={{ flexShrink:0, width:'40px', height:'40px', borderRadius:'12px', background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)', border:isDark?'1px solid rgba(255,255,255,0.08)':'1px solid rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-primary)' }}>
              <Menu style={{ width:'20px', height:'20px' }} />
            </button>
            <div style={{ minWidth:0, overflow:'hidden' }}>
              <p style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 1px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>¡Hola, {username}! 👋</p>
              <h1 style={{ fontSize:'19px', fontWeight:900, color:'var(--text-primary)', margin:0, letterSpacing:'-0.03em', lineHeight:1 }}>¿Qué se te antoja?</h1>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
            {totalItems > 0 && (
              <button onClick={function(){ setModalCheckout(true); }} style={{ position:'relative', background:'var(--color-yellow)', border:'none', borderRadius:'12px', width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 4px 12px rgba(250,204,21,0.35)' }}>
                <ShoppingBag style={{ width:'18px', height:'18px', color:'#020617' }} />
                <span style={{ position:'absolute', top:'-4px', right:'-4px', background:'#ef4444', color:'white', fontSize:'10px', fontWeight:900, borderRadius:'50%', width:'18px', height:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>{totalItems}</span>
              </button>
            )}
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>
        <div style={{ position:'relative', marginBottom:'12px' }}>
          <Search style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)', width:'15px', height:'15px', color:'var(--text-muted)', pointerEvents:'none' }} />
          <input type="text" placeholder="Buscar negocios o categorías..." value={search}
            onChange={function(e){ setSearch(e.target.value); }}
            style={{ width:'100%', boxSizing:'border-box', background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)', border:isDark?'1px solid rgba(255,255,255,0.08)':'1px solid rgba(0,0,0,0.1)', borderRadius:'14px', padding:'11px 36px 11px 38px', color:'var(--text-primary)', fontSize:'13px', outline:'none' }} />
          {search !== '' && (
            <button onClick={function(){ setSearch(''); }} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', lineHeight:0 }}>
              <X style={{ width:'14px', height:'14px' }} />
            </button>
          )}
        </div>
        <div style={{ display:'flex', background:isDark?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.05)', borderRadius:'16px', padding:'4px', gap:'4px' }}>
          <button style={tabStyle('restaurantes')} onClick={function(){ setTabActiva('restaurantes'); setSearch(''); }}>🍽️ Restaurantes</button>
          <button style={tabStyle('mandaditos')}   onClick={function(){ setTabActiva('mandaditos');   setSearch(''); }}>🛵 Mandaditos</button>
          <button style={tabStyle('tiendita')}     onClick={function(){ setTabActiva('tiendita');     setSearch(''); }}>🛒 Tiendita</button>
        </div>
      </div>

      {/* Hamburger Drawer */}
      {menuAbierto && (
        <div
          style={{ position:'fixed', inset:0, zIndex:200, display:'flex' }}
          onClick={function(){ setMenuAbierto(false); }}
        >
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(2px)' }} />
          <div
            className="fade-in"
            style={{ position:'relative', width:'280px', maxWidth:'82%', height:'100%', background:'var(--bg-card)', borderRight:'1px solid var(--border-subtle)', zIndex:201, display:'flex', flexDirection:'column', boxShadow:'8px 0 32px rgba(0,0,0,0.35)' }}
            onClick={function(e){ e.stopPropagation(); }}
          >
            <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid var(--border-subtle)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 2px 0' }}>Sesión</p>
                <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{props.session.user.email}</p>
              </div>
              <button onClick={function(){ setMenuAbierto(false); }} aria-label="Cerrar menú" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:'4px', lineHeight:0 }}>
                <X style={{ width:'18px', height:'18px' }} />
              </button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'10px 10px' }}>
              {([
                { key:'restaurantes', label:'Restaurantes', icon: Store },
                { key:'mandaditos',   label:'Mandaditos',   icon: Bike },
                { key:'tiendita',     label:'Tiendita',     icon: ShoppingCart },
              ] as const).map(function(it){
                const Icon = it.icon;
                return (
                  <button key={it.key} onClick={function(){ setTabActiva(it.key as MainTab); setSearch(''); setMenuAbierto(false); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'13px 12px', borderRadius:'12px', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-primary)', fontSize:'14px', fontWeight:700, textAlign:'left' }}>
                    <Icon style={{ width:'18px', height:'18px', color:'var(--color-yellow)' }} />
                    <span>{it.label}</span>
                  </button>
                );
              })}

              <div style={{ height:'1px', background:'var(--border-subtle)', margin:'10px 8px' }} />

              <button onClick={function(){ setMenuAbierto(false); props.onIrBazar && props.onIrBazar(); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'13px 12px', borderRadius:'12px', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-primary)', fontSize:'14px', fontWeight:700, textAlign:'left' }}>
                <Sparkles style={{ width:'18px', height:'18px', color:'var(--color-yellow)' }} />
                <span>Bazar Vecinal</span>
              </button>
              <button onClick={function(){ setMenuAbierto(false); props.onIrServicios && props.onIrServicios(); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'13px 12px', borderRadius:'12px', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-primary)', fontSize:'14px', fontWeight:700, textAlign:'left' }}>
                <Briefcase style={{ width:'18px', height:'18px', color:'var(--color-yellow)' }} />
                <span>Servicios</span>
              </button>
              <button onClick={function(){ setMenuAbierto(false); props.onIrShopping && props.onIrShopping(); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'13px 12px', borderRadius:'12px', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-primary)', fontSize:'14px', fontWeight:700, textAlign:'left' }}>
                <ShoppingBasket style={{ width:'18px', height:'18px', color:'var(--color-yellow)' }} />
                <span>ChanguiShopping</span>
              </button>

              <div style={{ height:'1px', background:'var(--border-subtle)', margin:'10px 8px' }} />

              <button disabled style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'13px 12px', borderRadius:'12px', background:'transparent', border:'none', cursor:'not-allowed', color:'var(--text-muted)', fontSize:'14px', fontWeight:700, textAlign:'left' }}>
                <Building2 style={{ width:'18px', height:'18px' }} />
                <span style={{ flex:1 }}>Bienes Raíces</span>
                <span style={{ fontSize:'9px', fontWeight:900, padding:'2px 7px', borderRadius:'8px', background:'var(--bg-base)', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Pronto</span>
              </button>
              <button disabled style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'13px 12px', borderRadius:'12px', background:'transparent', border:'none', cursor:'not-allowed', color:'var(--text-muted)', fontSize:'14px', fontWeight:700, textAlign:'left' }}>
                <Car style={{ width:'18px', height:'18px' }} />
                <span style={{ flex:1 }}>Autos</span>
                <span style={{ fontSize:'9px', fontWeight:900, padding:'2px 7px', borderRadius:'8px', background:'var(--bg-base)', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Pronto</span>
              </button>

              {esAdmin && (
                <>
                  <div style={{ height:'1px', background:'var(--border-subtle)', margin:'10px 8px' }} />
                  <button onClick={function(){ setMenuAbierto(false); props.onIrAdmin && props.onIrAdmin(); }} style={{ width:'100%', display:'flex', alignItems:'center', gap:'12px', padding:'13px 12px', borderRadius:'12px', background:'rgba(250,204,21,0.12)', border:'1px solid rgba(250,204,21,0.35)', cursor:'pointer', color:'var(--color-yellow)', fontSize:'14px', fontWeight:900, textAlign:'left' }}>
                    <Shield style={{ width:'18px', height:'18px' }} />
                    <span>God Mode</span>
                  </button>
                </>
              )}
            </div>

            <div style={{ padding:'12px 14px 18px', borderTop:'1px solid var(--border-subtle)' }}>
              <button onClick={cerrarSesion} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'13px 12px', borderRadius:'12px', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.4)', cursor:'pointer', color:'#ef4444', fontSize:'13px', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                <LogOut style={{ width:'15px', height:'15px' }} />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ paddingTop:'8px', paddingBottom:'90px' }}>{renderContenido()}</div>

      {/* Barra carrito flotante */}
      {totalItems > 0 && (
        <div style={{ position:'fixed', bottom:'16px', left:'50%', transform:'translateX(-50%)', width:'calc(100% - 32px)', maxWidth:'448px', zIndex:100 }}>
          <button onClick={function(){ setModalCheckout(true); }} style={{ width:'100%', background:'var(--color-yellow)', borderRadius:'18px', padding:'16px 20px', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 8px 32px rgba(250,204,21,0.45)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'rgba(2,6,23,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <ShoppingBag style={{ width:'15px', height:'15px', color:'#020617' }} />
              </div>
              <span style={{ fontSize:'13px', fontWeight:900, color:'#020617' }}>Ver carrito · {totalItems} {totalItems===1?'item':'items'}</span>
            </div>
            <span style={{ fontSize:'15px', fontWeight:900, color:'#020617' }}>${totalPrecio.toFixed(2)}</span>
          </button>
        </div>
      )}

      {modalMandadito && (
        <ModalMandadito merchant={modalMandadito} onClose={function(){ setModalMandadito(null); }}
          onAgregar={function(texto){ agregarMandadito(modalMandadito, texto); setModalMandadito(null); }} />
      )}

      {modalCheckout && (
        <ModalCheckout
          carrito={carrito}
          clienteId={props.session.user.id}
          clienteEmail={props.session.user.email ?? ''}
          onClose={function(){ setModalCheckout(false); }}
          onPedidoOk={function(){ setCarrito([]); setModalCheckout(false); }}
        />
      )}

      {/* Bottom Navigation Bar */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'480px', zIndex:90, background:'var(--bg-nav)', backdropFilter:'blur(20px)', borderTop:'1px solid var(--border-subtle)', padding:'8px 8px calc(8px + env(safe-area-inset-bottom, 0px))', display:'flex', justifyContent:'space-around' }}>
        {([
          { key:'inicio',    label:'Inicio',   emoji:'🍽️', onClick: function(){ setTabActiva('restaurantes'); setSearch(''); } },
          { key:'tiendita',  label:'Tiendita', emoji:'🛒', onClick: function(){ setTabActiva('tiendita');     setSearch(''); } },
          { key:'shopping',  label:'Shopping', emoji:'🛍️', onClick: function(){ props.onIrShopping  && props.onIrShopping();  } },
          { key:'bazar',     label:'Bazar',    emoji:'🏠', onClick: function(){ props.onIrBazar     && props.onIrBazar();     } },
          { key:'servicios', label:'Servicios',emoji:'🛠️', onClick: function(){ props.onIrServicios && props.onIrServicios(); } },
        ] as const).map(function(it){
          const activo = (it.key === 'inicio' && tabActiva === 'restaurantes') || (it.key === 'tiendita' && tabActiva === 'tiendita');
          return (
            <button key={it.key} onClick={it.onClick} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', padding:'6px 2px', background:'transparent', border:'none', cursor:'pointer', color:activo?'var(--color-yellow)':'var(--text-muted)' }}>
              <span style={{ fontSize:'18px', lineHeight:1 }}>{it.emoji}</span>
              <span style={{ fontSize:'9px', fontWeight:800, letterSpacing:'0.04em' }}>{it.label}</span>
            </button>
          );
        })}
      </div>

      <style>{`::-webkit-scrollbar{display:none;}*{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}button{font-family:inherit;}`}</style>
    </div>
  );
}
