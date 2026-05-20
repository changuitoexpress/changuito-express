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
  MapPin,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { supabase, ThemeToggle } from "./App";
import type { Theme } from "./App";
import type { Merchant, CartItem } from "./Dashboard";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Direccion {
  id: string;
  alias: string;
  calle: string;
  numero_casa: string;
  referencias: string | null;
  preferencias_entrega: string | null;
  es_principal: boolean;
}

interface Fraccionamiento {
  id: string;
  nombre: string;
  costo_envio: number;
}

const FORMAS_PAGO_VN = [
  { id: 'efectivo',       label: 'Efectivo',         emoji: '💵' },
  { id: 'tarjeta',        label: 'Tarjeta',          emoji: '💳' },
  { id: 'transferencia',  label: 'Transferencia',    emoji: '📲' },
  { id: 'en_linea',       label: 'Pago en línea',    emoji: '🌐' },
];

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
  clienteId?: string;
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

  // 3-step checkout state
  const [paso, setPaso] = useState<'direccion'|'pago'|'resumen'>('direccion');
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [dirSeleccionada, setDirSel] = useState<Direccion | null>(null);
  const [formaNueva, setFormaNueva] = useState(false);
  const [aliasDir, setAliasDir] = useState('Casa');
  const [calleDir, setCalleDir] = useState('');
  const [numeroDir, setNumeroDir] = useState('');
  const [referenciasDir, setReferenciasDir] = useState('');
  const [preferenciasDir, setPreferenciasDir] = useState('');
  const [formaPago, setFormaPago] = useState('efectivo');
  const [fraccionamientos, setFraccionamientos] = useState<Fraccionamiento[]>([]);
  const [fraccionamientoSel, setFraccionamientoSel] = useState<Fraccionamiento | null>(null);
  const [fracSearch, setFracSearch] = useState('');
  const [costoEnvioModal, setCostoEnvioModal] = useState(COSTO_ENVIO);
  const [modalLimite, setModalLimite] = useState(false);

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

  // Fetch direcciones y fraccionamientos cuando abre el modal
  useEffect(function () {
    if (!modalOpen) return;
    setPaso('direccion');
    setFraccionamientoSel(null);
    setCostoEnvioModal(COSTO_ENVIO);
    setFracSearch('');
    setFormaPago('efectivo');
    setErrorPedido('');
    async function loadDirecciones() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) { setFormaNueva(true); return; }
        const { data } = await supabase
          .from('direcciones_cliente')
          .select('*')
          .eq('cliente_id', uid)
          .order('es_principal', { ascending: false });
        if (data && data.length > 0) {
          setDirecciones(data as Direccion[]);
          setDirSel((data.find(function(d: any){ return d.es_principal; }) ?? data[0]) as Direccion);
          setFormaNueva(false);
        } else {
          setDirecciones([]);
          setDirSel(null);
          setFormaNueva(true);
        }
      } catch { setFormaNueva(true); }
    }
    async function loadFraccionamientos() {
      try {
        const { data } = await supabase
          .from('fraccionamientos')
          .select('id,nombre,costo_envio')
          .order('nombre', { ascending: true });
        if (data) setFraccionamientos(data as Fraccionamiento[]);
      } catch { /* ignore */ }
    }
    loadDirecciones();
    loadFraccionamientos();
  }, [modalOpen]);

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
    if (props.carritoGlobal) {
      const negociosActuales = new Set(props.carritoGlobal.map(function(i) { return i.negocio_id; }));
      if (!negociosActuales.has(m.id) && negociosActuales.size >= 4) {
        setModalLimite(true);
        return;
      }
    }
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

  const carritoParaMostrar = props.carritoGlobal && props.carritoGlobal.length > 0
    ? props.carritoGlobal
    : carritoLocal;
  const totalItems = carritoParaMostrar.reduce(function(a, i) { return a + i.cantidad; }, 0);
  const subtotalGlobal = carritoParaMostrar.reduce(function(a, i) { return a + i.precio * i.cantidad; }, 0);
  const subtotal = carritoLocal.reduce(function(a, i) { return a + i.precio * i.cantidad; }, 0);
  const negociosCount = new Set(carritoParaMostrar.map(function(i){ return i.negocio_id; })).size;
  const costoEnvioActual = COSTO_ENVIO + Math.max(0, negociosCount - 1) * 15;
  const totalConEnvio = subtotalGlobal + costoEnvioActual;

  // ── Confirmar pedido (3-step) ─────────────────────────────────────────────────
  async function confirmarPedido() {
    setEnviando(true);
    setErrorPedido('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;

      // Resolve address string
      let dirString = '';
      let zonaStr = '';
      if (formaNueva) {
        if (!calleDir.trim() || !numeroDir.trim()) {
          setErrorPedido('Ingresa calle y número de tu dirección.');
          setEnviando(false);
          return;
        }
        dirString = calleDir.trim() + ' ' + numeroDir.trim() + (referenciasDir.trim() ? ', ' + referenciasDir.trim() : '');
        // Save new address
        await supabase.from('direcciones_cliente').insert({
          cliente_id: uid,
          alias: aliasDir || 'Casa',
          calle: calleDir.trim(),
          numero_casa: numeroDir.trim(),
          referencias: referenciasDir.trim() || null,
          preferencias_entrega: preferenciasDir.trim() || null,
          es_principal: direcciones.length === 0,
        });
      } else if (dirSeleccionada) {
        dirString = dirSeleccionada.calle + ' ' + dirSeleccionada.numero_casa + (dirSeleccionada.referencias ? ', ' + dirSeleccionada.referencias : '');
      } else {
        setErrorPedido('Selecciona una dirección de entrega.');
        setEnviando(false);
        return;
      }

      if (fraccionamientoSel) zonaStr = fraccionamientoSel.nombre;

      const todosLosItems = props.carritoGlobal && props.carritoGlobal.length > 0
        ? props.carritoGlobal
        : carritoLocal;

      const subtotalItems = todosLosItems.reduce(function(a, i) { return a + i.precio * i.cantidad; }, 0);
      const negCount = new Set(todosLosItems.map(function(i) { return i.negocio_id; })).size;
      const baseEnvio = fraccionamientoSel ? fraccionamientoSel.costo_envio : costoEnvioModal;
      const totalEnvio = baseEnvio + Math.max(0, negCount - 1) * 15;
      const totalFinal = subtotalItems + totalEnvio;

      // Group by negocio
      const porNegocio: Record<string, typeof todosLosItems> = {};
      todosLosItems.forEach(function(item) {
        if (!porNegocio[item.negocio_id]) porNegocio[item.negocio_id] = [];
        porNegocio[item.negocio_id].push(item);
      });

      // Insert one pedido per negocio
      for (const negId of Object.keys(porNegocio)) {
        const items = porNegocio[negId];
        const sub = items.reduce(function(a, i) { return a + i.precio * i.cantidad; }, 0);
        await supabase.from('pedidos').insert({
          cliente_id: uid,
          negocio_id: negId,
          negocio_nombre: items[0].negocio,
          detalle: items.map(function(i) { return i.nombre + (i.tipo === 'producto' ? ' x' + i.cantidad : ''); }).join(', '),
          subtotal: sub,
          costo_envio: totalEnvio,
          total: sub + totalEnvio,
          estatus: 'pendiente',
          canal: 'webapp',
          cliente_email: clienteEmail,
          forma_pago: formaPago,
          direccion: dirString,
        });
      }

      // Build WhatsApp message
      const PAGO_LABELS: Record<string, string> = {
        efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta',
        transferencia: '📲 Transferencia', en_linea: '🌐 Pago en línea',
      };
      const linea = '━━━━━━━━━━━━━━━━━━━━━━';
      let msg = '*🛵 CHANGUITO EXPRESS*\n' + linea + '\n';
      msg += '👤 *Cliente:* ' + clienteEmail + '\n';
      msg += '📍 *Dirección:* ' + dirString + '\n';
      if (zonaStr) msg += '🏘️ *Zona:* ' + zonaStr + '\n';
      msg += '💳 *Pago:* ' + (PAGO_LABELS[formaPago] ?? formaPago) + '\n';
      msg += linea + '\n\n';

      Object.entries(porNegocio).forEach(function([_, items]) {
        const negName = (items[0] as CartItem).negocio;
        msg += '🍽️ *' + negName.toUpperCase() + '*\n';
        (items as CartItem[]).forEach(function(item) {
          if (item.tipo === 'mandadito') {
            msg += '   📝 ' + item.nombre + '\n';
          } else {
            msg += '   • ' + item.nombre + ' x' + item.cantidad + ' = $' + (item.precio * item.cantidad).toFixed(2) + '\n';
          }
        });
        msg += linea + '\n';
      });

      msg += '\n🚚 *Envío:* $' + totalEnvio.toFixed(2);
      if (zonaStr) msg += ' (' + zonaStr + ')';
      if (negCount > 1) msg += ' [+$' + ((negCount - 1) * 15).toFixed(0) + ' multi]';
      msg += '\n*💰 TOTAL: $' + totalFinal.toFixed(2) + '*';

      window.open('https://wa.me/' + PHONE_SOPORTE + '?text=' + encodeURIComponent(msg), '_blank');

      if (props.onUpdateCarritoGlobal) props.onUpdateCarritoGlobal([]);
      setCarritoLocal([]);
      setModalOpen(false);
    } catch (err: any) {
      setErrorPedido('Error inesperado: ' + (err.message ?? 'intenta de nuevo.'));
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

      {/* Modal checkout 3 pasos */}
      {modalOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:200, display:"flex", alignItems:"flex-end" }}
          onClick={function(){ setModalOpen(false); }}>
          <div className="theme-transition"
            style={{ width:"100%", maxWidth:"480px", margin:"0 auto", background:isDark?"#1e1e28":"#ffffff", borderRadius:"28px 28px 0 0", padding:"24px 20px 40px", maxHeight:"90vh", overflowY:"auto", position:"relative" }}
            onClick={function(e){ e.stopPropagation(); }}>
            {/* X cerrar */}
            <button
              onClick={function(){ setModalOpen(false); }}
              style={{ position:"absolute", top:"14px", right:"14px", width:"32px", height:"32px", borderRadius:"50%", background:"var(--bg-base)", border:"1px solid var(--border-subtle)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:10 }}
            >
              <X style={{ width:"14px", height:"14px", color:"var(--text-primary)" }} />
            </button>
            {/* Handle */}
            <div style={{ width:"40px", height:"4px", borderRadius:"2px", background:"var(--border-medium)", margin:"0 auto 20px" }} />

            {/* Step indicators */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"6px", marginBottom:"20px" }}>
              {(['direccion','pago','resumen'] as const).map(function(s, i) {
                const done = paso === 'resumen' || (paso === 'pago' && i === 0) || (paso === 'direccion' && false);
                const active = paso === s;
                const labels = ['Dirección','Pago','Confirmar'];
                return (
                  <React.Fragment key={s}>
                    {i > 0 && <div style={{ height:"1px", width:"24px", background:i <= (['direccion','pago','resumen'].indexOf(paso)) ? "var(--color-yellow)" : "var(--border-subtle)" }} />}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"2px" }}>
                      <div style={{ width:"26px", height:"26px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background: active ? "var(--color-yellow)" : (i < ['direccion','pago','resumen'].indexOf(paso) ? "rgba(250,204,21,0.3)" : "var(--bg-card)"), border: active ? "none" : "1px solid var(--border-subtle)" }}>
                        {i < ['direccion','pago','resumen'].indexOf(paso)
                          ? <Check style={{ width:"12px", height:"12px", color:"var(--color-yellow)" }} />
                          : <span style={{ fontSize:"11px", fontWeight:900, color: active ? "#020617" : "var(--text-muted)" }}>{i+1}</span>
                        }
                      </div>
                      <span style={{ fontSize:"8px", fontWeight:700, color: active ? "var(--color-yellow)" : "var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>{labels[i]}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── PASO 1: Dirección ─────────────────────────────────────────── */}
            {paso === 'direccion' && (
              <div>
                <h2 style={{ fontSize:"18px", fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px 0" }}>¿A dónde entregamos?</h2>
                <p style={{ fontSize:"12px", color:"var(--text-muted)", margin:"0 0 16px 0" }}>Elige o agrega una dirección</p>

                {/* Saved addresses */}
                {direcciones.length > 0 && !formaNueva && (
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"12px" }}>
                    {direcciones.map(function(d) {
                      const sel = dirSeleccionada?.id === d.id;
                      return (
                        <div key={d.id} onClick={function(){ setDirSel(d); }}
                          style={{ display:"flex", alignItems:"flex-start", gap:"10px", padding:"12px 14px", borderRadius:"14px", border: sel ? "2px solid var(--color-yellow)" : "1px solid var(--border-subtle)", background: sel ? "var(--color-yellow-dim)" : "var(--bg-card)", cursor:"pointer" }}>
                          <MapPin style={{ width:"16px", height:"16px", color: sel ? "var(--color-yellow)" : "var(--text-muted)", marginTop:"1px", flexShrink:0 }} />
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:"13px", fontWeight:800, color:"var(--text-primary)", margin:"0 0 2px 0" }}>{d.alias}</p>
                            <p style={{ fontSize:"11px", color:"var(--text-muted)", margin:0 }}>{d.calle} {d.numero_casa}{d.referencias ? ' · ' + d.referencias : ''}</p>
                          </div>
                          {sel && <Check style={{ width:"16px", height:"16px", color:"var(--color-yellow)", flexShrink:0, marginTop:"1px" }} />}
                          <button
                            onClick={async function(e) {
                              e.stopPropagation();
                              await supabase.from('direcciones_cliente').delete().eq('id', d.id);
                              setDirecciones(function(prev) {
                                const upd = prev.filter(function(x) { return x.id !== d.id; });
                                if (upd.length === 0) setFormaNueva(true);
                                if (dirSeleccionada?.id === d.id) setDirSel(upd[0] ?? null);
                                return upd;
                              });
                            }}
                            style={{ background:"none", border:"none", cursor:"pointer", color:"var(--color-red,#ef4444)", padding:"2px", lineHeight:0, flexShrink:0, marginTop:"1px" }}
                          >
                            <Trash2 style={{ width:"14px", height:"14px" }} />
                          </button>
                        </div>
                      );
                    })}
                    <button onClick={function(){ setFormaNueva(true); setDirSel(null); }}
                      style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px", borderRadius:"12px", background:"transparent", border:"1px dashed var(--border-subtle)", cursor:"pointer", color:"var(--text-muted)", fontSize:"13px", fontWeight:600, width:"100%", justifyContent:"center" }}>
                      + Nueva dirección
                    </button>
                  </div>
                )}

                {/* New address form */}
                {(formaNueva || direcciones.length === 0) && (
                  <div style={{ marginBottom:"12px" }}>
                    {direcciones.length > 0 && (
                      <button onClick={function(){ setFormaNueva(false); setDirSel(direcciones[0]); }}
                        style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"12px", background:"none", border:"none", cursor:"pointer", color:"var(--color-yellow)", fontSize:"12px", fontWeight:700, padding:0 }}>
                        ← Mis direcciones guardadas
                      </button>
                    )}
                    <p style={{ fontSize:"12px", fontWeight:700, color:"var(--text-muted)", margin:"0 0 8px 0", textTransform:"uppercase", letterSpacing:"0.06em" }}>Nueva dirección</p>
                    {[
                      { label:"Alias", val:aliasDir, set:setAliasDir, ph:"Casa, Trabajo…" },
                      { label:"Calle / Torre *", val:calleDir, set:setCalleDir, ph:"Av. Principal" },
                      { label:"Número / Depto *", val:numeroDir, set:setNumeroDir, ph:"#123" },
                      { label:"Referencias", val:referenciasDir, set:setReferenciasDir, ph:"Opcional" },
                      { label:"Instrucciones de entrega", val:preferenciasDir, set:setPreferenciasDir, ph:"Opcional" },
                    ].map(function(f) {
                      return (
                        <div key={f.label} style={{ marginBottom:"8px" }}>
                          <p style={{ fontSize:"11px", fontWeight:600, color:"var(--text-muted)", margin:"0 0 3px 0" }}>{f.label}</p>
                          <input value={f.val} onChange={function(e){ f.set(e.target.value); }} placeholder={f.ph}
                            style={{ width:"100%", boxSizing:"border-box", padding:"10px 13px", borderRadius:"11px", border:"1px solid var(--border-subtle)", background:"var(--bg-card)", color:"var(--text-primary)", fontSize:"13px", outline:"none" }} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fraccionamiento */}
                <div style={{ marginBottom:"16px" }}>
                  <p style={{ fontSize:"11px", fontWeight:700, color:"var(--text-muted)", margin:"0 0 6px 0", textTransform:"uppercase", letterSpacing:"0.06em" }}>🏘️ Zona de entrega</p>
                  {fraccionamientoSel ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderRadius:"12px", border:"2px solid var(--color-yellow)", background:"var(--color-yellow-dim)" }}>
                      <span style={{ fontSize:"13px", fontWeight:800, color:"var(--text-primary)" }}>{fraccionamientoSel.nombre}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                        <span style={{ fontSize:"12px", fontWeight:800, color:"var(--color-yellow)" }}>${fraccionamientoSel.costo_envio}</span>
                        <button onClick={function(){ setFraccionamientoSel(null); setCostoEnvioModal(COSTO_ENVIO); setFracSearch(""); }}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", padding:0, lineHeight:0 }}>
                          <X style={{ width:"14px", height:"14px" }} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input value={fracSearch} onChange={function(e){ setFracSearch(e.target.value); }} placeholder="Buscar fraccionamiento..."
                        style={{ width:"100%", boxSizing:"border-box", padding:"10px 13px", borderRadius:"11px", border:"1px solid var(--border-subtle)", background:"var(--bg-card)", color:"var(--text-primary)", fontSize:"13px", outline:"none", marginBottom:"4px" }} />
                      {fracSearch.trim() !== '' && (
                        <div style={{ maxHeight:"130px", overflowY:"auto", borderRadius:"11px", border:"1px solid var(--border-subtle)", background:"var(--bg-card)" }}>
                          {fraccionamientos.filter(function(f){ return f.nombre.toLowerCase().includes(fracSearch.toLowerCase()); }).map(function(f){
                            return (
                              <div key={f.id} onClick={function(){ setFraccionamientoSel(f); setCostoEnvioModal(f.costo_envio); setFracSearch(''); }}
                                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 13px", cursor:"pointer", borderBottom:"1px solid var(--border-subtle)" }}>
                                <span style={{ fontSize:"13px", fontWeight:700, color:"var(--text-primary)" }}>{f.nombre}</span>
                                <span style={{ fontSize:"12px", fontWeight:800, color:"var(--color-yellow)" }}>${f.costo_envio}</span>
                              </div>
                            );
                          })}
                          {fraccionamientos.filter(function(f){ return f.nombre.toLowerCase().includes(fracSearch.toLowerCase()); }).length === 0 && (
                            <p style={{ fontSize:"12px", color:"var(--text-muted)", padding:"10px 13px", margin:0 }}>Sin resultados</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {errorPedido !== '' && <p style={{ fontSize:"11px", color:"var(--color-red,#ef4444)", marginBottom:"10px" }}>{errorPedido}</p>}
                <button onClick={function(){ setPaso('pago'); setErrorPedido(''); }}
                  disabled={!dirSeleccionada && !formaNueva}
                  style={{ width:"100%", background:"var(--color-yellow)", color:"#020617", fontWeight:900, fontSize:"14px", padding:"15px", borderRadius:"16px", border:"none", cursor: (!dirSeleccionada && !formaNueva) ? "not-allowed" : "pointer", opacity: (!dirSeleccionada && !formaNueva) ? 0.5 : 1 }}>
                  Continuar →
                </button>
              </div>
            )}

            {/* ── PASO 2: Forma de pago ────────────────────────────────────── */}
            {paso === 'pago' && (
              <div>
                <button onClick={function(){ setPaso('direccion'); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:"12px", fontWeight:700, padding:"0 0 12px 0", display:"flex", alignItems:"center", gap:"4px" }}>
                  ← Volver
                </button>
                <h2 style={{ fontSize:"18px", fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px 0" }}>¿Cómo pagas?</h2>
                <p style={{ fontSize:"12px", color:"var(--text-muted)", margin:"0 0 16px 0" }}>Elige tu forma de pago preferida</p>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"20px" }}>
                  {FORMAS_PAGO_VN.map(function(fp) {
                    const sel = formaPago === fp.id;
                    return (
                      <div key={fp.id} onClick={function(){ setFormaPago(fp.id); }}
                        style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px", borderRadius:"14px", border: sel ? "2px solid var(--color-yellow)" : "1px solid var(--border-subtle)", background: sel ? "var(--color-yellow-dim)" : "var(--bg-card)", cursor:"pointer" }}>
                        <span style={{ fontSize:"20px" }}>{fp.emoji}</span>
                        <span style={{ fontSize:"14px", fontWeight:800, color:"var(--text-primary)", flex:1 }}>{fp.label}</span>
                        {sel && <Check style={{ width:"16px", height:"16px", color:"var(--color-yellow)" }} />}
                      </div>
                    );
                  })}
                </div>
                <button onClick={function(){ setPaso('resumen'); }}
                  style={{ width:"100%", background:"var(--color-yellow)", color:"#020617", fontWeight:900, fontSize:"14px", padding:"15px", borderRadius:"16px", border:"none", cursor:"pointer" }}>
                  Continuar →
                </button>
              </div>
            )}

            {/* ── PASO 3: Resumen ───────────────────────────────────────────── */}
            {paso === 'resumen' && (
              <div>
                <button onClick={function(){ setPaso('pago'); }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:"12px", fontWeight:700, padding:"0 0 12px 0", display:"flex", alignItems:"center", gap:"4px" }}>
                  ← Volver
                </button>
                <h2 style={{ fontSize:"18px", fontWeight:900, color:"var(--text-primary)", margin:"0 0 4px 0" }}>Confirma tu pedido</h2>
                <p style={{ fontSize:"12px", color:"var(--text-muted)", margin:"0 0 14px 0" }}>{negociosCount > 1 ? negociosCount + ' negocios' : m.name}</p>

                {/* Items */}
                <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"14px" }}>
                  {(function(){
                    const grupos: Record<string, typeof carritoParaMostrar> = {};
                    carritoParaMostrar.forEach(function(i){ if (!grupos[i.negocio]) grupos[i.negocio]=[]; grupos[i.negocio].push(i); });
                    return Object.entries(grupos).map(function([neg, items]) {
                      return (
                        <div key={neg}>
                          {negociosCount > 1 && <p style={{ fontSize:"10px", fontWeight:900, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--color-yellow)", margin:"0 0 5px 0" }}>🍽️ {neg}</p>}
                          {items.map(function(item) {
                            return (
                              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
                                <span style={{ fontSize:"20px" }}>{item.emoji ?? '🍽️'}</span>
                                <div style={{ flex:1 }}>
                                  <p style={{ fontSize:"13px", fontWeight:700, color:"var(--text-primary)", margin:"0 0 1px 0" }}>{item.nombre}</p>
                                  <p style={{ fontSize:"11px", color:"var(--text-muted)", margin:0 }}>x{item.cantidad} · ${item.precio.toFixed(2)}</p>
                                </div>
                                <span style={{ fontSize:"13px", fontWeight:800, color:"var(--color-yellow)" }}>${(item.precio*item.cantidad).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Delivery + payment info */}
                <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderRadius:"14px", padding:"12px 14px", marginBottom:"12px", border:"1px solid var(--border-subtle)", display:"flex", flexDirection:"column", gap:"6px" }}>
                  {(dirSeleccionada || (formaNueva && calleDir)) && (
                    <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                      <MapPin style={{ width:"13px", height:"13px", color:"var(--text-muted)", marginTop:"1px", flexShrink:0 }} />
                      <span style={{ fontSize:"12px", color:"var(--text-primary)" }}>
                        {dirSeleccionada ? dirSeleccionada.calle + ' ' + dirSeleccionada.numero_casa : calleDir + ' ' + numeroDir}
                        {fraccionamientoSel ? ' · ' + fraccionamientoSel.nombre : ''}
                      </span>
                    </div>
                  )}
                  <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                    <span style={{ fontSize:"13px" }}>{FORMAS_PAGO_VN.find(function(f){ return f.id === formaPago; })?.emoji ?? '💵'}</span>
                    <span style={{ fontSize:"12px", color:"var(--text-primary)" }}>{FORMAS_PAGO_VN.find(function(f){ return f.id === formaPago; })?.label ?? formaPago}</span>
                  </div>
                </div>

                {/* Totals */}
                <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderRadius:"14px", padding:"14px", marginBottom:"14px", border:"1px solid var(--border-subtle)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                    <span style={{ fontSize:"13px", color:"var(--text-muted)" }}>Subtotal</span>
                    <span style={{ fontSize:"13px", fontWeight:700, color:"var(--text-primary)" }}>${subtotalGlobal.toFixed(2)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
                    <span style={{ fontSize:"13px", color:"var(--text-muted)" }}>Envío{fraccionamientoSel ? ' · ' + fraccionamientoSel.nombre : ''}</span>
                    <span style={{ fontSize:"13px", fontWeight:700, color:"var(--text-primary)" }}>
                      ${(fraccionamientoSel ? fraccionamientoSel.costo_envio : costoEnvioModal).toFixed(2)}
                      {negociosCount > 1 ? ' (+$' + ((negociosCount-1)*15).toFixed(0) + ' multi)' : ''}
                    </span>
                  </div>
                  <div style={{ borderTop:"1px solid var(--border-subtle)", paddingTop:"10px", display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:"15px", fontWeight:800, color:"var(--text-primary)" }}>Total</span>
                    <span style={{ fontSize:"18px", fontWeight:900, color:"var(--color-yellow)" }}>
                      ${(subtotalGlobal + (fraccionamientoSel ? fraccionamientoSel.costo_envio : costoEnvioModal) + Math.max(0, negociosCount-1)*15).toFixed(2)}
                    </span>
                  </div>
                </div>

                {errorPedido !== '' && (
                  <div style={{ marginBottom:"12px", padding:"10px 14px", borderRadius:"12px", background:"var(--color-yellow-dim)", border:"1px solid rgba(250,204,21,0.3)" }}>
                    <p style={{ fontSize:"11px", color:"var(--color-yellow)", margin:0 }}>{errorPedido}</p>
                  </div>
                )}
                <button onClick={confirmarPedido} disabled={enviando}
                  style={{ width:"100%", background: enviando ? "rgba(37,211,102,0.5)" : "#25D366", color:"white", fontWeight:900, fontSize:"14px", textTransform:"uppercase", letterSpacing:"0.08em", padding:"16px", borderRadius:"16px", border:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px", boxShadow: enviando ? "none" : "0 8px 24px rgba(37,211,102,0.35)", cursor: enviando ? "not-allowed" : "pointer" }}>
                  {enviando ? <span className="spinner" /> : <MessageCircle style={{ width:"18px", height:"18px" }} />}
                  {enviando ? 'Registrando...' : 'Confirmar por WhatsApp'}
                </button>
                <p style={{ textAlign:"center", fontSize:"11px", color:"var(--text-muted)", marginTop:"12px" }}>
                  ¿Problemas? <a href={"tel:+" + PHONE_SOPORTE} style={{ color:"var(--color-green)", fontWeight:700, textDecoration:"none" }}>222-333-9999</a>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal límite 4 negocios */}
      {modalLimite && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.72)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}
          onClick={function(){ setModalLimite(false); }}
        >
          <div
            style={{ background:"var(--bg-card)", borderRadius:"24px", padding:"28px 24px", maxWidth:"340px", width:"100%", textAlign:"center", boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}
            onClick={function(e){ e.stopPropagation(); }}
          >
            <div style={{ fontSize:"48px", marginBottom:"12px" }}>🛒</div>
            <h2 style={{ fontSize:"17px", fontWeight:900, color:"var(--text-primary)", margin:"0 0 10px 0", lineHeight:1.25 }}>Límite alcanzado</h2>
            <p style={{ fontSize:"13px", color:"var(--text-muted)", margin:"0 0 20px 0", lineHeight:1.55 }}>
              Máximo <strong style={{ color:"var(--text-primary)" }}>4 negocios</strong> por pedido para garantizar la frescura y velocidad de tus repartidores.
            </p>
            <button
              onClick={function(){ setModalLimite(false); }}
              style={{ width:"100%", background:"var(--color-yellow)", color:"#020617", fontWeight:900, fontSize:"14px", padding:"14px", borderRadius:"14px", border:"none", cursor:"pointer" }}
            >
              Entendido
            </button>
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
