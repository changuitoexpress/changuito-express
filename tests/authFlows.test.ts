import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  restoreAuthSession,
  signOut,
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
});
