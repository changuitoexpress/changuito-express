/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS MVP */
/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import {
  Mail,
  Lock,
  LogIn,
  UserPlus,
  ShoppingCart,
  Package,
  Store,
  LogOut,
  Zap,
  Star,
  ChevronRight,
} from 'lucide-react';
import ErrorConexion from './components/ErrorConexion';
import RoleBasedRedirect from './components/RoleBasedRedirect';

// ─────────────────────────────────────────────────────────────────────────────
//  TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type AuthMode = 'login' | 'register';

interface ToastMessage {
  id: number;
  text: string;
  kind: 'error' | 'success' | 'info';
}

interface UserSession {
  user: {
    id: string; 
    email?: string;
  };
}

type Rol = 'admin' | 'cliente' | 'restaurante' | 'repartidor' | 'vendedor_bazar' | null;

// ─────────────────────────────────────────────────────────────────────────────
//  HOOK — useToast
// ─────────────────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef<number>(0);

  function addToast(text: string, kind: ToastMessage['kind'] = 'info') {
    const id = (counter.current += 1);
    setToasts(function(prev) { return [...prev, { id, text, kind }]; });
    setTimeout(function() {
      setToasts(function(prev) { return prev.filter(function(t) { return t.id !== id; }); });
    }, 4000);
  }

  return { toasts, addToast };
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTE — ToastRack
// ─────────────────────────────────────────────────────────────────────────────
function ToastRack(props: { toasts: ToastMessage[] }) {
  const styles: Record<ToastMessage['kind'], React.CSSProperties> = {
    error:   { background: '#3f1010', border: '1px solid #f87171', color: '#fca5a5' },
    success: { background: '#0f2f1a', border: '1px solid #4ade80', color: '#86efac' },
    info:    { background: '#2a2000', border: '1px solid #facc15', color: '#fde68a' },
  };
  return (
    <div style={{ position:'fixed', top:'16px', right:'16px', zIndex:9999, display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'none' }}>
      {props.toasts.map(function(t) {
        return (
          <div key={t.id} style={{ padding:'12px 16px', borderRadius:'14px', fontSize:'13px', fontWeight:600, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', ...styles[t.kind] }}>
            {t.text}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTE — AuthScreen
// ─────────────────────────────────────────────────────────────────────────────
interface AuthScreenProps {
  onToast: (text: string, kind: ToastMessage['kind']) => void;
}

type TipoRegistro = 'cliente' | 'restaurante';

function AuthScreen(props: AuthScreenProps) {
  const [mode, setMode]                   = useState<AuthMode>('login');
  const [email, setEmail]                 = useState<string>('');
  const [password, setPassword]           = useState<string>('');
  const [loading, setLoading]             = useState<boolean>(false);
  const [focused, setFocused]             = useState<string>('');
  const [tipoRegistro, setTipoRegistro]   = useState<TipoRegistro>('cliente');
  const [nombreNegocio, setNombreNegocio] = useState<string>('');
  const [direccion, setDireccion]         = useState<string>('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) {
      props.onToast('Completá todos los campos.', 'error');
      return;
    }
    if (password.length < 6) {
      props.onToast('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
    if (mode === 'register' && tipoRegistro === 'restaurante' && !nombreNegocio.trim()) {
      props.onToast('Ingresá el nombre de tu negocio.', 'error');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        const metadata: Record<string, string> = { rol: tipoRegistro };
        if (tipoRegistro === 'restaurante') {
          metadata.nombre_negocio = nombreNegocio.trim();
          metadata.direccion      = direccion.trim();
        }
        const result = await supabase.auth.signUp({
          email, password,
          options: { data: metadata },
        });
        if (result.error) { throw result.error; }
        props.onToast('¡Revisá tu email para confirmar tu cuenta!', 'success');
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) { throw result.error; }
      }
    } catch (err: any) {
      props.onToast(err.message || 'Error desconocido.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const isLogin = (mode === 'login');

  const inputStyle = function(field: string): React.CSSProperties {
    return {
      width: '100%',
      boxSizing: 'border-box',
      background: 'rgba(2,6,23,0.6)',
      border: focused === field ? '1px solid rgba(250,204,21,0.55)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      padding: '14px 14px 14px 42px',
      color: 'white',
      fontSize: '14px',
      outline: 'none',
    };
  };

  return (
    <div style={{ minHeight:'100vh', background:'#020617', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', position:'relative', overflow:'hidden', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ position:'absolute', top:'-160px', left:'-160px', width:'400px', height:'400px', borderRadius:'50%', background:'rgba(250,204,21,0.04)', filter:'blur(100px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-160px', right:'-160px', width:'350px', height:'350px', borderRadius:'50%', background:'rgba(250,204,21,0.06)', filter:'blur(90px)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, opacity:0.025, backgroundImage:'radial-gradient(circle, #facc15 1px, transparent 1px)', backgroundSize:'28px 28px', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:'380px', position:'relative', zIndex:1 }}>

        <div style={{ textAlign:'center', marginBottom:'36px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'64px', height:'64px', borderRadius:'20px', background:'#facc15', boxShadow:'0 8px 32px rgba(250,204,21,0.3)', marginBottom:'16px' }}>
            <ShoppingCart style={{ width:'32px', height:'32px', color:'#020617' }} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize:'28px', fontWeight:900, color:'white', letterSpacing:'-0.04em', lineHeight:1, margin:0 }}>
            CHANGUITO<br /><span style={{ color:'#facc15' }}>EXPRESS</span>
          </h1>
          <p style={{ fontSize:'10px', letterSpacing:'0.35em', color:'rgba(255,255,255,0.2)', fontWeight:700, textTransform:'uppercase', marginTop:'8px' }}>
            {isLogin ? 'Modo Dios · Acceso VIP' : 'Crear Cuenta · God Mode'}
          </p>
        </div>

        <div style={{ background:'rgba(15,23,42,0.85)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'28px', padding:'28px', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' }}>

          <div style={{ display:'flex', background:'rgba(2,6,23,0.7)', borderRadius:'16px', padding:'4px', marginBottom:'24px', border:'1px solid rgba(255,255,255,0.05)' }}>
            {(['login', 'register'] as AuthMode[]).map(function(m) {
              const active = (mode === m);
              return (
                <button key={m} onClick={function() { setMode(m); }} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'12px', border:'none', cursor:'pointer', fontSize:'11px', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', background: active ? '#facc15' : 'transparent', color: active ? '#020617' : 'rgba(255,255,255,0.3)', boxShadow: active ? '0 4px 16px rgba(250,204,21,0.25)' : 'none' }}>
                  {m === 'login' ? <><LogIn style={{ width:'13px', height:'13px' }} /> Entrar</> : <><UserPlus style={{ width:'13px', height:'13px' }} /> Registro</>}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

            {/* Selector de tipo de cuenta — solo visible en registro */}
            {!isLogin && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                <p style={{ margin:0, fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(255,255,255,0.25)' }}>Tipo de cuenta</p>
                <div style={{ display:'flex', gap:'8px' }}>
                  {(['cliente', 'restaurante'] as TipoRegistro[]).map(function(t) {
                    const active = (tipoRegistro === t);
                    const labels: Record<TipoRegistro, string> = { cliente: '🛒 Cliente', restaurante: '🍽️ Restaurante' };
                    return (
                      <button key={t} type="button" onClick={function() { setTipoRegistro(t); }}
                        style={{ flex:1, padding:'10px 8px', borderRadius:'12px', border: active ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.08)', background: active ? 'rgba(250,204,21,0.12)' : 'rgba(2,6,23,0.5)', color: active ? '#facc15' : 'rgba(255,255,255,0.35)', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color: focused === 'email' ? '#facc15' : 'rgba(255,255,255,0.2)', pointerEvents:'none' }}>
                <Mail style={{ width:'16px', height:'16px' }} />
              </div>
              <input type="email" placeholder="tu@email.com" autoComplete="email" value={email}
                onChange={function(e) { setEmail(e.target.value); }}
                onFocus={function() { setFocused('email'); }}
                onBlur={function() { setFocused(''); }}
                style={inputStyle('email')} />
            </div>

            <div style={{ position:'relative' }}>
              <div style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color: focused === 'password' ? '#facc15' : 'rgba(255,255,255,0.2)', pointerEvents:'none' }}>
                <Lock style={{ width:'16px', height:'16px' }} />
              </div>
              <input type="password" placeholder="Contraseña (mín. 6 caracteres)" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password}
                onChange={function(e) { setPassword(e.target.value); }}
                onFocus={function() { setFocused('password'); }}
                onBlur={function() { setFocused(''); }}
                style={inputStyle('password')} />
            </div>

            {/* Campos extra para Restaurante */}
            {!isLogin && tipoRegistro === 'restaurante' && (
              <>
                <input type="text" placeholder="Nombre del negocio *" value={nombreNegocio}
                  onChange={function(e) { setNombreNegocio(e.target.value); }}
                  onFocus={function() { setFocused('negocio'); }}
                  onBlur={function() { setFocused(''); }}
                  style={{ ...inputStyle('negocio'), paddingLeft:'14px' }} />
                <input type="text" placeholder="Dirección (opcional)" value={direccion}
                  onChange={function(e) { setDireccion(e.target.value); }}
                  onFocus={function() { setFocused('dir'); }}
                  onBlur={function() { setFocused(''); }}
                  style={{ ...inputStyle('dir'), paddingLeft:'14px' }} />
              </>
            )}

            <button type="submit" disabled={loading} style={{ width:'100%', background: loading ? 'rgba(250,204,21,0.5)' : '#facc15', color:'#020617', fontWeight:900, fontSize:'13px', textTransform:'uppercase', letterSpacing:'0.12em', padding:'15px', borderRadius:'14px', border:'none', cursor: loading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow: loading ? 'none' : '0 8px 24px rgba(250,204,21,0.25)', marginTop:'4px' }}>
              {loading
                ? <span style={{ width:'18px', height:'18px', border:'2px solid rgba(2,6,23,0.3)', borderTopColor:'#020617', borderRadius:'50%', display:'inline-block', animation:'changuito-spin 0.7s linear infinite' }} />
                : isLogin
                  ? <><LogIn style={{ width:'15px', height:'15px' }} /> Entrar al Bazar</>
                  : <><UserPlus style={{ width:'15px', height:'15px' }} /> Crear Cuenta VIP</>
              }
            </button>
          </form>

          <p style={{ textAlign:'center', fontSize:'11px', color:'rgba(255,255,255,0.18)', marginTop:'16px', lineHeight:1.5 }}>
            {isLogin ? '¿Sos nuevo? Usá la pestaña Registro.' : 'Al registrarte aceptás los términos del servicio.'}
          </p>
        </div>

        <p style={{ textAlign:'center', fontSize:'10px', letterSpacing:'0.3em', color:'rgba(255,255,255,0.1)', textTransform:'uppercase', marginTop:'20px' }}>
          Lomas · Clúster Toscana · Delivery Exclusivo
        </p>
      </div>

      <style>{`@keyframes changuito-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTE — AdminDashboard (Renombramos el Dashboard original de Admin)
// ─────────────────────────────────────────────────────────────────────────────
interface AdminDashboardProps {
  session: UserSession;
}

function AdminDashboard(props: AdminDashboardProps) {
  const rawEmail = props.session.user.email || 'admin@changuito.com';
  const username = rawEmail.split('@')[0].toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const kpis = [
    { label:'Pedidos Activos', value:'0', color:'#60a5fa', bg:'rgba(96,165,250,0.08)',   border:'rgba(96,165,250,0.2)',   Icon:Package },
    { label:'Usuarios VIP',   value:'0', color:'#facc15', bg:'rgba(250,204,21,0.08)',   border:'rgba(250,204,21,0.2)',   Icon:Star    },
    { label:'Negocios Online', value:'0', color:'#4ade80', bg:'rgba(74,222,128,0.08)',   border:'rgba(74,222,128,0.2)',   Icon:Store   },
    { label:'Urgencias VIP',  value:'0', color:'#f87171', bg:'rgba(248,113,113,0.08)',  border:'rgba(248,113,113,0.2)',  Icon:Zap     },
  ];

  const actions = [
    { label:'Gestionar Pedidos',  color:'#60a5fa' },
    { label:'Moderar Bazar',      color:'#4ade80' },
    { label:'Repartidores Live',  color:'#60a5fa' },
    { label:'Usuarios VIP',       color:'#facc15' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#020617', color:'white', padding:'20px', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'40px', height:'40px', borderRadius:'14px', background:'#facc15', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(250,204,21,0.3)' }}>
            <ShoppingCart style={{ width:'20px', height:'20px', color:'#020617' }} strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ fontSize:'9px', letterSpacing:'0.3em', color:'rgba(255,255,255,0.25)', textTransform:'uppercase', fontWeight:700, margin:0 }}>Changuito Express</p>
            <h1 style={{ fontSize:'15px', fontWeight:900, margin:0 }}>
                Bienvenido, <span style={{ color:'#facc15' }}>{username}</span>
            </h1>
          </div>
        </div>
        <button onClick={handleSignOut} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', borderRadius:'12px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.45)', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
          <LogOut style={{ width:'13px', height:'13px' }} />
          Cerrar Sesión
        </button>
      </div>

      <div style={{ position:'relative', overflow:'hidden', borderRadius:'24px', background:'#facc15', padding:'24px', marginBottom:'20px' }}>
        <p style={{ fontSize:'9px', letterSpacing:'0.35em', color:'rgba(2,6,23,0.4)', fontWeight:900, textTransform:'uppercase', margin:'0 0 4px 0' }}>God Mode Activo</p>
        <h2 style={{ fontSize:'22px', fontWeight:900, color:'#020617', margin:'0 0 6px 0', lineHeight:1.1 }}>
          Bienvenido a<br />Changuito Express
        </h2>
        <p style={{ fontSize:'12px', color:'rgba(2,6,23,0.55)', fontWeight:600, margin:0 }}>Panel de control operativo</p>
        <div style={{ position:'absolute', right:'20px', top:'50%', transform:'translateY(-50%)', opacity:0.15 }}>
          <ShoppingCart style={{ width:'72px', height:'72px', color:'#020617' }} />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
        {kpis.map(function(kpi) {
          const IconComp = kpi.Icon;
          return (
            <div key={kpi.label} style={{ background:'#0f172a', border:`1px solid ${kpi.border}`, borderRadius:'20px', padding:'18px', display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'12px', background:kpi.bg, border:`1px solid ${kpi.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <IconComp style={{ width:'18px', height:'18px', color:kpi.color }} />
              </div>
              <div>
                <p style={{ fontSize:'32px', fontWeight:900, color:kpi.color, margin:0, lineHeight:1 }}>{kpi.value}</p>
                <p style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(255,255,255,0.3)', margin:'4px 0 0 0' }}>{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background:'#0f172a', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'20px', overflow:'hidden' }}>
        <p style={{ fontSize:'9px', letterSpacing:'0.35em', color:'rgba(255,255,255,0.2)', fontWeight:900, textTransform:'uppercase', padding:'16px 18px 12px', margin:0, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
          Acciones Rápidas
        </p>
        {actions.map(function(action, i) {
          return (
            <button key={action.label} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'transparent', border:'none', borderBottom: i < actions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', color:action.color, fontSize:'13px', fontWeight:700, cursor:'pointer', textAlign:'left' }}>
              <span style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:action.color, display:'inline-block' }} />
                {action.label}
              </span>
              <ChevronRight style={{ width:'15px', height:'15px', opacity:0.35 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTE RAÍZ — App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [booting, setBooting] = useState<boolean>(true);
  const [rol, setRol]         = useState<Rol>(null);
  const [dbError, setDbError] = useState<boolean>(false);
  const { toasts, addToast }  = useToast();

  useEffect(function() {
    let mounted = true;

    // Busca el rol. Si no hay fila en perfiles, la crea con el rol del metadata.
    async function fetchRol(userId: string, metadata?: Record<string, any>): Promise<string> {
      try {
        const result = await Promise.race([
          supabase.from('perfiles').select('rol').eq('id', userId).maybeSingle(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        const rolExistente = (result as any)?.data?.rol;
        if (rolExistente) return rolExistente;

        // No hay perfil todavía — lo creamos con el rol elegido en el registro
        const rolInicial = metadata?.rol ?? 'cliente';
        const fila: Record<string, any> = { id: userId, rol: rolInicial };
        if (metadata?.nombre_negocio) fila.nombre_negocio = metadata.nombre_negocio;
        if (metadata?.direccion)      fila.direccion      = metadata.direccion;
        await supabase.from('perfiles').upsert(fila);
        return rolInicial;
      } catch {
        return 'cliente';
      }
    }

    async function inicializar() {
      try {
        const { data: { session: s }, error } = await supabase.auth.getSession();

        if (!mounted) return;
        if (error) throw error;

        if (s) {
          setSession({ user: { id: s.user.id, email: s.user.email } });
          setRol('cliente');
          setBooting(false);

          const rolReal = await fetchRol(s.user.id);
          if (mounted) setRol(rolReal);
        } else {
          setBooting(false);
        }
      } catch {
        if (mounted) {
          setSession(null);
          setRol(null);
          setBooting(false);
        }
      }
    }

    inicializar();

    const listener = supabase.auth.onAuthStateChange(async function(_event, s) {
      if (!mounted) return;
      if (s) {
        setSession({ user: { id: s.user.id, email: s.user.email } });
        setRol('cliente');
        const rolReal = await fetchRol(s.user.id, s.user.user_metadata ?? {});
        if (mounted) setRol(rolReal as Rol);
      } else {
        setSession(null);
        setRol(null);
      }
    });

    return function() {
      mounted = false;
      listener.data.subscription.unsubscribe();
    };
  }, []);

  // 1. Mostrar Error de Conexión si falla Supabase
  if (dbError) {
    return <ErrorConexion onReintentar={() => { setDbError(false); setBooting(true); }} />;
  }

  // 2. Mostrar pantalla de carga
  if (booting) {
    return (
      <div style={{ minHeight:'100vh', background:'#020617', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'18px', background:'#facc15', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 32px rgba(250,204,21,0.3)' }}>
            <ShoppingCart style={{ width:'26px', height:'26px', color:'#020617' }} />
          </div>
          <p style={{ fontSize:'10px', letterSpacing:'0.4em', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', fontWeight:700 }}>Iniciando...</p>
        </div>
      </div>
    );
  }

  // 3. Renderizar la vista correspondiente según Auth y Rol
  return (
    <React.Fragment>
      <ToastRack toasts={toasts} />
      {session === null
        ? <AuthScreen onToast={addToast} />
        : <RoleBasedRedirect
            session={session}
            rol={rol ?? 'cliente'}
            onSignOut={function() { supabase.auth.signOut(); }}
            renderAdmin={function() { return <AdminDashboard session={session} />; }}
          />
      }
    </React.Fragment>
  );
}
