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

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? "";
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
}) {
  const [mode, setMode] = useState<"login" | "register" | "recover-profile">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [focused, setFocused] = useState("");
  const isDark = props.theme === "dark";
  const isLogin = mode === "login";

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

  const inputBg = isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.04)";
  const ib = function (f: string) {
    return focused === f
      ? "1px solid rgba(250,204,21,0.6)"
      : isDark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.12)";
  };

  return (
    <div
      className="fade-in"
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: isDark ? 0.03 : 0.06,
          backgroundImage:
            "radial-gradient(circle, var(--text-primary) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{ position: "absolute", top: "16px", right: "16px", zIndex: 10 }}
      >
        <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
      </div>
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "68px",
              height: "68px",
              borderRadius: "22px",
              background: "#facc15",
              boxShadow: "0 8px 24px rgba(250,204,21,0.4)",
              marginBottom: "16px",
            }}
          >
            <ShoppingCart
              style={{ width: "32px", height: "32px", color: "#020617" }}
              strokeWidth={2.5}
            />
          </div>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 900,
              color: "var(--text-primary)",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              margin: 0,
            }}
          >
            CHANGUITO
            <br />
            <span style={{ color: "#facc15" }}>EXPRESS</span>
          </h1>
          <p
            style={{
              fontSize: "10px",
              letterSpacing: "0.35em",
              color: "var(--text-muted)",
              fontWeight: 700,
              textTransform: "uppercase",
              marginTop: "8px",
            }}
          >
            • Lomas • 1 • 2 • 3 • La Vista •
          </p>
        </div>
        <div
          style={{
            background: isDark ? "#16161e" : "#ffffff",
            border: isDark
              ? "1px solid rgba(255,255,255,0.07)"
              : "1px solid rgba(0,0,0,0.08)",
            borderRadius: "28px",
            padding: "28px",
            boxShadow: "var(--shadow-float)",
          }}
        >
          <div
            style={{
              display: "flex",
              background: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)",
              borderRadius: "16px",
              padding: "4px",
              marginBottom: "24px",
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
                    padding: "10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    background: active ? "#facc15" : "transparent",
                    color: active ? "#020617" : "var(--text-muted)",
                    boxShadow: active
                      ? "0 4px 12px rgba(250,204,21,0.3)"
                      : "none",
                  }}
                >
                  {m === "login" ? (
                    <>
                      <LogIn style={{ width: "12px", height: "12px" }} /> Entrar
                    </>
                  ) : (
                    <>
                      <UserPlus style={{ width: "12px", height: "12px" }} />{" "}
                      Registro
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {mode === "recover-profile" && (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  margin: "0 0 4px",
                }}
              >
                Confirmá tu email y completá estos datos para guardar tu perfil
                en la cuenta existente.
              </p>
            )}
            {!isLogin && (
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
                      focused === "nombre" ? "#facc15" : "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Nombre o Alias"
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
                    width: "100%",
                    boxSizing: "border-box",
                    background: inputBg,
                    border: ib("nombre"),
                    borderRadius: "14px",
                    padding: "14px 14px 14px 40px",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>
            )}
            <div style={{ position: "relative" }}>
              <Mail
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "15px",
                  height: "15px",
                  color: focused === "email" ? "#facc15" : "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="email"
                placeholder="tu@email.com"
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
                  width: "100%",
                  boxSizing: "border-box",
                  background: inputBg,
                  border: ib("email"),
                  borderRadius: "14px",
                  padding: "14px 14px 14px 40px",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ position: "relative" }}>
              <Lock
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "15px",
                  height: "15px",
                  color: focused === "pass" ? "#facc15" : "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="password"
                placeholder="Contraseña (mín. 6 caracteres)"
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
                  width: "100%",
                  boxSizing: "border-box",
                  background: inputBg,
                  border: ib("pass"),
                  borderRadius: "14px",
                  padding: "14px 14px 14px 40px",
                  color: "var(--text-primary)",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || resendingConfirmation}
              style={{
                width: "100%",
                background:
                  loading || resendingConfirmation
                    ? "rgba(250,204,21,0.5)"
                    : "#facc15",
                color: "#020617",
                fontWeight: 900,
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                padding: "15px",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: loading || resendingConfirmation
                  ? "none"
                  : "0 6px 20px rgba(250,204,21,0.35)",
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
                  <LogIn style={{ width: "15px", height: "15px" }} /> Entrar a
                  la App
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
                      <UserPlus style={{ width: "15px", height: "15px" }} /> Crear
                      Cuenta
                    </>
                  )}
                </>
              )}
            </button>
          </form>
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
                  padding: "4px",
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
                padding: "4px",
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
                padding: "4px",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "12px",
                textDecoration: "underline",
              }}
            >
              Volver a iniciar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
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
    );
  }, []);

  useEffect(
    function () {
      setSessionExpiryWarning(false);
      return scheduleSessionExpiryWarning(session?.expiresAt, function () {
        setSessionExpiryWarning(true);
      });
    },
    [session?.expiresAt],
  );

  if (booting) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "18px",
              background: "#facc15",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 28px rgba(250,204,21,0.4)",
            }}
          >
            <ShoppingCart
              style={{ width: "26px", height: "26px", color: "#020617" }}
            />
          </div>
          <span
            className="spinner"
            style={{
              borderColor: "var(--border-subtle)",
              borderTopColor: "#facc15",
              width: "22px",
              height: "22px",
            }}
          />
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
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          style={{
            position: "fixed",
            zIndex: 10001,
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(680px, calc(100% - 32px))",
            boxSizing: "border-box",
            padding: "14px 18px",
            borderRadius: "14px",
            background: "var(--color-yellow-dim)",
            border: "1px solid var(--color-yellow)",
            color: "var(--text-primary)",
            fontSize: "14px",
            fontWeight: 600,
            boxShadow: "var(--shadow-float)",
          }}
        >
          Tu sesión está por vencer. Guardá tu trabajo; es posible que tengas
          que iniciar sesión nuevamente.
        </div>
      )}
      {pwa.mostrar && (
        <PWABanner onInstalar={pwa.instalar} onDescartar={pwa.descartar} />
      )}

      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              background: "var(--bg-base)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              className="spinner"
              style={{
                borderColor: "var(--border-subtle)",
                borderTopColor: "#facc15",
                width: "22px",
                height: "22px",
              }}
            />
          </div>
        }
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
