export type AuthMode = "login" | "register" | "recover-profile";

export interface AuthFormValues {
  mode: AuthMode;
  email: string;
  password: string;
  nombre: string;
}

export interface AuthAppSession {
  user: {
    id: string;
    email?: string;
    nombre?: string;
    rol?: string;
  };
}

interface SupabaseAuthClient {
  auth: any;
  from(table: string): any;
}

interface SupabaseSession {
  user: {
    id: string;
    email?: string;
  };
}

export function validateAuthForm(values: AuthFormValues): string | null {
  if (!values.email || !values.password) {
    return "Completá todos los campos.";
  }
  if (values.mode !== "login" && values.nombre.trim().length < 2) {
    return "Ingresá tu nombre completo.";
  }
  if (values.password.length < 6) {
    return "Mínimo 6 caracteres.";
  }
  return null;
}

export async function submitAuthForm(
  client: SupabaseAuthClient,
  values: AuthFormValues,
): Promise<{
  status: "signed-in" | "registered" | "profile-incomplete" | "error";
  message?: string;
}> {
  try {
    if (values.mode === "recover-profile") {
      return { status: "error", message: "Usá la opción para completar tu perfil." };
    }
    if (values.mode === "register") {
      const { data, error } = await client.auth.signUp({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
      if (data?.user) {
        try {
          const { error: profileError } = await client.from("perfiles").upsert(
            {
              id: data.user.id,
              nombre: values.nombre.trim(),
              email: values.email,
              rol: "cliente",
            },
            { onConflict: "id" },
          );
          if (profileError) {
            return {
              status: "profile-incomplete",
              message:
                "Tu cuenta se creó, pero no pudimos guardar tu perfil. Confirmá tu email y luego elegí “Completar perfil” para reintentarlo con tu cuenta existente.",
            };
          }
        } catch (e) {
          return {
            status: "profile-incomplete",
            message:
              "Tu cuenta se creó, pero no pudimos guardar tu perfil. Confirmá tu email y luego elegí “Completar perfil” para reintentarlo con tu cuenta existente.",
          };
        }
      }
      if (!data?.user) {
        return {
          status: "error",
          message:
            "No pudimos confirmar la creación de tu cuenta. Intentá registrarte de nuevo o iniciá sesión si ya tenés una cuenta.",
        };
      }
      return { status: "registered", message: "Revisá tu email para confirmar." };
    }

    const { error } = await client.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
    return { status: "signed-in" };
  } catch (err: any) {
    return {
      status: "error",
      message: err.message ?? "Error inesperado.",
    };
  }
}

export async function completeProfileSetup(
  client: SupabaseAuthClient,
  values: Pick<AuthFormValues, "email" | "password" | "nombre">,
): Promise<{ status: "profile-completed" | "error"; message?: string }> {
  let signedIn = false;
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
    if (!data?.user?.id) {
      return {
        status: "error",
        message: "No pudimos verificar tu cuenta. Revisá tus datos e intentá de nuevo.",
      };
    }
    signedIn = true;

    try {
      const { data: existingProfile, error: lookupError } = await client
        .from("perfiles")
        .select("rol")
        .eq("id", data.user.id)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const { error: profileError } = await client.from("perfiles").upsert(
        {
          id: data.user.id,
          nombre: values.nombre.trim(),
          email: values.email,
          rol: existingProfile?.rol ?? "cliente",
        },
        { onConflict: "id" },
      );
      if (profileError) throw profileError;
    } catch (e) {
      return {
        status: "error",
        message:
          "No pudimos guardar tu perfil. Tu cuenta sigue intacta; revisá tu conexión e intentá de nuevo.",
      };
    }

    return {
      status: "profile-completed",
      message: "Tu perfil quedó configurado. Ya podés iniciar sesión.",
    };
  } catch (err: any) {
    return {
      status: "error",
      message:
        err.message ??
        "No pudimos completar tu perfil. Revisá tus datos e intentá de nuevo.",
    };
  } finally {
    if (signedIn) {
      try {
        await client.auth.signOut();
      } catch (e) {}
    }
  }
}

async function createAppSession(
  client: SupabaseAuthClient,
  session: SupabaseSession,
): Promise<AuthAppSession> {
  try {
    const { data } = await client
      .from("perfiles")
      .select("nombre,rol")
      .eq("id", session.user.id)
      .maybeSingle();
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        nombre:
          data?.nombre ??
          (session.user.email ? session.user.email.split("@")[0] : "usuario"),
        rol:
          data?.rol ??
          (session.user.email === "uliseseven.7@gmail.com" ? "admin" : "cliente"),
      },
    };
  } catch (e) {
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        nombre: session.user.email
          ? session.user.email.split("@")[0]
          : "usuario",
        rol: "cliente",
      },
    };
  }
}

export async function restoreAuthSession(
  client: SupabaseAuthClient,
): Promise<AuthAppSession | null> {
  const {
    data: { session },
  } = await client.auth.getSession();
  return session ? createAppSession(client, session) : null;
}

export function watchAuthSession(
  client: SupabaseAuthClient,
  onSession: (session: AuthAppSession | null) => void,
  onAuthEvent?: () => void,
) {
  let latestAuthEvent = 0;
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(function (_event: string, session: SupabaseSession | null) {
    const authEvent = ++latestAuthEvent;
    if (onAuthEvent) onAuthEvent();
    if (!session) {
      onSession(null);
      return;
    }
    createAppSession(client, session).then(function (appSession) {
      if (authEvent === latestAuthEvent) onSession(appSession);
    });
  });
  return subscription;
}

export function startAuthSession(
  client: SupabaseAuthClient,
  onSession: (session: AuthAppSession | null) => void,
  onReady: () => void,
) {
  let mounted = true;
  let latestAuthEvent = 0;
  const startupAuthEvent = latestAuthEvent;
  const subscription = watchAuthSession(
    client,
    function (session) {
      if (mounted) onSession(session);
    },
    function () {
      latestAuthEvent += 1;
    },
  );

  restoreAuthSession(client)
    .then(function (restored) {
      if (mounted && startupAuthEvent === latestAuthEvent && restored) {
        onSession(restored);
      }
    })
    .catch(function () {})
    .finally(function () {
      if (mounted) onReady();
    });

  return function () {
    mounted = false;
    subscription.unsubscribe();
  };
}

export function signOut(client: SupabaseAuthClient) {
  return client.auth.signOut().then(function (result: { error?: any }) {
    if (result.error) throw result.error;
  });
}
