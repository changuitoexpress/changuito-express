/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../App';
import { Aviso, Campo, Modal, PhotoPicker, btn, cardStyle, inputStyle, mxn, splitFotos } from './adminKit';

interface Producto {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean | null;
}

interface Borrador {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: string;
  is_available: boolean;
  fotos: string[];
}

const vacio: Borrador = { name: '', description: '', price: '', category: '', is_available: true, fotos: [] };

export default function AdminCatalogo(props: { merchants: any[] }) {
  const [merchantId, setMerchantId] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [pct, setPct] = useState('');

  useEffect(function () {
    if (!merchantId && props.merchants.length > 0) setMerchantId(String(props.merchants[0].id));
  }, [props.merchants, merchantId]);

  const cargar = useCallback(async function () {
    if (!merchantId) return;
    setCargando(true); setError('');
    const { data, error: err } = await supabase
      .from('products').select('id, merchant_id, name, description, price, image_url, category, is_available')
      .eq('merchant_id', merchantId).order('category').order('name');
    if (err) setError('No se pudieron cargar los productos: ' + err.message);
    setProductos((data ?? []) as Producto[]);
    setCargando(false);
  }, [merchantId]);

  useEffect(function () { cargar(); }, [cargar]);

  async function guardar() {
    if (!editando) return;
    const precio = Number(editando.price);
    if (!editando.name.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!Number.isFinite(precio) || precio < 0) { setError('Escribe un precio válido.'); return; }
    setGuardando(true); setError('');
    const fila = {
      name: editando.name.trim(),
      description: editando.description.trim() || null,
      price: precio,
      category: editando.category.trim() || null,
      is_available: editando.is_available,
      image_url: editando.fotos.length > 0 ? editando.fotos.join(',') : null,
    };
    const resp = editando.id
      ? await supabase.from('products').update(fila).eq('id', editando.id).select('id')
      : await supabase.from('products').insert({ ...fila, merchant_id: merchantId }).select('id');
    setGuardando(false);
    if (resp.error || !resp.data || resp.data.length === 0) {
      setError('No se guardó. ' + (resp.error?.message ?? 'Sin permisos: ejecuta supabase_admin_upgrade.sql en Supabase.'));
      return;
    }
    setEditando(null); setOk('Producto guardado.'); cargar();
  }

  async function alternar(p: Producto) {
    const { data, error: err } = await supabase.from('products').update({ is_available: !(p.is_available ?? true) }).eq('id', p.id).select('id');
    if (err || !data?.length) { setError('No se pudo cambiar la disponibilidad. ' + (err?.message ?? 'Sin permisos.')); return; }
    cargar();
  }

  async function eliminar(p: Producto) {
    if (!window.confirm('¿Eliminar "' + p.name + '"? Esta acción no se puede deshacer.')) return;
    const { data, error: err } = await supabase.from('products').delete().eq('id', p.id).select('id');
    if (err || !data?.length) { setError('No se pudo eliminar. ' + (err?.message ?? 'Sin permisos.')); return; }
    setOk('Producto eliminado.'); cargar();
  }

  async function ajustarPrecios() {
    const factor = Number(pct);
    if (!Number.isFinite(factor) || factor === 0 || factor < -90 || factor > 200) { setError('Escribe un porcentaje entre -90 y 200.'); return; }
    const visibles = productos.filter(coincide);
    if (!window.confirm('¿Cambiar ' + visibles.length + ' precios ' + (factor > 0 ? '+' : '') + factor + '%?')) return;
    setError('');
    for (const p of visibles) {
      const nuevo = Math.max(0, Math.round(Number(p.price) * (1 + factor / 100) * 100) / 100);
      const { error: err } = await supabase.from('products').update({ price: nuevo }).eq('id', p.id);
      if (err) { setError('Se detuvo en "' + p.name + '": ' + err.message); cargar(); return; }
    }
    setPct(''); setOk('Precios actualizados.'); cargar();
  }

  function coincide(p: Producto) {
    const q = busqueda.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q);
  }

  const visibles = productos.filter(coincide);
  const negocio = props.merchants.find(function (m) { return String(m.id) === merchantId; });

  return (
    <div>
      {error && <Aviso tipo="error" texto={error} />}
      {ok && <Aviso tipo="ok" texto={ok} />}
      <div style={{ ...cardStyle, padding: '14px', marginBottom: '14px', display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', alignItems: 'end' }}>
        <Campo etiqueta="Negocio">
          <select value={merchantId} onChange={function (e) { setMerchantId(e.target.value); setOk(''); }} style={inputStyle}>
            {props.merchants.map(function (m) {
              return <option key={m.id} value={m.id}>{m.name} · {m.category}</option>;
            })}
          </select>
        </Campo>
        <Campo etiqueta="Buscar producto">
          <input value={busqueda} onChange={function (e) { setBusqueda(e.target.value); }} placeholder="Nombre o categoría" style={inputStyle} />
        </Campo>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input value={pct} onChange={function (e) { setPct(e.target.value); }} inputMode="decimal" placeholder="% precios" aria-label="Porcentaje de ajuste de precios" style={{ ...inputStyle, width: '96px' }} />
          <button type="button" style={btn('ghost')} onClick={ajustarPrecios}>Ajustar</button>
          <button type="button" style={btn('primary')} onClick={function () { setEditando({ ...vacio }); setError(''); setOk(''); }}>+ Producto</button>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>
        {negocio?.name ?? 'Negocio'} · {visibles.length} productos {cargando ? '· cargando…' : ''}
      </p>

      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {visibles.map(function (p) {
          const fotos = splitFotos(p.image_url);
          const disponible = p.is_available ?? true;
          return (
            <div key={p.id} style={{ ...cardStyle, padding: '12px', display: 'flex', gap: '12px', opacity: disponible ? 1 : 0.6 }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: '#F5F5F5', display: 'grid', placeItems: 'center', fontSize: '26px' }}>
                {fotos[0] ? <img src={fotos[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🐒'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                <p style={{ margin: '2px 0 6px', fontSize: '11px', color: 'var(--text-muted)' }}>{p.category ?? 'Sin categoría'} · {fotos.length} foto(s)</p>
                <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 900, color: 'var(--color-green)' }}>{mxn(Number(p.price))}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={function () {
                    setEditando({ id: p.id, name: p.name, description: p.description ?? '', price: String(p.price), category: p.category ?? '', is_available: disponible, fotos: fotos });
                    setError(''); setOk('');
                  }}>Editar</button>
                  <button type="button" style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={function () { alternar(p); }}>{disponible ? 'Pausar' : 'Activar'}</button>
                  <button type="button" style={{ ...btn('danger'), padding: '6px 10px' }} onClick={function () { eliminar(p); }}>Eliminar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editando && (
        <Modal titulo={editando.id ? 'Editar producto' : 'Nuevo producto'} onClose={function () { setEditando(null); }}>
          <Campo etiqueta="Nombre"><input value={editando.name} onChange={function (e) { setEditando({ ...editando, name: e.target.value }); }} style={inputStyle} /></Campo>
          <Campo etiqueta="Descripción"><textarea rows={3} value={editando.description} onChange={function (e) { setEditando({ ...editando, description: e.target.value }); }} style={inputStyle} /></Campo>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Campo etiqueta="Precio (MXN)"><input inputMode="decimal" value={editando.price} onChange={function (e) { setEditando({ ...editando, price: e.target.value }); }} style={inputStyle} /></Campo>
            <Campo etiqueta="Categoría"><input value={editando.category} onChange={function (e) { setEditando({ ...editando, category: e.target.value }); }} style={inputStyle} /></Campo>
          </div>
          <Campo etiqueta="Fotos" ayuda="Con más de una foto el cliente verá un carrusel. Sin fotos se muestra el 🐒.">
            <PhotoPicker fotos={editando.fotos} carpeta={'productos/' + merchantId} onChange={function (f) { setEditando({ ...editando, fotos: f }); }} />
          </Campo>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            <input type="checkbox" checked={editando.is_available} onChange={function (e) { setEditando({ ...editando, is_available: e.target.checked }); }} /> Disponible para pedir
          </label>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" style={btn('ghost')} onClick={function () { setEditando(null); }}>Cancelar</button>
            <button type="button" style={btn('primary')} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
