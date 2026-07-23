import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initRememberMe } from "@/lib/remember-me";

// Hidrata token temporário (sessionStorage → localStorage) antes do Supabase client inicializar.
initRememberMe();

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // gcTime alto é obrigatório para o persister conseguir guardar as
        // queries em IndexedDB (queries expiradas antes disso não persistem).
        gcTime: 1000 * 60 * 60 * 24 * 30, // 30 dias
        refetchOnWindowFocus: false,
        retry: 1,
        refetchOnReconnect: "always",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30 * 1000,
    defaultPreloadDelay: 50,
  });

  return router;
};

