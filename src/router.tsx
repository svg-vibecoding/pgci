import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { InitialAuthPendingFallback } from "./components/AuthLoadingScreen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
    // Splash SOLO en el arranque en frío. Una vez la sesión resolvió,
    // InitialAuthPendingFallback devuelve null y la navegación interna
    // entre módulos es directa, sin splash.
    defaultPendingComponent: InitialAuthPendingFallback,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });

  return router;
};
