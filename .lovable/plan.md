## Diagnóstico: catálogo vacío en importación 3.1

Agregar dos `console.log` temporales en `src/routes/_authenticated/pgci/agreements.$agreementId.import.tsx`, dentro de `onFile`, justo después de resolver el catálogo (después de la llamada a `catalogFn(...)` y antes de construir `catalogBySku`):

```ts
const catalog =
  skus.length > 0
    ? ((await catalogFn({ data: { skus } })) as CatalogProduct[])
    : [];
console.log("SKUs enviados:", skus.length, skus.slice(0, 3));
console.log("catálogo recibido:", catalog.length, catalog.slice(0, 3));
```

Sin más cambios: cero edits a server functions, cero edits al motor de cruce, cero edits a la UI. Solo los dos logs.

### Qué hacer después de aprobar

1. Aplicar el diff mínimo arriba.
2. Tú subes el archivo del piloto en `/pgci/agreements/<id>/import`.
3. Me pegas la salida de consola.
4. Decisión:
   - `skus` correcto + `catalog` vacío → el bug está en `getCatalogProductsBySku` (permisos RLS del rol autenticado sobre `products`, o el `.in("sku", …)` con SKUs que llegaron con espacios/ceros).
   - `skus` vacío o con basura → el bug está antes, en el parseo (`parseSku` o lectura de la columna SKU del XLSX).
5. Retiraré los logs en la siguiente iteración, junto con el fix real.
