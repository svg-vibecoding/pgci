# Botón "Crear acuerdo": deshabilitar con nota, no ocultar

## Cambio respecto al plan anterior
Revertir la ocultación del botón. Sigue usándose la RPC `can_create_agreements()` como fuente única de verdad, pero el resultado ahora controla **estado enabled/disabled**, no visibilidad.

## Ubicación
`src/routes/_authenticated/pgci/agreements.index.tsx`, header de `AgreementsList` (el `<Button asChild><Link to="/pgci/agreements/new">…</Link></Button>` actual).

## Estados de render

**Habilitado** (`canCreate === true`): botón primario que navega a `/pgci/agreements/new`.
```tsx
<Button asChild>
  <Link to="/pgci/agreements/new">
    <Plus className="mr-2 h-4 w-4" /> Crear acuerdo
  </Link>
</Button>
```

**Deshabilitado** (`canCreate === false` o loading): botón real `disabled`, **no** un Link. No navega, no abre el formulario.
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span tabIndex={0}> {/* wrapper para que el tooltip funcione con disabled */}
      <Button disabled aria-disabled="true">
        <Lock className="mr-2 h-4 w-4" /> Crear acuerdo
      </Button>
    </span>
  </TooltipTrigger>
  <TooltipContent>
    Necesitas permiso para crear acuerdos. Solicítalo a un administrador.
  </TooltipContent>
</Tooltip>
```

Icono `Lock` de `lucide-react` (mismo que usa el picker de agrupadores). Durante loading el botón queda deshabilitado sin flash del CTA activo.

## Copy de la nota
Tomado de `src/components/agreements/AgreementGroupPicker.tsx:196-197`, adaptado al sujeto "acuerdos" para mantener paralelismo:

- Grupos (existente): _"Necesitas permiso para crear agrupadores. Solicítalo a un administrador."_
- Acuerdos (nuevo): _"Necesitas permiso para crear acuerdos. Solicítalo a un administrador."_

Misma estructura (dos frases, imperativo, "un administrador"), mismo icono candado. Consistente con §12 y §12.3 del sistema.

## Query
Se mantiene la del cambio anterior:
```ts
const { data: canCreate, isLoading } = useQuery({
  queryKey: ["rpc", "can_create_agreements"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("can_create_agreements");
    if (error) throw error;
    return !!data;
  },
});
const canCreateEnabled = canCreate === true; // false durante loading
```

## Fuera de alcance
- Backend, RLS, formulario, otras vistas con botones equivalentes.
- No se cambia el destino de la ruta ni la RPC.
