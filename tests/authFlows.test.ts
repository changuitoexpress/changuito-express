import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeProfileSetup,
  restoreAuthSession,
  signOut,
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
  it("restaura una sesión guardada junto con su perfil", async function () {
    const fixture = createClientFixture({
      getSession: async function () {
        return {
          data: {
            session: {
              user: { id: "fixture-user-id", email: "fixture@example.test" },
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
      user: {
        id: "fixture-user-id",
        email: "fixture@example.test",
        nombre: "Ana",
        rol: "cliente",
      },
    });
  });

  it("mantiene la pantalla pública si no hay sesión guardada", async function () {
    const { client } = createClientFixture();
    assert.equal(await restoreAuthSession(client), null);
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

    assert.equal(returnedSubscription, subscription);
    assert.deepEqual(observed, [null]);
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
});
