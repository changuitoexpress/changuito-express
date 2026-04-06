/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState } from 'react';
import { Search, Home, Package, User, Star, Clock, ChevronRight, Zap, LogOut } from 'lucide-react';
// ① AQUÍ IMPORTAMOS LA VISTA DE NEGOCIO
import VistaNegocio, { NegocioResumen } from './VistaNegocio';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface UserSession {
  user: { email?: string }
}

interface Negocio {
  id: number;
  nombre: string;
  categoria: string;
  entrega: string;
  rating: number;
  badge?: string;
  emoji: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const NEGOCIOS: Negocio[] = [
  { id:1, nombre:'Los Cubiertos', categoria:'Desayunos', entrega:'20-30 min', rating:4.9, badge:'POPULAR', emoji:'🍳' },
  { id:2, nombre:'La Atómica', categoria:'Tortas', entrega:'25-35 min', rating:4.8, badge:'VIP', emoji:'🥖' },
  { id:3, nombre:'Los Gaspachos', categoria:'Tortas', entrega:'30-40 min', rating:4.7, emoji:'🥪' },
  { id:4, nombre:'Tortas y Cemitas Cuellar',categoria:'Tortas', entrega:'20-30 min', rating:4.6, emoji:'🫓' },
  { id:5, nombre:'Tripoli', categoria:'Taquerías', entrega:'15-25 min', rating:4.9, badge:'POPULAR', emoji:'🌮' },
  { id:6, nombre:'Chuchos Special', categoria:'Taquerías', entrega:'20-30 min', rating:4.8, emoji:'🌯' },
  { id:7, nombre:'Los Aguacates', categoria:'Taquerías', entrega:'25-35 min', rating:4.7, badge:'NUEVO', emoji:'🥑' },
  { id:8, nombre:'La Berenjena', categoria:'Pizzerías', entrega:'35-45 min', rating:4.8, badge:'VIP', emoji:'🍕' },
  { id:9, nombre:'Panareo', categoria:'Pizzerías', entrega:'30-40 min', rating:4.6, emoji:'🫕' },
  { id:10, nombre:'Amorcito Corazón', categoria:'Asiática', entrega:'30-45 min', rating:4.9, badge:'POPULAR', emoji:'🍜' },
  { id:11, nombre:'Shirushi XO', categoria:'Asiática', entrega:'35-50 min', rating:4.7, emoji:'🍱' },
  { id:12, nombre:'Hudson', categoria:'Hamburguesas', entrega:'25-35 min', rating:4.8, badge:'VIP', emoji:'🍔' },
  { id:13, nombre:'Hamburguesas Las No. 1', categoria:'Hamburguesas', entrega:'20-30 min', rating:4.7, emoji:'🍟' },
  { id:14, nombre:'Oxxo', categoria:'Mandaditos', entrega:'10-20 min', rating:4.5, emoji:'🏪' },
  { id:15, nombre:'Walmart', categoria:'Mandaditos', entrega:'40-60 min', rating:4.4, emoji:'🛒' },
  { id:16, nombre:'Chedraui Selecto', categoria:'Mandaditos', entrega:'40-60 min', rating:4.5, emoji:'🛍️' },
  { id:17, nombre:'Farmacias del Ahorro', categoria:'Mandaditos', entrega:'15-25 min', rating:4.6, emoji:'💊' },
  { id:18, nombre:'Little Caesar\'s', categoria:'Mandaditos', entrega:'20-30 min', rating:4.3, emoji:'🍕' },
  { id:19, nombre:'Bebidas Express', categoria:'Bebidas', entrega:'10-20 min', rating:4.7, badge:'NUEVO', emoji:'🧃' },
];

const CATEGORIAS = ['Todos','Desayunos','Tortas','Taquerías','Pizzerías','Asiática','Hamburguesas','Bebidas','Mandaditos'];

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'POPULAR': { bg: 'rgba(250,204,21,0.2)', text: '#facc15' },
  'VIP': { bg: 'rgba(139,92,246,0.25)', text: '#c4b5fd' },
  'NUEVO': { bg: 'rgba(74,222,128,0.2)', text: '#4ade80' },
};

// ─── Componente principal ─────────────────────────────────────────────────────
interface DashboardProps {
  session: UserSession;
  onSignOut: () => void;
}

export default function Dashboard(props: DashboardProps) {
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Todos');
  const [tabActiva, setTabActiva] = useState<'inicio'|'buscar'|'pedidos'|'perfil'>('inicio');
  const [busqueda, setBusqueda] = useState<string>('');

  // ② AQUÍ ESTÁ EL ESTADO PARA CONTROLAR LA VISTA DE NEGOCIO
  const [negocioSeleccionado, setNegocioSeleccionado] = useState<NegocioResumen | null>(null);

  const email = props.session.user.email ?? '';
  const username = email.split('@')[0];

  // ── Filtrado ────────────────────────────────────────────────────────────────
  const mandaditos = NEGOCIOS.filter(function(n) { return n.categoria === 'Mandaditos'; });
  const resto = NEGOCIOS.filter(function(n) { return n.categoria !== 'Mandaditos'; });

  const negociosFiltrados = (function() {
    let base = categoriaActiva === 'Todos' ? resto : NEGOCIOS.filter(function(n) { return n.categoria === categoriaActiva; });

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      base = base.filter(function(n) { return n.nombre.toLowerCase().includes(q) || n.categoria.toLowerCase().includes(q); });
    }

    if (categoriaActiva === 'Todos') {
      return [...base, ...mandaditos];
    }
    if (categoriaActiva === 'Mandaditos') {
      return mandaditos;
    }
    return base;
  })();

  // ③ SI HAY UN NEGOCIO SELECCIONADO, RENDERIZAMOS SU VISTA Y NADA MÁS
  if (negocioSeleccionado !== null) {
    return (
      <VistaNegocio
        negocio={negocioSeleccionado}
        onVolver={function() { setNegocioSeleccionado(null); }}
      />
    );
  }

  // ── Render según tab ────────────────────────────────────────────────────────
  function renderContenido() {
    if (tabActiva === 'perfil') {
      return <VistaPeril email={email} onSignOut={props.onSignOut} />;
    }
    if (tabActiva === 'pedidos') {
      return <VistaPedidos />;
    }
    if (tabActiva === 'buscar') {
      return <VistaBuscar busqueda={busqueda} setBusqueda={setBusqueda} negocios={negociosFiltrados} setNegocio={setNegocioSeleccionado} />;
    }

    // ── INICIO ──
    return (
      <div style={{ paddingBottom: '90px' }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ¡Hola, {username}! 👋
            </p>
            <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              ¿Qué se te<br />antoja hoy?
            </h1>
          </div>
          <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(250,204,21,0.35)', cursor: 'pointer', flexShrink: 0 }}
               onClick={function() { setTabActiva('buscar'); }}>
            <Search style={{ width: '18px', height: '18px', color: '#020617' }} strokeWidth={2.5} />
          </div>
        </div>

        {/* Banner VIP */}
        <div style={{ margin: '4px 16px 20px', borderRadius: '20px', background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 60%, #d97706 100%)', padding: '20px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ position: 'absolute', right: '20px', bottom: '-15px', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Zap style={{ width: '14px', height: '14px', color: '#020617' }} />
            <span style={{ fontSize: '10px', fontWeight: 900, color: '#020617', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Exclusivo</span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#020617', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Promociones VIP<br />de la semana 🔥
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(2,6,23,0.6)', margin: '0 0 12px 0', fontWeight: 600 }}>
            Hasta 30% de descuento en seleccionados
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(2,6,23,0.12)', padding: '6px 12px', borderRadius: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#020617' }}>Ver ofertas</span>
            <ChevronRight style={{ width: '12px', height: '12px', color: '#020617' }} />
          </div>
        </div>

        {/* Categorías */}
        <div style={{ overflowX: 'auto', paddingLeft: '16px', paddingBottom: '4px', marginBottom: '20px', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: '8px', width: 'max-content' }}>
            {CATEGORIAS.map(function(cat) {
              const activa = categoriaActiva === cat;
              return (
                <button key={cat} onClick={function() { setCategoriaActiva(cat); }}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: activa ? 'none' : '1px solid rgba(255,255,255,0.1)', background: activa ? '#facc15' : 'rgba(255,255,255,0.05)', color: activa ? '#020617' : 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: activa ? 900 : 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', boxShadow: activa ? '0 4px 12px rgba(250,204,21,0.3)' : 'none' }}>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Negocios */}
        <div style={{ padding: '0 16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {negociosFiltrados.length} negocios disponibles
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {negociosFiltrados.map(function(negocio) {
              return (
                <TarjetaNegocio 
                  key={negocio.id} 
                  negocio={negocio} 
                  // AQUÍ PASAMOS EL ONCLICK PARA QUE SE ABRA LA VISTA DEL NEGOCIO
                  onClick={function() { setNegocioSeleccionado(negocio); }} 
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111116', color: 'white', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
      {/* Scroll container */}
      <div style={{ overflowY: 'auto', height: '100vh' }}>
        {renderContenido()}
      </div>

      {/* Bottom Nav */}
      <BottomNav tabActiva={tabActiva} setTabActiva={setTabActiva} />

      <style>{`
        ::-webkit-scrollbar { display: none; }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        button { font-family: inherit; }
      `}</style>
    </div>
  );
}

// ─── Tarjeta Negocio ──────────────────────────────────────────────────────────
// ④ AQUÍ MODIFICAMOS LA FIRMA PARA QUE RECIBA EL ONCLICK
function TarjetaNegocio(props: { negocio: Negocio; onClick: () => void }) {
  const n = props.negocio;
  const badge = n.badge ? BADGE_COLORS[n.badge] : null;

  return (
    <div onClick={props.onClick} style={{ background: '#1c1c24', borderRadius: '18px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
      {/* Emoji avatar */}
      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
        {n.emoji}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.nombre}
          </h3>
          {badge && (
            <span style={{ fontSize: '9px', fontWeight: 900, padding: '2px 7px', borderRadius: '6px', background: badge.bg, color: badge.text, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
              {n.badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '0 0 6px 0', fontWeight: 500 }}>
          {n.categoria}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#facc15', fontWeight: 700 }}>
            <Star style={{ width: '11px', height: '11px' }} fill="#facc15" />
            {n.rating}
          </span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            <Clock style={{ width: '11px', height: '11px' }} />
            {n.entrega}
          </span>
        </div>
      </div>
      <ChevronRight style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
type Tab = 'inicio' | 'buscar' | 'pedidos' | 'perfil';

function BottomNav(props: { tabActiva: Tab; setTabActiva: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'inicio', label: 'Inicio', emoji: '🏠' },
    { id: 'buscar', label: 'Buscar', emoji: '🔍' },
    { id: 'pedidos', label: 'Pedidos', emoji: '📦' },
    { id: 'perfil', label: 'Perfil', emoji: '👤' },
  ];

  return (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: 'rgba(17,17,22,0.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 0 12px', display: 'flex', justifyContent: 'space-around', zIndex: 100 }}>
      {tabs.map(function(tab) {
        const activa = props.tabActiva === tab.id;
        return (
          <button key={tab.id} onClick={function() { props.setTabActiva(tab.id); }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 16px', minWidth: '60px' }}>
            <span style={{ fontSize: '20px', filter: activa ? 'none' : 'grayscale(1) opacity(0.4)', transition: 'all 0.2s' }}>
              {tab.emoji}
            </span>
            <span style={{ fontSize: '10px', fontWeight: activa ? 800 : 500, color: activa ? '#facc15' : 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', transition: 'all 0.2s' }}>
              {tab.label}
            </span>
            {activa && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#facc15' }} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Vista: Buscar ────────────────────────────────────────────────────────────
function VistaBuscar(props: { busqueda: string; setBusqueda: (v: string) => void; negocios: Negocio[]; setNegocio: (n: NegocioResumen) => void }) {
  return (
    <div style={{ padding: '20px 16px 100px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>Buscar</h2>
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'rgba(255,255,255,0.3)' }} />
        <input type="text" placeholder="Negocios, categorías..." value={props.busqueda}
          onChange={function(e) { props.setBusqueda(e.target.value); }}
          style={{ width: '100%', boxSizing: 'border-box', background: '#1c1c24', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '13px 14px 13px 40px', color: 'white', fontSize: '14px', outline: 'none' }} />
      </div>

      {props.busqueda && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {props.negocios.length === 0
            ? <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '40px' }}>Sin resultados para "{props.busqueda}"</p>
            : props.negocios.map(function(n) { return <TarjetaNegocio key={n.id} negocio={n} onClick={function() { props.setNegocio(n); }} />; })
          }
        </div>
      )}
    </div>
  );
}

// ─── Vista: Pedidos ───────────────────────────────────────────────────────────
function VistaPedidos() {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <span style={{ fontSize: '56px', marginBottom: '16px' }}>📦</span>
      <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'white', margin: '0 0 8px 0' }}>Tus Pedidos</h2>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.6 }}>
        Aquí aparecerán tus pedidos activos<br />e historial de compras.
      </p>
      <div style={{ marginTop: '20px', padding: '12px 24px', borderRadius: '14px', background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.2)' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#facc15' }}>Próximamente 🚀</span>
      </div>
    </div>
  );
}

// ─── Vista: Perfil ────────────────────────────────────────────────────────────
function VistaPeril(props: { email: string; onSignOut: () => void }) {
  return (
    <div style={{ padding: '20px 16px 100px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 24px 0', letterSpacing: '-0.02em' }}>Mi Perfil</h2>

      {/* Card usuario */}
      <div style={{ background: '#1c1c24', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 4px 12px rgba(250,204,21,0.3)' }}>
          🛒
        </div>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 800, color: 'white', margin: '0 0 2px 0' }}>
            {props.email.split('@')[0]}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0 }}>{props.email}</p>
        </div>
      </div>

      {/* Opciones */}
      {[
        { label: 'Mis direcciones', emoji: '📍' },
        { label: 'Métodos de pago', emoji: '💳' },
        { label: 'Notificaciones', emoji: '🔔' },
        { label: 'Términos y privacidad', emoji: '📄' },
      ].map(function(item) {
        return (
          <div key={item.label} style={{ background: '#1c1c24', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
            <span style={{ fontSize: '18px' }}>{item.emoji}</span>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{item.label}</span>
            <ChevronRight style={{ width: '15px', height: '15px', color: 'rgba(255,255,255,0.2)' }} />
          </div>
        );
      })}

      {/* Cerrar sesión */}
      <button onClick={props.onSignOut}
        style={{ width: '100%', marginTop: '16px', padding: '14px', borderRadius: '14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        <LogOut style={{ width: '16px', height: '16px' }} />
        Cerrar Sesión
      </button>
    </div>
  );
}
