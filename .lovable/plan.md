## Plan

1. **Ajustar el contenedor raíz de Setup**
   - Cambiar el layout para que ocupe exactamente el alto visible del viewport (`100dvh`) y no genere overflow en el documento.
   - Mantener el sidebar estable/fijo dentro del layout.

2. **Mover el scroll externo a un único contenedor**
   - Dejar solo el área principal de contenido como contenedor desplazable vertical.
   - Evitar que `body`, `html` o wrappers superiores acumulen un segundo scroll externo.

3. **Preservar el scroll interno del panel “Clientes asignados”**
   - No tocar la estructura ni la lógica funcional del formulario.
   - No modificar el scroll propio de la lista de clientes dentro del panel.

4. **Verificar visualmente en `/setup/users/new`**
   - Confirmar que al borde derecho aparece una sola barra de scroll externa.
   - Confirmar que el panel “Clientes asignados” conserva su scroll interno.