/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Wallet, Gift, Star, TrendingUp, Package, RefreshCw, ChevronRight } from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';
import { getFreeShippingProgress } from './freeShippingProgress';

interface Props {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onVolver:      () => void;
}

interface MonederoData {
  id:                  string;
  user_id:             string;
  saldo_cashback:      number;
  pedidos_realizados:  number;
  envios_gratis_usados?: number;
}

interface PedidoResumen {
  id:            string;
  negocio_nombre: string | null;
  total_pagar:   number | null;
  estatus:       string;
  created_at:    string;
}

const ESTATUS_COLOR: Record<string, string> = {
  pendiente:  '#facc15',
  en_camino:  '#3b82f6',
  entregado:  '#22c55e',
  cancelado:  '#ef4444',
};
const ESTATUS_LABEL: Record<string, string> = {
  pendiente:  'Pendiente',
  en_camino:  'En camino',
  entregado:  'Entregado',
  cancelado:  'Cancelado',
};

async function cargarResumenEntregados(uid: string): Promise<{ entregados: number; totalGastado: number }> {
  const pageSize = 1000;
  const orderQuery = function(from: number, includeCount: boolean) {
    return supabase
      .from('pedidos')
      .select('total_pagar', includeCount ? { count: 'exact' } : undefined)
      .eq('cliente_id', uid)
      .eq('estatus', 'entregado')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
  };

  const { data, error, count } = await orderQuery(0, true);
  if (error) throw error;
  if (count === null) throw new Error('No se pudo contar el historial de pedidos entregados');

  let entregados = 0;
  let totalGastado = 0;
  let offset = 0;
  let page = data ?? [];

  while (true) {
    page.forEach(function(p) {
      entregados += 1;
      totalGastado += p.total_pagar ?? 0;
    });
    offset += page.length;

    if (offset >= count) break;
    if (page.length === 0) throw new Error('El historial de pedidos entregados está incompleto');

    const { data: nextPage, error: nextError } = await orderQuery(offset, false);
    if (nextError) throw nextError;
    page = nextPage ?? [];
  }

  return { entregados, totalGastado };
}

export default function ChangoMonedero(props: Props) {
  const [monedero, setMonedero]   = useState<MonederoData | null>(null);
  const [pedidos,  setPedidos]    = useState<PedidoResumen[]>([]);
  const [pedidosHistorial, setPedidosHistorial] = useState<PedidoResumen[]>([]);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [offsetHistorial, setOffsetHistorial] = useState(0);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState(false);
  const [entregados, setEntregados] = useState(0);
  const [totalGastado, setTotalGastado] = useState(0);
  const [loading,  setLoading]    = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const historyRequestSequence = useRef(0);
  const [tab,      setTab]        = useState<'resumen' | 'historial' | 'como'>('resumen');

  const isDark = props.theme === 'dark';
  const uid    = props.session.user.id;

  const cargar = useCallback(async function() {
    const requestId = ++requestSequence.current;
    const isCurrentRequest = function() {
      return requestSequence.current === requestId;
    };

    historyRequestSequence.current += 1;
    setLoading(true);
    setLoadError(false);
    setCargandoHistorial(false);
    setErrorHistorial(false);
    try {
      // Cargar o crear monedero
      let { data: mon, error: monError } = await supabase
        .from('monedero_cliente')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (!isCurrentRequest()) return;
      if (monError) throw monError;
      if (!mon) {
        const { data: nuevo, error: nuevoError } = await supabase
          .from('monedero_cliente')
          .insert([{ user_id: uid, saldo_cashback: 0, pedidos_realizados: 0 }])
          .select()
          .single();
        if (!isCurrentRequest()) return;
        if (nuevoError || !nuevo) throw nuevoError ?? new Error('No se pudo crear el monedero');
        mon = nuevo;
      }

      // Mantener acotado el historial visible y calcular los totales con todo el historial entregado.
      const [pedidosResult, resumenEntregados] = await Promise.all([
        supabase
          .from('pedidos')
          .select('id, negocio_nombre, total_pagar, estatus, created_at', { count: 'exact' })
          .eq('cliente_id', uid)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(50),
        cargarResumenEntregados(uid),
      ]);
      if (!isCurrentRequest()) return;
      if (pedidosResult.error) throw pedidosResult.error;
      if (pedidosResult.count === null) throw new Error('No se pudo contar el historial de pedidos');

      setMonedero(mon);
      setPedidos(pedidosResult.data ?? []);
      setPedidosHistorial(pedidosResult.data ?? []);
      setTotalPedidos(pedidosResult.count);
      setOffsetHistorial(0);
      setEntregados(resumenEntregados.entregados);
      setTotalGastado(resumenEntregados.totalGastado);
      setLoadedUserId(uid);
    } catch(e) {
      if (!isCurrentRequest()) return;
      console.error(e);
      setMonedero(null);
      setPedidos([]);
      setPedidosHistorial([]);
      setTotalPedidos(0);
      setOffsetHistorial(0);
      setEntregados(0);
      setTotalGastado(0);
      setLoadError(true);
      setLoadedUserId(uid);
    }
    finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [uid]);

  const cargarPaginaHistorial = useCallback(async function(offset: number) {
    const requestId = ++historyRequestSequence.current;
    setCargandoHistorial(true);
    setErrorHistorial(false);
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, negocio_nombre, total_pagar, estatus, created_at')
        .eq('cliente_id', uid)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + 49);
      if (historyRequestSequence.current !== requestId) return;
      if (error) throw error;
      setPedidosHistorial(data ?? []);
      setOffsetHistorial(offset);
    } catch (e) {
      if (historyRequestSequence.current !== requestId) return;
      console.error(e);
      setErrorHistorial(true);
    } finally {
      if (historyRequestSequence.current === requestId) setCargandoHistorial(false);
    }
  }, [uid]);

  useEffect(function() {
    let activo = true;
    const refrescar = function() {
      if (activo && document.visibilityState === 'visible') cargar();
    };

    cargar();
    window.addEventListener('focus', refrescar);
    document.addEventListener('visibilitychange', refrescar);
    const channel = supabase
      .channel('changomonedero-pedidos-' + uid)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
        filter: 'cliente_id=eq.' + uid,
      }, refrescar)
      .subscribe();

    return function() {
      activo = false;
      requestSequence.current += 1;
      historyRequestSequence.current += 1;
      window.removeEventListener('focus', refrescar);
      document.removeEventListener('visibilitychange', refrescar);
      supabase.removeChannel(channel);
    };
  }, [cargar, uid]);

  const loadingCurrentUser = loading || loadedUserId !== uid;
  const loadErrorCurrentUser = loadedUserId === uid && loadError;
  const envioGratis  = getFreeShippingProgress(
    entregados,
    monedero?.envios_gratis_usados ?? 0,
  );
  const cashback     = monedero?.saldo_cashback ?? 0;

  const tabStyle = function(t: string): React.CSSProperties {
    const activo = tab === t;
    return { flex: 1, padding: '9px 4px', border: 'none', borderRadius: '11px', cursor: 'pointer', fontSize: '11px', fontWeight: activo ? 900 : 600, background: activo ? 'var(--color-yellow)' : 'transparent', color: activo ? '#020617' : 'var(--text-muted)' };
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'system-ui,sans-serif', maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-nav)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-subtle)', padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={props.onVolver}
              style={{ width: '36px', height: '36px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ArrowLeft style={{ width: '18px', height: '18px', color: 'var(--text-primary)' }} />
            </button>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--color-yellow)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>💰 Mi Cuenta</p>
              <h1 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>ChangoMonedero</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={cargar} aria-label="Recargar monedero" title="Recargar monedero"
              style={{ width: '36px', height: '36px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <RefreshCw style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            </button>
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)', borderRadius: '14px', padding: '3px', gap: '3px' }}>
          <button style={tabStyle('resumen')}   onClick={function(){ setTab('resumen');   }}>💰 Saldo</button>
          <button style={tabStyle('historial')} onClick={function(){ setTab('historial'); }}>📦 Pedidos</button>
          <button style={tabStyle('como')}      onClick={function(){ setTab('como');      }}>🎁 Beneficios</button>
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '50px' }}>

        {loadingCurrentUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1,2,3].map(function(i) {
              return <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '18px' }} />;
            })}
          </div>
        )}

        {!loadingCurrentUser && loadErrorCurrentUser && (
          <div role="alert" style={{ padding: '24px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>No pudimos cargar tu monedero</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Revisa tu conexión e inténtalo de nuevo.</p>
            <button onClick={cargar}
              style={{ padding: '10px 16px', border: 'none', borderRadius: '12px', background: 'var(--color-yellow)', color: '#020617', fontWeight: 800, cursor: 'pointer' }}>
              Reintentar
            </button>
          </div>
        )}

        {/* ── TAB RESUMEN ── */}
        {!loadingCurrentUser && !loadErrorCurrentUser && tab === 'resumen' && (
          <div>
            {/* Tarjeta principal ChangoPesos */}
            <div style={{ padding: '24px', borderRadius: '22px', background: 'linear-gradient(135deg,#facc15,#f59e0b)', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ position: 'absolute', right: '20px', bottom: '-30px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', position: 'relative' }}>
                <Wallet style={{ width: '22px', height: '22px', color: 'rgba(2,6,23,0.7)' }} />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'rgba(2,6,23,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Chang<span style={{ color: '#020617' }}>o</span>Pesos</span>
              </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(2,6,23,0.55)', margin: '0 0 4px 0', position: 'relative' }}>Saldo disponible</p>
              <p style={{ fontSize: '42px', fontWeight: 900, color: '#020617', margin: '0 0 6px 0', lineHeight: 1, position: 'relative' }}>
                ${cashback.toFixed(2)}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(2,6,23,0.55)', margin: 0, position: 'relative' }}>
                {props.session.user.nombre ?? props.session.user.email?.split('@')[0]}
              </p>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[
                { emoji: '📦', label: 'Pedidos totales',   value: String(monedero?.pedidos_realizados ?? 0), color: 'var(--text-primary)' },
                { emoji: '💸', label: 'Total gastado',     value: '$' + totalGastado.toLocaleString('es-MX', { maximumFractionDigits: 0 }), color: 'var(--color-yellow)' },
                { emoji: '🚚', label: 'Envíos gratis',     value: String(monedero?.envios_gratis_usados ?? 0), color: 'var(--color-green)' },
                { emoji: '⭐', label: 'Nivel',             value: totalGastado >= 5000 ? 'Oro' : totalGastado >= 1000 ? 'Plata' : 'Bronce', color: totalGastado >= 5000 ? '#facc15' : totalGastado >= 1000 ? '#94a3b8' : '#cd7f32' },
              ].map(function(s) {
                return (
                  <div key={s.label} style={{ padding: '16px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <p style={{ fontSize: '22px', margin: '0 0 6px 0' }}>{s.emoji}</p>
                    <p style={{ fontSize: '20px', fontWeight: 900, color: s.color, margin: '0 0 4px 0', lineHeight: 1 }}>{s.value}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Barra progreso hacia envío gratis */}
            <div style={{ padding: '18px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🚚 {envioGratis.available ? 'Envío gratis disponible' : 'Próximo envío gratis'}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {envioGratis.available ? '¡Ya tienes envío gratis disponible!' : envioGratis.remainingOrders + ' pedido' + (envioGratis.remainingOrders !== 1 ? 's' : '') + ' más'}
                  </p>
                </div>
                <span style={{ fontSize: '20px', fontWeight: 900, color: envioGratis.available ? 'var(--color-green)' : 'var(--color-yellow)' }}>
                  {envioGratis.progressPercent}%
                </span>
              </div>
              <div style={{ height: '10px', borderRadius: '5px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: Math.min(envioGratis.progressPercent, 100) + '%', borderRadius: '5px', background: envioGratis.available ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#facc15,#f59e0b)', transition: 'width 0.8s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{envioGratis.cycleCount}/10 pedidos</span>
                <span style={{ fontSize: '10px', color: 'var(--color-green)', fontWeight: 700 }}>¡Cada 10 entregados!</span>
              </div>
            </div>

            {/* Últimos pedidos - preview */}
            {pedidos.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Últimos pedidos</p>
                  <button onClick={function(){ setTab('historial'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-yellow)', fontSize: '12px', fontWeight: 700 }}>
                    Ver todos <ChevronRight style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
                {pedidos.slice(0, 3).map(function(p) {
                  const fecha = new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(250,204,21,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package style={{ width: '16px', height: '16px', color: 'var(--color-yellow)' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1px 0', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.negocio_nombre ?? 'Pedido'}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{fecha}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '13px', fontWeight: 900, color: 'var(--color-yellow)', margin: '0 0 2px 0' }}>${(p.total_pagar ?? 0).toFixed(0)}</p>
                        <span style={{ fontSize: '9px', fontWeight: 800, color: ESTATUS_COLOR[p.estatus] ?? 'var(--text-muted)', textTransform: 'uppercase' }}>{ESTATUS_LABEL[p.estatus] ?? p.estatus}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB HISTORIAL ── */}
        {!loadingCurrentUser && !loadErrorCurrentUser && tab === 'historial' && (
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 14px 0' }}>
              {totalPedidos === 0
                ? 'Tus pedidos'
                : `Pedidos ${offsetHistorial + 1}–${offsetHistorial + pedidosHistorial.length} de ${totalPedidos}`}
            </p>
            {errorHistorial && (
              <div role="alert" style={{ padding: '12px 14px', borderRadius: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No pudimos cargar estos pedidos. Inténtalo de nuevo.
              </div>
            )}
            {pedidosHistorial.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                <p style={{ fontSize: '40px', margin: '0 0 12px 0' }}>📦</p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Sin pedidos aún</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Haz tu primer pedido para acumular ChangoPesos</p>
              </div>
            )}
            {pedidosHistorial.map(function(p) {
              const fecha = new Date(p.created_at);
              const label = fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · ' + fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
              const color = ESTATUS_COLOR[p.estatus] ?? 'var(--text-muted)';
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(250,204,21,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package style={{ width: '18px', height: '18px', color: 'var(--color-yellow)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                        {p.negocio_nombre ?? 'Pedido'}
                      </p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{label}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-yellow)', margin: '0 0 3px 0' }}>${(p.total_pagar ?? 0).toFixed(0)}</p>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: color, textTransform: 'uppercase' }}>{ESTATUS_LABEL[p.estatus] ?? p.estatus}</span>
                  </div>
                </div>
              );
            })}
            {totalPedidos > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '16px' }}>
                <button
                  onClick={function() { cargarPaginaHistorial(Math.max(0, offsetHistorial - 50)); }}
                  disabled={cargandoHistorial || offsetHistorial === 0}
                  style={{ flex: 1, padding: '11px 12px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, cursor: offsetHistorial === 0 || cargandoHistorial ? 'default' : 'pointer', opacity: offsetHistorial === 0 || cargandoHistorial ? 0.5 : 1 }}
                >
                  Pedidos más recientes
                </button>
                <button
                  onClick={function() { cargarPaginaHistorial(offsetHistorial + 50); }}
                  disabled={cargandoHistorial || offsetHistorial + pedidosHistorial.length >= totalPedidos}
                  style={{ flex: 1, padding: '11px 12px', borderRadius: '12px', border: 'none', background: 'var(--color-yellow)', color: '#020617', fontWeight: 800, cursor: cargandoHistorial || offsetHistorial + pedidosHistorial.length >= totalPedidos ? 'default' : 'pointer', opacity: cargandoHistorial || offsetHistorial + pedidosHistorial.length >= totalPedidos ? 0.5 : 1 }}
                >
                  {cargandoHistorial ? 'Cargando…' : 'Pedidos anteriores'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CÓMO FUNCIONA ── */}
        {!loadingCurrentUser && !loadErrorCurrentUser && tab === 'como' && (
          <div>
            {/* Hero */}
            <div style={{ padding: '22px', borderRadius: '20px', background: 'linear-gradient(135deg,#1a1a2e,#facc15)', marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '36px', margin: '0 0 8px 0' }}>🐒💰</p>
              <p style={{ fontSize: '18px', fontWeight: 900, color: '#fff', margin: '0 0 6px 0' }}>ChangoPesos</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', margin: 0 }}>El programa de lealtad de Changuito Express</p>
            </div>

            {/* Beneficios */}
            {[
              {
                emoji: '🚚',
                titulo: 'Envío Gratis cada 10 pedidos entregados',
                desc: 'Completa 10 entregas y tu siguiente envío es completamente gratis. El contador se reinicia automáticamente.',
              },
              {
                emoji: '💸',
                titulo: '5-10% Cashback en productos seleccionados',
                desc: 'En restaurantes y negocios aliados participantes, ganas entre 5% y 10% de cashback en ChangoPesos aplicables en futuros pedidos.',
              },
              {
                emoji: '⭐',
                titulo: 'Sube de nivel',
                desc: 'Bronce → Plata ($1,000 gastados) → Oro ($5,000 gastados). Cada nivel trae beneficios exclusivos y mayor cashback.',
              },
              {
                emoji: '🎁',
                titulo: 'Sorpresas y promociones',
                desc: 'Los usuarios activos reciben cupones especiales, días de envío gratis y acceso anticipado a nuevos negocios.',
              },
            ].map(function(b) {
              return (
                <div key={b.titulo} style={{ display: 'flex', gap: '14px', padding: '16px', borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(250,204,21,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    {b.emoji}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{b.titulo}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{b.desc}</p>
                  </div>
                </div>
              );
            })}

            <div style={{ padding: '14px 16px', borderRadius: '16px', background: 'var(--color-yellow-dim)', border: '1px solid rgba(250,204,21,0.3)', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-yellow)', margin: '0 0 4px 0' }}>🐒 Tip Changuito</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Los ChangoPesos no caducan mientras tu cuenta esté activa. ¡Pide seguido y ahorra más!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
