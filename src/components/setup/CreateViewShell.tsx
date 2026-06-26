import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function CreateViewShell({
  backLink,
  title,
  description,
  children,
}: {
  backLink: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      {backLink}
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

export function BackLinkChrome({ label }: { label: string }) {
  return (
    <>
      <ArrowLeft className="mr-1.5 h-4 w-4" /> {label}
    </>
  );
}
