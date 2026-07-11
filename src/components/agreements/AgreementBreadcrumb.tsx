import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface AgreementBreadcrumbProps {
  agreementId: string;
  current: "detail" | "lines";
}

export function AgreementBreadcrumb({ agreementId, current }: AgreementBreadcrumbProps) {
  const linkClass = "inline-flex items-center gap-1.5 suma-caption text-text-secondary hover:text-text-primary transition-colors";
  const currentItemClass = "inline-flex items-center suma-caption font-semibold text-text-primary";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={linkClass}>
            <Link to="/pgci/agreements">
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a acuerdos</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {current === "detail" ? (
            <BreadcrumbPage className={currentItemClass}>
              Información General
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild className={linkClass}>
              <Link to="/pgci/agreements/$agreementId" params={{ agreementId }}>
                Información General
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {current === "lines" && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className={currentItemClass}>
                Posiciones
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
