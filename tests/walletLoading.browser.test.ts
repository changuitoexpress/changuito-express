import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "node:test";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseUrl = "https://wallet-fixture.supabase.co";
const fixtureUserId = "wallet-fixture-user";
const wallet = {
  id: "wallet-fixture-wallet",
  user_id: fixtureUserId,
  saldo_cashback: 42.75,
  pedidos_realizados: 7,
  envios_gratis_usados: 1,
};
let deliveredOrders = Array.from({ length: 1005 }, function () {
  return { total_pagar: 10, estatus: "entregado" };
});
const recentOrders = Array.from({ length: 50 }, function (_, index) {
  return {
    id: `wallet-fixture-order-${index}`,
    negocio_nombre: "Fixture Store",
    total_pagar: 10,
    estatus: "entregado",
    created_at: new Date(Date.UTC(2026, 0, 1, 12, 0, index)).toISOString(),
  };
});

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

function createFixtureSession() {
  return {
    access_token: "wallet-fixture-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "wallet-fixture-refresh-token",
    user: {
      id: fixtureUserId,
      aud: "authenticated",
      role: "authenticated",
      email: "wallet@example.test",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

it("keeps the wallet summary hidden after each query failure and restores it on retry", async function (t) {
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
        VITE_SUPABASE_ANON_KEY: "wallet-fixture-anon-key",
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
  await context.addInitScript(
    function (storedSession) {
      localStorage.setItem("sb-wallet-fixture-auth-token", JSON.stringify(storedSession));
      localStorage.setItem("changuito-theme", "light");
    },
    createFixtureSession(),
  );
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", function (error) {
    pageErrors.push(error.message);
  });

  let failure: "wallet" | "creation" | "orders" | null = "wallet";
  const requests = { wallet: 0, creation: 0, orders: 0 };
  const orderQueries: string[] = [];
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());
    const acceptsObject = request.headers().accept?.includes(
      "application/vnd.pgrst.object+json",
    );

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: fixtureUserId,
          email: "wallet@example.test",
          user_metadata: {},
          app_metadata: { provider: "email", providers: ["email"] },
        }),
      });
      return;
    }
    if (url.pathname === "/rest/v1/perfiles" && acceptsObject) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ nombre: "Wallet Fixture Customer", rol: "cliente" }),
      });
      return;
    }
    if (url.pathname === "/rest/v1/merchant_admins") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/rest/v1/monedero_cliente") {
      if (request.method() === "GET") {
        if (failure === "wallet") {
          requests.wallet += 1;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Wallet fixture read failure." }),
          });
          return;
        }
        if (failure === "creation") {
          await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(acceptsObject ? wallet : [wallet]),
        });
        return;
      }
      if (request.method() === "POST" && failure === "creation") {
        requests.creation += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Wallet fixture creation failure." }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(wallet),
      });
      return;
    }
    if (url.pathname === "/rest/v1/pedidos") {
      orderQueries.push(url.search);
      if (failure === "orders") {
        requests.orders += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Order fixture read failure." }),
        });
        return;
      }

      if (request.method() === "HEAD" && url.searchParams.get("select") === "id") {
        await route.fulfill({
          status: 200,
          headers: {
            "content-range": `*/${deliveredOrders.length}`,
            "access-control-expose-headers": "content-range",
          },
          body: "",
        });
        return;
      }

      if (url.searchParams.get("select") === "total_pagar") {
        const from = Number(url.searchParams.get("offset") ?? 0);
        const to = from + Number(url.searchParams.get("limit") ?? 1000) - 1;
        const rows = deliveredOrders.slice(from, to + 1);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "content-range": `${from}-${from + rows.length - 1}/${deliveredOrders.length}`,
            "access-control-expose-headers": "content-range",
          },
          body: JSON.stringify(rows),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(recentOrders),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto(appUrl);
  await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();

  for (const scenario of [
    { failure: "wallet" as const, requestName: "wallet" as const },
    { failure: "creation" as const, requestName: "creation" as const },
    { failure: "orders" as const, requestName: "orders" as const },
  ]) {
    failure = scenario.failure;
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("button", { name: /ChangoMonedero/ }).click();
    await page.getByRole("alert").getByText("No pudimos cargar tu monedero").waitFor({
      state: "visible",
      timeout: 10_000,
    });
    assert.equal(
      await page.getByText("Saldo disponible", { exact: true }).count(),
      0,
      `The wallet summary must stay hidden after the ${scenario.failure} query fails.`,
    );
    assert.ok(
      requests[scenario.requestName] > 0,
      `The ${scenario.failure} failure should come from its intended query.`,
    );

    if (scenario.failure !== "orders") {
      await page.locator("button").first().click();
      await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();
    }
  }

  failure = null;
  orderQueries.length = 0;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await page.getByText("Saldo disponible", { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByText("$42.75", { exact: true }).waitFor();
  await page.getByText("$10,050", { exact: true }).waitFor();
  await page.getByText("50%", { exact: true }).waitFor();
  assert.equal(
    orderQueries.filter(function(query) {
      return new URLSearchParams(query).get("select") === "total_pagar";
    }).length,
    2,
    "Loyalty totals should continue across all 1005 delivered orders.",
  );
  assert.ok(
    orderQueries.some(function(query) {
      return new URLSearchParams(query).get("offset") === "1000";
    }),
    "The delivered-order summary should request the next page when needed.",
  );
  assert.ok(
    orderQueries.some(function(query) {
      return new URLSearchParams(query).get("limit") === "50";
    }),
    "The visible order history should remain limited to the latest 50 orders.",
  );
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "A successful retry should clear the wallet error.",
  );
  assert.deepEqual(pageErrors, [], "Wallet loading and retry should not throw in the browser.");

  await page.locator("button").first().click();
  await page.getByRole("heading", { name: "¿Qué se te antoja?" }).waitFor();
  await page.getByRole("button", { name: "🍽️ Restaurantes" }).first().click();
  await page.getByText("5 de cada 10", { exact: true }).waitFor();
  await page.getByText("50%", { exact: true }).waitFor();
  assert.ok(
    orderQueries.some(function(query) {
      const params = new URLSearchParams(query);
      return params.get("select") === "id"
        && params.get("cliente_id") === `eq.${fixtureUserId}`
        && params.get("estatus") === "eq.entregado";
    }),
    "The compact wallet should count only this customer's delivered orders.",
  );

  deliveredOrders = deliveredOrders.concat({ total_pagar: 10, estatus: "entregado" });
  await page.evaluate(function() {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("6 de cada 10", { exact: true }).waitFor();
  await page.getByText("60%", { exact: true }).waitFor();

  await context.close();
});
