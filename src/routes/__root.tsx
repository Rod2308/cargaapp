import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { registerSW } from "@/lib/register-sw";
import { initSyncQueue } from "@/lib/offline-queue";
import { SyncStatus } from "@/components/SyncStatus";
import { InstallPrompt } from "@/components/InstallPrompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-4 text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente ou volte ao início.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Tentar de novo
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Carga — seu treino de academia, do seu jeito" },
      { name: "description", content: "Monte seus treinos A, B, C, registre carga e repetições e receba sugestões inteligentes de descanso e progressão." },
      { property: "og:title", content: "Carga — seu treino de academia, do seu jeito" },
      { property: "og:description", content: "Monte seus treinos A, B, C, registre carga e repetições e receba sugestões inteligentes de descanso e progressão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#ffffff" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Carga" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "twitter:title", content: "Carga — seu treino de academia, do seu jeito" },
      { name: "twitter:description", content: "Monte seus treinos A, B, C, registre carga e repetições e receba sugestões inteligentes de descanso e progressão." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/00425b45-eeac-49c1-8a72-fbb87d9cff32/id-preview-84b6e1cb--a45a51fe-d372-477e-98b1-329caa5ebd07.lovable.app-1783396862047.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/00425b45-eeac-49c1-8a72-fbb87d9cff32/id-preview-84b6e1cb--a45a51fe-d372-477e-98b1-329caa5ebd07.lovable.app-1783396862047.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://lgxwvmhaaxiymhjqmglk.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://lgxwvmhaaxiymhjqmglk.supabase.co" },
      { rel: "preload", as: "style", href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Inline pre-hydration script prevents a flash of the wrong theme.
  const themeInit = `(function(){try{var t=localStorage.getItem('carga-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    registerSW();
    initSyncQueue();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    // Native OAuth bridge: detect when Chrome Custom Tab returns with auth
    const urlParams = new URLSearchParams(window.location.search);
    const isNativeOAuthCallback = urlParams.get("native") === "1";
    const isInWebView = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
    let nativeAuthUnsub: (() => void) | undefined;

    if (isNativeOAuthCallback && !isInWebView) {
      let nativeRedirected = false;
      const redirectNativeSession = (session: { access_token: string; refresh_token: string }) => {
        if (nativeRedirected) return;
        nativeRedirected = true;
        window.location.href = `com.carga.app://login-callback#access_token=${session.access_token}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
      };

      const { data: nativeAuthListener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (event === "SIGNED_IN" && session) {
            nativeAuthListener.subscription.unsubscribe();
            redirectNativeSession(session);
          }
        }
      );
      nativeAuthUnsub = () => nativeAuthListener.subscription.unsubscribe();

      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          redirectNativeSession(data.session);
        }
      });
    }

    let removeUrlListener: (() => void) | undefined;
    const isNative =
      typeof window !== "undefined" &&
      (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
    if (isNative) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appUrlOpen", async ({ url }) => {
          if (!url.includes("login-callback") && !url.includes("access_token") && !url.includes("code=")) return;
          try {
            const parsed = new URL(url);
            const code = parsed.searchParams.get("code");
            if (code) {
              await supabase.auth.exchangeCodeForSession(code);
              return;
            }
            const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
            const params = new URLSearchParams(hash);
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");
            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
            }
          } catch (e) {
            console.error("OAuth callback error", e);
          }
        }).then((handle) => {
          removeUrlListener = () => handle.remove();
        });
      });
    }
    return () => {
      data.subscription.unsubscribe();
      nativeAuthUnsub?.();
      removeUrlListener?.();
    };
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <SyncStatus />
      <InstallPrompt />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
