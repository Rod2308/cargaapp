// Small helpers to detect the runtime environment for the "Add to Home Screen" flow.
// Safe to call on the client only.

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSUA = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect touch to disambiguate
  const iPadOS =
    ua.includes("Macintosh") &&
    typeof document !== "undefined" &&
    (navigator.maxTouchPoints ?? 0) > 1;
  return (iOSUA || iPadOS) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

// iOS Safari only allows Web Push after the site is installed as a PWA (iOS 16.4+).
export function needsIOSInstallForPush(): boolean {
  return isIOS() && !isStandalonePWA();
}
