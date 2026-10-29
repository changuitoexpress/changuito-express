/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState } from 'react';
import { supabase } from '../App';
import { Aviso, Campo, Modal, PhotoPicker, btn, cardStyle, inputStyle } from './adminKit';

type Seccion = 'restaurantes' | 'mandaditos' | 'tiendita';

interface Borrador {
  id?: string;
  name: string;
  seccion: Seccion;
  cocina: string;
  description: string;
  phone_number: string;
  delivery_time: string;
  hora_apertura: string;
  hora_cierre: string;
  cashback_pct: string;
  fotos: string[];
  soportaCashback: boolean;
}

function seccionDe(categoria: string | null | undefined): Seccion {
  const c = (categoria ?? '').toLowerCase().trim();
  if (c === 'mandaditos') return 'mandaditos';
  if (['tiendita', 'changui super', 'changui súper', 'changuito super', 'changuito súper'].includes(c)) return 'tiendita';
  return 'restaurantes';
}

const ETIQUETA: Record<Seccion, string> = { restaurantes: '🍽️ Restaurantes', mandaditos: '🛵 Mandaditos', tiendita: '🛒 Changui Súper' };

export default function AdminNegocios(props: { merchants: any[]; onCambio: () => void; abiertoAhora: (m: any) => boolean; onToggle: (id: string, actual: boolean) => void }) {
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'restaurantes' | 'tiendita'>('todas');

  function abrir(m?: any) {
    setError(''); setOk('');
    if (!m) {
      setEditando({ name: '', seccion: 'restaurantes', cocina: '', description: '', phone_number: '', delivery_time: '30-45 min', hora_apertura: '', hora_cierre: '', cashback_pct: '', fotos: [], soportaCashback: props.merchants.some(function (x) { return 'cashback_pct' in x; }) });
      return;
    }
    const sec = seccionDe(m.category);
    setEditando({
      id: m.id, name: m.name ?? '', seccion: sec, cocina: sec === 'restaurantes' ? (m.category ?? '') : '',
      description: m.description ?? '', phone_number: m.phone_number ?? '', delivery_time: m.delivery_time ?? '',
      hora_apertura: m.hora_apertura ?? '', hora_cierre: m.hora_cierre ?? '',
      cashback_pct: m.cashback_pct == null ? '' : String(m.cashback_pct),
      fotos: m.image_url ? [m.image_url] : [], soportaCashback: 'cashback_pct' in m,
    });
  }

  async function guardar() {
    if (!editando) return;
    if (!editando.name.trim()) { setError('El nombre es obligatorio.'); return; }
    const categoria = editando.seccion === 'mandaditos' ? 'mandaditos' : editando.seccion === 'tiendita' ? 'tiendita' : (editando.cocina.trim() || 'restaurante');
    const fila: Record<string, unknown> = {
      name: editando.name.trim(), category: categoria,
      description: editando.description.trim() || null,
      phone_number: editando.phone_number.trim() || null,
      delivery_time: editando.delivery_time.trim() || null,
      hora_apertura: editando.hora_apertura.trim() || null,
      hora_cierre: editando.hora_cierre.trim() || null,
      image_url: editando.fotos[0] ?? null,
    };
    if (editando.soportaCashback) {
      const t = editando.cashback_pct.trim();
      if (t === '') fila.cashback_pct = null;
      else {
        const n = Number(t);
        if (!Number.isFinite(n) || n < 0 || n > 50) { setError('El cashback debe estar entre 0 y 50.'); return; }
        fila.cashback_pct = n;
      }
    }
    setGuardando(true); setError('');
    const resp = editando.id
      ? await supabase.from('merchants').update(fila).eq('id', editando.id).select('id')
      : await supabase.from('merchants').insert({ ...fila, is_open: false, rating: 4.5 }).select('id');
    setGuardando(false);
    if (resp.error || !resp.data?.length) { setError('No se guardó: ' + (resp.error?.message ?? 'sin permisos.')); return; }
    setEditando(null); setOk('Negocio guardado.'); props.onCambio();
  }

  const lista = props.merchants.filter(function (m) { return filtro === 'todas' || seccionDe(m.category) === filtro; });

  return (
    <div>
      {error && !editando && <Aviso tipo="error" texto={error} />}
      {ok && <Aviso tipo="ok" texto={ok} />}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
        {(['todas', 'restaurantes', 'tiendita'] as const).map(function (f) {
          const activo = filtro === f;
          return <button key={f} type="button" onClick={function () { setFiltro(f); }} style={{ ...btn(activo ? 'primary' : 'ghost'), padding: '8px 14px' }}>{f === 'todas' ? 'Todos' : ETIQUETA[f]}</button>;
        })}
        <span style={{ flex: 1 }} />
        <button type="button" style={btn('green')} onClick={function () { abrir(); }}>+ Negocio</button>
      </div>

      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        {lista.map(function (m) {
          const abierto = props.abiertoAhora(m);
          return (
            <div key={m.id} style={{ ...cardStyle, padding: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', overflow: 'hidden', background: 'linear-gradient(135deg,#159447,#F6C945)', display: 'grid', placeItems: 'center', fontSize: '22px', flexShrink: 0 }}>
                {m.image_url ? <img src={m.image_url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏪'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {ETIQUETA[seccionDe(m.category)]}{seccionDe(m.category) === 'restaurantes' ? ' · ' + m.category : ''}
                  {'cashback_pct' in m && m.cashback_pct != null ? ' · ' + m.cashback_pct + '% cashback' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button type="button" onClick={function () { props.onToggle(m.id, m.is_open); }} style={{ ...btn(abierto ? 'green' : 'danger'), padding: '6px 10px' }}>{abierto ? '● Abierto' : '○ Cerrado'}</button>
                <button type="button" onClick={function () { abrir(m); }} style={{ ...btn('ghost'), padding: '6px 10px' }}>Editar</button>
              </div>
            </div>
          );
        })}
      </div>

      {editando && (
        <Modal titulo={editando.id ? 'Editar negocio' : 'Nuevo negocio'} onClose={function () { setEditando(null); }}>
          {error && <Aviso tipo="error" texto={error} />}
          <Campo etiqueta="Nombre"><input value={editando.name} onChange={function (e) { setEditando({ ...editando, name: e.target.value }); }} style={inputStyle} /></Campo>
          <Campo etiqueta="Aparece en">
            <select value={editando.seccion} onChange={function (e) { setEditando({ ...editando, seccion: e.target.value as Seccion }); }} style={inputStyle}>
              <option value="restaurantes">Restaurantes</option>
              <option value="mandaditos">Mandaditos (pedido por escrito)</option>
              <option value="tiendita">Changui Súper</option>
            </select>
          </Campo>
          {editando.seccion === 'restaurantes' && (
            <Campo etiqueta="Tipo de comida" ayuda="Ej. hamburguesas, pizzas, tacos. Agrupa el negocio en su sección.">
              <input value={editando.cocina} onChange={function (e) { setEditando({ ...editando, cocina: e.target.value }); }} style={inputStyle} />
            </Campo>
          )}
          <Campo etiqueta="Descripción"><textarea rows={2} value={editando.description} onChange={function (e) { setEditando({ ...editando, description: e.target.value }); }} style={inputStyle} /></Campo>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Campo etiqueta="WhatsApp"><input value={editando.phone_number} onChange={function (e) { setEditando({ ...editando, phone_number: e.target.value }); }} style={inputStyle} /></Campo>
            <Campo etiqueta="Tiempo de entrega"><input value={editando.delivery_time} onChange={function (e) { setEditando({ ...editando, delivery_time: e.target.value }); }} style={inputStyle} /></Campo>
            <Campo etiqueta="Abre (HH:MM)"><input value={editando.hora_apertura} placeholder="09:00" onChange={function (e) { setEditando({ ...editando, hora_apertura: e.target.value }); }} style={inputStyle} /></Campo>
            <Campo etiqueta="Cierra (HH:MM)"><input value={editando.hora_cierre} placeholder="22:00" onChange={function (e) { setEditando({ ...editando, hora_cierre: e.target.value }); }} style={inputStyle} /></Campo>
          </div>
          {editando.soportaCashback ? (
            <Campo etiqueta="Cashback a clientes (%)" ayuda="Vacío = regla anterior (5% en Cubiertos, Atómica y Trípoli; 0% en los demás). Se acredita al marcar el pedido como entregado.">
              <input inputMode="decimal" value={editando.cashback_pct} onChange={function (e) { setEditando({ ...editando, cashback_pct: e.target.value }); }} style={inputStyle} />
            </Campo>
          ) : (
            <p style={{ fontSize: '11px', color: 'var(--color-yellow)', margin: '0 0 12px' }}>Para editar el cashback por negocio ejecuta supabase_admin_upgrade.sql en Supabase.</p>
          )}
          <Campo etiqueta="Foto del negocio"><PhotoPicker fotos={editando.fotos} max={1} carpeta="negocios" onChange={function (f) { setEditando({ ...editando, fotos: f }); }} /></Campo>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" style={btn('ghost')} onClick={function () { setEditando(null); }}>Cancelar</button>
            <button type="button" style={btn('primary')} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
