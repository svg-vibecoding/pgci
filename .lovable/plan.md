## Objetivo

Corregir el uso tipográfico de la landing PGCI: títulos con interlineado más tenso ("potente") y textos continuos con un espaciado vertical de lectura natural (no inflado). No se rediseña nada; solo se ajusta interlineado/escala. Sin cambios de color, fuente, copy ni layout.

## Diagnóstico

Dos causas:

1. **Tokens de line-height flojos en títulos** (`src/styles.css`). Relaciones actuales:
   - display-lg 56/64 = 1.14 · display-md 44/52 = 1.18 · display-sm 36/44 = 1.22
   - h1 30/38 = 1.27 · h2 24/32 = 1.33 · h3 20/28 = 1.40
   Para titulares grandes lo ideal es bajar hacia ~1.05–1.20.

2. **Overrides ad-hoc en `src/routes/index.tsx`** que inflan el cuerpo: párrafos con `!leading-7` (28px) y `!leading-8` (32px) sobre texto de 16–18px → ratios 1.75–2.0, muy por encima del rango de lectura cómodo (1.5–1.6).

## Cambios

### 1. Tensar tokens de títulos — `src/styles.css`

Ajustar solo los `*-lh` de la escala display/heading (los tamaños no cambian):

```text
--display-lg-lh: 64px → 60px   (1.07)
--display-md-lh: 52px → 48px   (1.09)
--display-sm-lh: 44px → 40px   (1.11)
--h1-lh:         38px → 36px   (1.20)
--h2-lh:         32px → 30px   (1.25)
--h3-lh:         28px → 26px   (1.30)
```

(subtitle/body/caption/overline se mantienen igual.)

### 2. Normalizar interlineado de textos continuos — `src/routes/index.tsx`

Reemplazar los `!leading-8` / `!leading-7` de los párrafos de cuerpo por un interlineado de lectura (~1.55):
- Hero (`!text-[18px] !leading-8`) → `!leading-[1.55]` (≈28px).
- Intros y párrafos `!text-[16px] !leading-7` → `!leading-[1.55]` (≈25px).
- Párrafos sobre fondo oscuro (`!text-[14px] !leading-6`, `text-[14px] leading-6`) → mantener (14/24 = 1.71 es alto; bajar a `leading-[1.5]` ≈21px para coherencia).
- Quote destacada (`suma-h3 !leading-8`) → `!leading-[1.3]` para que el bloque de cita no se abra de más.

Se conservan los tamaños puntuales (`!text-[16px]`, `!text-[18px]`), solo se corrige el interlineado.

## Validación

- Revisar el preview en desktop (hero `#vision`) y verificar que los títulos cierren más compactos y los párrafos largos respiren sin abrirse en exceso.
- Comprobar que no quedan `!leading-8` en párrafos de cuerpo.

## Notas

- Cambios acotados a presentación (tokens CSS + clases utilitarias). Sin tocar lógica ni componentes de `src/components/sumatec/`.
- Si tras verlo prefieres títulos aún más tensos (p. ej. display ~1.0), es un ajuste fino adicional de un solo valor por token.