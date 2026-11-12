const INSULT_PATTERN =
  /\b(?:vieja\s+loca|viejo\s+loco|idiot[oa]s?|estupid[oa]s?|pendej[oa]s?|cabr[o]n(?:es)?|imbecil(?:es)?|culer[oa]s?|put[oa]s?|pinche(?:s)?|mierda|malparid[oa]s?|hijueputa|hijo\s+de\s+puta|tarad[oa]s?)\b/;

export function isInsultingCourierMessage(text) {
  const normalized = String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return INSULT_PATTERN.test(normalized);
}
