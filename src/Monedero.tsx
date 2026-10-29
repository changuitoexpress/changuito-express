/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from './App';
import type { AppSession, Theme } from './App';
import { getFreeShippingProgress } from './freeShippingProgress';

interface Props {
  session: AppSession;
  theme:   Theme;
}

export default function Monedero(props: Props) {
  const [monedero, setMonedero] = useState<any>(null);
  const [pedidosEntregados, setPedidosEntregados] = useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);
  const isDark = props.theme === 'dark';
  const userId = props.session.user?.id;

  useEffect(function() {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMonedero(null);
    setPedidosEntregados(null);
    let activo = true;
    let solicitud = 0;
    const cargarMonedero = async function() {
      const solicitudActual = ++solicitud;
      try {
        let { data, error } = await supabase
          .from('monedero_cliente')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;

        if (!data) {
          const { data: nuevo, error: errorCreacion } = await supabase
            .from('monedero_cliente')
            .insert([{ user_id: userId }])
            .select()
            .single();
          if (errorCreacion) throw errorCreacion;
          data = nuevo;
        }

        const { count, error: errorPedidos } = await supabase
          .from('pedidos')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', userId)
          .eq('estatus', 'entregado');

        if (!activo || solicitudActual !== solicitud) return;
        setMonedero(data);
        setPedidosEntregados(errorPedidos || count === null ? null : count);
      } catch (error) {
        console.error(error);
        if (activo && solicitudActual === solicitud) {
          setMonedero(null);
          setPedidosEntregados(null);
        }
      } finally {
        if (activo && solicitudActual === solicitud) setLoading(false);
      }
    };
    const refrescarMonedero = function() {
      if (document.visibilityState === 'visible') cargarMonedero();
    };

    cargarMonedero();
    window.addEventListener('focus', refrescarMonedero);
    document.addEventListener('visibilitychange', refrescarMonedero);
    const channel = supabase
      .channel('monedero-progreso-' + userId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
        filter: 'cliente_id=eq.' + userId,
      }, refrescarMonedero)
      .subscribe();

    return function() {
      activo = false;
      window.removeEventListener('focus', refrescarMonedero);
      document.removeEventListener('visibilitychange', refrescarMonedero);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading || !monedero) return null;

  const envioGratis = pedidosEntregados === null
    ? null
    : getFreeShippingProgress(
      pedidosEntregados,
      monedero.envios_gratis_usados ?? 0,
    );

  return (
    <div style={{
      margin: '0 16px 16px',
      padding: '14px 16px',
      background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
      border: '1.5px solid #F59E0B',
      borderRadius: '18px',
    }}>
      {/* Encabezado */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
        <Wallet style={{ width:'18px', height:'18px', color:'#F59E0B', flexShrink:0 }} />
        <span style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)' }}>
          Mi Monedero Changuito
        </span>
      </div>

      {/* Tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>

        {/* Cashback */}
        <div style={{
          padding:'10px 12px',
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          borderRadius:'12px',
        }}>
          <p style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', margin:'0 0 4px 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            💰 Cashback
          </p>
          <p style={{ fontSize:'20px', fontWeight:900, color:'#F59E0B', margin:0, lineHeight:1 }}>
            ${(monedero.saldo_cashback ?? 0).toFixed(2)}
          </p>
        </div>

        {/* Envío gratis */}
        <div style={{
          padding:'10px 12px',
          background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
          borderRadius:'12px',
        }}>
          <p style={{ fontSize:'10px', fontWeight:700, color:'var(--text-muted)', margin:'0 0 4px 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            🚚 Envío gratis
          </p>
          <p style={{ fontSize:'14px', fontWeight:800, color:'#22C55E', margin:'0 0 2px 0', lineHeight:1.2 }}>
            {envioGratis === null ? 'No disponible' : envioGratis.available ? '¡Disponible!' : envioGratis.remainingOrders + ' pedido' + (envioGratis.remainingOrders === 1 ? '' : 's')}
          </p>
          <p style={{ fontSize:'10px', color:'var(--text-muted)', margin:0 }}>
            {envioGratis === null ? '—' : envioGratis.cycleCount} de cada 10
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div style={{ marginBottom:'8px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
          <span style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:600 }}>
            {envioGratis === null ? 'Progreso no disponible' : envioGratis.available ? 'Envío gratis disponible' : 'Progreso al próximo envío gratis'}
          </span>
          <span style={{ fontSize:'10px', color:'#22C55E', fontWeight:800 }}>{envioGratis === null ? '—' : envioGratis.progressPercent + '%'}</span>
        </div>
        <div style={{ height:'5px', borderRadius:'3px', background:'var(--border-subtle)', overflow:'hidden' }}>
          <div style={{
            height:'100%',
            width: (envioGratis === null ? 0 : envioGratis.progressPercent) + '%',
            borderRadius:'3px',
            background:'linear-gradient(90deg,#22c55e,#16a34a)',
            transition:'width 0.6s ease',
          }} />
        </div>
      </div>

      <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0, lineHeight:1.4 }}>
        🎁 Cada 10 pedidos entregados = envío gratis · 💎 Compras seleccionadas = 5-10% cashback
      </p>
    </div>
  );
}
