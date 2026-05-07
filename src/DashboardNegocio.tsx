```react
/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState, useEffect } from "react";
import { 
  Store, 
  ShoppingBag, 
  BarChart3, 
  Settings, 
  LogOut, 
  Clock, 
  CheckCircle, 
  Power,
  TrendingUp,
  MapPin,
  MessageCircle
} from "lucide-react";
import { supabase } from "./App";
import type { AppSession } from "./App";

interface DashboardNegocioProps {
  session: AppSession;
  onCerrarSesion: () => void;
  onVolver?: () => void;
}

interface MiNegocio {
  id: string;
  name: string;
  category: string;
  is_open: boolean;
  image_url: string;
  delivery_time: string;
}

interface Pedido {
  id: number;
  created_at: string;
  cliente_nombre: string;
  cliente_email: string;
  detalle: string;
  subtotal: number;
  total: number;
  estatus: "pendiente" | "preparando" | "en_camino" | "entregado" | "cancelado";
  direccion: string;
  forma_pago: string;
}

type Tab = "pedidos" | "estadisticas" | "ajustes";

export default function DashboardNegocio({ session, onCerrarSesion, onVolver }: DashboardNegocioProps) {
  const [negocio, setNegocio] = useState<MiNegocio | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("pedidos");

  // 1. Cargar el negocio ligado a este usuario
  useEffect(() => {
    async function loadNegocio() {
      try {
        const { data, error: err } = await supabase
          .from("merchants")
          .select("id, name, category, is_open, image_url, delivery_time")
          .eq("owner_email", session.user.email)
          .single();

        if (err) throw err;
        if (data) {
          setNegocio(data);
          loadPedidos(data.id);
        }
      } catch (e: any) {
        setError("No se encontró un negocio ligado a este correo. Contacta a Soporte Changuito.");
      } finally {
        setLoading(false);
      }
    }
    loadNegocio();
  }, [session.user.email]);

  // 2. Cargar los pedidos de este negocio
  async function loadPedidos(negocioId: string) {
    const { data } = await supabase
      .from("pedidos")
      .select("*")
      .eq("negocio_id", negocioId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setPedidos(data as Pedido[]);
  }

  // 3. Actualizar estado del pedido
  async function updateEstatusPedido(pedidoId: number, nuevoEstatus: string) {
    await supabase.from("pedidos").update({ estatus: nuevoEstatus }).eq("id", pedidoId);
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, estatus: nuevoEstatus as any } : p))
    );
  }

  // 4. Abrir/Cerrar Restaurante
  async function toggleStatus() {
    if (!negocio) return;
    const nuevoEstado = !negocio.is_open;
    await supabase.from("merchants").update({ is_open: nuevoEstado }).eq("id", negocio.id);
    setNegocio({ ...negocio, is_open: nuevoEstado });
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <div className="spinner" style={{ width: "40px", height: "40px", borderTopColor: "var(--color-yellow)" }} />
      </div>
    );
  }

  if (error || !negocio) {
    return (
      <div style={{ minHeight: "100vh", padding: "20px", background: "var(--bg-base)", color: "var(--text-primary)", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Store style={{ width: "64px", height: "64px", color: "var(--text-muted)", marginBottom: "20px" }} />
        <h2 style={{ marginBottom: "10px" }}>Acceso Restringido</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>{error}</p>
        <div style={{ display: "flex", gap: "10px" }}>
          {onVolver && (
            <button onClick={onVolver} style={{ padding: "12px 20px", borderRadius: "12px", border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}>
              Volver
            </button>
          )}
          <button onClick={onCerrarSesion} style={{ padding: "12px 20px", borderRadius: "12px", border: "none", background: "var(--color-yellow)", color: "#000", fontWeight: "bold", cursor: "pointer" }}>
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Cálculos de estadísticas rápidas
  const pedidosHoy = pedidos.filter(p => new Date(p.created_at).toDateString() === new Date().toDateString());
  const ventasHoy = pedidosHoy.reduce((acc, p) => acc + p.subtotal, 0);
  const pendientes = pedidos.filter(p => p.estatus === "pendiente" || p.estatus === "preparando");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", fontFamily: "system-ui,sans-serif", paddingBottom: "80px" }}>
      
      {/* HEADER DEL NEGOCIO */}
      <div style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)", padding: "20px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold", margin: "0 0 4px 0" }}>Panel de Control</p>
            <h1 style={{ fontSize: "24px", fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>{negocio.name}</h1>
          </div>
          <button 
            onClick={toggleStatus}
            style={{ 
              display: "flex", alignItems: "center", gap: "6px", 
              padding: "8px 12px", borderRadius: "20px", border: "none",
              background: negocio.is_open ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: negocio.is_open ? "#22c55e" : "#ef4444",
              fontWeight: "bold", cursor: "pointer", fontSize: "12px"
            }}
          >
            <Power style={{ width: "14px", height: "14px" }} />
            {negocio.is_open ? "ABIERTO" : "CERRADO"}
          </button>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: "10px", background: "var(--bg-base)", padding: "4px", borderRadius: "12px" }}>
          {[
            { id: "pedidos", label: "Órdenes", icon: ShoppingBag, count: pendientes.length },
            { id: "estadisticas", label: "Ventas", icon: BarChart3 },
            { id: "ajustes", label: "Ajustes", icon: Settings },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                padding: "10px", borderRadius: "10px", border: "none",
                background: tab === t.id ? "var(--color-yellow)" : "transparent",
                color: tab === t.id ? "#000" : "var(--text-muted)",
                fontWeight: tab === t.id ? 800 : 600, fontSize: "13px", cursor: "pointer"
              }}
            >
              <t.icon style={{ width: "16px", height: "16px" }} />
              {t.label}
              {t.count && t.count > 0 ? (
                <span style={{ background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: "10px", fontSize: "10px" }}>{t.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO TABS */}
      <div style={{ padding: "20px" }}>
        
        {/* --- TAB: PEDIDOS --- */}
        {tab === "pedidos" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px" }}>Órdenes Recientes</h2>
            {pedidos.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px 0" }}>No hay pedidos aún. ¡Prepárate!</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {pedidos.map(p => (
                  <div key={p.id} style={{ background: "var(--bg-card)", borderRadius: "16px", border: "1px solid var(--border-subtle)", padding: "16px", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--border-subtle)", paddingBottom: "12px", marginBottom: "12px" }}>
                      <div>
                        <span style={{ fontSize: "16px", fontWeight: 900 }}>#{p.id}</span>
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                          {new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <span style={{ 
                        fontSize: "11px", fontWeight: 800, padding: "6px 10px", borderRadius: "8px", textTransform: "uppercase",
                        background: p.estatus === "pendiente" ? "rgba(250,204,21,0.2)" : p.estatus === "preparando" ? "rgba(59,130,246,0.2)" : "rgba(34,197,94,0.2)",
                        color: p.estatus === "pendiente" ? "var(--color-yellow)" : p.estatus === "preparando" ? "#3b82f6" : "#22c55e"
                      }}>
                        {p.estatus.replace("_", " ")}
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: "16px" }}>
                      <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--text-primary)" }}>{p.detalle}</p>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "6px" }}><MapPin style={{width:"14px", height:"14px"}}/> {p.direccion}</p>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>💳 Pago: {p.forma_pago}</p>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                      <span style={{ fontSize: "18px", fontWeight: 900, color: "var(--color-yellow)" }}>${p.subtotal.toFixed(2)}</span>
                      
                      <div style={{ display: "flex", gap: "8px" }}>
                        {p.estatus === "pendiente" && (
                          <button onClick={() => updateEstatusPedido(p.id, "preparando")} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize:"13px" }}>
                            Aceptar Orden
                          </button>
                        )}
                        {p.estatus === "preparando" && (
                          <button onClick={() => updateEstatusPedido(p.id, "en_camino")} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize:"13px" }}>
                            Listo p/ Repartidor
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB: ESTADISTICAS --- */}
        {tab === "estadisticas" && (
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px" }}>Resumen de Hoy</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
              <div style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "16px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                <TrendingUp style={{ width: "24px", height: "24px", color: "var(--color-green)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 4px 0" }}>Ventas (Subtotal)</p>
                <p style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>${ventasHoy.toFixed(2)}</p>
              </div>
              <div style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "16px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                <CheckCircle style={{ width: "24px", height: "24px", color: "var(--color-yellow)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 4px 0" }}>Pedidos Hoy</p>
                <p style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-primary)", margin: 0 }}>{pedidosHoy.length}</p>
              </div>
            </div>

            <div style={{ background: "var(--color-yellow-dim)", border: "1px solid var(--color-yellow)", padding: "16px", borderRadius: "16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <MessageCircle style={{ width: "20px", height: "20px", color: "var(--color-yellow)", flexShrink: 0 }} />
              <p style={{ fontSize: "13px", color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>
                Próximamente habilitaremos el desglose mensual y la configuración de comisiones automatizada aquí mismo.
              </p>
            </div>
          </div>
        )}

        {/* --- TAB: AJUSTES --- */}
        {tab === "ajustes" && (
          <div>
             <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px" }}>Información del Negocio</h2>
             
             <div style={{ background: "var(--bg-card)", borderRadius: "16px", padding: "16px", border: "1px solid var(--border-subtle)" }}>
               <div style={{ marginBottom: "16px" }}>
                 <p style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "8px" }}>Tiempo de Preparación (Minutos)</p>
                 <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--bg-base)", padding: "12px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                    <Clock style={{ width: "16px", height: "16px", color: "var(--text-muted)" }} />
                    <span style={{ fontWeight: 600 }}>{negocio.delivery_time || "25-35 min"}</span>
                 </div>
               </div>

               <button disabled style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "var(--bg-base)", border: "1px dashed var(--border-subtle)", color: "var(--text-muted)", fontWeight: "bold", cursor: "not-allowed" }}>
                 Editar Menú (Próximamente)
               </button>
             </div>
          </div>
        )}
      </div>

      {/* FOOTER CERRAR SESION */}
      <div style={{ position: "fixed", bottom: 0, width: "100%", maxWidth: "480px", background: "var(--bg-card)", padding: "16px 20px", borderTop: "1px solid var(--border-subtle)" }}>
         <button onClick={onCerrarSesion} style={{ width: "100%", padding: "14px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", fontWeight: "bold", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer" }}>
           <LogOut style={{ width: "16px", height: "16px" }} />
           Cerrar Sesión del Negocio
         </button>
      </div>

    </div>
  );
}

```
