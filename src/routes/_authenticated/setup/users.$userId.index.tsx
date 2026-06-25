import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/$userId/")({
  head: () => ({ meta: [{ title: "Detalle de usuario · Setup · PGCI" }] }),
  component: UserDetailPlaceholder,
});

function UserDetailPlaceholder() {
  const { userId } = Route.useParams();
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/setup/users">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a usuarios
        </Link>
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Detalle de usuario</h1>
      <p className="text-sm text-muted-foreground">
        Vista de detalle (id: {userId}) disponible en el siguiente paso.
      </p>
    </div>
  );
}
