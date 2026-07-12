// Variante propia del attacher que espera a `waitForAuthReady()` antes de
// leer el token. Reemplaza al `attachSupabaseAuth` auto-generado en
// `src/start.ts` para evitar el race en el que `getSession()` devuelve vacío
// mientras supabase-js todavía está rehidratando desde localStorage.
//
// Este archivo NO es auto-generado y se puede editar libremente.

import { createMiddleware } from "@tanstack/react-start";
import { waitForAuthReady } from "./auth-ready";

export const attachSupabaseAuthReady = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const session = await waitForAuthReady();
    const token = session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  });
