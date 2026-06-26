import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

type LinkProps = Parameters<typeof Link>[0];

export function CreateViewShell({
  backTo,
  backLabel,
  title,
  description,
  children,
}: {
  backTo: LinkProps;
  backLabel: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-muted-foreground"
      >
        <Link {...backTo}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {backLabel}
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </header>

      <div className="max-w-2xl">{children}</div>
    </div>
  );
}
