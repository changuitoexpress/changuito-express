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
) {
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());
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
      data = acceptsObject ? fixtureMerchant : [fixtureMerchant];
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
  await mockSupabase(customerPage, "cliente", customerId, customerEmail);
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

  await customerContext.close();
  assert.deepEqual(pageErrors, [], "Authenticated screens should not throw in the browser.");
});
