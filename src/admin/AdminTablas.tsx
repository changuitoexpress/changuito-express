/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../App';
import { Aviso, Campo, Modal, PhotoPicker, btn, cardStyle, inputStyle, splitFotos } from './adminKit';

type Tipo = 'texto' | 'largo' | 'numero' | 'bool' | 'foto' | 'fotos';
interface CampoCfg { clave: string; etiqueta: string; tipo: Tipo; requerido?: boolean }
interface TablaCfg {
  id: string; titulo: string; tabla: string; titleKey: string; subKey: string; fotoKey?: string;
  activoKey: string; activoValor: unknown; inactivoValor: unknown; orden: string; campos: CampoCfg[];
  valoresNuevos: Record<string, unknown>;
}

const TABLAS: TablaCfg[] = [
  {
    id: 'shopping', titulo: '🛍️ Changui Shopping', tabla: 'changuishopping', titleKey: 'nombre', subKey: 'categoria', fotoKey: 'fotos',
    activoKey: 'activo', activoValor: true, inactivoValor: false, orden: 'nombre', valoresNuevos: { activo: true, stock: 0, es_destacado: false },
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'largo' },
      { clave: 'precio', etiqueta: 'Precio', tipo: 'numero', requerido: true },
      { clave: 'precio_original', etiqueta: 'Precio anterior (tachado)', tipo: 'numero' },
      { clave: 'categoria', etiqueta: 'Categoría', tipo: 'texto', requerido: true },
      { clave: 'subcategoria', etiqueta: 'Subcategoría', tipo: 'texto' },
      { clave: 'stock', etiqueta: 'Stock', tipo: 'numero' },
      { clave: 'tiempo_entrega', etiqueta: 'Tiempo de entrega', tipo: 'texto' },
      { clave: 'proveedor', etiqueta: 'Proveedor', tipo: 'texto' },
      { clave: 'es_destacado', etiqueta: 'Producto destacado', tipo: 'bool' },
      { clave: 'activo', etiqueta: 'Visible en la app', tipo: 'bool' },
      { clave: 'fotos', etiqueta: 'Fotos', tipo: 'fotos' },
    ],
  },
  {
    id: 'servicios', titulo: '📇 Directorio de servicios', tabla: 'servicios', titleKey: 'nombre', subKey: 'categoria', fotoKey: 'imagen_url',
    activoKey: 'activo', activoValor: true, inactivoValor: false, orden: 'nombre', valoresNuevos: { activo: true, calificacion: 5 },
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { clave: 'categoria', etiqueta: 'Categoría', tipo: 'texto', requerido: true },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'largo' },
      { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'texto' },
      { clave: 'whatsapp', etiqueta: 'WhatsApp', tipo: 'texto' },
      { clave: 'calificacion', etiqueta: 'Calificación (0-5)', tipo: 'numero' },
      { clave: 'precio_desde', etiqueta: 'Precio desde', tipo: 'numero' },
      { clave: 'precio_hasta', etiqueta: 'Precio hasta', tipo: 'numero' },
      { clave: 'activo', etiqueta: 'Visible en la app', tipo: 'bool' },
      { clave: 'imagen_url', etiqueta: 'Foto', tipo: 'foto' },
    ],
  },
  {
    id: 'bazar', titulo: '🏷️ Bazar vecinal', tabla: 'bazar_items', titleKey: 'titulo', subKey: 'categoria',
    activoKey: 'estado', activoValor: 'activo', inactivoValor: 'inactivo', orden: 'created_at', valoresNuevos: { estado: 'activo', es_gratis: false },
    campos: [
      { clave: 'titulo', etiqueta: 'Título', tipo: 'texto', requerido: true },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'largo' },
      { clave: 'categoria', etiqueta: 'Categoría', tipo: 'texto' },
      { clave: 'precio', etiqueta: 'Precio', tipo: 'numero' },
      { clave: 'es_gratis', etiqueta: 'Es gratis', tipo: 'bool' },
      { clave: 'contacto_wa', etiqueta: 'WhatsApp de contacto', tipo: 'texto' },
    ],
  },
];

function valorInicial(c: CampoCfg, fila: any): any {
  const v = fila?.[c.clave];
  if (c.tipo === 'bool') return Boolean(v);
  if (c.tipo === 'fotos' || c.tipo === 'foto') return splitFotos(v);
  return v == null ? '' : String(v);
}

function aFila(cfg: TablaCfg, form: Record<string, any>, original: any): Record<string, unknown> | string {
  const fila: Record<string, unknown> = {};
  for (const c of cfg.campos) {
    const v = form[c.clave];
    if (c.tipo === 'bool') { fila[c.clave] = Boolean(v); continue; }
    if (c.tipo === 'fotos') { fila[c.clave] = (v as string[]).length > 0 ? v : null; continue; }
    if (c.tipo === 'foto') { fila[c.clave] = (v as string[])[0] ?? null; continue; }
    const t = String(v ?? '').trim();
    if (c.requerido && !t) return 'Falta: ' + c.etiqueta;
    if (c.tipo === 'numero') {
      if (t === '') { fila[c.clave] = null; continue; }
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) return 'Número inválido en: ' + c.etiqueta;
      fila[c.clave] = n;
    } else fila[c.clave] = t || null;
  }
  // Solo se envían columnas que la fila existente ya tiene (evita fallos si falta alguna).
  if (original) Object.keys(fila).forEach(function (k) { if (!(k in original)) delete fila[k]; });
  return fila;
}

function Editor(props: { cfg: TablaCfg }) {
  const cfg = props.cfg;
  const [filas, setFilas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<{ fila: any | null; form: Record<string, any> } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async function () {
    setCargando(true); setError('');
    const { data, error: err } = await supabase.from(cfg.tabla).select('*').order(cfg.orden, { ascending: cfg.orden === 'created_at' ? false : true }).limit(300);
    if (err) setError('No se pudo cargar: ' + err.message);
    setFilas(data ?? []); setCargando(false);
  }, [cfg]);
  useEffect(function () { setOk(''); setEditando(null); cargar(); }, [cargar]);

  function abrir(fila: any | null) {
    const form: Record<string, any> = {};
    cfg.campos.forEach(function (c) { form[c.clave] = fila ? valorInicial(c, fila) : (cfg.valoresNuevos[c.clave] ?? valorInicial(c, null)); });
    setError(''); setOk(''); setEditando({ fila, form });
  }

  async function guardar() {
    if (!editando) return;
    const fila = aFila(cfg, editando.form, editando.fila ?? (filas[0] ?? null));
    if (typeof fila === 'string') { setError(fila); return; }
    setGuardando(true); setError('');
    const resp = editando.fila
      ? await supabase.from(cfg.tabla).update(fila).eq('id', editando.fila.id).select('id')
      : await supabase.from(cfg.tabla).insert({ ...cfg.valoresNuevos, ...fila }).select('id');
    setGuardando(false);
    if (resp.error || !resp.data?.length) { setError('No se guardó: ' + (resp.error?.message ?? 'sin permisos. Ejecuta supabase_admin_upgrade.sql.')); return; }
    setEditando(null); setOk('Guardado.'); cargar();
  }

  async function alternar(f: any) {
    const activa = f[cfg.activoKey] === cfg.activoValor;
    const { data, error: err } = await supabase.from(cfg.tabla).update({ [cfg.activoKey]: activa ? cfg.inactivoValor : cfg.activoValor }).eq('id', f.id).select('id');
    if (err || !data?.length) { setError('No se pudo cambiar: ' + (err?.message ?? 'sin permisos.')); return; }
    cargar();
  }

  async function eliminar(f: any) {
    if (!window.confirm('¿Eliminar "' + f[cfg.titleKey] + '"? No se puede deshacer.')) return;
    const { data, error: err } = await supabase.from(cfg.tabla).delete().eq('id', f.id).select('id');
    if (err || !data?.length) { setError('No se pudo eliminar: ' + (err?.message ?? 'sin permisos.')); return; }
    setOk('Eliminado.'); cargar();
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(function (f) { return !q || String(f[cfg.titleKey] ?? '').toLowerCase().includes(q) || String(f[cfg.subKey] ?? '').toLowerCase().includes(q); });

  return (
    <div>
      {error && !editando && <Aviso tipo="error" texto={error} />}
      {ok && <Aviso tipo="ok" texto={ok} />}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input value={busqueda} onChange={function (e) { setBusqueda(e.target.value); }} placeholder="Buscar…" aria-label="Buscar" style={{ ...inputStyle, flex: 1, minWidth: '180px' }} />
        <button type="button" style={btn('primary')} onClick={function () { abrir(null); }}>+ Agregar</button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px' }}>{visibles.length} registros {cargando ? '· cargando…' : ''}</p>
      <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {visibles.map(function (f) {
          const activa = f[cfg.activoKey] === cfg.activoValor;
          const foto = cfg.fotoKey ? splitFotos(f[cfg.fotoKey])[0] : undefined;
          return (
            <div key={f.id} style={{ ...cardStyle, padding: '12px', display: 'flex', gap: '12px', opacity: activa ? 1 : 0.6 }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', background: '#F5F5F5', display: 'grid', placeItems: 'center', fontSize: '22px', flexShrink: 0 }}>
                {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🐒'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f[cfg.titleKey]}</p>
                <p style={{ margin: '2px 0 8px', fontSize: '11px', color: 'var(--text-muted)' }}>{f[cfg.subKey] ?? '—'}{f.precio != null ? ' · $' + f.precio : ''}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={function () { abrir(f); }}>Editar</button>
                  <button type="button" style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={function () { alternar(f); }}>{activa ? 'Ocultar' : 'Mostrar'}</button>
                  <button type="button" style={{ ...btn('danger'), padding: '6px 10px' }} onClick={function () { eliminar(f); }}>Eliminar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {editando && (
        <Modal titulo={editando.fila ? 'Editar' : 'Agregar'} onClose={function () { setEditando(null); }}>
          {error && <Aviso tipo="error" texto={error} />}
          {cfg.campos.map(function (c) {
            const v = editando.form[c.clave];
            const set = function (nv: any) { setEditando({ ...editando, form: { ...editando.form, [c.clave]: nv } }); };
            if (c.tipo === 'bool') return (
              <label key={c.clave} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                <input type="checkbox" checked={Boolean(v)} onChange={function (e) { set(e.target.checked); }} /> {c.etiqueta}
              </label>
            );
            if (c.tipo === 'foto' || c.tipo === 'fotos') return (
              <Campo key={c.clave} etiqueta={c.etiqueta}><PhotoPicker fotos={v} max={c.tipo === 'foto' ? 1 : 6} carpeta={cfg.id} onChange={set} /></Campo>
            );
            return (
              <Campo key={c.clave} etiqueta={c.etiqueta + (c.requerido ? ' *' : '')}>
                {c.tipo === 'largo'
                  ? <textarea rows={3} value={v} onChange={function (e) { set(e.target.value); }} style={inputStyle} />
                  : <input inputMode={c.tipo === 'numero' ? 'decimal' : undefined} value={v} onChange={function (e) { set(e.target.value); }} style={inputStyle} />}
              </Campo>
            );
          })}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" style={btn('ghost')} onClick={function () { setEditando(null); }}>Cancelar</button>
            <button type="button" style={btn('primary')} disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AdminTablas() {
  const [id, setId] = useState(TABLAS[0].id);
  const cfg = TABLAS.find(function (t) { return t.id === id; }) ?? TABLAS[0];
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {TABLAS.map(function (t) {
          return <button key={t.id} type="button" style={{ ...btn(t.id === id ? 'primary' : 'ghost'), padding: '8px 14px' }} onClick={function () { setId(t.id); }}>{t.titulo}</button>;
        })}
      </div>
      <Editor key={cfg.id} cfg={cfg} />
    </div>
  );
}
