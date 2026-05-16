/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  MapPin,
  Package,
  CheckCircle,
  Clock,
  MessageCircle,
  Phone,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Navigation,
  AlertCircle,
} from "lucide-react";
import { supabase, ThemeToggle } from "./App";
import type { AppSession, Theme } from "./App";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Pedido {
  id: string;
  negocio_nombre: string | null;
  cliente_email: string | null;
  detalle: string | null;
  direccion: string | null;
  total: number | null;
  estatus: string;
  forma_pago: string | null;
  canal: string | null;
  created_at: string;
  repartidor_id: string | null;
}

interface MensajeChat {
  id: string;
  pedido_id: string;
  autor: "repartidor" | "cliente" | "sistema";
  texto: string;
  hora: string;
}

interface Props {
  session: AppSession;
  theme: Theme;
  onThemeToggle: () => void;
  onVolver: () => void;
}

const ESTATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    next?: string;
    nextLabel?: string;
  }
> = {
  pendiente: {
    label: "Pendiente",
    color: "#facc15",
    bg: "rgba(250,204,21,0.15)",
    next: "en_camino",
    nextLabel: "▶ Iniciar entrega",
  },
  en_camino: {
    label: "En camino",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.15)",
    next: "entregado",
    nextLabel: "✅ Marcar entregado",
  },
  entregado: {
    label: "Entregado",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
    next: undefined,
    nextLabel: undefined,
  },
  cancelado: {
    label: "Cancelado",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    next: undefined,
    nextLabel: undefined,
  },
};

// ─── Palabras a corregir (IA básica de ortografía) ────────────────────────────
const CORRECCIONES: Record<string, string> = {
  q: "que",
  xq: "porque",
  pq: "porque",
  bn: "bien",
  tb: "también",
  tmb: "también",
  xfa: "por favor",
  xfavor: "por favor",
  k: "que",
  wey: "estimado",
  güey: "estimado",
  puta: "caramba",
  chinga: "demonios",
  pinche: "maldito",
  cabrón: "señor",
  pendejo: "estimado",
};

function corregirTexto(texto: string): string {
  return texto
    .split(" ")
    .map(function (palabra) {
      const lower = palabra.toLowerCase().replace(/[^a-záéíóúüñ]/gi, "");
      return CORRECCIONES[lower] || palabra;
    })
    .join(" ");
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RepasDashboard(props: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mis" | "disponibles" | "chat">("mis");
  const [pedidoAbierto, setPedAbi] = useState<string | null>(null);
  const [chatPedido, setChatPedido] = useState<Pedido | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [textoChat, setTextoChat] = useState("");
  const [textoCorrecto, setTextoCorrecto] = useState("");
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isDark = props.theme === "dark";
  const miId = props.session.user.id;

  const fetchPedidos = useCallback(async function () {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setPedidos(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(
    function () {
      fetchPedidos();
    },
    [fetchPedidos],
  );

  // Auto-scroll chat
  useEffect(
    function () {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    [mensajes],
  );

  // Actualizar texto corregido en tiempo real
  useEffect(
    function () {
      setTextoCorrecto(corregirTexto(textoChat));
    },
    [textoChat],
  );

  const misPedidos = pedidos.filter(function (p) {
    return p.repartidor_id === miId;
  });

  const disponibles = pedidos.filter(function (p) {
    return p.estatus === "pendiente" && !p.repartidor_id;
  });

  async function tomarPedido(pedidoId: string) {
    await supabase
      .from("pedidos")
      .update({
        repartidor_id: miId,
        estatus: "en_camino",
      })
      .eq("id", pedidoId);
    fetchPedidos();
  }

  async function avanzarEstatus(pedido: Pedido) {
    const cfg = ESTATUS_CONFIG[pedido.estatus];
    if (!cfg?.next) return;
    await supabase
      .from("pedidos")
      .update({ estatus: cfg.next })
      .eq("id", pedido.id);
    fetchPedidos();
  }

  function abrirChat(pedido: Pedido) {
    setChatPedido(pedido);
    setTab("chat");
    // Simular mensajes previos
    setMensajes([
      {
        id: "m1",
        pedido_id: pedido.id,
        autor: "sistema",
        texto: "Pedido asignado. Puedes chatear con el cliente.",
        hora: new Date().toISOString(),
      },
      {
        id: "m2",
        pedido_id: pedido.id,
        autor: "cliente",
        texto: "¿Cuánto tardan aproximadamente?",
        hora: new Date().toISOString(),
      },
    ]);
  }

  async function enviarMensaje() {
    if (!textoCorrecto.trim() || !chatPedido) return;
    setEnviandoMsg(true);
    const nuevo: MensajeChat = {
      id: "msg-" + Date.now(),
      pedido_id: chatPedido.id,
      autor: "repartidor",
      texto: textoCorrecto.trim(),
      hora: new Date().toISOString(),
    };
    setMensajes(function (prev) {
      return [...prev, nuevo];
    });
    setTextoChat("");
    setTextoCorrecto("");
    setEnviandoMsg(false);
  }

  function formatHora(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatFecha(iso: string): string {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) +
      " " +
      d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    );
  }

  const tabStyle = function (t: string): React.CSSProperties {
    const activo = tab === t;
    return {
      flex: 1,
      padding: "9px 4px",
      border: "none",
      borderRadius: "11px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: activo ? 900 : 600,
      background: activo ? "var(--color-yellow)" : "transparent",
      color: activo ? "#020617" : "var(--text-muted)",
    };
  };

  // ── PANTALLA CHAT ──────────────────────────────────────────────────────────
  if (tab === "chat" && chatPedido) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          fontFamily: "system-ui,sans-serif",
          maxWidth: "480px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--bg-nav)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={function () {
                setTab("mis");
                setChatPedido(null);
              }}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "12px",
                background: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.06)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ArrowLeft
                style={{
                  width: "18px",
                  height: "18px",
                  color: "var(--text-primary)",
                }}
              />
            </button>
            <div>
              <p
                style={{
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  margin: 0,
                }}
              >
                Chat del pedido
              </p>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 900,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {chatPedido.negocio_nombre ?? "Pedido"}
              </h2>
            </div>
          </div>
        </div>

        {/* Mensajes */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            paddingBottom: "80px",
          }}
        >
          {mensajes.map(function (m) {
            const esMio = m.autor === "repartidor";
            const esSistema = m.autor === "sistema";
            if (esSistema)
              return (
                <div
                  key={m.id}
                  style={{
                    textAlign: "center",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    padding: "6px 12px",
                    borderRadius: "12px",
                    background: "var(--border-subtle)",
                  }}
                >
                  {m.texto}
                </div>
              );
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: esMio ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: esMio
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                    background: esMio
                      ? "var(--color-yellow)"
                      : "var(--bg-card)",
                    border: `1px solid var(--border-subtle)`,
                  }}
                >
                  <p
                    style={{
                      fontSize: "13px",
                      color: esMio ? "#020617" : "var(--text-primary)",
                      margin: "0 0 4px 0",
                      lineHeight: 1.4,
                    }}
                  >
                    {m.texto}
                  </p>
                  <p
                    style={{
                      fontSize: "10px",
                      color: esMio ? "rgba(2,6,23,0.5)" : "var(--text-muted)",
                      margin: 0,
                    }}
                  >
                    {formatHora(m.hora)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input chat */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: "480px",
            background: "var(--bg-nav)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid var(--border-subtle)",
            padding: "12px 16px",
          }}
        >
          {textoChat && textoCorrecto !== textoChat && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                background: "var(--color-yellow-dim)",
                border: "1px solid rgba(250,204,21,0.3)",
                marginBottom: "8px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--color-yellow)",
                  margin: 0,
                }}
              >
                ✨ Texto corregido: <strong>{textoCorrecto}</strong>
              </p>
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={textoChat}
              onChange={function (e) {
                setTextoChat(e.target.value);
              }}
              onKeyPress={function (e) {
                if (e.key === "Enter") enviarMensaje();
              }}
              placeholder="Escribe un mensaje..."
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid var(--border-subtle)",
                background: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.04)",
                color: "var(--text-primary)",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              onClick={enviarMensaje}
              disabled={enviandoMsg || !textoCorrecto.trim()}
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: "var(--color-yellow)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              {enviandoMsg ? "⏳" : "➤"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PANTALLA PRINCIPAL ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "system-ui,sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--bg-nav)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "14px 16px 12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={props.onVolver}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "12px",
                background: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.06)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ArrowLeft
                style={{
                  width: "18px",
                  height: "18px",
                  color: "var(--text-primary)",
                }}
              />
            </button>
            <div>
              <p
                style={{
                  fontSize: "10px",
                  color: "var(--color-green)",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  margin: 0,
                }}
              >
                🛵 Repartidor
              </p>
              <h1
                style={{
                  fontSize: "17px",
                  fontWeight: 900,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {props.session.user.nombre ||
                  props.session.user.email?.split("@")[0]}
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={fetchPedidos}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "12px",
                background: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.06)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <RefreshCw
                style={{
                  width: "16px",
                  height: "16px",
                  color: "var(--text-muted)",
                }}
              />
            </button>
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>

        {/* Stats rápidos */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          {[
            {
              label: "Mis pedidos",
              val: misPedidos.length,
              color: "var(--color-yellow)",
            },
            {
              label: "Disponibles",
              val: disponibles.length,
              color: "var(--color-green)",
            },
            {
              label: "Entregados hoy",
              val: misPedidos.filter(function (p) {
                return p.estatus === "entregado";
              }).length,
              color: "var(--color-blue)",
            },
          ].map(function (s) {
            return (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "14px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "20px",
                    fontWeight: 900,
                    color: s.color,
                    margin: "0 0 2px 0",
                  }}
                >
                  {s.val}
                </p>
                <p
                  style={{
                    fontSize: "9px",
                    color: "var(--text-muted)",
                    margin: 0,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            background: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)",
            borderRadius: "14px",
            padding: "3px",
            gap: "3px",
          }}
        >
          <button
            style={tabStyle("mis")}
            onClick={function () {
              setTab("mis");
            }}
          >
            📦 Mis Pedidos
          </button>
          <button
            style={tabStyle("disponibles")}
            onClick={function () {
              setTab("disponibles");
            }}
          >
            🟢 Disponibles
          </button>
        </div>
      </div>

      <div style={{ padding: "16px", paddingBottom: "40px" }}>
        {/* ── MIS PEDIDOS ── */}
        {tab === "mis" && (
          <div>
            {loading &&
              [1, 2, 3].map(function (i) {
                return (
                  <div
                    key={i}
                    style={{
                      height: "80px",
                      borderRadius: "16px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: "10px",
                    }}
                    className="skeleton"
                  />
                );
              })}

            {!loading && misPedidos.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <Package
                  style={{
                    width: "40px",
                    height: "40px",
                    color: "var(--text-muted)",
                    margin: "0 auto 12px",
                  }}
                />
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    margin: "0 0 8px 0",
                  }}
                >
                  Sin pedidos asignados
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Ve a "Disponibles" para tomar un pedido
                </p>
              </div>
            )}

            {!loading &&
              misPedidos.map(function (pedido) {
                const cfg =
                  ESTATUS_CONFIG[pedido.estatus] ?? ESTATUS_CONFIG["pendiente"];
                const abierto = pedidoAbierto === pedido.id;
                return (
                  <div
                    key={pedido.id}
                    style={{
                      borderRadius: "16px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: "10px",
                      overflow: "hidden",
                    }}
                  >
                    {/* Cabecera */}
                    <div
                      onClick={function () {
                        setPedAbi(abierto ? null : pedido.id);
                      }}
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: cfg.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Package
                          style={{
                            width: "20px",
                            height: "20px",
                            color: cfg.color,
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            margin: "0 0 2px 0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pedido.negocio_nombre ?? "Pedido"}
                        </p>
                        <p
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            margin: 0,
                          }}
                        >
                          {formatFecha(pedido.created_at)}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p
                          style={{
                            fontSize: "15px",
                            fontWeight: 900,
                            color: "var(--color-yellow)",
                            margin: "0 0 4px 0",
                          }}
                        >
                          ${(pedido.total ?? 0).toFixed(0)}
                        </p>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: "8px",
                            background: cfg.bg,
                            color: cfg.color,
                            textTransform: "uppercase",
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      {abierto ? (
                        <ChevronUp
                          style={{
                            width: "14px",
                            height: "14px",
                            color: "var(--text-muted)",
                          }}
                        />
                      ) : (
                        <ChevronDown
                          style={{
                            width: "14px",
                            height: "14px",
                            color: "var(--text-muted)",
                          }}
                        />
                      )}
                    </div>

                    {/* Detalle expandido */}
                    {abierto && (
                      <div
                        style={{
                          padding: "0 16px 16px",
                          borderTop: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div
                          style={{
                            paddingTop: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          {pedido.detalle && (
                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: "12px",
                                background: "var(--bg-base)",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <p
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  margin: "0 0 4px 0",
                                }}
                              >
                                📋 Detalle
                              </p>
                              <p
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-secondary)",
                                  margin: 0,
                                  lineHeight: 1.5,
                                }}
                              >
                                {pedido.detalle}
                              </p>
                            </div>
                          )}

                          {pedido.direccion && (
                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: "12px",
                                background: "var(--bg-base)",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <p
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  margin: "0 0 4px 0",
                                }}
                              >
                                📍 Dirección
                              </p>
                              <p
                                style={{
                                  fontSize: "13px",
                                  color: "var(--text-primary)",
                                  margin: "0 0 8px 0",
                                  fontWeight: 600,
                                }}
                              >
                                {pedido.direccion}
                              </p>
                              <a
                                href={
                                  "https://maps.google.com/?q=" +
                                  encodeURIComponent(pedido.direccion)
                                }
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "7px 12px",
                                  borderRadius: "10px",
                                  background: "rgba(59,130,246,0.12)",
                                  border: "1px solid rgba(59,130,246,0.2)",
                                  color: "var(--color-blue)",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                }}
                              >
                                <Navigation
                                  style={{ width: "12px", height: "12px" }}
                                />{" "}
                                Abrir en Maps
                              </a>
                            </div>
                          )}

                          {/* Acciones */}
                          <div style={{ display: "flex", gap: "8px" }}>
                            {/* Botón avanzar estatus */}
                            {cfg.next && (
                              <button
                                onClick={function () {
                                  avanzarEstatus(pedido);
                                }}
                                style={{
                                  flex: 2,
                                  padding: "12px",
                                  borderRadius: "12px",
                                  background: "var(--color-green)",
                                  border: "none",
                                  color: "white",
                                  fontSize: "12px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                {cfg.nextLabel}
                              </button>
                            )}
                            {/* Chat */}
                            <button
                              onClick={function () {
                                abrirChat(pedido);
                              }}
                              style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "12px",
                                background: "rgba(37,211,102,0.12)",
                                border: "1px solid rgba(37,211,102,0.2)",
                                color: "var(--color-green)",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                              }}
                            >
                              <MessageCircle
                                style={{ width: "14px", height: "14px" }}
                              />{" "}
                              Chat
                            </button>
                          </div>

                          {/* Forma de pago */}
                          {pedido.forma_pago && (
                            <div
                              style={{
                                padding: "8px 12px",
                                borderRadius: "10px",
                                background: "var(--color-yellow-dim)",
                                border: "1px solid rgba(250,204,21,0.2)",
                              }}
                            >
                              <p
                                style={{
                                  fontSize: "11px",
                                  color: "var(--color-yellow)",
                                  fontWeight: 700,
                                  margin: 0,
                                }}
                              >
                                💳 Cobrar: {pedido.forma_pago} · $
                                {(pedido.total ?? 0).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* ── DISPONIBLES ── */}
        {tab === "disponibles" && (
          <div>
            {disponibles.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <CheckCircle
                  style={{
                    width: "40px",
                    height: "40px",
                    color: "var(--color-green)",
                    margin: "0 auto 12px",
                  }}
                />
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    margin: "0 0 8px 0",
                  }}
                >
                  Todo al día
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  No hay pedidos pendientes por tomar
                </p>
              </div>
            )}

            {disponibles.map(function (pedido) {
              return (
                <div
                  key={pedido.id}
                  style={{
                    borderRadius: "16px",
                    background: "var(--bg-card)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    marginBottom: "10px",
                    overflow: "hidden",
                    boxShadow: "0 0 0 1px rgba(34,197,94,0.1)",
                  }}
                >
                  <div style={{ padding: "14px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "10px",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: "15px",
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            margin: "0 0 3px 0",
                          }}
                        >
                          {pedido.negocio_nombre ?? "Pedido"}
                        </p>
                        <p
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            margin: 0,
                          }}
                        >
                          {formatFecha(pedido.created_at)}
                        </p>
                      </div>
                      <p
                        style={{
                          fontSize: "18px",
                          fontWeight: 900,
                          color: "var(--color-yellow)",
                          margin: 0,
                        }}
                      >
                        ${(pedido.total ?? 0).toFixed(0)}
                      </p>
                    </div>

                    {pedido.direccion && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginBottom: "12px",
                        }}
                      >
                        <MapPin
                          style={{
                            width: "13px",
                            height: "13px",
                            color: "var(--text-muted)",
                            flexShrink: 0,
                          }}
                        />
                        <p
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pedido.direccion}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={function () {
                        tomarPedido(pedido.id);
                      }}
                      style={{
                        width: "100%",
                        padding: "13px",
                        borderRadius: "14px",
                        background: "var(--color-green)",
                        border: "none",
                        color: "white",
                        fontSize: "13px",
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow: "0 4px 16px rgba(34,197,94,0.35)",
                      }}
                    >
                      🛵 Tomar este pedido
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
