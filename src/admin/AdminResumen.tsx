/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../App';
import { Aviso, cardStyle, mxn } from './adminKit';

interface Fila { id: string; total_pagar: number | null; estatus: string; created_at: string; negocio_nombre: string | null; forma_pago: string | null; cliente_id: string | null }

const COMISION = 0.15;
const COLORES: Record<string, string> = { pendiente: '#F6C945', en_camino: '#2979DA', entregado: '#159447', cancelado: '#E84844' };
const ETIQ: Record<string, string> = { pendiente: 'Pendientes', en_camino: 'En camino', entregado: 'Entregados', cancelado: 'Cancelados' };

function dia(d: Date): string { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function Kpi(props: { titulo: string; valor: string; sub?: string; delta?: number | null; color: string }) {
  return (
    <div style={{ ...cardStyle, padding: '16px', borderTop: '4px solid ' + props.color }}>
      <p style={{ margin: 0, fontSize: '10px', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{props.titulo}</p>
      <p style={{ margin: '6px 0 2px', fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>{props.valor}</p>
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
        {props.delta != null && (
          <strong style={{ color: props.delta >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{props.delta >= 0 ? '▲ ' : '▼ '}{Math.abs(props.delta).toFixed(0)}% </strong>
        )}
        {props.sub}
      </p>
    </div>
  );
}

export default function AdminResumen(props: { totalClientes: number; negociosAbiertos: number; totalNegocios: number }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [rango, setRango] = useState<7 | 14 | 30>(14);

  useEffect(function () {
    let vivo = true;
    (async function () {
      const { data, error: err } = await supabase.from('pedidos')
        .select('id, total_pagar, estatus, created_at, negocio_nombre, forma_pago, cliente_id')
        .order('created_at', { ascending: false }).limit(5000);
      if (!vivo) return;
      if (err) setError('No se pudieron cargar las ventas: ' + err.message);
      setFilas((data ?? []) as Fila[]); setCargando(false);
    })();
    return function () { vivo = false; };
  }, []);

  const datos = useMemo(function () {
    const validos = filas.filter(function (f) { return f.estatus !== 'cancelado'; });
    const total = function (l: Fila[]) { return l.reduce(function (a, f) { return a + Number(f.total_pagar ?? 0); }, 0); };
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const desde = function (n: number) { const d = new Date(hoy); d.setDate(d.getDate() - n); return d; };
    const entre = function (a: Date, b: Date) { return validos.filter(function (f) { const t = new Date(f.created_at); return t >= a && t < b; }); };
    const finHoy = new Date(hoy); finHoy.setDate(finHoy.getDate() + 1);
    const semana = entre(desde(6), finHoy), previa = entre(desde(13), desde(6));
    const ventasSemana = total(semana), ventasPrevia = total(previa);
    const serie: { etiqueta: string; ventas: number; pedidos: number }[] = [];
    for (let i = rango - 1; i >= 0; i--) {
      const d = desde(i); const clave = dia(d);
      const delDia = validos.filter(function (f) { return dia(new Date(f.created_at)) === clave; });
      serie.push({ etiqueta: d.getDate() + '/' + (d.getMonth() + 1), ventas: total(delDia), pedidos: delDia.length });
    }
    const porNegocio = new Map<string, { ventas: number; pedidos: number }>();
    validos.forEach(function (f) {
      const k = f.negocio_nombre ?? 'Sin negocio'; const a = porNegocio.get(k) ?? { ventas: 0, pedidos: 0 };
      a.ventas += Number(f.total_pagar ?? 0); a.pedidos += 1; porNegocio.set(k, a);
    });
    const estatus: Record<string, number> = { pendiente: 0, en_camino: 0, entregado: 0, cancelado: 0 };
    filas.forEach(function (f) { estatus[f.estatus] = (estatus[f.estatus] ?? 0) + 1; });
    const efectivo = validos.filter(function (f) { return f.forma_pago === 'efectivo'; }).length;
    const clientes = new Set(validos.map(function (f) { return f.cliente_id; }).filter(Boolean));
    const recurrentes = Array.from(clientes).filter(function (c) { return validos.filter(function (f) { return f.cliente_id === c; }).length > 1; }).length;
    return {
      ventasTotal: total(validos), ventasHoy: total(entre(hoy, finHoy)), pedidosHoy: entre(hoy, finHoy).length,
      ticket: validos.length ? total(validos) / validos.length : 0,
      delta: ventasPrevia > 0 ? ((ventasSemana - ventasPrevia) / ventasPrevia) * 100 : null,
      ventasSemana, serie, estatus, efectivo, transferencia: validos.length - efectivo,
      top: Array.from(porNegocio.entries()).sort(function (a, b) { return b[1].ventas - a[1].ventas; }).slice(0, 8),
      compradores: clientes.size, recurrentes, validos: validos.length,
    };
  }, [filas, rango]);

  if (cargando) return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Calculando métricas…</p>;

  const maxV = Math.max(1, ...datos.serie.map(function (s) { return s.ventas; }));
  const W = 640, H = 200, pad = 28, bw = (W - pad * 2) / datos.serie.length;
  const puntos = datos.serie.map(function (s, i) { return (pad + i * bw + bw / 2) + ',' + (H - pad - (s.ventas / maxV) * (H - pad * 2)); }).join(' ');
  const maxTop = Math.max(1, ...datos.top.map(function (t) { return t[1].ventas; }));
  const totalEst = Object.values(datos.estatus).reduce(function (a, b) { return a + b; }, 0);

  return (
    <div>
      {error && <Aviso tipo="error" texto={error} />}
      <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', marginBottom: '16px' }}>
        <Kpi titulo="Ventas totales" valor={mxn(datos.ventasTotal)} sub={datos.validos + ' pedidos sin cancelar'} color="#159447" />
        <Kpi titulo="Ventas de la semana" valor={mxn(datos.ventasSemana)} delta={datos.delta} sub="vs. semana previa" color="#F6C945" />
        <Kpi titulo="Hoy" valor={mxn(datos.ventasHoy)} sub={datos.pedidosHoy + ' pedidos'} color="#2979DA" />
        <Kpi titulo="Ticket promedio" valor={mxn(datos.ticket)} sub={'Comisión estimada (15%): ' + mxn(datos.ventasTotal * COMISION)} color="#E84844" />
      </div>

      <div style={{ ...cardStyle, padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>Tendencia de ventas</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([7, 14, 30] as const).map(function (r) {
              return <button key={r} type="button" onClick={function () { setRango(r); }} style={{ border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 800, background: rango === r ? 'var(--color-yellow)' : 'transparent', color: rango === r ? '#1c1400' : 'var(--text-muted)' }}>{r} días</button>;
            })}
          </div>
        </div>
        <svg viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="Gráfica de ventas diarias" style={{ width: '100%', height: 'auto' }}>
          {[0, 0.5, 1].map(function (g) { const y = H - pad - g * (H - pad * 2); return <g key={g}><line x1={pad} x2={W - pad} y1={y} y2={y} stroke="var(--border-subtle)" /><text x={2} y={y + 3} fontSize="9" fill="var(--text-muted)">{Math.round(maxV * g)}</text></g>; })}
          {datos.serie.map(function (s, i) {
            const h = (s.ventas / maxV) * (H - pad * 2);
            return <g key={i}><rect x={pad + i * bw + bw * 0.18} y={H - pad - h} width={bw * 0.64} height={Math.max(h, 1)} rx="4" fill="#159447" opacity="0.85"><title>{s.etiqueta + ': ' + mxn(s.ventas) + ' · ' + s.pedidos + ' pedidos'}</title></rect>
              {(datos.serie.length <= 14 || i % 3 === 0) && <text x={pad + i * bw + bw / 2} y={H - 10} fontSize="9" textAnchor="middle" fill="var(--text-muted)">{s.etiqueta}</text>}</g>;
          })}
          <polyline points={puntos} fill="none" stroke="#F6C945" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>

      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
        <div style={{ ...cardStyle, padding: '16px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>Negocios con más ventas</p>
          {datos.top.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Aún no hay ventas.</p>}
          {datos.top.map(function (t) {
            return (
              <div key={t[0]} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t[0]}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{mxn(t[1].ventas)} · {t[1].pedidos}</span>
                </div>
                <div style={{ height: '7px', borderRadius: '4px', background: 'var(--border-subtle)' }}><div style={{ height: '100%', width: (t[1].ventas / maxTop) * 100 + '%', borderRadius: '4px', background: 'linear-gradient(90deg,#159447,#F6C945)' }} /></div>
              </div>
            );
          })}
        </div>
        <div style={{ ...cardStyle, padding: '16px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>Estado de pedidos</p>
          {Object.keys(COLORES).map(function (s) {
            const n = datos.estatus[s] ?? 0; const p = totalEst ? (n / totalEst) * 100 : 0;
            return (
              <div key={s} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{ETIQ[s]}</span><strong style={{ color: COLORES[s] }}>{n} ({p.toFixed(0)}%)</strong></div>
                <div style={{ height: '7px', borderRadius: '4px', background: 'var(--border-subtle)' }}><div style={{ height: '100%', width: p + '%', borderRadius: '4px', background: COLORES[s] }} /></div>
              </div>
            );
          })}
          <p style={{ margin: '14px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
            Pago: {datos.efectivo} efectivo · {datos.transferencia} transferencia/otro<br />
            Clientes: {props.totalClientes} registrados · {datos.compradores} han comprado · {datos.recurrentes} recurrentes<br />
            Negocios: {props.negociosAbiertos} abiertos de {props.totalNegocios}
          </p>
        </div>
      </div>
    </div>
  );
}
