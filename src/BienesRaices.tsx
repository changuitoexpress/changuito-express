/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Phone, RefreshCw, X, MapPin, DollarSign } from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';

interface Inmueble {
  id:             string;
  vendedor_id:    string;
  vendedor_email: string;
  titulo:         string;
  descripcion:    string | null;
  precio:         number | null;
  categoria:      string;
  fotos:          string[] | null;
  estado:         string;
  es_gratis:      boolean;
  contacto_wa:    string | null;
  cluster:        string | null;
  created_at:     string;
}

interface Props {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onVolver:      () => void;
}

const TIPOS_INMUEBLE = [
  { id: 'todos',   label: 'Todos' },
  { id: 'casa',    label: 'Casas' },
  { id: 'depa',    label: 'Depas' },
  { id: 'terreno', label: 'Terrenos' },
  { id: 'local',   label: 'Locales' },
];

export default function BienesRaices(props: Props) {
  const [items, setItems]         = useState<Inmueble[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [tipo, setTipo]           = useState('todos');
  const [search, setSearch]       = useState('');
  const [modalAbierto, setModal]  = useState(false);
  const [form, setForm]           = useState({ titulo: '', descripcion: '', precio: '', contacto_wa: '', tipo_sub: 'casa' });
  const [guardando, setGuardando] = useState(false);

  const isDark      = props.theme === 'dark';
  const rol         = props.session.user.rol ?? 'cliente';
  const puedePublicar = rol === 'admin' || rol === 'admin_inmuebles' || rol === 'admin_bazar';

  const fetchItems = useCallback(async function() {
    setLoading(true); setError('');
    try {
      const { data, error: err } = await supabase
        .from('bazar_items')
        .select('*')
        .eq('categoria', 'inmuebles')
        .eq('estado', 'activo')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setItems(data ?? []);
    } catch(e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(function() { fetchItems(); }, [fetchItems]);

  async function publicar() {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    try {
      const precio = parseFloat(form.precio) || null;
      const { error: err } = await supabase.from('bazar_items').insert({
        vendedor_id:    props.session.user.id,
        vendedor_email: props.session.user.email ?? '',
        titulo:         form.titulo.trim(),
        descripcion:    form.descripcion.trim() || null,
        precio:         precio,
        categoria:      'inmuebles',
        fotos:          null,
        estado:         'activo',
        es_gratis:      !precio,
        contacto_wa:    form.contacto_wa.trim() || null,
        cluster:        null,
      });
      if (err) throw err;
      setModal(false);
      setForm({ titulo: '', descripcion: '', precio: '', contacto_wa: '', tipo_sub: 'casa' });
      fetchItems();
    } catch(e: any) { alert('Error: ' + e.message); }
    finally { setGuardando(false); }
  }

  const filtered = items.filter(function(it) {
    const matchSearch = !search || it.titulo.toLowerCase().includes(search.toLowerCase()) || (it.descripcion ?? '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

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
              <p style={{ fontSize: '10px', color: 'var(--color-yellow)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>🏠 Clasificados</p>
              <h1 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Bienes Raíces</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={fetchItems}
              style={{ width: '36px', height: '36px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <RefreshCw style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            </button>
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <input
            value={search} onChange={function(e) { setSearch(e.target.value); }}
            placeholder="Buscar inmuebles..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
          {search && (
            <button onClick={function() { setSearch(''); }}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}>
              <X style={{ width: '15px', height: '15px', color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>

        {/* Filtros tipo */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TIPOS_INMUEBLE.map(function(t) {
            const activo = tipo === t.id;
            return (
              <button key={t.id} onClick={function() { setTipo(t.id); }}
                style={{ padding: '6px 14px', borderRadius: '20px', border: activo ? 'none' : '1px solid var(--border-subtle)', background: activo ? 'var(--color-yellow)' : 'transparent', color: activo ? '#020617' : 'var(--text-muted)', fontSize: '11px', fontWeight: activo ? 800 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '16px', paddingBottom: '100px' }}>
        {error && (
          <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--color-red-dim)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--color-red)', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Banner */}
        <div style={{ padding: '18px', borderRadius: '18px', background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-16px', top: '-16px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <p style={{ fontSize: '22px', margin: '0 0 4px 0' }}>🏠</p>
          <p style={{ fontSize: '16px', fontWeight: 900, color: '#fff', margin: '0 0 4px 0' }}>Bienes Raíces</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>Lomas 1, 2, 3 & La Vista · {items.length} propiedades</p>
        </div>

        {/* Loading skeletons */}
        {loading && [1,2,3].map(function(i) {
          return (
            <div key={i} style={{ borderRadius: '16px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: '10px', display: 'flex', gap: '12px' }}>
              <div className="skeleton" style={{ width: '64px', height: '64px', borderRadius: '12px', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                <div className="skeleton" style={{ height: '13px', width: '70%' }} />
                <div className="skeleton" style={{ height: '11px', width: '50%' }} />
                <div className="skeleton" style={{ height: '10px', width: '40%' }} />
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ fontSize: '48px', margin: '0 0 12px 0' }}>🏚️</p>
            <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Sin propiedades</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>{search ? 'Intenta con otra búsqueda' : 'Sé el primero en publicar'}</p>
          </div>
        )}

        {!loading && filtered.map(function(it) {
          return (
            <div key={it.id} style={{ borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
              {it.fotos && it.fotos[0] && (
                <img src={it.fotos[0]} alt={it.titulo}
                  style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
              )}
              {(!it.fotos || !it.fotos[0]) && (
                <div style={{ width: '100%', height: '120px', background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>
                  🏠
                </div>
              )}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{it.titulo}</p>
                  {it.precio ? (
                    <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--color-yellow)', whiteSpace: 'nowrap' }}>
                      ${it.precio.toLocaleString('es-MX')}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-green)', padding: '2px 8px', borderRadius: '8px', background: 'var(--color-green-dim)', whiteSpace: 'nowrap' }}>GRATIS</span>
                  )}
                </div>
                {it.descripcion && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.5 }}>{it.descripcion}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <MapPin style={{ width: '12px', height: '12px', color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {it.cluster ?? 'Lomas / La Vista'} · {new Date(it.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {it.contacto_wa && (
                  <a href={'https://wa.me/' + it.contacto_wa.replace(/\D/g,'') + '?text=' + encodeURIComponent('Hola, vi tu propiedad en Changuito Express: ' + it.titulo)}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '12px', background: '#25d366', color: '#fff', fontSize: '12px', fontWeight: 800, textDecoration: 'none' }}>
                    <Phone style={{ width: '14px', height: '14px' }} />
                    Contactar por WhatsApp
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAB publicar */}
      {puedePublicar && (
        <button onClick={function() { setModal(true); }}
          style={{ position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', borderRadius: '18px', background: 'var(--color-yellow)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(250,204,21,0.4)', zIndex: 100 }}>
          <Plus style={{ width: '24px', height: '24px', color: '#020617' }} />
        </button>
      )}

      {/* Modal publicar */}
      {modalAbierto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={function() { setModal(false); }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto', background: 'var(--bg-card)', borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', zIndex: 301 }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border-medium)', margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 20px 0' }}>📝 Publicar propiedad</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Título *', key: 'titulo', ph: 'Casa en venta, 3 recámaras...' },
                { label: 'Descripción', key: 'descripcion', ph: 'Detalles de la propiedad...' },
                { label: 'Precio ($)', key: 'precio', ph: '0 para publicar como GRATIS' },
                { label: 'WhatsApp (solo números)', key: 'contacto_wa', ph: '522221234567' },
              ].map(function(f) {
                return (
                  <div key={f.key}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>{f.label}</label>
                    <input value={(form as any)[f.key]} placeholder={f.ph}
                      onChange={function(e) { setForm(function(prev) { return { ...prev, [f.key]: e.target.value }; }); }}
                      style={{ width: '100%', padding: '11px 13px', borderRadius: '12px', border: '1px solid var(--border-medium)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                );
              })}
            </div>
            <button onClick={publicar} disabled={guardando || !form.titulo.trim()}
              style={{ width: '100%', marginTop: '20px', background: !form.titulo.trim() ? 'var(--border-subtle)' : 'var(--color-yellow)', color: !form.titulo.trim() ? 'var(--text-muted)' : '#020617', fontWeight: 900, fontSize: '14px', padding: '15px', borderRadius: '14px', border: 'none', cursor: !form.titulo.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {guardando ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : '🏠 Publicar propiedad'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
