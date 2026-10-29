/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import {
  Search,
  Star,
  Clock,
  ChevronRight,
  WifiOff,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Plus,
  Minus,
  MessageCircle,
  Trash2,
  MapPin,
  CreditCard,
  Plus as PlusIcon,
  Check,
  Menu,
  LogOut,
  Store,
  Bike,
  ShoppingCart,
  Briefcase,
  Sparkles,
  Shield,
  Building2,
  Car,
  ShoppingBasket,
  Smartphone,
  Wallet,
} from "lucide-react";
import { supabase, ThemeToggle } from "./App";
import type { AppSession, Theme } from "./App";
import {
  listDeviceAuthSessions,
  revokeDeviceAuthSession,
  signOut,
  signOutEverywhere,
} from "./authFlows";
import type { DeviceAuthSession } from "./authFlows";
import {
  clearFormDraft,
  clearUserFormDrafts,
  readFormDraft,
  writeFormDraft,
} from "./formDrafts";
import VistaNegocio from "./VistaNegocio";
import ChanguitoAI from "./ChanguiAssistant";
import Monedero from "./Monedero";
import { getFreeShippingProgress, getShippingCharge } from "./freeShippingProgress";
import SuperCatalog from "./components/SuperCatalog";
import { scrollToSectionHeading } from "./sectionScroll";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Merchant {
  id: string;
  name: string;
  category: string;
  rating: number | null;
  delivery_time: string | null;
  image_url: string | null;
  is_open: boolean;
  phone_number: string | null;
  commission: number | null;
  horario_apertura: string | null;
  horario_cierre: string | null;
}

export interface CartItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  negocio: string;
  negocio_id: string;
  phone_number: string;
  tipo: "producto" | "mandadito";
  emoji?: string;
}

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

interface DashboardProps {
  session: AppSession;
  theme: Theme;
  onThemeToggle: () => void;
  onIrBazar?: () => void;
  onIrServicios?: () => void;
  onIrAdmin?: () => void;
  onIrShopping?: () => void;
  onIrNegocio?: () => void;
  onIrRepas?: () => void;
  onIrBienes?: () => void;
  onIrAutos?: () => void;
  onIrMonedero?: () => void;
  carritoGlobal: CartItem[];
  onUpdateCarritoGlobal: (items: CartItem[]) => void;
  onAddToCart?: (items: any[]) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const COSTO_ENVIO = 50;
const PHONE_OPERATIVO = "522223339999";

const FORMAS_PAGO = [
  { id: "efectivo", label: "Efectivo", emoji: "💵" },
  { id: "tarjeta", label: "Tarjeta", emoji: "💳" },
  { id: "transferencia", label: "Transferencia", emoji: "📲" },
  { id: "en_linea", label: "Pago en línea", emoji: "🌐" },
];

type CheckoutDraft = {
  cartSignature: string;
  paso: "carrito" | "direccion" | "pago" | "resumen";
  dirSeleccionadaId: string | null;
  formaNueva: boolean;
  alias: string;
  calle: string;
  numero: string;
  referencias: string;
  preferencias: string;
  formaPago: string;
  fraccionamientoId: string | null;
  fracSearch: string;
};

const CHECKOUT_DRAFT_ID = "customer-checkout";

function checkoutCartSignature(carrito: CartItem[]): string {
  return carrito
    .map(function (item) {
      return item.id + ":" + item.cantidad;
    })
    .sort()
    .join("|");
}

function getCheckoutDraft(userId: string, carrito: CartItem[]): CheckoutDraft | null {
  if (!carrito.length) return null;
  const draft = readFormDraft<CheckoutDraft>(userId, CHECKOUT_DRAFT_ID);
  if (!draft || draft.cartSignature !== checkoutCartSignature(carrito)) {
    if (draft) clearFormDraft(userId, CHECKOUT_DRAFT_ID);
    return null;
  }
  return draft;
}

function deviceDescription(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo no identificado";

  const platform = /iphone|ipad|ipod/i.test(userAgent)
    ? "iPhone o iPad"
    : /android/i.test(userAgent)
      ? "Android"
      : /windows/i.test(userAgent)
        ? "Windows"
        : /macintosh|mac os/i.test(userAgent)
          ? "Mac"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "otro dispositivo";
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /firefox\//i.test(userAgent)
      ? "Firefox"
      : /chrome\//i.test(userAgent) && !/chromium/i.test(userAgent)
        ? "Chrome"
        : /safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)
          ? "Safari"
          : "Navegador";

  return `${browser} · ${platform}`;
}

function deviceActivityDate(value: string | null): string {
  if (!value) return "Actividad reciente no disponible";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Actividad reciente no disponible";
  return `Última actividad: ${date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

// ─── Secciones Restaurantes ───────────────────────────────────────────────────
const SECCIONES_REST = [
  { titulo: "Desayunos y Comidas", cats: ["desayunos y comidas"], emoji: "🍳" },
  { titulo: "Cemitas", cats: ["cemitas"], emoji: "🫓" },
  { titulo: "Tortas", cats: ["tortas"], emoji: "🥖" },
  { titulo: "Crepas", cats: ["crepas"], emoji: "🥞" },
  { titulo: "Memelas", cats: ["memelas"], emoji: "🫔" },
  { titulo: "Taquerías", cats: ["taqueria"], emoji: "🌮" },
  { titulo: "Pizzerías", cats: ["pizzeria"], emoji: "🍕" },
  { titulo: "Hamburguesas", cats: ["hamburguesas"], emoji: "🍔" },
  {
    titulo: "Comida Asiática",
    cats: ["comida asiatica"],
    emoji: "🍜",
    customId: "seccion-asiatica",
  },
  { titulo: "Pollos Preparados", cats: ["pollos preparados"], emoji: "🍗" },
  { titulo: "Pescados y Mariscos", cats: ["pescados y mariscos"], emoji: "🦐" },
  { titulo: "Pozolería", cats: ["pozoleria"], emoji: "🍲" },
  { titulo: "Cochinita Pibil", cats: ["cochinita pibil"], emoji: "🐽" },
  { titulo: "Carnitas", cats: ["carnitas"], emoji: "🐖" },
  { titulo: "Barbacoa", cats: ["barbacoa"], emoji: "🫕" },
  { titulo: "Birria", cats: ["birria"], emoji: "🌶️" },
  { titulo: "Alitas y Boneless", cats: ["alitas y boneless"], emoji: "🍗" },
  {
    titulo: "Elotes y Antojitos",
    cats: ["elotes y antojitos"],
    emoji: "🌽",
    customId: "seccion-elotes",
  },
  { titulo: "Cafeterías", cats: ["cafeteria"], emoji: "☕" },
  {
    titulo: "Cheesesteak",
    cats: ["cheesesteak"],
    names: ["philly steak"],
    emoji: "🥩",
    customId: "seccion-cheese",
  },
];

const SECCIONES_MAND = [
  {
    titulo: "Supermercados",
    keys: ["chedraui", "comer", "walmart"],
    emoji: "🛒",
  },
  { titulo: "Frutas y Verduras", keys: ["canasta", "mercadito"], emoji: "🥦" },
  {
    titulo: "Carnicerías",
    keys: ["lulu", "maravillas", "ryc", "wild fork", "norte", "san juan", "abastessen"],
    emoji: "🥩",
  },
  { titulo: "Pollerías", keys: ["gallo giro"], emoji: "🐓" },
  { titulo: "Pescadería", keys: ["almeja"], emoji: "🐠" },
  { titulo: "Lácteos", keys: ["pastora", "piccolina"], emoji: "🧀" },
  {
    titulo: "Farmacias",
    keys: [
      "farmacia",
      "farmacias",
      "farmadrogueria",
      "benavides",
      "similares",
      "ahorro",
      "pablo",
    ],
    emoji: "💊",
  },
  {
      titulo: "Vinos y Licores",
      keys: ["prissa", "vineria"],
      emoji: "🍾",
  },
  { titulo: "Papelerías", keys: ["papelomas", "depot", "ofix"], emoji: "📎" },
  { titulo: "Lavandería", keys: ["yumikos"], emoji: "👕" },
  {
    titulo: "Desayunos",
    keys: ["toks", "viejo", "ocho 30", "tagers", "almorzero", "asadoja", "cuetzalan"],
    emoji: "🍳",
  },
  { titulo: "Taquerías", keys: ["oriental", "don pastor", "salsa premier",  "suprema", "diego", "sirloncito", "toda", "activo", "rickis"], emoji: "🌮" },
  { titulo: "Pizzerías", keys: ["caesar", "domino", "angelotti", "vittorio"], emoji: "🍕" },
  {
    titulo: "Comida Asiática",
    keys: ["sushiitto", "sushi seven", "rock n wok", "domu", "stop by ramen", "obento"],
    emoji: "🍜",
  },
  {
    titulo: "Hamburguesas",
    keys: ["mcdonald", "carl", "burger", "mccarthy", "chido"],
    emoji: "🍔",
  },
  { titulo: "Barbacoa", keys: ["barbaquita", "zapata"], emoji: "🫕" },
  {
    titulo: "Pollos y Flautas",
    keys: ["kfc", "pollo feliz", "flautlan", "wingstop"],
    emoji: "🍗",
  },
  {
      titulo: "Sandwiches",
      keys: ["subway"],
      emoji: "🥖",
  },
  {
    titulo: " Cemitas",
    keys: ["catedral"],
    emoji: "🫓",
  },
  {
    titulo: "Cochinita Pibil",
    keys: ["koi koi"],
    emoji: "🐽",
  },
  {
      titulo: "Memelas",
      keys: ["resurreccion"],
      emoji: "🌮",
  },
  {
    titulo: "Elotes y Esquites",
    keys: ["danielote", "d skite"],
    emoji: "🌽",
  },
  {
    titulo: "Fresas con Crema",
    keys: ["mi rey fresas"],
    emoji: "🍓",
},
  {
      titulo: "Las Marquesitas",
      keys: ["las marquesitas"],
      emoji: "🧇",
  },
  {
    titulo: "Waffles",
    keys: ["wafflegg"],
    emoji: "🥞",
},
  { titulo: "Crepas", keys: ["crepa"], emoji: "🥞" },
  { titulo: "Cafeterías", keys: ["starbucks", "italian coffee", "milamour"], emoji: "☕" },
  { titulo: "Saludable", keys: ["greenbite"], emoji: "🥗" },
  { titulo: "Panaderías", keys: ["hackl", "rosario", "almendra"], emoji: "🥖" },
  { titulo: "Pastelerías", keys: ["la zarza", "la europea", "therese", "postreria", "tarlets", "karamella", "margu"], emoji: "🎂" },
  { titulo: "Heladerías", keys: ["santa clara", "queen", "moyo", "biancolatte"], emoji: "🍦" },
  { titulo: "Bebidas Preparadas", keys: ["rapichela", "clama"], emoji: "🍻" },
  { titulo: "Comida Libanesa", keys: ["biblos"], emoji: "🫔" },
  { titulo: "Pescados y Mariscos", keys: ["taco cabo", "marea"], emoji: "🦐" },
  { titulo: "Mascotas", keys: ["petco", "guau", "clinica", "hospital", "shop"], emoji: "🐾" },
  { titulo: "Conveniencia", keys: ["oxxo", "seven eleven", "circle", "3b", "rola", "waldo s"], emoji: "🏪" },
  {
      titulo: "Cosméticos",
      keys: ["el pequeño gigante"],
      emoji: "💄",
  },
];

// ─── Horario helpers ──────────────────────────────────────────────────────────
const MANDADITOS_FOOD_TITLES = new Set([
  ...SECCIONES_REST.map(function (section) { return section.titulo; }),
  "Desayunos", "Pollos y Flautas", "Sandwiches", "Elotes y Esquites",
  "Fresas con Crema", "Las Marquesitas", "Waffles", "Saludable",
  "Panaderías", "Pastelerías", "Heladerías", "Bebidas Preparadas", "Comida Libanesa",
]);
const SECCIONES_PEDIDOS_ESCRITOS = [
  {
    titulo: "Restaurantes por escrito",
    emoji: "📝",
    keys: SECCIONES_MAND.filter(function (section) {
      return MANDADITOS_FOOD_TITLES.has(section.titulo.trim());
    }).flatMap(function (section) { return section.keys; }),
  },
  ...SECCIONES_MAND,
];

function esAbierto(horarioApertura: string, horarioCierre: string): boolean {
  const ahora = new Date();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  const partsAp = horarioApertura.split(":").map(Number);
  const partsCi = horarioCierre.split(":").map(Number);
  const apertura = partsAp[0] * 60 + partsAp[1];
  const cierre = partsCi[0] * 60 + partsCi[1];
  return horaActual >= apertura && horaActual < cierre;
}

// ─── Botones acceso rápido ─────────────────────────────────────────────────────
const botonesMandaditos = [
  {
    id: "supermercados",
    emoji: "🛒",
    label: "Supermercados",
    sectionId: "seccion-supermercados",
  },
  {
    id: "frutas y verduras",
    emoji: "🍎",
    label: "Frutas y Verduras",
    sectionId: "seccion-frutas-y-verduras",
  },
  {
    id: "carnicerías",
    emoji: "🥩",
    label: "Carnicerías",
    sectionId: "seccion-carniceriass",
  },
  {
    id: "pollerías",
    emoji: "🐓",
    label: "Pollerías",
    sectionId: "seccion-pollerias",
  },
  {
    id: "pescaderías",
    emoji: "🐟",
    label: "Pescaderías",
    sectionId: "seccion-pescaderia",
  },
  {
    id: "lacteos",
    emoji: "🧀",
    label: "Lácteos",
    sectionId: "seccion-lacteos",
  },
  {
    id: "papelerías",
    emoji: "📚",
    label: "Papelería",
    sectionId: "seccion-papelerias",
  },
  {
    id: "lavanderias",
    emoji: "🧺",
    label: "Lavanderías",
    sectionId: "seccion-lavanderia",
  },
  {
    id: "mascotas",
    emoji: "🐕",
    label: "Mascotas",
    sectionId: "seccion-mascotas",
  },
];

const botonesRestaurantes = [
  {
    id: "comida",
    emoji: "🍕",
    label: "Comida",
    sectionId: "seccion-restaurantes",
  },
  {
    id: "asiatica",
    emoji: "🍜",
    label: "Asiática",
    sectionId: "seccion-comida-asiatica",
  },
  {
    id: "elotes",
    emoji: "🌽",
    label: "Elotes y Antojitos",
    sectionId: "seccion-elotes-y-antojitos",
  },
  {
    id: "cheesesteak",
    emoji: "🥙",
    label: "Cheesesteak",
    sectionId: "seccion-cheesesteak",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getEmoji(cat: string): string {
  const m: Record<string, string> = {
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
    "cochinita pibil": "🐽",
    carnitas: "🐖",
    barbacoa: "🫕",
    birria: "🌶️",
    "alitas y boneless": "🍗",
    "elotes y antojitos": "🌽",
    cafeteria: "☕",
    mandaditos: "🛒",
    tiendita: "🏪",
  };
  return m[cat?.toLowerCase().trim()] ?? "🍽️";
}

function buildGrad(cat: string): string {
  const m: Record<string, string> = {
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
    m[cat?.toLowerCase().trim()] ?? "linear-gradient(135deg,#1a1a2e,#2d2d44)"
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div
      style={{
        minWidth: "160px",
        width: "160px",
        borderRadius: "18px",
        overflow: "hidden",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}
    >
      <div className="skeleton" style={{ height: "90px" }} />
      <div
        style={{
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div className="skeleton" style={{ height: "12px", width: "70%" }} />
        <div className="skeleton" style={{ height: "10px", width: "50%" }} />
      </div>
    </div>
  );
}

// ─── Tarjeta Negocio ──────────────────────────────────────────────────────────
function TarjetaNegocio(props: { merchant: Merchant; onClick: () => void }) {
  const m = props.merchant;
  const isClosed =
    m.horario_apertura && m.horario_cierre
      ? !esAbierto(m.horario_apertura, m.horario_cierre)
      : !m.is_open;
  return (
    <div
      onClick={props.onClick}
      style={{
        minWidth: "160px",
        width: "160px",
        borderRadius: "18px",
        overflow: "hidden",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        cursor: "pointer",
        flexShrink: 0,
        filter: isClosed ? "grayscale(0.7) opacity(0.6)" : "none",
      }}
    >
      <div
        style={{
          height: "90px",
          background: buildGrad(m.category),
          position: "relative",
          overflow: "hidden",
        }}
      >
        {m.image_url ? (
          <img
            src={m.image_url}
            alt={m.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
              fontSize: "32px",
              opacity: 0.4,
            }}
          >
            {getEmoji(m.category)}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            padding: "2px 7px",
            borderRadius: "12px",
            background: isClosed ? "rgba(0,0,0,0.6)" : "rgba(34,197,94,0.85)",
            fontSize: "8px",
            fontWeight: 900,
            color: "white",
            textTransform: "uppercase",
          }}
        >
          {isClosed ? "Cerrado" : "● Abierto"}
        </div>
      </div>
      <div style={{ padding: "10px 10px 12px" }}>
        <p
          style={{
            fontSize: "12px",
            fontWeight: 800,
            color: "var(--text-primary)",
            margin: "0 0 3px 0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.name}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontSize: "10px",
              color: "var(--color-yellow)",
              fontWeight: 700,
            }}
          >
            ★ {(m.rating ?? 4.5).toFixed(1)}
          </span>
          <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
            · {m.delivery_time ?? "25-35 min"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sección Horizontal ───────────────────────────────────────────────────────
function tituloAId(titulo: string): string {
  return (
    "seccion-" +
    titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
  );
}

function SeccionH(props: {
  titulo: string;
  emoji: string;
  merchants: Merchant[];
  loading: boolean;
  onSelect: (m: Merchant) => void;
  customId?: string;
  forceVisible?: boolean;
}) {
  if (!props.loading && props.merchants.length === 0 && !props.forceVisible) return null;
  return (
    <div
      id={props.customId ?? tituloAId(props.titulo)}
      style={{ marginBottom: "8px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 16px",
          marginBottom: "4px",
        }}
      >
        <span style={{ fontSize: "20px" }}>{props.emoji}</span>
        <h2
          style={{
            fontSize: "15px",
            fontWeight: 800,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {props.titulo}
        </h2>
        {!props.loading && (
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            ({props.merchants.length})
          </span>
        )}
      </div>
      {!props.loading && props.merchants.length === 0 && (
        <p style={{ padding: "12px 16px", fontSize: "13px", color: "var(--text-secondary)" }}>Todavía no hay negocios disponibles en esta categoría.</p>
      )}
      <div
        style={{
          overflowX: "auto",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingBottom: "4px",
          display: "flex",
          gap: "12px",
          scrollbarWidth: "none",
        }}
      >
        {props.loading
          ? [1, 2, 3].map(function (i) {
              return <Skeleton key={i} />;
            })
          : props.merchants.map(function (m) {
              return (
                <TarjetaNegocio
                  key={m.id}
                  merchant={m}
                  onClick={function () {
                    props.onSelect(m);
                  }}
                />
              );
            })}
      </div>
    </div>
  );
}

// ─── Banner rotativo ──────────────────────────────────────────────────────────
function Banner() {
  const [slide, setSlide] = useState(0);
  const slides = [
    {
      bg: "linear-gradient(135deg,#facc15,#f59e0b)",
      t: "⭐ Changuito Expréss App 🐵",
      s: "Tu negocio aquí · 222-858-6650",
    },
    {
      bg: "linear-gradient(135deg,#ef4444,#b91c1c)",
      t: "🚀 ¿Tienes un negocio?",
      s: "Únete a Changuito Express",
    },
    {
      bg: "linear-gradient(135deg,#22c55e,#15803d)",
      t: "📍 LOMAS 1 ● 2 ● 3 ● LA VISTA",
      s: "Cobertura exclusiva limitada",
    },
    {
      bg: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
      t: "💎 Publica tus Productos",
      s: "En el Bazar Vecinal Exclusivo",
    },
  ];
  useEffect(function () {
    const t = setInterval(function () {
      setSlide(function (p) {
        return (p + 1) % slides.length;
      });
    }, 4500);
    return function () {
      clearInterval(t);
    };
  }, []);
  const s = slides[slide];
  return (
    <div
      style={{
        margin: "0 16px 8px",
        borderRadius: "18px",
        background: s.bg,
        padding: "14px 18px",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: "-8px",
          top: "-8px",
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
        }}
      />
      <p
        style={{
          fontSize: "9px",
          fontWeight: 900,
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
          letterSpacing: "0.2em",
          margin: "0 0 4px 0",
        }}
      >
        Publicidad
      </p>
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 900,
          color: "white",
          margin: "0 0 3px 0",
        }}
      >
        {s.t}
      </h3>
      <p
        style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: 0 }}
      >
        {s.s}
      </p>
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          right: "14px",
          display: "flex",
          gap: "4px",
        }}
      >
        {slides.map(function (_, i) {
          return (
            <span
              key={i}
              style={{
                width: i === slide ? "14px" : "5px",
                height: "5px",
                borderRadius: "3px",
                background: i === slide ? "white" : "rgba(255,255,255,0.35)",
                transition: "width 0.3s",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal Mandadito ──────────────────────────────────────────────────────────
function ModalMandadito(props: {
  merchant: Merchant;
  onClose: () => void;
  onAgregar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const cerrado = props.merchant.horario_apertura && props.merchant.horario_cierre
    ? !esAbierto(props.merchant.horario_apertura, props.merchant.horario_cierre)
    : !props.merchant.is_open;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 400,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={props.onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="written-order-title"
        onKeyDown={function (event) { if (event.key === "Escape") props.onClose(); }}
        style={{
          width: "100%",
          maxWidth: "480px",
          margin: "0 auto",
          background: "var(--bg-card)",
          borderRadius: "28px 28px 0 0",
          padding: "24px 20px 40px",
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
        <button type="button" aria-label="Cerrar pedido por escrito" onClick={props.onClose} style={{ display: "block", marginLeft: "auto", padding: "8px", color: "var(--text-primary)" }}><X size={20} /></button>
        <h2
          id="written-order-title"
          style={{
            fontSize: "18px",
            fontWeight: 900,
            color: "var(--text-primary)",
            margin: "0 0 4px 0",
          }}
        >
          {props.merchant.name}
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            margin: "0 0 16px 0",
          }}
        >
          Escribe lo que necesitas — se agregará a tu carrito
        </p>
        {cerrado && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.22)",
              marginBottom: "12px",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-red)" }}>
              🔴 Servicio cerrado — pedidos no disponibles en este momento
            </span>
          </div>
        )}
        <textarea
          aria-label="Tu pedido por escrito"
          autoFocus
          value={texto}
          onChange={function (e) {
            if (cerrado) return;
            setTexto(e.target.value);
          }}
          disabled={cerrado}
          placeholder={
            !cerrado
              ? "Ej: 1 pizza pepperoni mediana, 2 refrescos de cola..."
              : "Servicio cerrado"
          }
          rows={4}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "14px",
            color: "var(--text-primary)",
            fontSize: "14px",
            outline: "none",
            resize: "none",
            fontFamily: "system-ui,sans-serif",
            marginBottom: "12px",
            opacity: cerrado ? 0.45 : 1,
            cursor: cerrado ? "not-allowed" : "text",
          }}
        />
        {!cerrado && (
          <button
            onClick={function () {
              if (texto.trim() === "") return;
              props.onAgregar(texto.trim());
            }}
            disabled={texto.trim() === ""}
            style={{
              width: "100%",
              background:
                texto.trim() === ""
                  ? "rgba(250,204,21,0.4)"
                  : "var(--color-yellow)",
              color: "#020617",
              fontWeight: 900,
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "14px",
              borderRadius: "14px",
              border: "none",
              cursor: texto.trim() === "" ? "not-allowed" : "pointer",
            }}
          >
            Agregar al carrito
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modal Checkout (Carrito + Dirección + Pago + Confirmar) ──────────────────
function ModalCheckout(props: {
  carrito: CartItem[];
  clienteId: string;
  clienteEmail: string;
  clienteNombre?: string;
  onClose: () => void;
  onPedidoOk: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateCantidad: (id: string, delta: number) => void;
}) {
  const [draft] = useState<CheckoutDraft | null>(function () {
    return getCheckoutDraft(props.clienteId, props.carrito);
  });
  const [paso, setPaso] = useState<
    "carrito" | "direccion" | "pago" | "resumen"
  >(draft?.paso ?? "carrito");
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [dirSeleccionada, setDirSel] = useState<Direccion | null>(null);
  const [formaNueva, setFormaNueva] = useState(draft?.formaNueva ?? false);
  const [alias, setAlias] = useState(draft?.alias ?? "Casa");
  const [calle, setCalle] = useState(draft?.calle ?? "");
  const [numero, setNumero] = useState(draft?.numero ?? "");
  const [referencias, setReferencias] = useState(draft?.referencias ?? "");
  const [preferencias, setPreferencias] = useState(draft?.preferencias ?? "");
  const [formaPago, setFormaPago] = useState(draft?.formaPago ?? "efectivo");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [fraccionamientos, setFraccionamientos] = useState<Fraccionamiento[]>(
    [],
  );
  const [fraccionamientoSel, setFraccionamientoSel] =
    useState<Fraccionamiento | null>(null);
  const [fracSearch, setFracSearch] = useState(draft?.fracSearch ?? "");
  const [costoEnvio, setCostoEnvio] = useState(50);
  const [aplicarEnvioGratis, setAplicarEnvioGratis] = useState(false);
  const [envioGratis, setEnvioGratis] = useState<{
    status: "loading" | "available" | "unavailable" | "error";
    remainingOrders: number | null;
  }>({ status: "loading", remainingOrders: null });

  useEffect(function () {
    let activo = true;
    let solicitud = 0;
    const cargarDisponibilidad = async function () {
      const solicitudActual = ++solicitud;
      setEnvioGratis({ status: "loading", remainingOrders: null });
      try {
        const [walletResult, deliveredResult] = await Promise.all([
          supabase
            .from("monedero_cliente")
            .select("envios_gratis_usados")
            .eq("user_id", props.clienteId)
            .maybeSingle(),
          supabase
            .from("pedidos")
            .select("id", { count: "exact", head: true })
            .eq("cliente_id", props.clienteId)
            .eq("estatus", "entregado"),
        ]);
        if (walletResult.error) throw walletResult.error;
        if (deliveredResult.error) throw deliveredResult.error;
        if (deliveredResult.count === null) {
          throw new Error("No se pudo verificar el historial de pedidos.");
        }
        if (!activo || solicitudActual !== solicitud) return;
        const progress = getFreeShippingProgress(
          deliveredResult.count,
          walletResult.data?.envios_gratis_usados ?? 0,
        );
        setAplicarEnvioGratis(progress.available);
        setEnvioGratis({
          status: progress.available ? "available" : "unavailable",
          remainingOrders: progress.remainingOrders,
        });
      } catch (error) {
        console.error("[Changuito] No se pudo verificar el envío gratis:", error);
        if (activo && solicitudActual === solicitud) {
          setEnvioGratis({ status: "error", remainingOrders: null });
        }
      }
    };
    const refrescarDisponibilidad = function () {
      if (document.visibilityState === "visible") cargarDisponibilidad();
    };

    cargarDisponibilidad();
    window.addEventListener("focus", refrescarDisponibilidad);
    document.addEventListener("visibilitychange", refrescarDisponibilidad);
    return function () {
      activo = false;
      solicitud += 1;
      window.removeEventListener("focus", refrescarDisponibilidad);
      document.removeEventListener("visibilitychange", refrescarDisponibilidad);
    };
  }, [props.clienteId]);

  const subtotal = props.carrito.reduce(function (a, i) {
    return a + i.precio * i.cantidad;
  }, 0);
  const negociosCount = new Set(
    props.carrito.map(function (i) {
      return i.negocio_id;
    }),
  ).size;
  const cargoEnvio = getShippingCharge(
    costoEnvio,
    Math.max(0, negociosCount - 1) * 15,
    envioGratis.status === "available" && aplicarEnvioGratis,
  );
  const totalEnvio = cargoEnvio.total;
  const total = subtotal + totalEnvio;

  // Cargar direcciones guardadas
  useEffect(function () {
    supabase
      .from("direcciones_cliente")
      .select("*")
      .eq("cliente_id", props.clienteId)
      .order("es_principal", { ascending: false })
      .then(function (r) {
        if (r.data && r.data.length > 0) {
          setDirecciones(r.data as Direccion[]);
          setDirSel(
            r.data.find(function (d: Direccion) {
              return d.id === draft?.dirSeleccionadaId;
            }) ??
              r.data.find(function (d: Direccion) {
              return d.es_principal;
            }) ?? r.data[0],
          );
        } else {
          setFormaNueva(true);
        }
      });
  }, []);

  // Cargar fraccionamientos
  useEffect(function () {
    supabase
      .from("fraccionamientos")
      .select("id,nombre,costo_envio")
      .order("nombre", { ascending: true })
      .then(function (r) {
        if (r.data) {
          setFraccionamientos(r.data as Fraccionamiento[]);
          const restored = (r.data as Fraccionamiento[]).find(function (item) {
            return item.id === draft?.fraccionamientoId;
          });
          if (restored) setFraccionamientoSel(restored);
        }
      });
  }, []);

  useEffect(
    function () {
      writeFormDraft<CheckoutDraft>(props.clienteId, CHECKOUT_DRAFT_ID, {
        cartSignature: checkoutCartSignature(props.carrito),
        paso,
        dirSeleccionadaId: dirSeleccionada?.id ?? draft?.dirSeleccionadaId ?? null,
        formaNueva,
        alias,
        calle,
        numero,
        referencias,
        preferencias,
        formaPago,
        fraccionamientoId:
          fraccionamientoSel?.id ?? draft?.fraccionamientoId ?? null,
        fracSearch,
      });
    },
    [
      props.clienteId,
      props.carrito,
      paso,
      dirSeleccionada,
      formaNueva,
      alias,
      calle,
      numero,
      referencias,
      preferencias,
      formaPago,
      fraccionamientoSel,
      fracSearch,
    ],
  );

  async function guardarDireccionNueva(): Promise<Direccion | null> {
    if (!calle || !numero) {
      setError("Ingresa calle y número.");
      return null;
    }
    const { data, error: err } = await supabase
      .from("direcciones_cliente")
      .insert({
        cliente_id: props.clienteId,
        alias,
        calle,
        numero_casa: numero,
        referencias,
        referencias_entrega: preferencias,
        es_principal: direcciones.length === 0,
      })
      .select()
      .single();
    if (err) {
      setError(err.message);
      return null;
    }
    return data as Direccion;
  }

  async function confirmarPedido() {
    const usarEnvioGratis =
      envioGratis.status === "available" && aplicarEnvioGratis;
    setEnviando(true);
    setError("");
    try {
      let dir = dirSeleccionada;
      if (formaNueva) {
        dir = await guardarDireccionNueva();
        if (!dir) {
          setEnviando(false);
          return;
        }
      }

      // Agrupar por negocio (para mensaje WhatsApp)
      const porNegocio: Record<string, CartItem[]> = {};
      props.carrito.forEach(function(item) {
        if (!porNegocio[item.negocio_id]) porNegocio[item.negocio_id] = [];
        porNegocio[item.negocio_id].push(item);
      });

      // Un solo pedido para todo el carrito
      const negocioNombres = Array.from(new Set(props.carrito.map(function(i) { return i.negocio; }))).join(', ');
      const primerNegocioId = props.carrito[0]?.negocio_id ?? '';
      const idsNegocios = Object.keys(porNegocio);
      if (idsNegocios.length > 1) {
        // Un pedido por negocio: cada comercio y repartidor ve solo lo suyo.
        // El envío completo se asigna al primer pedido; la suma iguala al total.
        const ordenes = idsNegocios.map(function (id, indice) {
          const items = porNegocio[id];
          const sub = items.reduce(function (a, i) {
            return a + i.precio * i.cantidad;
          }, 0);
          return {
            negocio_id: id,
            negocio_nombre: items[0].negocio,
            total_pagar: Math.round((sub + (indice === 0 ? totalEnvio : 0)) * 100) / 100,
          };
        });
        const direccionTexto = dir ? dir.calle + " " + dir.numero_casa : "";
        const { data: multi, error: errorMulti } = await supabase.rpc(
          "crear_pedidos_multinegocio",
          {
            p_pedidos: ordenes,
            p_cliente_email: props.clienteEmail,
            p_forma_pago: formaPago,
            p_direccion: direccionTexto,
            p_usar_envio_gratis: usarEnvioGratis,
          },
        );
        if (errorMulti) {
          const funcionAusente =
            errorMulti.code === "PGRST202" || errorMulti.code === "42883";
          if (funcionAusente && !usarEnvioGratis) {
            const { error: errFilas } = await supabase.from("pedidos").insert(
              ordenes.map(function (o) {
                return {
                  cliente_id: props.clienteId,
                  negocio_id: o.negocio_id,
                  negocio_nombre: o.negocio_nombre,
                  total_pagar: o.total_pagar,
                  estatus: "pendiente",
                  canal: "webapp",
                  cliente_email: props.clienteEmail,
                  forma_pago: formaPago,
                  direccion: direccionTexto,
                };
              }),
            );
            if (errFilas) throw new Error("Error al guardar pedido: " + errFilas.message);
          } else {
            console.error("[Changuito] Error creando pedidos por negocio:", errorMulti);
            throw new Error(
              "No pudimos crear tus pedidos y no se guardó ninguno. Intenta de nuevo.",
            );
          }
        } else if (!multi?.ok) {
          throw new Error(
            multi?.error ?? "No se pudieron crear los pedidos. No se guardó ninguno.",
          );
        }
      } else if (usarEnvioGratis) {
        const { data, error: errorPedido } = await supabase.rpc(
          "crear_pedido_con_envio_gratis",
          {
            p_negocio_id: primerNegocioId,
            p_negocio_nombre: negocioNombres,
            p_total_pagar: total,
            p_cliente_email: props.clienteEmail,
            p_forma_pago: formaPago,
            p_direccion: dir ? dir.calle + " " + dir.numero_casa : "",
          },
        );
        if (errorPedido) {
          console.error("[Changuito] Error aplicando el envío gratis:", errorPedido);
          throw new Error(
            "No pudimos aplicar tu envío gratis y no se creó el pedido. Intenta de nuevo o desactiva la recompensa para pagar el envío normal.",
          );
        }
        if (!data?.ok) {
          throw new Error(
            data?.error ??
              "Tu envío gratis ya no está disponible. No se creó el pedido; vuelve a revisar el total.",
          );
        }
      } else {
        const { error: errPedido } = await supabase.from("pedidos").insert({
          cliente_id: props.clienteId,
          negocio_id: primerNegocioId,
          negocio_nombre: negocioNombres,
          total_pagar: total,
          estatus: "pendiente",
          canal: "webapp",
          cliente_email: props.clienteEmail,
          forma_pago: formaPago,
          direccion: dir ? dir.calle + " " + dir.numero_casa : "",
        });
        if (errPedido) {
          console.error("[Changuito] Error guardando pedido en Supabase:", errPedido);
          throw new Error("Error al guardar pedido: " + errPedido.message);
        }
      }

      // Actualizar monedero: +1 pedido
      if (!usarEnvioGratis) {
        try {
          const { data: mon } = await supabase
            .from("monedero_cliente")
            .select("id, pedidos_realizados")
            .eq("user_id", props.clienteId)
            .single();
          if (mon) {
            await supabase
              .from("monedero_cliente")
              .update({
                pedidos_realizados: (mon.pedidos_realizados ?? 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", mon.id);
          } else {
            await supabase
              .from("monedero_cliente")
              .insert([{ user_id: props.clienteId, pedidos_realizados: 1 }]);
          }
        } catch (_) {
          /* silencioso */
        }
      }

      // Mensaje WhatsApp estructurado
      const linea = "━━━━━━━━━━━━━━━━━━━━━━";
      let msg = "*🛵 CHANGUITO EXPRESS APP*\n" + linea + "\n";
      msg +=
        "👤 *Cliente:* " + (props.clienteNombre || props.clienteEmail) + "\n";
      msg +=
        "📍 *Dirección:* " +
        (dir
          ? dir.calle +
            " " +
            dir.numero_casa +
            (dir.referencias ? ", " + dir.referencias : "")
          : "") +
        "\n";
      if (dir?.preferencias_entrega)
        msg += "🔔 *Instrucciones:* " + dir.preferencias_entrega + "\n";
      msg +=
        "💳 *Pago:* " +
        FORMAS_PAGO.find(function (f) {
          return f.id === formaPago;
        })?.label +
        "\n";
      msg += linea + "\n\n";

      Object.entries(porNegocio).forEach(function ([_, items]) {
        msg += "🍽️ *" + items[0].negocio.toUpperCase() + "*\n";
        items.forEach(function (item) {
          if (item.tipo === "mandadito") {
            msg += "   📝 " + item.nombre + "\n";
          } else {
            msg +=
              "   • " +
              item.nombre +
              " x" +
              item.cantidad +
              " = $" +
              (item.precio * item.cantidad).toFixed(2) +
              "\n";
          }
        });
        msg += linea + "\n";
      });

      msg += "\n🚚 *Envío:* $" + totalEnvio.toFixed(2);
      if (cargoEnvio.discount > 0) {
        msg += "\n🎁 *Envío gratis aplicado:* -$" + cargoEnvio.discount.toFixed(2);
      }
      if (fraccionamientoSel) msg += " (" + fraccionamientoSel.nombre + ")";
      if (negociosCount > 1)
        msg +=
          " [+$" + ((negociosCount - 1) * 15).toFixed(0) + " multi-negocio]";
      msg += "\n";
      msg += "*💰 TOTAL A PAGAR: $" + total.toFixed(2) + "*\n" + linea;

      window.open(
        "https://wa.me/" + PHONE_OPERATIVO + "?text=" + encodeURIComponent(msg),
        "_blank",
      );
      clearFormDraft(props.clienteId, CHECKOUT_DRAFT_ID);
      props.onPedidoOk();
    } catch (err: any) {
      setError(err.message ?? "Error al procesar el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  const bgCard = "var(--bg-card)";
  const bgBase = "var(--bg-base)";
  const textPrim = "var(--text-primary)";
  const textMuted = "var(--text-muted)";
  const border = "var(--border-subtle)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 500,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          margin: "0 auto",
          background: bgCard,
          borderRadius: "28px 28px 0 0",
          padding: "24px 20px 40px",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
        }}
        onClick={function (e) {
          e.stopPropagation();
        }}
      >
        {/* X cerrar */}
        <button
          onClick={props.onClose}
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <X
            style={{
              width: "16px",
              height: "16px",
              color: "var(--text-primary)",
            }}
          />
        </button>
        {/* Handle + título */}
        <div
          style={{
            width: "40px",
            height: "4px",
            borderRadius: "2px",
            background: "var(--border-medium)",
            margin: "0 auto 20px",
          }}
        />

        {/* Pasos */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
          {(["carrito", "direccion", "pago", "resumen"] as const).map(
            function (p, i) {
              const activo = paso === p;
              const pasoIdx = [
                "carrito",
                "direccion",
                "pago",
                "resumen",
              ].indexOf(paso);
              const done = i < pasoIdx;
              const labels = [
                "🛒 Carrito",
                "📍 Dirección",
                "💳 Pago",
                "✅ Confirmar",
              ];
              return (
                <div
                  key={p}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    padding: "7px 2px",
                    borderRadius: "12px",
                    background: activo
                      ? "var(--color-yellow-dim)"
                      : done
                        ? "rgba(34,197,94,0.1)"
                        : "var(--bg-base)",
                    border: `1px solid ${activo ? "var(--color-yellow)" : done ? "var(--color-green)" : border}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      color: activo
                        ? "var(--color-yellow)"
                        : done
                          ? "var(--color-green)"
                          : textMuted,
                      margin: 0,
                    }}
                  >
                    {labels[i]}
                  </p>
                </div>
              );
            },
          )}
        </div>

        {/* ── PASO 0: CARRITO ── */}
        {paso === "carrito" && (
          <div>
            <h3
              style={{
                fontSize: "17px",
                fontWeight: 900,
                color: textPrim,
                margin: "0 0 14px 0",
              }}
            >
              Tu carrito
            </h3>

            {props.carrito.length === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: textMuted,
                  textAlign: "center",
                  padding: "30px 0",
                }}
              >
                Tu carrito está vacío
              </p>
            ) : (
              <div style={{ marginBottom: "14px" }}>
                {props.carrito.map(function (item) {
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 0",
                        borderBottom: `1px solid ${border}`,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: textPrim,
                            margin: "0 0 2px 0",
                          }}
                        >
                          {item.emoji ?? "🍽️"} {item.nombre}
                        </p>
                        <p
                          style={{
                            fontSize: "11px",
                            color: textMuted,
                            margin: 0,
                          }}
                        >
                          {item.negocio}
                        </p>
                      </div>
                      {item.tipo === "producto" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <button
                            onClick={function () {
                              props.onUpdateCantidad(item.id, -1);
                            }}
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "8px",
                              border: `1px solid ${border}`,
                              background: bgBase,
                              color: textPrim,
                              fontSize: "16px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: textPrim,
                              minWidth: "16px",
                              textAlign: "center",
                            }}
                          >
                            {item.cantidad}
                          </span>
                          <button
                            onClick={function () {
                              props.onUpdateCantidad(item.id, 1);
                            }}
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "8px",
                              border: `1px solid ${border}`,
                              background: bgBase,
                              color: textPrim,
                              fontSize: "16px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            +
                          </button>
                        </div>
                      )}
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: "var(--color-yellow)",
                          minWidth: "50px",
                          textAlign: "right",
                        }}
                      >
                        $
                        {item.tipo === "producto"
                          ? (item.precio * item.cantidad).toFixed(2)
                          : "—"}
                      </span>
                      <button
                        onClick={function () {
                          props.onRemoveItem(item.id);
                        }}
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "8px",
                          border: "none",
                          background: "rgba(239,68,68,0.1)",
                          color: "#ef4444",
                          fontSize: "14px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {props.carrito.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  marginBottom: "14px",
                  borderTop: `1px solid ${border}`,
                }}
              >
                <span
                  style={{ fontSize: "14px", fontWeight: 700, color: textPrim }}
                >
                  Subtotal
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 900,
                    color: "var(--color-yellow)",
                  }}
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>
            )}

            {props.carrito.some(function (i) {
              return i.tipo === "mandadito";
            }) && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "rgba(212,175,55,0.08)",
                  border: "1px solid rgba(212,175,55,0.25)",
                  marginBottom: "12px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    lineHeight: "1.5",
                    color: "var(--text-muted)",
                  }}
                >
                  ⚠️ <strong style={{ color: "var(--color-yellow)" }}>Nota sobre Mandaditos:</strong> El total a pagar puede variar dependiendo del ticket final de compra en solicitudes de Mandaditos (pedidos escritos), ya que los precios exactos se verificarán al momento de la compra.
                </p>
              </div>
            )}
            <button
              onClick={function () {
                setPaso("direccion");
              }}
              disabled={props.carrito.length === 0}
              style={{
                width: "100%",
                background:
                  props.carrito.length === 0
                    ? "rgba(245,158,11,0.3)"
                    : "var(--color-yellow)",
                color: "#020617",
                fontWeight: 900,
                fontSize: "14px",
                padding: "15px",
                borderRadius: "16px",
                border: "none",
                cursor: props.carrito.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Continuar al pago →
            </button>
          </div>
        )}

        {/* ── PASO 1: DIRECCIÓN ── */}
        {paso === "direccion" && (
          <div>
            <h3
              style={{
                fontSize: "17px",
                fontWeight: 900,
                color: textPrim,
                margin: "0 0 14px 0",
              }}
            >
              ¿Dónde entregamos?
            </h3>

            {/* Direcciones guardadas */}
            {!formaNueva &&
              direcciones.map(function (d) {
                const sel = dirSeleccionada?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={function () {
                      setDirSel(d);
                    }}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "16px",
                      marginBottom: "10px",
                      cursor: "pointer",
                      border: `2px solid ${sel ? "var(--color-yellow)" : border}`,
                      background: sel ? "var(--color-yellow-dim)" : bgBase,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: textPrim,
                          margin: 0,
                        }}
                      >
                        <MapPin
                          style={{
                            width: "13px",
                            height: "13px",
                            display: "inline",
                            marginRight: "5px",
                            verticalAlign: "middle",
                          }}
                        />
                        {d.alias}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {sel && (
                          <Check
                            style={{
                              width: "16px",
                              height: "16px",
                              color: "var(--color-yellow)",
                            }}
                          />
                        )}
                        <button
                          onClick={async function (e) {
                            e.stopPropagation();
                            await supabase
                              .from("direcciones_cliente")
                              .delete()
                              .eq("id", d.id);
                            setDirecciones(function (prev) {
                              const upd = prev.filter(function (x) {
                                return x.id !== d.id;
                              });
                              if (upd.length === 0) setFormaNueva(true);
                              if (dirSeleccionada?.id === d.id)
                                setDirSel(upd[0] ?? null);
                              return upd;
                            });
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--color-red)",
                            padding: "2px",
                            lineHeight: 0,
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 style={{ width: "14px", height: "14px" }} />
                        </button>
                      </div>
                    </div>
                    <p
                      style={{ fontSize: "12px", color: textMuted, margin: 0 }}
                    >
                      {d.calle} {d.numero_casa}
                    </p>
                    {d.referencias && (
                      <p
                        style={{
                          fontSize: "11px",
                          color: textMuted,
                          margin: "2px 0 0 0",
                        }}
                      >
                        {d.referencias}
                      </p>
                    )}
                  </div>
                );
              })}

            {/* Botón agregar nueva */}
            {!formaNueva && (
              <button
                onClick={function () {
                  setFormaNueva(true);
                  setDirSel(null);
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "14px",
                  border: `1px dashed ${border}`,
                  background: "transparent",
                  color: textMuted,
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                <PlusIcon style={{ width: "14px", height: "14px" }} />
                Agregar nueva dirección
              </button>
            )}

            {/* Formulario nueva dirección */}
            {formaNueva && (
              <div
                style={{
                  background: bgBase,
                  borderRadius: "16px",
                  padding: "16px",
                  border: `1px solid ${border}`,
                  marginBottom: "16px",
                }}
              >
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: textPrim,
                    margin: "0 0 12px 0",
                  }}
                >
                  Nueva dirección
                </p>
                {/* Alias field */}
                <div style={{ marginBottom: "10px" }}>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: textMuted,
                      margin: "0 0 4px 0",
                    }}
                  >
                    Alias / Nombre (Casa, Trabajo...)
                  </p>
                  <input
                    value={alias}
                    onChange={function (e) {
                      setAlias(e.target.value);
                    }}
                    placeholder="Casa, Trabajo"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "11px 14px",
                      borderRadius: "12px",
                      border: `1px solid ${border}`,
                      background: "var(--bg-card)",
                      color: textPrim,
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
                {/* Fraccionamiento selector */}
                <div style={{ marginBottom: "10px" }}>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: textMuted,
                      margin: "0 0 4px 0",
                    }}
                  >
                    🏘️ Fraccionamiento / Clúster / Plaza
                  </p>
                  {fraccionamientoSel ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        border: "2px solid var(--color-yellow)",
                        background: "var(--color-yellow-dim)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: textPrim,
                        }}
                      >
                        {fraccionamientoSel.nombre}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "var(--color-yellow)",
                          }}
                        >
                          ${fraccionamientoSel.costo_envio}
                        </span>
                        <button
                          onClick={function () {
                            setFraccionamientoSel(null);
                            setCostoEnvio(50);
                            setFracSearch("");
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            padding: 0,
                            lineHeight: 0,
                          }}
                        >
                          <X style={{ width: "14px", height: "14px" }} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        value={fracSearch}
                        onChange={function (e) {
                          setFracSearch(e.target.value);
                        }}
                        placeholder="Buscar fraccionamiento..."
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "11px 14px",
                          borderRadius: "12px",
                          border: `1px solid ${border}`,
                          background: "var(--bg-card)",
                          color: textPrim,
                          fontSize: "13px",
                          outline: "none",
                          marginBottom: "4px",
                        }}
                      />
                      {fracSearch.trim() !== "" && (
                        <div
                          style={{
                            maxHeight: "140px",
                            overflowY: "auto",
                            borderRadius: "12px",
                            border: `1px solid ${border}`,
                            background: "var(--bg-card)",
                          }}
                        >
                          {fraccionamientos
                            .filter(function (f) {
                              return f.nombre
                                .toLowerCase()
                                .includes(fracSearch.toLowerCase());
                            })
                            .map(function (f) {
                              return (
                                <div
                                  key={f.id}
                                  onClick={function () {
                                    setFraccionamientoSel(f);
                                    setCostoEnvio(f.costo_envio);
                                    setFracSearch("");
                                  }}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px 14px",
                                    cursor: "pointer",
                                    borderBottom: `1px solid ${border}`,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 700,
                                      color: textPrim,
                                    }}
                                  >
                                    {f.nombre}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 800,
                                      color: "var(--color-yellow)",
                                    }}
                                  >
                                    ${f.costo_envio}
                                  </span>
                                </div>
                              );
                            })}
                          {fraccionamientos.filter(function (f) {
                            return f.nombre
                              .toLowerCase()
                              .includes(fracSearch.toLowerCase());
                          }).length === 0 && (
                            <p
                              style={{
                                fontSize: "12px",
                                color: "var(--text-muted)",
                                padding: "10px 14px",
                                margin: 0,
                              }}
                            >
                              Sin resultados
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Remaining address fields */}
                {[
                  {
                    label: "Calle / Torre *",
                    val: calle,
                    set: setCalle,
                    ph: "Av. Principal",
                  },
                  {
                    label: "Número / Depto *",
                    val: numero,
                    set: setNumero,
                    ph: "#123, Depto #123",
                  },
                  {
                    label: "Referencias",
                    val: referencias,
                    set: setReferencias,
                    ph: "Opcional",
                  },
                  {
                    label: "Instrucciones de entrega",
                    val: preferencias,
                    set: setPreferencias,
                    ph: "Opcional",
                  },
                ].map(function (f) {
                  return (
                    <div key={f.label} style={{ marginBottom: "10px" }}>
                      <p
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: textMuted,
                          margin: "0 0 4px 0",
                        }}
                      >
                        {f.label}
                      </p>
                      <input
                        value={f.val}
                        onChange={function (e) {
                          f.set(e.target.value);
                        }}
                        placeholder={f.ph}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "11px 14px",
                          borderRadius: "12px",
                          border: `1px solid ${border}`,
                          background: "var(--bg-card)",
                          color: textPrim,
                          fontSize: "13px",
                          outline: "none",
                        }}
                      />
                    </div>
                  );
                })}
                {direcciones.length > 0 && (
                  <button
                    onClick={function () {
                      setFormaNueva(false);
                      setDirSel(direcciones[0]);
                    }}
                    style={{
                      fontSize: "12px",
                      color: textMuted,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      marginTop: "4px",
                    }}
                  >
                    ← Usar dirección guardada
                  </button>
                )}
              </div>
            )}

            {error && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-red)",
                  marginBottom: "10px",
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={function () {
                  setPaso("carrito");
                }}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "14px",
                  border: `1px solid ${border}`,
                  background: "transparent",
                  color: textMuted,
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                ← Carrito
              </button>
              <button
                onClick={function () {
                  setError("");
                  setPaso("pago");
                }}
                disabled={!formaNueva && !dirSeleccionada}
                style={{
                  flex: 2,
                  background: "var(--color-yellow)",
                  color: "#020617",
                  fontWeight: 900,
                  fontSize: "14px",
                  padding: "15px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: FORMA DE PAGO ── */}
        {paso === "pago" && (
          <div>
            <h3
              style={{
                fontSize: "17px",
                fontWeight: 900,
                color: textPrim,
                margin: "0 0 14px 0",
              }}
            >
              ¿Cómo vas a pagar?
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              {FORMAS_PAGO.map(function (f) {
                const sel = formaPago === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={function () {
                      setFormaPago(f.id);
                    }}
                    style={{
                      padding: "16px 12px",
                      borderRadius: "16px",
                      border: `2px solid ${sel ? "var(--color-yellow)" : border}`,
                      background: sel ? "var(--color-yellow-dim)" : bgBase,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>{f.emoji}</span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: sel ? "var(--color-yellow)" : textPrim,
                      }}
                    >
                      {f.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={function () {
                  setPaso("direccion");
                }}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "14px",
                  border: `1px solid ${border}`,
                  background: "transparent",
                  color: textMuted,
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                ← Atrás
              </button>
              <button
                onClick={function () {
                  setPaso("resumen");
                }}
                style={{
                  flex: 2,
                  background: "var(--color-yellow)",
                  color: "#020617",
                  fontWeight: 900,
                  fontSize: "14px",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Ver resumen →
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 3: RESUMEN ── */}
        {paso === "resumen" && (
          <div>
            <h3
              style={{
                fontSize: "17px",
                fontWeight: 900,
                color: textPrim,
                margin: "0 0 14px 0",
              }}
            >
              Resumen del pedido
            </h3>

            {/* Dirección */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: bgBase,
                border: `1px solid ${border}`,
                marginBottom: "10px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  color: textMuted,
                  margin: "0 0 3px 0",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                📍 Entrega
              </p>
              {dirSeleccionada ? (
                <p style={{ fontSize: "13px", color: textPrim, margin: 0 }}>
                  {dirSeleccionada.calle} {dirSeleccionada.numero_casa}
                </p>
              ) : (
                <p style={{ fontSize: "13px", color: textPrim, margin: 0 }}>
                  {calle} {numero}
                </p>
              )}
            </div>

            {/* Pago */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: bgBase,
                border: `1px solid ${border}`,
                marginBottom: "14px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  color: textMuted,
                  margin: "0 0 3px 0",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                💳 Pago
              </p>
              <p style={{ fontSize: "13px", color: textPrim, margin: 0 }}>
                {
                  FORMAS_PAGO.find(function (f) {
                    return f.id === formaPago;
                  })?.emoji
                }{" "}
                {
                  FORMAS_PAGO.find(function (f) {
                    return f.id === formaPago;
                  })?.label
                }
              </p>
            </div>

            {/* Items */}
            <div style={{ marginBottom: "14px" }}>
              {props.carrito.map(function (item) {
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: `1px solid ${border}`,
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: textPrim,
                          margin: 0,
                        }}
                      >
                        {item.emoji ?? "🍽️"} {item.nombre}
                      </p>
                      <p
                        style={{
                          fontSize: "11px",
                          color: textMuted,
                          margin: 0,
                        }}
                      >
                        {item.negocio}{" "}
                        {item.tipo === "producto" ? "· x" + item.cantidad : ""}
                      </p>
                    </div>
                    {item.tipo === "producto" && (
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 800,
                          color: "var(--color-yellow)",
                        }}
                      >
                        ${(item.precio * item.cantidad).toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {envioGratis.status === "available" && (
              <div
                role="status"
                style={{
                  padding: "11px 13px",
                  borderRadius: "12px",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  color: textPrim,
                  fontSize: "12px",
                  lineHeight: 1.45,
                  marginBottom: "10px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "9px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={aplicarEnvioGratis}
                    onChange={function (event) {
                      setAplicarEnvioGratis(event.target.checked);
                    }}
                    style={{ marginTop: "2px" }}
                  />
                  <span>
                    <strong style={{ color: "var(--color-green)" }}>
                      🎁 Tu envío gratis está disponible.
                    </strong>{" "}
                    {aplicarEnvioGratis
                      ? "Se descuentan $" +
                        cargoEnvio.discount.toFixed(2) +
                        " de la tarifa de entrega."
                      : "Activa esta opción para descontar $" +
                        costoEnvio.toFixed(2) +
                        " de la tarifa de entrega."}
                    {cargoEnvio.multiBusinessCharge > 0 && aplicarEnvioGratis
                      ? " El recargo por varios negocios se mantiene."
                      : ""}
                  </span>
                </label>
              </div>
            )}
            {envioGratis.status === "unavailable" && (
              <p
                role="status"
                style={{
                  fontSize: "11px",
                  color: textMuted,
                  margin: "0 0 10px 0",
                }}
              >
                Envío gratis no disponible.{" "}
                {envioGratis.remainingOrders === 1
                  ? "Te falta 1 pedido entregado para ganarlo."
                  : "Te faltan " +
                    envioGratis.remainingOrders +
                    " pedidos entregados para ganarlo."}
              </p>
            )}
            {envioGratis.status === "loading" && (
              <p
                role="status"
                style={{
                  fontSize: "11px",
                  color: textMuted,
                  margin: "0 0 10px 0",
                }}
              >
                Verificando si tienes envío gratis disponible…
              </p>
            )}
            {envioGratis.status === "error" && (
              <p
                role="status"
                style={{
                  fontSize: "11px",
                  color: textMuted,
                  margin: "0 0 10px 0",
                }}
              >
                No pudimos verificar tu recompensa; se muestra el envío normal.
              </p>
            )}

            {/* Total */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                background: bgBase,
                border: `1px solid ${border}`,
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "13px", color: textMuted }}>
                  Subtotal
                </span>
                <span
                  style={{ fontSize: "13px", fontWeight: 700, color: textPrim }}
                >
                  ${subtotal.toFixed(2)}
                </span>
              </div>
              {cargoEnvio.discount > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "var(--color-green)" }}>
                    🎁 Envío gratis aplicado
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--color-green)",
                    }}
                  >
                    −${cargoEnvio.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span style={{ fontSize: "13px", color: textMuted }}>
                  Envío
                </span>
                <span
                  style={{ fontSize: "13px", fontWeight: 700, color: textPrim }}
                >
                  ${totalEnvio.toFixed(2)}
                  {fraccionamientoSel && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {" "}
                      ({fraccionamientoSel.nombre})
                    </span>
                  )}
                  {negociosCount > 1 && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--color-yellow)",
                        fontWeight: 700,
                      }}
                    >
                      {" "}
                      +${((negociosCount - 1) * 15).toFixed(0)} multi
                    </span>
                  )}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: "8px",
                  borderTop: `1px solid ${border}`,
                }}
              >
                <span
                  style={{ fontSize: "15px", fontWeight: 800, color: textPrim }}
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
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            {error && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--color-red)",
                  marginBottom: "10px",
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={function () {
                  setPaso("pago");
                }}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "14px",
                  border: `1px solid ${border}`,
                  background: "transparent",
                  color: textMuted,
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                ← Atrás
              </button>
              <button
                onClick={confirmarPedido}
                disabled={enviando}
                style={{
                  flex: 2,
                  background: enviando ? "rgba(37,211,102,0.5)" : "#25D366",
                  color: "white",
                  fontWeight: 900,
                  fontSize: "13px",
                  padding: "14px",
                  borderRadius: "14px",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: enviando ? "not-allowed" : "pointer",
                }}
              >
                {enviando ? (
                  <span className="spinner" />
                ) : (
                  <MessageCircle style={{ width: "16px", height: "16px" }} />
                )}
                {enviando ? "Procesando..." : "Confirmar por WhatsApp"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────
type MainTab = "restaurantes" | "mandaditos" | "tiendita";

export default function Dashboard(props: DashboardProps) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [tabActiva, setTabActiva] = useState<MainTab>("restaurantes");
  const [search, setSearch] = useState<string>("");
  const [productosBusqueda, setProductosBusqueda] = useState<any[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(
    null,
  );
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(null);
  const [restSectionTarget, setRestSectionTarget] = useState("");
  const [modalMandadito, setModalMandadito] = useState<Merchant | null>(null);
  const [modalCheckout, setModalCheckout] = useState<boolean>(function () {
    return Boolean(getCheckoutDraft(props.session.user.id, props.carritoGlobal));
  });
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const [esMerchantAdmin, setEsMerchantAdmin] = useState(false);
  const [modalLimite, setModalLimite] = useState(false);
  const [changuiAbierto, setChanguiAbierto] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  const [deviceSessionsOpen, setDeviceSessionsOpen] = useState(false);
  const [deviceSessions, setDeviceSessions] = useState<DeviceAuthSession[]>([]);
  const [loadingDeviceSessions, setLoadingDeviceSessions] = useState(false);
  const [deviceSessionsError, setDeviceSessionsError] = useState("");
  const [revokingDeviceSession, setRevokingDeviceSession] = useState("");
  const [deviceSessionsNotice, setDeviceSessionsNotice] = useState("");
  const esAdmin =
    props.session.user.email === "uliseseven.7@gmail.com" ||
    props.session.user.rol === "admin";
  const rol = props.session.user.rol ?? "cliente";
  const puedeNegocio = esAdmin || rol === "negocio" || esMerchantAdmin;
  const puedeRepartidor = esAdmin || rol === "repartidor";

  useEffect(function () {
    if (!menuAbierto) return;

    const menuPanel = menuPanelRef.current;
    const closeButton = menuPanel?.querySelector<HTMLButtonElement>("button");
    closeButton?.focus();

    function handleMenuKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuAbierto(false);
        menuTriggerRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !menuPanel) return;
      const focusableElements = Array.from(
        menuPanel.querySelectorAll<HTMLButtonElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleMenuKeyDown);
    return function () {
      document.removeEventListener("keydown", handleMenuKeyDown);
    };
  }, [menuAbierto]);

  useEffect(function () {
    async function checkMerchantAdmin() {
      try {
        const { data } = await supabase
          .from("merchant_admins")
          .select("merchant_id")
          .eq("user_id", props.session.user.id)
          .maybeSingle();
        if (data) setEsMerchantAdmin(true);
      } catch {
        /* ignore */
      }
    }
    checkMerchantAdmin();
  }, []);

  async function cerrarSesion() {
    setSignOutError("");
    try {
      await signOut(supabase);
      clearUserFormDrafts(props.session.user.id);
    } catch {
      setSignOutError(
        "No pudimos cerrar sesión. Tu sesión sigue activa. Intentá de nuevo.",
      );
    }
  }

  async function cerrarSesionEnTodosLosDispositivos() {
    const confirmed = window.confirm(
      "Se cerrará tu sesión en este dispositivo y se revocarán las sesiones de los demás. En otros dispositivos, el cierre puede tardar hasta que expire el token de acceso actual. ¿Querés continuar?",
    );
    if (!confirmed) return;

    setSignOutError("");
    setSigningOutEverywhere(true);
    try {
      await signOutEverywhere(supabase);
      clearUserFormDrafts(props.session.user.id);
      window.alert(
        "Se cerró tu sesión en este dispositivo y se revocaron las sesiones de los demás.",
      );
    } catch {
      setSignOutError(
        "No pudimos cerrar las sesiones de todos los dispositivos. Tu sesión sigue activa. Intentá de nuevo.",
      );
    } finally {
      setSigningOutEverywhere(false);
    }
  }

  async function cargarDispositivos() {
    setLoadingDeviceSessions(true);
    setDeviceSessionsError("");
    setDeviceSessionsNotice("");
    try {
      setDeviceSessions(await listDeviceAuthSessions(supabase));
    } catch {
      setDeviceSessionsError(
        "No pudimos cargar tus dispositivos. Revisá tu conexión y que las funciones de sesiones estén instaladas en Supabase.",
      );
    } finally {
      setLoadingDeviceSessions(false);
    }
  }

  async function revocarDispositivo(session: DeviceAuthSession) {
    if (session.is_current || revokingDeviceSession) return;
    const dispositivo = deviceDescription(session.user_agent);
    if (
      !window.confirm(
        `¿Querés cerrar la sesión de ${dispositivo}? Ya no podrá renovarse, aunque el acceso actual podría seguir funcionando hasta que venza. Después deberá iniciar sesión de nuevo.`,
      )
    ) {
      return;
    }

    setRevokingDeviceSession(session.session_id);
    setDeviceSessionsError("");
    setDeviceSessionsNotice("");
    try {
      const revoked = await revokeDeviceAuthSession(
        supabase,
        session.session_id,
      );
      if (revoked) {
        setDeviceSessionsNotice(
          "La sesión se revocó. El acceso actual de ese dispositivo podría continuar hasta que venza.",
        );
      } else {
        setDeviceSessionsNotice(
          "Esa sesión ya no estaba activa. Actualizamos la lista.",
        );
      }
      setDeviceSessions(await listDeviceAuthSessions(supabase));
    } catch {
      setDeviceSessionsError(
        "No pudimos cerrar esa sesión. Puede que ya no esté activa; actualizá la lista e intentá de nuevo.",
      );
    } finally {
      setRevokingDeviceSession("");
    }
  }

  function alternarDispositivos() {
    const abrir = !deviceSessionsOpen;
    setDeviceSessionsOpen(abrir);
    if (abrir) void cargarDispositivos();
  }

  // FIX PARPADEO: aplicar el tema ANTES del primer paint
  useLayoutEffect(
    function () {
      document.documentElement.setAttribute("data-theme", props.theme);
    },
    [props.theme],
  );

  const isDark = props.theme === "dark";
  const username =
    props.session.user.nombre ||
    props.session.user.email?.split("@")[0] ||
    "usuario";
  const totalItems = props.carritoGlobal.reduce(function (a, i) {
    return a + i.cantidad;
  }, 0);
  const totalPrecio =
    props.carritoGlobal.reduce(function (a, i) {
      return a + i.precio * i.cantidad;
    }, 0) + COSTO_ENVIO;

  const fetchMerchants = useCallback(async function () {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("merchants")
        .select(
          "id,name,category,rating,delivery_time,image_url,is_open,phone_number,commission,horario_apertura,horario_cierre",
        )
        .order("is_open", { ascending: false })
        .order("name", { ascending: true });
      if (err) throw err;
      setMerchants(data ?? []);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar negocios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(
    function () {
      fetchMerchants();
    },
    [fetchMerchants],
  );

  useEffect(
    function () {
      const term = search.trim();
      if (!term) {
        setProductosBusqueda([]);
        return;
      }
      const timer = setTimeout(async function () {
        try {
          const { data } = await supabase
            .from("products")
            .select(
              "id, name, price, merchant_id, merchants:merchant_id(id, name, phone_number)",
            )
            .ilike("name", "%" + term + "%")
            .eq("is_available", true)
            .limit(30);
          setProductosBusqueda(data ?? []);
        } catch (_) {
          setProductosBusqueda([]);
        }
      }, 350);
      return function () {
        clearTimeout(timer);
      };
    },
    [search],
  );

  if (selectedMerchant !== null) {
    return (
      <VistaNegocio
        merchant={selectedMerchant}
        theme={props.theme}
        onThemeToggle={props.onThemeToggle}
        clienteEmail={props.session.user.email}
        carritoGlobal={props.carritoGlobal}
        onUpdateCarritoGlobal={props.onUpdateCarritoGlobal}
        onVolver={function () {
          setSelectedMerchant(null);
        }}
      />
    );
  }

  function porCats(cats: string[], names?: string[]): Merchant[] {
    return merchants.filter(function (m) {
      const byCategory = cats.some(function (c) {
        return m.category?.toLowerCase().trim() === c.toLowerCase();
      });
      if (byCategory) return true;
      if (!names || names.length === 0) return false;
      const n = m.name?.toLowerCase().trim() ?? "";
      return names.some(function (nm) {
        return n.includes(nm.toLowerCase());
      });
    });
  }

  function porKeys(keys: string[]): Merchant[] {
    return merchants.filter(function (m) {
      if (m.category?.toLowerCase() !== "mandaditos") return false;
      const n = m.name.toLowerCase();
      return keys.some(function (k) {
        return n.includes(k.toLowerCase());
      });
    });
  }

  function agregarMandadito(merchant: Merchant, texto: string) {
    const negociosActuales = new Set(
      props.carritoGlobal.map(function (i) {
        return i.negocio_id;
      }),
    );
    if (!negociosActuales.has(merchant.id) && negociosActuales.size >= 4) {
      setModalLimite(true);
      return;
    }
    const item: CartItem = {
      id: merchant.id + "-" + Date.now(),
      nombre: texto,
      precio: 0,
      cantidad: 1,
      negocio: merchant.name,
      negocio_id: merchant.id,
      phone_number: merchant.phone_number ?? PHONE_OPERATIVO,
      tipo: "mandadito",
      emoji: "📝",
    };
    props.onUpdateCarritoGlobal([...props.carritoGlobal, item]);
  }

  function agregarProductoBusqueda(producto: any) {
    const mer = producto.merchants as any;
    const existente = props.carritoGlobal.find(function (i) {
      return i.id === producto.id;
    });
    if (existente) {
      props.onUpdateCarritoGlobal(
        props.carritoGlobal.map(function (i) {
          if (i.id !== producto.id) return i;
          return { ...i, cantidad: i.cantidad + 1 };
        }),
      );
    } else {
      const item: CartItem = {
        id: producto.id,
        nombre: producto.name,
        precio: producto.price ?? 0,
        cantidad: 1,
        negocio: mer?.name ?? "",
        negocio_id: mer?.id ?? producto.merchant_id ?? "",
        phone_number: mer?.phone_number ?? PHONE_OPERATIVO,
        tipo: "producto",
      };
      props.onUpdateCarritoGlobal([...props.carritoGlobal, item]);
    }
  }

  function irASeccion(tab: MainTab, seccion?: string) {
    setTabActiva(tab);
    setSearch("");
    if (seccion) {
      setSeccionAbierta(seccion);
      setTimeout(function () {
        const el = document.getElementById(tituloAId(seccion));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
    }
  }

  function tabStyle(t: MainTab): React.CSSProperties {
    const active = tabActiva === t;
    const accent = t === "restaurantes" ? "var(--color-red)" : t === "mandaditos" ? "var(--color-blue)" : "var(--color-green)";
    return {
      flex: 1,
      padding: "10px 4px",
      border: "none",
      borderRadius: "14px",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: active ? 900 : 600,
      background: active ? accent : "transparent",
      color: active ? "#ffffff" : "var(--text-secondary)",
      boxShadow: active ? "0 4px 12px rgba(15,50,40,0.18)" : "none",
      transition: "all 0.2s",
    };
  }

  function renderContenido() {
    if (search.trim() !== "" && tabActiva !== "tiendita") {
      const q = search.toLowerCase();
      const resNegocios = merchants.filter(function (m) {
        return (
          m.name.toLowerCase().includes(q) ||
          (m.category ?? "").toLowerCase().includes(q)
        );
      });
      const totalRes = resNegocios.length + productosBusqueda.length;
      return (
        <div style={{ padding: "0 16px 40px" }}>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              margin: "0 0 14px 0",
            }}
          >
            {totalRes} resultados para "{search}"
          </p>

          {/* Productos encontrados */}
          {productosBusqueda.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: "0 0 10px 0",
                }}
              >
                🛍️ Productos
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {productosBusqueda.map(function (p) {
                  const yaEnCarrito = props.carritoGlobal.find(function (i) {
                    return i.id === p.id;
                  });
                  const mer = p.merchants as any;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 14px",
                        borderRadius: "14px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            margin: "0 0 2px 0",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </p>
                        <p
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            margin: 0,
                          }}
                        >
                          {mer?.name ?? ""}
                        </p>
                      </div>
                      <p
                        style={{
                          fontSize: "15px",
                          fontWeight: 900,
                          color: "var(--color-yellow)",
                          margin: "0 8px 0 0",
                          flexShrink: 0,
                        }}
                      >
                        ${(p.price ?? 0).toFixed(0)}
                      </p>
                      <button
                        onClick={function () {
                          agregarProductoBusqueda(p);
                        }}
                        style={{
                          padding: "7px 14px",
                          borderRadius: "10px",
                          border: "none",
                          background: yaEnCarrito
                            ? "var(--color-green)"
                            : "var(--color-yellow)",
                          color: "#020617",
                          fontSize: "12px",
                          fontWeight: 900,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {yaEnCarrito
                          ? "✓ " + yaEnCarrito.cantidad
                          : "+ Agregar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Negocios encontrados */}
          {resNegocios.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: "0 0 10px 0",
                }}
              >
                🏪 Negocios
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                {resNegocios.map(function (m) {
                  return (
                    <TarjetaNegocio
                      key={m.id}
                      merchant={m}
                      onClick={function () {
                        m.category?.toLowerCase() === "mandaditos"
                          ? setModalMandadito(m)
                          : setSelectedMerchant(m);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {totalRes === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Sin resultados para "{search}"
              </p>
            </div>
          )}
        </div>
      );
    }

    // Botones de categoría: fichas circulares con acento de la paleta de marca
    // (verde, amarillo, rojo y azul) para que se sientan familiares y distintos.
    const ACENTOS_MARCA = ["#159447", "#F6C945", "#E84844", "#2979DA"];
    const estiloBotonCat: React.CSSProperties = {
      width: "82px",
      padding: "2px 0 4px",
      background: "transparent",
      border: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "7px",
      cursor: "pointer",
      fontSize: "11px",
      lineHeight: 1.2,
      fontWeight: 700,
      textAlign: "center",
      color: isDark ? "#E8E2D0" : "var(--text-primary)",
      flexShrink: 0,
    };
    function estiloFichaCat(i: number): React.CSSProperties {
      const c = ACENTOS_MARCA[i % ACENTOS_MARCA.length];
      return {
        width: "62px",
        height: "62px",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: "28px",
        background: isDark
          ? "radial-gradient(circle at 30% 25%, " + c + "40, " + c + "14)"
          : "radial-gradient(circle at 30% 25%, #ffffff, " + c + "26)",
        border: "1.5px solid " + c + (isDark ? "88" : "66"),
        boxShadow: "0 6px 14px " + c + (isDark ? "26" : "30"),
      };
    }
    const estiloFichaBot: React.CSSProperties = {
      width: "62px",
      height: "62px",
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      fontSize: "28px",
      background: "linear-gradient(135deg,#f6c445,#e0a526)",
      border: "2px solid " + (isDark ? "#f6d77a" : "#fff"),
      boxShadow: "0 0 0 2px #e0a526, 0 8px 18px rgba(224,165,38,.45)",
    };
    const estiloScrollRow: React.CSSProperties = {
      display: "flex",
      overflowX: "auto",
      gap: "6px",
      paddingBottom: "8px",
      scrollbarWidth: "none" as any,
      msOverflowStyle: "none" as any,
      WebkitOverflowScrolling: "touch" as any,
    };
    const estiloBotonChanguiBot: React.CSSProperties = {
      ...estiloBotonCat,
      color: isDark ? "#f6d77a" : "#92400e",
    };
    function irAMandadito(sec: string | null) {
      if (tabActiva !== "mandaditos") {
        setTabActiva("mandaditos");
        setSearch("");
      }
      if (sec) {
        setSeccionAbierta(sec);
      }
      setTimeout(function () {
        const id = sec ? tituloAId(sec) : "seccion-mandaditos-top";
        scrollToSectionHeading(id);
      }, 160);
    }
    function irARestaurante(secId: string) {
      setRestSectionTarget(secId);
      if (tabActiva !== "restaurantes") {
        setTabActiva("restaurantes");
        setSearch("");
        setTimeout(function () {
          scrollToSectionHeading(secId);
        }, 160);
      } else {
        setSearch("");
        setTimeout(function () { scrollToSectionHeading(secId); }, 160);
      }
    }
    const tituloBloqueStyle: React.CSSProperties = {
      fontSize: "16px",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      color: isDark ? "#E8E2D0" : "var(--text-primary)",
      margin: "8px 0 8px 0",
    };
    const bloqueMandaditos = (
        <div style={{ padding: "4px 16px 0 16px" }}>
          <h3 style={tituloBloqueStyle}>Mandaditos</h3>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "12px" }}>Compras y restaurantes por escrito · sin menú, nos dices qué llevar</p>
          <div style={estiloScrollRow}>
            {SECCIONES_PEDIDOS_ESCRITOS.map(function (sec, i) {
              return (
                <button
                  key={sec.titulo}
                  aria-label={"Mandaditos: " + sec.titulo.trim()}
                  onClick={function () {
                    irAMandadito(sec.titulo);
                  }}
                  style={estiloBotonCat}
                >
                  <span style={estiloFichaCat(i)}>{sec.emoji}</span>
                  {sec.titulo.trim()}
                </button>
              );
            })}
            <button
              onClick={function () {
                setChanguiAbierto(true);
              }}
              style={estiloBotonChanguiBot}
            >
              <span style={estiloFichaBot}>🐒</span>
              ChanguiBot
            </button>
          </div>
        </div>
    );
    const bloqueRestaurantes = (
        <div style={{ padding: "3px 16px 0 16px" }}>
          <h3 style={tituloBloqueStyle}>Restaurantes</h3>
          <div style={estiloScrollRow}>
            {[
              {
                emoji: "🍳",
                label: "Desayunos/Comidas",
                secId: "seccion-desayunos-y-comidas",
              },
              { emoji: "🫓", label: "Cemitas", secId: "seccion-cemitas" },
              { emoji: "🥖", label: "Tortas", secId: "seccion-tortas" },
              { emoji: "🌮", label: "Taquerías", secId: "seccion-taquerias" },
              { emoji: "🍕", label: "Pizzerías", secId: "seccion-pizzerias" },
              {
                emoji: "🍔",
                label: "Hamburguesas",
                secId: "seccion-hamburguesas",
              },
              {
                emoji: "🍜",
                label: "Comida Asiática",
                secId: "seccion-asiatica",
              },
              {
                emoji: "🍗",
                label: "Pollos Preparados",
                secId: "seccion-pollos-preparados",
              },
              {
                emoji: "🦐",
                label: "Pescados y Mariscos",
                secId: "seccion-pescados-y-mariscos",
              },
              { emoji: "🍲", label: "Pozolerías", secId: "seccion-pozoleria" },
              {
                emoji: "🫙",
                label: "Cochinita Pibil",
                secId: "seccion-cochinita-pibil",
              },
              { emoji: "🥩", label: "Carnitas", secId: "seccion-carnitas" },
              { emoji: "🫕", label: "Barbacoa", secId: "seccion-barbacoa" },
              { emoji: "🌶️", label: "Birria", secId: "seccion-birria" },
              {
                emoji: "🍗",
                label: "Alitas y Boneless",
                secId: "seccion-alitas-y-boneless",
              },
              {
                emoji: "🌽",
                label: "Elotes y Antojitos",
                secId: "seccion-elotes",
              },
              { emoji: "🥞", label: "Crepas", secId: "seccion-crepas" },
              { emoji: "🥙", label: "Cheesesteak", secId: "seccion-cheese" },
              { emoji: "☕", label: "Cafeterías", secId: "seccion-cafeterias" },
            ].map(function (btn, i) {
              return (
                <button
                  key={btn.label + i}
                  aria-label={"Restaurantes: " + btn.label}
                  onClick={function () {
                    irARestaurante(btn.secId);
                  }}
                  style={estiloBotonCat}
                >
                  <span style={estiloFichaCat(i)}>{btn.emoji}</span>
                  {btn.label}
                </button>
              );
            })}
            <button
              onClick={function () {
                setChanguiAbierto(true);
              }}
              style={estiloBotonChanguiBot}
            >
              <span style={estiloFichaBot}>🐒</span>
              ChanguiBot
            </button>
          </div>
        </div>
    );
    const bloqueBotones = <div>{bloqueRestaurantes}{bloqueMandaditos}</div>;

    if (tabActiva === "restaurantes") {
      return (
        <div style={{ paddingBottom: "40px" }}>
          <Banner />
          <Monedero session={props.session} theme={props.theme} />
          {bloqueBotones}

          {/* ── SECCIONES RESTAURANTES ── */}
          <div id="seccion-restaurantes" style={{ marginTop: "4px" }}>
            {SECCIONES_REST.map(function (sec) {
              const lista = porCats(sec.cats, (sec as any).names);
              const selected = restSectionTarget === ((sec as any).customId ?? tituloAId(sec.titulo));
              if (!loading && lista.length === 0 && !selected) return null;
              return (
                <SeccionH
                  key={sec.titulo}
                  titulo={sec.titulo}
                  emoji={sec.emoji}
                  merchants={lista}
                  loading={loading}
                  onSelect={setSelectedMerchant}
                  customId={(sec as any).customId}
                  forceVisible={selected}
                />
              );
            })}
          </div>
        </div>
      );
    }

    if (tabActiva === "mandaditos") {
      return (
        <div style={{ paddingBottom: "40px" }}>
          {/* Banner mandaditos */}
          <div
            style={{
              margin: "16px",
              padding: "20px",
              borderRadius: "20px",
              background: "linear-gradient(135deg,#f97316,#ea580c)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: "-10px",
                top: "-10px",
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
              }}
            />
            <p
              style={{
                fontSize: "9px",
                fontWeight: 900,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                margin: "0 0 4px 0",
              }}
            >
              Servicio Express
            </p>
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 900,
                color: "#fff",
                margin: "0 0 4px 0",
              }}
            >
              🛵 Mandaditos
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.85)",
                margin: 0,
              }}
            >
              Pedidos a domicilio de tus tiendas favoritas
            </p>
          </div>

          {/* Cómo funciona */}
          <div
            style={{
              margin: "0 16px 16px",
              padding: "12px 16px",
              borderRadius: "14px",
              background: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(0,0,0,0.03)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              ✍️{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                Cómo funciona:
              </strong>{" "}
              Toca el negocio, escribe tu pedido y se guarda en el carrito.
              Puedes pedir de varios negocios a la vez.
            </p>
          </div>

          {bloqueBotones}

          {/* Acordeón de secciones */}
          {SECCIONES_PEDIDOS_ESCRITOS.map(function (sec) {
            const lista = porKeys(sec.keys);
            if (!loading && lista.length === 0 && seccionAbierta !== sec.titulo) return null;
            const abierta = seccionAbierta === sec.titulo;
            return (
              <div
                key={sec.titulo}
                id={tituloAId(sec.titulo)}
                style={{ marginBottom: "8px", padding: "0 16px" }}
              >
                <button
                  onClick={function () {
                    setSeccionAbierta(abierta ? null : sec.titulo);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>{sec.emoji}</span>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {sec.titulo}
                    </span>
                    <span
                      style={{ fontSize: "11px", color: "var(--text-muted)" }}
                    >
                      ({lista.length})
                    </span>
                  </div>
                  {abierta ? (
                    <ChevronUp
                      style={{
                        width: "16px",
                        height: "16px",
                        color: "var(--text-muted)",
                      }}
                    />
                  ) : (
                    <ChevronDown
                      style={{
                        width: "16px",
                        height: "16px",
                        color: "var(--text-muted)",
                      }}
                    />
                  )}
                </button>
                {abierta && (
                  <div
                    style={{
                      paddingTop: "8px",
                      overflowX: "auto",
                      display: "flex",
                      gap: "12px",
                      scrollbarWidth: "none",
                      paddingBottom: "8px",
                    }}
                  >
                    {lista.length === 0 && !loading && <p style={{ padding: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>Todavía no hay negocios disponibles en esta categoría.</p>}
                    {lista.map(function (m) {
                      return (
                        <TarjetaNegocio
                          key={m.id}
                          merchant={m}
                          onClick={function () {
                            setModalMandadito(m);
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* ChanguiBot */}
          <div style={{ padding: "16px 16px 8px" }}>
            <button
              onClick={function () {
                setChanguiAbierto(true);
              }}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "16px",
                background: isDark
                  ? "rgba(250,204,21,0.1)"
                  : "rgba(250,204,21,0.12)",
                border: "2px solid rgba(250,204,21,0.35)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "24px" }}>🐒</span>
              <div style={{ textAlign: "left", flex: 1 }}>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 900,
                    color: "var(--text-primary)",
                    margin: "0 0 1px 0",
                  }}
                >
                  ChanguiBot IA
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    margin: 0,
                  }}
                >
                  ¿Qué necesitas hoy?
                </p>
              </div>
              <ChevronRight
                style={{
                  width: "16px",
                  height: "16px",
                  color: "var(--text-muted)",
                }}
              />
            </button>
          </div>
        </div>
      );
    }

    if (tabActiva === "tiendita") {
      const lista = merchants.filter(function (m) {
        return ["tiendita", "changui super", "changui súper", "changuito super", "changuito súper"].includes(m.category?.toLowerCase().trim());
      });
      return (
        <SuperCatalog merchants={lista} cart={props.carritoGlobal} search={search} onUpdateCart={props.onUpdateCarritoGlobal} loadingMerchants={loading} />
      );
    }
    return null;
  }

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
        data-dashboard-header
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
        <div className="brand-stripe" aria-hidden="true" style={{ margin: "-14px -16px 14px" }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: 1,
              minWidth: 0,
            }}
          >
            <button
              ref={menuTriggerRef}
              onClick={function () {
                setMenuAbierto(true);
              }}
              aria-label="Abrir menú"
              aria-haspopup="dialog"
              aria-expanded={menuAbierto}
              aria-controls="authenticated-navigation-menu"
              style={{
                flexShrink: 0,
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.05)",
                border: isDark
                  ? "1px solid rgba(255,255,255,0.08)"
                  : "1px solid rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--text-primary)",
              }}
            >
              <Menu style={{ width: "20px", height: "20px" }} />
            </button>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <p
                style={{
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  margin: "0 0 1px 0",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                ¡Hola, {username}! 👋
              </p>
              <h1
                style={{
                  fontSize: "19px",
                  fontWeight: 900,
                  color: "var(--text-primary)",
                  margin: 0,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                ¿Qué se te antoja?
              </h1>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            {totalItems > 0 && (
              <button
                onClick={function () {
                  setModalCheckout(true);
                }}
                style={{
                  position: "relative",
                  background: "var(--color-yellow)",
                  border: "none",
                  borderRadius: "12px",
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(250,204,21,0.35)",
                }}
              >
                <ShoppingBag
                  style={{ width: "18px", height: "18px", color: "#020617" }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    background: "#ef4444",
                    color: "white",
                    fontSize: "10px",
                    fontWeight: 900,
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {totalItems}
                </span>
              </button>
            )}
            <ThemeToggle theme={props.theme} onToggle={props.onThemeToggle} />
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: "12px" }}>
          <Search
            style={{
              position: "absolute",
              left: "13px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "15px",
              height: "15px",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder={tabActiva === "tiendita" ? "Buscar productos de Changui Súper..." : "Buscar negocios o categorías..."}
            value={search}
            onChange={function (e) {
              setSearch(e.target.value);
            }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.04)",
              border: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(0,0,0,0.1)",
              borderRadius: "14px",
              padding: "11px 74px 11px 38px",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
            }}
          />
          {search !== "" && (
            <button
              onClick={function () {
                setSearch("");
              }}
              style={{
                position: "absolute",
                right: "46px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                lineHeight: 0,
              }}
            >
              <X style={{ width: "14px", height: "14px" }} />
            </button>
          )}
          {/* ChanguiBot trigger — embedded in search bar right edge */}
          {props.onAddToCart && (
            <button
              onClick={function () {
                setChanguiAbierto(true);
              }}
              title="ChanguiBot IA"
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                background: "linear-gradient(135deg,#facc15,#f59e0b)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                boxShadow: "0 3px 10px rgba(250,204,21,0.45)",
                lineHeight: 1,
              }}
            >
              🐒
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            background: isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.05)",
            borderRadius: "16px",
            padding: "4px",
            gap: "4px",
          }}
        >
          <button
            style={tabStyle("restaurantes")}
            onClick={function () {
              setTabActiva("restaurantes");
              setSearch("");
            }}
          >
            🍽️ Restaurantes
          </button>
          <button
            style={tabStyle("mandaditos")}
            onClick={function () {
              setTabActiva("mandaditos");
              setSearch("");
            }}
          >
            🛵 Mandaditos
          </button>
          <button
            style={tabStyle("tiendita")}
            onClick={function () {
              setTabActiva("tiendita");
              setSearch("");
            }}
          >
            🛒 Changui Súper
          </button>
        </div>
      </div>

      {/* Hamburger Drawer */}
      {menuAbierto && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}
          onClick={function () {
            setMenuAbierto(false);
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(2px)",
            }}
          />
          <div
            id="authenticated-navigation-menu"
            ref={menuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="fade-in"
            style={{
              position: "relative",
              width: "280px",
              maxWidth: "82%",
              height: "100%",
              background: "var(--bg-card)",
              borderRight: "1px solid var(--border-subtle)",
              zIndex: 201,
              display: "flex",
              flexDirection: "column",
              boxShadow: "8px 0 32px rgba(0,0,0,0.35)",
            }}
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div
              style={{
                padding: "20px 18px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    margin: "0 0 2px 0",
                  }}
                >
                  Sesión
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--text-primary)",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {props.session.user.email}
                </p>
              </div>
              <button
                onClick={function () {
                  setMenuAbierto(false);
                  menuTriggerRef.current?.focus();
                }}
                aria-label="Cerrar menú"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "4px",
                  lineHeight: 0,
                }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>

              {/* - 1 - ChangoMonedero (SIEMPRE PRIMERO) - */}
              <button
                onClick={function () { setMenuAbierto(false); typeof setView === 'function' ? setView('changomonedero') : (props.onIrMonedero && props.onIrMonedero()); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "14px 12px", borderRadius: "14px", backgroundColor: "rgba(250,204,21,0.1)", border: "1.5px solid rgba(250,204,21,0.45)", cursor: "pointer", color: "var(--text-primary)", fontSize: "14px", fontWeight: "900", textAlign: "left", marginBottom: "4px" }}
              >
                <Wallet style={{ width: "20px", height: "20px", color: "#facc15", flexShrink: 0 }} />
                <div>
                  <span style={{ display: "block", fontSize: "14px", fontWeight: "900" }}> ChangoMonedero</span>
                  <span style={{ display: "block", fontSize: "10px", color: "#f59e0b", fontWeight: "700" }}>Saldo · ChangoPesos · Beneficios</span>
                </div>
              </button>

               {/* ─ 2 · Restaurantes / Mandaditos / La Tiendita ─ */}
              <button
                onClick={function () { setTabActiva("restaurantes"); setSearch(""); setMenuAbierto(false); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}
              >
                <Store style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>Restaurantes</span>
              </button>
              <button
                onClick={function () { setTabActiva("mandaditos"); setSearch(""); setMenuAbierto(false); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}
              >
                <Bike style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>Mandaditos</span>
              </button>
              <button
                onClick={function () { setTabActiva("tiendita"); setSearch(""); setMenuAbierto(false); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}
              >
                <ShoppingCart style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>Changui Súper</span>
              </button>

              <div style={{ height:"1px", background:"var(--border-subtle)", margin:"10px 8px" }} />

              {/* ─ 3 · Bazar / Directorio / Shopping ─ */}
              <button onClick={function(){ setMenuAbierto(false); props.onIrBazar && props.onIrBazar(); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}>
                <Sparkles style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>Bazar Vecinal</span>
              </button>
              <button onClick={function(){ setMenuAbierto(false); props.onIrServicios && props.onIrServicios(); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}>
                <Smartphone style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>Directorio Telefónico</span>
              </button>
              <button onClick={function(){ setMenuAbierto(false); props.onIrShopping && props.onIrShopping(); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}>
                <ShoppingBasket style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>ChanguiShopping</span>
              </button>

              <div style={{ height:"1px", background:"var(--border-subtle)", margin:"10px 8px" }} />

              {/* ─ 4 · Bienes Raíces / Venta de Autos ─ */}
              <button onClick={function(){ setMenuAbierto(false); props.onIrBienes && props.onIrBienes(); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}>
                <Building2 style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>Bienes Raíces</span>
              </button>
              <button onClick={function(){ setMenuAbierto(false); props.onIrAutos && props.onIrAutos(); }}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}>
                <Car style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span>Venta de Autos</span>
              </button>

              <div style={{ height:"1px", background:"var(--border-subtle)", margin:"10px 8px" }} />

              {/* ─ 5 · Paneles condicionales (rol) ─ */}
              {puedeNegocio && (
                <button onClick={function(){ setMenuAbierto(false); props.onIrNegocio && props.onIrNegocio(); }}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"transparent", border:"none", cursor:"pointer", color:"var(--text-primary)", fontSize:"14px", fontWeight:700, textAlign:"left" }}>
                  <Store style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                  <span>Panel de Negocios</span>
                </button>
              )}

              {puedeRepartidor && (
                <button onClick={function(){ setMenuAbierto(false); props.onIrRepas && props.onIrRepas(); }}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.3)", cursor:"pointer", color:"var(--color-green)", fontSize:"14px", fontWeight:900, textAlign:"left" }}>
                  <span style={{ fontSize:"18px", flexShrink:0 }}>🛵</span>
                  <span>Panel Repartidor</span>
                </button>
              )}

              {esAdmin && (
                <button onClick={function(){ setMenuAbierto(false); props.onIrAdmin && props.onIrAdmin(); }}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:"12px", padding:"12px", borderRadius:"12px", background:"rgba(250,204,21,0.12)", border:"1px solid rgba(250,204,21,0.3)", cursor:"pointer", color:"var(--color-yellow)", fontSize:"14px", fontWeight:900, textAlign:"left" }}>
                  <Shield style={{ width:"18px", height:"18px", flexShrink:0 }} />
                  <span>God Mode</span>
                </button>
              )}

              <div style={{ height:"1px", background:"var(--border-subtle)", margin:"10px 8px" }} />
              <button
                type="button"
                onClick={alternarDispositivos}
                aria-expanded={deviceSessionsOpen}
                aria-controls="device-sessions-panel"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  borderRadius: "12px",
                  background: deviceSessionsOpen ? "rgba(250,204,21,0.1)" : "transparent",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  fontSize: "13px",
                  fontWeight: 800,
                  textAlign: "left",
                }}
              >
                <Smartphone style={{ width:"18px", height:"18px", color:"var(--color-yellow)", flexShrink:0 }} />
                <span style={{ flex: 1 }}>Dispositivos conectados</span>
                {deviceSessionsOpen ? (
                  <ChevronUp style={{ width: "16px", height: "16px" }} />
                ) : (
                  <ChevronDown style={{ width: "16px", height: "16px" }} />
                )}
              </button>

              {deviceSessionsOpen && (
                <section
                  id="device-sessions-panel"
                  aria-label="Dispositivos con sesión iniciada"
                  style={{ padding: "10px 2px 2px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "11px", lineHeight: 1.4 }}>
                      Revisá la actividad y cerrá sesiones que no reconozcas.
                    </p>
                    <button
                      type="button"
                      onClick={function () { void cargarDispositivos(); }}
                      disabled={loadingDeviceSessions}
                      aria-label="Actualizar dispositivos"
                      style={{ background: "transparent", border: "none", color: "var(--color-yellow)", cursor: loadingDeviceSessions ? "wait" : "pointer", padding: "5px", lineHeight: 0, flexShrink: 0 }}
                    >
                      <RefreshCw style={{ width: "15px", height: "15px", animation: loadingDeviceSessions ? "spin 1s linear infinite" : undefined }} />
                    </button>
                  </div>
                  {deviceSessionsError && (
                    <p role="alert" style={{ color: "#ef4444", fontSize: "11px", lineHeight: 1.4, margin: "0 0 8px" }}>
                      {deviceSessionsError}
                    </p>
                  )}
                  {deviceSessionsNotice && (
                    <p role="status" aria-live="polite" style={{ color: "var(--color-green)", fontSize: "11px", lineHeight: 1.4, margin: "0 0 8px" }}>
                      {deviceSessionsNotice}
                    </p>
                  )}
                  {loadingDeviceSessions && deviceSessions.length === 0 ? (
                    <p role="status" aria-live="polite" style={{ color: "var(--text-muted)", fontSize: "12px", padding: "8px 4px" }}>
                      Cargando dispositivos...
                    </p>
                  ) : deviceSessions.length === 0 ? (
                    deviceSessionsError ? null : (
                      <p style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.4, padding: "4px" }}>
                        No encontramos otras sesiones activas.
                      </p>
                    )
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" }}>
                      {deviceSessions.map(function (device) {
                        const revoking = revokingDeviceSession === device.session_id;
                        return (
                          <li
                            key={device.session_id}
                            style={{ padding: "10px", borderRadius: "10px", border: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: "0 0 4px", color: "var(--text-primary)", fontSize: "12px", fontWeight: 800, overflowWrap: "anywhere" }}>
                                  {deviceDescription(device.user_agent)}
                                </p>
                                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "10px", lineHeight: 1.4 }}>
                                  {deviceActivityDate(device.updated_at ?? device.created_at)}
                                </p>
                              </div>
                              {device.is_current ? (
                                <span style={{ flexShrink: 0, borderRadius: "20px", padding: "3px 7px", background: "rgba(34,197,94,0.12)", color: "var(--color-green)", fontSize: "9px", fontWeight: 800 }}>
                                  Este dispositivo
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={function () { void revocarDispositivo(device); }}
                                  disabled={Boolean(revokingDeviceSession)}
                                  style={{ flexShrink: 0, borderRadius: "7px", padding: "5px 7px", border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "10px", fontWeight: 800, cursor: revokingDeviceSession ? "wait" : "pointer", opacity: revokingDeviceSession && !revoking ? 0.55 : 1 }}
                                >
                                  {revoking ? "Cerrando..." : "Cerrar sesión"}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </div>

            <div
              style={{
                padding: "12px 14px 18px",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              {signOutError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#ef4444",
                    fontSize: "12px",
                    lineHeight: 1.4,
                  }}
                >
                  {signOutError}
                </div>
              )}
              <button
                onClick={cerrarSesion}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "13px 12px",
                  borderRadius: "12px",
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontSize: "13px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                <LogOut style={{ width: "15px", height: "15px" }} />
                Cerrar sesión
              </button>
              <button
                onClick={cerrarSesionEnTodosLosDispositivos}
                disabled={signingOutEverywhere}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginTop: "8px",
                  padding: "11px 12px",
                  borderRadius: "12px",
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  cursor: signingOutEverywhere ? "wait" : "pointer",
                  color: "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 800,
                  opacity: signingOutEverywhere ? 0.65 : 1,
                }}
              >
                <Shield style={{ width: "15px", height: "15px" }} />
                {signingOutEverywhere
                  ? "Cerrando todas las sesiones..."
                  : "Cerrar sesión en todos los dispositivos"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ paddingTop: "2px", paddingBottom: "90px" }}>
        {renderContenido()}
      </div>

      {/* FAB carrito flotante */}
      {totalItems > 0 && !modalCheckout && (
        <button
          onClick={function () {
            setModalCheckout(true);
          }}
          style={{
            position: "fixed",
            bottom: "90px",
            right: "20px",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "var(--color-yellow)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 32px rgba(250,204,21,0.5)",
            zIndex: 999,
          }}
        >
          <ShoppingBag
            style={{ width: "24px", height: "24px", color: "#020617" }}
          />
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "22px",
              height: "22px",
              padding: "0 6px",
              borderRadius: "11px",
              background: "#ef4444",
              color: "white",
              fontSize: "11px",
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg-base)",
            }}
          >
            {totalItems}
          </span>
        </button>
      )}

      {modalMandadito && (
        <ModalMandadito
          merchant={modalMandadito}
          onClose={function () {
            setModalMandadito(null);
          }}
          onAgregar={function (texto) {
            agregarMandadito(modalMandadito, texto);
            setModalMandadito(null);
          }}
        />
      )}

      {modalCheckout && (
        <ModalCheckout
          carrito={props.carritoGlobal}
          clienteId={props.session.user.id}
          clienteEmail={props.session.user.email ?? ""}
          clienteNombre={props.session.user.nombre}
          onClose={function () {
            setModalCheckout(false);
          }}
          onPedidoOk={function () {
            props.onUpdateCarritoGlobal([]);
            setModalCheckout(false);
          }}
          onRemoveItem={function (id) {
            props.onUpdateCarritoGlobal(
              props.carritoGlobal.filter(function (i) {
                return i.id !== id;
              }),
            );
          }}
          onUpdateCantidad={function (id, delta) {
            props.onUpdateCarritoGlobal(
              props.carritoGlobal.map(function (i) {
                if (i.id !== id) return i;
                return { ...i, cantidad: Math.max(1, i.cantidad + delta) };
              }),
            );
          }}
        />
      )}

      {/* Bottom Navigation Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "480px",
          zIndex: 90,
          background: "var(--bg-nav)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid var(--border-subtle)",
          padding: "8px 8px calc(8px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          justifyContent: "space-around",
        }}
      >
        {(
          [
            {
              key: "inicio",
              label: "Restaurantes",
              emoji: "🍽️",
              onClick: function () {
                setTabActiva("restaurantes");
                setSearch("");
              },
            },
            {
              key: "tiendita",
              label: "Changui Súper",
              emoji: "🛒",
              onClick: function () {
                setTabActiva("tiendita");
                setSearch("");
              },
            },
            {
              key: "shopping",
              label: "Shopping",
              emoji: "🛍️",
              onClick: function () {
                props.onIrShopping && props.onIrShopping();
              },
            },
            {
              key: "bazar",
              label: "Bazar Lomas",
              emoji: "🏘",
              onClick: function () {
                props.onIrBazar && props.onIrBazar();
              },
            },
            {
              key: "servicios",
              label: "Directorio",
              emoji: "📞",
              onClick: function () {
                props.onIrServicios && props.onIrServicios();
              },
            },
          ] as const
        ).map(function (it) {
          const activo =
            (it.key === "inicio" && tabActiva === "restaurantes") ||
            (it.key === "tiendita" && tabActiva === "tiendita");
          return (
            <button
              key={it.key}
              onClick={it.onClick}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                padding: "6px 2px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: activo ? "var(--color-yellow)" : "var(--text-muted)",
              }}
            >
              {it.key === "servicios" ? (
                <Smartphone style={{ width: "18px", height: "18px" }} />
              ) : (
                <span style={{ fontSize: "18px", lineHeight: 1 }}>
                  {it.emoji}
                </span>
              )}
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                }}
              >
                {it.label}
              </span>
            </button>
          );
        })}
      </div>

      <style>{`::-webkit-scrollbar{display:none;}*{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}button{font-family:inherit;}`}</style>

      {/* ChanguiBot IA */}
      {props.onAddToCart && (
        <ChanguitoAI
          session={props.session}
          theme={props.theme}
          carritoGlobal={props.carritoGlobal}
          onAddToCart={props.onAddToCart}
          onRemoveFromCart={function (id) {
            props.onUpdateCarritoGlobal(
              props.carritoGlobal.filter(function (i) {
                return i.id !== id;
              }),
            );
          }}
          abierto={changuiAbierto}
          onCerrar={function () {
            setChanguiAbierto(false);
          }}
        />
      )}

      {/* Modal límite 4 negocios */}
      {modalLimite && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
          onClick={function () {
            setModalLimite(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "24px",
              padding: "28px 24px",
              maxWidth: "340px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
            onClick={function (e) {
              e.stopPropagation();
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🛒</div>
            <h2
              style={{
                fontSize: "17px",
                fontWeight: 900,
                color: "var(--text-primary)",
                margin: "0 0 10px 0",
                lineHeight: 1.25,
              }}
            >
              Límite alcanzado
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                margin: "0 0 20px 0",
                lineHeight: 1.55,
              }}
            >
              Máximo{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                4 negocios
              </strong>{" "}
              por pedido para garantizar la frescura y velocidad de tus
              repartidores.
            </p>
            <button
              onClick={function () {
                setModalLimite(false);
              }}
              style={{
                width: "100%",
                background: "var(--color-yellow)",
                color: "#020617",
                fontWeight: 900,
                fontSize: "14px",
                padding: "14px",
                borderRadius: "14px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
