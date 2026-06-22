import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Workflow,
  Puzzle,
  FolderOpen,
  RefreshCw,
  Inbox,
  GitCompare,
  FileSignature,
  Search,
  FileOutput,
  TrendingUp,
  SlidersHorizontal,
  LineChart,
  Headset,
  Zap,
  Info,
  MessagesSquare,
  ScanSearch,
  Clock,
  TriangleAlert,
  Target,
  Handshake,
  CircleCheck,
  PieChart,
  Share2,
  Hash,
  Layers,
  Barcode,
  CalendarCheck,
  Link2,
  History,
  WandSparkles,
  CalendarX,
  CircleHelp,
  BarChart3,
  Lightbulb,
  Quote,
  ArrowRight,
  MoveRight,
  FileText,
  Check,
  type LucideIcon,
} from "lucide-react";
import { SumatecLogo } from "@/components/SumatecLogo";
import { StatusBadge } from "@/components/sumatec";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PGCI · Plataforma de Gestión Comercial Inteligente | Sumatec" },
      {
        name: "description",
        content:
          "La PGCI de Sumatec reúne acuerdos, productos, precios, vigencias y homólogos en una sola fuente de verdad: estructurada, consultable y trazable, con IA de apoyo.",
      },
      { property: "og:title", content: "PGCI · Plataforma de Gestión Comercial Inteligente" },
      {
        property: "og:description",
        content:
          "La gestión comercial de Sumatec, convertida en una fuente de verdad. Acuerdos centralizados, consultables y trazables, con una capa de inteligencia artificial.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "PGCI — Plataforma de Gestión Comercial Inteligente",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          publisher: { "@type": "Organization", name: "Sumatec" },
          description:
            "Plataforma que reúne los acuerdos comerciales de Sumatec en una sola fuente de verdad: estructurada, consultable y trazable, con inteligencia artificial de apoyo.",
        }),
      },
    ],
  }),
  component: Landing,
});

const navLinks = [
  { href: "#partida", label: "El problema" },
  { href: "#vision", label: "La visión" },
  { href: "#ia", label: "El rol de la IA" },
  { href: "#construccion", label: "Roadmap" },
];

const losses: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Workflow,
    title: "Solicitudes sin trazabilidad",
    body: "Cada solicitud llega como un archivo. Lo que no encuentra match se responde a medias y no queda registrado en ningún lugar central.",
  },
  {
    icon: Puzzle,
    title: "Productos del cliente sin relación Sumatec",
    body: "De 100 productos pedidos, los que hoy no podemos atender se pierden. Son señales comerciales que nadie captura ni vuelve a mirar.",
  },
  {
    icon: FolderOpen,
    title: "Acuerdos difíciles de consultar",
    body: "Responder una duda exige saber en qué archivo y en qué hoja está, y que la persona que lo sabe esté disponible en ese momento.",
  },
  {
    icon: RefreshCw,
    title: "Precios que se desincronizan",
    body: "Un producto con varios códigos del cliente son varias filas que actualizar. Un olvido genera errores en órdenes, facturas y negociaciones.",
  },
];

const cycle: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Inbox, title: "Solicitud", body: "El cliente pide; queda registrada." },
  { icon: GitCompare, title: "Matching", body: "Producto del cliente ↔ Sumatec." },
  { icon: FileSignature, title: "Acuerdo", body: "Precios, condiciones y vigencias." },
  { icon: Search, title: "Consulta", body: "En segundos, por código o cliente." },
  { icon: FileOutput, title: "Exportación", body: "El formato que cada sistema necesita." },
  { icon: TrendingUp, title: "Evolución", body: "Histórico que se vuelve activo." },
];

const comparison = [
  {
    hoy: "La solicitud llega por correo como un Excel. El equipo busca matches a mano y lo que no tiene respuesta se pierde.",
    pgci: "La solicitud se registra y, en segundos, muestra qué ya está en un acuerdo vigente, qué tiene antecedentes y qué es nuevo. Nada se pierde.",
  },
  {
    hoy: "Consultar un acuerdo implica saber en qué archivo y hoja está. Si hay duda, hay que preguntarle a quien lo conoce.",
    pgci: "Cualquier persona con acceso consulta cualquier acuerdo en segundos —por producto, código o cliente— o le pregunta al Asistente IA.",
  },
  {
    hoy: "Actualizar un precio que aparece con varios códigos del cliente obliga a editar cada fila a mano. Un olvido desincroniza el acuerdo.",
    pgci: "La plataforma sabe que varios códigos son el mismo producto Sumatec. Al actualizar, el cambio se propaga. Sin olvidos.",
  },
  {
    hoy: "El historial de cotizaciones, precios ofertados y resultados no existe como dato estructurado. Cada negociación empieza de cero.",
    pgci: "Cada cotización y resultado queda registrado. La próxima negociación tiene contexto: qué se ofreció, a qué precio, con qué resultado.",
  },
];

const users: {
  icon: LucideIcon;
  title: string;
  role: string;
  accent: string;
  accentSoft: string;
  tags: string[];
  body: string;
}[] = [
  {
    icon: SlidersHorizontal,
    title: "Cuentas Corporativas",
    role: "Administradoras",
    accent: "var(--color-primary)",
    accentSoft: "var(--color-primary-soft)",
    tags: ["Administra", "Consulta", "Asigna"],
    body: "Crean y actualizan acuerdos, gestionan solicitudes y asignan trabajo. Visibilidad completa: precios, costos, márgenes e históricos en tiempo real.",
  },
  {
    icon: LineChart,
    title: "Gerentes regionales",
    role: "Decisión con contexto",
    accent: "var(--color-accent)",
    accentSoft: "var(--color-accent-soft)",
    tags: ["Decide", "Analiza", "Consulta"],
    body: "Consultan acuerdos con visibilidad de márgenes y costos, ven el histórico de cotizaciones y deciden negociaciones sin depender de reportes manuales.",
  },
  {
    icon: Headset,
    title: "Asesores comerciales",
    role: "Ejecutores en regional",
    accent: "var(--gray-600)",
    accentSoft: "var(--gray-100)",
    tags: ["Ejecuta", "Consulta"],
    body: "Consultan los acuerdos de sus clientes en segundos —productos, precios y condiciones vigentes, sin costos ni márgenes— y resuelven dudas con el Asistente IA.",
  },
];

const stages = [
  {
    n: "1",
    title: "El piloto",
    body: "Centralizamos los acuerdos de cuatro clientes, habilitamos la consulta inteligente y empezamos a registrar eventos. Validamos que la plataforma funciona y que el equipo la adopta.",
  },
  {
    n: "2",
    title: "Crecer en capacidades",
    body: "Más clientes, más usuarios, históricos más completos y análisis más sofisticados. La plataforma escala sobre una base ya validada.",
  },
  {
    n: "3",
    title: "Fuente de verdad de la organización",
    body: "Conexión con el ERP Jaivaná y alimentación de SumaGo y demás sistemas. La PGCI deja de ser una herramienta de un equipo y pasa a ser la fuente de verdad comercial de Sumatec.",
  },
];

const heroChain = ["Cliente", "Código cliente", "SKU Jaivaná", "Acuerdo", "Vigencia", "Estado"];


function Section({
  id,
  overline,
  title,
  intro,
  children,
}: {
  id?: string;
  overline: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mx-auto max-w-[1120px] px-6">
        <header className="mb-8 flex max-w-3xl flex-col gap-2">
          <span className="suma-overline !text-[var(--color-primary)]">{overline}</span>
          <h2 className="suma-display-md">{title}</h2>
          {intro ? (
            <p className="suma-landing-lead !text-[var(--text-secondary)]">{intro}</p>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  );
}




/* ── Sección IA con 4 tabs ──────────────────────────────────── */
const iaTabs = [
  { id: 0, num: "01", label: "Consulta" },
  { id: 1, num: "02", label: "Operativa" },
  { id: 2, num: "03", label: "Estratégica" },
  { id: 3, num: "04", label: "Inteligente" },
];

function ChatPanel() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-primary)] text-white">
              <Zap size={14} aria-hidden="true" />
            </span>
            <span className="suma-subtitle text-white">Asistente de Acuerdos</span>
          </div>
          <StatusBadge status="active" label="En línea" size="sm" />
        </div>

        <div className="mt-4 flex justify-end">
          <p className="max-w-[88%] rounded-2xl rounded-tr-sm bg-[var(--surface-inverse)] px-4 py-2.5 suma-landing-small !text-white ring-1 ring-[rgba(255,255,255,0.1)]">
            ¿Qué precio tiene la grasa multipropósito en el acuerdo de Coca-Cola y hasta cuándo está vigente?
          </p>
        </div>

        <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3">
          <p className="suma-landing-small !text-[var(--gray-300)]">
            En el acuerdo vigente de <strong className="text-white">Coca-Cola FEMSA</strong>:
          </p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {[
              { k: "Producto", v: "Grasa multipropósito EP-2", strong: false },
              { k: "Precio acuerdo", v: "$ 48.500 / und", strong: true },
              { k: "Vigencia", v: "Hasta 31 dic 2026", strong: false },
              { k: "Homólogos", v: "2 disponibles", strong: false },
            ].map((r) => (
              <div
                key={r.k}
                className="flex items-center justify-between rounded-lg bg-[rgba(255,255,255,0.04)] px-3 py-2"
              >
                <span className="suma-caption !text-[var(--gray-400)]">{r.k}</span>
                <span
                  className={`suma-caption !font-bold ${r.strong ? "!text-[var(--red-300)]" : "!text-white"}`}
                >
                  {r.v}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 suma-caption !text-[var(--gray-400)]">
            <Info size={13} className="text-[var(--blue-300)]" aria-hidden="true" />
            Respuesta basada en el acuerdo vigente. El equipo valida y decide.
          </p>
        </div>
      </div>

      <p className="suma-landing-body flex items-center gap-2 !text-[var(--gray-300)]">
        <MessagesSquare size={16} className="shrink-0 text-[var(--gray-400)]" aria-hidden="true" />
        El equipo y los asesores preguntan en lugar de buscar en un archivo. Respuestas precisas sobre acuerdos,
        precios, vigencias, productos y homólogos.
      </p>
    </div>
  );
}

function ListPanel({
  chipIcon,
  intro,
  items,
}: {
  chipIcon: LucideIcon;
  intro: string;
  items: { icon: LucideIcon; tone: string; text: string }[];
}) {
  const ChipIcon = chipIcon;
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.text}
              className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3.5"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                style={{ background: "rgba(255,255,255,0.06)", color: it.tone }}
              >
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="suma-landing-body !text-[var(--gray-300)]">{it.text}</span>
            </div>
          );
        })}
      </div>
      <p className="suma-landing-body flex items-center gap-2 !text-[var(--gray-300)]">
        <ChipIcon size={16} className="shrink-0 text-[var(--gray-400)]" aria-hidden="true" />
        {intro}
      </p>
    </div>
  );
}

function AnalyticsPanel() {
  const kpis: { value: string; label: string; icon: LucideIcon; tone: string }[] = [
    { value: "248", label: "Acuerdos activos", icon: FileSignature, tone: "var(--blue-300)" },
    { value: "17", label: "Vigencias por vencer · 90 días", icon: CalendarX, tone: "var(--warning)" },
    { value: "32", label: "Productos en múltiples acuerdos", icon: Layers, tone: "var(--red-300)" },
  ];
  const ranking = [
    { name: "Grasa multipropósito EP-2", count: 9, pct: 100 },
    { name: "Aceite hidráulico ISO 68", count: 7, pct: 78 },
    { name: "Refrigerante concentrado", count: 5, pct: 55 },
    { name: "Filtro de aire industrial", count: 4, pct: 44 },
  ];
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="flex flex-col gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3.5"
            >
              <Icon size={16} style={{ color: k.tone }} aria-hidden="true" />
              <span className="font-display text-[24px] font-bold leading-none text-white">{k.value}</span>
              <span className="suma-caption !text-[var(--gray-400)]">{k.label}</span>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="suma-overline !text-[var(--gray-400)]">
            Productos en más acuerdos
          </span>
          <span className="suma-caption !text-[var(--gray-500)]">acuerdos</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {ranking.map((r) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className="w-[170px] truncate suma-caption !text-[var(--gray-300)]">{r.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-pill bg-[rgba(255,255,255,0.07)]">
                <div
                  className="h-full rounded-pill bg-[var(--color-primary)]"
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <span className="w-5 text-right suma-caption !font-bold !text-white">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(217,16,32,0.1)] px-4 py-3">
        <Lightbulb size={18} className="shrink-0 text-[var(--red-300)]" aria-hidden="true" />
        <span className="suma-landing-body !text-[var(--gray-200)]">
          <strong className="text-white">8 clientes</strong> se verían impactados por un cambio en la lista de precios
          del EP-2. Un insumo para decidir —el criterio humano define.
        </span>
      </div>

      <p className="suma-landing-body flex items-center gap-2 !text-[var(--gray-300)]">
        <PieChart size={16} className="shrink-0 text-[var(--gray-400)]" aria-hidden="true" />
        La PGCI convierte información dispersa en una base que puede analizarse por cliente, producto, vigencia o
        condición —lectura útil para gerencia y Cuentas Corporativas.
      </p>
    </div>
  );
}

function IaSection() {
  const [active, setActive] = useState(0);

  return (
    <section id="ia" className="scroll-mt-8 bg-[var(--surface-inverse)]">
      <div className="relative overflow-hidden py-20">
        {/* glow rojo medido */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(217,16,32,0.3), transparent 70%)" }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0,51,161,0.25), transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-[1120px] px-6">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            {/* Columna texto */}
            <div className="flex flex-col gap-5">
              <span className="suma-overline !text-[var(--red-300)]">El rol de la inteligencia artificial</span>
              <h2 className="suma-display-sm !text-white">La IA consulta, interpreta y propone. El equipo decide.</h2>
              <p className="suma-landing-body !text-[var(--gray-300)]">
                La IA tiene un lugar central, pero definido con precisión: es una herramienta al servicio de quienes
                conocen el negocio, no la protagonista.
              </p>
              <ul className="mt-1 flex flex-col gap-3">
                {[
                  "No inventa: responde sobre lo que está cargado y vigente.",
                  "No reemplaza el criterio humano.",
                  "No toma decisiones sensibles por su cuenta.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 suma-landing-body !text-[var(--gray-200)]">
                    <CircleCheck size={16} className="mt-0.5 shrink-0 text-[var(--success)]" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Columna tabs */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                {iaTabs.map((tab) => {
                  const isActive = active === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActive(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[var(--button)] font-bold transition-colors duration-[var(--dur-fast)] ${
                        isActive
                          ? "bg-white text-[var(--surface-inverse)] shadow-[var(--shadow-md)]"
                          : "bg-[rgba(255,255,255,0.06)] text-[var(--gray-300)] hover:bg-[rgba(255,255,255,0.12)]"
                      }`}
                    >
                      <span className={isActive ? "text-[var(--color-primary)]" : "text-[var(--gray-500)]"}>
                        {tab.num}
                      </span>
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex min-h-[380px] flex-col rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5 lg:p-6">
                {active === 0 && <ChatPanel />}
                {active === 1 && (
                  <ListPanel
                    chipIcon={ScanSearch}
                    intro="La IA revisa la información estructurada para señalar lo que requiere atención del equipo —sin actuar por su cuenta."
                    items={[
                      { icon: Clock, tone: "var(--warning)", text: "Acuerdos próximos a vencer y vigencias por revisar." },
                      { icon: GitCompare, tone: "var(--blue-300)", text: "Diferencias entre una propuesta y el acuerdo vigente." },
                      { icon: TriangleAlert, tone: "var(--red-300)", text: "Ambigüedades, datos incompletos o posibles desincronizaciones." },
                    ]}
                  />
                )}
                {active === 2 && (
                  <ListPanel
                    chipIcon={Target}
                    intro="A medida que crece el histórico, la IA apoya a gerentes y Cuentas Corporativas en el análisis —siempre como insumo para decidir, no como decisión."
                    items={[
                      { icon: Handshake, tone: "var(--blue-300)", text: "Orientar una negociación con base en el histórico." },
                      { icon: LineChart, tone: "var(--blue-300)", text: "Sugerir precios e identificar patrones en las solicitudes." },
                      { icon: TrendingUp, tone: "var(--red-300)", text: "Estimar el impacto comercial de un cambio de lista de precios." },
                    ]}
                  />
                )}
                {active === 3 && <AnalyticsPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Epílogo visual: la PGCI, vista en acción ───────────────── */
function CardFuenteVerdad() {
  const rows: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Hash, label: "Código cliente", value: "CC-4471-A" },
    { icon: Barcode, label: "SKU Jaivaná", value: "17300023" },
    { icon: CalendarCheck, label: "Vigencia", value: "31 dic 2026" },
  ];
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-lg)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-primary)] text-white">
            <Share2 size={16} aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="suma-subtitle text-[var(--text-primary)]">Acuerdo activo</span>
            <span className="suma-caption !text-[var(--text-tertiary)]">Coca-Cola FEMSA</span>
          </div>
        </div>
        <StatusBadge status="active" label="Vigente" size="sm" />
      </div>

      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
        <span className="suma-caption !text-[var(--text-tertiary)]">Grasa multipropósito EP-2</span>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[24px] font-bold text-[var(--text-primary)]">$ 48.500</span>
          <span className="suma-caption !font-medium !text-[var(--text-tertiary)]">/ und</span>
        </div>
      </div>

      <div className="mt-3.5 flex flex-col gap-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
              <span className="inline-flex items-center gap-2 suma-caption !font-medium !text-[var(--text-tertiary)]">
                <Icon size={13} className="text-[var(--color-accent)]" aria-hidden="true" />
                {r.label}
              </span>
              <span className="suma-caption !font-bold !text-[var(--text-primary)]">{r.value}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3 suma-caption !font-medium !text-[var(--text-secondary)]">
        <Link2 size={14} className="text-[var(--color-accent)]" aria-hidden="true" />
        2 homólogos conectados
        <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--text-tertiary)]">
          <History size={13} aria-hidden="true" />
          Histórico activo
        </span>
      </div>
    </div>
  );
}

function CardConsulta() {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-lg)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-accent)] text-white">
            <WandSparkles size={16} aria-hidden="true" />
          </span>
          <span className="suma-subtitle text-[var(--text-primary)]">Consulta inteligente</span>
        </div>
        <StatusBadge status="active" label="En línea" size="sm" />
      </div>

      <div className="mt-4 flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--surface-sunken)] px-3.5 py-2.5 suma-landing-small !text-[var(--text-primary)]">
          ¿La grasa multipropósito sigue vigente para Coca-Cola y a qué precio?
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
        <span className="suma-caption !text-[var(--text-tertiary)]">Respuesta asistida</span>
        <p className="mt-1.5 suma-landing-small !text-[var(--text-secondary)]">
          Sí. En el acuerdo vigente de <strong className="text-[var(--text-primary)]">Coca-Cola FEMSA</strong>:
        </p>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {[
            { k: "Precio", v: "$ 48.500 / und" },
            { k: "Vigencia", v: "31 dic 2026" },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between rounded-lg bg-[var(--surface-card)] px-3 py-1.5">
              <span className="suma-caption !font-medium !text-[var(--text-tertiary)]">{r.k}</span>
              <span className="suma-caption !font-bold !text-[var(--text-primary)]">{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 suma-caption !font-semibold !text-[var(--warning-strong)]">
        <TriangleAlert size={14} className="shrink-0" aria-hidden="true" />
        Vence en 42 días — conviene revisar antes del cierre.
      </div>
    </div>
  );
}

function CardAnalisis() {
  const rows: { icon: LucideIcon; label: string; value: string; tone: string; soft: string }[] = [
    { icon: CalendarX, label: "Acuerdos por vencer", value: "7", tone: "var(--warning-strong)", soft: "var(--warning-soft)" },
    { icon: CircleHelp, label: "Productos sin match", value: "23", tone: "var(--error-strong)", soft: "var(--error-soft)" },
    { icon: Layers, label: "En múltiples acuerdos", value: "12", tone: "var(--color-accent)", soft: "var(--color-accent-soft)" },
  ];
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-lg)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--surface-inverse)] text-white">
            <BarChart3 size={16} aria-hidden="true" />
          </span>
          <span className="suma-subtitle text-[var(--text-primary)]">Visibilidad operativa</span>
        </div>
        <span className="suma-caption !text-[var(--text-tertiary)]">Hoy</span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ background: r.soft, color: r.tone }}>
                <Icon size={14} aria-hidden="true" />
              </span>
              <span className="flex-1 suma-caption !font-medium !text-[var(--text-secondary)]">{r.label}</span>
              <span className="font-display text-[24px] font-bold" style={{ color: r.tone }}>{r.value}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 rounded-xl bg-[var(--surface-sunken)] p-3.5">
        <span className="suma-caption !text-[var(--text-tertiary)]">Lectura ejecutiva</span>
        <p className="mt-1 suma-landing-small !text-[var(--text-secondary)]">
          Actualizar un precio impacta <strong className="text-[var(--text-primary)]">12 productos</strong> en{" "}
          <strong className="text-[var(--text-primary)]">4 acuerdos</strong>. El cambio se propaga sin olvidos.
        </p>
      </div>
    </div>
  );
}

function ProductEpilogue() {
  return (
    <section id="epilogo" className="scroll-mt-28 bg-[var(--surface-page)] pt-8 pb-16">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(var(--gray-500) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-[1120px] px-6">
          <header className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-3 text-center">
            <span className="suma-overline !text-[var(--color-primary)]">GESTIÓN COMERCIAL INTELIGENTE</span>
            <h2 className="suma-display-md">Lo que hoy está disperso, empieza a conectarse.</h2>
          </header>

          <div className="grid items-start gap-6 md:grid-cols-3 lg:gap-7">
            <div className="lg:-translate-y-3">
              <CardFuenteVerdad />
            </div>
            <div className="lg:translate-y-4">
              <CardConsulta />
            </div>
            <div className="lg:-translate-y-1">
              <CardAnalisis />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      {/* Topbar — limpio, sin línea roja */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-card)_85%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-6 px-6">
          <a href="#top" className="flex items-center gap-3">
            <SumatecLogo className="h-14 w-auto" />
            <span className="hidden h-5 w-px bg-[var(--border-default)] sm:block" />
            <span className="suma-overline hidden sm:block">PGCI</span>
          </a>
          <nav className="ml-auto hidden items-center gap-7 lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[var(--body-md)] font-medium text-[var(--text-secondary)] transition-colors duration-[var(--dur-fast)] hover:text-[var(--text-primary)]"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(var(--gray-500) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-[860px] flex-col items-center gap-6 px-6 py-20 text-center lg:py-28">
          <span className="suma-overline inline-flex w-fit items-center gap-2 rounded-pill bg-[var(--color-primary-soft)] px-3 py-1.5 !text-[var(--color-primary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
            Buildmood AI
          </span>
          <h1 className="suma-display-lg max-w-[18ch]">
            La gestión comercial, convertida en una{" "}
            <span className="text-[var(--color-primary)]">fuente de verdad.</span>
          </h1>
          <p className="suma-landing-lead max-w-2xl !text-[var(--text-secondary)]">
            La <strong className="text-[var(--text-primary)]">PGCI</strong> reúne acuerdos, productos, códigos de
            cliente, precios, vigencias y las condiciones de nuestra relación con los clientes en un solo lugar: estructurado,
            consultable y con toda su trazabilidad.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#vision"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[var(--color-primary)] px-6 text-[var(--button)] font-bold text-[var(--text-on-brand)] shadow-[var(--shadow-brand)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-primary-hover)]"
            >
              Nuestra visión
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href="#ia"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--surface-card)] px-6 text-[var(--button)] font-bold text-[var(--text-primary)] transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-sunken)]"
            >
              El rol de la IA
            </a>
          </div>

          {/* Recurso visual abstracto y ligero: la cadena de información conectada */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
            {heroChain.map((node, i) => (
              <div key={node} className="flex items-center gap-1">
                <span className="inline-flex items-center gap-2 rounded-pill border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 py-2 suma-caption !font-semibold !text-[var(--text-secondary)] shadow-[var(--shadow-xs)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                  {node}
                </span>
                {i < heroChain.length - 1 && (
                  <MoveRight size={14} className="text-[var(--border-strong)]" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="bg-[var(--surface-card)] py-20">
        {/* El punto de partida */}
        <Section
          id="partida"
          overline="El punto de partida"
          title="Hoy la operación vive entre Excel, correos y archivos dispersos."
        >
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:gap-8">
            <div className="flex flex-col gap-5">
              <p className="suma-landing-body !text-[var(--text-secondary)]">
                Sumatec gestiona acuerdos con grandes clientes corporativos: decenas o cientos de productos negociados,
                precios que cambian, condiciones por sede, homólogos y un flujo constante de solicitudes. Es un trabajo
                sofisticado que hoy se sostiene casi por completo en hojas de cálculo.
              </p>
              <p className="suma-landing-body !text-[var(--text-secondary)]">
                El equipo de Cuentas Corporativas es experto en lo que hace. El conocimiento está organizado para
                archivarse, no para consultarse.
              </p>
            </div>

            <aside className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)] self-start">
              <Quote size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
              <p className="suma-h3 !leading-[1.3]">
                El problema es que la información no tiene una estructura común para capturarse,
                conectarse y consultarse.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { icon: Inbox, label: "Capturar" },
                  { icon: Link2, label: "Conectar" },
                  { icon: Search, label: "Consultar" },
                ].map((c) => {
                  const Icon = c.icon;
                  return (
                    <span
                      key={c.label}
                      className="inline-flex items-center gap-1.5 rounded-pill bg-[var(--color-primary-soft)] px-3 py-1.5 suma-caption !font-bold !text-[var(--color-primary)]"
                    >
                      <Icon size={14} aria-hidden="true" />
                      {c.label}
                    </span>
                  );
                })}
              </div>
            </aside>
          </div>
        </Section>
      </div>

      <div className="flex flex-col gap-24 py-10">
        {/* Qué se pierde hoy */}
        <Section
          overline="Qué se pierde hoy"
          title="Pérdidas que no siempre son visibles, pero que cuestan."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {losses.map((p) => {
              const Icon = p.icon;
              return (
                <article
                  key={p.title}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--shadow-md)]"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--error-soft)] text-[var(--error-strong)]">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="suma-h4">{p.title}</h3>
                  <p className="suma-landing-body !text-[var(--text-secondary)]">{p.body}</p>
                </article>
              );
            })}
          </div>
        </Section>

        {/* La visión — ciclo */}
        <Section
          id="vision"
          overline="La visión de la PGCI"
          title="Una plataforma que acompaña el ciclo comercial completo."
          intro="Desde que llega una solicitud, pasando por la negociación, hasta los acuerdos vigentes y su evolución en el tiempo. No un sistema impuesto desde afuera, sino la herramienta que el equipo necesita para hacer mejor su trabajo."
        >
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
            {cycle.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="relative flex flex-col items-center gap-3 text-center">
                  {/* línea de flujo */}
                  {i < cycle.length - 1 && (
                    <span
                      className="absolute left-1/2 top-7 hidden h-px w-full bg-[var(--border-default)] lg:block"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-inverse)] text-white shadow-[var(--shadow-sm)]">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="suma-overline !text-[var(--text-tertiary)]">0{i + 1}</span>
                  <h3 className="suma-subtitle">{c.title}</h3>
                  <p className="suma-landing-small !text-[var(--text-secondary)]">{c.body}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* IA */}
        <IaSection />

        {/* Hoy vs Con la PGCI — full-bleed oscuro, pares conectados */}
        <section id="cambio" className="scroll-mt-8 bg-[var(--surface-inverse)]">
          <div className="relative overflow-hidden py-20">
            {/* glow rojo medido */}
            <div
              className="pointer-events-none absolute -left-20 top-10 h-80 w-80 rounded-full opacity-30 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(217,16,32,0.3), transparent 70%)" }}
              aria-hidden="true"
            />
            <div className="relative mx-auto max-w-[1120px] px-6">
              <header className="mb-12 flex max-w-3xl flex-col gap-3">
                <span className="suma-overline !text-[var(--red-300)]">Hoy vs. con la PGCI</span>
                <h2 className="suma-display-sm !text-white">El mismo trabajo,<br />sin el esfuerzo invisible.</h2>
              </header>

              <div className="flex flex-col gap-5">
                {comparison.map((row, i) => (
                  <div
                    key={i}
                    className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-3"
                  >
                    {/* HOY */}
                    <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <FileText size={13} className="text-[var(--gray-400)]" aria-hidden="true" />
                        <span className="suma-overline !text-[var(--gray-400)]">Hoy</span>
                      </div>
                      <p className="suma-landing-body !text-[var(--gray-300)]">{row.hoy}</p>
                    </div>

                    {/* flecha */}
                    <div className="flex items-center justify-center text-[var(--gray-500)] md:px-1">
                      <ArrowRight size={16} className="rotate-90 md:rotate-0" aria-hidden="true" />
                    </div>

                    {/* CON LA PGCI */}
                    <div className="rounded-2xl border border-[rgba(217,16,32,0.5)] bg-[rgba(217,16,32,0.08)] p-6">
                      <div className="mb-3 flex items-center gap-2">
                        <Zap size={13} className="text-[var(--color-primary)]" aria-hidden="true" />
                        <span className="suma-overline !text-[var(--color-primary)]">Con la PGCI</span>
                      </div>
                      <p className="suma-landing-body !text-white">{row.pgci}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      <div className="flex flex-col gap-24 py-10 pb-14">
        {/* Quién usa la plataforma */}
        <Section
          overline="Quién usa la plataforma"
          title="Múltiples roles, una sola fuente de verdad."
        >
          <div className="grid gap-5 md:grid-cols-3">
            {users.map((u) => {
              const Icon = u.icon;
              return (
                <article
                  key={u.title}
                  className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--shadow-md)]"
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ background: u.accent }} aria-hidden="true" />
                  <div className="flex items-center justify-between">
                    <span
                      className="grid h-12 w-12 place-items-center rounded-xl text-white"
                      style={{ background: u.accent }}
                    >
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span
                      className="suma-overline rounded-pill px-2.5 py-1"
                      style={{ background: u.accentSoft, color: u.accent }}
                    >
                      {u.role}
                    </span>
                  </div>
                  <h3 className="suma-h4">{u.title}</h3>
                  <p className="suma-landing-body !text-[var(--text-secondary)]">{u.body}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {u.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-sunken)] px-2.5 py-1 suma-caption !font-semibold !text-[var(--text-secondary)]"
                      >
                        <Check size={11} className="text-[var(--success)]" aria-hidden="true" />
                        {t}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </Section>

        {/* Cómo se construye */}
        <Section
          id="construccion"
          overline="Cómo se construye"
          title="Por etapas. Cada una demuestra valor antes de escalar."
          intro="La primera versión es pequeña, operable y enfocada en demostrar valor real con lo que ya existe. Empezamos por donde tiene más sentido."
        >
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
            {/* Piloto */}
            <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-7 shadow-[var(--shadow-sm)]">
              <span className="suma-overline !text-[var(--color-primary)]">Piloto · cuatro clientes</span>
              <p className="suma-landing-body !text-[var(--text-secondary)]">
                Centralizamos los acuerdos de cuatro clientes y demostramos valor con lo que ya existe, desde el primer
                día.
              </p>
              <div className="mt-1 grid grid-cols-2 gap-3">
                {["Argos", "Coca-Cola", "Corona", "Grupo Bios"].map((c) => (
                  <span
                    key={c}
                    className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-3 suma-body !font-bold !text-[var(--text-primary)]"
                  >
                    <CircleCheck size={16} className="text-[var(--success)]" aria-hidden="true" />
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Roadmap */}
            <div className="relative flex flex-col gap-7 pl-2">
              {stages.map((s, i) => (
                <div key={s.title} className="relative flex gap-5">
                  {i < stages.length - 1 && (
                    <span
                      className="absolute left-[18px] top-10 h-[calc(100%+12px)] w-px bg-[var(--border-default)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-[var(--surface-inverse)] font-display text-[14px] font-bold text-white">
                    {s.n}
                  </span>
                  <div className="flex flex-col gap-1.5 pb-1">
                    <h3 className="suma-h4">{s.title}</h3>
                    <p className="suma-landing-body !text-[var(--text-secondary)]">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* CTA final */}
        <section id="contacto" className="scroll-mt-28">
          <div className="mx-auto max-w-[1120px] px-6">
            <div className="relative overflow-hidden rounded-3xl bg-[var(--surface-inverse)] px-8 py-16 text-center shadow-[var(--shadow-lg)] lg:px-14 lg:py-20">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
                style={{ background: "radial-gradient(circle, rgba(217,16,32,0.4), transparent 70%)" }}
                aria-hidden="true"
              />
              <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
                <span className="suma-overline !text-[var(--red-300)]">El primer paso</span>
                <h2 className="suma-display-md !text-white">
                  La PGCI empieza donde hoy se pierde más valor: la información comercial dispersa.
                </h2>
                <p className="suma-landing-body !text-[var(--gray-300)]">
                  El primer paso no es automatizarlo todo. Es construir una base confiable para cargar, consultar,
                  mantener y exportar acuerdos desde una sola fuente de verdad.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ProductEpilogue />



      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <SumatecLogo className="h-8 w-auto" />
            <span className="h-5 w-px bg-[var(--border-default)]" />
            <span className="suma-caption !text-[var(--text-secondary)]">
              PGCI · Plataforma de Gestión Comercial Inteligente
            </span>
          </div>
          <p className="suma-caption !text-[var(--text-tertiary)]">
            Cuentas Corporativas · Buildmood AI · Junio 2026 · sumatec.co
          </p>
        </div>
      </footer>
    </div>
  );
}
