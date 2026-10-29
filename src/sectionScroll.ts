/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
export function scrollToSectionHeading(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  const header = document.querySelector("[data-dashboard-header]");
  const offset = header?.getBoundingClientRect().height ?? 0;
  window.scrollTo({
    top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - offset - 20),
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}
