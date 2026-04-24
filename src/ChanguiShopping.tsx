/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, X, ShoppingBag, Star, Clock, Package, WifiOff, RefreshCw, ChevronRight, Truck } from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';

interface Producto {
  id:              string;
  nombre:          string;
  descripcion:     string | null;
  precio:          number;
  precio_original: number | null;
  categoria:       string;
  subcategoria:    string | null;
  fotos:           string[] | null;
  stock:           number;
  tiempo_entrega:  string;
  es_destacado:    boolean;
  proveedor:       string;
}

interface Props {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onVolver:      () => void;
}

const CATEGORIAS = [
  { id:'todos',       label:'Todo',       emoji:'🛍️' },
  { id:'tecnologia',  label:'Tech',       emoji:'📱' },
  { id:'ropa',        label:'Moda',       emoji:'👗' },
  { id:'hogar',       label:'Hogar',      emoji:'🏠' },
  { id:'belleza',     label:'Belleza',    emoji:'💄' },
  { id:'mascotas',    label:'Mascotas',   emoji:'🐾' },
];

export default function ChanguiShopping(props: Props) {
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [loading, setLoading]       = useState(true);
  const [catActiva, setCatActiva]   = useState('todos');
  const [search, setSearch]         = useState('');
  const [detalle, setDetalle]       = useState<Producto | null>(null);
  const isDark = props.theme === 'dark';

  const fetchProductos = useCallback(async function() {
    setLoading(true);
    try {
      let q = supabase.from('changuishopping').select('*').eq('activo', true).order('es_destacado', { ascending:false }).order('nombre');
      if (catActiva !== 'todos') q = q.eq('categoria', catActiva);
      const { data } = await q;
      setProductos(data ?? []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [catActiva]);

  useEffect(function(){ fetchProductos(); }, [fetchProductos]);

  const filtrados = search.trim() === '' ? productos : productos.filter(function(p){
    return p.nombre.toLowerCase().includes(search.toLowerCase()) || (p.subcategoria ?? '').toLowerCase().includes(search.toLowerCase());
  });

  const destacados = filtrados.filter(function(p){ return p.es_destacado; });
  const normales   = filtrados.filter(function(p){ return !p.es_destacado; });

  function descuento(p: Producto): number | null {
    if (!p.precio_original || p.precio_original <= p.precio) return null;
    return Math.round((1 - p.precio / p.precio_original) * 100);
  }

  function abrirWhatsApp(p: Producto) {
    const msg = '🛍️ *ChanguiShopping*\nQuiero ordenar:\n*' + p.nombre + '*\nPrecio: $' + p.precio.toLocaleString('es-MX') + '\nEntrega: ' + p.tiempo_entrega;
    window.open('https://wa.me/522223339999?text=' + encodeURIComponent(msg), '_blank');
  }

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
              <p style={{ fontSize:'10px', color:'var(--color-red)', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.15em', margin:0 }}>🐉 Red Dragon · Envíos desde China</p>
              <h1 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:0 }}>ChanguiShopping 🛍️</h1>
            </div>
          </div>
          <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
        </div>
        <div style={{ position:'relative', marginBottom:'10px' }}>
          <Search style={{ position:'absolute', left:'13px', top:'50%', transform:'translateY(-50%)', width:'15px', height:'15px', color:'var(--text-muted)', pointerEvents:'none' }} />
          <input type="text" placeholder="Buscar productos..." value={search}
            onChange={function(e){ setSearch(e.target.value); }}
            style={{ width:'100%', boxSizing:'border-box', background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)', border:'1px solid var(--border-subtle)', borderRadius:'14px', padding:'10px 10px 10px 36px', color:'var(--text-primary)', fontSize:'13px', outline:'none' }} />
          {search && <button onClick={function(){ setSearch(''); }} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer' }}>
            <X style={{ width:'14px', height:'14px', color:'var(--text-muted)' }} />
          </button>}
        </div>
        <div style={{ display:'flex', gap:'8px', overflowX:'auto', scrollbarWidth:'none', paddingBottom:'2px' }}>
          {CATEGORIAS.map(function(cat){
            const activa = catActiva === cat.id;
            return (
              <button key={cat.id} onClick={function(){ setCatActiva(cat.id); }}
                style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 14px', borderRadius:'20px', border:activa?'none':'1px solid var(--border-subtle)', background:activa?'var(--color-red)':'transparent', color:activa?'white':'var(--text-muted)', fontSize:'12px', fontWeight:activa?800:500, cursor:'pointer', whiteSpace:'nowrap' }}>
                {cat.emoji} {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding:'16px', paddingBottom:'40px' }}>

        {/* Banner */}
        <div style={{ borderRadius:'18px', background:'linear-gradient(135deg,#7f1d1d,#dc2626)', padding:'18px 20px', marginBottom:'20px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', right:'-10px', top:'-10px', width:'80px', height:'80px', borderRadius:'50%', background:'rgba(255,255,255,0.1)' }} />
          <p style={{ fontSize:'10px', fontWeight:900, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.2em', margin:'0 0 4px 0' }}>🐉 Proveedor directo</p>
          <h2 style={{ fontSize:'18px', fontWeight:900, color:'white', margin:'0 0 4px 0' }}>Precios de fábrica</h2>
          <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.7)', margin:0 }}>Sin intermediarios · Envío directo desde China</p>
        </div>

        {loading && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {[1,2,3,4].map(function(i){
              return <div key={i} style={{ borderRadius:'16px', overflow:'hidden', background:card, border:'1px solid var(--border-subtle)' }}>
                <div className="skeleton" style={{ height:'160px' }} />
                <div style={{ padding:'10px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  <div className="skeleton" style={{ height:'12px', width:'80%' }} />
                  <div className="skeleton" style={{ height:'14px', width:'40%' }} />
                </div>
              </div>;
            })}
          </div>
        )}

        {/* Destacados */}
        {!loading && destacados.length > 0 && (
          <div style={{ marginBottom:'20px' }}>
            <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 12px 0' }}>⭐ Más vendidos</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              {destacados.map(function(p){ return <TarjetaProducto key={p.id} producto={p} card={card} onClick={function(){ setDetalle(p); }} descuento={descuento(p)} />; })}
            </div>
          </div>
        )}

        {/* Todos */}
        {!loading && normales.length > 0 && (
          <div>
            <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 12px 0' }}>Todos los productos</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              {normales.map(function(p){ return <TarjetaProducto key={p.id} producto={p} card={card} onClick={function(){ setDetalle(p); }} descuento={descuento(p)} />; })}
            </div>
          </div>
        )}

        {!loading && filtrados.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 24px' }}>
            <p style={{ fontSize:'40px', marginBottom:'12px' }}>🔍</p>
            <p style={{ color:'var(--text-muted)' }}>Sin productos en esta categoría</p>
          </div>
        )}
      </div>

      {/* Modal detalle producto */}
      {detalle && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:400, display:'flex', alignItems:'flex-end' }} onClick={function(){ setDetalle(null); }}>
          <div style={{ width:'100%', maxWidth:'480px', margin:'0 auto', background:'var(--bg-card)', borderRadius:'28px 28px 0 0', padding:'24px 20px 40px', maxHeight:'85vh', overflowY:'auto' }}
            onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-medium)', margin:'0 auto 20px' }} />

            {/* Imagen */}
            <div style={{ height:'200px', borderRadius:'18px', background:'linear-gradient(135deg,#7f1d1d,#dc2626)', marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'60px', overflow:'hidden' }}>
              {detalle.fotos && detalle.fotos.length > 0
                ? <img src={detalle.fotos[0]} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : '🛍️'
              }
            </div>

            {detalle.subcategoria && <span style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'20px', background:'var(--color-red-dim)', color:'var(--color-red)', fontWeight:700 }}>{detalle.subcategoria}</span>}
            <h2 style={{ fontSize:'20px', fontWeight:900, color:'var(--text-primary)', margin:'10px 0 8px 0' }}>{detalle.nombre}</h2>
            {detalle.descripcion && <p style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:1.6, margin:'0 0 16px 0' }}>{detalle.descripcion}</p>}

            <div style={{ display:'flex', alignItems:'baseline', gap:'10px', marginBottom:'8px' }}>
              <span style={{ fontSize:'28px', fontWeight:900, color:'var(--color-yellow)' }}>${detalle.precio.toLocaleString('es-MX')}</span>
              {detalle.precio_original && <span style={{ fontSize:'16px', color:'var(--text-muted)', textDecoration:'line-through' }}>${detalle.precio_original.toLocaleString('es-MX')}</span>}
              {descuento(detalle) && <span style={{ fontSize:'12px', padding:'3px 8px', borderRadius:'8px', background:'var(--color-green-dim)', color:'var(--color-green)', fontWeight:800 }}>-{descuento(detalle)}%</span>}
            </div>

            <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', borderRadius:'10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)' }}>
                <Truck style={{ width:'14px', height:'14px', color:'var(--text-muted)' }} />
                <span style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:600 }}>{detalle.tiempo_entrega}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'8px 12px', borderRadius:'10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)' }}>
                <Package style={{ width:'14px', height:'14px', color:'var(--text-muted)' }} />
                <span style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:600 }}>Stock: {detalle.stock}</span>
              </div>
            </div>

            <button onClick={function(){ abrirWhatsApp(detalle); }}
              style={{ width:'100%', background:'#25D366', color:'white', fontWeight:900, fontSize:'14px', padding:'16px', borderRadius:'16px', border:'none', cursor:'pointer', boxShadow:'0 8px 24px rgba(37,211,102,0.35)' }}>
              💬 Ordenar por WhatsApp
            </button>
            <p style={{ textAlign:'center', fontSize:'11px', color:'var(--text-muted)', marginTop:'10px' }}>
              🐉 Proveedor: {detalle.proveedor} · Pago contra entrega disponible
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TarjetaProducto(props: { producto: Producto; card: string; onClick: () => void; descuento: number | null }) {
  const p = props.producto;
  return (
    <div onClick={props.onClick} style={{ borderRadius:'16px', overflow:'hidden', background:props.card, border:'1px solid var(--border-subtle)', cursor:'pointer', boxShadow:'var(--shadow-card)' }}>
      <div style={{ height:'150px', background:'linear-gradient(135deg,#7f1d1d,#dc2626)', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px', overflow:'hidden' }}>
        {p.fotos && p.fotos.length > 0
          ? <img src={p.fotos[0]} alt={p.nombre} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : '🛍️'
        }
        {props.descuento && (
          <div style={{ position:'absolute', top:'8px', left:'8px', padding:'3px 8px', borderRadius:'8px', background:'#ef4444', color:'white', fontSize:'10px', fontWeight:900 }}>
            -{props.descuento}%
          </div>
        )}
        {p.es_destacado && (
          <div style={{ position:'absolute', top:'8px', right:'8px', padding:'3px 8px', borderRadius:'8px', background:'var(--color-yellow)', color:'#020617', fontSize:'10px', fontWeight:900 }}>
            ⭐
          </div>
        )}
      </div>
      <div style={{ padding:'10px 12px 12px' }}>
        <p style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 2px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</p>
        <p style={{ fontSize:'10px', color:'var(--text-muted)', margin:'0 0 6px 0' }}>⏱ {p.tiempo_entrega}</p>
        <div style={{ display:'flex', alignItems:'baseline', gap:'5px' }}>
          <span style={{ fontSize:'15px', fontWeight:900, color:'var(--color-yellow)' }}>${p.precio.toLocaleString('es-MX')}</span>
          {p.precio_original && <span style={{ fontSize:'11px', color:'var(--text-muted)', textDecoration:'line-through' }}>${p.precio_original.toLocaleString('es-MX')}</span>}
        </div>
      </div>
    </div>
  );
}
