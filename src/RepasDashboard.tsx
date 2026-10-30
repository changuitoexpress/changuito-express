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
import PedidoChat from "./components/PedidoChat";
// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Pedido {
  id: string;
  negocio_nombre: string | null;
  cliente_email: string | null;
  detalle: string | null;
  direccion: string | null;
  total_pagar: number | null;
  estatus: string;
  forma_pago: string | null;
  canal: string | null;
  created_at: string;
  repartidor_id: string | null;
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

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RepasDashboard(props: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mis" | "disponibles" | "chat">("mis");
  const [pedidoAbierto, setPedAbi] = useState<string | null>(null);
  const [chatPedido, setChatPedido] = useState<Pedido | null>(null);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const accessRevokedRef = useRef(false);
  const isDark = props.theme === "dark";
  const miId = props.session.user.id;
  const puedeAcceder =
    props.session.user.rol === "admin" ||
    props.session.user.rol === "repartidor" ||
    props.session.user.email === "uliseseven.7@gmail.com";
  const hasAccess = puedeAcceder && !accessRevoked;

  const fetchPedidos = useCallback(async function () {
    if (!puedeAcceder || accessRevokedRef.current) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!puedeAcceder || accessRevokedRef.current) return;
      setPedidos(data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      if (puedeAcceder && !accessRevokedRef.current) setLoading(false);
    }
  }, [puedeAcceder]);

  useEffect(
    function () {
      if (puedeAcceder) {
        accessRevokedRef.current = false;
        setAccessRevoked(false);
        fetchPedidos();
      } else {
        accessRevokedRef.current = true;
        setAccessRevoked(true);
        setPedidos([]);
        setChatPedido(null);
        setLoading(false);
      }
    },
    [fetchPedidos, puedeAcceder],
  );

  useEffect(
    function () {
      const channel = supabase
        .channel("delivery-access-" + miId)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "perfiles",
            filter: "id=eq." + miId,
          },
          function (payload: any) {
            const role =
              payload.eventType === "DELETE" ? null : payload.new?.rol;
            const nextAccess =
              role === "admin" ||
              role === "repartidor" ||
              props.session.user.email === "uliseseven.7@gmail.com";
            accessRevokedRef.current = !nextAccess;
            if (!nextAccess) {
              setAccessRevoked(true);
              setPedidos([]);
              setChatPedido(null);
              setTab("mis");
              setLoading(false);
              return;
            }
            setAccessRevoked(false);
            fetchPedidos();
          },
        )
        .subscribe();

      return function () {
        void supabase.removeChannel(channel);
      };
    },
    [fetchPedidos, miId, props.session.user.email],
  );

  const misPedidos = pedidos.filter(function (p) {
    return p.repartidor_id === miId;
  });

  const disponibles = pedidos.filter(function (p) {
    return p.estatus === "pendiente" && !p.repartidor_id;
  });

  async function tomarPedido(pedidoId: string) {
    if (!puedeAcceder || accessRevokedRef.current || !hasAccess) return;
    // Intentar vía RPC primero (bypasa RLS — requiere supabase_setup.sql ejecutado)
    const { data: rpcData, error: rpcErr } = await supabase
      .rpc('tomar_pedido_repartidor', { p_pedido_id: pedidoId, p_repartidor_id: miId });

    if (rpcErr || !rpcData?.ok) {
      const { error: err } = await supabase
        .from("pedidos")
        .update({ repartidor_id: miId, estatus: "en_camino" })
        .eq("id", pedidoId);
      if (err) {
        alert('Error al tomar pedido: ' + err.message + '\n\nEjecuta supabase_setup.sql en Supabase para habilitar los permisos.');
        return;
      }
    }

    if (!puedeAcceder || accessRevokedRef.current || !hasAccess) return;
    await fetchPedidos();
    setTab("mis");
  }

  async function avanzarEstatus(pedido: Pedido) {
    if (!puedeAcceder || accessRevokedRef.current || !hasAccess) return;
    const cfg = ESTATUS_CONFIG[pedido.estatus];
    if (!cfg?.next) return;
    await supabase
      .from("pedidos")
      .update({ estatus: cfg.next })
      .eq("id", pedido.id);
    fetchPedidos();
  }

  function abrirChat(pedido: Pedido) {
    if (!puedeAcceder || accessRevokedRef.current || !hasAccess) return;
    setChatPedido(pedido);
    setTab("chat");
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

  if (!hasAccess) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <AlertCircle
          style={{
            width: "40px",
            height: "40px",
            color: "var(--text-muted)",
            marginBottom: "16px",
          }}
        />
        <p style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 8px 0" }}>
          Acceso restringido
        </p>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            margin: "0 0 20px 0",
            maxWidth: "300px",
          }}
        >
          Esta sección está disponible únicamente para repartidores autorizados.
        </p>
        <button
          onClick={props.onVolver}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            background: "var(--border-subtle)",
            border: "none",
            color: "var(--text-muted)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Volver
        </button>
      </div>
    );
  }

  if (tab === "chat" && chatPedido) {
    return (
      <PedidoChat
        key={chatPedido.id}
        session={props.session}
        theme={props.theme}
        pedido={chatPedido}
        role={props.session.user.rol === "admin" || props.session.user.email === "uliseseven.7@gmail.com" ? "admin" : "repartidor"}
        onBack={function () {
          setTab("mis");
          setChatPedido(null);
        }}
      />
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
            {/* Banner pedido en curso */}
            {!loading && misPedidos.some(function(p){ return p.estatus === "en_camino"; }) && (
              <div style={{ marginBottom: "16px", padding: "14px 16px", borderRadius: "16px", background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.08))", border: "1px solid rgba(34,197,94,0.35)", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "28px", flexShrink: 0 }}>🛵</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 900, color: "var(--color-green)", margin: "0 0 2px 0" }}>Pedido en curso</p>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(function(){
                      const p = misPedidos.find(function(p){ return p.estatus === "en_camino"; });
                      return (p?.negocio_nombre ?? '') + (p?.direccion ? ' · ' + p.direccion : '');
                    })()}
                  </p>
                </div>
                <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "8px", background: "rgba(34,197,94,0.2)", color: "var(--color-green)", fontWeight: 800, flexShrink: 0 }}>En camino</span>
              </div>
            )}

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
                          ${(pedido.total_pagar ?? 0).toFixed(0)}
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
                                {(pedido.total_pagar ?? 0).toFixed(2)}
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
                        ${(pedido.total_pagar ?? 0).toFixed(0)}
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
