/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useMemo, useState } from 'react';
import { supabase } from '../App';
import { Aviso, Campo, Modal, btn, cardStyle, inputStyle } from './adminKit';

interface Merchant {
  id: string;
  name: string;
  category: string | null;
  description?: string | null;
  phone_number?: string | null;
  image_url?: string | null;
}

export default function AdminMandaditos(props: { merchants: Merchant[]; onCambio: () => void }) {
  const [editando, setEditando] = useState<Merchant | null>(null);
  const [categoria, setCategoria] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const mandaditos = useMemo(function () {
    return props.merchants.filter(function (m) {
      return String(m.category ?? '').toLowerCase().trim() === 'mandaditos';
    });
  }, [props.merchants]);
  const categoriasRestaurantes = useMemo(function () {
    const excluir = ['mandaditos', 'tiendita', 'changui super', 'changui súper', 'changuito super', 'changuito súper'];
    return Array.from(new Set(props.merchants
      .map(function (m) { return String(m.category ?? '').trim(); })
      .filter(function (c) { return c && !excluir.includes(c.toLowerCase()); })))
      .sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }, [props.merchants]);

  function abrir(m: Merchant) {
    setEditando(m);
    setCategoria('');
    setError('');
    setOk('');
  }

  async function enviarARestaurantes() {
    if (!editando) return;
    const nuevaCategoria = categoria.trim().toLowerCase();
    if (!nuevaCategoria) {
      setError('Escribe el tipo de comida para ubicar el negocio en Restaurantes.');
      return;
    }
    setGuardando(true);
    setError('');
    const { data, error: err } = await supabase
      .from('merchants')
      .update({ category: nuevaCategoria })
      .eq('id', editando.id)
      .select('id');
    setGuardando(false);
    if (err || !data?.length) {
      setError('No se pudo mover el negocio. ' + (err?.message ?? 'Sin permisos.'));
      return;
    }
    setEditando(null);
    setOk(editando.name + ' ahora aparecerá en Restaurantes.');
    props.onCambio();
  }

  return (
    <div>
      {error && !editando && <Aviso tipo="error" texto={error} />}
      {ok && <Aviso tipo="ok" texto={ok} />}
      <div style={{ ...cardStyle, padding: '14px', marginBottom: '14px' }}>
        <p style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 900 }}>
          Pedidos por escrito
        </p>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>
          Estos negocios reciben mandaditos, no manejan un catálogo de productos. Elige cuáles quieres mover a Restaurantes y asigna su tipo de comida.
        </p>
      </div>
      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {mandaditos.map(function (m) {
          return (
            <div key={m.id} style={{ ...cardStyle, padding: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', overflow: 'hidden', background: 'linear-gradient(135deg,#14532d,#15803d)', display: 'grid', placeItems: 'center', fontSize: '22px', flexShrink: 0 }}>
                {m.image_url ? <img src={m.image_url} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🛵'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{m.phone_number || 'Sin teléfono registrado'}</p>
              </div>
              <button type="button" style={{ ...btn('primary'), padding: '8px 10px' }} onClick={function () { abrir(m); }}>
                Elegir destino
              </button>
            </div>
          );
        })}
      </div>
      {mandaditos.length === 0 && (
        <div style={{ ...cardStyle, padding: '32px 16px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontSize: '28px' }}>🛵</p>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>No hay negocios en Mandaditos</p>
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Desde Restaurantes puedes editar un negocio y cambiarlo a Mandaditos.</p>
        </div>
      )}
      {editando && (
        <Modal titulo={'Destino de ' + editando.name} onClose={function () { setEditando(null); }}>
          <Campo etiqueta="Destino actual">
            <input value="Mandaditos · pedido por escrito" readOnly style={{ ...inputStyle, opacity: 0.75 }} />
          </Campo>
          <Campo etiqueta="Tipo de comida en Restaurantes" ayuda="Elige una categoría ya usada por los negocios que aparecen en Restaurantes.">
            {categoriasRestaurantes.length > 0 ? (
              <select value={categoria} onChange={function (e) { setCategoria(e.target.value); }} style={inputStyle}>
                <option value="">Selecciona una categoría</option>
                {categoriasRestaurantes.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
              </select>
            ) : (
              <input value={categoria} onChange={function (e) { setCategoria(e.target.value); }} placeholder="Ej. hamburguesas" style={inputStyle} />
            )}
          </Campo>
          {error && <Aviso tipo="error" texto={error} />}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" style={btn('ghost')} onClick={function () { setEditando(null); }}>Mantener en Mandaditos</button>
            <button type="button" style={btn('primary')} disabled={guardando} onClick={enviarARestaurantes}>
              {guardando ? 'Guardando…' : 'Mover a Restaurantes'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
