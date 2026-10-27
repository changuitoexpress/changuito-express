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
const secondFixtureUserId = "wallet-fixture-account-b";
const wallet = {
  id: "wallet-fixture-wallet",
  user_id: fixtureUserId,
  saldo_cashback: 42.75,
  pedidos_realizados: 7,
  envios_gratis_usados: 100,
};
const secondWallet = {
  id: "wallet-fixture-account-b-wallet",
  user_id: secondFixtureUserId,
  saldo_cashback: 8.25,
  pedidos_realizados: 2,
  envios_gratis_usados: 0,
};
const initializedWallet = {
  id: "wallet-fixture-new-wallet",
  user_id: fixtureUserId,
  saldo_cashback: 0,
  pedidos_realizados: 0,
  envios_gratis_usados: 0,
};
let deliveredOrders = Array.from({ length: 1005 }, function () {
  return { total_pagar: 10, estatus: "entregado" };
});
const orderHistory = Array.from({ length: 125 }, function (_, index) {
  return {
    id: `wallet-fixture-order-${index}`,
    negocio_nombre: `Fixture Store ${index}`,
    total_pagar: 10,
    estatus: "entregado",
    created_at: new Date(Date.UTC(2026, 0, 2, 12, 0, 0) - index * 60_000).toISOString(),
  };
});
const freeShippingMilestones = [
  {
    delivered: 0,
    used: 0,
    percent: "0%",
    compactCycle: "0 de cada 10",
    dedicatedCycle: "0/10 pedidos",
    compactRemaining: "10 pedidos",
    dedicatedRemaining: "10 pedidos más",
  },
  {
    delivered: 9,
    used: 0,
    percent: "90%",
    compactCycle: "9 de cada 10",
    dedicatedCycle: "9/10 pedidos",
    compactRemaining: "1 pedido",
    dedicatedRemaining: "1 pedido más",
  },
  {
    delivered: 10,
    used: 0,
    percent: "100%",
    compactCycle: "10 de cada 10",
    dedicatedCycle: "10/10 pedidos",
    compactRemaining: "¡Disponible!",
    dedicatedRemaining: "¡Ya tienes envío gratis disponible!",
  },
  {
    delivered: 11,
    used: 1,
    percent: "10%",
    compactCycle: "1 de cada 10",
    dedicatedCycle: "1/10 pedidos",
    compactRemaining: "9 pedidos",
    dedicatedRemaining: "9 pedidos más",
  },
];

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

function createFixtureSession(userId = fixtureUserId) {
  const isSecondAccount = userId === secondFixtureUserId;
  return {
    access_token: isSecondAccount
      ? "wallet-fixture-account-b-access-token"
      : "wallet-fixture-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "wallet-fixture-refresh-token",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: isSecondAccount ? "second-wallet@example.test" : "wallet@example.test",
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

  let failure: "wallet" | "creation" | "orders" | "deliveredCount" | "laterOrderPage" | "newWallet" | null = "wallet";
  const requests = {
    wallet: 0,
    missingWallet: 0,
    creation: 0,
    successfulCreation: 0,
    orders: 0,
    deliveredCount: 0,
    laterOrderPage: 0,
  };
  let creationPayload: unknown;
  const orderQueries: string[] = [];
  let holdAccountAWalletResponse = false;
  let markAccountAWalletReadStarted!: () => void;
  const accountAWalletReadStarted = new Promise<void>(function (resolve) {
    markAccountAWalletReadStarted = resolve;
  });
  let releaseAccountAWalletResponse!: () => void;
  const accountAWalletResponseGate = new Promise<void>(function (resolve) {
    releaseAccountAWalletResponse = resolve;
  });
  await page.route(`${supabaseUrl}/**`, async function (route) {
    const request = route.request();
    const url = new URL(request.url());
    const authorization = request.headers().authorization ?? "";
    const requestUserId = authorization.includes("wallet-fixture-account-b-access-token")
      ? secondFixtureUserId
      : fixtureUserId;
    const acceptsObject = request.headers().accept?.includes(
      "application/vnd.pgrst.object+json",
    );

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: requestUserId,
          email: requestUserId === secondFixtureUserId
            ? "second-wallet@example.test"
            : "wallet@example.test",
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
        body: JSON.stringify({
          nombre: requestUserId === secondFixtureUserId
            ? "Second Wallet Customer"
            : "Wallet Fixture Customer",
          rol: "cliente",
        }),
      });
      return;
    }
    if (url.pathname === "/rest/v1/merchant_admins") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/rest/v1/monedero_cliente") {
      if (request.method() === "GET") {
        const walletUserId = url.searchParams.get("user_id")?.replace(/^eq\./, "");
        if (holdAccountAWalletResponse && walletUserId === fixtureUserId) {
          holdAccountAWalletResponse = false;
          markAccountAWalletReadStarted();
          await accountAWalletResponseGate;
        }
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
        if (failure === "newWallet") {
          requests.missingWallet += 1;
          await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            acceptsObject
              ? walletUserId === secondFixtureUserId
                ? secondWallet
                : wallet
              : [walletUserId === secondFixtureUserId ? secondWallet : wallet],
          ),
        });
        return;
      }
      requests.creation += 1;
      creationPayload = request.postDataJSON();
      if (request.method() === "POST" && failure === "creation") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Wallet fixture creation failure." }),
        });
        return;
      }
      if (failure === "newWallet") {
        requests.successfulCreation += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(initializedWallet),
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
      if (
        failure === "deliveredCount"
        && (
          (request.method() === "HEAD" && url.searchParams.get("select") === "id")
          || url.searchParams.get("select") === "total_pagar"
        )
      ) {
        requests.deliveredCount += 1;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Delivered-order count fixture failure." }),
        });
        return;
      }
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
        const countedOrders = url.searchParams.get("estatus") === "eq.entregado"
          ? deliveredOrders.filter(function (order) {
              return order.estatus === "entregado";
            })
          : deliveredOrders;
        await route.fulfill({
          status: 200,
          headers: {
            "content-range": `*/${countedOrders.length}`,
            "access-control-expose-headers": "content-range",
          },
          body: "",
        });
        return;
      }

      if (url.searchParams.get("select") === "total_pagar") {
        const countedOrders = deliveredOrders.filter(function (order) {
          return order.estatus === "entregado";
        });
        const from = Number(url.searchParams.get("offset") ?? 0);
        const to = from + Number(url.searchParams.get("limit") ?? 1000) - 1;
        if (failure === "laterOrderPage" && from > 0) {
          requests.laterOrderPage += 1;
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Later order page fixture failure." }),
          });
          return;
        }
        const rows = countedOrders.slice(from, to + 1);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "content-range": `${from}-${from + rows.length - 1}/${countedOrders.length}`,
            "access-control-expose-headers": "content-range",
          },
          body: JSON.stringify(rows),
        });
        return;
      }
      const from = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "content-range": `${from}-${Math.min(from + limit - 1, orderHistory.length - 1)}/${orderHistory.length}`,
          "access-control-expose-headers": "content-range",
        },
        body: JSON.stringify(orderHistory.slice(from, from + limit)),
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
    { failure: "laterOrderPage" as const, requestName: "laterOrderPage" as const },
  ]) {
    failure = scenario.failure;
    if (scenario.failure === "laterOrderPage") orderQueries.length = 0;
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
    assert.equal(
      await page.getByText("Total gastado", { exact: true }).count(),
      0,
      `The wallet must not expose partial loyalty totals after ${scenario.failure} fails.`,
    );
    assert.ok(
      requests[scenario.requestName] > 0,
      `The ${scenario.failure} failure should come from its intended query.`,
    );
    if (scenario.failure === "laterOrderPage") {
      const deliveredPageOffsets = orderQueries
        .filter(function (query) {
          return new URLSearchParams(query).get("select") === "total_pagar";
        })
        .map(function (query) {
          return new URLSearchParams(query).get("offset");
        });
      assert.ok(
        deliveredPageOffsets.includes("0"),
        "The first delivered-order page should succeed before the later page fails.",
      );
      assert.ok(
        deliveredPageOffsets.includes("1000"),
        "The fixture should fail the subsequent delivered-order page.",
      );
    }

    if (scenario.failure !== "laterOrderPage") {
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
  assert.ok(
    orderQueries.some(function(query) {
      const params = new URLSearchParams(query);
      return params.get("limit") === "50"
        && params.get("order")?.includes("created_at.desc");
    }),
    "The first history page should return only the latest 50 orders in descending order.",
  );
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "A successful retry should clear the wallet error.",
  );
  assert.deepEqual(pageErrors, [], "Wallet loading and retry should not throw in the browser.");

  wallet.envios_gratis_usados = 0;
  await page.evaluate(function () {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("¡Ya tienes envío gratis disponible!", { exact: true }).waitFor();

  failure = "deliveredCount";
  await page.getByRole("button", { name: "Recargar monedero" }).click();
  await page.getByRole("alert").getByText("No pudimos cargar tu monedero").waitFor({
    state: "visible",
    timeout: 10_000,
  });
  assert.ok(requests.deliveredCount > 0, "The delivered-order count query should fail.");
  assert.equal(
    await page.getByText("¡Ya tienes envío gratis disponible!", { exact: true }).count(),
    0,
    "A failed delivered-order count must hide previously available rewards.",
  );
  assert.equal(
    await page.getByText("10/10 pedidos", { exact: true }).count(),
    0,
    "A failed delivered-order count must not show stale shipping progress.",
  );

  failure = null;
  await page.getByRole("button", { name: "Reintentar" }).click();
  await page.getByText("$10,050", { exact: true }).waitFor();
  await page.getByText("¡Ya tienes envío gratis disponible!", { exact: true }).waitFor();
  await page.getByText("10/10 pedidos", { exact: true }).waitFor();

  await page.getByRole("button", { name: "📦 Pedidos" }).click();
  await page.getByText("Pedidos 1–50 de 125", { exact: true }).waitFor();
  await page.getByText("Fixture Store 0", { exact: true }).waitFor();
  await page.getByText("Fixture Store 49", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Fixture Store 50", { exact: true }).count(),
    0,
    "The first history page should stop after the latest 50 orders.",
  );
  await page.getByRole("button", { name: "Pedidos anteriores" }).click();
  await page.getByText("Pedidos 51–100 de 125", { exact: true }).waitFor();
  await page.getByText("Fixture Store 50", { exact: true }).waitFor();
  await page.getByText("Fixture Store 99", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Fixture Store 0", { exact: true }).count(),
    0,
    "The older page should replace, rather than append to, the current page.",
  );
  await page.getByRole("button", { name: "Pedidos anteriores" }).click();
  await page.getByText("Pedidos 101–125 de 125", { exact: true }).waitFor();
  await page.getByText("Fixture Store 100", { exact: true }).waitFor();
  await page.getByText("Fixture Store 124", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Pedidos anteriores" }).isDisabled(),
    true,
    "The last history page should disable navigation to a nonexistent next page.",
  );
  await page.getByRole("button", { name: "Pedidos más recientes" }).click();
  await page.getByText("Pedidos 51–100 de 125", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Pedidos más recientes" }).click();
  await page.getByText("Pedidos 1–50 de 125", { exact: true }).waitFor();
  await page.getByRole("button", { name: "💰 Saldo" }).click();
  await page.getByText("$10,050", { exact: true }).waitFor();
  assert.ok(
    orderQueries.some(function(query) {
      return new URLSearchParams(query).get("offset") === "50";
    }),
    "Older order history should be requested from the next offset.",
  );

  for (const milestone of freeShippingMilestones) {
    wallet.envios_gratis_usados = milestone.used;
    deliveredOrders = Array.from({ length: milestone.delivered }, function () {
      return { total_pagar: 10, estatus: "entregado" };
    });
    await page.evaluate(function () {
      window.dispatchEvent(new Event("focus"));
    });
    await page.getByText(milestone.dedicatedCycle, { exact: true }).waitFor();
    await page.getByText(milestone.percent, { exact: true }).waitFor();
    await page.getByText(milestone.dedicatedRemaining, { exact: true }).waitFor();
  }
  deliveredOrders = [
    ...Array.from({ length: 5 }, function () {
      return { total_pagar: 10, estatus: "entregado" };
    }),
    ...Array.from({ length: 4 }, function () {
      return { total_pagar: 10, estatus: "pendiente" };
    }),
    ...Array.from({ length: 3 }, function () {
      return { total_pagar: 10, estatus: "cancelado" };
    }),
  ];
  await page.evaluate(function () {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("5/10 pedidos", { exact: true }).waitFor();
  await page.getByText("50%", { exact: true }).waitFor();
  await page.getByText("5 pedidos más", { exact: true }).waitFor();
  deliveredOrders[5].estatus = "entregado";
  await page.evaluate(function () {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("6/10 pedidos", { exact: true }).waitFor();
  await page.getByText("60%", { exact: true }).waitFor();
  await page.getByText("4 pedidos más", { exact: true }).waitFor();

  deliveredOrders = Array.from({ length: 1005 }, function () {
    return { total_pagar: 10, estatus: "entregado" };
  });

  failure = "newWallet";
  orderQueries.length = 0;
  await page.evaluate(function () {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("$0.00", { exact: true }).waitFor();
  await page.getByText("$10,050", { exact: true }).waitFor();
  await page.getByText("Últimos pedidos", { exact: true }).waitFor();
  await page.getByText("Fixture Store").first().waitFor();
  await page
    .getByText("Pedidos totales", { exact: true })
    .locator("..")
    .getByText("0", { exact: true })
    .waitFor();
  await page
    .getByText("Envíos gratis", { exact: true })
    .locator("..")
    .getByText("0", { exact: true })
    .waitFor();
  assert.ok(requests.missingWallet > 0, "A missing wallet should be looked up.");
  assert.equal(requests.successfulCreation, 1, "A missing wallet should be created once.");
  assert.deepEqual(
    creationPayload,
    [{ user_id: fixtureUserId, saldo_cashback: 0, pedidos_realizados: 0 }],
    "The new wallet should be initialized for the signed-in customer.",
  );
  assert.ok(
    orderQueries.some(function (query) {
      return new URLSearchParams(query).get("limit") === "50";
    }),
    "Order loading should complete after the new wallet is created.",
  );
  assert.equal(
    await page.getByRole("alert").count(),
    0,
    "Successful first-time wallet setup should show the summary without an error.",
  );
  failure = null;

  deliveredOrders = [
    ...Array.from({ length: 5 }, function () {
      return { total_pagar: 10, estatus: "entregado" };
    }),
    ...Array.from({ length: 4 }, function () {
      return { total_pagar: 10, estatus: "pendiente" };
    }),
    ...Array.from({ length: 3 }, function () {
      return { total_pagar: 10, estatus: "cancelado" };
    }),
  ];
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

  failure = "deliveredCount";
  await page.evaluate(function() {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("No disponible", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("5 de cada 10", { exact: true }).count(),
    0,
    "A failed dashboard count must not keep the previous cycle count visible.",
  );
  assert.equal(
    await page.getByText("50%", { exact: true }).count(),
    0,
    "A failed dashboard count must not keep the previous progress percentage visible.",
  );
  assert.equal(
    await page.getByText("¡Disponible!", { exact: true }).count(),
    0,
    "A failed dashboard count must not advertise a free-shipping reward.",
  );
  assert.equal(
    await page.getByText("Progreso no disponible", { exact: true }).count(),
    1,
    "The dashboard should explain that progress could not be loaded.",
  );

  failure = null;
  deliveredOrders = deliveredOrders.concat({ total_pagar: 10, estatus: "entregado" });
  await page.evaluate(function() {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("6 de cada 10", { exact: true }).waitFor();
  await page.getByText("60%", { exact: true }).waitFor();

  for (const milestone of freeShippingMilestones) {
    wallet.envios_gratis_usados = milestone.used;
    deliveredOrders = Array.from({ length: milestone.delivered }, function () {
      return { total_pagar: 10, estatus: "entregado" };
    });
    await page.evaluate(function () {
      window.dispatchEvent(new Event("focus"));
    });
    await page.getByText(milestone.compactCycle, { exact: true }).waitFor();
    await page.getByText(milestone.percent, { exact: true }).waitFor();
    await page.getByText(milestone.compactRemaining, { exact: true }).waitFor();
  }
  deliveredOrders = [
    ...Array.from({ length: 4 }, function () {
      return { total_pagar: 10, estatus: "entregado" };
    }),
    ...Array.from({ length: 3 }, function () {
      return { total_pagar: 10, estatus: "pendiente" };
    }),
    ...Array.from({ length: 2 }, function () {
      return { total_pagar: 10, estatus: "cancelado" };
    }),
  ];
  await page.evaluate(function () {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("4 de cada 10", { exact: true }).waitFor();
  await page.getByText("40%", { exact: true }).waitFor();
  await page.getByText("6 pedidos", { exact: true }).waitFor();
  deliveredOrders[7].estatus = "entregado";
  await page.evaluate(function () {
    window.dispatchEvent(new Event("focus"));
  });
  await page.getByText("5 de cada 10", { exact: true }).waitFor();
  await page.getByText("50%", { exact: true }).waitFor();
  await page.getByText("5 pedidos", { exact: true }).waitFor();
  deliveredOrders = Array.from({ length: 11 }, function () {
    return { total_pagar: 10, estatus: "entregado" };
  });

  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: /ChangoMonedero/ }).click();
  holdAccountAWalletResponse = true;
  // Reload while account A is active and pause its wallet response.
  await page.getByRole("button", { name: "Recargar monedero" }).click();
  await accountAWalletReadStarted;

  const sessionSwitchPage = await context.newPage();
  await sessionSwitchPage.goto(appUrl);
  await sessionSwitchPage.evaluate(function (nextSession) {
    const key = "sb-wallet-fixture-auth-token";
    localStorage.setItem(key, JSON.stringify(nextSession));
    const authUpdates = new BroadcastChannel(key);
    authUpdates.postMessage({ event: "SIGNED_IN", session: nextSession });
    authUpdates.close();
  }, createFixtureSession(secondFixtureUserId));

  await page.getByText("$8.25", { exact: true }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await sessionSwitchPage.close();
  assert.equal(
    await page.getByText("$42.75", { exact: true }).count(),
    0,
    "The previous account's balance must not be shown after switching accounts.",
  );

  releaseAccountAWalletResponse();
  await page.waitForTimeout(500);
  assert.equal(
    await page.getByText("$8.25", { exact: true }).count(),
    1,
    "A late response for account A must not replace account B's wallet.",
  );
  assert.equal(
    await page.getByText("$42.75", { exact: true }).count(),
    0,
    "The previous account's balance must remain hidden after its response completes.",
  );
  assert.deepEqual(pageErrors, [], "Switching accounts during wallet loading should not throw.");

  await context.close();
});
