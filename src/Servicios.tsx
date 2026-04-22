/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, X, Star, Phone, MessageCircle, WifiOff, RefreshCw } from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';

interface Servicio {
  id:           string;
  nombre:       string;
  categoria:    string;
  descripcion:  string | null;
  telefono:     string | null;
  whatsapp:     string | null;
  calificacion: number;
  activo:       boolean;
  imagen_url:   string | null;
  precio_desde: number | null;
  precio_hasta: number | null;
}

interface ServiciosProps {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onVolver:      () => void;
}

const CATEGORIAS_SERV = [
  'Todos','Plomería','Electricidad','Cerrajería','Jardinería',
  'Limpieza','Fumigación','Pintura','Climatización','Mudanzas',
  'Médico','Veterinaria','Educación','Legal','Contabilidad','Fotografía',
];

const EMOJI_SERV: Record<string, string> = {
  'Plomería':'🔧','Electricidad':'⚡','Cerrajería':'🔑','Jardinería':'🌿',
  'Limpieza':'🧹','Fumigación':'🪲','Pintura':'🎨','Climatización':'❄️',
  'Mudanzas':'📦','Médico':'🩺','Veterinaria':'🐾','Educación':'📚',
  'Legal':'⚖️','Contabilidad':'📊','Fotografía':'📸',
};

export default function Servicios(props: ServiciosProps) {
  const [servicios, setServicios]   = useState<Servicio[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [catActiva, setCatActiva]   = useState('Todos');
  const [search, setSearch]         = useState('');
  const [detalle, setDetalle]       = useState<Servicio | null>(null);
  const isDark = props.theme === 'dark';

  const fetchServicios = useCallback(async function(){
    setLoading(true); setError('');
    try {
      let q = supabase.from('servicios').select('*').eq('activo', true).order('calificacion', {ascending:false});
      if (catActiva !== 'Todos') q = q.eq('categoria', catActiva);
      const { data, error: err } = await q;
      if (err) throw err;
      setServicios(data ?? []);
    } catch(e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [catActiva]);

  useEffect(function(){ fetchServicios(); }, [fetchServicios]);

  const filtrados = search.trim() === '' ? servicios : servicios.filter(function(s){
    return s.nombre.toLowerCase().includes(search.toLowerCase()) || s.categoria.toLowerCase().includes(search.toLowerCase());
  });

  const card = isDark ? '#16161e' : '#ffffff';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-base)', color:'var(--text-primary)', fontFamily:'system-ui,sans-serif', maxWidth:'480px', margin:'0 auto' }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--bg-nav)', backdropFilter:'blur(20px)', borderBottom:'1px solid var(--border-subtle)', padding:'14px 16px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={props.onVolver} style={{ width:'36px', height:'36px', borderRadius:'12px', background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              <ArrowLeft style={{ width:'18px', height:'18px', color:'var(--text-primary)' }} />
            </button>
            <div>
              <p style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>Proveedores de confianza</p>
              <h1 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:0 }}>🛠️ Servicios</h1>
            </div>
          </div>
          <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
        </div>
        <div style={{ position:'relative', marginBottom:'12px' }}>
          <Search style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)', width:'15px', height:'15px', color:'var(--text-muted)', pointerEvents:'none' }} />
          <input type="text" placeholder="Buscar servicio..." value={search}
            onChange={function(e){ setSearch(e.target.value); }}
            style={{ width:'100%', boxSizing:'border-box', background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)', border:'1px solid var(--border-subtle)', borderRadius:'14px', padding:'10px 10px 10px 36px', color:'var(--text-primary)', fontSize:'13px', outline:'none' }} />
          {search && <button onClick={function(){ setSearch(''); }} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer' }}>
            <X style={{ width:'14px', height:'14px', color:'var(--text-muted)' }} />
          </button>}
        </div>
        <div style={{ overflowX:'auto', display:'flex', gap:'8px', paddingBottom:'2px', scrollbarWidth:'none' }}>
          {CATEGORIAS_SERV.map(function(cat){
            const activa = catActiva === cat;
            return (
              <button key={cat} onClick={function(){ setCatActiva(cat); }}
                style={{ padding:'6px 14px', borderRadius:'20px', border:activa?'none':'1px solid var(--border-subtle)', background:activa?'var(--color-blue)':'transparent', color:activa?'white':'var(--text-muted)', fontSize:'11px', fontWeight:activa?800:500, cursor:'pointer', whiteSpace:'nowrap' }}>
                {cat === 'Todos' ? cat : (EMOJI_SERV[cat] ?? '🔧') + ' ' + cat}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding:'16px', paddingBottom:'40px' }}>
        {loading && [1,2,3].map(function(i){
          return <div key={i} style={{ borderRadius:'18px', padding:'16px', background:card, border:'1px solid var(--border-subtle)', marginBottom:'10px', display:'flex', gap:'12px' }}>
            <div className="skeleton" style={{ width:'56px', height:'56px', borderRadius:'14px', flexShrink:0 }} />
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'8px', justifyContent:'center' }}>
              <div className="skeleton" style={{ height:'13px', width:'60%' }} />
              <div className="skeleton" style={{ height:'10px', width:'40%' }} />
            </div>
          </div>;
        })}

        {!loading && error && (
          <div style={{ textAlign:'center', padding:'48px 24px' }}>
            <WifiOff style={{ width:'36px', height:'36px', color:'var(--text-muted)', margin:'0 auto 12px' }} />
            <button onClick={fetchServicios} style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'10px 20px', borderRadius:'12px', background:'var(--color-blue-dim)', border:'1px solid rgba(59,130,246,0.3)', color:'var(--color-blue)', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
              <RefreshCw style={{ width:'13px', height:'13px' }} /> Reintentar
            </button>
          </div>
        )}

        {!loading && !error && filtrados.map(function(s){
          return (
            <div key={s.id} onClick={function(){ setDetalle(s); }}
              style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', borderRadius:'18px', background:card, border:'1px solid var(--border-subtle)', marginBottom:'10px', cursor:'pointer', boxShadow:'var(--shadow-card)' }}>
              <div style={{ width:'52px', height:'52px', borderRadius:'14px', background:'linear-gradient(135deg,#1e3a5f,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>
                {s.imagen_url ? <img src={s.imagen_url} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'14px' }} /> : (EMOJI_SERV[s.categoria] ?? '🔧')}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'14px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 3px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.nombre}</p>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 6px 0' }}>{s.categoria}</p>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'11px', color:'var(--color-yellow)', fontWeight:700 }}>★ {s.calificacion.toFixed(1)}</span>
                  {(s.precio_desde || s.precio_hasta) && (
                    <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>
                      Desde ${s.precio_desde?.toLocaleString('es-MX') ?? '—'}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {s.whatsapp && (
                  <a href={'https://wa.me/' + s.whatsapp.replace(/\D/g,'')} target="_blank" rel="noreferrer"
                    onClick={function(e){ e.stopPropagation(); }}
                    style={{ width:'32px', height:'32px', borderRadius:'10px', background:'rgba(37,211,102,0.15)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
                    <MessageCircle style={{ width:'15px', height:'15px', color:'#25D366' }} />
                  </a>
                )}
                {s.telefono && (
                  <a href={'tel:' + s.telefono} onClick={function(e){ e.stopPropagation(); }}
                    style={{ width:'32px', height:'32px', borderRadius:'10px', background:'var(--color-blue-dim)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
                    <Phone style={{ width:'15px', height:'15px', color:'var(--color-blue)' }} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal detalle servicio */}
      {detalle && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:400, display:'flex', alignItems:'flex-end' }} onClick={function(){ setDetalle(null); }}>
          <div style={{ width:'100%', maxWidth:'480px', margin:'0 auto', background:'var(--bg-card)', borderRadius:'28px 28px 0 0', padding:'24px 20px 40px' }}
            onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-medium)', margin:'0 auto 20px' }} />
            <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'16px' }}>
              <div style={{ width:'60px', height:'60px', borderRadius:'16px', background:'linear-gradient(135deg,#1e3a5f,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px', flexShrink:0 }}>
                {EMOJI_SERV[detalle.categoria] ?? '🔧'}
              </div>
              <div>
                <h2 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:'0 0 4px 0' }}>{detalle.nombre}</h2>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'var(--color-yellow)', fontWeight:700 }}>★ {detalle.calificacion.toFixed(1)}</span>
                  <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{detalle.categoria}</span>
                </div>
              </div>
            </div>
            {detalle.descripcion && <p style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:1.6, marginBottom:'16px' }}>{detalle.descripcion}</p>}
            {(detalle.precio_desde || detalle.precio_hasta) && (
              <div style={{ padding:'12px 14px', borderRadius:'12px', background:isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)', border:'1px solid var(--border-subtle)', marginBottom:'16px' }}>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 4px 0', fontWeight:700 }}>PRECIO ESTIMADO</p>
                <p style={{ fontSize:'16px', fontWeight:900, color:'var(--color-yellow)', margin:0 }}>
                  {detalle.precio_desde && '$' + detalle.precio_desde.toLocaleString('es-MX')}
                  {detalle.precio_desde && detalle.precio_hasta && ' — '}
                  {detalle.precio_hasta && '$' + detalle.precio_hasta.toLocaleString('es-MX')}
                </p>
              </div>
            )}
            <div style={{ display:'flex', gap:'10px' }}>
              {detalle.whatsapp && (
                <a href={'https://wa.me/' + detalle.whatsapp.replace(/\D/g,'')} target="_blank" rel="noreferrer"
                  style={{ flex:1, padding:'14px', borderRadius:'14px', background:'#25D366', color:'white', fontWeight:800, fontSize:'13px', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <MessageCircle style={{ width:'16px', height:'16px' }} /> WhatsApp
                </a>
              )}
              {detalle.telefono && (
                <a href={'tel:' + detalle.telefono}
                  style={{ flex:1, padding:'14px', borderRadius:'14px', background:'var(--color-blue)', color:'white', fontWeight:800, fontSize:'13px', textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <Phone style={{ width:'16px', height:'16px' }} /> Llamar
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
