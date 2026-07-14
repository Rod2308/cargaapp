import { useEffect, useState } from "react";

// Small ping to a reliably reachable, cache-bustable resource on the same origin.
// We use the PWA manifest because it's static, tiny, and always deployed.
const PING_URL = "/manifest.webmanifest";
const PING_TIMEOUT_MS = 4000;
const PING_INTERVAL_MS = 20000;

async function realPing(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  if (typeof fetch === "undefined") return true;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(`${PING_URL}?_=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
      // Avoid CORS/opaque issues since it's same-origin.
      credentials: "omit",
    });
    return res.ok || res.status === 304;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    const verify = async () => {
      const ok = await realPing();
      if (!cancelled) setOnline(ok);
    };

    const onBrowserOnline = () => {
      // Browser says online — verify with a real request before trusting it.
      void verify();
    };
    const onBrowserOffline = () => {
      // Browser is authoritative when it says offline.
      setOnline(false);
    };
    const onFocus = () => void verify();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void verify();
    };

    window.addEventListener("online", onBrowserOnline);
    window.addEventListener("offline", onBrowserOffline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // Initial verification and periodic re-checks catch captive portals,
    // dead Wi-Fi, and cases where `navigator.onLine` lies.
    void verify();
    interval = window.setInterval(verify, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      window.removeEventListener("online", onBrowserOnline);
      window.removeEventListener("offline", onBrowserOffline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return online;
}
