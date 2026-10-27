import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, it } from "node:test";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseUrl = "https://fixture.supabase.co";
const fixtureUserId = "browser-fixture-user";
const fixtureMerchant = {
  id: "browser-fixture-merchant",
  name: "Browser Fixture Store",
  category: "restaurante",
  rating: 5,
  delivery_time: "30 min",
  image_url: null,
  is_open: true,
  phone_number: "5550000000",
  description: "Isolated browser fixture",
};

async function findAvailablePort(): Promise<number> {
  return new Promise(function (resolve, reject) {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", function () {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a local test port."));
        return;
      }
      const port = address.port;
      server.close(function () {
        resolve(port);
      });
    });
  });
}

async function waitForServer(url: string, server: ReturnType<typeof spawn>) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (code ${server.exitCode}).`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(function (resolve) {
      setTimeout(resolve, 200);
    });
  }
  throw new Error("Vite did not become ready within 30 seconds.");
}

async function mockSupabase(
  page: import("playwright").Page,
  role: "admin" | "cliente" | "negocio" | "repartidor" = "admin",
  userId = fixtureUserId,
  email = "uliseseven.7@gmail.com",
  requestLog?: string[],
  requestDetails?: Array<{ method: string; path: string }>,
) {
  const mockState = {
    role,
    businessMembership: true,
  };
  const deviceSessions = [
    {
      session_id: "11111111-1111-4111-8111-111111111111",
      user_agent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
      created_at: "2026-10-26T10:00:00.000Z",
      updated_at: "2026-10-27T10:00:00.000Z",
      is_current: true,
    },
    {
      session_id: "22222222-2222-4222-8222-222222222222",
      user_agent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Firefox/132.0",
      created_at: "2026-10-25T08:00:00.000Z",
      updated_at: "2026-10-26T08:00:00.000Z",
      is_current: false,
    },
  ];
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());
    requestLog?.push(url.pathname);
    requestDetails?.push({ method: request.method(), path: url.pathname });
    const acceptsObject = request.headers().accept?.includes(
      "application/vnd.pgrst.object+json",
    );
    let data: unknown = [];
    let responseHeaders: Record<string, string> = {};

    if (
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "refresh_token"
    ) {
      data = {
        ...createFixtureSession(userId, email),
        access_token: "browser-fixture-refreshed-access-token",
      };
    } else if (url.pathname === "/auth/v1/user") {
      data = {
        id: userId,
        email,
        user_metadata: {},
        app_metadata: { provider: "email", providers: ["email"] },
      };
    } else if (url.pathname === "/rest/v1/perfiles") {
      data = {
        nombre:
          mockState.role === "admin"
            ? "Browser Fixture Admin"
            : mockState.role === "negocio"
              ? "Browser Fixture Business"
              : mockState.role === "repartidor"
                ? "Browser Fixture Delivery"
                : "Browser Fixture Customer",
        rol: mockState.role,
      };
    } else if (
      url.pathname === "/rest/v1/merchant_admins" &&
      (mockState.role === "admin" || mockState.role === "negocio")
    ) {
      data = mockState.businessMembership
        ? { merchant_id: fixtureMerchant.id }
        : acceptsObject
          ? null
          : [];
    } else if (url.pathname === "/rest/v1/merchants") {
      const ownerLookup = url.searchParams.has("owner_id");
      const isBusinessOwner = mockState.role === "negocio" && mockState.businessMembership;
      data = ownerLookup
        ? isBusinessOwner
          ? acceptsObject
            ? fixtureMerchant
            : [fixtureMerchant]
          : acceptsObject
            ? null
            : []
        : mockState.role === "cliente"
          ? acceptsObject
            ? null
            : []
          : acceptsObject
            ? fixtureMerchant
            : [fixtureMerchant];
    } else if (
      url.pathname === "/rest/v1/pedidos" &&
      request.method() === "GET" &&
      mockState.role === "repartidor"
    ) {
      data = [
        {
          id: "browser-fixture-order",
          negocio_nombre: "Browser Fixture Delivery Order",
          cliente_email: "customer@example.test",
          detalle: "Delivery-only customer order details",
          direccion: "Delivery-only street address",
          total_pagar: 150,
          estatus: "en_camino",
          forma_pago: "efectivo",
          canal: "web",
          created_at: "2026-10-27T10:00:00.000Z",
          repartidor_id: userId,
        },
      ];
    } else if (
      url.pathname === "/rest/v1/pedidos" &&
      request.method() === "HEAD" &&
      url.searchParams.get("estatus") === "eq.entregado"
    ) {
      data = null;
      responseHeaders = {
        "content-range": "*/10",
        "access-control-expose-headers": "content-range",
      };
    } else if (url.pathname === "/rest/v1/monedero_cliente" && acceptsObject) {
      data = {
        id: "browser-fixture-wallet",
        user_id: fixtureUserId,
        saldo_cashback: 0,
        pedidos_realizados: 0,
        envios_gratis_usados: 0,
      };
    } else if (url.pathname === "/storage/v1/object/public/changuito-fotos") {
      data = {};
    } else if (url.pathname === "/rest/v1/rpc/list_my_device_sessions") {
      data = deviceSessions;
    } else if (url.pathname === "/rest/v1/rpc/revoke_my_device_session") {
      const body = request.postDataJSON() as { p_session_id?: string };
      const sessionIndex = deviceSessions.findIndex(function (session) {
        return session.session_id === body.p_session_id && !session.is_current;
      });
      if (sessionIndex >= 0) deviceSessions.splice(sessionIndex, 1);
      data = sessionIndex >= 0;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: responseHeaders,
      body: JSON.stringify(data),
    });
  });
  return mockState;
}

function createFixtureSession(
  userId: string,
  email: string,
  expiresInSeconds = 3600,
) {
  return {
    access_token: "browser-fixture-access-token",
    token_type: "bearer",
    expires_in: expiresInSeconds,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
    refresh_token: "browser-fixture-refresh-token",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

async function tabToLocator(
  page: import("playwright").Page,
  locator: import("playwright").Locator,
  maxTabs = 40,
) {
  for (let tab = 0; tab < maxTabs; tab += 1) {
    if (await locator.evaluate(function (element) {
      return document.activeElement === element;
    })) {
      return;
    }
    await page.keyboard.press("Tab");
  }

  assert.equal(
    await locator.evaluate(function (element) {
      return document.activeElement === element;
    }),
    true,
    "Keyboard tabbing should reach the requested control.",
  );
}

async function assertWithinViewport(locator: import("playwright").Locator) {
  const bounds = await locator.evaluate(function (element) {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  assert.ok(
    bounds.left >= 0 &&
      bounds.right <= bounds.viewportWidth &&
      bounds.top >= 0 &&
      bounds.bottom <= bounds.viewportHeight,
    "The dashboard tab control should fit within the phone viewport.",
  );
}

async function waitForScreenAnnouncement(
  page: import("playwright").Page,
  expected: string,
) {
  await page.waitForFunction(function (announcement) {
    return (
      document.querySelector('[role="status"]')?.textContent?.trim() ===
      announcement
    );
  }, expected);
}

it("renders every authenticated screen and returns to the dashboard", async function (t) {
  const port = await findAvailablePort();
  const appUrl = `http://127.0.0.1:${port}`;
  const vite = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: "browser-fixture-anon-key",
      },
      stdio: "ignore",
    },
  );

  let browser: import("playwright").Browser | undefined;
  t.after(async function () {
    if (browser) await browser.close();
    vite.kill("SIGTERM");
  });

  await waitForServer(appUrl, vite);

  const browserExecutable =
    process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(browserExecutable) ? { executablePath: browserExecutable } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext();
  const session = createFixtureSession(
    fixtureUserId,
    "uliseseven.7@gmail.com",
    4 * 60,
  );
  await context.addInitScript(
    function (storedSession) {
      localStorage.setItem("sb-fixture-auth-token", JSON.stringify(storedSession));
      localStorage.setItem("changuito-theme", "light");
    },
    session,
  );
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", function (error) {
    pageErrors.push(error.message);
  });
  await mockSupabase(page);
  await page.goto(appUrl);

  await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();
  const expiryWarning = page.getByRole("alert");
  await expiryWarning.waitFor({ state: "visible" });
  assert.equal(
    await expiryWarning.innerText(),
    "Tu sesión está por vencer. Guardá tu trabajo; es posible que tengas que iniciar sesión nuevamente.",
    "The signed-in session expiry warning should clearly explain the upcoming expiry.",
  );

  const refreshedExpiry = await page.evaluate(async function () {
    const app = await import("/src/App.tsx");
    const { data, error } = await app.supabase.auth.refreshSession();
    if (error) throw error;
    return data.session?.expires_at;
  });
  assert.ok(
    typeof refreshedExpiry === "number" && refreshedExpiry > session.expires_at,
    "The fixture should provide a renewed session with a later expiry.",
  );
  await expiryWarning.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Abrir menú" }).click();
  const deviceMenu = page.getByRole("dialog", { name: "Menú de navegación" });
  await deviceMenu.getByRole("button", { name: /Dispositivos conectados/ }).click();
  await page.getByText("Chrome · Windows", { exact: true }).waitFor();
  await page.getByText("Firefox · Mac", { exact: true }).waitFor();
  await page.getByText("Última actividad:", { exact: false }).first().waitFor();
  const remoteDeviceCard = page
    .getByRole("listitem")
    .filter({ hasText: "Firefox · Mac" });
  page.once("dialog", function (dialog) {
    void dialog.accept();
  });
  await remoteDeviceCard.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByText("La sesión se revocó.", { exact: false }).waitFor();
  await page.getByText("Firefox · Mac", { exact: true }).waitFor({
    state: "detached",
  });
  await page.getByRole("button", { name: "Cerrar menú" }).click();

  const screens = [
    {
      menuLabel: "ChangoMonedero",
      marker: "ChangoMonedero",
      announcement: "ChangoMonedero",
    },
    {
      menuLabel: "Bazar Vecinal",
      marker: "Bazar Vecinal",
      announcement: "Bazar Vecinal",
    },
    {
      menuLabel: "Directorio Telefónico",
      marker: "Directorio Telefónico",
      announcement: "Directorio Telefónico",
    },
    {
      menuLabel: "ChanguiShopping",
      marker: "ChanguiShopping",
      announcement: "ChanguiShopping",
    },
    {
      menuLabel: "Bienes Raíces",
      marker: "Bienes Raíces",
      announcement: "Bienes Raíces",
    },
    {
      menuLabel: "Venta de Autos",
      marker: "Venta de Autos",
      announcement: "Venta de Autos",
    },
    {
      menuLabel: "Panel de Negocios",
      marker: "Browser Fixture Store",
      announcement: "Panel de Negocios",
    },
    {
      menuLabel: "Panel Repartidor",
      marker: "Repartidor",
      announcement: "Panel Repartidor",
    },
    {
      menuLabel: "God Mode",
      marker: "Panel de Control",
      announcement: "Panel de Control",
    },
  ];

  for (const screen of screens) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("button", { name: new RegExp(screen.menuLabel) }).click();
    await waitForScreenAnnouncement(page, screen.announcement);
    await page.getByText(screen.marker, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await page.locator("button").first().click();
    await waitForScreenAnnouncement(page, "Inicio");
    await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor({
      timeout: 10_000,
    });
  }

  for (const screen of screens) {
    await page.evaluate(function () {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    const menuTrigger = page.getByRole("button", { name: "Abrir menú" });
    await tabToLocator(page, menuTrigger);
    await page.keyboard.press("Enter");

    const menu = page.getByRole("dialog", { name: "Menú de navegación" });
    await menu.waitFor({ state: "visible" });
    const closeMenuButton = menu.getByRole("button", { name: "Cerrar menú" });
    assert.equal(
      await closeMenuButton.evaluate(function (element) {
        return document.activeElement === element;
      }),
      true,
      "Opening the menu should move keyboard focus into the drawer.",
    );
    const targetMenuItem = menu.getByRole("button", {
      name: new RegExp(screen.menuLabel),
    });
    await tabToLocator(page, targetMenuItem);
    await page.keyboard.press("Enter");

    await waitForScreenAnnouncement(page, screen.announcement);
    await page.getByText(screen.marker, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 10_000,
    });
    const returnButton = page.locator("button").first();
    await page.evaluate(function () {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await tabToLocator(page, returnButton);
    await page.keyboard.press("Enter");
    await waitForScreenAnnouncement(page, "Inicio");
    await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor({
      timeout: 10_000,
    });
  }

  await page.evaluate(function () {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  const escapeMenuTrigger = page.getByRole("button", { name: "Abrir menú" });
  await tabToLocator(page, escapeMenuTrigger);
  await page.keyboard.press("Enter");

  const escapeMenu = page.getByRole("dialog", { name: "Menú de navegación" });
  await escapeMenu.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await escapeMenu.waitFor({ state: "hidden" });
  assert.equal(
    await escapeMenuTrigger.evaluate(function (element) {
      return document.activeElement === element;
    }),
    true,
    "Pressing Escape should close the menu and restore focus to its trigger.",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  for (const screen of screens) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("button", { name: new RegExp(screen.menuLabel) }).click();
    await waitForScreenAnnouncement(page, screen.announcement);
    await page.getByText(screen.marker, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await page.locator("button").first().click();
    await waitForScreenAnnouncement(page, "Inicio");
    await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor({
      timeout: 10_000,
    });
  }

  await page.evaluate(function () {
    window.scrollTo(0, 0);
  });
  await page.setViewportSize({ width: 320, height: 700 });
  const dashboardTabs = [
    {
      label: /🍽️ Restaurantes/,
      content: page.getByRole("heading", { name: "Restaurantes", exact: true }),
    },
    {
      label: /🛵 Mandaditos/,
      content: page.getByRole("heading", { name: "🛵 Mandaditos", exact: true }),
    },
    {
      label: /🛒 Tiendita/,
      content: page.getByRole("heading", { name: /Tiendita Changuito/ }),
    },
    {
      label: /🍽️ Restaurantes/,
      content: page.getByRole("heading", { name: "Restaurantes", exact: true }),
    },
  ];

  for (const tab of dashboardTabs) {
    const tabButton = page.getByRole("button", { name: tab.label }).first();
    await tabButton.waitFor({ state: "visible" });
    await assertWithinViewport(tabButton);
    const tabRow = tabButton.locator("..");
    const rowDimensions = await tabRow.evaluate(function (element) {
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    });
    assert.ok(
      rowDimensions.scrollWidth <= rowDimensions.clientWidth,
      "All dashboard tabs should fit without horizontal overflow at 320px.",
    );
    await tabButton.click();
    await tab.content.waitFor({ state: "visible", timeout: 10_000 });
  }

  const drawerSections = [
    {
      label: "Restaurantes",
      content: page.getByRole("heading", { name: "Restaurantes", exact: true }),
    },
    {
      label: "Mandaditos",
      content: page.getByRole("heading", { name: "🛵 Mandaditos", exact: true }),
    },
    {
      label: "La Tiendita",
      content: page.getByRole("heading", { name: /Tiendita Changuito/ }),
    },
  ];

  for (const section of drawerSections) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const navigationMenu = page.getByRole("dialog", {
      name: "Menú de navegación",
    });
    await navigationMenu
      .getByRole("button", { name: section.label, exact: true })
      .click();
    await navigationMenu.waitFor({ state: "hidden" });
    await section.content.waitFor({ state: "visible", timeout: 10_000 });

    await page.getByRole("button", { name: "Abrir menú" }).click();
    const returnMenu = page.getByRole("dialog", {
      name: "Menú de navegación",
    });
    await returnMenu
      .getByRole("button", { name: "Restaurantes", exact: true })
      .click();
    await returnMenu.waitFor({ state: "hidden" });
    await page
      .getByRole("heading", { name: "Restaurantes", exact: true })
      .waitFor({ state: "visible", timeout: 10_000 });
  }

  const customerId = "browser-fixture-customer";
  const customerEmail = "customer@example.test";
  const customerContext = await browser.newContext();
  await customerContext.addInitScript(
    function (storedSession) {
      localStorage.setItem("sb-fixture-auth-token", JSON.stringify(storedSession));
      localStorage.setItem("changuito-theme", "light");
    },
    createFixtureSession(customerId, customerEmail),
  );
  const customerPage = await customerContext.newPage();
  customerPage.on("pageerror", function (error) {
    pageErrors.push(error.message);
  });
  const merchantAdminLookup = customerPage.waitForResponse(function (response) {
    return response.url().includes("/rest/v1/merchant_admins");
  });
  const customerBackendRequests: string[] = [];
  await mockSupabase(
    customerPage,
    "cliente",
    customerId,
    customerEmail,
    customerBackendRequests,
  );
  await customerPage.goto(appUrl);
  await customerPage.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();
  await merchantAdminLookup;

  const checkoutCart = [
    {
      id: "checkout-fixture-product",
      nombre: "Fixture meal",
      precio: 125,
      cantidad: 1,
      negocio: "Browser Fixture Store",
      negocio_id: fixtureMerchant.id,
      phone_number: fixtureMerchant.phone_number,
      tipo: "producto",
    },
  ];
  await customerPage.evaluate(
    function (fixture) {
      localStorage.setItem("changuito-cart", JSON.stringify(fixture.cart));
      localStorage.setItem(
        fixture.draftKey,
        JSON.stringify({
          savedAt: Date.now(),
          values: {
            cartSignature: "checkout-fixture-product:1",
            paso: "direccion",
            dirSeleccionadaId: null,
            formaNueva: true,
            alias: "Saved home",
            calle: "Fixture Avenue",
            numero: "42",
            referencias: "Blue gate",
            preferencias: "Call on arrival",
            formaPago: "tarjeta",
            fraccionamientoId: null,
            fracSearch: "",
          },
        }),
      );
    },
    {
      cart: checkoutCart,
      draftKey:
        "changuito-form-draft:" +
        encodeURIComponent(customerId) +
        ":customer-checkout",
    },
  );
  await customerPage.reload();
  await customerPage.getByRole("heading", { name: "¿Dónde entregamos?" }).waitFor();
  assert.equal(
    await customerPage.getByPlaceholder("Casa, Trabajo").inputValue(),
    "Saved home",
    "Reauthenticated checkout should restore the saved delivery alias.",
  );
  assert.equal(
    await customerPage.getByPlaceholder("Av. Principal").inputValue(),
    "Fixture Avenue",
    "Reauthenticated checkout should restore the saved address.",
  );
  assert.equal(
    await customerPage.getByPlaceholder("#123, Depto #123").inputValue(),
    "42",
  );
  const checkoutDraftKey =
    "changuito-form-draft:" +
    encodeURIComponent(customerId) +
    ":customer-checkout";
  await customerPage.evaluate(function (draftKey) {
    const stored = localStorage.getItem(draftKey);
    if (!stored) throw new Error("The saved checkout draft was not found.");
    const draft = JSON.parse(stored);
    draft.values.paso = "resumen";
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, checkoutDraftKey);
  await customerPage.reload();
  await customerPage.getByRole("heading", { name: "Resumen del pedido" }).waitFor();
  const freeShippingOption = customerPage.getByRole("checkbox", {
    name: /Tu envío gratis está disponible/,
  });
  await freeShippingOption.waitFor();
  assert.equal(
    await freeShippingOption.isChecked(),
    true,
    "Checkout should automatically select a reward earned through 10 delivered orders.",
  );
  await customerPage.getByText("−$50.00", { exact: true }).waitFor();
  await customerPage
    .getByText("Envío", { exact: true })
    .locator("..")
    .getByText("$0.00", { exact: true })
    .waitFor();
  await freeShippingOption.uncheck();
  await customerPage.getByText("$50.00", { exact: true }).waitFor();
  await customerPage.getByText("$175.00", { exact: true }).waitFor();

  await customerPage.evaluate(function (draftKey) {
    localStorage.removeItem("changuito-cart");
    localStorage.removeItem(draftKey);
  }, checkoutDraftKey);
  await customerPage.reload();
  await customerPage.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();
  await customerPage.getByRole("button", { name: "Abrir menú" }).click();

  for (const restrictedMenuLabel of [
    "Panel de Negocios",
    "Panel Repartidor",
    "God Mode",
  ]) {
    assert.equal(
      await customerPage.getByRole("button", { name: new RegExp(restrictedMenuLabel) }).count(),
      0,
      `Regular users should not see the ${restrictedMenuLabel} menu entry.`,
    );
  }

  await customerPage.getByRole("button", { name: "Cerrar menú" }).click();
  await customerPage.evaluate(async function () {
    const fixture = await import("/tests/fixtures/adminAccessHarness.tsx");
    const container = document.createElement("div");
    container.id = "admin-access-fixture";
    document.body.append(container);
    fixture.mountAdminAccessHarness(container);
  });

  const adminAccessFixture = customerPage.locator("#admin-access-fixture");
  await adminAccessFixture.getByText("Acceso restringido", { exact: true }).waitFor();
  await adminAccessFixture.getByRole("button", { name: "Volver" }).click();
  await adminAccessFixture.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();

  for (const panel of ["negocio", "repartidor"] as const) {
    const panelRequestsStart = customerBackendRequests.length;
    await customerPage.evaluate(async function (panelName) {
      const fixture = await import("/tests/fixtures/adminAccessHarness.tsx");
      const container = document.createElement("div");
      container.id = `restricted-${panelName}-fixture`;
      document.body.append(container);
      fixture.mountRestrictedPanelHarness(container, panelName);
    }, panel);

    const panelFixture = customerPage.locator(`#restricted-${panel}-fixture`);
    await panelFixture.getByText("Acceso restringido", { exact: true }).waitFor();
    await panelFixture.getByRole("button", { name: "Volver" }).click();
    await panelFixture.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();
    await panelFixture.evaluate(function (element) {
      element.remove();
    });

    const newPanelRequests = customerBackendRequests.slice(panelRequestsStart);
    assert.equal(
      newPanelRequests.some(function (requestPath) {
        return requestPath === "/rest/v1/products" || requestPath === "/rest/v1/pedidos";
      }),
      false,
      `A regular customer must not load business or delivery data from the ${panel} panel.`,
    );
  }

  for (const account of [
    {
      role: "negocio" as const,
      userId: "browser-fixture-business",
      email: "business@example.test",
      menuLabel: "Panel de Negocios",
      panelMarker: "Browser Fixture Store",
      panel: "negocio" as const,
      requiredRequests: [
        "/rest/v1/merchant_admins",
        "/rest/v1/merchants",
        "/rest/v1/products",
      ],
    },
    {
      role: "repartidor" as const,
      userId: "browser-fixture-delivery",
      email: "delivery@example.test",
      menuLabel: "Panel Repartidor",
      panelMarker: "Browser Fixture Delivery",
      panel: "repartidor" as const,
      requiredRequests: ["/rest/v1/pedidos"],
    },
  ]) {
    const roleContext = await browser.newContext();
    await roleContext.addInitScript(
      function (storedSession) {
        localStorage.setItem("sb-fixture-auth-token", JSON.stringify(storedSession));
        localStorage.setItem("changuito-theme", "light");
      },
      createFixtureSession(account.userId, account.email),
    );
    const rolePage = await roleContext.newPage();
    rolePage.on("pageerror", function (error) {
      pageErrors.push(error.message);
    });
    const roleBackendRequests: string[] = [];
    const roleBackendRequestDetails: Array<{ method: string; path: string }> = [];
    const mockState = await mockSupabase(
      rolePage,
      account.role,
      account.userId,
      account.email,
      roleBackendRequests,
      roleBackendRequestDetails,
    );
    await rolePage.goto(appUrl);
    await rolePage.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();
    await rolePage.getByRole("button", { name: "Abrir menú" }).click();
    const panelEntry = rolePage.getByRole("button", {
      name: new RegExp(account.menuLabel),
    });
    await panelEntry.waitFor({ state: "visible" });
    await panelEntry.click();
    await rolePage.getByText(account.panelMarker, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 10_000,
    });

    for (const requiredPath of account.requiredRequests) {
      assert.ok(
        roleBackendRequests.includes(requiredPath),
        `${account.role} accounts should load ${requiredPath} through the mocked backend.`,
      );
    }
    assert.equal(
      roleBackendRequests.length > 0,
      true,
      `${account.role} should make its authenticated backend requests through the fixture.`,
    );

    await rolePage.evaluate(async function (panelName) {
      const fixture = await import("/tests/fixtures/adminAccessHarness.tsx");
      const container = document.createElement("div");
      container.id = "revocable-panel-fixture";
      document.body.append(container);
      fixture.mountRevocablePanelHarness(container, panelName);
    }, account.panel);
    const revocablePanel = rolePage.locator("#revocable-panel-fixture");
    if (account.panel === "negocio") {
      await revocablePanel.getByText("Browser Fixture Store").waitFor();
    } else {
      await revocablePanel.getByText("Browser Fixture Delivery Order", { exact: true }).waitFor();
      await revocablePanel.getByText("Browser Fixture Delivery Order", { exact: true }).click();
      await revocablePanel.getByText("Delivery-only street address", { exact: true }).waitFor();
      await revocablePanel.getByRole("button", { name: "✅ Marcar entregado" }).waitFor();
    }

    const writeRequestCount = function (path: string) {
      return roleBackendRequestDetails.filter(function (request) {
        return request.path === path && request.method !== "GET" && request.method !== "HEAD";
      }).length;
    };
    const writesBeforeRevocation = writeRequestCount(
      account.panel === "negocio" ? "/rest/v1/merchants" : "/rest/v1/pedidos",
    );
    if (account.panel === "negocio") {
      mockState.businessMembership = false;
    } else {
      mockState.role = "cliente";
    }
    await revocablePanel.getByRole("button", { name: "Simulate access removal" }).click();
    await revocablePanel.getByText("Acceso restringido", { exact: true }).waitFor();

    if (account.panel === "negocio") {
      assert.equal(
        await revocablePanel.getByText("Browser Fixture Store").count(),
        0,
        "Removing business membership should hide loaded business information.",
      );
      assert.equal(
        await revocablePanel.getByRole("button", { name: "Editar" }).count(),
        0,
        "Users without business membership must not keep business edit controls.",
      );
    } else {
      assert.equal(
        await revocablePanel.getByText("Delivery-only street address", { exact: true }).count(),
        0,
        "Removing delivery authorization should hide loaded order details.",
      );
      assert.equal(
        await revocablePanel.getByRole("button", { name: "✅ Marcar entregado" }).count(),
        0,
        "Users without delivery authorization must not keep order actions.",
      );
    }
    assert.equal(
      writeRequestCount(
        account.panel === "negocio" ? "/rest/v1/merchants" : "/rest/v1/pedidos",
      ),
      writesBeforeRevocation,
      "Revoking panel access must not submit further writes.",
    );
    assert.ok(
      roleBackendRequests.length > 0,
      "The revocation browser fixture should route backend calls through mocked responses.",
    );
    await roleContext.close();
  }

  await customerContext.close();
  assert.deepEqual(pageErrors, [], "Authenticated screens should not throw in the browser.");
});

it("recovers an existing account profile and returns to sign-in after retry", async function (t) {
  const port = await findAvailablePort();
  const appUrl = `http://127.0.0.1:${port}`;
  const vite = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: "browser-fixture-anon-key",
      },
      stdio: "ignore",
    },
  );

  let browser: import("playwright").Browser | undefined;
  t.after(async function () {
    if (browser) await browser.close();
    vite.kill("SIGTERM");
  });

  await waitForServer(appUrl, vite);

  const browserExecutable =
    process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(browserExecutable) ? { executablePath: browserExecutable } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", function (error) {
    pageErrors.push(error.message);
  });

  let signInAttempts = 0;
  const passwordGrantPayloads: Array<{ email?: string; password?: string }> = [];
  let signUpAttempts = 0;
  let profileWrites = 0;
  let resendAttempts = 0;
  let finishResend: (() => void) | undefined;
  let resendPayload: { type?: string; email?: string } | undefined;
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/auth/v1/resend") {
      resendAttempts += 1;
      resendPayload = request.postDataJSON();
      await new Promise<void>(function (resolve) {
        finishResend = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
      return;
    }

    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "password") {
        signInAttempts += 1;
        passwordGrantPayloads.push(request.postDataJSON());
        if (signInAttempts === 1) {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              code: "invalid_credentials",
              message: "Invalid login credentials",
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "isolated-recovery-access-token",
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "isolated-recovery-refresh-token",
            user: {
              id: "existing-browser-account",
              aud: "authenticated",
              role: "authenticated",
              email: "existing@example.test",
              app_metadata: { provider: "email", providers: ["email"] },
              user_metadata: {},
              created_at: new Date().toISOString(),
            },
          }),
        });
        return;
      }
    }

    if (url.pathname === "/auth/v1/signup") {
      signUpAttempts += 1;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Signup should not be used for recovery." }),
      });
      return;
    }

    if (url.pathname === "/auth/v1/logout") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (url.pathname === "/rest/v1/merchants" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    if (url.pathname === "/rest/v1/perfiles" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ rol: "cliente" }),
      });
      return;
    }

    if (url.pathname === "/rest/v1/perfiles" && request.method() === "POST") {
      profileWrites += 1;
      if (profileWrites === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Fixture profile write failure." }),
        });
        return;
      }
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto(appUrl);
  const appAuthStorageKeys = await page.evaluate(function () {
    return Object.keys(localStorage).filter(function (key) {
      return key.includes("auth-token");
    });
  });
  assert.deepEqual(
    appAuthStorageKeys,
    [],
    "The browser should begin without a preloaded authenticated session.",
  );
  const recoveryAction = page.getByRole("button", {
    name: "¿Confirmaste tu email y te falta el perfil? Completalo acá",
  });
  await recoveryAction.waitFor({ state: "visible" });
  let recoveryActionFocused = false;
  for (let tab = 0; tab < 12; tab += 1) {
    const focusedText = await page.evaluate(function () {
      return document.activeElement?.textContent?.trim() ?? "";
    });
    if (focusedText === "¿Confirmaste tu email y te falta el perfil? Completalo acá") {
      recoveryActionFocused = true;
      break;
    }
    await page.keyboard.press("Tab");
  }
  assert.equal(
    recoveryActionFocused,
    true,
    "Keyboard navigation should reach the profile recovery action.",
  );
  await page.keyboard.press("Enter");

  await page.getByText(
    "Confirmá tu email y completá estos datos para guardar tu perfil en la cuenta existente.",
  ).waitFor();
  let nameFieldFocused = false;
  for (let tab = 0; tab < 16; tab += 1) {
    nameFieldFocused = await page.evaluate(function () {
      return document.activeElement?.getAttribute("placeholder") === "Nombre o Alias";
    });
    if (nameFieldFocused) break;
    await page.keyboard.press("Tab");
  }
  assert.equal(nameFieldFocused, true, "Keyboard navigation should reach profile fields.");
  await page.keyboard.type("Ana Browser");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(function () {
      return document.activeElement?.getAttribute("placeholder");
    }),
    "tu@email.com",
  );
  await page.keyboard.type("existing@example.test");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(function () {
      return document.activeElement?.getAttribute("placeholder");
    }),
    "Contraseña (mín. 6 caracteres)",
  );
  await page.keyboard.type("fixture-password");
  await page.getByRole("button", { name: /Completar Perfil/ }).click();
  await page.getByText("Invalid login credentials", { exact: true }).waitFor();
  await page
    .getByText(
      "Confirmá tu email y completá estos datos para guardar tu perfil en la cuenta existente.",
      { exact: true },
    )
    .waitFor();
  await page.getByPlaceholder("Nombre o Alias").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /Completar Perfil/ }).waitFor();
  assert.equal(signInAttempts, 1, "Recovery should report the rejected credentials.");
  assert.equal(signUpAttempts, 0, "Rejected recovery credentials must not create an account.");
  assert.equal(profileWrites, 0, "Rejected recovery credentials must not write a profile.");

  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(function () {
      return document.activeElement?.textContent?.trim();
    }),
    "Reenviar email de confirmación",
    "The resend action should be reachable after the profile form by keyboard.",
  );
  await page.keyboard.press("Enter");

  const pendingAnnouncement = page
    .getByRole("status")
    .filter({ hasText: "Reenviando email de confirmación..." });
  await pendingAnnouncement.waitFor();
  assert.equal(await pendingAnnouncement.getAttribute("aria-live"), "polite");
  assert.equal(
    await page.getByRole("button", { name: "Reenviando email..." }).isDisabled(),
    true,
    "The resend action should prevent duplicate requests while pending.",
  );
  assert.equal(resendAttempts, 1, "Keyboard activation should send one confirmation request.");
  assert.equal(resendPayload?.type, "signup");
  assert.equal(resendPayload?.email, "existing@example.test");
  assert.equal(signInAttempts, 1, "Resending confirmation must not add a sign-in attempt.");
  assert.equal(signUpAttempts, 0, "Resending confirmation must not create an account.");
  assert.equal(profileWrites, 0, "Resending confirmation must not complete the profile.");

  assert.ok(finishResend, "The mocked confirmation request should be pending.");
  finishResend();
  const resendResult = "Te reenviamos el email de confirmación. Revisá tu bandeja de entrada.";
  const resultAnnouncement = page.getByRole("status").filter({ hasText: resendResult });
  await resultAnnouncement.waitFor();
  assert.equal(await resultAnnouncement.getAttribute("aria-live"), "polite");
  assert.equal(
    signInAttempts,
    1,
    "A successful resend must remain separate from profile completion.",
  );
  assert.equal(profileWrites, 0, "A successful resend must not write the profile.");

  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(function () {
      return (
        document.activeElement instanceof HTMLButtonElement &&
        document.activeElement.type === "submit"
      );
    }),
    true,
    "Profile submission should remain a separate keyboard action.",
  );
  await page.keyboard.press("Enter");
  await page
    .getByText(
      "No pudimos guardar tu perfil. Tu cuenta sigue intacta; revisá tu conexión e intentá de nuevo.",
      { exact: true },
    )
    .waitFor();
  await page.getByRole("button", { name: /Completar Perfil/ }).waitFor();

  await page.getByRole("button", { name: /Completar Perfil/ }).click();
  await page
    .getByText("Tu perfil quedó configurado. Ya podés iniciar sesión.", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "Entrar a la App" }).waitFor();
  await page.getByRole("button", {
    name: "¿Confirmaste tu email y te falta el perfil? Completalo acá",
  }).waitFor();

  assert.equal(signInAttempts, 3, "Recovery should retry sign-in for the existing account.");
  assert.equal(signUpAttempts, 0, "Recovery must not create a second account.");
  assert.equal(profileWrites, 2, "The profile write should be retried after visible failure.");
  assert.deepEqual(
    await page.evaluate(function () {
      return Object.keys(localStorage).filter(function (key) {
        return key.includes("auth-token");
      });
    }),
    [],
    "Successful profile recovery should return to sign-in without an active app session.",
  );

  await page.getByPlaceholder("tu@email.com").fill("existing@example.test");
  await page
    .getByPlaceholder("Contraseña (mín. 6 caracteres)")
    .fill("fixture-password");
  await page.getByRole("button", { name: "Entrar a la App" }).click();
  await page.getByText("¿Qué se te antoja?", { exact: true }).waitFor();
  assert.equal(signInAttempts, 4, "The returned sign-in form should authenticate normally.");
  assert.equal(passwordGrantPayloads[3]?.email, "existing@example.test");
  assert.equal(passwordGrantPayloads[3]?.password, "fixture-password");
  assert.ok(
    await page.evaluate(function () {
      return Object.keys(localStorage).some(function (key) {
        return key.includes("auth-token");
      });
    }),
    "The successful normal sign-in should establish the app session.",
  );
  assert.deepEqual(pageErrors, [], "Profile recovery should not throw in the browser.");
});

it("shows uncertain signup results as an error toast in the registration form", async function (t) {
  const port = await findAvailablePort();
  const appUrl = `http://127.0.0.1:${port}`;
  const vite = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: "browser-fixture-anon-key",
      },
      stdio: "ignore",
    },
  );

  let browser: import("playwright").Browser | undefined;
  t.after(async function () {
    if (browser) await browser.close();
    vite.kill("SIGTERM");
  });

  await waitForServer(appUrl, vite);

  const browserExecutable =
    process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(browserExecutable) ? { executablePath: browserExecutable } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", function (error) {
    pageErrors.push(error.message);
  });

  let signupAttempts = 0;
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/signup") {
      signupAttempts += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: null, session: null }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto(appUrl);
  await page.getByRole("button", { name: "Registro" }).click();
  await page.getByPlaceholder("Nombre o Alias").fill("Ana Browser");
  await page.getByPlaceholder("tu@email.com").fill("ana@example.test");
  await page
    .getByPlaceholder("Contraseña (mín. 6 caracteres)")
    .fill("fixture-password");
  const signupResponse = page.waitForResponse(function (response) {
    return new URL(response.url()).pathname === "/auth/v1/signup";
  });
  await page.getByRole("button", { name: "Crear Cuenta" }).click();
  await signupResponse;

  const guidance =
    "No pudimos confirmar la creación de tu cuenta. Intentá registrarte de nuevo o iniciá sesión si ya tenés una cuenta.";
  const errorToast = page.getByText(guidance, { exact: true });
  await errorToast.waitFor({ state: "visible", timeout: 5_000 });
  const announcedError = page.getByRole("alert").filter({ hasText: guidance });
  await announcedError.waitFor({ state: "visible" });
  assert.equal(
    await announcedError.getAttribute("aria-live"),
    "assertive",
    "Signup error guidance should be announced assertively to assistive technology.",
  );
  assert.equal(
    await errorToast.evaluate(function (element) {
      return (element as HTMLElement).style.border.includes("var(--color-red)");
    }),
    true,
    "Signup guidance should be presented using the error toast styling.",
  );
  assert.equal(
    await page.getByText("Revisá tu email para confirmar.", { exact: true }).count(),
    0,
    "An uncertain signup result must not show the success confirmation.",
  );
  assert.equal(signupAttempts, 1, "The registration form should submit signup.");
  assert.deepEqual(pageErrors, [], "Signup failure handling should not throw in the browser.");
});

it("shows signup confirmation when the registration form receives a created user", async function (t) {
  const port = await findAvailablePort();
  const appUrl = `http://127.0.0.1:${port}`;
  const vite = spawn(
    process.execPath,
    [
      path.join(projectRoot, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: supabaseUrl,
        VITE_SUPABASE_ANON_KEY: "browser-fixture-anon-key",
      },
      stdio: "ignore",
    },
  );

  let browser: import("playwright").Browser | undefined;
  t.after(async function () {
    if (browser) await browser.close();
    vite.kill("SIGTERM");
  });

  await waitForServer(appUrl, vite);

  const browserExecutable =
    process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(browserExecutable) ? { executablePath: browserExecutable } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", function (error) {
    pageErrors.push(error.message);
  });

  let signupAttempts = 0;
  let profileWrites = 0;
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/signup") {
      signupAttempts += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "confirmed-browser-signup-user",
            aud: "authenticated",
            role: "authenticated",
            email: "ana@example.test",
            app_metadata: { provider: "email", providers: ["email"] },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
          session: null,
        }),
      });
      return;
    }
    if (url.pathname === "/rest/v1/perfiles" && request.method() === "POST") {
      profileWrites += 1;
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto(appUrl);
  await page.getByRole("button", { name: "Registro" }).click();
  await page.getByPlaceholder("Nombre o Alias").fill("Ana Browser");
  await page.getByPlaceholder("tu@email.com").fill("ana@example.test");
  await page
    .getByPlaceholder("Contraseña (mín. 6 caracteres)")
    .fill("fixture-password");
  const signupResponse = page.waitForResponse(function (response) {
    return new URL(response.url()).pathname === "/auth/v1/signup";
  });
  await page.getByRole("button", { name: "Crear Cuenta" }).click();
  await signupResponse;

  await page
    .getByText("Revisá tu email para confirmar.", { exact: true })
    .waitFor({ state: "visible", timeout: 5_000 });
  const errorGuidance =
    "No pudimos confirmar la creación de tu cuenta. Intentá registrarte de nuevo o iniciá sesión si ya tenés una cuenta.";
  assert.equal(
    await page.getByText(errorGuidance, { exact: true }).count(),
    0,
    "A confirmed user response must not show signup error guidance.",
  );
  assert.equal(signupAttempts, 1, "The registration form should submit signup once.");
  assert.equal(
    profileWrites,
    1,
    "A confirmed signup response should save the new user's profile.",
  );
  assert.deepEqual(pageErrors, [], "Successful signup should not throw in the browser.");
});
