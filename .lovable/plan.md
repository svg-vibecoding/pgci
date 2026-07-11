## Cambio

Actualizar `src/components/ui/input.tsx` para que todos los `Input` de la app hereden tipografía y placeholder del sistema Sumatec, sin excepciones responsive.

## Detalle

Reemplazar en el `className` del `<input>`:

- `text-base ... md:text-sm` → clase de utilidad `suma-body` (Roboto 14px / 20px, `--fw-regular`, `--font-body`). Tamaño único en mobile y desktop, coherente con el resto del sistema.
- `placeholder:text-muted-foreground` → `placeholder:text-text-tertiary` (token Sumatec `#8A8F9C`).
- Mantener intactos: alto (`h-9`), radios, borde, fondo (`bg-card`), padding, focus ring, disabled — son parte del contrato visual del componente y no son tipográficos.

Resultado del `className` final (referencia):

```
flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 suma-body shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50
```

## Impacto

- Aplica a **todos** los `Input` de la app (buscadores, formularios, imports, diálogos).
- No cambia altura ni layout, sólo familia/tamaño de fuente y color de placeholder.
- No requiere migraciones ni cambios en consumidores.

## Fuera de alcance

- `Textarea`, `Select`, `Combobox` u otros controles: si se quieren unificar, se aborda en un cambio aparte.
- Ajustes puntuales de tamaño en formularios que hoy dependieran de `text-base` en mobile — no hemos detectado ninguno crítico, pero si aparece se ajusta puntualmente.
