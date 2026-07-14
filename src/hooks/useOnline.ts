import { useEffect, useState } from "react";

// Use more than one probe so a single blocked/static route does not create a false offline warning.
const SAME_ORIGIN_PING_URL = "/favicon.png";
const EXTERNAL_PING_URL = "https://www.gstatic.com/generate_204";
const PING_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 20000;
const FAILURES_BEFORE_OFFLINE = 3;

function withCacheBust(url: string) {
  return `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

async function realPing(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  if (typeof fetch === "undefined") return true;

  try {
    const res = await fetchWithTimeout(withCacheBust(SAME_ORIGIN_PING_URL), {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    return res.ok || res.status === 304;
  } catch {
    try {
      // Cross-origin no-cors requests return an opaque response when the internet is reachable.
      const res = await fetchWithTimeout(withCacheBust(EXTERNAL_PING_URL), {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
      });
      return res.type === "opaque" || res.ok || res.status === 0 || res.status === 204;
    } catch {
      return false;
    }
  }
}

export function useOnline(): boolean {
  // Start as online so SSR/preview environments never render a false offline banner.
  // The browser-only effect below can still switch to offline after verified failures.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;
    let consecutiveFailures = 0;

    const verify = async () => {
      const ok = await realPing();
      if (cancelled) return;

      if (ok) {
        consecutiveFailures = 0;
        setOnline(true);
        return;
      }

      consecutiveFailures += 1;
      setOnline(consecutiveFailures >= FAILURES_BEFORE_OFFLINE ? false : true);
    };

    const onBrowserOnline = () => {
      // Browser says online — verify with a real request before trusting it.
      void verify();
    };
    const onBrowserOffline = () => {
      // Browser is authoritative when it says offline.
      consecutiveFailures = FAILURES_BEFORE_OFFLINE;
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
