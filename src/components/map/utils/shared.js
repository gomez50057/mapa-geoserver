export const COORDINATE_DECIMALS = 7;

export function formatCoordinatePair(latlng) {
  if (!latlng) return "20.0830998, -98.7948132";
  return `${Number(latlng.lat).toFixed(COORDINATE_DECIMALS)}, ${Number(latlng.lng).toFixed(COORDINATE_DECIMALS)}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getFileExtension(fileName) {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const lastDotIndex = normalizedName.lastIndexOf(".");
  return lastDotIndex >= 0 ? normalizedName.slice(lastDotIndex) : "";
}
