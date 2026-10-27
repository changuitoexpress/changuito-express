import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "../../src/App";
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

export function mountRevocablePanelHarness(
  container: HTMLElement,
  panel: "negocio" | "repartidor",
) {
  const client = supabase as any;
  const originalChannel = client.channel;
  const handlers: Array<{
    filter: { table?: string };
    callback: (payload: unknown) => void;
    active: boolean;
  }> = [];

  client.channel = function () {
    const registeredHandlers: typeof handlers = [];
    const channel = {
      on: function (
        _type: string,
        filter: { table?: string },
        callback: (payload: unknown) => void,
      ) {
        const handler = { filter, callback, active: true };
        registeredHandlers.push(handler);
        handlers.push(handler);
        return channel;
      },
      subscribe: function () {
        return channel;
      },
      unsubscribe: function () {
        registeredHandlers.forEach(function (handler) {
          handler.active = false;
        });
        return Promise.resolve("ok");
      },
      teardown: function () {},
    };
    return channel;
  };

  function emitRevocation() {
    const table = panel === "negocio" ? "merchant_admins" : "perfiles";
    const payload =
      panel === "negocio"
        ? {
            eventType: "DELETE",
            old: { user_id: "browser-fixture-business" },
            new: {},
          }
        : {
            eventType: "UPDATE",
            old: { id: "browser-fixture-delivery", rol: "repartidor" },
            new: { id: "browser-fixture-delivery", rol: "cliente" },
          };
    handlers.forEach(function (handler) {
      if (handler.active && handler.filter.table === table) {
        handler.callback(payload);
      }
    });
  }

  function RevocablePanelHarness() {
    const [showPanel, setShowPanel] = useState(true);
    useEffect(function () {
      return function () {
        client.channel = originalChannel;
      };
    }, []);

    if (!showPanel) {
      return <h1>¿Qué se te antoja?</h1>;
    }

    const user = panel === "negocio"
      ? {
          id: "browser-fixture-business",
          email: "business@example.test",
          nombre: "Browser Fixture Business",
          rol: "negocio",
        }
      : {
          id: "browser-fixture-delivery",
          email: "delivery@example.test",
          nombre: "Browser Fixture Delivery",
          rol: "repartidor",
        };
    const props = {
      session: { user },
      theme: "light" as const,
      onThemeToggle: function () {},
      onVolver: function () {
        setShowPanel(false);
      },
    };

    return (
      <>
        {panel === "negocio" ? (
          <DashboardNegocio {...props} />
        ) : (
          <RepasDashboard {...props} />
        )}
        <button type="button" onClick={emitRevocation}>
          Simulate access removal
        </button>
      </>
    );
  }

  const root = createRoot(container);
  root.render(<RevocablePanelHarness />);
  return root;
}
