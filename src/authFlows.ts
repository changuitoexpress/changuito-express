export type AuthMode = "login" | "register" | "recover-profile";

export interface AuthFormValues {
  mode: AuthMode;
  email: string;
  password: string;
  nombre: string;
}

export interface AuthAppSession {
  expiresAt?: number;
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
  rpc(functionName: string, args?: Record<string, unknown>): PromiseLike<any>;
}

interface SupabaseSession {
  expires_at?: number;
  user: {
    id: string;
    email?: string;
  };
}

const PROFILE_LOOKUP_TIMEOUT_MS = 1500;

export interface DeviceAuthSession {
  session_id: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string | null;
  is_current: boolean;
}

export function scheduleSessionExpiryWarning(
  expiresAt: number | undefined,
  onWarning: () => void,
  nowMs: number = Date.now(),
  warningLeadMs: number = 5 * 60 * 1000,
  schedule: (callback: () => void, delayMs: number) => unknown = function (
    callback,
    delayMs,
  ) {
    return setTimeout(callback, delayMs);
  },
  cancel: (timer: unknown) => void = function (timer) {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  },
): () => void {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return function () {};
  }

  let active = true;
  const delayMs = Math.max(0, expiresAt * 1000 - nowMs - warningLeadMs);
  const timer = schedule(function () {
    if (active) onWarning();
  }, delayMs);
  return function () {
    active = false;
    cancel(timer);
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
      const userId =
        typeof data?.user?.id === "string" && data.user.id.length > 0
          ? data.user.id
          : null;
      if (userId) {
        try {
          const { error: profileError } = await client.from("perfiles").upsert(
            {
              id: userId,
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
      if (!userId) {
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

export async function resendConfirmationEmail(
  client: SupabaseAuthClient,
  email: string,
): Promise<{ status: "sent" | "error"; message: string }> {
  const normalizedEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return {
      status: "error",
      message: "Ingresá un email válido para reenviar la confirmación.",
    };
  }

  function isEmailSendingRateLimitError(error: any): boolean {
    if (error?.status === 429 || error?.status === "429") return true;

    const message = [error?.message, error?.code, error?.error_description]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase()
      .replace(/[_-]+/g, " ");

    return /\b(?:email|e-mail|mail)\b.{0,60}\b(?:rate limit|limit exceeded|too many|requests?)\b|\b(?:rate limit|limit exceeded)\b.{0,60}\b(?:email|e-mail|mail)\b|\btoo many (?:requests|emails?)\b/.test(
      message,
    );
  }

  try {
    const { error } = await client.auth.resend({
      type: "signup",
      email: normalizedEmail,
    });
    if (error) throw error;
    return {
      status: "sent",
      message: "Te reenviamos el email de confirmación. Revisá tu bandeja de entrada.",
    };
  } catch (err: any) {
    return {
      status: "error",
      message: isEmailSendingRateLimitError(err)
        ? "No pudimos enviar otro correo de confirmación porque el servicio aplica un límite temporal. Esperá unos minutos antes de volver a intentarlo; también revisá spam por si ya recibiste uno anterior."
        : err.message ??
          "No pudimos reenviar el email de confirmación. Intentá de nuevo.",
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
  let profileLookupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const profileResult = await Promise.race([
      client
        .from("perfiles")
        .select("nombre,rol")
        .eq("id", session.user.id)
        .maybeSingle(),
      new Promise<null>(function (resolve) {
        profileLookupTimer = setTimeout(function () {
          resolve(null);
        }, PROFILE_LOOKUP_TIMEOUT_MS);
      }),
    ]);
    const data = profileResult?.data;
    return {
      ...(session.expires_at ? { expiresAt: session.expires_at } : {}),
      user: {
        id: session.user.id,
        email: session.user.email,
        nombre:
          data?.nombre ??
          (session.user.email ? session.user.email.split("@")[0] : "usuario"),
        rol:
          data?.rol ??
          (data && session.user.email === "uliseseven.7@gmail.com"
            ? "admin"
            : "cliente"),
      },
    };
  } catch (e) {
    return {
      ...(session.expires_at ? { expiresAt: session.expires_at } : {}),
      user: {
        id: session.user.id,
        email: session.user.email,
        nombre: session.user.email
          ? session.user.email.split("@")[0]
          : "usuario",
        rol: "cliente",
      },
    };
  } finally {
    if (profileLookupTimer) clearTimeout(profileLookupTimer);
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
  let listening = true;
  let unsubscribed = false;
  let latestAuthEvent = 0;
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(function (_event: string, session: SupabaseSession | null) {
    if (!listening) return;
    const authEvent = ++latestAuthEvent;
    if (onAuthEvent) onAuthEvent();
    if (!session) {
      onSession(null);
      return;
    }
    createAppSession(client, session).then(function (appSession) {
      if (listening && authEvent === latestAuthEvent) onSession(appSession);
    });
  });
  return {
    ...subscription,
    unsubscribe: function () {
      if (unsubscribed) return;
      unsubscribed = true;
      listening = false;
      subscription.unsubscribe();
    },
  };
}

export function startAuthSession(
  client: SupabaseAuthClient,
  onSession: (session: AuthAppSession | null) => void,
  onReady: () => void,
  retryScheduler: {
    schedule: (callback: () => void, delayMs: number) => unknown;
    cancel: (timer: unknown) => void;
  } = {
    schedule: function (callback, delayMs) {
      return setTimeout(callback, delayMs);
    },
    cancel: function (timer) {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
    },
  },
  onMonitoringStatus?: (available: boolean, retry: () => void) => void,
) {
  let mounted = true;
  let latestAuthEvent = 0;
  let subscription: ReturnType<typeof watchAuthSession> | null = null;
  let retryTimer: unknown = null;
  let retryPending = false;
  let retryAttempt = 0;

  function scheduleRetry() {
    if (!mounted || retryPending) return;
    const delayMs = Math.min(1000 * 2 ** retryAttempt, 30000);
    retryAttempt = Math.min(retryAttempt + 1, 5);
    retryPending = true;
    retryTimer = retryScheduler.schedule(function () {
      retryPending = false;
      retryTimer = null;
      registerListener(true);
    }, delayMs);
  }

  function retryNow() {
    if (!mounted) return;
    if (retryPending) {
      retryPending = false;
      retryScheduler.cancel(retryTimer);
      retryTimer = null;
    }
    registerListener(true);
  }

  function restoreCurrentSession() {
    const authEventAtStart = latestAuthEvent;
    return restoreAuthSession(client)
      .then(function (restored) {
        if (mounted && authEventAtStart === latestAuthEvent && restored) {
          onSession(restored);
        }
      })
      .catch(function () {});
  }

  function registerListener(isRetry: boolean): boolean {
    try {
      subscription = watchAuthSession(
        client,
        function (session) {
          if (mounted) onSession(session);
        },
        function () {
          latestAuthEvent += 1;
        },
      );
      retryAttempt = 0;
      if (onMonitoringStatus) onMonitoringStatus(true, retryNow);
      if (isRetry) void restoreCurrentSession();
      return true;
    } catch (e) {
      if (onMonitoringStatus) onMonitoringStatus(false, retryNow);
      scheduleRetry();
      return false;
    }
  }

  const listening = registerListener(false);

  (listening ? restoreCurrentSession() : Promise.resolve())
    .finally(function () {
      if (mounted) onReady();
    });

  return function () {
    mounted = false;
    if (retryPending) {
      retryPending = false;
      retryScheduler.cancel(retryTimer);
      retryTimer = null;
    }
    if (subscription) subscription.unsubscribe();
  };
}

export function signOut(client: SupabaseAuthClient) {
  return client.auth.signOut().then(function (result: { error?: any }) {
    if (result.error) throw result.error;
  });
}

export function signOutEverywhere(client: SupabaseAuthClient) {
  return client.auth
    .signOut({ scope: "global" })
    .then(function (result: { error?: any }) {
      if (result.error) throw result.error;
    });
}

export async function listDeviceAuthSessions(
  client: SupabaseAuthClient,
): Promise<DeviceAuthSession[]> {
  const { data, error } = await client.rpc("list_my_device_sessions");
  if (error) throw error;
  const sessionIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !Array.isArray(data) ||
    !data.every(function (session) {
      return (
        session &&
        typeof session === "object" &&
        typeof session.session_id === "string" &&
        sessionIdPattern.test(session.session_id) &&
        (session.user_agent === null || typeof session.user_agent === "string") &&
        typeof session.created_at === "string" &&
        (session.updated_at === null || typeof session.updated_at === "string") &&
        typeof session.is_current === "boolean"
      );
    })
  ) {
    throw new Error("Supabase devolvió una lista de sesiones no válida.");
  }
  return data;
}

export async function revokeDeviceAuthSession(
  client: SupabaseAuthClient,
  sessionId: string,
): Promise<boolean> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sessionId,
    )
  ) {
    throw new Error("El identificador de sesión no es válido.");
  }
  const { data, error } = await client.rpc("revoke_my_device_session", {
    p_session_id: sessionId,
  });
  if (error) throw error;
  if (typeof data !== "boolean") {
    throw new Error("Supabase no pudo confirmar el cierre de esa sesión.");
  }
  return data;
}
