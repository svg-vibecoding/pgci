import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/setup/clients/$clientId")({
  component: () => <Outlet />,
});
