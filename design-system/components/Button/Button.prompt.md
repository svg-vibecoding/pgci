Sumatec's primary action control — use for any button; reach for `contained` primary on the single most important action per view.

```jsx
<Button color="primary" iconLeft="bolt">Cotizar ahora</Button>
<Button variant="outlined" color="accent">Ver detalle</Button>
<Button variant="text" size="small" iconRight="arrow-right-long">Más</Button>
```

Variants: `contained` (filled, default), `outlined` (border), `text` (ghost). Colors: `primary` (red), `secondary` (gray), `accent` (blue), `success`, `error`. Sizes: `small` 32 / `medium` 40 / `large` 48px. Props: `iconLeft`/`iconRight` (FontAwesome solid name), `fullWidth`, `uppercase`, `disabled`. Requires the FontAwesome CSS for icons.
