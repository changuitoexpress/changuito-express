/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Star,
  Clock,
  Plus,
  Minus,
  ShoppingBag,
  MessageCircle,
  Phone,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { supabase, ThemeToggle } from "./App";
import type { Theme } from "./App";
import type { Merchant, CartItem } from "./Dashboard";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  is_available: boolean;
}

interface VistaNegocioProps {
  merchant: Merchant;
  theme: Theme;
  onThemeToggle: () => void;
  clienteEmail?: string;
  onVolver: () => void;
  carritoGlobal?: CartItem[];
  onUpdateCarritoGlobal?: (items: CartItem[]) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const COSTO_ENVIO = 50;
const PHONE_SOPORTE = "522223339999";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildGradient(category: string): string {
  const presets: Record<string, string> = {
    "desayunos y comidas": "linear-gradient(135deg,#1e3a5f,#1d4ed8)",
    cemitas: "linear-gradient(135deg,#713f12,#a16207)",
    tortas: "linear-gradient(135deg,#713f12,#b45309)",
    taqueria: "linear-gradient(135deg,#7c2d12,#c2410c)",
    pizzeria: "linear-gradient(135deg,#7f1d1d,#b91c1c)",
    hamburguesas: "linear-gradient(135deg,#1c1917,#78350f)",
    "comida asiatica": "linear-gradient(135deg,#134e4a,#0f766e)",
    "pollos preparados": "linear-gradient(135deg,#78350f,#b45309)",
    "pescados y mariscos": "linear-gradient(135deg,#0c4a6e,#0369a1)",
    pozoleria: "linear-gradient(135deg,#2e1065,#7c3aed)",
    "cochinita pibil": "linear-gradient(135deg,#713f12,#a16207)",
    carnitas: "linear-gradient(135deg,#7f1d1d,#b91c1c)",
    barbacoa: "linear-gradient(135deg,#431407,#92400e)",
    birria: "linear-gradient(135deg,#500724,#be123c)",
    "alitas y boneless": "linear-gradient(135deg,#7c2d12,#c2410c)",
    "elotes y antojitos": "linear-gradient(135deg,#713f12,#ca8a04)",
    cafeteria: "linear-gradient(135deg,#1c1917,#44403c)",
    mandaditos: "linear-gradient(135deg,#14532d,#15803d)",
    tiendita: "linear-gradient(135deg,#1e3a5f,#0369a1)",
  };
  return (
    presets[category?.toLowerCase().trim()] ??
    "linear-gradient(135deg,#1a1a2e,#2d2d44)"
  );
}

function getEmoji(category: string | null): string {
  const map: Record<string, string> = {
    "desayunos y comidas": "🍳",
    cemitas: "🫓",
    tortas: "🥖",
    taqueria: "🌮",
    pizzeria: "🍕",
    hamburguesas: "🍔",
    "comida asiatica": "🍜",
    "pollos preparados": "🍗",
    "pescados y mariscos": "🦐",
    pozoleria: "🍲",
    "cochinita pibil": "🫙",
    carnitas: "🥩",
    barbacoa: "🫕",
    birria: "🌶️",
    "alitas y boneless": "🍗",
    "elotes y antojitos": "🌽",
    cafeteria: "☕",
    mandaditos: "🛒",
    tiendita: "🏪",
    postres: "🍰",
    entradas: "🥗",
    combos: "🎉",
    extras: "🫙",
    bebidas: "🧃",
    tacos: "🌮",
    quesadillas: "🫓",
    especiales: "⭐",
    órdenes: "📦",
  };
  return map[(category ?? "").toLowerCase().trim()] ?? "🍽️";
}

function formatWhatsApp(params: {
  negocio: string;
  email: string;
  items: CartItem[];
  subtotal: number;
  envio: number;
  total: number;
}): string {
  const detalle = params.items
    .map(function (i) {
      return (
        i.nombre +
        (i.tipo === "producto"
          ? " x" + i.cantidad + " $" + (i.precio * i.cantidad).toFixed(2)
          : "")
      );
    })
    .join(", ");
  return (
    "*Pedido Changuito Express App* 🛒\nCliente: " +
    params.email +
    "\nNegocio: " +
    params.negocio +
    "\nDetalle: " +
    detalle +
    "\nEnvío: $" +
    params.envio.toFixed(2) +
    "\nTotal: $" +
    params.total.toFixed(2)
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonProducto() {
  return (
    <div
      style={{
        display: "flex",
        gap: "14px",
        padding: "14px",
        borderRadius: "18px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        className="skeleton"
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "14px",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          justifyContent: "center",
        }}
      >
        <div className="skeleton" style={{ height: "13px", width: "55%" }} />
        <div className="skeleton" style={{ height: "10px", width: "80%" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="skeleton" style={{ height: "13px", width: "25%" }} />
          <div
            className="skeleton"
            style={{ height: "28px", width: "28px", borderRadius: "8px" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── VistaNegocio Principal ───────────────────────────────────────────────────
export default function VistaNegocio(props: VistaNegocioProps) {
  const { merchant: m, theme } = props;
  const isDark = theme === "dark";
  const clienteEmail = props.clienteEmail ?? "cliente@app.com";
  const phoneNegocio = m.phone_number?.replace(/\D/g, "") || "522223339999";

  // Carrito LOCAL de este negocio (sincronizado con el global)
  const [carritoLocal, setCarritoLocal] = useState<CartItem[]>(function () {
    if (!props.carritoGlobal) return [];
    return props.carritoGlobal.filter(function (i) {
      return i.negocio_id === m.id;
    });
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [filtroCategoria, setFiltro] = useState<string>("Todos");
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorPedido, setErrorPedido] = useState<string>("");

  // Sincronizar carritoLocal con carritoGlobal al montar
  useEffect(function () {
    if (props.carritoGlobal) {
      setCarritoLocal(
        props.carritoGlobal.filter(function (i) {
          return i.negocio_id === m.id;
        }),
      );
    }
  }, []);

  // Fetch productos
  async function fetchProducts() {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("products")
        .select(
          "id,merchant_id,name,description,price,image_url,category,is_available",
        )
        .eq("merchant_id", m.id)
        .order("category", { ascending: true })
        .order("is_available", { ascending: false })
        .order("name", { ascending: true });
      if (err) throw err;
      setProducts(data ?? []);
    } catch (e: any) {
      setError(e.message ?? "No se pudo cargar el menú.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    function () {
      fetchProducts();
    },
    [m.id],
  );

  const categorias = [
    "Todos",
    ...Array.from(
      new Set(
        products.map(function (p) {
          return p.category ?? "Otros";
        }),
      ),
    ),
  ];
  const productosFiltrados =
    filtroCategoria === "Todos"
      ? products
      : products.filter(function (p) {
          return (p.category ?? "Otros") === filtroCategoria;
        });

  // ── Carrito helpers ──────────────────────────────────────────────────────────
  function getCantidad(productId: string): number {
    return (
      carritoLocal.find(function (i) {
        return i.id === productId;
      })?.cantidad ?? 0
    );
  }

  function actualizarCarritoGlobal(nuevoLocal: CartItem[]) {
    if (!props.onUpdateCarritoGlobal || !props.carritoGlobal) return;
    const otrosNegocios = props.carritoGlobal.filter(function (i) {
      return i.negocio_id !== m.id;
    });
    props.onUpdateCarritoGlobal([...otrosNegocios, ...nuevoLocal]);
  }

  function agregar(product: Product) {
    setCarritoLocal(function(prev) {
      const existe = prev.find(function(i) { return i.id === product.id; });
      let nuevo: CartItem[];
      if (existe) {
        nuevo = prev.map(function(i) {
          return i.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i;
        });
      } else {
        const item: CartItem = {
          id: product.id,
          nombre: product.name,
          precio: product.price,
          cantidad: 1,
          negocio: m.name,
          negocio_id: m.id,
          phone_number: phoneNegocio,
          tipo: 'producto',
          emoji: getEmoji(product.category),
        };
        nuevo = [...prev, item];
      }
      if (props.onUpdateCarritoGlobal && props.carritoGlobal) {
        const otros = props.carritoGlobal.filter(function(i) { return i.negocio_id !== m.id; });
        props.onUpdateCarritoGlobal([...otros, ...nuevo]);
      }
      return nuevo;
    });
  }

  function quitar(productId: string) {
    setCarritoLocal(function(prev) {
      const nuevo = prev
        .map(function(i) { return i.id === productId ? { ...i, cantidad: i.cantidad - 1 } : i; })
        .filter(function(i) { return i.cantidad > 0; });
      if (props.onUpdateCarritoGlobal && props.carritoGlobal) {
        const otros = props.carritoGlobal.filter(function(i) { return i.negocio_id !== m.id; });
        props.onUpdateCarritoGlobal([...otros, ...nuevo]);
      }
      return nuevo;
    });
  }

  const totalItems = carritoLocal.reduce(function (a, i) {
    return a + i.cantidad;
  }, 0);
  const subtotal = carritoLocal.reduce(function (a, i) {
    return a + i.precio * i.cantidad;
  }, 0);
  const totalConEnvio = subtotal + COSTO_ENVIO;

  // ── Confirmar pedido ──────────────────────────────────────────────────────────
  async function confirmarPedido() {
    if (carritoLocal.length === 0) return;
    setEnviando(true);
    setErrorPedido("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const clienteId = session?.user?.id ?? null;

      const todosLosItems = props.carritoGlobal && props.carritoGlobal.length > 0
        ? props.carritoGlobal
        : carritoLocal;

      const totalGlobal = todosLosItems.reduce(function(a, i) {
        return a + i.precio * i.cantidad;
      }, 0) + COSTO_ENVIO;

      const detalle = todosLosItems
        .map(function(i) { return i.nombre + " x" + i.cantidad; })
        .join(", ");

      const { error: insertError } = await supabase.from("pedidos").insert({
        cliente_id: clienteId,
        negocio_id: m.id,
        negocio_nombre: m.name,
        detalle: detalle,
        subtotal: todosLosItems.reduce(function(a, i) { return a + i.precio * i.cantidad; }, 0),
        costo_envio: COSTO_ENVIO,
        total: totalGlobal,
        estatus: "pendiente",
        canal: "webapp",
        cliente_email: clienteEmail,
      });

      if (insertError) {
        setErrorPedido(
          "No se registró en el sistema. El pedido igual se enviará por WhatsApp.",
        );
        console.error("[VistaNegocio]", insertError.message);
      }

      const porNegocio: Record<string, typeof todosLosItems> = {};
      todosLosItems.forEach(function(item) {
        if (!porNegocio[item.negocio]) porNegocio[item.negocio] = [];
        porNegocio[item.negocio].push(item);
      });

      const numRestaurantes = Object.keys(porNegocio).length;
      const costoEnvioDinamico = COSTO_ENVIO + Math.max(0, numRestaurantes - 1) * 15;
      const totalConEnvioDinamico = todosLosItems.reduce(function(a, i) { return a + i.precio * i.cantidad; }, 0) + costoEnvioDinamico;

      const linea = '━━━━━━━━━━━━━━━━━━━━━━';
      let msg = '*🛵 CHANGUITO EXPRESS*\n' + linea + '\n';
      msg += '👤 *Cliente:* ' + clienteEmail + '\n' + linea + '\n\n';

      Object.entries(porNegocio).forEach(function([negocio, items]) {
        msg += '🍽️ *' + negocio.toUpperCase() + '*\n';
        items.forEach(function(item) {
          if (item.tipo === 'mandadito') {
            msg += '   📝 ' + item.nombre + '\n';
          } else {
            msg += '   • ' + item.nombre + ' x' + item.cantidad + ' = $' + (item.precio * item.cantidad).toFixed(2) + '\n';
          }
        });
        msg += linea + '\n';
      });

      if (numRestaurantes > 1) {
        msg += '\n🚚 *Envío base:* $' + COSTO_ENVIO.toFixed(2) + '\n';
        msg += '➕ *Envío adicional (' + (numRestaurantes - 1) + ' restaurante' + (numRestaurantes > 2 ? 's' : '') + ' extra):* $' + ((numRestaurantes - 1) * 15).toFixed(2) + '\n';
      } else {
        msg += '\n🚚 *Envío:* $' + costoEnvioDinamico.toFixed(2) + '\n';
      }
      msg += '*💰 TOTAL: $' + totalConEnvioDinamico.toFixed(2) + '*';

      window.open(
        "https://wa.me/" + PHONE_SOPORTE + "?text=" + encodeURIComponent(msg),
        "_blank",
      );

      if (props.onUpdateCarritoGlobal) {
        props.onUpdateCarritoGlobal([]);
      }
      setCarritoLocal([]);
      setModalOpen(false);
    } catch (err: any) {
      setErrorPedido(
        "Error inesperado: " + (err.message ?? "intenta de nuevo."),
      );
    } finally {
      setEnviando(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="theme-transition"
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "system-ui,sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Portada */}
      <div
        style={{
          position: "relative",
          height: "200px",
          background: m.image_url
            ? "var(--bg-card)"
            : buildGradient(m.category),
          overflow: "hidden",
        }}
      >
        {m.image_url ? (
          <img
            src={m.image_url}
            alt={m.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            onError={function (e) {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "80px",
              opacity: 0.3,
            }}
          >
            {getEmoji(m.category)}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "100px",
            background: "linear-gradient(to bottom,transparent,var(--bg-base))",
          }}
        />
        <button
          onClick={props.onVolver}
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            width: "38px",
            height: "38px",
            borderRadius: "12px",
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ArrowLeft
            style={{ width: "18px", height: "18px", color: "white" }}
          />
        </button>
        <div style={{ position: "absolute", top: "16px", right: "16px" }}>
          <ThemeToggle theme={theme} onToggle={props.onThemeToggle} />
        </div>
      </div>

      {/* Info negocio */}
      <div
        style={{
          padding: "0 16px 16px",
          marginTop: "-12px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 900,
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            {m.name}
          </h1>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "10px",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              flexShrink: 0,
              marginTop: "4px",
              background: m.is_open
                ? "var(--color-green-dim)"
                : "var(--border-subtle)",
              color: m.is_open ? "var(--color-green)" : "var(--text-muted)",
              border: m.is_open
                ? "1px solid rgba(34,197,94,0.3)"
                : "1px solid var(--border-subtle)",
            }}
          >
            {m.is_open ? "● Abierto" : "Cerrado"}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "13px",
              color: "var(--color-yellow)",
              fontWeight: 700,
            }}
          >
            <Star
              style={{ width: "13px", height: "13px" }}
              fill="var(--color-yellow)"
              strokeWidth={0}
            />
            {(m.rating ?? 4.5).toFixed(1)}
          </span>
          <span
            style={{
              width: "3px",
              height: "3px",
              borderRadius: "50%",
              background: "var(--border-medium)",
            }}
          />
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            <Clock style={{ width: "13px", height: "13px" }} />
            {m.delivery_time ?? "25-35 min"}
          </span>
          <span
            style={{
              width: "3px",
              height: "3px",
              borderRadius: "50%",
              background: "var(--border-medium)",
            }}
          />
          <span
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              textTransform: "capitalize",
            }}
          >
            {m.category}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 12px",
            borderRadius: "12px",
            background: "var(--color-green-dim)",
            border: "1px solid rgba(34,197,94,0.18)",
          }}
        >
          <Phone
            style={{
              width: "13px",
              height: "13px",
              color: "var(--color-green)",
              flexShrink: 0,
            }}
          />
          <p
            style={{
              fontSize: "11px",
              color: "var(--text-secondary)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            ¿Problemas? Soporte:{" "}
            <a
              href={"tel:+" + PHONE_SOPORTE}
              style={{
                color: "var(--color-green)",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              222-333-9999
            </a>
          </p>
        </div>
      </div>

      {/* Filtros categoría */}
      {!loading && !error && categorias.length > 1 && (
        <div
          className="scroll-x"
          style={{
            paddingLeft: "16px",
            paddingBottom: "4px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", width: "max-content" }}>
            {categorias.map(function (cat) {
              const activa = filtroCategoria === cat;
              return (
                <button
                  key={cat}
                  onClick={function () {
                    setFiltro(cat);
                  }}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: activa ? 900 : 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s",
                    background: activa
                      ? "var(--color-yellow)"
                      : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.04)",
                    color: activa ? "#020617" : "var(--text-secondary)",
                    border: activa ? "none" : "1px solid var(--border-subtle)",
                    boxShadow: activa
                      ? "0 4px 12px rgba(250,204,21,0.3)"
                      : "none",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Productos */}
      <div
        style={{
          padding: "0 16px",
          paddingBottom: totalItems > 0 ? "100px" : "40px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {loading &&
          [1, 2, 3, 4, 5].map(function (i) {
            return <SkeletonProducto key={i} />;
          })}
        {!loading && error && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <WifiOff
              style={{
                width: "36px",
                height: "36px",
                color: "var(--text-muted)",
                margin: "0 auto 12px",
              }}
            />
            <p
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-secondary)",
                margin: "0 0 6px 0",
              }}
            >
              {error}
            </p>
            <button
              onClick={fetchProducts}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 20px",
                borderRadius: "12px",
                background: "var(--color-yellow-dim)",
                border: "1px solid rgba(250,204,21,0.3)",
                color: "var(--color-yellow)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <RefreshCw style={{ width: "13px", height: "13px" }} /> Reintentar
            </button>
          </div>
        )}
        {!loading && !error && productosFiltrados.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <span
              style={{
                fontSize: "40px",
                display: "block",
                marginBottom: "12px",
              }}
            >
              🍽️
            </span>
            <p
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-secondary)",
              }}
            >
              Sin productos en esta categoría.
            </p>
          </div>
        )}
        {!loading &&
          !error &&
          productosFiltrados.map(function (product) {
            const cantidad = getCantidad(product.id);
            const unavailable = !product.is_available;
            const emoji = getEmoji(product.category);
            return (
              <div
                key={product.id}
                className="theme-transition fade-in"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px",
                  borderRadius: "18px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: isDark
                    ? "0 2px 12px rgba(0,0,0,0.3)"
                    : "var(--shadow-card)",
                  opacity: unavailable ? 0.5 : 1,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Imagen/emoji */}
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "14px",
                    flexShrink: 0,
                    background: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.04)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    fontSize: "28px",
                  }}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={function (e) {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  ) : (
                    emoji
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      margin: "0 0 3px 0",
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {product.name}
                  </h3>
                  {product.description && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        margin: "0 0 8px 0",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.description}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "16px",
                        fontWeight: 900,
                        color: "var(--color-yellow)",
                      }}
                    >
                      ${product.price.toFixed(2)}
                    </span>
                    {unavailable ? (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          background: "var(--border-subtle)",
                        }}
                      >
                        No disponible
                      </span>
                    ) : cantidad === 0 ? (
                      <button
                        onClick={function () {
                          agregar(product);
                        }}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "10px",
                          background: "var(--color-yellow)",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: "0 4px 10px rgba(250,204,21,0.35)",
                          flexShrink: 0,
                        }}
                      >
                        <Plus
                          style={{
                            width: "16px",
                            height: "16px",
                            color: "#020617",
                          }}
                          strokeWidth={3}
                        />
                      </button>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          onClick={function () {
                            quitar(product.id);
                          }}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            background: "var(--border-subtle)",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Minus
                            style={{
                              width: "13px",
                              height: "13px",
                              color: "var(--text-primary)",
                            }}
                            strokeWidth={3}
                          />
                        </button>
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: 900,
                            color: "var(--text-primary)",
                            minWidth: "16px",
                            textAlign: "center",
                          }}
                        >
                          {cantidad}
                        </span>
                        <button
                          onClick={function () {
                            agregar(product);
                          }}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            background: "var(--color-yellow)",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Plus
                            style={{
                              width: "13px",
                              height: "13px",
                              color: "#020617",
                            }}
                            strokeWidth={3}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Barra carrito */}
      {totalItems > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: "448px",
            zIndex: 100,
          }}
        >
          <button
            onClick={function () {
              setModalOpen(true);
            }}
            style={{
              width: "100%",
              background: "var(--color-yellow)",
              borderRadius: "18px",
              padding: "16px 20px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 8px 32px rgba(250,204,21,0.45)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "rgba(2,6,23,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingBag
                  style={{ width: "15px", height: "15px", color: "#020617" }}
                />
              </div>
              <span
                style={{ fontSize: "13px", fontWeight: 900, color: "#020617" }}
              >
                Ver carrito · {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            </div>
            <span
              style={{ fontSize: "15px", fontWeight: 900, color: "#020617" }}
            >
              ${totalConEnvio.toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* Modal carrito local */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={function () {
            setModalOpen(false);
          }}
        >
          <div
            className="theme-transition"
            style={{
              width: "100%",
              maxWidth: "480px",
              margin: "0 auto",
              background: isDark ? "#1e1e28" : "#ffffff",
              borderRadius: "28px 28px 0 0",
              padding: "24px 20px 40px",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div
              style={{
                width: "40px",
                height: "4px",
                borderRadius: "2px",
                background: "var(--border-medium)",
                margin: "0 auto 20px",
              }}
            />
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 900,
                color: "var(--text-primary)",
                margin: "0 0 4px 0",
              }}
            >
              Tu Pedido
            </h2>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                margin: "0 0 16px 0",
              }}
            >
              {m.name}
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              {carritoLocal.map(function (item) {
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "22px" }}>
                      {item.emoji ?? "🍽️"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          margin: "0 0 1px 0",
                        }}
                      >
                        {item.nombre}
                      </p>
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          margin: 0,
                        }}
                      >
                        x{item.cantidad} · ${item.precio.toFixed(2)} c/u
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "var(--color-yellow)",
                      }}
                    >
                      ${(item.precio * item.cantidad).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(0,0,0,0.03)",
                borderRadius: "14px",
                padding: "14px",
                marginBottom: "14px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Subtotal
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Envío
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  ${COSTO_ENVIO.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 900,
                    color: "var(--color-yellow)",
                  }}
                >
                  ${totalConEnvio.toFixed(2)}
                </span>
              </div>
            </div>
            {errorPedido !== "" && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "var(--color-yellow-dim)",
                  border: "1px solid rgba(250,204,21,0.3)",
                }}
              >
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--color-yellow)",
                    margin: 0,
                  }}
                >
                  {errorPedido}
                </p>
              </div>
            )}
            <button
              onClick={confirmarPedido}
              disabled={enviando}
              style={{
                width: "100%",
                background: enviando ? "rgba(37,211,102,0.5)" : "#25D366",
                color: "white",
                fontWeight: 900,
                fontSize: "14px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "16px",
                borderRadius: "16px",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                boxShadow: enviando
                  ? "none"
                  : "0 8px 24px rgba(37,211,102,0.35)",
                cursor: enviando ? "not-allowed" : "pointer",
              }}
            >
              {enviando ? (
                <span className="spinner" />
              ) : (
                <MessageCircle style={{ width: "18px", height: "18px" }} />
              )}
              {enviando ? "Registrando..." : "Confirmar por WhatsApp"}
            </button>
            <p
              style={{
                textAlign: "center",
                fontSize: "11px",
                color: "var(--text-muted)",
                marginTop: "12px",
              }}
            >
              ¿Problemas? Soporte:{" "}
              <a
                href={"tel:+" + PHONE_SOPORTE}
                style={{
                  color: "var(--color-green)",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                222-333-9999
              </a>
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes changuito-spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { display:none; }
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
        button { font-family:inherit; }
      `}</style>
    </div>
  );
}
