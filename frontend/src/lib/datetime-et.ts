// Shared US Eastern Time formatting for partner- and admin-facing pages.
// Uses an explicit IANA zone so times render consistently in ET regardless
// of the viewer's browser locale/timezone (e.g. a trainer in India reviewing
// a US partner's submission sees the same ET timestamp the partner does).
const ET_ZONE = "America/New_York";

export function formatDateET(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    timeZone: ET_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatDateTimeET(value: string | Date): string {
  const formatted = new Date(value).toLocaleString("en-US", {
    timeZone: ET_ZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatted} ET`;
}
