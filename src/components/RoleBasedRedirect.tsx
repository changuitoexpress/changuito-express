/* eslint-disable */
import React from "react";
import { LogOut, Clock } from "lucide-react";
// IMPORTANTE: Se agregaron los dos puntos (../) para buscar el archivo fuera de la carpeta components
import DashboardMarketplace from "../Dashboard";

interface UserSession {
  user: { id: string; email?: string };
}

interface Props {
  session: UserSession;
  rol: string;
  onSignOut: () => void;
  renderAdmin: () => React.ReactNode;
}

// Pantalla placeholder para roles aún sin dashboard propio
function ProximamenteDashboard(props: {
  titulo: string;
  descripcion: string;
  color: string;
  onSignOut: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        fontFamily: "system-ui,sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "20px",
          background: props.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 8px 32px ${props.color}44`,
        }}
      >
        <Clock style={{ width: "32px", height: "32px", color: "#020617" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 900,
            color: "white",
            margin: "0 0 8px 0",
          }}
        >
          {props.titulo}
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "rgba(255,255,255,0.35)",
            margin: "0 0 24px 0",
            maxWidth: "300px",
            lineHeight: 1.6,
          }}
        >
          {props.descripcion}
        </p>
        <p
          style={{
            fontSize: "11px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: props.color,
            fontWeight: 700,
          }}
        >
          Panel en construcción · Próximamente
        </p>
      </div>
      <button
        onClick={props.onSignOut}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          borderRadius: "14px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.4)",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <LogOut style={{ width: "14px", height: "14px" }} />
        Cerrar Sesión
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RoleBasedRedirect — enruta según el rol del usuario
// ─────────────────────────────────────────────────────────────────────────────
export default function RoleBasedRedirect(props: Props) {
  const { session, rol, onSignOut, renderAdmin } = props;

  switch (rol) {
    case "admin":
      return <>{renderAdmin()}</>;

    case "restaurante":
      return (
        <ProximamenteDashboard
          titulo="Panel de Restaurante"
          descripcion="Acá vas a gestionar tu menú, tus pedidos activos y las reseñas de tus clientes."
          color="#4ade80"
          onSignOut={onSignOut}
        />
      );

    case "repartidor":
      return (
        <ProximamenteDashboard
          titulo="Panel de Repartidor"
          descripcion="Acá vas a ver tus pedidos asignados, tu mapa de entregas y tus estadísticas de recorrido."
          color="#60a5fa"
          onSignOut={onSignOut}
        />
      );

    case "vendedor_bazar":
      return (
        <ProximamenteDashboard
          titulo="Panel del Bazar"
          descripcion="Acá vas a gestionar tus productos, stock, ventas y los mensajes de tus compradores."
          color="#c084fc"
          onSignOut={onSignOut}
        />
      );

    case "cliente":
    default:
      return <DashboardMarketplace session={session} onSignOut={onSignOut} />;
  }
}
