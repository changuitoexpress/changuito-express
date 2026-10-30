/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, {
  lazy,
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Sun,
  Moon,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  ShoppingCart,
  User,
  X,
  Eye,
  EyeOff,
  MapPin,
} from "lucide-react";
const Dashboard = lazy(function () {
  return import("./Dashboard");
});
const BazarVecinal = lazy(function () {
  return import("./BazarVecinal");
});
const Servicios = lazy(function () {
  return import("./Servicios");
});
const AdminGodMode = lazy(function () {
  return import("./AdminGodMode");
});
const ChanguiShopping = lazy(function () {
  return import("./ChanguiShopping");
});
const DashboardNegocio = lazy(function () {
  return import("./DashboardNegocio");
});
const RepasDashboard = lazy(function () {
  return import("./RepasDashboard");
});
const BienesRaices = lazy(function () {
  return import("./BienesRaices");
});
const VentaAutos = lazy(function () {
  return import("./VentaAutos");
});
const ChangoMonedero = lazy(function () {
  return import("./ChangoMonedero");
});
import {
  completeProfileSetup,
  resendConfirmationEmail,
  startAuthSession,
  scheduleSessionExpiryWarning,
  submitAuthForm,
  validateAuthForm,
} from "./authFlows";
import ChanguitoLoader from "./components/ChanguitoLoader";
import { normalizeSupabaseUrl } from "./supabaseUrl";

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL: string = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const profileRecoveryClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storageKey: "changuito-profile-recovery-session",
  },
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type Theme = "light" | "dark";
export interface AppSession {
  expiresAt?: number;
  user: { id: string; email?: string; nombre?: string; rol?: string };
}
export interface Toast {
  id: number;
  text: string;
  kind: "error" | "success" | "info";
}
type Pantalla =
  | "dashboard"
  | "bazar"
  | "servicios"
  | "admin"
  | "shopping"
  | "negocio"
  | "repas"
  | "bienes"
  | "autos"
  | "monedero";

const NOMBRES_PANTALLA: Record<Pantalla, string> = {
  dashboard: "Inicio",
  bazar: "Bazar Vecinal",
  servicios: "Directorio Telefónico",
  admin: "Panel de Control",
  shopping: "ChanguiShopping",
  negocio: "Panel de Negocios",
  repas: "Panel Repartidor",
  bienes: "Bienes Raíces",
  autos: "Venta de Autos",
  monedero: "ChangoMonedero",
};

// ─── Tema: aplicar antes del primer paint ─────────────────────────────────────
try {
  const t = localStorage.getItem("changuito-theme");
  const d = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute(
    "data-theme",
    t === "dark" || t === "light" ? t : d ? "dark" : "light",
  );
} catch (e) {}

// ─── Hook Tema ────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<Theme>(function () {
    try {
      const t = localStorage.getItem("changuito-theme");
      if (t === "dark" || t === "light") return t as Theme;
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch {
      return "dark";
    }
  });

  function toggle() {
    setTheme(function (prev) {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("changuito-theme", next);
      } catch (e) {}
      return next;
    });
  }

  return { theme, toggle };
}

// ─── Hook Toast ───────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  function push(text: string, kind: Toast["kind"] = "info") {
    const id = ++n.current;
    setToasts(function (p) {
      return [...p, { id, text, kind }];
    });
    setTimeout(function () {
      setToasts(function (p) {
        return p.filter(function (t) {
          return t.id !== id;
        });
      });
    }, 4000);
  }
  return { toasts, push };
}

// ─── Toast Rack ───────────────────────────────────────────────────────────────
function ToastRack(props: { toasts: Toast[] }) {
  const s: Record<Toast["kind"], React.CSSProperties> = {
    error: {
      background: "var(--color-red-dim)",
      border: "1px solid var(--color-red)",
      color: "var(--color-red)",
    },
    success: {
      background: "var(--color-green-dim)",
      border: "1px solid var(--color-green)",
      color: "var(--color-green)",
    },
    info: {
      background: "var(--color-yellow-dim)",
      border: "1px solid var(--color-yellow)",
      color: "var(--color-yellow)",
    },
  };
  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      {props.toasts.map(function (t) {
        return (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            aria-live={t.kind === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            className="fade-in"
            style={{
              padding: "12px 16px",
              borderRadius: "14px",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "var(--shadow-float)",
              ...s[t.kind],
            }}
          >
            {t.text}
          </div>
        );
      })}
    </div>
  );
}

// ─── Theme Toggle (exportado) ─────────────────────────────────────────────────
export function ThemeToggle(props: { theme: Theme; onToggle: () => void }) {
  const isDark = props.theme === "dark";
  return (
    <button
      onClick={props.onToggle}
      style={{
        width: "44px",
        height: "26px",
        borderRadius: "13px",
        position: "relative",
        background: isDark ? "rgba(250,204,21,0.2)" : "rgba(0,0,0,0.12)",
        border: isDark
          ? "1px solid rgba(250,204,21,0.4)"
          : "1px solid rgba(0,0,0,0.15)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: isDark ? "21px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: isDark ? "#facc15" : "#0a0a0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "left 0.2s ease",
        }}
      >
        {isDark ? (
          <Moon style={{ width: "10px", height: "10px", color: "#020617" }} />
        ) : (
          <Sun style={{ width: "10px", height: "10px", color: "white" }} />
        )}
      </span>
    </button>
  );
}

// ─── PWA Install ──────────────────────────────────────────────────────────────
function usePWAInstall() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(function () {
    try {
      return localStorage.getItem("pwa-dismissed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(function () {
    function handler(e: any) {
      e.preventDefault();
      setPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handler as any);
    return function () {
      window.removeEventListener("beforeinstallprompt", handler as any);
    };
  }, []);
  function instalar() {
    if (!prompt) return;
    prompt.prompt();
    prompt.userChoice.then(function () {
      setPrompt(null);
    });
  }
  function descartar() {
    setDismissed(true);
    try {
      localStorage.setItem("pwa-dismissed", "1");
    } catch {}
    setPrompt(null);
  }
  return { mostrar: !!prompt && !dismissed, instalar, descartar };
}

function PWABanner(props: { onInstalar: () => void; onDescartar: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "448px",
        zIndex: 950,
        background: "#16161e",
        border: "1px solid rgba(250,204,21,0.4)",
        borderRadius: "20px",
        padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "13px",
          background: "#facc15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ShoppingCart
          style={{ width: "22px", height: "22px", color: "#020617" }}
          strokeWidth={2.5}
        />
      </div>
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 900,
            color: "#f0f0f8",
            margin: "0 0 2px 0",
          }}
        >
          Instalar Changuito Express
        </p>
        <p style={{ fontSize: "11px", color: "#55556a", margin: 0 }}>
          Acceso rápido desde tu pantalla de inicio
        </p>
      </div>
      <button
        onClick={props.onInstalar}
        style={{
          padding: "8px 14px",
          borderRadius: "12px",
          background: "#facc15",
          color: "#020617",
          fontWeight: 900,
          fontSize: "11px",
          border: "none",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Instalar
      </button>
      <button
        onClick={props.onDescartar}
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <X style={{ width: "14px", height: "14px", color: "#55556a" }} />
      </button>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen(props: {
  theme: Theme;
  onThemeToggle: () => void;
  onToast: (t: string, k: Toast["kind"]) => void;
  authMonitoringUnavailable: boolean;
  onRetryAuthMonitoring: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "recover-profile">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [focused, setFocused] = useState("");
  const isDark = props.theme === "dark";
  const isLogin = mode === "login";

  async function handleGuestAccess() {
    if (guestLoading || loading || resendingConfirmation) return;
    setGuestLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        const message = error.message ?? "";
        const anonymousDisabled =
          /anonymous sign[- ]ins? (?:are )?disabled|anonymous provider.*disabled/i.test(
            message,
          );
        props.onToast(
          anonymousDisabled
            ? "El acceso sin registro aún no está activado en Supabase. Activa Anonymous Sign-Ins en Authentication y vuelve a intentarlo."
            : message || "No pudimos iniciar como invitado. Intenta de nuevo.",
          "error",
        );
        return;
      }
      if (!data.session?.user?.id) {
        props.onToast(
          "Supabase no devolvió una sesión de invitado. Intenta de nuevo.",
          "error",
        );
      }
    } catch (error: any) {
      props.onToast(
        error?.message ?? "No pudimos iniciar como invitado. Intenta de nuevo.",
        "error",
      );
    } finally {
      setGuestLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (loading || resendingConfirmation) return;
    setResendingConfirmation(true);
    try {
      const result = await resendConfirmationEmail(profileRecoveryClient, email);
      props.onToast(
        result.message,
        result.status === "sent" ? "success" : "error",
      );
    } finally {
      setResendingConfirmation(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values = { mode, email, password, nombre };
    const validationError = validateAuthForm(values);
    if (validationError) {
      props.onToast(validationError, "error");
      return;
    }
    setLoading(true);
    try {
      const result =
        mode === "recover-profile"
          ? await completeProfileSetup(profileRecoveryClient, values)
          : await submitAuthForm(supabase, values);
      if (result.status === "error") {
        props.onToast(result.message ?? "Error inesperado.", "error");
      } else if (result.status === "profile-incomplete") {
        props.onToast(result.message ?? "No pudimos guardar tu perfil.", "error");
        setMode("recover-profile");
      } else if (result.status === "profile-completed") {
        props.onToast(
          result.message ?? "Tu perfil quedó configurado. Ya podés iniciar sesión.",
          "success",
        );
        setMode("login");
      } else if (result.status === "registered") {
        props.onToast(result.message ?? "Revisá tu email para confirmar.", "success");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputBg = isDark ? "rgba(5,26,16,0.56)" : "#f1f7f2";
  const surface = isDark ? "#162b24" : "#ffffff";
  const border = isDark ? "rgba(235,241,225,0.12)" : "rgba(33,55,57,0.12)";
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: inputBg,
    borderRadius: "13px",
    padding: "14px 14px 14px 44px",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
    minHeight: "52px",
    transition: "border-color 160ms ease, background 160ms ease",
  };
  const ib = function (f: string) {
    return focused === f
      ? "1px solid var(--color-blue)"
      : isDark
        ? "1px solid rgba(235,241,225,0.15)"
        : "1px solid rgba(33,55,57,0.16)";
  };

  return (
    <div
      className="auth-screen fade-in"
      style={{
        minHeight: "100dvh",
        background: isDark ? "#0c1b17" : "#f3f8f4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(18px, 4vw, 48px)",
        position: "relative",
        overflow: "hidden",
        color: "var(--text-primary)",
      }}
    >
      <style>{`
        .auth-screen, .auth-screen * { box-sizing: border-box; }
        .auth-shell { position: relative; }
        .auth-shell::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 6px; z-index: 1; background: linear-gradient(90deg,#159447 0% 25%,#F6C945 25% 50%,#E84844 50% 75%,#2979DA 75% 100%); }
        .auth-screen button { font: inherit; }
        .auth-screen button:focus-visible, .auth-screen input:focus-visible {
          outline: 3px solid var(--color-blue) !important;
          outline-offset: 3px;
        }
        .auth-shell { width: 100%; max-width: 1030px; display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(390px, .98fr); border-radius: 30px; overflow: hidden; box-shadow: 0 28px 90px rgba(15,35,39,.18); animation: auth-arrive .55s cubic-bezier(.2,.75,.25,1) both; }
        .auth-story { position: relative; min-height: 660px; overflow: hidden; }
        .auth-form-panel { padding: clamp(28px, 5vw, 58px); }
        .auth-mobile-mark { display: none !important; }
        .auth-field-label { display: block; margin: 0 0 7px 2px; color: var(--text-muted); font-size: 12px; font-weight: 700; letter-spacing: .02em; }
        @keyframes auth-arrive { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 760px) {
          .auth-screen { align-items: flex-start !important; padding: 76px 16px 24px !important; }
          .auth-shell { max-width: 490px; display: flex; flex-direction: column; border-radius: 24px; }
          .auth-story { display: none !important; }
          .auth-form-panel { padding: 24px clamp(20px, 6vw, 32px) 26px; }
          .auth-mobile-mark { display: flex !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-shell { animation: none; }
          .auth-screen * { scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
      `}</style>
      <div
        style={{ position: "absolute", top: "18px", right: "20px", zIndex: 10 }}
      >
        <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
      </div>
      <main className="auth-shell" style={{ position: "relative", zIndex: 1, border: `1px solid ${border}` }}>
        <section className="auth-story" aria-label="Changuito Express en Lomas y Puebla" style={{ background: "#F6C945", color: "#18353a", padding: "clamp(34px, 5vw, 58px)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ position: "absolute", inset: 0, opacity: .12, backgroundImage: "radial-gradient(circle, #18353a 1px, transparent 1.2px)", backgroundSize: "17px 17px", maskImage: "linear-gradient(135deg, black, transparent 74%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: "330px", height: "330px", border: "1px solid rgba(24,53,58,.2)", borderRadius: "50%", right: "-126px", top: "104px", boxShadow: "0 0 0 34px rgba(24,53,58,.045), 0 0 0 68px rgba(24,53,58,.035)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "48px", height: "48px", display: "grid", placeItems: "center", borderRadius: "15px", background: "#18353a", color: "#f4c85b" }}>
                <ShoppingCart size={24} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: "13px", lineHeight: 1.1, fontWeight: 900, letterSpacing: ".11em" }}>CHANGUITO<br /><span style={{ fontWeight: 600, letterSpacing: ".2em" }}>EXPRESS</span></div>
            </div>
            <div style={{ marginTop: "clamp(65px, 10vh, 112px)", maxWidth: "400px" }}>
              <p style={{ margin: "0 0 18px", textTransform: "uppercase", fontSize: "11px", letterSpacing: ".19em", fontWeight: 900 }}>Tu barrio, a un pedido de distancia</p>
              <h1 style={{ margin: 0, fontSize: "clamp(38px, 5vw, 58px)", lineHeight: .98, letterSpacing: "-.055em", fontWeight: 900 }}>Lo de aquí,<br />llega contigo.</h1>
              <p style={{ margin: "22px 0 0", maxWidth: "330px", fontSize: "15px", lineHeight: 1.65, color: "rgba(24,53,58,.84)" }}>Comida de tus lugares favoritos y mandados de confianza, cerca de casa.</p>
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "16px", fontSize: "12px", fontWeight: 800 }}>
              <MapPin size={16} /> LOMAS · PUEBLA
            </div>
            <div style={{ width: "100%", height: "1px", background: "rgba(24,53,58,.22)", marginBottom: "14px" }} />
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(24,53,58,.76)" }}>Hecho para moverse como se mueve tu comunidad.</p>
          </div>
        </section>
        <section className="auth-form-panel" style={{ background: surface }}>
          <div className="auth-mobile-mark" style={{ alignItems: "center", gap: "11px", marginBottom: "26px" }}>
            <div style={{ width: "42px", height: "42px", display: "grid", placeItems: "center", borderRadius: "14px", background: "#d99a25", color: "#18353a" }}><ShoppingCart size={21} /></div>
            <div style={{ fontSize: "12px", lineHeight: 1.15, fontWeight: 900, letterSpacing: ".1em" }}>CHANGUITO<br /><span style={{ letterSpacing: ".19em", fontWeight: 600 }}>EXPRESS</span></div>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", color: "var(--text-muted)", fontSize: "10px", fontWeight: 800, letterSpacing: ".1em" }}><MapPin size={13} /> LOMAS</span>
          </div>
          <div style={{ marginBottom: "25px" }}>
            <p style={{ margin: "0 0 8px", color: "#b87c13", fontSize: "11px", fontWeight: 900, letterSpacing: ".15em", textTransform: "uppercase" }}>{mode === "recover-profile" ? "Recupera tu perfil" : isLogin ? "Qué bueno verte" : "Una cuenta para tu barrio"}</p>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "clamp(25px, 3vw, 31px)", letterSpacing: "-.045em", lineHeight: 1.1, fontWeight: 850 }}>{mode === "recover-profile" ? "Completa tus datos" : isLogin ? "Entra a Changuito" : "Crea tu cuenta"}</h2>
            <p style={{ margin: "9px 0 0", color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.5 }}>{mode === "recover-profile" ? "Confirma tu email y completa el perfil de tu cuenta." : isLogin ? "Pide lo que necesitas. Nosotros lo acercamos." : "Empieza con tus restaurantes y servicios favoritos."}</p>
          </div>
          <div
            style={{
              display: "flex",
              background: isDark ? "rgba(5,16,26,.55)" : "#f1eddf",
              borderRadius: "14px",
              padding: "4px",
              marginBottom: "22px",
            }}
          >
            {(["login", "register"] as const).map(function (m) {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={function () {
                    setMode(m);
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "11px 9px",
                    minHeight: "44px",
                    borderRadius: "11px",
                    fontSize: "12px",
                    fontWeight: 900,
                    letterSpacing: "0.01em",
                    background: active ? "var(--color-yellow)" : "transparent",
                    color: active ? "#18353a" : "var(--text-muted)",
                    boxShadow: active
                      ? "0 3px 9px rgba(112,76,14,.15)"
                      : "none",
                    cursor: "pointer",
                  }}
                  aria-pressed={active}
                >
                  {m === "login" ? (
                    <>
                      <LogIn style={{ width: "15px", height: "15px" }} /> Entrar
                    </>
                  ) : (
                    <>
                      <UserPlus style={{ width: "15px", height: "15px" }} />{" "}
                      Crear cuenta
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
          >
            {isLogin && props.authMonitoringUnavailable && (
              <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                style={{
                  padding: "12px",
                  borderRadius: "14px",
                  background: "var(--color-yellow-dim)",
                  border: "1px solid var(--color-yellow)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                <p style={{ margin: "0 0 8px" }}>
                  No podemos comprobar el inicio de sesión en este momento.
                  Aunque tus credenciales sean correctas, no podremos abrir tu
                  cuenta hasta que se restablezca la conexión. Podés reintentar
                  ahora.
                </p>
                <button
                  type="button"
                  onClick={props.onRetryAuthMonitoring}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "10px",
                    background: "#facc15",
                    color: "#020617",
                    fontWeight: 800,
                    fontSize: "12px",
                  }}
                >
                  Reintentar
                </button>
              </div>
            )}
            {mode === "recover-profile" && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  margin: "0 0 3px",
                }}
              >
                Confirmá tu email y completá estos datos para guardar tu perfil
                en la cuenta existente.
              </p>
            )}
            {!isLogin && (
              <div>
                <label className="auth-field-label" htmlFor="auth-name">Nombre completo</label>
                <div style={{ position: "relative" }}>
                <User
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "15px",
                    height: "15px",
                    color:
                      focused === "nombre" ? "#b87c13" : "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  id="auth-name"
                  placeholder="Cómo te llamamos"
                  aria-label="Nombre completo"
                  required
                  autoComplete="name"
                  value={nombre}
                  onChange={function (e) {
                    setNombre(e.target.value);
                  }}
                  onFocus={function () {
                    setFocused("nombre");
                  }}
                  onBlur={function () {
                    setFocused("");
                  }}
                  style={{
                    ...fieldStyle,
                    border: ib("nombre"),
                  }}
                />
                </div>
              </div>
            )}
            <div>
              <label className="auth-field-label" htmlFor="auth-email">Correo electrónico</label>
              <div style={{ position: "relative" }}>
              <Mail
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "15px",
                  height: "15px",
                  color: focused === "email" ? "#b87c13" : "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="email"
                id="auth-email"
                placeholder="nombre@correo.com"
                aria-label="Correo electrónico"
                required
                autoComplete="email"
                value={email}
                onChange={function (e) {
                  setEmail(e.target.value);
                }}
                onFocus={function () {
                  setFocused("email");
                }}
                onBlur={function () {
                  setFocused("");
                }}
                style={{
                  ...fieldStyle,
                  border: ib("email"),
                }}
              />
              </div>
            </div>
            <div>
              <label className="auth-field-label" htmlFor="auth-password">Contraseña</label>
              <div style={{ position: "relative" }}>
              <Lock
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "15px",
                  height: "15px",
                  color: focused === "pass" ? "#b87c13" : "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type={showPassword ? "text" : "password"}
                id="auth-password"
                placeholder="Mínimo 6 caracteres"
                aria-label="Contraseña"
                required
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={function (e) {
                  setPassword(e.target.value);
                }}
                onFocus={function () {
                  setFocused("pass");
                }}
                onBlur={function () {
                  setFocused("");
                }}
                style={{
                  ...fieldStyle,
                  border: ib("pass"),
                  paddingRight: "54px",
                }}
              />
              <button type="button" onClick={function () { setShowPassword(function (visible) { return !visible; }); }} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} style={{ position: "absolute", right: "5px", top: "5px", width: "42px", height: "42px", display: "grid", placeItems: "center", border: 0, borderRadius: "10px", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              </div>
              <p style={{ margin: "7px 0 0 2px", color: "var(--text-muted)", fontSize: "11px" }}>Usa al menos 6 caracteres.</p>
            </div>
            <button
              type="submit"
              disabled={loading || resendingConfirmation}
              style={{
                width: "100%",
                background:
                  loading || resendingConfirmation
                    ? "rgba(250,204,21,0.5)"
                    : "var(--color-green)",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: "14px",
                letterSpacing: "0.01em",
                padding: "15px",
                minHeight: "54px",
                borderRadius: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: loading || resendingConfirmation
                  ? "none"
                  : "0 8px 18px rgba(112,76,14,0.17)",
                marginTop: "4px",
                cursor:
                  loading || resendingConfirmation ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <span
                  className="spinner"
                  style={{
                    borderTopColor: "#020617",
                    borderColor: "rgba(2,6,23,0.25)",
                  }}
                />
              ) : isLogin ? (
                <>
                  <LogIn style={{ width: "16px", height: "16px" }} /> Entrar
                </>
              ) : (
                <>
                  {mode === "recover-profile" ? (
                    <>
                      <User style={{ width: "15px", height: "15px" }} /> Completar
                      Perfil
                    </>
                  ) : (
                    <>
                      <UserPlus style={{ width: "16px", height: "16px" }} /> Crear
                      cuenta
                    </>
                  )}
                </>
              )}
            </button>
          </form>
          <button
            type="button"
            onClick={handleGuestAccess}
            disabled={guestLoading || loading || resendingConfirmation}
            aria-busy={guestLoading}
            style={{
              display: "block",
              width: "100%",
              margin: "14px 0 0",
              padding: "12px",
              minHeight: "48px",
              borderRadius: "12px",
              border: `1px solid ${border}`,
              background: guestLoading
                ? isDark
                  ? "rgba(235,241,225,.04)"
                  : "rgba(33,55,57,.04)"
                : "transparent",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: 700,
              cursor:
                guestLoading || loading || resendingConfirmation
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {guestLoading ? "Entrando como invitado…" : "Entrar sin registro"}
          </button>
          {mode === "recover-profile" && (
            <>
              <button
                type="button"
                disabled={loading || resendingConfirmation}
                aria-busy={resendingConfirmation}
                onClick={handleResendConfirmation}
                style={{
                  display: "block",
                  margin: "12px auto 0",
                   padding: "8px",
                   minHeight: "40px",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  textDecoration: "underline",
                  cursor:
                    loading || resendingConfirmation ? "not-allowed" : "pointer",
                }}
              >
                {resendingConfirmation
                  ? "Reenviando email..."
                  : "Reenviar email de confirmación"}
              </button>
              {resendingConfirmation && (
                <p role="status" aria-live="polite" aria-atomic="true">
                  Reenviando email de confirmación...
                </p>
              )}
            </>
          )}
          {isLogin && (
            <button
              type="button"
              onClick={function () {
                setMode("recover-profile");
              }}
              style={{
                display: "block",
                margin: "16px auto 0",
                 padding: "8px",
                 minHeight: "40px",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "12px",
                textDecoration: "underline",
              }}
            >
              ¿Confirmaste tu email y te falta el perfil? Completalo acá
            </button>
          )}
          {mode === "recover-profile" && (
            <button
              type="button"
              onClick={function () {
                setMode("login");
              }}
              style={{
                display: "block",
                margin: "12px auto 0",
                padding: "8px",
                minHeight: "40px",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "12px",
                textDecoration: "underline",
              }}
            >
              Volver a iniciar sesión
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [authMonitoringRetry, setAuthMonitoringRetry] = useState<
    (() => void) | null
  >(null);
  const [sessionExpiryWarning, setSessionExpiryWarning] = useState(false);
  const [booting, setBooting] = useState<boolean>(true);
  const [pantalla, setPantalla] = useState<Pantalla>("dashboard");
  const { theme, toggle } = useTheme();
  const { toasts, push } = useToast();
  const [carritoGlobal, setCarritoGlobal] = useState<any[]>(function () {
    try {
      const saved = localStorage.getItem("changuito-cart");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const pwa = usePWAInstall();

  // Persistir carrito en localStorage
  useEffect(
    function () {
      try {
        localStorage.setItem("changuito-cart", JSON.stringify(carritoGlobal));
      } catch (e) {}
    },
    [carritoGlobal],
  );

  // Prevenir que botón Atrás del celular cierre la app (PWA)
  useEffect(function () {
    history.pushState({ changuito: true }, '');
    function handlePop() {
      history.pushState({ changuito: true }, '');
      if (pantalla !== 'dashboard') setPantalla('dashboard');
    }
    window.addEventListener('popstate', handlePop);
    return function () { window.removeEventListener('popstate', handlePop); };
  }, [pantalla]);

  useEffect(function () {
    return startAuthSession(
      supabase,
      function (s) {
        setSession(s);
      },
      function () {
        setBooting(false);
      },
      undefined,
      function (available, retry) {
        setAuthMonitoringRetry(function () {
          return available ? null : retry;
        });
      },
    );
  }, []);

  useEffect(
    function () {
      setSessionExpiryWarning(false);
      const dismissalKey = session?.user.id
        ? "changuito.session-expiry-dismissed:" + session.user.id
        : null;
      let dismissedExpiry: string | null = null;
      try {
        dismissedExpiry = dismissalKey
          ? window.localStorage.getItem(dismissalKey)
          : null;
      } catch {
        dismissedExpiry = null;
      }
      if (
        typeof session?.expiresAt === "number" &&
        dismissedExpiry === String(session.expiresAt)
      ) {
        return function () {};
      }
      return scheduleSessionExpiryWarning(session?.expiresAt, function () {
        setSessionExpiryWarning(true);
      });
    },
    [session?.user.id, session?.expiresAt],
  );

  if (booting) {
    return <ChanguitoLoader />;
  }

  if (!session) {
    return (
      <>
        <ToastRack toasts={toasts} />
        <AuthScreen
          theme={theme}
          onThemeToggle={toggle}
          onToast={push}
          authMonitoringUnavailable={authMonitoringRetry !== null}
          onRetryAuthMonitoring={function () {
            authMonitoringRetry?.();
          }}
        />
      </>
    );
  }

  // ── Navegación entre pantallas ───────────────────────────────────────────────
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {NOMBRES_PANTALLA[pantalla]}
      </div>
      <ToastRack toasts={toasts} />
      {sessionExpiryWarning && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "fixed",
            zIndex: 10001,
            top: "calc(env(safe-area-inset-top, 0px) + 12px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(520px, calc(100% - 32px))",
            boxSizing: "border-box",
            overflow: "hidden",
            borderRadius: "14px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontWeight: 550,
            lineHeight: 1.4,
            boxShadow: "var(--shadow-float)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              height: "4px",
              background:
                "linear-gradient(90deg, #159447 0% 25%, #F6C945 25% 50%, #E84844 50% 75%, #2979DA 75% 100%)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 11px 10px 14px" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              Tu sesión está por vencer. Guarda tu trabajo; quizá tengas que iniciar sesión nuevamente.
            </span>
            <button
              type="button"
              aria-label="Descartar aviso de vencimiento de sesión"
              title="Cerrar aviso"
              onClick={function () {
                if (session?.user.id && typeof session.expiresAt === "number") {
                  try {
                    window.localStorage.setItem(
                      "changuito.session-expiry-dismissed:" + session.user.id,
                      String(session.expiresAt),
                    );
                  } catch {
                    // Dismiss the current banner even when browser storage is unavailable.
                  }
                }
                setSessionExpiryWarning(false);
              }}
              style={{
                width: "32px",
                height: "32px",
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: "10px",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-base)",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {pwa.mostrar && (
        <PWABanner onInstalar={pwa.instalar} onDescartar={pwa.descartar} />
      )}

      <Suspense
        fallback={<ChanguitoLoader />}
      >
      {pantalla === "dashboard" && (
        <Dashboard
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onIrBazar={function () {
            setPantalla("bazar");
          }}
          onIrServicios={function () {
            setPantalla("servicios");
          }}
          onIrAdmin={function () {
            setPantalla("admin");
          }}
          onIrShopping={function () {
            setPantalla("shopping");
          }}
          onIrRepas={function () {
            setPantalla("repas");
          }}
          onIrBienes={function () {
            setPantalla("bienes");
          }}
          onIrAutos={function () {
            setPantalla("autos");
          }}
          onIrMonedero={function () {
            setPantalla("monedero");
          }}
          // Agregado: Props del negocio y carrito
          carritoGlobal={carritoGlobal}
          onUpdateCarritoGlobal={setCarritoGlobal}
          onIrNegocio={function () {
            setPantalla("negocio");
          }}
          onAddToCart={function (items: any[]) {
            setCarritoGlobal(function (prev: any[]) {
              const nuevo = [...prev];
              items.forEach(function (item) {
                const idx = nuevo.findIndex(function (i) {
                  return i.id === item.id && i.negocio_id === item.negocio_id;
                });
                if (idx >= 0) nuevo[idx].cantidad = (nuevo[idx].cantidad || 1) + (item.cantidad || 1);
                else nuevo.push(item);
              });
              return nuevo;
            });
          }}
        />
      )}

      {pantalla === "bazar" && (
        <BazarVecinal
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
          onIrDashboard={function () {
            setPantalla("dashboard");
          }}
          onIrShopping={function () {
            setPantalla("shopping");
          }}
          onIrServicios={function () {
            setPantalla("servicios");
          }}
        />
      )}

      {pantalla === "servicios" && (
        <Servicios
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
          onIrDashboard={function () {
            setPantalla("dashboard");
          }}
          onIrBazar={function () {
            setPantalla("bazar");
          }}
          onIrShopping={function () {
            setPantalla("shopping");
          }}
        />
      )}

      {pantalla === "admin" && (
        <AdminGodMode
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
        />
      )}

      {pantalla === "shopping" && (
        <ChanguiShopping
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
          onIrDashboard={function () {
            setPantalla("dashboard");
          }}
          onIrBazar={function () {
            setPantalla("bazar");
          }}
          onIrServicios={function () {
            setPantalla("servicios");
          }}
        />
      )}

      {/* Agregado: Bloque de renderizado para el DashboardNegocio */}
      {pantalla === "negocio" && (
        <DashboardNegocio
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
        />
      )}

      {pantalla === "repas" && (
        <RepasDashboard
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
        />
      )}

      {pantalla === "bienes" && (
        <BienesRaices
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
        />
      )}

      {pantalla === "autos" && (
        <VentaAutos
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
        />
      )}

      {pantalla === "monedero" && (
        <ChangoMonedero
          session={session}
          theme={theme}
          onThemeToggle={toggle}
          onVolver={function () {
            setPantalla("dashboard");
          }}
        />
      )}
      </Suspense>
    </>
  );
}
