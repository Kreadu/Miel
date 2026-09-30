---
id: S18-10
titulo: Una venta puede salir de varias bodegas — ver stock y completar lo que falta
estado: implemented
depende_de: [S18-06, S18-08]
---

# S18-10 — Completar desde otra bodega

## Contexto

Pedido del humano (2026-09-30): se piden 10 unidades; Cinecultivo tiene 5 y Kreadu 10. Hoy la
venta sale entera de una sola bodega y da "no hay stock suficiente". Decisiones del humano:
1. **Se pregunta cada vez** de dónde completar (Miel no lo decide sola).
2. Vale **también para "Guardar como pedido"**: al confirmarlo en "Pedidos por completar".
3. Solo se completa desde **las bodegas que el dueño marque**.

**Aprobado por el humano:** "marcar" = una casilla por bodega en Inventario → Bodegas
o sucursales: **"Presta stock para completar ventas"** (la edita dueño/administrador). La bodega
principal de la venta es la elegida en "Sale de"; las demás solo si están marcadas.

## Alcance

- **BD:** `warehouses.lends_stock` (por defecto no). RPC `confirm_sale_allocated(p_sale_id,
  p_warehouse_id, p_allocations)` — reparto `[{product_id, warehouse_id, qty}]`: cada producto
  suma exactamente lo vendido; `p_warehouse_id` es la bodega de la venta; cualquier otra debe
  estar marcada (`warehouse_not_lending`); una salida de stock por reparto (el stock de cada
  bodega se valida como hoy). `confirm_sale` queda igual (todo de una bodega).
  `checkout_counter_sale` acepta el reparto (opcional).
- **Anular/devolver** (S18-08) ya devuelven cada unidad a la bodega de donde salió (usan las
  salidas registradas): sin cambios, con test.
- **Carrito (Cobrar y entregar)** y **Confirmar en Pedidos por completar:**
  - Al lado de cada producto: **"Hay N en <bodega>"**.
  - Si no alcanza: **"Faltan X"** y un botón por cada bodega marcada que tenga stock:
    **"Completar X de Kreadu (hay 10)"**. Si una sola no alcanza, se puede sumar otra.
  - Si entre todas no alcanza: "No hay suficiente: faltan X" y no deja cobrar/confirmar.
  - El reparto elegido se ve y se puede quitar ("quitar").
- **Bodegas:** casilla "Presta stock para completar ventas" en la ficha de cada bodega.
- Textos es/en/fr.

Fuera de alcance: traslados de stock entre bodegas como movimiento aparte; reparto automático.

## Criterios

- 10 pedidas, Cinecultivo 5 + Kreadu 10 (marcada): "Faltan 5" → "Completar 5 de Kreadu" → se
  cobra; stock queda Cinecultivo 0, Kreadu 5.
- Una bodega no marcada no aparece para completar y la BD la rechaza.
- Reparto que no suma lo vendido: error, nada guardado.
- Anular/devolver: cada bodega recupera lo suyo.
- pgTAP de `confirm_sale_allocated` (feliz, no marcada, suma incorrecta, sin stock, atomicidad,
  tenant ajeno) y del reintegro por bodega; Vitest de acciones.
- Lint, tsc, `npm test`; migración y pgTAP los aplica/corre el humano.

## Notas de implementación

- Migración `20260930220000_completar-desde-otra-bodega.sql` (aplicar **después** de las de
  S18-06 y S18-08): `warehouses.lends_stock` + grants por columna; `confirm_sale_allocated`;
  `confirm_sale` ahora arma el reparto "todo de una bodega" y llama a la nueva (misma conducta);
  `checkout_counter_sale` recreada con `p_allocations` (se borra la firma anterior).
- **Ojo:** hasta aplicar la migración, guardar una bodega falla (la app ya envía `lends_stock`).
- UI: `allocation-picker.tsx` (componente + `resolveAllocations`, con tests) usado en el carrito
  y en "Confirmar" de Pedidos por completar; lo completado se recorta si baja la cantidad.
- Pedidos filtra ventas, clientes y bodegas por la empresa activa (antes podía mezclar empresas
  del mismo dueño).
- pgTAP `S18-10-completar-desde-otra-bodega.sql` (14 pruebas), **sin correr aquí**.

## Cambio pedido por el humano tras probar (2026-09-30)

- En vez de los botones "Completar X de …": por cada producto, **filas bodega + cantidad**. La
  primera fila es la bodega de la venta ("Sale de"), con su stock y la cantidad (por defecto lo
  que alcance). **"+ Otra bodega"** agrega una fila con **desplegable** (solo bodegas que prestan
  stock), muestra "hay N" al elegirla, y el usuario escribe la cantidad. Arriba: "Completo",
  "Faltan X" o "Sobran X"; no deja cobrar/confirmar si no suma exacto o si una fila pide más de
  lo que hay.
- Tras "Cobrar y entregar" la pantalla se limpia y queda un aviso "Venta cobrada y entregada —
  boleta #N" (una venta cobrada y entregada no va a "Pedidos por completar": queda en Caja y en
  el historial del cliente). "Vaciar carrito" pasa a llamarse **"Limpiar pantalla"**.
- Sin cambios en la BD.

## Segundo cambio pedido por el humano tras probar (2026-09-30)

El humano no lograba sumar Kreadu (no estaba marcada y "Sale de" reiniciaba el reparto). Nuevo flujo:
- **Nada se asigna por defecto.** Por producto: desplegable con **todas** las bodegas ("Kreadu —
  hay 10"), cantidad (viene con lo que falta, tope el stock) y **"Asignar"**; se repite hasta el
  total; **"Aceptar"** cierra el producto (resumen + "cambiar"). "✕" quita una asignación.
- Siempre se puede usar la bodega propia (la del trabajador o la principal); las demás, si
  prestan stock. Las que no, se ven en gris y el dueño/administrador las habilita **ahí mismo con
  un clic** ("Permitir que preste"); a un operativo se le dice que lo pida al encargado.
- Se quita el desplegable "Sale de" (la bodega de la venta es la propia).
- "Cobrar y entregar" / "Confirmar" solo con todos los productos aceptados.
- Sin cambios de BD; acción nueva `setWarehouseLends`.
