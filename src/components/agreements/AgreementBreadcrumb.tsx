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
          <BreadcrumbLink asChild>
            <Link to="/pgci/agreements">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a acuerdos
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {current === "detail" ? (
            <BreadcrumbPage>Información General</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
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
              <BreadcrumbPage>Posiciones</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
