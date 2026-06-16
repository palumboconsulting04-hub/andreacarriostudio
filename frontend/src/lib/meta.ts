// Helpers de cliente para el Meta (Facebook) Pixel del funnel de inscripción.

export const FB_PIXEL_ID = "2024231855152441";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Dispara un evento estándar del Pixel. Si se pasa eventID, se usa para
// deduplicar con el mismo evento enviado por la Conversions API (servidor).
export function fbTrack(
  event: string,
  params?: Record<string, unknown>,
  opts?: { eventID?: string },
) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (opts?.eventID) window.fbq("track", event, params ?? {}, opts);
  else window.fbq("track", event, params ?? {});
}

// Lee una cookie por nombre (para _fbc / _fbp, que Meta usa para casar la conversión).
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  return document.cookie.split("; ").find(c => c.startsWith(name + "="))?.split("=")[1] || null;
}
