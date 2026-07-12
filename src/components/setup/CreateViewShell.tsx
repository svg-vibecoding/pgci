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
        <h1 className="suma-h1 text-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 suma-body text-text-secondary">{description}</p>
        )}
      </header>
      <div className="mx-auto max-w-2xl">{children}</div>
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
