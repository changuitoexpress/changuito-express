import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeProfileSetup,
  listDeviceAuthSessions,
  resendConfirmationEmail,
  revokeDeviceAuthSession,
  restoreAuthSession,
  scheduleSessionExpiryWarning,
  signOut,
  signOutEverywhere,
  startAuthSession,
  submitAuthForm,
  validateAuthForm,
  watchAuthSession,
} from "../src/authFlows";

const validLogin = {
  mode: "login" as const,
  email: "fixture@example.test",
  password: "fixture-password",
  nombre: "",
};

function createClientFixture(overrides: Record<string, any> = {}) {
  const auth = {
    signUp: async function (_credentials?: any) {
      return { data: { user: null }, error: null };
    },
    resend: async function (_credentials?: any) {
      return { error: null };
    },
    signInWithPassword: async function (_credentials?: any) {
      return { error: null };
    },
    signOut: async function () {
      return { error: null };
    },
    getSession: async function () {
      return { data: { session: null } };
    },
    onAuthStateChange: function () {
      return { data: { subscription: { unsubscribe: function () {} } } };
    },
    ...overrides,
  };
  let upsertCalls = 0;
  const upsert = async function () {
    upsertCalls += 1;
    return { error: null };
  };
  const maybeSingle = async function () {
    return { data: null };
  };
  const client: any = {
    auth,
    from: function () {
      return {
        upsert,
        select: function () {
          return {
            eq: function () {
              return { maybeSingle };
            },
          };
        },
      };
    },
  };
  return {
    client,
    maybeSingle,
    getUpsertCalls: function () {
      return upsertCalls;
    },
  };
}

describe("validación de acceso", function () {
  it("conserva mensajes en español para campos, nombre y contraseña", function () {
    assert.equal(
      validateAuthForm({ ...validLogin, email: "" }),
      "Completá todos los campos.",
    );
    assert.equal(
      validateAuthForm({
        ...validLogin,
        mode: "register",
        nombre: " ",
      }),
      "Ingresá tu nombre completo.",
    );
    assert.equal(
      validateAuthForm({ ...validLogin, password: "12345" }),
      "Mínimo 6 caracteres.",
    );
  });

  it("acepta un inicio de sesión y un registro válidos", function () {
    assert.equal(validateAuthForm(validLogin), null);
    assert.equal(
      validateAuthForm({
        ...validLogin,
        mode: "register",
        nombre: "Ana",
      }),
      null,
    );
    assert.equal(
      validateAuthForm({
        ...validLogin,
        mode: "recover-profile",
        nombre: "Ana",
      }),
      null,
    );
  });
});

describe("acceso y registro Supabase", function () {
  it("reenvía la confirmación al email indicado sin crear ni modificar cuentas", async function () {
    let resendOptions: any;
    let signupCalls = 0;
    let profileWrites = 0;
    const fixture = createClientFixture({
      resend: async function (options: any) {
        resendOptions = options;
        return { error: null };
      },
      signUp: async function () {
        signupCalls += 1;
        return { data: { user: null }, error: null };
      },
    });
    fixture.client.from = function () {
      return {
        upsert: async function () {
          profileWrites += 1;
          return { error: null };
        },
      };
    };

    const result = await resendConfirmationEmail(
      fixture.client,
      " fixture@example.test ",
    );

    assert.deepEqual(result, {
      status: "sent",
      message:
        "Te reenviamos el email de confirmación. Revisá tu bandeja de entrada.",
    });
    assert.deepEqual(resendOptions, {
      type: "signup",
      email: "fixture@example.test",
    });
    assert.equal(signupCalls, 0);
    assert.equal(profileWrites, 0);
  });

  it("informa si falla el reenvío de confirmación", async function () {
    const { client } = createClientFixture({
      resend: async function () {
        return { error: new Error("Email rate limit exceeded") };
      },
    });

    assert.deepEqual(
      await resendConfirmationEmail(client, validLogin.email),
      {
        status: "error",
        message:
          "No pudimos enviar otro correo de confirmación porque el servicio aplica un límite temporal. Esperá unos minutos antes de volver a intentarlo; también revisá spam por si ya recibiste uno anterior.",
      },
    );
  });

  it("explica el límite temporal cuando el proveedor responde con demasiadas solicitudes", async function () {
    const { client } = createClientFixture({
      resend: async function () {
        return { error: { message: "Too many requests", status: 429 } };
      },
    });

    const result = await resendConfirmationEmail(client, validLogin.email);

    assert.equal(result.status, "error");
    assert.match(result.message, /Esperá unos minutos/);
    assert.match(result.message, /No pudimos enviar otro correo/);
  });

  it("conserva los errores de reenvío que no son límites de envío", async function () {
    const { client } = createClientFixture({
      resend: async function () {
        return { error: new Error("Network unavailable") };
      },
    });

    assert.deepEqual(
      await resendConfirmationEmail(client, validLogin.email),
      { status: "error", message: "Network unavailable" },
    );
  });

  it("no solicita reenvío si el email no es válido", async function () {
    let resendCalls = 0;
    const { client } = createClientFixture({
      resend: async function () {
        resendCalls += 1;
        return { error: null };
      },
    });

    const result = await resendConfirmationEmail(client, "invalid-email");

    assert.deepEqual(result, {
      status: "error",
      message: "Ingresá un email válido para reenviar la confirmación.",
    });
    assert.equal(resendCalls, 0);
  });

  it("devuelve el error del inicio de sesión fallido", async function () {
    let loginCredentials: any;
    const { client } = createClientFixture({
      signInWithPassword: async function (credentials: any) {
        loginCredentials = credentials;
        return { error: new Error("Invalid login credentials") };
      },
    });

    const result = await submitAuthForm(client, validLogin);

    assert.deepEqual(result, {
      status: "error",
      message: "Invalid login credentials",
    });
    assert.deepEqual(loginCredentials, {
      email: validLogin.email,
      password: validLogin.password,
    });
  });

  it("registra con credenciales de prueba y guarda el perfil aislado", async function () {
    let profileValues: any;
    let signupCredentials: any;
    const fixture = createClientFixture({
      signUp: async function (credentials: any) {
        signupCredentials = credentials;
        return { data: { user: { id: "fixture-user-id" } }, error: null };
      },
    });
    fixture.client.from = function () {
      return {
        upsert: async function (values: any, options: any) {
          profileValues = { values, options };
          return { error: null };
        },
      };
    };

    const result = await submitAuthForm(fixture.client, {
      ...validLogin,
      mode: "register",
      nombre: "  Ana Test  ",
    });

    assert.deepEqual(result, {
      status: "registered",
      message: "Revisá tu email para confirmar.",
    });
    assert.deepEqual(signupCredentials, {
      email: validLogin.email,
      password: validLogin.password,
    });
    assert.deepEqual(profileValues, {
      values: {
        id: "fixture-user-id",
        nombre: "Ana Test",
        email: "fixture@example.test",
        rol: "cliente",
      },
      options: { onConflict: "id" },
    });
  });

  it("explica que la cuenta se creó cuando Supabase devuelve un error al guardar el perfil", async function () {
    const fixture = createClientFixture({
      signUp: async function () {
        return { data: { user: { id: "fixture-user-id" } }, error: null };
      },
    });
    fixture.client.from = function () {
      return {
        upsert: async function () {
          return { error: new Error("Profile write failed") };
        },
      };
    };

    const result = await submitAuthForm(fixture.client, {
      ...validLogin,
      mode: "register",
      nombre: "Ana",
    });

    assert.deepEqual(result, {
      status: "profile-incomplete",
      message:
        "Tu cuenta se creó, pero no pudimos guardar tu perfil. Confirmá tu email y luego elegí “Completar perfil” para reintentarlo con tu cuenta existente.",
    });
  });

  it("explica que la cuenta se creó cuando guardar el perfil lanza una excepción", async function () {
    const fixture = createClientFixture({
      signUp: async function () {
        return { data: { user: { id: "fixture-user-id" } }, error: null };
      },
    });
    fixture.client.from = function () {
      return {
        upsert: async function () {
          throw new Error("Profile write threw");
        },
      };
    };

    const result = await submitAuthForm(fixture.client, {
      ...validLogin,
      mode: "register",
      nombre: "Ana",
    });

    assert.deepEqual(result, {
      status: "profile-incomplete",
      message:
        "Tu cuenta se creó, pero no pudimos guardar tu perfil. Confirmá tu email y luego elegí “Completar perfil” para reintentarlo con tu cuenta existente.",
    });
  });

  it("muestra un fallo de registro sin crear un perfil", async function () {
    const { client, getUpsertCalls } = createClientFixture({
      signUp: async function () {
        return { data: { user: null }, error: new Error("Signup disabled") };
      },
    });

    const result = await submitAuthForm(client, {
      ...validLogin,
      mode: "register",
      nombre: "Ana",
    });

    assert.deepEqual(result, { status: "error", message: "Signup disabled" });
    assert.equal(getUpsertCalls(), 0);
  });

  it("informa una excepción de red durante el registro sin confirmar el éxito", async function () {
    const { client, getUpsertCalls } = createClientFixture({
      signUp: async function () {
        throw new Error("Network request failed");
      },
    });

    const result = await submitAuthForm(client, {
      ...validLogin,
      mode: "register",
      nombre: "Ana",
    });

    assert.deepEqual(result, {
      status: "error",
      message: "Network request failed",
    });
    assert.notEqual(result.status, "registered");
    assert.equal(getUpsertCalls(), 0);
  });

  it("no confirma el registro cuando Supabase no devuelve usuario ni error", async function () {
    const { client, getUpsertCalls } = createClientFixture({
      signUp: async function () {
        return { data: { user: null }, error: null };
      },
    });

    const result = await submitAuthForm(client, {
      ...validLogin,
      mode: "register",
      nombre: "Ana",
    });

    assert.deepEqual(result, {
      status: "error",
      message:
        "No pudimos confirmar la creación de tu cuenta. Intentá registrarte de nuevo o iniciá sesión si ya tenés una cuenta.",
    });
    assert.equal(getUpsertCalls(), 0);
  });

  it("completa el perfil en la cuenta existente sin volver a registrarla", async function () {
    let signupCalls = 0;
    let loginCredentials: any;
    let savedProfile: any;
    const fixture = createClientFixture({
      signUp: async function () {
        signupCalls += 1;
        return { data: { user: { id: "new-account" } }, error: null };
      },
      signInWithPassword: async function (credentials: any) {
        loginCredentials = credentials;
        return {
          data: { user: { id: "existing-account" } },
          error: null,
        };
      },
    });
    fixture.client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: async function () {
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        upsert: async function (values: any, options: any) {
          savedProfile = { values, options };
          return { error: null };
        },
      };
    };

    const result = await completeProfileSetup(fixture.client, {
      email: validLogin.email,
      password: validLogin.password,
      nombre: "  Ana Test  ",
    });

    assert.deepEqual(result, {
      status: "profile-completed",
      message: "Tu perfil quedó configurado. Ya podés iniciar sesión.",
    });
    assert.equal(signupCalls, 0);
    assert.deepEqual(loginCredentials, {
      email: validLogin.email,
      password: validLogin.password,
    });
    assert.deepEqual(savedProfile, {
      values: {
        id: "existing-account",
        nombre: "Ana Test",
        email: "fixture@example.test",
        rol: "cliente",
      },
      options: { onConflict: "id" },
    });
  });

  it("explica un fallo del perfil y permite reintentar con la misma cuenta", async function () {
    let upsertCalls = 0;
    let signOutCalls = 0;
    let savedRole = "";
    const fixture = createClientFixture({
      signInWithPassword: async function () {
        return {
          data: { user: { id: "existing-account" } },
          error: null,
        };
      },
      signOut: async function () {
        signOutCalls += 1;
        return { error: null };
      },
    });
    fixture.client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: async function () {
                  return { data: { rol: "admin" }, error: null };
                },
              };
            },
          };
        },
        upsert: async function (values: any) {
          upsertCalls += 1;
          savedRole = values.rol;
          if (upsertCalls === 1) throw new Error("Profile write failed");
          return { error: null };
        },
      };
    };
    const credentials = {
      email: validLogin.email,
      password: validLogin.password,
      nombre: "Ana",
    };

    const failed = await completeProfileSetup(fixture.client, credentials);
    const retried = await completeProfileSetup(fixture.client, credentials);

    assert.deepEqual(failed, {
      status: "error",
      message:
        "No pudimos guardar tu perfil. Tu cuenta sigue intacta; revisá tu conexión e intentá de nuevo.",
    });
    assert.equal(retried.status, "profile-completed");
    assert.equal(upsertCalls, 2);
    assert.equal(signOutCalls, 2);
    assert.equal(savedRole, "admin");
  });
});

describe("sesión y cierre de sesión", function () {
  it("consulta solo metadatos de sesión mediante el RPC autenticado", async function () {
    let rpcCall: any;
    const { client } = createClientFixture();
    client.rpc = async function (functionName: string, args?: any) {
      rpcCall = { functionName, args };
      return {
        data: [
          {
            session_id: "123e4567-e89b-12d3-a456-426614174000",
            user_agent: "Mozilla/5.0",
            created_at: "2026-10-27T10:00:00Z",
            updated_at: "2026-10-27T10:30:00Z",
            is_current: true,
          },
        ],
        error: null,
      };
    };

    const sessions = await listDeviceAuthSessions(client);

    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].is_current, true);
    assert.deepEqual(rpcCall, {
      functionName: "list_my_device_sessions",
      args: undefined,
    });
  });

  it("informa si falla la consulta de sesiones", async function () {
    const { client } = createClientFixture();
    client.rpc = async function () {
      return { data: null, error: new Error("RPC is not configured") };
    };

    await assert.rejects(
      listDeviceAuthSessions(client),
      /RPC is not configured/,
    );
  });

  it("revoca solo el identificador de sesión seleccionado", async function () {
    let rpcCall: any;
    const { client } = createClientFixture();
    client.rpc = async function (functionName: string, args?: any) {
      rpcCall = { functionName, args };
      return { data: true, error: null };
    };

    assert.equal(
      await revokeDeviceAuthSession(
        client,
        "123e4567-e89b-12d3-a456-426614174000",
      ),
      true,
    );
    assert.deepEqual(rpcCall, {
      functionName: "revoke_my_device_session",
      args: { p_session_id: "123e4567-e89b-12d3-a456-426614174000" },
    });
  });

  it("rechaza identificadores de sesión incorrectos antes de llamar a Supabase", async function () {
    let rpcCalls = 0;
    const { client } = createClientFixture();
    client.rpc = async function () {
      rpcCalls += 1;
      return { data: true, error: null };
    };

    await assert.rejects(
      revokeDeviceAuthSession(client, "not-a-session-id"),
      /identificador de sesión no es válido/,
    );
    assert.equal(rpcCalls, 0);
  });

  it("restaura una sesión guardada junto con su perfil", async function () {
    const fixture = createClientFixture({
      getSession: async function () {
        return {
          data: {
            session: {
              user: { id: "fixture-user-id", email: "fixture@example.test" },
              expires_at: 1700000000,
            },
          },
        };
      },
    });
    fixture.maybeSingle = async function () {
      return { data: { nombre: "Ana", rol: "cliente" } };
    };
    fixture.client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return { maybeSingle: fixture.maybeSingle };
            },
          };
        },
      };
    };

    assert.deepEqual(await restoreAuthSession(fixture.client), {
      expiresAt: 1700000000,
      user: {
        id: "fixture-user-id",
        email: "fixture@example.test",
        nombre: "Ana",
        rol: "cliente",
      },
    });
  });

  it("avisa cuando la sesión se acerca a su vencimiento", function () {
    let warningCalls = 0;
    let scheduledDelay = -1;
    scheduleSessionExpiryWarning(
      1600,
      function () {
        warningCalls += 1;
      },
      1_000_000,
      5 * 60 * 1000,
      function (callback, delayMs) {
        scheduledDelay = delayMs;
        callback();
        return 1;
      },
      function () {},
    );

    assert.equal(scheduledDelay, 300_000);
    assert.equal(warningCalls, 1);
  });

  it("ignora el aviso atrasado aunque la cuenta nueva comparta el vencimiento", function () {
    const timers: Array<{ callback: () => void; delayMs: number; cancelled: boolean }> = [];
    let warningCalls = 0;
    const schedule = function (callback: () => void, delayMs: number) {
      const timer = { callback, delayMs, cancelled: false };
      timers.push(timer);
      return timer;
    };
    const cancel = function (timer: unknown) {
      (timer as (typeof timers)[number]).cancelled = true;
    };
    const clearOldWarning = scheduleSessionExpiryWarning(
      1600,
      function () {
        warningCalls += 1;
      },
      1_000_000,
      5 * 60 * 1000,
      schedule,
      cancel,
    );

    clearOldWarning();
    scheduleSessionExpiryWarning(
      1600,
      function () {
        warningCalls += 1;
      },
      1_000_000,
      5 * 60 * 1000,
      schedule,
      cancel,
    );
    timers[0].callback();

    assert.equal(timers[0].cancelled, true);
    assert.equal(timers[1].delayMs, 300_000);
    assert.equal(warningCalls, 0);

    timers[1].callback();
    assert.equal(warningCalls, 1);
  });

  it("mantiene la pantalla pública si no hay sesión guardada", async function () {
    const { client } = createClientFixture();
    assert.equal(await restoreAuthSession(client), null);
  });

  it("restaura una sesión guardada sin correo si falla la consulta del perfil", async function () {
    const { client } = createClientFixture({
      getSession: async function () {
        return {
          data: {
            session: {
              user: { id: "saved-account" },
            },
          },
        };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: async function () {
                  throw new Error("Saved profile lookup failed");
                },
              };
            },
          };
        },
      };
    };

    const observed: any[] = [];
    const startupEvents: string[] = [];
    let readyCalls = 0;
    let markReady: Function = function () {};
    const startupReady = new Promise<void>(function (resolve) {
      markReady = resolve;
    });

    startAuthSession(
      client,
      function (session) {
        observed.push(session);
        startupEvents.push("session");
      },
      function () {
        readyCalls += 1;
        startupEvents.push("ready");
        markReady();
      },
    );
    await startupReady;

    assert.equal(readyCalls, 1);
    assert.deepEqual(observed, [
      {
        user: {
          id: "saved-account",
          email: undefined,
          nombre: "usuario",
          rol: "cliente",
        },
      },
    ]);
    assert.deepEqual(startupEvents, ["session", "ready"]);
  });

  it("restaura la sesión guardada y aplica valores alternativos si no existe un perfil", async function () {
    let profileLookupCalls = 0;
    const { client } = createClientFixture({
      getSession: async function () {
        return {
          data: {
            session: {
              user: {
                id: "saved-account",
                email: "uliseseven.7@gmail.com",
              },
            },
          },
        };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: async function () {
                  profileLookupCalls += 1;
                  return { data: null, error: null };
                },
              };
            },
          };
        },
      };
    };

    const observed: any[] = [];
    const startupEvents: string[] = [];
    let markReady: Function = function () {};
    const startupReady = new Promise<void>(function (resolve) {
      markReady = resolve;
    });

    startAuthSession(
      client,
      function (session) {
        observed.push(session);
        startupEvents.push("session");
      },
      function () {
        startupEvents.push("ready");
        markReady();
      },
    );
    await startupReady;

    assert.equal(profileLookupCalls, 1);
    assert.deepEqual(observed, [
      {
        user: {
          id: "saved-account",
          email: "uliseseven.7@gmail.com",
          nombre: "uliseseven.7",
          rol: "cliente",
        },
      },
    ]);
    assert.deepEqual(startupEvents, ["session", "ready"]);
  });

  it("termina el inicio y conserva la sesión si la consulta del perfil no responde", async function () {
    const { client } = createClientFixture({
      getSession: async function () {
        return {
          data: {
            session: {
              user: { id: "saved-account", email: "saved@example.test" },
              expires_at: 1700000000,
            },
          },
        };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: function () {
                  return new Promise(function () {});
                },
              };
            },
          };
        },
      };
    };

    const observed: any[] = [];
    let readyCalls = 0;
    let markReady: Function = function () {};
    const startupReady = new Promise<void>(function (resolve) {
      markReady = resolve;
    });

    const cleanup = startAuthSession(
      client,
      function (session) {
        observed.push(session);
      },
      function () {
        readyCalls += 1;
        markReady();
      },
    );
    await startupReady;

    assert.equal(readyCalls, 1);
    assert.deepEqual(observed, [
      {
        expiresAt: 1700000000,
        user: {
          id: "saved-account",
          email: "saved@example.test",
          nombre: "saved",
          rol: "cliente",
        },
      },
    ]);
  });

  it("termina el inicio público si falla la consulta de sesión guardada", async function () {
    const { client } = createClientFixture({
      getSession: async function () {
        throw new Error("Saved session lookup failed");
      },
    });
    const observed: any[] = [];
    let readyCalls = 0;
    let markReady: Function = function () {};
    const startupReady = new Promise<void>(function (resolve) {
      markReady = resolve;
    });

    startAuthSession(
      client,
      function (session) {
        observed.push(session);
      },
      function () {
        readyCalls += 1;
        markReady();
      },
    );
    await startupReady;

    assert.equal(readyCalls, 1);
    assert.deepEqual(observed, []);
  });

  it("termina en estado público si no puede registrar el listener de autenticación", async function () {
    let getSessionCalls = 0;
    const { client } = createClientFixture({
      getSession: async function () {
        getSessionCalls += 1;
        return {
          data: {
            session: {
              user: { id: "saved-account", email: "saved@example.test" },
            },
          },
        };
      },
      onAuthStateChange: function () {
        throw new Error("Auth listener registration failed");
      },
    });
    const observed: any[] = [];
    let readyCalls = 0;
    let markReady: Function = function () {};
    const startupReady = new Promise<void>(function (resolve) {
      markReady = resolve;
    });

    const cleanup = startAuthSession(
      client,
      function (session) {
        observed.push(session);
      },
      function () {
        readyCalls += 1;
        markReady();
      },
    );
    await startupReady;

    assert.equal(readyCalls, 1);
    assert.equal(getSessionCalls, 0);
    assert.deepEqual(observed, []);
    cleanup();
  });

  it("reintenta el listener y restaura un inicio de sesión realizado durante el fallo", async function () {
    let registrationCalls = 0;
    let getSessionCalls = 0;
    let authListener: Function = function () {};
    const retryTimers: Array<{ callback: () => void; delayMs: number }> = [];
    const observed: any[] = [];
    const monitoringStatuses: boolean[] = [];
    let readyCalls = 0;
    const { client } = createClientFixture({
      getSession: async function () {
        getSessionCalls += 1;
        return {
          data: {
            session:
              getSessionCalls > 0
                ? {
                    user: {
                      id: "signed-in-during-retry",
                      email: "retry@example.test",
                    },
                  }
                : null,
          },
        };
      },
      onAuthStateChange: function (listener: Function) {
        registrationCalls += 1;
        if (registrationCalls < 3) {
          throw new Error("Temporary auth listener registration failure");
        }
        authListener = listener;
        return {
          data: {
            subscription: { unsubscribe: function () {} },
          },
        };
      },
    });
    const cleanup = startAuthSession(
      client,
      function (session) {
        observed.push(session);
      },
      function () {
        readyCalls += 1;
      },
      {
        schedule: function (callback, delayMs) {
          retryTimers.push({ callback, delayMs });
          return retryTimers.length;
        },
        cancel: function () {},
      },
      function (available) {
        monitoringStatuses.push(available);
      },
    );

    await new Promise<void>(function (resolve) {
      setImmediate(resolve);
    });
    assert.equal(readyCalls, 1);
    assert.deepEqual(observed, []);
    assert.equal(retryTimers[0].delayMs, 1000);

    retryTimers[0].callback();
    assert.equal(registrationCalls, 2);
    assert.equal(retryTimers[1].delayMs, 2000);

    retryTimers[1].callback();
    await new Promise<void>(function (resolve) {
      setImmediate(resolve);
    });

    assert.equal(registrationCalls, 3);
    assert.deepEqual(monitoringStatuses, [false, false, true]);
    assert.deepEqual(observed, [
      {
        user: {
          id: "signed-in-during-retry",
          email: "retry@example.test",
          nombre: "retry",
          rol: "cliente",
        },
      },
    ]);
    assert.equal(readyCalls, 1);

    authListener("SIGNED_IN", {
      user: { id: "signed-in-during-retry", email: "retry@example.test" },
    });
    cleanup();
  });

  it("permite reintentar el listener de autenticación de inmediato", async function () {
    let registrationCalls = 0;
    let retryAction: (() => void) | null = null;
    let cancelCalls = 0;
    const retryTimers: Array<() => void> = [];
    const monitoringStatuses: boolean[] = [];
    const { client } = createClientFixture({
      onAuthStateChange: function () {
        registrationCalls += 1;
        if (registrationCalls === 1) {
          throw new Error("Temporary auth listener registration failure");
        }
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
    });
    const cleanup = startAuthSession(
      client,
      function () {},
      function () {},
      {
        schedule: function (callback) {
          retryTimers.push(callback);
          return retryTimers.length;
        },
        cancel: function () {
          cancelCalls += 1;
        },
      },
      function (available, retry) {
        monitoringStatuses.push(available);
        retryAction = retry;
      },
    );

    assert.deepEqual(monitoringStatuses, [false]);
    assert.equal(retryTimers.length, 1);
    assert.ok(retryAction);
    retryAction();

    assert.equal(registrationCalls, 2);
    assert.equal(cancelCalls, 1);
    assert.deepEqual(monitoringStatuses, [false, true]);
    cleanup();
  });

  it("limpia la sesión al recibir el evento de cierre de sesión", async function () {
    let authListener: Function = function () {};
    const subscription = { unsubscribe: function () {} };
    const { client } = createClientFixture({
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return { data: { subscription } };
      },
    });
    const observed: any[] = [];
    const returnedSubscription = watchAuthSession(client, function (session) {
      observed.push(session);
    });

    authListener("SIGNED_OUT", null);

    assert.notEqual(returnedSubscription, subscription);
    assert.deepEqual(observed, [null]);
  });

  it("permite cancelar varias veces sin repetir la limpieza de Supabase", function () {
    let unsubscribeCalls = 0;
    const { client } = createClientFixture({
      onAuthStateChange: function () {
        return {
          data: {
            subscription: {
              unsubscribe: function () {
                unsubscribeCalls += 1;
              },
            },
          },
        };
      },
    });
    const subscription = watchAuthSession(client, function () {});

    subscription.unsubscribe();
    subscription.unsubscribe();

    assert.equal(unsubscribeCalls, 1);
  });

  it("permite repetir la limpieza de pantalla sin repetir la limpieza de Supabase", function () {
    let unsubscribeCalls = 0;
    const { client } = createClientFixture({
      onAuthStateChange: function () {
        return {
          data: {
            subscription: {
              unsubscribe: function () {
                unsubscribeCalls += 1;
              },
            },
          },
        };
      },
    });
    const cleanup = startAuthSession(client, function () {}, function () {});

    cleanup();
    cleanup();

    assert.equal(unsubscribeCalls, 1);
  });

  it("ignora el resultado de perfil si se cancela la observación antes de que termine", async function () {
    let authListener: Function = function () {};
    let resolveProfile: Function = function () {};
    let unsubscribeCalls = 0;
    const { client } = createClientFixture({
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return {
          data: {
            subscription: {
              unsubscribe: function () {
                unsubscribeCalls += 1;
              },
            },
          },
        };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: function () {
                  return new Promise(function (resolve) {
                    resolveProfile = resolve;
                  });
                },
              };
            },
          };
        },
      };
    };
    const observed: any[] = [];
    const subscription = watchAuthSession(client, function (session) {
      observed.push(session);
    });

    authListener("SIGNED_IN", {
      user: { id: "fixture-user-id", email: "fixture@example.test" },
    });
    subscription.unsubscribe();
    resolveProfile({ data: { nombre: "Ana", rol: "cliente" } });
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });

    assert.equal(unsubscribeCalls, 1);
    assert.deepEqual(observed, []);
  });

  it("ignora una consulta de perfil que termina después del cierre de sesión", async function () {
    let authListener: Function = function () {};
    let resolveProfile: Function = function () {};
    const { client } = createClientFixture({
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: function () {
                  return new Promise(function (resolve) {
                    resolveProfile = resolve;
                  });
                },
              };
            },
          };
        },
      };
    };
    const observed: any[] = [];
    watchAuthSession(client, function (session) {
      observed.push(session);
    });

    authListener("SIGNED_IN", {
      user: { id: "fixture-user-id", email: "fixture@example.test" },
    });
    authListener("SIGNED_OUT", null);
    resolveProfile({ data: { nombre: "Ana", rol: "cliente" } });
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });

    assert.deepEqual(observed, [null]);
  });

  it("conserva la sesión del inicio de sesión más reciente si las consultas se cruzan", async function () {
    let authListener: Function = function () {};
    const profileResolvers: Function[] = [];
    const { client } = createClientFixture({
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: function () {
                  return new Promise(function (resolve) {
                    profileResolvers.push(resolve);
                  });
                },
              };
            },
          };
        },
      };
    };
    const observed: any[] = [];
    watchAuthSession(client, function (session) {
      observed.push(session);
    });

    authListener("SIGNED_IN", {
      user: { id: "first-account", email: "first@example.test" },
    });
    authListener("SIGNED_IN", {
      user: { id: "second-account", email: "second@example.test" },
    });

    profileResolvers[1]({ data: { nombre: "Second", rol: "cliente" } });
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
    profileResolvers[0]({ data: { nombre: "First", rol: "admin" } });
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });

    assert.deepEqual(observed, [
      {
        user: {
          id: "second-account",
          email: "second@example.test",
          nombre: "Second",
          rol: "cliente",
        },
      },
    ]);
  });

  it("vuelve a consultar el rol del perfil al actualizarse el token", async function () {
    let authListener: Function = function () {};
    let currentRole = "cliente";
    let profileLookups = 0;
    const { client } = createClientFixture({
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: async function () {
                  profileLookups += 1;
                  return { data: { nombre: "Ana", rol: currentRole } };
                },
              };
            },
          };
        },
      };
    };
    const observed: any[] = [];
    const subscription = watchAuthSession(client, function (session) {
      observed.push(session);
    });
    const session = {
      user: { id: "fixture-user-id", email: "fixture@example.test" },
    };

    authListener("SIGNED_IN", session);
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
    currentRole = "admin";
    authListener("TOKEN_REFRESHED", session);
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
    subscription.unsubscribe();

    assert.equal(profileLookups, 2);
    assert.deepEqual(
      observed.map(function (appSession) {
        return appSession?.user.rol;
      }),
      ["cliente", "admin"],
    );
  });

  it("conserva un inicio de sesión reciente si el perfil guardado termina después durante el inicio", async function () {
    let authListener: Function = function () {};
    let resolveSavedProfileStarted: Function = function () {};
    let resolveNewProfileStarted: Function = function () {};
    let resolveSavedProfile: Function = function () {};
    let resolveNewProfile: Function = function () {};
    let markReady: Function = function () {};
    const savedProfileStarted = new Promise<void>(function (resolve) {
      resolveSavedProfileStarted = resolve;
    });
    const newProfileStarted = new Promise<void>(function (resolve) {
      resolveNewProfileStarted = resolve;
    });
    const startupReady = new Promise<void>(function (resolve) {
      markReady = resolve;
    });
    const { client } = createClientFixture({
      getSession: async function () {
        return {
          data: {
            session: {
              user: { id: "saved-account", email: "saved@example.test" },
            },
          },
        };
      },
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function (_column: string, userId: string) {
              return {
                maybeSingle: function () {
                  return new Promise(function (resolve) {
                    if (userId === "saved-account") {
                      resolveSavedProfileStarted();
                      resolveSavedProfile = resolve;
                    } else {
                      resolveNewProfileStarted();
                      resolveNewProfile = resolve;
                    }
                  });
                },
              };
            },
          };
        },
      };
    };
    const observed: any[] = [];
    startAuthSession(
      client,
      function (session) {
        observed.push(session);
      },
      function () {
        markReady();
      },
    );

    await savedProfileStarted;
    authListener("SIGNED_IN", {
      user: { id: "new-account", email: "new@example.test" },
    });
    await newProfileStarted;
    resolveNewProfile({ data: { nombre: "New account", rol: "cliente" } });
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });

    resolveSavedProfile({ data: { nombre: "Saved account", rol: "admin" } });
    await startupReady;

    assert.deepEqual(observed, [
      {
        user: {
          id: "new-account",
          email: "new@example.test",
          nombre: "New account",
          rol: "cliente",
        },
      },
    ]);
  });

  it("no restaura la sesión inicial si se cierra sesión mientras carga el perfil", async function () {
    let authListener: Function = function () {};
    let resolveProfile: Function = function () {};
    let profileLookupStarted: Function = function () {};
    let ready: Function = function () {};
    const profileStarted = new Promise<void>(function (resolve) {
      profileLookupStarted = resolve;
    });
    const startupReady = new Promise<void>(function (resolve) {
      ready = resolve;
    });
    const { client } = createClientFixture({
      getSession: async function () {
        return {
          data: {
            session: {
              user: { id: "fixture-user-id", email: "fixture@example.test" },
            },
          },
        };
      },
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
    });
    client.from = function () {
      return {
        select: function () {
          return {
            eq: function () {
              return {
                maybeSingle: function () {
                  profileLookupStarted();
                  return new Promise(function (resolve) {
                    resolveProfile = resolve;
                  });
                },
              };
            },
          };
        },
      };
    };
    const observed: any[] = [];
    startAuthSession(
      client,
      function (session) {
        observed.push(session);
      },
      function () {
        ready();
      },
    );

    await profileStarted;
    authListener("SIGNED_OUT", null);
    resolveProfile({ data: { nombre: "Ana", rol: "cliente" } });
    await startupReady;

    assert.deepEqual(observed, [null]);
  });

  it("envía el cierre de sesión al cliente Supabase", async function () {
    let signOutCalls = 0;
    const { client } = createClientFixture({
      signOut: async function () {
        signOutCalls += 1;
        return { error: null };
      },
    });

    await signOut(client);

    assert.equal(signOutCalls, 1);
  });

  it("informa cuando Supabase devuelve un error al cerrar sesión", async function () {
    const signOutError = new Error("network unavailable");
    const { client } = createClientFixture({
      signOut: async function () {
        return { error: signOutError };
      },
    });

    await assert.rejects(signOut(client), function (error) {
      return error === signOutError;
    });
  });

  it("cierra la sesión local y revoca sesiones en otros dispositivos", async function () {
    let authListener: Function = function () {};
    let signOutOptions: any;
    const { client } = createClientFixture({
      onAuthStateChange: function (listener: Function) {
        authListener = listener;
        return { data: { subscription: { unsubscribe: function () {} } } };
      },
      signOut: async function (options: any) {
        signOutOptions = options;
        authListener("SIGNED_OUT", null);
        return { error: null };
      },
    });
    const observed: any[] = [];
    watchAuthSession(client, function (session) {
      observed.push(session);
    });
    authListener("SIGNED_IN", {
      user: { id: "fixture-user-id", email: "fixture@example.test" },
    });
    await new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
    assert.equal(observed[0]?.user.id, "fixture-user-id");

    await signOutEverywhere(client);

    assert.deepEqual(signOutOptions, { scope: "global" });
    assert.equal(observed[1], null);
  });

  it("informa cuando falla el cierre de sesión en todos los dispositivos", async function () {
    const signOutError = new Error("network unavailable");
    let signOutOptions: any;
    const { client } = createClientFixture({
      signOut: async function (options: any) {
        signOutOptions = options;
        return { error: signOutError };
      },
    });

    await assert.rejects(signOutEverywhere(client), function (error) {
      return error === signOutError;
    });
    assert.deepEqual(signOutOptions, { scope: "global" });
  });
});
