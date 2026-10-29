/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Send, Trash2, X } from "lucide-react";
import { supabase } from "./supabase";
import type { AppSession, Theme } from "./App";
import { useVoiceConversation } from "./hooks/useVoiceConversation";

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

function textoVozBreve(texto: string) {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const frases = limpio.match(/[^.!?]+[.!?]?/g)?.map(function (frase) { return frase.trim(); }).filter(Boolean) ?? [];
  let breve = frases.slice(0, 2).join(" ");
  if (breve.length > 180) {
    breve = breve.slice(0, 177).replace(/\s+\S*$/, "").trim() + "…";
  }
  return breve || "Listo. ¿Qué más necesitas?";
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
  const confirmationLockRef = useRef(false);
  const mountedRef = useRef(true);
  const isDark = props.theme === "dark";
  const conversation = useVoiceConversation({
    open: props.abierto,
    busy: cargando || catalogoCargando,
    onTurn: async function (text) { await enviarMensaje(text); },
    onNotice: function (text) { agregarMensajeBot(text); },
  });

  useEffect(function () {
    let activo = true;
    mountedRef.current = true;
    async function cargarCatalogo() {
      setCatalogoCargando(true);
      setErrorCatalogo("");
      try {
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
      } catch {
        if (activo) {
          setErrorCatalogo("No pude conectar con el catálogo. Cierra y abre ChanguiBot para reintentar.");
        }
      } finally {
        if (activo) setCatalogoCargando(false);
      }
    }
    void cargarCatalogo();
    return function () {
      activo = false;
      mountedRef.current = false;
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
          texto: "¡Hola! ¿Qué se te antoja? Te preparo una propuesta con precios reales y tú decides antes de agregarla al carrito.",
        },
      ]);
      setTimeout(function () {
        inputRef.current?.focus();
      }, 250);
    }
  }, [props.abierto, mensajes.length]);

  useEffect(function () {
    if (!props.abierto) recognitionRef.current?.stop?.();
  }, [props.abierto]);

  function agregarMensajeBot(texto: string, textoHablado?: string) {
    setMensajes(function (prev) {
      return [
        ...prev,
        { id: "b-" + Date.now(), rol: "bot", texto, hora: horaActual() },
      ];
    });
    conversation.speak(textoHablado ?? textoVozBreve(texto));
  }

  async function confirmarPropuesta() {
    if (propuesta.length === 0 || cargando || confirmationLockRef.current) return;
    confirmationLockRef.current = true;
    setCargando(true);
    let confirmado = false;
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, merchant_id, name, price, is_available")
        .in("id", propuesta.map(function (item) { return item.id; }));
      if (!mountedRef.current) return;
      if (error || !data) throw new Error("No pude revisar los precios actuales. Intenta confirmar de nuevo.");
      const actualizados: PropuestaItem[] = [];
      let huboCambios = false;
      for (const item of propuesta) {
        const actual = data.find(function (producto) {
          return String(producto.id) === item.id;
        });
        if (!actual?.is_available || String(actual.merchant_id) !== item.negocio_id) {
          huboCambios = true;
          continue;
        }
        const precio = Number(actual.price);
        if (!Number.isFinite(precio) || precio < 0) {
          huboCambios = true;
          continue;
        }
        if (precio !== item.precio || actual.name !== item.nombre) huboCambios = true;
        actualizados.push({ ...item, nombre: actual.name, precio });
      }
      if (huboCambios) {
        setPropuesta(actualizados);
        agregarMensajeBot(
          actualizados.length > 0
            ? "El catálogo cambió: actualicé precios y quité los productos que ya no están disponibles. Revisa la propuesta y vuelve a confirmar."
            : "Los productos de la propuesta ya no están disponibles. No agregué nada; podemos buscar otra opción.",
          actualizados.length > 0 ? "Actualicé la propuesta porque cambió el catálogo. Revísala en pantalla y dime qué quieres ajustar." : undefined,
        );
        return;
      }
      const cantidadNegocios = new Set(
        props.carritoGlobal.concat(actualizados).map(function (item) { return item.negocio_id; }),
      ).size;
      if (cantidadNegocios > 4) {
        throw new Error("El carrito admite hasta 4 negocios. Ajusta la propuesta para poder agregarla completa.");
      }
      props.onAddToCart(actualizados);
      confirmado = true;
      setPropuesta([]);
      agregarMensajeBot(
        "Listo, pasé la propuesta confirmada al carrito. Desde ahí puedes revisar el total y continuar al pago.",
      );
    } catch (error: any) {
      agregarMensajeBot(error?.message ?? "No pude confirmar la propuesta. Intenta de nuevo.");
    } finally {
      setCargando(false);
      if (!confirmado) confirmationLockRef.current = false;
    }
  }

  async function enviarMensaje(textoOriginal?: string) {
    const texto = (textoOriginal ?? input).trim();
    if (!texto || cargando) return;
    recognitionRef.current?.stop?.();
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
      await confirmarPropuesta();
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
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError || !authData.session?.access_token) {
        throw new Error("Tu sesión no está disponible. Vuelve a entrar para usar ChanguiBot.");
      }
      const response = await fetch("/api/gemini-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + authData.session.access_token,
        },
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
      confirmationLockRef.current = false;
      setPropuesta(propuestaNueva);
      agregarMensajeBot(
        String(data.reply ?? "¿Quieres ajustar algo de tu pedido?"),
        propuestaNueva.length > 0
          ? "Ya preparé tu propuesta. Revísala en pantalla; puedes pedirme cambios o agregar algo. Aún no la he pasado al carrito."
          : undefined,
      );
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
    conversation.stop();
    if (dictando) {
      recognitionRef.current?.stop?.();
      return;
    }
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
  const gruposPropuesta = Array.from(propuesta.reduce(function (groups, item) {
    const items = groups.get(item.negocio_id) ?? [];
    items.push(item);
    groups.set(item.negocio_id, items);
    return groups;
  }, new Map<string, PropuestaItem[]>()).values());

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
                  {gruposPropuesta.length === 1 ? "1 negocio" : gruposPropuesta.length + " negocios"}
                </div>
              </div>
              <button
                type="button"
                disabled={cargando}
                onClick={function () {
                  if (cargando) return;
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
            {gruposPropuesta.map(function (grupo) {
              const subtotalNegocio = grupo.reduce(function (sum, item) {
                return sum + item.precio * item.cantidad;
              }, 0);
              return (
                <div key={grupo[0].negocio_id} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "8px", marginTop: "4px" }}>
                  <h4 style={{ margin: "0 0 4px", fontSize: "12px", color: "var(--text-primary)" }}>{grupo[0].negocio}</h4>
                  {grupo.map(function (item) {
                    return (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "8px 0", fontSize: "12px", color: "var(--text-primary)" }}>
                        <span>{item.cantidad} × {item.nombre}</span>
                        <strong style={{ whiteSpace: "nowrap" }}>{dinero(item.precio * item.cantidad)}</strong>
                      </div>
                    );
                  })}
                  <div style={{ textAlign: "right", padding: "4px 0 8px", fontSize: "11px", color: "var(--text-secondary)" }}>
                    Subtotal de {grupo[0].negocio}: <strong>{dinero(subtotalNegocio)}</strong>
                  </div>
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
              {gruposPropuesta.length > 1 ? "El envío final puede incluir cargo por varios negocios y se calcula en el carrito." : "El envío se calcula después."} Nada se agrega hasta que lo confirmes.
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
        <div style={{ marginBottom: "10px", padding: "10px 12px", background: conversation.enabled ? "var(--color-blue-dim)" : "var(--color-green-dim)", borderRadius: "16px", border: "1px solid " + (conversation.enabled ? "var(--color-blue)" : "var(--border-subtle)") }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              aria-pressed={conversation.enabled}
              disabled={!conversation.enabled && (cargando || catalogoCargando)}
              onClick={function () {
                recognitionRef.current?.stop?.();
                if (conversation.enabled && conversation.status.includes("hablando")) {
                  conversation.interrupt();
                } else {
                  conversation.start();
                }
              }}
              style={{ padding: "10px 13px", borderRadius: "12px", background: conversation.enabled ? "var(--color-red)" : "var(--color-blue)", color: "#fff", fontSize: "12px", fontWeight: 800, whiteSpace: "nowrap" }}
            >
              {conversation.enabled ? conversation.status.includes("hablando") ? "Interrumpir y hablar" : "Terminar conversación" : "Conversar"}
            </button>
            <p role="status" style={{ margin: 0, fontSize: "11px", lineHeight: 1.4, color: "var(--text-secondary)" }}>
              {conversation.enabled ? conversation.status : "Respuestas cortas; puedes interrumpir mientras Changui habla."}
            </p>
          </div>
          {conversation.transcript && <p aria-live="polite" style={{ margin: "8px 0 0", fontSize: "12px", color: "var(--text-primary)" }}>{conversation.transcript}</p>}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={iniciarDictado}
            disabled={cargando || catalogoCargando}
            aria-label={dictando ? "Detener dictado" : "Dictar pedido"}
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
              cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {dictando ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={function (event) {
              if (conversation.enabled) conversation.stop();
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
          Voz en español del dispositivo, masculina si está disponible · El micrófono se apaga al cerrar · Confirmas antes de agregar
        </p>
      </div>
    </div>
  );
}
