import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AdminGodMode from "../../src/AdminGodMode";

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
