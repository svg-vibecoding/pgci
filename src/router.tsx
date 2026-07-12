import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthLoadingScreen } from "./components/AuthLoadingScreen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
    // Pantalla única mientras beforeLoad async (waitForAuthReady + redirects)
    // resuelve en `/`, `/auth` y `_authenticated`. Sin ventana en blanco.
    defaultPendingComponent: AuthLoadingScreen,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });

  return router;
};
