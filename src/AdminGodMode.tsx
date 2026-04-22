/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, ShoppingBag, Users, Store, TrendingUp, Clock,
  CheckCircle, XCircle, RefreshCw, WifiOff, Phone, MessageCircle,
  ChevronDown, ChevronUp, LogOut, Star, Package
} from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Pedido {
  id:             string;
  cliente_email:  string | null;
  negocio_nombre: string | null;
  detalle:        string | null;
  total:          number | null;
  estatus:        string;
  forma_pago:     string | null;
  direccion:      string | null;
  canal:          string | null;
  created_at:     string;
}

interface Metricas {
  totalPedidos:    number;
  pedidosHoy:      number;
  ingresoTotal:    number;
  ingresoHoy:      number;
  totalMerchants:  number;
  merchantsAbiertos: number;
  totalClientes:   number;
  pedidosPendientes: number;
}

interface AdminProps {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onVolver:      () => void;
}

const ADMIN_EMAIL = 'uliseseven.7@gmail.com';

const ESTATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:   { label: 'Pendiente',   color: '#facc15', bg: 'rgba(250,204,21,0.15)'  },
  en_camino:   { label: 'En camino',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  entregado:   { label: 'Entregado',   color: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  cancelado:   { label: 'Cancelado',   color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
};

// ─── Tarjeta de métrica ───────────────────────────────────────────────────────
function MetricaCard(props: { emoji: string; titulo: string; valor: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ flex:1, minWidth:'140px', padding:'16px', borderRadius:'18px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', boxShadow:'var(--shadow-card)' }}>
      <p style={{ fontSize:'22px', margin:'0 0 8px 0' }}>{props.emoji}</p>
      <p style={{ fontSize:'11px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 4px 0' }}>{props.titulo}</p>
      <p style={{ fontSize:'24px', fontWeight:900, color: props.color ?? 'var(--color-yellow)', margin:'0 0 2px 0', lineHeight:1 }}>{props.valor}</p>
      {props.sub && <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>{props.sub}</p>}
    </div>
  );
}

// ─── Admin God Mode ───────────────────────────────────────────────────────────
export default function AdminGodMode(props: AdminProps) {
  const [metricas, setMetricas]     = useState<Metricas | null>(null);
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [loadingM, setLoadingM]     = useState(true);
  const [loadingP, setLoadingP]     = useState(true);
  const [error, setError]           = useState('');
  const [filtroEstatus, setFiltro]  = useState('todos');
  const [pedidoAbierto, setPedAbi]  = useState<string | null>(null);
  const [tab, setTab]               = useState<'pedidos'|'negocios'|'clientes'>('pedidos');
  const [merchants, setMerchants]   = useState<any[]>([]);
  const isDark = props.theme === 'dark';

  // Verificar que sea admin
  if (props.session.user.email !== ADMIN_EMAIL) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</p>
          <p style={{ fontSize:'16px', fontWeight:800, color:'var(--text-primary)', marginBottom:'8px' }}>Acceso restringido</p>
          <p style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'20px' }}>Solo el administrador puede ver esto.</p>
          <button onClick={props.onVolver} style={{ padding:'12px 24px', borderRadius:'14px', background:'var(--color-yellow)', color:'#020617', fontWeight:800, fontSize:'13px', border:'none', cursor:'pointer' }}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const fetchMetricas = useCallback(async function() {
    setLoadingM(true);
    try {
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const hoyISO = hoy.toISOString();

      const [rTodos, rHoy, rMerch, rClientes] = await Promise.all([
        supabase.from('pedidos').select('id, total, estatus, created_at'),
        supabase.from('pedidos').select('id, total').gte('created_at', hoyISO),
        supabase.from('merchants').select('id, is_open'),
        supabase.from('perfiles').select('id'),
      ]);

      const todos    = rTodos.data ?? [];
      const hoyData  = rHoy.data ?? [];
      const merch    = rMerch.data ?? [];

      setMetricas({
        totalPedidos:      todos.length,
        pedidosHoy:        hoyData.length,
        ingresoTotal:      todos.reduce(function(a: number, p: any){ return a + (p.total ?? 0); }, 0),
        ingresoHoy:        hoyData.reduce(function(a: number, p: any){ return a + (p.total ?? 0); }, 0),
        totalMerchants:    merch.length,
        merchantsAbiertos: merch.filter(function(m: any){ return m.is_open; }).length,
        totalClientes:     (rClientes.data ?? []).length,
        pedidosPendientes: todos.filter(function(p: any){ return p.estatus === 'pendiente'; }).length,
      });
    } catch(e: any) { setError(e.message); }
    finally { setLoadingM(false); }
  }, []);

  const fetchPedidos = useCallback(async function() {
    setLoadingP(true);
    try {
      let q = supabase.from('pedidos').select('*').order('created_at', { ascending:false }).limit(100);
      if (filtroEstatus !== 'todos') q = q.eq('estatus', filtroEstatus);
      const { data, error: err } = await q;
      if (err) throw err;
      setPedidos(data ?? []);
    } catch(e: any) { setError(e.message); }
    finally { setLoadingP(false); }
  }, [filtroEstatus]);

  const fetchMerchants = useCallback(async function() {
    const { data } = await supabase.from('merchants').select('*').order('name');
    setMerchants(data ?? []);
  }, []);

  useEffect(function(){ fetchMetricas(); fetchPedidos(); fetchMerchants(); }, [fetchMetricas, fetchPedidos, fetchMerchants]);

  async function cambiarEstatus(pedidoId: string, nuevoEstatus: string) {
    await supabase.from('pedidos').update({ estatus: nuevoEstatus }).eq('id', pedidoId);
    fetchPedidos(); fetchMetricas();
  }

  async function toggleMerchant(id: string, actual: boolean) {
    await supabase.from('merchants').update({ is_open: !actual }).eq('id', id);
    fetchMerchants(); fetchMetricas();
  }

  function formatFecha(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  }

  const tabStyle = function(t: string): React.CSSProperties {
    const active = tab === t;
    return { flex:1, padding:'10px 4px', border:'none', borderRadius:'12px', cursor:'pointer', fontSize:'12px', fontWeight:active?900:600, background:active?'var(--color-yellow)':'transparent', color:active?'#020617':'var(--text-muted)' };
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', color:'var(--text-primary)', fontFamily:'system-ui,sans-serif', maxWidth:'480px', margin:'0 auto' }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--bg-nav)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', padding:'14px 16px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={props.onVolver} style={{ width:'36px', height:'36px', borderRadius:'12px', background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <ArrowLeft style={{ width:'18px', height:'18px', color:'var(--text-primary)' }} />
            </button>
            <div>
              <p style={{ fontSize:'10px', color:'var(--color-yellow)', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', margin:0 }}>⚡ GOD MODE</p>
              <h1 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:0 }}>Panel de Control</h1>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <button onClick={function(){ fetchMetricas(); fetchPedidos(); fetchMerchants(); }} style={{ width:'36px', height:'36px', borderRadius:'12px', background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <RefreshCw style={{ width:'16px', height:'16px', color:'var(--text-muted)' }} />
            </button>
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', background:isDark?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.05)', borderRadius:'14px', padding:'3px', gap:'3px' }}>
          <button style={tabStyle('pedidos')}  onClick={function(){ setTab('pedidos');  }}>📦 Pedidos</button>
          <button style={tabStyle('negocios')} onClick={function(){ setTab('negocios'); }}>🏪 Negocios</button>
          <button style={tabStyle('clientes')} onClick={function(){ setTab('clientes'); }}>👥 Métricas</button>
        </div>
      </div>

      <div style={{ padding:'16px', paddingBottom:'40px' }}>

        {error && (
          <div style={{ padding:'12px 14px', borderRadius:'12px', background:'var(--color-red-dim)', border:'1px solid rgba(239,68,68,0.3)', marginBottom:'16px' }}>
            <p style={{ fontSize:'12px', color:'var(--color-red)', margin:0 }}>{error}</p>
          </div>
        )}

        {/* ── TAB PEDIDOS ── */}
        {tab === 'pedidos' && (
          <div>
            {/* Métricas rápidas */}
            {!loadingM && metricas && (
              <div style={{ display:'flex', gap:'10px', marginBottom:'16px', overflowX:'auto', paddingBottom:'4px', scrollbarWidth:'none' }}>
                <MetricaCard emoji="📦" titulo="Pedidos hoy"    valor={metricas.pedidosHoy}    sub={'Total: ' + metricas.totalPedidos} />
                <MetricaCard emoji="💰" titulo="Ingresos hoy"   valor={'$' + metricas.ingresoHoy.toFixed(0)} sub={'Total: $' + metricas.ingresoTotal.toFixed(0)} />
                <MetricaCard emoji="⏳" titulo="Pendientes"     valor={metricas.pedidosPendientes} color="var(--color-red)" />
              </div>
            )}

            {/* Filtros de estatus */}
            <div style={{ display:'flex', gap:'8px', marginBottom:'16px', overflowX:'auto', scrollbarWidth:'none' }}>
              {['todos','pendiente','en_camino','entregado','cancelado'].map(function(e){
                const activo = filtroEstatus === e;
                const cfg    = ESTATUS_CONFIG[e];
                return (
                  <button key={e} onClick={function(){ setFiltro(e); }}
                    style={{ padding:'6px 14px', borderRadius:'20px', border:activo?'none':'1px solid var(--border-subtle)', background:activo?(cfg?.bg ?? 'var(--color-yellow-dim)'):'transparent', color:activo?(cfg?.color ?? 'var(--color-yellow)'):'var(--text-muted)', fontSize:'11px', fontWeight:activo?800:500, cursor:'pointer', whiteSpace:'nowrap' }}>
                    {e === 'todos' ? 'Todos' : (cfg?.label ?? e)}
                  </button>
                );
              })}
            </div>

            {/* Lista pedidos */}
            {loadingP && [1,2,3].map(function(i){
              return <div key={i} style={{ borderRadius:'16px', padding:'14px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', marginBottom:'10px', display:'flex', gap:'10px' }}>
                <div className="skeleton" style={{ width:'40px', height:'40px', borderRadius:'10px', flexShrink:0 }} />
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'6px', justifyContent:'center' }}>
                  <div className="skeleton" style={{ height:'12px', width:'60%' }} />
                  <div className="skeleton" style={{ height:'10px', width:'40%' }} />
                </div>
              </div>;
            })}

            {!loadingP && pedidos.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 24px' }}>
                <p style={{ fontSize:'36px', marginBottom:'12px' }}>📭</p>
                <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>Sin pedidos {filtroEstatus !== 'todos' ? 'con estatus "' + filtroEstatus + '"' : ''}</p>
              </div>
            )}

            {!loadingP && pedidos.map(function(pedido){
              const cfg    = ESTATUS_CONFIG[pedido.estatus] ?? ESTATUS_CONFIG['pendiente'];
              const abierto = pedidoAbierto === pedido.id;
              return (
                <div key={pedido.id} style={{ borderRadius:'16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', marginBottom:'10px', overflow:'hidden', boxShadow:'var(--shadow-card)' }}>
                  {/* Cabecera */}
                  <div onClick={function(){ setPedAbi(abierto ? null : pedido.id); }}
                    style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:cfg.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <ShoppingBag style={{ width:'18px', height:'18px', color:cfg.color }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 2px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {pedido.negocio_nombre ?? 'Negocio'}
                      </p>
                      <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>
                        {pedido.cliente_email?.split('@')[0]} · {formatFecha(pedido.created_at)}
                      </p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:'14px', fontWeight:900, color:'var(--color-yellow)', margin:'0 0 3px 0' }}>${(pedido.total ?? 0).toFixed(0)}</p>
                      <span style={{ fontSize:'9px', fontWeight:800, padding:'2px 8px', borderRadius:'8px', background:cfg.bg, color:cfg.color, textTransform:'uppercase' }}>{cfg.label}</span>
                    </div>
                    {abierto ? <ChevronUp style={{ width:'14px', height:'14px', color:'var(--text-muted)', flexShrink:0 }} /> : <ChevronDown style={{ width:'14px', height:'14px', color:'var(--text-muted)', flexShrink:0 }} />}
                  </div>

                  {/* Detalle expandido */}
                  {abierto && (
                    <div style={{ padding:'0 16px 16px', borderTop:'1px solid var(--border-subtle)' }}>
                      <div style={{ paddingTop:'12px', display:'flex', flexDirection:'column', gap:'8px' }}>
                        {pedido.detalle && (
                          <div>
                            <p style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', margin:'0 0 4px 0' }}>Detalle</p>
                            <p style={{ fontSize:'12px', color:'var(--text-secondary)', margin:0, lineHeight:1.5 }}>{pedido.detalle}</p>
                          </div>
                        )}
                        {pedido.direccion && (
                          <div>
                            <p style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', margin:'0 0 4px 0' }}>📍 Dirección</p>
                            <p style={{ fontSize:'12px', color:'var(--text-secondary)', margin:0 }}>{pedido.direccion}</p>
                          </div>
                        )}
                        <div style={{ display:'flex', gap:'8px' }}>
                          {pedido.forma_pago && (
                            <span style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'8px', background:'var(--color-blue-dim)', color:'var(--color-blue)', fontWeight:700 }}>
                              💳 {pedido.forma_pago}
                            </span>
                          )}
                          {pedido.canal && (
                            <span style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'8px', background:'var(--border-subtle)', color:'var(--text-muted)', fontWeight:600 }}>
                              {pedido.canal === 'webapp' ? '📱 App' : '💬 WhatsApp'}
                            </span>
                          )}
                        </div>
                        {/* Botones de estatus */}
                        <div>
                          <p style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', margin:'0 0 8px 0' }}>Cambiar estatus</p>
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                            {['pendiente','en_camino','entregado','cancelado'].map(function(s){
                              const c = ESTATUS_CONFIG[s];
                              const activo = pedido.estatus === s;
                              return (
                                <button key={s} onClick={function(){ cambiarEstatus(pedido.id, s); }}
                                  style={{ padding:'6px 12px', borderRadius:'10px', border:activo?'none':'1px solid var(--border-subtle)', background:activo?c.bg:'transparent', color:activo?c.color:'var(--text-muted)', fontSize:'11px', fontWeight:activo?800:600, cursor:'pointer' }}>
                                  {activo && '✓ '}{c.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Contactar cliente */}
                        {pedido.cliente_email && (
                          <a href={'mailto:' + pedido.cliente_email}
                            style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'9px 14px', borderRadius:'12px', background:'var(--color-blue-dim)', color:'var(--color-blue)', fontSize:'12px', fontWeight:700, textDecoration:'none', alignSelf:'flex-start' }}>
                            <MessageCircle style={{ width:'14px', height:'14px' }} />
                            Contactar cliente
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB NEGOCIOS ── */}
        {tab === 'negocios' && (
          <div>
            <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
              <MetricaCard emoji="🏪" titulo="Total negocios"  valor={merchants.length} />
              <MetricaCard emoji="✅" titulo="Abiertos ahora"  valor={merchants.filter(function(m){ return m.is_open; }).length} color="var(--color-green)" />
            </div>
            {merchants.map(function(m){
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'14px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', marginBottom:'8px', boxShadow:'var(--shadow-card)' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'linear-gradient(135deg,#1a1a2e,#2d2d44)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                    🏪
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 2px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</p>
                    <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>{m.category} · ★ {(m.rating ?? 4.5).toFixed(1)}</p>
                  </div>
                  {/* Toggle abierto/cerrado */}
                  <button onClick={function(){ toggleMerchant(m.id, m.is_open); }}
                    style={{ padding:'6px 12px', borderRadius:'10px', border:'none', background:m.is_open?'var(--color-green-dim)':'var(--color-red-dim)', color:m.is_open?'var(--color-green)':'var(--color-red)', fontSize:'11px', fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
                    {m.is_open ? '● Abierto' : '○ Cerrado'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB MÉTRICAS ── */}
        {tab === 'clientes' && (
          <div>
            {loadingM && <div style={{ textAlign:'center', padding:'48px' }}><span className="spinner" style={{ borderTopColor:'var(--color-yellow)', borderColor:'var(--border-subtle)', width:'28px', height:'28px' }} /></div>}
            {!loadingM && metricas && (
              <div>
                {/* Grid métricas */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
                  <div style={{ gridColumn:'1/-1', padding:'20px', borderRadius:'18px', background:'linear-gradient(135deg,#facc15,#f59e0b)', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', right:'-10px', top:'-10px', width:'80px', height:'80px', borderRadius:'50%', background:'rgba(255,255,255,0.15)' }} />
                    <p style={{ fontSize:'11px', fontWeight:900, color:'rgba(2,6,23,0.5)', textTransform:'uppercase', letterSpacing:'0.15em', margin:'0 0 4px 0' }}>Ingresos totales</p>
                    <p style={{ fontSize:'32px', fontWeight:900, color:'#020617', margin:'0 0 4px 0' }}>${metricas.ingresoTotal.toLocaleString('es-MX')}</p>
                    <p style={{ fontSize:'13px', color:'rgba(2,6,23,0.6)', margin:0 }}>Hoy: ${metricas.ingresoHoy.toLocaleString('es-MX')}</p>
                  </div>

                  {[
                    { emoji:'📦', titulo:'Total pedidos',    valor:metricas.totalPedidos,      sub:'Hoy: '+metricas.pedidosHoy,             color:undefined },
                    { emoji:'⏳', titulo:'Pendientes',       valor:metricas.pedidosPendientes, sub:'Requieren atención',                     color:'var(--color-red)' },
                    { emoji:'🏪', titulo:'Negocios',         valor:metricas.totalMerchants,    sub:metricas.merchantsAbiertos+' abiertos',   color:undefined },
                    { emoji:'👥', titulo:'Clientes',         valor:metricas.totalClientes,     sub:'Registrados en app',                     color:'var(--color-green)' },
                  ].map(function(m, i){
                    return <MetricaCard key={i} emoji={m.emoji} titulo={m.titulo} valor={m.valor} sub={m.sub} color={m.color} />;
                  })}
                </div>

                {/* Estatus de pedidos */}
                <div style={{ padding:'16px', borderRadius:'18px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', marginBottom:'16px' }}>
                  <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 14px 0' }}>📊 Distribución de pedidos</p>
                  {['pendiente','en_camino','entregado','cancelado'].map(function(s){
                    const cfg = ESTATUS_CONFIG[s];
                    const count = pedidos.filter(function(p){ return p.estatus === s; }).length;
                    const pct   = metricas.totalPedidos > 0 ? Math.round(count/metricas.totalPedidos*100) : 0;
                    return (
                      <div key={s} style={{ marginBottom:'10px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                          <span style={{ fontSize:'12px', fontWeight:600, color:'var(--text-secondary)' }}>{cfg.label}</span>
                          <span style={{ fontSize:'12px', fontWeight:800, color:cfg.color }}>{count} ({pct}%)</span>
                        </div>
                        <div style={{ height:'6px', borderRadius:'3px', background:'var(--border-subtle)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:pct+'%', borderRadius:'3px', background:cfg.color, transition:'width 0.5s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Info del admin */}
                <div style={{ padding:'14px 16px', borderRadius:'16px', background:'var(--color-yellow-dim)', border:'1px solid rgba(250,204,21,0.3)' }}>
                  <p style={{ fontSize:'12px', fontWeight:700, color:'var(--color-yellow)', margin:'0 0 4px 0' }}>⚡ Administrador</p>
                  <p style={{ fontSize:'13px', color:'var(--text-primary)', margin:'0 0 2px 0' }}>{props.session.user.email}</p>
                  <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>Changuito Express · God Mode</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
