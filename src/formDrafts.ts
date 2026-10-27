const FORM_DRAFT_PREFIX = "changuito-form-draft:";
const FORM_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface StoredFormDraft<T> {
  savedAt: number;
  values: T;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function formDraftKey(userId: string, formId: string): string {
  return FORM_DRAFT_PREFIX + encodeURIComponent(userId) + ":" + formId;
}

export function readFormDraft<T>(
  userId: string,
  formId: string,
  now: number = Date.now(),
): T | null {
  const storage = getStorage();
  if (!storage) return null;

  const key = formDraftKey(userId, formId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredFormDraft<T>;
    if (
      !draft ||
      typeof draft.savedAt !== "number" ||
      now - draft.savedAt > FORM_DRAFT_MAX_AGE_MS ||
      now < draft.savedAt ||
      !("values" in draft)
    ) {
      storage.removeItem(key);
      return null;
    }
    return draft.values;
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
    return null;
  }
}

export function writeFormDraft<T>(
  userId: string,
  formId: string,
  values: T,
  now: number = Date.now(),
): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(
      formDraftKey(userId, formId),
      JSON.stringify({ savedAt: now, values } satisfies StoredFormDraft<T>),
    );
  } catch {
    // A blocked or full browser store must not interrupt form entry.
  }
}

export function clearFormDraft(userId: string, formId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(formDraftKey(userId, formId));
  } catch {}
}

export function clearUserFormDrafts(userId: string): void {
  const storage = getStorage();
  if (!storage) return;
  const userPrefix = FORM_DRAFT_PREFIX + encodeURIComponent(userId) + ":";
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(userPrefix)) keys.push(key);
    }
    keys.forEach(function (key) {
      storage.removeItem(key);
    });
  } catch {}
}
