import { createFileRoute } from "@tanstack/react-router";
import { SumatecLogo } from "@/components/SumatecLogo";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Chip,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  type StatusBadgeStatus,
} from "@/components/sumatec";
import { Search, Bell, User, Check, Building2, Zap } from "lucide-react";

export const Route = createFileRoute("/sistema-diseno")({
  head: () => ({
    meta: [
      { title: "Sumatec Digital Design System" },
      {
        name: "description",
        content:
          "Referencia viva del Sumatec Digital Design System: color, tipografía, espaciado, sombras y componentes base (StatusBadge, Table). Transversal a los productos digitales de Sumatec.",
      },
      { property: "og:title", content: "Sumatec Digital Design System" },
      {
        property: "og:description",
        content:
          "Color, tipografía, espaciado y componentes base de Sumatec. PGCI es la primera implementación operativa, no el dueño del sistema.",
      },
      { property: "og:url", content: "/sistema-diseno" },
    ],
    links: [{ rel: "canonical", href: "/sistema-diseno" }],
  }),
  component: DesignSystem,
});

const redRamp = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const blueRamp = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const grayRamp = [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

const semantic = [
  { name: "Info", soft: "var(--info-soft)", main: "var(--info)", strong: "var(--info-strong)" },
  { name: "Éxito", soft: "var(--success-soft)", main: "var(--success)", strong: "var(--success-strong)" },
  { name: "Alerta", soft: "var(--warning-soft)", main: "var(--warning)", strong: "var(--warning-strong)" },
  { name: "Error", soft: "var(--error-soft)", main: "var(--error)", strong: "var(--error-strong)" },
];

const statusTokens: { key: StatusBadgeStatus; name: string }[] = [
  { key: "active", name: "active" },
  { key: "pending", name: "pending" },
  { key: "review", name: "review" },
  { key: "success", name: "success" },
  { key: "warning", name: "warning" },
  { key: "danger", name: "danger" },
  { key: "info", name: "info" },
  { key: "neutral", name: "neutral" },
];

const typeScale = [
  { cls: "suma-display-lg", label: "Display LG · Montserrat Black 56", sample: "La industria nunca para" },
  { cls: "suma-display-sm", label: "Display SM · Bold 36", sample: "Una compañía confiable" },
  { cls: "suma-h1", label: "H1 · Bold 30", sample: "Título de página" },
  { cls: "suma-h2", label: "H2 · Bold 24", sample: "Sección de contenido" },
  { cls: "suma-h3", label: "H3 · SemiBold 20", sample: "Título de tarjeta" },
  { cls: "suma-subtitle", label: "Subtitle · SemiBold 16", sample: "Énfasis en interfaz" },
  { cls: "suma-body", label: "Body · Roboto Regular 14", sample: "Texto de cuerpo por defecto para lectura cómoda." },
  { cls: "suma-caption", label: "Caption · Regular 12", sample: "Notas y metadatos" },
  { cls: "suma-overline", label: "Overline · Bold 11 · uppercase", sample: "Categoría" },
];

const shadows = [
  { name: "shadow-xs", value: "var(--shadow-xs)" },
  { name: "shadow-sm", value: "var(--shadow-sm)" },
  { name: "shadow-md", value: "var(--shadow-md)" },
  { name: "shadow-lg", value: "var(--shadow-lg)" },
  { name: "shadow-brand", value: "var(--shadow-brand)" },
];

const radii = [
  { name: "xs · 4", value: "var(--radius-xs)" },
  { name: "sm · 6", value: "var(--radius-sm)" },
  { name: "md · 8", value: "var(--radius-md)" },
  { name: "lg · 12", value: "var(--radius-lg)" },
  { name: "xl · 16", value: "var(--radius-xl)" },
  { name: "pill", value: "var(--radius-pill)" },
];

const acuerdos: {
  codigo: string;
  cliente: string;
  nit: string;
  monto: string;
  estado: StatusBadgeStatus;
}[] = [
  { codigo: "ACU-10293", cliente: "Aceros del Café", nit: "900.123.456-7", monto: "$ 48.900.000", estado: "active" },
  { codigo: "ACU-10311", cliente: "Cementos Andinos", nit: "830.998.221-1", monto: "$ 12.450.000", estado: "pending" },
  { codigo: "ACU-10342", cliente: "Minera La Esperanza", nit: "901.554.880-3", monto: "$ 7.320.000", estado: "review" },
  { codigo: "ACU-10355", cliente: "Energía del Valle", nit: "860.012.345-9", monto: "$ 129.900.000", estado: "danger" },
];

function Swatch({ varName, label }: { varName: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-14 w-full rounded-md border border-[var(--border-subtle)]"
        style={{ background: varName }}
      />
      <span className="suma-caption">{label}</span>
    </div>
  );
}

function Section({
  overline,
  title,
  children,
}: {
  overline: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="suma-overline">{overline}</span>
        <h2 className="suma-h2">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function DesignSystem() {
  return (
    <div className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      {/* Utility strip oscuro de marca */}
      <div className="bg-[var(--surface-inverse)] text-[var(--text-on-brand)]">
        <div className="mx-auto flex h-[34px] max-w-[1280px] items-center justify-between px-6">
          <span className="suma-caption !text-[var(--gray-300)]">
            Manizales, Caldas · Colombia
          </span>
          <span className="suma-caption !text-[var(--gray-300)]">sumatec.co</span>
        </div>
      </div>

      {/* Topbar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-4 px-6">
          <SumatecLogo className="h-7 w-auto" />
          <span className="suma-overline">Sumatec Digital Design System</span>
          <div className="ml-auto flex items-center gap-4 text-[var(--text-secondary)]">
            <Search size={18} aria-hidden="true" />
            <Bell size={18} aria-hidden="true" />
            <User size={18} aria-hidden="true" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1280px] flex-col gap-14 px-6 py-12">
        {/* Hero */}
        <div className="suma-container-shape flex flex-col gap-3 p-10 shadow-[var(--shadow-brand)]">
          <span className="suma-overline !text-[rgba(255,255,255,0.7)]">v1.0 · Junio 2026</span>
          <h1 className="suma-display-md">Sumatec Digital Design System</h1>
          <p className="suma-body max-w-2xl !text-[rgba(255,255,255,0.88)]">
            Base visual transversal de los productos digitales de Sumatec.
            PGCI (Plataforma de Gestión Comercial Inteligente) es la primera
            implementación operativa del sistema — no su dueño. Todo lo que se
            construya se rige por estos tokens de color, tipografía y espaciado.
          </p>
        </div>

        {/* ── FUNDAMENTOS ──────────────────────────────────────── */}
        <Section overline="Fundamentos" title="Color">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="suma-h4 mb-3">Rojo Sumatec</h3>
              <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
                {redRamp.map((s) => (
                  <Swatch key={s} varName={`var(--red-${s})`} label={`${s}`} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="suma-h4 mb-3">Azul Institucional</h3>
              <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
                {blueRamp.map((s) => (
                  <Swatch key={s} varName={`var(--blue-${s})`} label={`${s}`} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="suma-h4 mb-3">Neutros · Cool Gray</h3>
              <div className="grid grid-cols-6 gap-3 sm:grid-cols-11">
                {grayRamp.map((s) => (
                  <Swatch key={s} varName={`var(--gray-${s})`} label={`${s}`} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="suma-h4 mb-3">Estado semántico</h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {semantic.map((c) => (
                  <div key={c.name} className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                    <div className="flex h-16">
                      <div className="flex-1" style={{ background: c.soft }} />
                      <div className="flex-1" style={{ background: c.main }} />
                      <div className="flex-1" style={{ background: c.strong }} />
                    </div>
                    <span className="suma-caption block px-3 py-2">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="suma-h4 mb-3">Tokens de estado de dominio · --status-*</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {statusTokens.map((s) => (
                  <div key={s.key} className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                    <div className="flex h-12">
                      <div className="flex-1" style={{ background: `var(--status-${s.key}-soft)` }} />
                      <div className="flex-1" style={{ background: `var(--status-${s.key}-base)` }} />
                      <div className="flex-1" style={{ background: `var(--status-${s.key}-strong)` }} />
                    </div>
                    <span className="suma-caption block px-3 py-2 font-[var(--font-mono)]">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section overline="Fundamentos" title="Tipografía">
          <div className="flex flex-col gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            {typeScale.map((t) => (
              <div key={t.cls} className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-4 last:border-0 last:pb-0">
                <span className="suma-overline">{t.label}</span>
                <span className={t.cls}>{t.sample}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Sombras + radios */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Section overline="Fundamentos" title="Elevación">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
              {shadows.map((s) => (
                <div key={s.name} className="flex flex-col items-center gap-2">
                  <div
                    className="h-16 w-full rounded-md bg-[var(--surface-card)]"
                    style={{ boxShadow: s.value }}
                  />
                  <span className="suma-caption">{s.name}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section overline="Fundamentos" title="Radios">
            <div className="grid grid-cols-3 gap-5 sm:grid-cols-6">
              {radii.map((r) => (
                <div key={r.name} className="flex flex-col items-center gap-2">
                  <div
                    className="h-16 w-full border border-[var(--border-default)] bg-[var(--surface-sunken)]"
                    style={{ borderRadius: r.value }}
                  />
                  <span className="suma-caption text-center">{r.name}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── COMPONENTES BASE ─────────────────────────────────── */}
        <Section overline="Componentes · shadcn" title="Botones">
          <p className="suma-caption max-w-2xl">
            La UI general (botones, inputs, formularios, diálogos) usa shadcn
            alineado a los tokens. Reserva un solo botón primario por vista.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <Zap size={16} aria-hidden="true" />
              Acción primaria
            </Button>
            <Button variant="outline">Ver detalle</Button>
            <Button variant="secondary">
              <Building2 size={16} aria-hidden="true" />
              Secundaria
            </Button>
            <Button variant="ghost">Más opciones</Button>
            <Button disabled>No disponible</Button>
          </div>
        </Section>

        <Section overline="Componentes · Sumatec" title="Badges y Chips">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge color="primary" variant="solid">Marca</Badge>
              <Badge color="accent">Info</Badge>
              <Badge color="success">Éxito</Badge>
              <Badge color="warning">Alerta</Badge>
              <Badge color="error">Error</Badge>
              <Badge color="neutral">Borrador</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Chip color="primary" selected icon={Check}>
                Seleccionado
              </Chip>
              <Chip color="accent" variant="outline" icon={Building2}>
                B2B
              </Chip>
              <Chip icon={Zap}>Energía</Chip>
              <Chip onRemove={() => {}}>Filtro removible</Chip>
            </div>
          </div>
        </Section>

        <Section overline="Componentes · Sumatec" title="StatusBadge">
          <p className="suma-caption max-w-2xl">
            Indicador de estado de dominio para tablas, cards y listas. Usa los
            tokens <code>--status-*</code> e iconografía lucide-react. Funciona
            con y sin icono.
          </p>
          <div className="flex flex-col gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
            <div className="flex flex-wrap items-center gap-2.5">
              {statusTokens.map((s) => (
                <StatusBadge key={s.key} status={s.key} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 border-t border-[var(--border-subtle)] pt-4">
              <span className="suma-caption mr-1">Sin icono · sm</span>
              {statusTokens.slice(0, 5).map((s) => (
                <StatusBadge key={s.key} status={s.key} size="sm" withIcon={false} />
              ))}
            </div>
          </div>
        </Section>

        <Section overline="Componentes · Sumatec" title="Table">
          <p className="suma-caption max-w-2xl">
            Tabla base para interfaces operativas. Columnas numéricas alineadas a
            la derecha (tabular-nums), códigos/NITs en mono y celdas compatibles
            con StatusBadge.
          </p>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2">
            <Table>
              <TableCaption>Acuerdos comerciales · ejemplo</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>NIT</TableHead>
                  <TableHead numeric>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acuerdos.map((a) => (
                  <TableRow key={a.codigo} interactive>
                    <TableCell mono>{a.codigo}</TableCell>
                    <TableCell style={{ color: "var(--text-primary)" }}>{a.cliente}</TableCell>
                    <TableCell mono>{a.nit}</TableCell>
                    <TableCell numeric>{a.monto}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.estado} size="sm" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      </main>

      <footer className="bg-[var(--surface-inverse)] text-[var(--text-on-brand)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-1 px-6 py-8">
          <span className="suma-h4">Sumatec Digital Design System</span>
          <p className="suma-caption !text-[var(--gray-400)]">
            Transversal a los productos digitales de Sumatec. · sumatec.co
          </p>
        </div>
      </footer>
    </div>
  );
}
