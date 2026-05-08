/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, WifiOff, Plus, Trash2, Edit3,
  Check, X, Package, ToggleLeft, ToggleRight, Star, Clock,
  ChevronDown, ChevronUp, Camera
} from 'lucide-react';
import { supabase, ThemeToggle } from './App';
import type { AppSession, Theme } from './App';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Merchant {
  id:            string;
  name:          string;
  category:      string;
  rating:        number | null;
  delivery_time: string | null;
  image_url:     string | null;
  is_open:       boolean;
  phone_number:  string | null;
  description:   string | null;
}

interface Producto {
  id:           string;
  merchant_id:  string;
  name:         string;
  description:  string | null;
  price:        number;
  image_url:    string | null;
  category:     string | null;
  is_available: boolean;
}

interface Props {
  session:       AppSession;
  theme:         Theme;
  onThemeToggle: () => void;
  onVolver:      () => void;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DashboardNegocio(props: Props) {
  const [merchant, setMerchant]       = useState<Merchant | null>(null);
  const [productos, setProductos]     = useState<Producto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [tab, setTab]                 = useState<'info'|'menu'|'stats'>('info');
  const [editandoInfo, setEditInfo]   = useState(false);
  const [modalProducto, setModalProd] = useState<Partial<Producto> | null>(null);
  const [guardando, setGuardando]     = useState(false);
  const [catAbierta, setCatAbierta]   = useState<string | null>(null);
  const isDark = props.theme === 'dark';

  // Campos editables del negocio
  const [editName, setEditName]       = useState('');
  const [editDesc, setEditDesc]       = useState('');
  const [editPhone, setEditPhone]     = useState('');
  const [editTime, setEditTime]       = useState('');
  const [editImg, setEditImg]         = useState('');

  const userId = props.session.user.id;

  // Cargar negocio del usuario actual
  const fetchMerchant = useCallback(async function() {
    setLoading(true); setError('');
    try {
      // Buscar en merchant_admins primero
      const { data: adminRow } = await supabase
        .from('merchant_admins')
        .select('merchant_id')
        .eq('user_id', userId)
        .single();

      let merchantId = adminRow?.merchant_id;

      // Fallback: buscar por owner_id directo
      if (!merchantId) {
        const { data: ownerRow } = await supabase
          .from('merchants')
          .select('id')
          .eq('owner_id', userId)
          .single();
        merchantId = ownerRow?.id;
      }

      if (!merchantId) {
        setError('Tu cuenta no está vinculada a ningún negocio. Contacta a Changuito Express.');
        setLoading(false);
        return;
      }

      const { data: m, error: err } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .single();

      if (err) throw err;
      setMerchant(m);
      setEditName(m.name ?? '');
      setEditDesc(m.description ?? '');
      setEditPhone(m.phone_number ?? '');
      setEditTime(m.delivery_time ?? '');
      setEditImg(m.image_url ?? '');

      // Cargar productos
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('category').order('name');

      setProductos(prods ?? []);
    } catch(e: any) {
      setError(e.message ?? 'Error al cargar tu negocio.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(function(){ fetchMerchant(); }, [fetchMerchant]);

  // Guardar info del negocio
  async function guardarInfo() {
    if (!merchant) return;
    setGuardando(true);
    try {
      const { error: err } = await supabase.from('merchants').update({
        name:          editName.trim(),
        description:   editDesc.trim(),
        phone_number:  editPhone.trim(),
        delivery_time: editTime.trim(),
        image_url:     editImg.trim() || null,
      }).eq('id', merchant.id);
      if (err) throw err;
      setMerchant(function(prev) {
        if (!prev) return prev;
        return { ...prev, name:editName, description:editDesc, phone_number:editPhone, delivery_time:editTime, image_url:editImg||null };
      });
      setEditInfo(false);
    } catch(e: any) { setError(e.message); }
    finally { setGuardando(false); }
  }

  // Toggle abierto/cerrado
  async function toggleAbierto() {
    if (!merchant) return;
    const nuevo = !merchant.is_open;
    await supabase.from('merchants').update({ is_open: nuevo }).eq('id', merchant.id);
    setMerchant(function(prev){ return prev ? { ...prev, is_open: nuevo } : prev; });
  }

  // Toggle disponibilidad producto
  async function toggleProducto(prod: Producto) {
    const nuevo = !prod.is_available;
    await supabase.from('products').update({ is_available: nuevo }).eq('id', prod.id);
    setProductos(function(prev){ return prev.map(function(p){ return p.id===prod.id ? {...p, is_available:nuevo} : p; }); });
  }

  // Guardar producto (nuevo o edición)
  async function guardarProducto() {
    if (!merchant || !modalProducto) return;
    if (!modalProducto.name?.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!modalProducto.price || modalProducto.price <= 0) { setError('El precio debe ser mayor a 0.'); return; }
    setGuardando(true); setError('');
    try {
      if (modalProducto.id) {
        // Editar existente
        const { error: err } = await supabase.from('products').update({
          name:         modalProducto.name?.trim(),
          description:  modalProducto.description?.trim() || null,
          price:        modalProducto.price,
          category:     modalProducto.category?.trim() || 'General',
          image_url:    modalProducto.image_url?.trim() || null,
          is_available: modalProducto.is_available ?? true,
        }).eq('id', modalProducto.id);
        if (err) throw err;
        setProductos(function(prev){ return prev.map(function(p){ return p.id===modalProducto.id ? {...p, ...modalProducto} as Producto : p; }); });
      } else {
        // Nuevo producto
        const { data, error: err } = await supabase.from('products').insert({
          merchant_id:  merchant.id,
          name:         modalProducto.name?.trim(),
          description:  modalProducto.description?.trim() || null,
          price:        modalProducto.price,
          category:     modalProducto.category?.trim() || 'General',
          image_url:    modalProducto.image_url?.trim() || null,
          is_available: true,
        }).select().single();
        if (err) throw err;
        setProductos(function(prev){ return [...prev, data as Producto]; });
      }
      setModalProd(null);
    } catch(e: any) { setError(e.message); }
    finally { setGuardando(false); }
  }

  // Eliminar producto
  async function eliminarProducto(id: string) {
    if (!window.confirm('¿Eliminar este producto?')) return;
    await supabase.from('products').delete().eq('id', id);
    setProductos(function(prev){ return prev.filter(function(p){ return p.id !== id; }); });
  }

  // Agrupar por categoría
  const categorias = Array.from(new Set(productos.map(function(p){ return p.category ?? 'General'; })));

  const inputStyle: React.CSSProperties = {
    width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:'12px',
    border:'1px solid var(--border-subtle)', background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)',
    color:'var(--text-primary)', fontSize:'13px', outline:'none'
  };
  const labelStyle: React.CSSProperties = {
    fontSize:'11px', fontWeight:700, color:'var(--text-muted)', margin:'0 0 4px 0', display:'block'
  };

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
          <span className="spinner" style={{ borderColor:'var(--border-subtle)', borderTopColor:'var(--color-yellow)', width:'28px', height:'28px' }} />
          <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>Cargando tu negocio...</p>
        </div>
      </div>
    );
  }

  // ── Error sin negocio ──
  if (error && !merchant) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', textAlign:'center' }}>
        <WifiOff style={{ width:'40px', height:'40px', color:'var(--text-muted)', marginBottom:'16px' }} />
        <p style={{ fontSize:'15px', fontWeight:800, color:'var(--text-primary)', marginBottom:'8px' }}>Sin acceso</p>
        <p style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'20px', maxWidth:'300px' }}>{error}</p>
        <a href="https://wa.me/522223339999?text=Quiero%20acceso%20al%20dashboard%20de%20mi%20negocio"
          style={{ padding:'12px 24px', borderRadius:'14px', background:'#25D366', color:'white', fontWeight:800, fontSize:'13px', textDecoration:'none' }}>
          💬 Contactar Changuito
        </a>
        <button onClick={props.onVolver} style={{ marginTop:'12px', padding:'10px 20px', borderRadius:'12px', background:'var(--border-subtle)', border:'none', color:'var(--text-muted)', fontSize:'13px', cursor:'pointer' }}>
          Volver
        </button>
      </div>
    );
  }

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
              <p style={{ fontSize:'10px', color:'var(--color-yellow)', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.12em', margin:0 }}>🏪 Mi Negocio</p>
              <h1 style={{ fontSize:'17px', fontWeight:900, color:'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'180px' }}>{merchant?.name}</h1>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {/* Toggle abierto/cerrado */}
            <button onClick={toggleAbierto}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 12px', borderRadius:'10px', border:'none', background:merchant?.is_open?'var(--color-green-dim)':'var(--color-red-dim)', color:merchant?.is_open?'var(--color-green)':'var(--color-red)', fontSize:'11px', fontWeight:800, cursor:'pointer' }}>
              {merchant?.is_open
                ? <><ToggleRight style={{ width:'14px', height:'14px' }} /> Abierto</>
                : <><ToggleLeft style={{ width:'14px', height:'14px' }} /> Cerrado</>
              }
            </button>
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', background:isDark?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.05)', borderRadius:'14px', padding:'3px', gap:'3px' }}>
          {([
            { key:'info',  label:'📋 Info'   },
            { key:'menu',  label:'🍽️ Menú'  },
            { key:'stats', label:'📊 Ventas' },
          ] as const).map(function(t){
            const activo = tab === t.key;
            return (
              <button key={t.key} onClick={function(){ setTab(t.key); }}
                style={{ flex:1, padding:'9px 4px', border:'none', borderRadius:'11px', cursor:'pointer', fontSize:'11px', fontWeight:activo?900:600, background:activo?'var(--color-yellow)':'transparent', color:activo?'#020617':'var(--text-muted)' }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding:'16px', paddingBottom:'40px' }}>

        {error && (
          <div style={{ padding:'10px 14px', borderRadius:'12px', background:'var(--color-red-dim)', border:'1px solid rgba(239,68,68,0.3)', marginBottom:'14px' }}>
            <p style={{ fontSize:'12px', color:'var(--color-red)', margin:0 }}>{error}</p>
          </div>
        )}

        {/* ── TAB INFO ── */}
        {tab === 'info' && merchant && (
          <div>
            {/* Banner del negocio */}
            <div style={{ height:'160px', borderRadius:'18px', overflow:'hidden', background:'linear-gradient(135deg,#1a1a2e,#2d2d44)', marginBottom:'16px', position:'relative' }}>
              {merchant.image_url
                ? <img src={merchant.image_url} alt={merchant.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'64px', opacity:0.3 }}>🏪</div>
              }
            </div>

            {/* Stats rápidos */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'20px' }}>
              {[
                { label:'Calificación', value:'★ ' + (merchant.rating ?? 4.5).toFixed(1), color:'var(--color-yellow)' },
                { label:'Entrega', value:merchant.delivery_time ?? '—', color:'var(--text-primary)' },
                { label:'Productos', value:String(productos.length), color:'var(--color-green)' },
              ].map(function(s){
                return (
                  <div key={s.label} style={{ padding:'12px', borderRadius:'14px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', textAlign:'center' }}>
                    <p style={{ fontSize:'16px', fontWeight:900, color:s.color, margin:'0 0 3px 0' }}>{s.value}</p>
                    <p style={{ fontSize:'10px', color:'var(--text-muted)', margin:0, fontWeight:600 }}>{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Formulario info */}
            <div style={{ background:'var(--bg-card)', borderRadius:'18px', border:'1px solid var(--border-subtle)', padding:'16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <p style={{ fontSize:'14px', fontWeight:800, color:'var(--text-primary)', margin:0 }}>Información del negocio</p>
                {!editandoInfo
                  ? <button onClick={function(){ setEditInfo(true); }} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 12px', borderRadius:'10px', background:'var(--color-yellow-dim)', border:'1px solid rgba(250,204,21,0.3)', color:'var(--color-yellow)', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                      <Edit3 style={{ width:'12px', height:'12px' }} /> Editar
                    </button>
                  : <div style={{ display:'flex', gap:'8px' }}>
                      <button onClick={function(){ setEditInfo(false); }} style={{ padding:'7px 12px', borderRadius:'10px', background:'var(--border-subtle)', border:'none', color:'var(--text-muted)', fontSize:'12px', cursor:'pointer' }}>Cancelar</button>
                      <button onClick={guardarInfo} disabled={guardando} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 12px', borderRadius:'10px', background:'var(--color-green)', border:'none', color:'white', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                        {guardando ? <span className="spinner" style={{ width:'12px', height:'12px', borderWidth:'1.5px' }} /> : <Check style={{ width:'12px', height:'12px' }} />}
                        Guardar
                      </button>
                    </div>
                }
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {[
                  { label:'Nombre del negocio', val:editName, set:setEditName, ph:'Nombre', disabled:!editandoInfo },
                  { label:'Descripción', val:editDesc, set:setEditDesc, ph:'Breve descripción de tu negocio', disabled:!editandoInfo },
                  { label:'Teléfono / WhatsApp', val:editPhone, set:setEditPhone, ph:'52XXXXXXXXXX', disabled:!editandoInfo },
                  { label:'Tiempo de entrega', val:editTime, set:setEditTime, ph:'20-30 min', disabled:!editandoInfo },
                  { label:'URL de imagen / logo', val:editImg, set:setEditImg, ph:'https://...', disabled:!editandoInfo },
                ].map(function(f){
                  return (
                    <div key={f.label}>
                      <label style={labelStyle}>{f.label}</label>
                      <input value={f.val} onChange={function(e){ f.set(e.target.value); }} placeholder={f.ph} disabled={f.disabled}
                        style={{ ...inputStyle, opacity:f.disabled?0.6:1, cursor:f.disabled?'not-allowed':'text' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB MENÚ ── */}
        {tab === 'menu' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <p style={{ fontSize:'14px', fontWeight:800, color:'var(--text-primary)', margin:0 }}>{productos.length} productos</p>
              <button onClick={function(){ setModalProd({ is_available:true }); }}
                style={{ display:'flex', alignItems:'center', gap:'6px', padding:'9px 14px', borderRadius:'12px', background:'var(--color-green)', border:'none', color:'white', fontSize:'12px', fontWeight:800, cursor:'pointer', boxShadow:'0 4px 12px rgba(34,197,94,0.3)' }}>
                <Plus style={{ width:'14px', height:'14px' }} /> Nuevo producto
              </button>
            </div>

            {categorias.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 24px' }}>
                <Package style={{ width:'36px', height:'36px', color:'var(--text-muted)', margin:'0 auto 12px' }} />
                <p style={{ fontSize:'14px', fontWeight:700, color:'var(--text-primary)', margin:'0 0 8px 0' }}>Sin productos aún</p>
                <p style={{ fontSize:'12px', color:'var(--text-muted)' }}>Agrega tu primer producto con el botón de arriba</p>
              </div>
            )}

            {categorias.map(function(cat){
              const prods = productos.filter(function(p){ return (p.category ?? 'General') === cat; });
              const abierta = catAbierta === cat;
              return (
                <div key={cat} style={{ marginBottom:'10px' }}>
                  <button onClick={function(){ setCatAbierta(abierta ? null : cat); }}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderRadius:'16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ fontSize:'14px', fontWeight:800, color:'var(--text-primary)' }}>{cat}</span>
                      <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>({prods.length})</span>
                    </div>
                    {abierta ? <ChevronUp style={{ width:'15px', height:'15px', color:'var(--text-muted)' }} /> : <ChevronDown style={{ width:'15px', height:'15px', color:'var(--text-muted)' }} />}
                  </button>

                  {abierta && (
                    <div style={{ marginTop:'6px', display:'flex', flexDirection:'column', gap:'8px' }}>
                      {prods.map(function(prod){
                        return (
                          <div key={prod.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'14px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', opacity:prod.is_available?1:0.5 }}>
                            <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0, overflow:'hidden' }}>
                              {prod.image_url ? <img src={prod.image_url} alt={prod.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🍽️'}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 2px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{prod.name}</p>
                              <p style={{ fontSize:'14px', fontWeight:900, color:'var(--color-yellow)', margin:0 }}>${prod.price.toFixed(2)}</p>
                            </div>
                            <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                              {/* Toggle disponible */}
                              <button onClick={function(){ toggleProducto(prod); }}
                                style={{ width:'32px', height:'32px', borderRadius:'10px', background:prod.is_available?'var(--color-green-dim)':'var(--color-red-dim)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                                {prod.is_available
                                  ? <ToggleRight style={{ width:'15px', height:'15px', color:'var(--color-green)' }} />
                                  : <ToggleLeft style={{ width:'15px', height:'15px', color:'var(--color-red)' }} />
                                }
                              </button>
                              {/* Editar */}
                              <button onClick={function(){ setModalProd({ ...prod }); }}
                                style={{ width:'32px', height:'32px', borderRadius:'10px', background:'var(--color-yellow-dim)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                                <Edit3 style={{ width:'14px', height:'14px', color:'var(--color-yellow)' }} />
                              </button>
                              {/* Eliminar */}
                              <button onClick={function(){ eliminarProducto(prod.id); }}
                                style={{ width:'32px', height:'32px', borderRadius:'10px', background:'var(--color-red-dim)', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                                <Trash2 style={{ width:'14px', height:'14px', color:'var(--color-red)' }} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB VENTAS ── */}
        {tab === 'stats' && (
          <StatsTab merchantId={merchant?.id ?? ''} isDark={isDark} />
        )}
      </div>

      {/* Modal producto */}
      {modalProducto !== null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:400, display:'flex', alignItems:'flex-end' }} onClick={function(){ setModalProd(null); }}>
          <div style={{ width:'100%', maxWidth:'480px', margin:'0 auto', background:'var(--bg-card)', borderRadius:'28px 28px 0 0', padding:'24px 20px 40px', maxHeight:'90vh', overflowY:'auto' }}
            onClick={function(e){ e.stopPropagation(); }}>
            <div style={{ width:'40px', height:'4px', borderRadius:'2px', background:'var(--border-medium)', margin:'0 auto 20px' }} />
            <h2 style={{ fontSize:'18px', fontWeight:900, color:'var(--text-primary)', margin:'0 0 20px 0' }}>
              {modalProducto.id ? '✏️ Editar producto' : '➕ Nuevo producto'}
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[
                { label:'Nombre *', val:modalProducto.name ?? '', key:'name', ph:'Nombre del producto' },
                { label:'Descripción', val:modalProducto.description ?? '', key:'description', ph:'Descripción breve' },
                { label:'Categoría', val:modalProducto.category ?? '', key:'category', ph:'Comidas, Bebidas, Extras...' },
                { label:'URL de imagen', val:modalProducto.image_url ?? '', key:'image_url', ph:'https://...' },
              ].map(function(f){
                return (
                  <div key={f.key}>
                    <label style={labelStyle}>{f.label}</label>
                    <input value={f.val} placeholder={f.ph}
                      onChange={function(e){ setModalProd(function(prev){ return prev ? { ...prev, [f.key]: e.target.value } : prev; }); }}
                      style={inputStyle} />
                  </div>
                );
              })}
              <div>
                <label style={labelStyle}>Precio *</label>
                <input type="number" value={modalProducto.price ?? ''} placeholder="0.00" min="0" step="0.01"
                  onChange={function(e){ setModalProd(function(prev){ return prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : prev; }); }}
                  style={inputStyle} />
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>
                <input type="checkbox" checked={modalProducto.is_available ?? true}
                  onChange={function(e){ setModalProd(function(prev){ return prev ? { ...prev, is_available: e.target.checked } : prev; }); }} />
                Disponible para ordenar
              </label>
            </div>
            {error && <p style={{ fontSize:'12px', color:'var(--color-red)', margin:'12px 0 0 0' }}>{error}</p>}
            <button onClick={guardarProducto} disabled={guardando}
              style={{ width:'100%', marginTop:'20px', background:guardando?'rgba(34,197,94,0.5)':'var(--color-green)', color:'white', fontWeight:900, fontSize:'14px', padding:'15px', borderRadius:'14px', border:'none', cursor:guardando?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              {guardando ? <span className="spinner" style={{ width:'16px', height:'16px', borderWidth:'2px' }} /> : <Check style={{ width:'16px', height:'16px' }} />}
              {modalProducto.id ? 'Guardar cambios' : 'Agregar producto'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Estadísticas ─────────────────────────────────────────────────────────
function StatsTab(props: { merchantId: string; isDark: boolean }) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(function() {
    if (!props.merchantId) return;
    supabase.from('pedidos')
      .select('id, total, estatus, created_at, detalle, cliente_email')
      .eq('negocio_id', props.merchantId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(function(r) {
        setPedidos(r.data ?? []);
        setLoading(false);
      });
  }, [props.merchantId]);

  const totalVentas = pedidos.filter(function(p){ return p.estatus === 'entregado'; })
    .reduce(function(a, p){ return a + (p.total ?? 0); }, 0);
  const pedidosHoy = pedidos.filter(function(p){
    return new Date(p.created_at).toDateString() === new Date().toDateString();
  }).length;

  if (loading) return <div style={{ textAlign:'center', padding:'40px' }}><span className="spinner" style={{ borderTopColor:'var(--color-yellow)', borderColor:'var(--border-subtle)', width:'24px', height:'24px' }} /></div>;

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
        {[
          { emoji:'💰', label:'Ventas totales',  value:'$' + totalVentas.toLocaleString('es-MX'), color:'var(--color-yellow)' },
          { emoji:'📦', label:'Pedidos hoy',      value:String(pedidosHoy), color:'var(--color-green)' },
          { emoji:'🧾', label:'Total pedidos',    value:String(pedidos.length), color:'var(--text-primary)' },
          { emoji:'⏳', label:'Pendientes',       value:String(pedidos.filter(function(p){ return p.estatus==='pendiente'; }).length), color:'var(--color-red)' },
        ].map(function(s){
          return (
            <div key={s.label} style={{ padding:'16px', borderRadius:'16px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', textAlign:'center' }}>
              <p style={{ fontSize:'22px', margin:'0 0 6px 0' }}>{s.emoji}</p>
              <p style={{ fontSize:'20px', fontWeight:900, color:s.color, margin:'0 0 4px 0' }}>{s.value}</p>
              <p style={{ fontSize:'10px', color:'var(--text-muted)', margin:0, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)', margin:'0 0 12px 0' }}>Últimos pedidos</p>
      {pedidos.length === 0 && (
        <div style={{ textAlign:'center', padding:'32px', color:'var(--text-muted)', fontSize:'13px' }}>Sin pedidos aún</div>
      )}
      {pedidos.slice(0, 10).map(function(p) {
        const fecha = new Date(p.created_at);
        const label = fecha.toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' ' + fecha.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
        const colorEstatus: Record<string, string> = { pendiente:'var(--color-yellow)', en_camino:'var(--color-blue)', entregado:'var(--color-green)', cancelado:'var(--color-red)' };
        return (
          <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderRadius:'14px', background:'var(--bg-card)', border:'1px solid var(--border-subtle)', marginBottom:'8px' }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:'12px', fontWeight:700, color:'var(--text-primary)', margin:'0 0 2px 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{p.detalle ?? 'Pedido'}</p>
              <p style={{ fontSize:'10px', color:'var(--text-muted)', margin:0 }}>{label}</p>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <p style={{ fontSize:'14px', fontWeight:900, color:'var(--color-yellow)', margin:'0 0 3px 0' }}>${(p.total ?? 0).toFixed(0)}</p>
              <span style={{ fontSize:'9px', fontWeight:800, padding:'2px 7px', borderRadius:'8px', background:'rgba(255,255,255,0.06)', color:colorEstatus[p.estatus] ?? 'var(--text-muted)', textTransform:'uppercase' }}>{p.estatus}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
