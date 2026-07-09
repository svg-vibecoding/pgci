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
  const currentItemClass =
    "inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-sm font-bold text-foreground";

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            asChild
            className="inline-flex items-center gap-1.5 text-muted-foreground"
          >
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
            <BreadcrumbLink
              asChild
              className="inline-flex items-center gap-1.5 text-muted-foreground"
            >
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
