/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState } from 'react';
import { supabase } from '../App';

export const mxn = function (n: number): string {
  return '$' + (Math.round(n * 100) / 100).toLocaleString('es-MX', { maximumFractionDigits: 2 });
};

export const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: '12px',
  border: '1px solid var(--border-medium)', background: 'var(--bg-base)',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'inherit',
};

export const cardStyle: React.CSSProperties = {
  borderRadius: '18px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  boxShadow: 'var(--shadow-card)',
};

export function btn(kind: 'primary' | 'ghost' | 'danger' | 'green'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 800,
    cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
  };
  if (kind === 'primary') return { ...base, background: 'linear-gradient(135deg,#F6C945,#E8A81E)', color: '#1c1400' };
  if (kind === 'green') return { ...base, background: 'var(--color-green)', color: '#fff' };
  if (kind === 'danger') return { ...base, background: 'var(--color-red-dim)', color: 'var(--color-red)' };
  return { ...base, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' };
}

/** Convierte image_url (texto con varias URLs separadas por coma) en lista. */
export function splitFotos(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String).filter(Boolean);
  if (typeof valor !== 'string') return [];
  const t = valor.trim();
  if (!t || t.toLowerCase() === 'null') return [];
  return t.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

export async function subirFotos(archivos: File[], carpeta: string): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < archivos.length; i++) {
    const a = archivos[i];
    const ext = (a.name.split('.').pop() ?? 'jpg').toLowerCase();
    const ruta = carpeta + '/' + Date.now() + '_' + i + '.' + ext;
    const { data, error } = await supabase.storage
      .from('changuito-fotos')
      .upload(ruta, a, { cacheControl: '3600', upsert: false });
    if (error || !data) throw new Error('No se pudo subir la foto: ' + (error?.message ?? 'error desconocido'));
    urls.push(supabase.storage.from('changuito-fotos').getPublicUrl(data.path).data.publicUrl);
  }
  return urls;
}

export function PhotoPicker(props: { fotos: string[]; carpeta: string; onChange: (f: string[]) => void; max?: number }) {
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState('');
  const max = props.max ?? 6;
  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - props.fotos.length);
    e.target.value = '';
    if (files.length === 0) return;
    setSubiendo(true); setErr('');
    try {
      const nuevas = await subirFotos(files, props.carpeta);
      props.onChange(props.fotos.concat(nuevas));
    } catch (ex: any) { setErr(ex.message); }
    finally { setSubiendo(false); }
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {props.fotos.map(function (url, i) {
          return (
            <div key={url + i} style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
              <img src={url} alt={'Foto ' + (i + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" aria-label="Quitar foto" onClick={function () { props.onChange(props.fotos.filter(function (_, k) { return k !== i; })); }}
                style={{ position: 'absolute', top: '3px', right: '3px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.65)', color: '#fff', fontSize: '12px', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          );
        })}
        {props.fotos.length < max && (
          <label style={{ width: '72px', height: '72px', borderRadius: '12px', border: '2px dashed var(--border-medium)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
            {subiendo ? '...' : '+ Foto'}
            <input type="file" accept="image/*" multiple onChange={elegir} style={{ display: 'none' }} />
          </label>
        )}
      </div>
      {err && <p style={{ fontSize: '11px', color: 'var(--color-red)', margin: '6px 0 0' }}>{err}</p>}
    </div>
  );
}

export function Modal(props: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={props.titulo}
      onClick={props.onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(5,12,20,.62)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={function (e) { e.stopPropagation(); }}
        style={{ ...cardStyle, width: '100%', maxWidth: '520px', maxHeight: '90dvh', overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>{props.titulo}</h3>
          <button type="button" onClick={props.onClose} aria-label="Cerrar" style={{ ...btn('ghost'), padding: '6px 12px' }}>✕</button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Campo(props: { etiqueta: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: '12px' }}>
      <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: '5px' }}>{props.etiqueta}</span>
      {props.children}
      {props.ayuda && <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{props.ayuda}</span>}
    </label>
  );
}

export function Aviso(props: { tipo: 'error' | 'ok'; texto: string }) {
  const ok = props.tipo === 'ok';
  return (
    <div role={ok ? 'status' : 'alert'} style={{ padding: '10px 14px', borderRadius: '12px', marginBottom: '12px', background: ok ? 'var(--color-green-dim)' : 'var(--color-red-dim)', border: '1px solid ' + (ok ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)') }}>
      <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: ok ? 'var(--color-green)' : 'var(--color-red)' }}>{props.texto}</p>
    </div>
  );
}
