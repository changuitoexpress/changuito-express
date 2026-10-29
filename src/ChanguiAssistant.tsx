/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Send, Trash2, X } from "lucide-react";
import { supabase } from "./supabase";
import type { AppSession, Theme } from "./App";

interface ItemCarrito {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  negocio: string;
  negocio_id: string;
  phone_number: string;
  tipo: "producto" | "mandadito";
}

interface Producto {
  id: string;
  merchant_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface Negocio {
  id: string;
  name: string;
  phone_number?: string | null;
}

interface PropuestaItem extends ItemCarrito {}

interface Mensaje {
  id: string;
  rol: "user" | "bot";
  texto: string;
  hora: string;
}

interface Props {
  session: AppSession;
  theme: Theme;
  carritoGlobal: any[];
  onAddToCart: (items: ItemCarrito[]) => void;
  onRemoveFromCart?: (id: string) => void;
  abierto: boolean;
  onCerrar: () => void;
}

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

function horaActual(): string {
  return new Date().toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function esConfirmacion(texto: string): boolean {
  return /^(si|ok|okay|dale|confirmo|confirmar|agregalo|agregar|va|correcto|asi es)[.! ]*$/.test(
    normalizar(texto),
  );
}

function esCancelacion(texto: string): boolean {
  return /^(cancel(a|ar)?|olvida(lo)?|borra(lo)?|descarta(lo)?|no quiero|empezar de nuevo)[.! ]*$/.test(
    normalizar(texto),
  );
}

function dinero(valor: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(valor);
}

export default function ChanguiAssistant(props: Props) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [dictando, setDictando] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [catalogoCargando, setCatalogoCargando] = useState(true);
  const [propuesta, setPropuesta] = useState<PropuestaItem[]>([]);
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const isDark = props.theme === "dark";

  useEffect(function () {
    let activo = true;
    async function cargarCatalogo() {
      setCatalogoCargando(true);
      setErrorCatalogo("");
      const [productosResult, negociosResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, merchant_id, name, price, is_available")
          .eq("is_available", true)
          .limit(600),
        supabase
          .from("merchants")
          .select("id, name, phone_number")
          .limit(200),
      ]);
      if (!activo) return;
      if (productosResult.error || negociosResult.error) {
        setErrorCatalogo(
          "No pude cargar el catálogo. Cierra y abre ChanguiBot para volver a intentarlo.",
        );
      } else {
        setProductos((productosResult.data ?? []) as Producto[]);
        setNegocios((negociosResult.data ?? []) as Negocio[]);
      }
      setCatalogoCargando(false);
    }
    void cargarCatalogo();
    return function () {
      activo = false;
      recognitionRef.current?.stop?.();
    };
  }, []);

  useEffect(function () {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, propuesta]);

  useEffect(function () {
    if (props.abierto && mensajes.length === 0) {
      setMensajes([
        {
          id: "bienvenida",
          rol: "bot",
          hora: horaActual(),
          texto:
            "¡Hola! Soy ChanguiBot. Cuéntame o dicta lo que necesitas; revisaré el catálogo y te mostraré una propuesta con precios reales. No agregaré nada al carrito hasta que tú confirmes.",
        },
      ]);
      setTimeout(function () {
        inputRef.current?.focus();
      }, 250);
    }
  }, [props.abierto, mensajes.length]);

  function agregarMensajeBot(texto: string) {
    setMensajes(function (prev) {
      return [
        ...prev,
        { id: "b-" + Date.now(), rol: "bot", texto, hora: horaActual() },
      ];
    });
  }

  function confirmarPropuesta() {
    if (propuesta.length === 0 || cargando) return;
    props.onAddToCart(propuesta);
    setPropuesta([]);
    agregarMensajeBot(
      "Listo, pasé la propuesta confirmada al carrito. Desde ahí puedes revisar el total y continuar al pago.",
    );
  }

  async function enviarMensaje(textoOriginal?: string) {
    const texto = (textoOriginal ?? input).trim();
    if (!texto || cargando) return;
    setInput("");
    const historial = mensajes
      .slice(-8)
      .map(function (mensaje) {
        return {
          role: mensaje.rol,
          text: mensaje.texto,
        };
      });
    setMensajes(function (prev) {
      return [
        ...prev,
        { id: "u-" + Date.now(), rol: "user", texto, hora: horaActual() },
      ];
    });

    if (propuesta.length > 0 && esConfirmacion(texto)) {
      confirmarPropuesta();
      return;
    }
    if (propuesta.length > 0 && esCancelacion(texto)) {
      setPropuesta([]);
      agregarMensajeBot(
        "De acuerdo, descarté la propuesta. Cuéntame qué quieres pedir ahora.",
      );
      return;
    }
    if (catalogoCargando) {
      agregarMensajeBot("Estoy cargando el catálogo. Intenta de nuevo en unos segundos.");
      return;
    }
    if (errorCatalogo || productos.length === 0) {
      agregarMensajeBot(
        errorCatalogo || "No hay productos disponibles para preparar una propuesta.",
      );
      return;
    }

    setCargando(true);
    try {
      const catalog = productos.map(function (producto) {
        const negocio = negocios.find(function (item) {
          return item.id === producto.merchant_id;
        });
        return {
          id: String(producto.id),
          merchantId: String(producto.merchant_id),
          name: producto.name,
          price: Number(producto.price),
          merchantName: negocio?.name ?? "Negocio local",
        };
      });
      const response = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: texto,
          history: historial,
          catalog,
          draft: propuesta.map(function (item) {
            return { productId: item.id, quantity: item.cantidad };
          }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No pude consultar el catálogo.");

      const productosPorId = new Map(
        productos.map(function (producto) {
          return [String(producto.id), producto];
        }),
      );
      const propuestaNueva: PropuestaItem[] = [];
      for (const solicitado of data.items ?? []) {
        const producto = productosPorId.get(String(solicitado.id));
        const cantidad = Number(solicitado.quantity);
        if (
          !producto ||
          !producto.is_available ||
          !Number.isInteger(cantidad) ||
          cantidad < 1 ||
          cantidad > 20
        ) {
          continue;
        }
        const negocio = negocios.find(function (item) {
          return item.id === producto.merchant_id;
        });
        propuestaNueva.push({
          id: String(producto.id),
          nombre: producto.name,
          precio: Number(producto.price),
          cantidad,
          negocio: negocio?.name ?? "Changuito Express",
          negocio_id: String(producto.merchant_id),
          phone_number: String(negocio?.phone_number ?? "522223339999"),
          tipo: "producto",
        });
      }
      const merchantIds = new Set(
        propuestaNueva.map(function (item) {
          return item.negocio_id;
        }),
      );
      if (merchantIds.size > 1) {
        setPropuesta([]);
        agregarMensajeBot(
          "Para calcular correctamente el pedido, hagámoslo con un solo negocio a la vez. ¿Cuál prefieres?",
        );
      } else {
        setPropuesta(propuestaNueva);
        agregarMensajeBot(
          String(data.reply ?? "¿Quieres ajustar algo de tu pedido?"),
        );
      }
    } catch (error: any) {
      agregarMensajeBot(
        error?.message ??
          "No pude preparar la propuesta en este momento. Intenta otra vez.",
      );
    } finally {
      setCargando(false);
    }
  }

  function iniciarDictado() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      agregarMensajeBot(
        "Este navegador no permite dictar desde la página. Puedes escribir tu pedido aquí.",
      );
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "es-MX";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = function (event: RecognitionResultEvent) {
        const transcript = Array.from(event.results)
          .map(function (result) {
            return result[0]?.transcript ?? "";
          })
          .join(" ")
          .trim();
        if (transcript) setInput(transcript);
      };
      recognition.onerror = function (event: any) {
        const message =
          event?.error === "not-allowed"
            ? "No tengo permiso para usar el micrófono. Autorízalo en el navegador o escribe tu pedido."
            : "No pude escuchar con claridad. Intenta otra vez o escribe tu pedido.";
        agregarMensajeBot(message);
      };
      recognition.onend = function () {
        setDictando(false);
        recognitionRef.current = null;
      };
      setDictando(true);
      recognition.start();
    } catch {
      setDictando(false);
      agregarMensajeBot(
        "No pude iniciar el micrófono. Revisa el permiso del navegador e intenta otra vez.",
      );
    }
  }

  if (!props.abierto) return null;

  const totalPropuesta = propuesta.reduce(function (total, item) {
    return total + item.precio * item.cantidad;
  }, 0);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 350,
        maxWidth: "480px",
        margin: "0 auto",
        height: "min(82dvh, 760px)",
        background: isDark ? "#142b36" : "#fffdf7",
        borderRadius: "24px 24px 0 0",
        border: "1px solid rgba(47,158,111,.24)",
        boxShadow: "0 -12px 48px rgba(0,0,0,.32)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: isDark
            ? "linear-gradient(120deg,rgba(47,158,111,.2),rgba(224,165,38,.1))"
            : "linear-gradient(120deg,rgba(47,158,111,.12),rgba(224,165,38,.12))",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "46px",
            height: "46px",
            borderRadius: "16px",
            display: "grid",
            placeItems: "center",
            fontSize: "27px",
            background: "linear-gradient(145deg,#f5ce68,#e0a526)",
            boxShadow: "0 5px 15px rgba(224,165,38,.28)",
          }}
          aria-hidden="true"
        >
          🐒
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 900,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            ChanguiBot
          </p>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 750,
              letterSpacing: ".06em",
              margin: "3px 0 0",
              color: cargando || catalogoCargando ? "#d99a25" : "#2f9e6f",
            }}
            role="status"
          >
            {catalogoCargando
              ? "CARGANDO CATÁLOGO…"
              : cargando
                ? "PREPARANDO TU PROPUESTA…"
                : dictando
                  ? "ESCUCHANDO…"
                  : "PEDIDOS CON CATÁLOGO REAL"}
          </p>
        </div>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: 850,
            background: isDark ? "rgba(224,165,38,.16)" : "rgba(224,165,38,.2)",
            color: isDark ? "#f5ce68" : "#80590f",
          }}
          aria-label={props.carritoGlobal.length + " productos en el carrito"}
        >
          🛒 {props.carritoGlobal.length}
        </div>
        <button
          onClick={props.onCerrar}
          aria-label="Cerrar ChanguiBot"
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "12px",
            background: isDark ? "rgba(255,255,255,.07)" : "rgba(33,55,57,.06)",
            border: "1px solid var(--border-subtle)",
            display: "grid",
            placeItems: "center",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "11px",
        }}
      >
        {mensajes.map(function (mensaje) {
          const esBot = mensaje.rol === "bot";
          return (
            <div
              key={mensaje.id}
              style={{
                display: "flex",
                justifyContent: esBot ? "flex-start" : "flex-end",
                alignItems: "flex-end",
                gap: "8px",
              }}
            >
              {esBot && (
                <div
                  aria-hidden="true"
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "11px",
                    background: "linear-gradient(145deg,#f5ce68,#e0a526)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "17px",
                    flexShrink: 0,
                  }}
                >
                  🐒
                </div>
              )}
              <div
                style={{
                  maxWidth: "82%",
                  padding: "11px 14px",
                  borderRadius: esBot
                    ? "17px 17px 17px 5px"
                    : "17px 17px 5px 17px",
                  background: esBot
                    ? isDark
                      ? "rgba(47,158,111,.13)"
                      : "#f0f7f0"
                    : "linear-gradient(135deg,#2f9e6f,#257b59)",
                  border: esBot
                    ? "1px solid rgba(47,158,111,.17)"
                    : "1px solid rgba(255,255,255,.14)",
                  boxShadow: esBot ? "none" : "0 5px 14px rgba(47,158,111,.18)",
                }}
              >
                <p
                  style={{
                    fontSize: "13px",
                    color: esBot ? "var(--text-primary)" : "#fff",
                    margin: "0 0 4px",
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {mensaje.texto}
                </p>
                <p
                  style={{
                    fontSize: "9px",
                    color: esBot ? "var(--text-muted)" : "rgba(255,255,255,.72)",
                    margin: 0,
                    textAlign: "right",
                  }}
                >
                  {mensaje.hora}
                </p>
              </div>
            </div>
          );
        })}

        {cargando && (
          <div
            role="status"
            style={{
              alignSelf: "flex-start",
              marginLeft: "38px",
              color: "#2f9e6f",
              fontSize: "12px",
              fontWeight: 750,
            }}
          >
            Revisando el menú y preparando opciones…
          </div>
        )}

        {propuesta.length > 0 && (
          <section
            aria-label="Propuesta de pedido"
            style={{
              margin: "2px 0 4px 38px",
              padding: "14px",
              borderRadius: "17px",
              background: isDark ? "rgba(255,255,255,.04)" : "#fff",
              border: "1px solid rgba(47,158,111,.3)",
              boxShadow: "0 8px 22px rgba(22,61,42,.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "10px",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#2f9e6f",
                    fontSize: "10px",
                    fontWeight: 900,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                  }}
                >
                  Tu propuesta
                </div>
                <div
                  style={{
                    marginTop: "3px",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: 850,
                  }}
                >
                  {propuesta[0].negocio}
                </div>
              </div>
              <button
                type="button"
                onClick={function () {
                  setPropuesta([]);
                  agregarMensajeBot("Descarté la propuesta. ¿Qué te gustaría pedir?");
                }}
                aria-label="Descartar la propuesta"
                style={{
                  width: "32px",
                  height: "32px",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  background: "transparent",
                  color: "var(--text-muted)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            {propuesta.map(function (item) {
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "8px 0",
                    borderTop: "1px solid var(--border-subtle)",
                    fontSize: "12px",
                    color: "var(--text-primary)",
                  }}
                >
                  <span>
                    {item.cantidad} × {item.nombre}
                  </span>
                  <strong style={{ whiteSpace: "nowrap" }}>
                    {dinero(item.precio * item.cantidad)}
                  </strong>
                </div>
              );
            })}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "10px",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "13px",
                fontWeight: 900,
                color: "var(--text-primary)",
              }}
            >
              <span>Subtotal</span>
              <span>{dinero(totalPropuesta)}</span>
            </div>
            <p
              style={{
                margin: "7px 0 11px",
                fontSize: "10px",
                lineHeight: 1.45,
                color: "var(--text-muted)",
              }}
            >
              El envío se calcula después. Nada se agrega hasta que lo confirmes.
            </p>
            <button
              type="button"
              onClick={confirmarPropuesta}
              disabled={cargando}
              style={{
                width: "100%",
                minHeight: "44px",
                border: 0,
                borderRadius: "12px",
                background: "linear-gradient(135deg,#2f9e6f,#257b59)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 900,
                cursor: cargando ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
              }}
            >
              <Check size={16} /> Confirmar y pasar al carrito
            </button>
          </section>
        )}
        <div ref={chatEndRef} />
      </div>

      <div
        style={{
          padding: "12px 14px max(14px, env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--border-subtle)",
          background: isDark ? "#142b36" : "#fffdf7",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={iniciarDictado}
            disabled={cargando || catalogoCargando || dictando}
            aria-label={dictando ? "Escuchando el pedido" : "Dictar pedido"}
            title="Dictar pedido"
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "14px",
              flexShrink: 0,
              border: dictando ? "1px solid #d94343" : "1px solid rgba(47,158,111,.28)",
              background: dictando ? "rgba(217,67,67,.12)" : "rgba(47,158,111,.09)",
              color: dictando ? "#d94343" : "#2f9e6f",
              display: "grid",
              placeItems: "center",
              cursor: cargando || dictando ? "not-allowed" : "pointer",
            }}
          >
            {dictando ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={function (event) {
              setInput(event.target.value);
            }}
            onKeyDown={function (event) {
              if (event.key === "Enter") {
                event.preventDefault();
                void enviarMensaje();
              }
            }}
            placeholder={dictando ? "Te escucho…" : "Cuéntame qué necesitas…"}
            disabled={cargando || catalogoCargando}
            aria-label="Escribe o dicta tu pedido"
            style={{
              flex: 1,
              minWidth: 0,
              height: "46px",
              padding: "0 14px",
              borderRadius: "14px",
              border: "1px solid var(--border-medium)",
              background: isDark ? "rgba(255,255,255,.05)" : "#fff",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={function () {
              void enviarMensaje();
            }}
            disabled={cargando || catalogoCargando || !input.trim()}
            aria-label="Enviar pedido"
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "14px",
              border: 0,
              flexShrink: 0,
              cursor:
                cargando || catalogoCargando || !input.trim()
                  ? "not-allowed"
                  : "pointer",
              background:
                cargando || catalogoCargando || !input.trim()
                  ? "rgba(47,158,111,.28)"
                  : "linear-gradient(135deg,#2f9e6f,#257b59)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              boxShadow:
                cargando || !input.trim()
                  ? "none"
                  : "0 4px 12px rgba(47,158,111,.25)",
            }}
          >
            <Send size={17} />
          </button>
        </div>
        <p
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            textAlign: "center",
            margin: "8px 0 0",
            lineHeight: 1.4,
          }}
        >
          Dictado disponible según tu navegador · Precios del catálogo · Confirmas antes de agregar
        </p>
      </div>
    </div>
  );
}
