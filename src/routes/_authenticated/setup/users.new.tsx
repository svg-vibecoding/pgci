import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/new")({
  head: () => ({ meta: [{ title: "Crear usuario · Setup · PGCI" }] }),
  component: NewUserPlaceholder,
});

function NewUserPlaceholder() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/setup/users">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a usuarios
        </Link>
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Crear usuario</h1>
      <p className="text-sm text-muted-foreground">
        Formulario disponible en el siguiente paso de implementación.
      </p>
    </div>
  );
}
