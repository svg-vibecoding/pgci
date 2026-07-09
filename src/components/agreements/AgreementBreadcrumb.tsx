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
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className="text-muted-foreground">
            <Link to="/pgci/agreements">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a acuerdos
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {current === "detail" ? (
            <BreadcrumbPage className="font-medium text-foreground">
              Información General
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild className="text-muted-foreground">
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
              <BreadcrumbPage className="font-medium text-foreground">
                Posiciones
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
