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
  role: "admin" | "cliente" = "admin",
  userId = fixtureUserId,
  email = "uliseseven.7@gmail.com",
  requestLog?: string[],
) {
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());
    requestLog?.push(url.pathname);
    const acceptsObject = request.headers().accept?.includes(
      "application/vnd.pgrst.object+json",
    );
    let data: unknown = [];

    if (url.pathname === "/auth/v1/user") {
      data = {
        id: userId,
        email,
        user_metadata: {},
        app_metadata: { provider: "email", providers: ["email"] },
      };
    } else if (url.pathname === "/rest/v1/perfiles" && acceptsObject) {
      data = {
        nombre: role === "admin" ? "Browser Fixture Admin" : "Browser Fixture Customer",
        rol: role,
      };
    } else if (
      url.pathname === "/rest/v1/merchant_admins" &&
      acceptsObject &&
      role === "admin"
    ) {
      data = { merchant_id: fixtureMerchant.id };
    } else if (url.pathname === "/rest/v1/merchants") {
      data =
        role === "cliente"
          ? acceptsObject
            ? null
            : []
          : acceptsObject
            ? fixtureMerchant
            : [fixtureMerchant];
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
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

function createFixtureSession(userId: string, email: string) {
  return {
    access_token: "browser-fixture-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
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
  const session = createFixtureSession(fixtureUserId, "uliseseven.7@gmail.com");
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

  const screens = [
    { menuLabel: "ChangoMonedero", marker: "ChangoMonedero" },
    { menuLabel: "Bazar Vecinal", marker: "Bazar Vecinal" },
    { menuLabel: "Directorio Telefónico", marker: "Directorio Telefónico" },
    { menuLabel: "ChanguiShopping", marker: "ChanguiShopping" },
    { menuLabel: "Bienes Raíces", marker: "Bienes Raíces" },
    { menuLabel: "Venta de Autos", marker: "Venta de Autos" },
    { menuLabel: "Panel de Negocios", marker: "Browser Fixture Store" },
    { menuLabel: "Panel Repartidor", marker: "Repartidor" },
    { menuLabel: "God Mode", marker: "Panel de Control" },
  ];

  for (const screen of screens) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("button", { name: new RegExp(screen.menuLabel) }).click();
    await page.getByText(screen.marker, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await page.locator("button").first().click();
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
    await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor({
      timeout: 10_000,
    });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const screen of screens) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("button", { name: new RegExp(screen.menuLabel) }).click();
    await page.getByText(screen.marker, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 10_000,
    });
    await page.locator("button").first().click();
    await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor({
      timeout: 10_000,
    });
  }

  await page.evaluate(function () {
    window.scrollTo(0, 0);
  });
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
    await tabButton.click();
    await tab.content.waitFor({ state: "visible", timeout: 10_000 });
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
  let signUpAttempts = 0;
  let profileWrites = 0;
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/auth/v1/token") {
      if (url.searchParams.get("grant_type") === "password") {
        signInAttempts += 1;
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
  const recoveryAction = page.getByRole("button", {
    name: "¿Confirmaste tu email y te falta el perfil? Completalo acá",
  });
  await recoveryAction.waitFor({ state: "visible" });
  await recoveryAction.click();

  await page.getByText(
    "Confirmá tu email y completá estos datos para guardar tu perfil en la cuenta existente.",
  ).waitFor();
  await page.getByRole("button", { name: /Completar Perfil/ }).click();
  await page.getByText("Completá todos los campos.", { exact: true }).waitFor();

  await page.getByPlaceholder("Nombre o Alias").fill("Ana Browser");
  await page.getByPlaceholder("tu@email.com").fill("existing@example.test");
  await page.getByPlaceholder("Contraseña (mín. 6 caracteres)").fill("fixture-password");
  await page.getByRole("button", { name: /Completar Perfil/ }).click();
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

  assert.equal(signInAttempts, 2, "Recovery should retry sign-in for the existing account.");
  assert.equal(signUpAttempts, 0, "Recovery must not create a second account.");
  assert.equal(profileWrites, 2, "The profile write should be retried after visible failure.");
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
