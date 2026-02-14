// Corrige fuso horário: "2026-02-13" (UTC meia-noite) -> "2026-02-13T12:00:00" (local)
// Datas no formato YYYY-MM-DD são interpretadas como UTC pelo JS, causando shift de 1 dia em fusos negativos
export const parseLocalDate = (d: string): Date => {
  if (!d) return new Date();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + 'T12:00:00');
  return new Date(d);
};
