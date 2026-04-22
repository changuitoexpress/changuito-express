/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Search, X, Camera, Star, Tag, Package, Home, Car, Shirt, BookOpen, Smartphone, WifiOff, RefreshCw } from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface BazarItem {
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

interface BazarProps {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onVolver:      () => void;
}

// ─── Categorías ───────────────────────────────────────────────────────────────
const CATEGORIAS = [
  { id:'todos',       label:'Todos',        Icon: Package  },
  { id:'inmuebles',   label:'Inmuebles',    Icon: Home     },
  { id:'autos',       label:'Autos',        Icon: Car      },
  { id:'ropa',        label:'Ropa',         Icon: Shirt    },
  { id:'tecnologia',  label:'Tecnología',   Icon: Smartphone },
  { id:'libros',      label:'Libros',       Icon: BookOpen },
  { id:'general',     label:'General',      Icon: Tag      },
];

const EMOJI_CAT: Record<string, string> = {
  inmuebles:'🏠', autos:'🚗', ropa:'👗', tecnologia:'📱', libros:'📚', general:'📦',
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function BazarVecinal(props: BazarProps) {
  const [items, setItems]               = useState<BazarItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [catActiva, setCatActiva]       = useState('todos');
  const [search, setSearch]             = useState('');
  const [modalPublicar, setModalPublicar] = useState(false);

  const isDark   = props.theme === 'dark';
  const miId     = props.session.user.id;
  const miEmail  = props.session.user.email ?? '';

  const fetchItems = useCallback(async function() {
    setLoading(true); setError('');
    try {
      let q = supabase.from('bazar_items').select('*').eq('estado','activo').order('created_at',{ascending:false});
      if (catActiva !== 'todos') q = q.eq('categoria', catActiva);
      const { data, error: err } = await q;
      if (err) throw err;
      setItems(data ?? []);
    } catch(e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [catActiva]);

  useEffect(function(){ fetchItems(); }, [fetchItems]);

  const filtrados = search.trim() === '' ? items : items.filter(function(i){
    return i.titulo.toLowerCase().includes(search.toLowerCase());
  });

  const card = isDark ? '#16161e' : '#ffffff';
  const base = 'var(--bg-base)';

  return (
    <div style={{ minHeight:'100vh', background:base, color:'var(--text-primary)', fontFamily:'system-ui,sans-serif', maxWidth:'480px', margin:'0 auto' }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--bg-nav)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', padding:'14px 16px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={props.onVolver} style={{ width:'36px', height:'36px', borderRadius:'12px', background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <ArrowLeft style={{ width:'18px', height:'18px', color:'var(--text-primary)' }} />
            </button>
            <div>
              <p style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>Residentes Lomas</p>
              <h1 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:0 }}>🛍️ Bazar Vecinal</h1>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <button onClick={function(){ setModalPublicar(true); }} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', borderRadius:'12px', background:'var(--color-green)', border:'none', color:'white', fontSize:'12px', fontWeight:800, cursor:'pointer' }}>
              <Plus style={{ width:'14px', height:'14px' }} /> Publicar
            </button>
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>

        {/* Búsqueda */}
        <div style={{ position:'relative', marginBottom:'12px' }}>
          <Search style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)', width:'15px', height:'15px', color:'var(--text-muted)', pointerEvents:'none' }} />
          <input type="text" placeholder="Buscar en el bazar..." value={search}
            onChange={function(e){ setSearch(e.target.value); }}
            style={{ width:'100%', boxSizing:'border-box', background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)', border:`1px solid var(--border-subtle)`, borderRadius:'14px', padding:'10px 10px 10px 36px', color:'var(--text-primary)', fontSize:'13px', outline:'none' }} />
          {search && <button onClick={function(){ setSearch(''); }} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer' }}>
            <X style={{ width:'14px', height:'14px', color:'var(--text-muted)' }} />
          </button>}
        </div>

        {/* Filtros */}
        <div style={{ overflowX:'auto', display:'flex', gap:'8px', paddingBottom:'2px', scrollbarWidth:'none' }}>
          {CATEGORIAS.map(function(cat){
            const activa = catActiva === cat.id;
            return (
              <button key={cat.id} onClick={function(){ setCatActiva(cat.id); }}
                style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 14px', borderRadius:'20px', border:activa?'none':`1px solid var(--border-subtle)`, background:activa?'var(--color-green)':'transparent', color:activa?'white':'var(--text-muted)', fontSize:'12px', fontWeight:activa?800:500, cursor:'pointer', whiteSpace:'nowrap', boxShadow:activa?'0 4px 12px rgba(34,197,94,0.3)':'none' }}>
                <cat.Icon style={{ width:'12px', height:'12px' }} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding:'16px', paddingBottom:'40px' }}>
        {loading && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {[1,2,3,4].map(function(i){
              return <div key={i} style={{ borderRadius:'18px', overflow:'hidden', background:card, border:'1px solid var(--border-subtle)' }}>
                <div className="skeleton" style={{ height:'140px' }} />
                <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  <div className="skeleton" style={{ height:'12px', width:'80%' }} />
                  <div className="skeleton" style={{ height:'14px', width:'40%' }} />
                </div>
              </div>;
            })}
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign:'center', padding:'48px 24px' }}>
            <WifiOff style={{ width:'36px', height:'36px', color:'var(--text-muted)', margin:'0 auto 12px' }} />
            <p style={{ color:'var(--text-muted)', marginBottom:'12px' }}>{error}</p>
            <button onClick={fetchItems} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'10px 20px', borderRadius:'12px', background:'var(--color-green-dim)', border:'1px solid rgba(34,197,94,0.3)', color:'var(--color-green)', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
              <RefreshCw style={{ width:'13px', height:'13px' }} /> Reintentar
            </button>
          </div>
        )}

        {!loading && !error && filtrados.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 24px' }}>
            <span style={{ fontSize:'48px', display:'block', marginBottom:'16px' }}>🛍️</span>
            <p style={{ fontSize:'16px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px 0' }}>Sin publicaciones</p>
            <p style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'20px' }}>Sé el primero en publicar algo</p>
            <button onClick={function(){ setModalPublicar(true); }} style={{ padding:'12px 24px', borderRadius:'14px', background:'var(--color-green)', color:'white', fontWeight:800, fontSize:'13px', border:'none', cursor:'pointer' }}>
              + Publicar algo
            </button>
          </div>
        )}

        {!loading && !error && filtrados.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {filtrados.map(function(item){
              const esMio = item.vendedor_id === miId;
              return (
                <div key={item.id} style={{ borderRadius:'18px', overflow:'hidden', background:card, border:`1px solid var(--border-subtle)`, boxShadow:'var(--shadow-card)', cursor:'pointer' }}>
                  {/* Imagen/emoji */}
                  <div style={{ height:'140px', background:'linear-gradient(135deg,#14532d,#15803d)', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'48px', overflow:'hidden' }}>
                    {item.fotos && item.fotos.length > 0
                      ? <img src={item.fotos[0]} alt={item.titulo} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <span style={{ opacity:0.5 }}>{EMOJI_CAT[item.categoria] ?? '📦'}</span>
                    }
                    {item.es_gratis && (
                      <div style={{ position:'absolute', top:'8px', left:'8px', padding:'3px 8px', borderRadius:'8px', background:'var(--color-green)', color:'white', fontSize:'9px', fontWeight:900, textTransform:'uppercase' }}>GRATIS</div>
                    )}
                    {esMio && (
                      <div style={{ position:'absolute', top:'8px', right:'8px', padding:'3px 8px', borderRadius:'8px', background:'var(--color-yellow)', color:'#020617', fontSize:'9px', fontWeight:900 }}>TU ANUNCIO</div>
                    )}
                  </div>
                  <div style={{ padding:'12px' }}>
                    <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 4px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.titulo}</p>
                    {item.descripcion && <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 8px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.descripcion}</p>}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'15px', fontWeight:900, color: item.es_gratis ? 'var(--color-green)' : 'var(--color-yellow)' }}>
                        {item.es_gratis ? '¡Gratis!' : item.precio ? '$' + item.precio.toLocaleString('es-MX') : 'A negociar'}
                      </span>
                      {item.contacto_wa && (
                        <a href={'https://wa.me/' + item.contacto_wa.replace(/\D/g,'')} target="_blank" rel="noreferrer"
                          style={{ padding:'5px 10px', borderRadius:'8px', background:'rgba(37,211,102,0.15)', color:'#25D366', fontSize:'10px', fontWeight:800, textDecoration:'none' }}
                          onClick={function(e){ e.stopPropagation(); }}>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Publicar */}
      {modalPublicar && (
        <ModalPublicar
          theme={props.theme}
          vendedorId={miId}
          vendedorEmail={miEmail}
          onClose={function(){ setModalPublicar(false); }}
          onPublicado={function(){ setModalPublicar(false); fetchItems(); }}
        />
      )}
    </div>
  );
}

// ─── Modal Publicar ───────────────────────────────────────────────────────────
function ModalPublicar(props: {
  theme: Theme; vendedorId: string; vendedorEmail: string;
  onClose: () => void; onPublicado: () => void;
}) {
  const [titulo, setTitulo]           = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio]           = useState('');
  const [categoria, setCategoria]     = useState('general');
  const [esGratis, setEsGratis]       = useState(false);
  const [contactoWa, setContactoWa]   = useState('');
  const [enviando, setEnviando]       = useState(false);
  const [error, setError]             = useState('');
  const isDark = props.theme === 'dark';

  async function publicar() {
    if (!titulo) { setError('El título es obligatorio.'); return; }
    setEnviando(true); setError('');
    try {
      const { error: err } = await supabase.from('bazar_items').insert({
        vendedor_id:    props.vendedorId,
        vendedor_email: props.vendedorEmail,
        titulo, descripcion, categoria,
        precio:      esGratis ? null : (precio ? parseFloat(precio) : null),
        es_gratis:   esGratis,
        contacto_wa: contactoWa || null,
      });
      if (err) throw err;
      props.onPublicado();
    } catch(e: any) { setError(e.message); }
    finally { setEnviando(false); }
  }

  const inputStyle: React.CSSProperties = { width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:'12px', border:'1px solid var(--border-subtle)', background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)', color:'var(--text-primary)', fontSize:'13px', outline:'none' };
  const labelStyle: React.CSSProperties = { fontSize:'11px', fontWeight:700, color:'var(--text-muted)', margin:'0 0 4px 0', display:'block' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:500, display:'flex', alignItems:'flex-end' }} onClick={props.onClose}>
      <div style={{ width:'100%', maxWidth:'480px', margin:'0 auto', background:'var(--bg-card)', borderRadius:'28px 28px 0 0', padding:'24px 20px 40px', maxHeight:'90vh', overflowY:'auto' }}
        onClick={function(e){ e.stopPropagation(); }}>
        <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-medium)', margin:'0 auto 20px' }} />
        <h2 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:'0 0 20px 0' }}>📢 Nueva Publicación</h2>

        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={labelStyle}>Título *</label>
            <input value={titulo} onChange={function(e){ setTitulo(e.target.value); }} placeholder="¿Qué vendes?" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Descripción</label>
            <textarea value={descripcion} onChange={function(e){ setDescripcion(e.target.value); }} placeholder="Descripción, estado del artículo..." rows={3}
              style={{ ...inputStyle, resize:'none', fontFamily:'system-ui,sans-serif' }} />
          </div>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select value={categoria} onChange={function(e){ setCategoria(e.target.value); }} style={{ ...inputStyle }}>
              <option value="general">General</option>
              <option value="inmuebles">Inmuebles</option>
              <option value="autos">Autos</option>
              <option value="ropa">Ropa y accesorios</option>
              <option value="tecnologia">Tecnología</option>
              <option value="libros">Libros</option>
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
              <input type="checkbox" checked={esGratis} onChange={function(e){ setEsGratis(e.target.checked); }} />
              <span style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:600 }}>Es gratis</span>
            </label>
          </div>
          {!esGratis && (
            <div>
              <label style={labelStyle}>Precio (MXN)</label>
              <input type="number" value={precio} onChange={function(e){ setPrecio(e.target.value); }} placeholder="0.00" style={inputStyle} />
            </div>
          )}
          <div>
            <label style={labelStyle}>Tu WhatsApp (para contacto)</label>
            <input value={contactoWa} onChange={function(e){ setContactoWa(e.target.value); }} placeholder="52222XXXXXXX" style={inputStyle} />
          </div>
        </div>

        {error && <p style={{ fontSize:'12px', color:'var(--color-red)', margin:'12px 0 0 0' }}>{error}</p>}

        <button onClick={publicar} disabled={enviando} style={{ width:'100%', marginTop:'20px', background:enviando?'rgba(34,197,94,0.5)':'var(--color-green)', color:'white', fontWeight:900, fontSize:'14px', padding:'15px', borderRadius:'14px', border:'none', cursor:enviando?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
          {enviando ? <span className="spinner" /> : '📢 Publicar en el Bazar'}
        </button>
      </div>
    </div>
  );
}
