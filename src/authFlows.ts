export type AuthMode = "login" | "register";

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
  if (values.mode === "register" && values.nombre.trim().length < 2) {
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
): Promise<{ status: "signed-in" | "registered" | "error"; message?: string }> {
  try {
    if (values.mode === "register") {
      const { data, error } = await client.auth.signUp({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
      if (data.user) {
        try {
          await client.from("perfiles").upsert(
            {
              id: data.user.id,
              nombre: values.nombre.trim(),
              email: values.email,
              rol: "cliente",
            },
            { onConflict: "id" },
          );
        } catch (e) {}
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
) {
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(function (_event: string, session: SupabaseSession | null) {
    if (!session) {
      onSession(null);
      return;
    }
    createAppSession(client, session).then(onSession);
  });
  return subscription;
}

export function signOut(client: SupabaseAuthClient) {
  return client.auth.signOut();
}
