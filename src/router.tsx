import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { authStore } from "./integrations/supabase/auth-store";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient, authStore },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
