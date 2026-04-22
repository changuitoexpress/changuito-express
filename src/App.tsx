/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Sun, Moon, Mail, Lock, LogIn, UserPlus, ShoppingCart } from 'lucide-react';
import Dashboard from './Dashboard';
import BazarVecinal from './BazarVecinal';
import Servicios from './Servicios';
import AdminGodMode from './AdminGodMode';

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL: string      = import.meta.env.VITE_SUPABASE_URL      ?? '';
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type Theme = 'light' | 'dark';
export interface AppSession { user: { id: string; email?: string }; }
export interface Toast { id: number; text: string; kind: 'error' | 'success' | 'info'; }
type Pantalla = 'dashboard' | 'bazar' | 'servicios' | 'admin';

// ─── Tema: aplicar antes del primer paint ─────────────────────────────────────
try {
  const t = localStorage.getItem('changuito-theme');
  const d = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', (t === 'dark' || t === 'light') ? t : d ? 'dark' : 'light');
} catch(e) {}

// ─── Hook Tema ────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<Theme>(function() {
    try {
      const t = localStorage.getItem('changuito-theme');
      if (t === 'dark' || t === 'light') return t as Theme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch { return 'dark'; }
  });

  function toggle() {
    setTheme(function(prev) {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('changuito-theme', next); } catch(e) {}
      return next;
    });
  }

  return { theme, toggle };
}

// ─── Hook Toast ───────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  function push(text: string, kind: Toast['kind'] = 'info') {
    const id = ++n.current;
    setToasts(function(p) { return [...p, { id, text, kind }]; });
    setTimeout(function() { setToasts(function(p) { return p.filter(function(t) { return t.id !== id; }); }); }, 4000);
  }
  return { toasts, push };
}

// ─── Toast Rack ───────────────────────────────────────────────────────────────
function ToastRack(props: { toasts: Toast[] }) {
  const s: Record<Toast['kind'], React.CSSProperties> = {
    error:   { background:'var(--color-red-dim)',    border:'1px solid var(--color-red)',    color:'var(--color-red)'    },
    success: { background:'var(--color-green-dim)',  border:'1px solid var(--color-green)',  color:'var(--color-green)'  },
    info:    { background:'var(--color-yellow-dim)', border:'1px solid var(--color-yellow)', color:'var(--color-yellow)' },
  };
  return (
    <div style={{ position:'fixed', top:'16px', right:'16px', zIndex:10000, display:'flex', flexDirection:'column', gap:'8px', pointerEvents:'none' }}>
      {props.toasts.map(function(t) {
        return <div key={t.id} className="fade-in" style={{ padding:'12px 16px', borderRadius:'14px', fontSize:'13px', fontWeight:600, boxShadow:'var(--shadow-float)', ...s[t.kind] }}>{t.text}</div>;
      })}
    </div>
  );
}

// ─── Theme Toggle (exportado) ─────────────────────────────────────────────────
export function ThemeToggle(props: { theme: Theme; onToggle: () => void }) {
  const isDark = props.theme === 'dark';
  return (
    <button onClick={props.onToggle} style={{ width:'44px', height:'26px', borderRadius:'13px', position:'relative', background:isDark?'rgba(250,204,21,0.2)':'rgba(0,0,0,0.12)', border:isDark?'1px solid rgba(250,204,21,0.4)':'1px solid rgba(0,0,0,0.15)', flexShrink:0 }}>
      <span style={{ position:'absolute', top:'3px', left:isDark?'21px':'3px', width:'18px', height:'18px', borderRadius:'50%', background:isDark?'#facc15':'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center', transition:'left 0.2s ease' }}>
        {isDark ? <Moon style={{ width:'10px', height:'10px', color:'#020617' }} /> : <Sun style={{ width:'10px', height:'10px', color:'white' }} />}
      </span>
    </button>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen(props: { theme: Theme; onThemeToggle: () => void; onToast: (t: string, k: Toast['kind']) => void }) {
  const [mode, setMode]         = useState<'login'|'register'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState('');
  const isDark = props.theme === 'dark';
  const isLogin = mode === 'login';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { props.onToast('Completá todos los campos.', 'error'); return; }
    if (password.length < 6)  { props.onToast('Mínimo 6 caracteres.', 'error'); return; }
    setLoading(true);
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        props.onToast('Revisá tu email para confirmar.', 'success');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch(err: any) {
      props.onToast(err.message ?? 'Error inesperado.', 'error');
    } finally { setLoading(false); }
  }

  const inputBg = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)';
  const ib = function(f: string) {
    return focused === f ? '1px solid rgba(250,204,21,0.6)' : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.12)';
  };

  return (
    <div className="fade-in" style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', position:'relative' }}>
      <div style={{ position:'absolute', inset:0, opacity:isDark?0.03:0.06, backgroundImage:'radial-gradient(circle, var(--text-primary) 1px, transparent 1px)', backgroundSize:'28px 28px', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'16px', right:'16px', zIndex:10 }}>
        <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
      </div>
      <div style={{ width:'100%', maxWidth:'380px', position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'68px', height:'68px', borderRadius:'22px', background:'#facc15', boxShadow:'0 8px 24px rgba(250,204,21,0.4)', marginBottom:'16px' }}>
            <ShoppingCart style={{ width:'32px', height:'32px', color:'#020617' }} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize:'26px', fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.04em', lineHeight:1, margin:0 }}>
            CHANGUITO<br /><span style={{ color:'#facc15' }}>EXPRESS</span>
          </h1>
          <p style={{ fontSize:'10px', letterSpacing:'0.35em', color:'var(--text-muted)', fontWeight:700, textTransform:'uppercase', marginTop:'8px' }}>
            Lomas · Clúster Toscana
          </p>
        </div>
        <div style={{ background:isDark?'#16161e':'#ffffff', border:isDark?'1px solid rgba(255,255,255,0.07)':'1px solid rgba(0,0,0,0.08)', borderRadius:'28px', padding:'28px', boxShadow:'var(--shadow-float)' }}>
          <div style={{ display:'flex', background:isDark?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.05)', borderRadius:'16px', padding:'4px', marginBottom:'24px' }}>
            {(['login','register'] as const).map(function(m) {
              const active = mode === m;
              return (
                <button key={m} onClick={function() { setMode(m); }} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'10px', borderRadius:'12px', fontSize:'11px', fontWeight:900, textTransform:'uppercase', letterSpacing:'0.1em', background:active?'#facc15':'transparent', color:active?'#020617':'var(--text-muted)', boxShadow:active?'0 4px 12px rgba(250,204,21,0.3)':'none' }}>
                  {m === 'login' ? <><LogIn style={{ width:'12px', height:'12px' }} /> Entrar</> : <><UserPlus style={{ width:'12px', height:'12px' }} /> Registro</>}
                </button>
              );
            })}
          </div>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ position:'relative' }}>
              <Mail style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', width:'15px', height:'15px', color:focused==='email'?'#facc15':'var(--text-muted)', pointerEvents:'none' }} />
              <input type="email" placeholder="tu@email.com" autoComplete="email" value={email}
                onChange={function(e) { setEmail(e.target.value); }}
                onFocus={function() { setFocused('email'); }} onBlur={function() { setFocused(''); }}
                style={{ width:'100%', boxSizing:'border-box', background:inputBg, border:ib('email'), borderRadius:'14px', padding:'14px 14px 14px 40px', color:'var(--text-primary)', fontSize:'14px', outline:'none' }} />
            </div>
            <div style={{ position:'relative' }}>
              <Lock style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', width:'15px', height:'15px', color:focused==='pass'?'#facc15':'var(--text-muted)', pointerEvents:'none' }} />
              <input type="password" placeholder="Contraseña (mín. 6 caracteres)" autoComplete={isLogin?'current-password':'new-password'} value={password}
                onChange={function(e) { setPassword(e.target.value); }}
                onFocus={function() { setFocused('pass'); }} onBlur={function() { setFocused(''); }}
                style={{ width:'100%', boxSizing:'border-box', background:inputBg, border:ib('pass'), borderRadius:'14px', padding:'14px 14px 14px 40px', color:'var(--text-primary)', fontSize:'14px', outline:'none' }} />
            </div>
            <button type="submit" disabled={loading} style={{ width:'100%', background:loading?'rgba(250,204,21,0.5)':'#facc15', color:'#020617', fontWeight:900, fontSize:'13px', textTransform:'uppercase', letterSpacing:'0.12em', padding:'15px', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow:loading?'none':'0 6px 20px rgba(250,204,21,0.35)', marginTop:'4px', cursor:loading?'not-allowed':'pointer' }}>
              {loading ? <span className="spinner" style={{ borderTopColor:'#020617', borderColor:'rgba(2,6,23,0.25)' }} /> : isLogin ? <><LogIn style={{ width:'15px', height:'15px' }} /> Entrar al Bazar</> : <><UserPlus style={{ width:'15px', height:'15px' }} /> Crear Cuenta VIP</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]     = useState<AppSession | null>(null);
  const [booting, setBooting]     = useState<boolean>(true);
  const [pantalla, setPantalla]   = useState<Pantalla>('dashboard');
  const { theme, toggle }         = useTheme();
  const { toasts, push }          = useToast();

  useEffect(function() {
    let mounted = true;
    async function init() {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (mounted && s) setSession({ user: { id: s.user.id, email: s.user.email } });
      } catch { } finally { if (mounted) setBooting(false); }
    }
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(function(_ev, s) {
      if (!mounted) return;
      if (s) setSession({ user: { id: s.user.id, email: s.user.email } });
      else   setSession(null);
    });
    return function() { mounted = false; subscription.unsubscribe(); };
  }, []);

  if (booting) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px' }}>
          <div style={{ width:'52px', height:'52px', borderRadius:'18px', background:'#facc15', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 28px rgba(250,204,21,0.4)' }}>
            <ShoppingCart style={{ width:'26px', height:'26px', color:'#020617' }} />
          </div>
          <span className="spinner" style={{ borderColor:'var(--border-subtle)', borderTopColor:'#facc15', width:'22px', height:'22px' }} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <ToastRack toasts={toasts} />
        <AuthScreen theme={theme} onThemeToggle={toggle} onToast={push} />
      </>
    );
  }

  // ── Navegación entre pantallas ───────────────────────────────────────────────
  return (
    <>
      <ToastRack toasts={toasts} />

      {pantalla === 'dashboard' && (
        <Dashboard
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onIrBazar={function(){ setPantalla('bazar'); }}
          onIrServicios={function(){ setPantalla('servicios'); }}
          onIrAdmin={function(){ setPantalla('admin'); }}
        />
      )}

      {pantalla === 'admin' && (
        <AdminGodMode
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function(){ setPantalla('dashboard'); }}
        />
      )}

      {pantalla === 'bazar' && (
        <BazarVecinal
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function(){ setPantalla('dashboard'); }}
        />
      )}

      {pantalla === 'servicios' && (
        <Servicios
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function(){ setPantalla('dashboard'); }}
        />
      )}
    </>
  );
}
