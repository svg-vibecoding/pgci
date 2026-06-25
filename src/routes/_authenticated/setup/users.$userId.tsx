import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/setup/users/$userId")({
  component: () => <Outlet />,
});
