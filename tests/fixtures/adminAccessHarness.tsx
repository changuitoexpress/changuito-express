import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AdminGodMode from "../../src/AdminGodMode";
import DashboardNegocio from "../../src/DashboardNegocio";
import RepasDashboard from "../../src/RepasDashboard";

export function mountAdminAccessHarness(container: HTMLElement) {
  function AdminAccessHarness() {
    const [showAdmin, setShowAdmin] = useState(true);
    if (!showAdmin) {
      return <h1>¿Qué se te antoja?</h1>;
    }

    return (
      <AdminGodMode
        session={{
          user: {
            id: "browser-fixture-customer",
            email: "customer@example.test",
            nombre: "Browser Fixture Customer",
            rol: "cliente",
          },
        }}
        theme="light"
        onThemeToggle={function () {}}
        onVolver={function () {
          setShowAdmin(false);
        }}
      />
    );
  }

  const root = createRoot(container);
  root.render(<AdminAccessHarness />);
  return root;
}

export function mountRestrictedPanelHarness(
  container: HTMLElement,
  panel: "negocio" | "repartidor",
) {
  function RestrictedPanelHarness() {
    const [showPanel, setShowPanel] = useState(true);
    if (!showPanel) {
      return <h1>¿Qué se te antoja?</h1>;
    }

    const props = {
      session: {
        user: {
          id: "browser-fixture-customer",
          email: "customer@example.test",
          nombre: "Browser Fixture Customer",
          rol: "cliente",
        },
      },
      theme: "light" as const,
      onThemeToggle: function () {},
      onVolver: function () {
        setShowPanel(false);
      },
    };

    return panel === "negocio" ? (
      <DashboardNegocio {...props} />
    ) : (
      <RepasDashboard {...props} />
    );
  }

  const root = createRoot(container);
  root.render(<RestrictedPanelHarness />);
  return root;
}
