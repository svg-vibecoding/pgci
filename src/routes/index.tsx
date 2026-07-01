import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SumatecLogo } from "@/components/SumatecLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PGCI · Sumatec" },
      {
        name: "description",
        content:
          "Accede a la PGCI, la Plataforma de Gestión Comercial Inteligente de Sumatec.",
      },
      { property: "og:title", content: "PGCI · Sumatec" },
      {
        property: "og:description",
        content:
          "Accede a la PGCI, la Plataforma de Gestión Comercial Inteligente de Sumatec.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-6 text-[var(--text-primary)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(var(--gray-500) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />
      <section className="relative mx-auto flex w-full max-w-[720px] flex-col items-center gap-6 text-center">
        <SumatecLogo className="h-14 w-auto" />
        <h1 className="suma-display-lg">
          <span className="block">La gestión comercial,</span>
          <span className="block">convertida en</span>
          <span className="block text-[var(--color-primary)]">
            fuente de verdad.
          </span>
        </h1>
        <p className="suma-landing-lead max-w-2xl">
          La{" "}
          <strong className="font-bold text-[var(--text-primary)]">PGCI</strong>{" "}
          reúne solicitudes, acuerdos, equivalencias de productos, precios,
          vigencias y condiciones comerciales en un solo lugar:{" "}
          <strong className="font-bold text-[var(--text-primary)]">
            Información estructurada, disponible y con todo su historial.
          </strong>
        </p>
        <div className="flex justify-center pt-2">
          <Link
            to="/auth"
            preload="intent"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 text-[var(--button)] font-bold text-[var(--text-on-brand)] shadow-[var(--shadow-brand)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-primary-hover)]"
          >
            Iniciar sesión
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
