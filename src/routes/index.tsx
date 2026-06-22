import { createFileRoute } from "@tanstack/react-router";
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
        <h1 className="suma-display-lg max-w-[18ch]">
          La gestión comercial, convertida en una{" "}
          <span className="text-[var(--color-primary)]">fuente de verdad.</span>
        </h1>
        <p className="suma-body max-w-2xl text-[var(--text-secondary)]">
          La <strong className="text-[var(--text-primary)]">PGCI</strong> reúne acuerdos, productos, códigos de
          cliente, precios, vigencias y las condiciones de nuestra relación con los clientes en un solo lugar:
          estructurado, consultable y con toda su trazabilidad.
        </p>
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 text-[var(--button)] font-bold text-[var(--text-on-brand)] shadow-[var(--shadow-brand)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-primary-hover)]"
          >
            Iniciar sesión
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}
