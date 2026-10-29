/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useEffect, useRef, useState } from "react";
import { Plus, X, RefreshCw } from "lucide-react";
import { supabase } from "../supabase";
import { parseImageUrls, ProductImageCarousel } from "../ChanguiShopping";
import { scrollToSectionHeading } from "../sectionScroll";
import type { Merchant, CartItem } from "../Dashboard";

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

interface Props {
  merchants: Merchant[];
  cart: CartItem[];
  search: string;
  onUpdateCart: (cart: CartItem[]) => void;
  loadingMerchants: boolean;
}

function money(value: number) {
  return value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function isClosed(merchant: Merchant | undefined) {
  if (!merchant) return true;
  if (merchant.horario_apertura && merchant.horario_cierre) {
    const opening = merchant.horario_apertura.split(":").map(Number);
    const closing = merchant.horario_cierre.split(":").map(Number);
    const start = opening[0] * 60 + opening[1];
    const end = closing[0] * 60 + closing[1];
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return start <= end ? !(minute >= start && minute < end) : !(minute >= start || minute < end);
    }
  }
  return !merchant.is_open;
}

export default function SuperCatalog(props: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const mountedRef = useRef(true);
  const latestProps = useRef(props);
  latestProps.current = props;
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const merchantIds = props.merchants.map(function (merchant) { return merchant.id; }).sort().join(",");
  const accents = ["var(--color-green)", "var(--color-yellow)", "var(--color-red)", "var(--color-blue)"];

  useEffect(function () {
    let active = true;
    mountedRef.current = true;
    async function load() {
      setLoading(true);
      setError("");
      setProducts([]);
      if (!merchantIds) { setLoading(false); return; }
      try {
        const all: Product[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error: queryError } = await supabase.from("products")
            .select("id,merchant_id,name,description,price,image_url,category,is_available")
            .in("merchant_id", merchantIds.split(","))
            .eq("is_available", true).order("name").order("id").range(offset, offset + 499);
          if (!active) return;
          if (queryError) throw queryError;
          all.push(...(data ?? []));
          if ((data ?? []).length < 500) break;
        }
        if (active) setProducts(all);
      } catch {
        if (active) setError("No pude cargar los productos de Changui Súper. Intenta de nuevo.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return function () { active = false; mountedRef.current = false; };
  }, [merchantIds, retry]);

  useEffect(function () {
    if (!detail) return;
    openerRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDetail(null);
      if (event.key !== "Tab") return;
      const buttons = Array.from(modalRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return function () {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [detail?.id]);

  async function add(product: Product) {
    if (addingRef.current) return;
    addingRef.current = true;
    setAdding(true);
    setNotice("");
    try {
      const { data, error: queryError } = await supabase.from("products")
        .select("id,merchant_id,name,description,price,image_url,category,is_available")
        .eq("id", product.id).maybeSingle();
      if (!mountedRef.current) return;
      if (queryError || !data) throw new Error("No pude comprobar el producto. Intenta de nuevo.");
      if (!data.is_available) throw new Error("Este producto ya no está disponible.");
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0) throw new Error("Este producto no tiene un precio válido.");
      if (price !== Number(product.price)) {
        setProducts(function (previous) { return previous.map(function (item) { return item.id === product.id ? data : item; }); });
        if (detail?.id === product.id) setDetail(data);
        throw new Error("El precio cambió a " + money(price) + ". Revísalo y vuelve a agregar si estás de acuerdo.");
      }
      const currentCart = latestProps.current.cart;
      const merchant = latestProps.current.merchants.find(function (item) { return item.id === data.merchant_id; });
      if (!merchant) throw new Error("No pude identificar el negocio de este producto.");
      if (isClosed(merchant)) throw new Error("El negocio está cerrado por ahora. No agregué el producto.");
      const existing = currentCart.find(function (item) { return item.id === product.id; });
      if (!existing && new Set(currentCart.map(function (item) { return item.negocio_id; })).size >= 4 &&
          !currentCart.some(function (item) { return item.negocio_id === merchant.id; })) {
        throw new Error("Puedes pedir a un máximo de 4 negocios por carrito.");
      }
      latestProps.current.onUpdateCart(existing
        ? currentCart.map(function (item) { return item.id === product.id ? { ...item, precio: price, cantidad: item.cantidad + 1 } : item; })
        : [...currentCart, { id: product.id, nombre: data.name, precio: price, cantidad: 1,
          negocio: merchant.name, negocio_id: merchant.id, phone_number: merchant.phone_number ?? "522223339999", tipo: "producto" }]);
      setNotice("Agregaste " + data.name + " al carrito.");
      setDetail(null);
    } catch (cause: any) {
      setNotice(cause.message ?? "No pude agregar el producto.");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }

  const categories = ["Todos", ...Array.from(new Set(products.map(function (product) { return product.category?.trim() || "Otros"; })))];
  const filtered = products.filter(function (product) {
    return (category === "Todos" || (product.category?.trim() || "Otros") === category) &&
      product.name.toLocaleLowerCase("es").includes(props.search.trim().toLocaleLowerCase("es"));
  });
  const detailClosed = detail ? isClosed(props.merchants.find(function (merchant) { return merchant.id === detail.merchant_id; })) : false;
  const buttonStyle: React.CSSProperties = { padding: "12px 16px", borderRadius: "14px", background: "var(--color-green)", color: "#fff", fontWeight: 800 };

  return (
    <section aria-label="Catálogo de Changui Súper" style={{ padding: "18px 16px 45px" }}>
      <div style={{ background: "linear-gradient(125deg,#138548,#087f8c)", padding: "24px", borderRadius: "24px", color: "#fff", position: "relative", overflow: "hidden" }}>
        <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: ".16em", fontWeight: 800, color: "#ffdf69" }}>Tu súper, sin vueltas</span>
        <h1 style={{ margin: "8px 0", fontSize: "28px", letterSpacing: "-.05em" }}>Changui Súper</h1>
        <p style={{ fontSize: "13px", lineHeight: 1.6, maxWidth: "270px" }}>Elige tus productos aquí. Nosotros te los acercamos.</p>
        <div aria-hidden="true" style={{ display: "flex", gap: "6px", marginTop: "18px" }}>
          {accents.map(function (color) { return <span key={color} style={{ width: "32px", height: "5px", borderRadius: "8px", background: color }} />; })}
        </div>
      </div>
      {!loading && !error && <nav aria-label="Categorías de Changui Súper" style={{ display: "flex", overflowX: "auto", gap: "8px", padding: "20px 0" }}>
        {categories.map(function (item, index) {
          return <button key={item} aria-pressed={item === category} onClick={function () {
            setCategory(item);
            requestAnimationFrame(function () { scrollToSectionHeading("super-products-heading"); });
          }} style={{ padding: "10px 17px", whiteSpace: "nowrap", borderRadius: "14px", border: "1px solid " + accents[index % 4],
            background: category === item ? accents[index % 4] : "var(--bg-card)", color: category === item ? (index % 4 === 1 ? "#19251d" : "#fff") : "var(--text-primary)", fontWeight: 750, fontSize: "12px" }}>{item}</button>;
        })}
      </nav>}
      <h2 id="super-products-heading" style={{ fontSize: "21px", margin: "16px 0", letterSpacing: "-.03em" }}>{category === "Todos" ? "Todos los productos" : category}</h2>
      <p role="status" style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "14px" }}>{notice}</p>
      {loading || props.loadingMerchants ? <p role="status">Cargando productos…</p> : error ? <div role="alert"><p>{error}</p><button onClick={function () { setRetry(retry + 1); }} style={{ ...buttonStyle, marginTop: "12px" }}><RefreshCw size={14} /> Reintentar</button></div> :
        filtered.length === 0 ? <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>No hay productos disponibles para esta selección.</p> :
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "12px" }}>
            {filtered.map(function (product, index) {
              const photos = parseImageUrls(product.image_url);
              const closed = isClosed(props.merchants.find(function (merchant) { return merchant.id === product.merchant_id; }));
              return <article key={product.id} style={{ background: "var(--bg-card)", borderRadius: "20px", overflow: "hidden", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}>
                <button aria-label={"Ver " + product.name} onClick={function () { setDetail(product); }} style={{ width: "100%", textAlign: "left", color: "var(--text-primary)" }}>
                  <div style={{ aspectRatio: "1 / 1", background: "#F5F5F5", display: "grid", placeItems: "center", fontSize: "46px" }}>
                    {photos.length > 0 ? <img loading="lazy" src={photos[0]} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", aspectRatio: "1 / 1" }} /> : <span aria-label="Sin fotografía">🐒</span>}
                  </div>
                  <h3 style={{ padding: "12px 12px 4px", fontSize: "14px", lineHeight: 1.4 }}>{product.name}</h3>
                  {closed && <p style={{ padding: "0 12px", fontSize: "11px", color: "var(--text-secondary)" }}>Cerrado por ahora</p>}
                </button>
                <div style={{ display: "flex", gap: "6px", justifyContent: "space-between", alignItems: "center", padding: "10px 12px 14px" }}>
                  <strong style={{ fontSize: "15px" }}>{money(Number(product.price))}</strong>
                  <button disabled={adding || closed} aria-label={"Agregar " + product.name + " al carrito"} onClick={function () { void add(product); }} style={{ width: "34px", height: "34px", borderRadius: "12px", display: "grid", placeItems: "center", cursor: closed || adding ? "not-allowed" : "pointer", background: closed ? "var(--border-medium)" : accents[index % 4], color: closed ? "var(--text-secondary)" : index % 4 === 1 ? "#19251d" : "#fff" }}><Plus size={18} /></button>
                </div>
              </article>;
            })}
          </div>}
      {detail && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 250, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "12px" }} onClick={function (event) { if (event.target === event.currentTarget) setDetail(null); }}>
        <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="super-detail-name" style={{ width: "100%", maxWidth: "460px", maxHeight: "85dvh", overflowY: "auto", padding: "20px", background: "var(--bg-card)", borderRadius: "24px" }}>
          <button aria-label="Cerrar detalle de producto" onClick={function () { setDetail(null); }} style={{ display: "block", marginLeft: "auto", padding: "10px", color: "var(--text-primary)" }}><X size={20} /></button>
          <ProductImageCarousel key={detail.id} urls={parseImageUrls(detail.image_url)} alt={detail.name} />
          <h2 id="super-detail-name" style={{ fontSize: "23px" }}>{detail.name}</h2>
          <p style={{ color: "var(--text-secondary)", margin: "12px 0", lineHeight: 1.5 }}>{detail.description}</p>
          <p style={{ fontWeight: 850, fontSize: "23px", marginBottom: "16px" }}>{money(Number(detail.price))}</p>
          <p role="status" style={{ fontSize: "13px", marginBottom: "12px" }}>{notice}</p>
          <button disabled={adding || detailClosed} onClick={function () { void add(detail); }} style={{ ...buttonStyle, width: "100%", opacity: detailClosed ? .5 : 1 }}>{detailClosed ? "Cerrado por ahora" : adding ? "Revisando…" : "Agregar al carrito"}</button>
        </div>
      </div>}
    </section>
  );
}
