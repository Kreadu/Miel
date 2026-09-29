---
name: miel-design
description: Design system y criterio de UI/UX premium del ERP Miel. Usar SIEMPRE junto a nextjs-miel al crear o modificar UI en src/ — componentes, páginas, layouts, estilos, animaciones o cualquier decisión visual. Garantiza consistencia entre sesiones y una estética simple, intuitiva y premium.
---

# Miel Design — sistema de diseño del ERP

Objetivo: una UI que se sienta **costosa por contención, no por ornamento**. Simple, rápida,
con jerarquía clara. La consistencia la dan los tokens y estas reglas — no el gusto de la sesión.

## Identidad visual

- **Paleta**: neutrales cálidos (tinte sutil hacia el ámbar) + **un solo acento ámbar/miel**
  (`primary`). Nada de segundos acentos, gradientes decorativos ni colores de librería
  (`amber-500`, `slate-*`). El rojo solo para `destructive`.
- **Tipografía**: la sans del proyecto (Geist). Headings con `font-semibold tracking-tight`;
  cuerpo `text-sm`/`text-base` normal. **Cifras, montos y columnas numéricas siempre con
  `tabular-nums` y alineadas a la derecha** — es un ERP, los números deben alinear.
- **Radios**: solo la escala de tokens (`rounded-sm|md|lg|xl`, derivada de `--radius`). No
  valores arbitrarios.
- **Sombras**: máximo dos niveles — `shadow-xs` para superficies elevadas sutiles (cards),
  `shadow-lg` para overlays (popover, dialog). Nunca sombras duras ni bordes + sombra fuerte
  a la vez. En la mayoría de los casos un `border` basta.

## Tokens = única fuente de verdad

- Los colores viven en `src/app/globals.css` (`:root` y `.dark`, oklch). En componentes SOLO
  clases semánticas: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`,
  `bg-primary`, `border-border`, `ring-ring`, etc.
- **Prohibido**: `bg-[#...]`, `text-amber-600`, `bg-white`, `text-black`, estilos inline de
  color, y cualquier color fuera de tokens.
- Si falta un token semántico, se agrega en `globals.css` **en claro Y oscuro** y se registra
  en el ADR de diseño si cambia la identidad — no se resuelve con un color hardcodeado.

## Layout y espaciado

- Escala 4/8pt vía utilidades Tailwind estándar (`gap-2`, `p-4`, `space-y-6`…). Nada de
  valores arbitrarios (`p-[13px]`).
- **La jerarquía se construye con espacio y peso tipográfico, no con cajas.** Antes de envolver
  algo en un Card con borde y título, preguntarse si un heading + espaciado basta.
- Densidad de ERP: tablas y formularios compactos pero respirables (`py-2`/`py-2.5` en celdas,
  `gap-4`/`gap-6` entre grupos). Contenido principal con ancho máximo (`max-w-*`) — nunca
  formularios que se estiran a pantalla completa.
- El whitespace es el recurso premium más barato: ante la duda, más espacio y menos elementos.

## Componentes

- **shadcn/ui siempre** (`npx shadcn add <componente>`); nunca reescribir primitivas (botones,
  inputs, dialogs, tablas, selects) a mano. Los generados viven en `src/components/ui/` y no
  se editan salvo necesidad justificada.
- Variantes visuales nuevas → `cva` dentro del componente compartido en `src/components/`.
  Prohibido repetir la misma ristra de clases en varias páginas: eso es un componente.
- Iconos: solo `lucide-react`, `size-4` en texto/botones y `size-5` en navegación. Siempre
  acompañados de label o `aria-label` — nunca icono solo sin nombre accesible.
- Jerarquía de botones por vista: **una** acción primaria (`default`), el resto `outline`,
  `ghost` o `link`. Dos botones primarios juntos = error de diseño.

## Estados obligatorios (una vista sin ellos no está terminada)

1. **Loading**: skeletons que imitan el layout final (`loading.tsx` por segmento) — no
   spinners genéricos a pantalla completa.
2. **Empty state**: mensaje breve + acción principal ("Aún no tienes proveedores. — Crear
   proveedor"). Nunca una tabla vacía muda.
3. **Error**: `error.tsx` recuperable con reintento; errores de formulario inline junto al
   campo (desde el resultado tipado de la Server Action).
4. **Feedback de mutación**: estado pending en el botón (`useActionState`) y confirmación
   (toast o inline) al completar. Nunca un submit que no responde visualmente.

## Motion

- Micro y funcional: 150–250 ms, `ease-out`, animando solo `opacity` y `transform`.
  `tw-animate-css` ya está disponible — no agregar librerías de animación.
- Dónde sí: aparición de overlays, feedback de acciones, transiciones de estado.
  Dónde no: parallax, scroll cinemático, animaciones decorativas en bucle — eso es para
  landings, no para la app.
- Todo motion respeta `prefers-reduced-motion` (usar utilidades `motion-safe:`/
  `motion-reduce:` cuando la animación sea propia).

## Responsive y mobile-first

- **Mobile-first como orden de trabajo, no como afterthought.** Las clases base (sin prefijo) son
  las de móvil; los breakpoints solo *amplían* hacia arriba (`sm:`, `md:`, `lg:`, `xl:`). Prohibido
  diseñar para escritorio primero y "arreglar" móvil después con overrides.
- **Breakpoints canónicos** (defaults de Tailwind, no inventar otros): `sm` 640px, `md` 768px,
  `lg` 1024px, `xl` 1280px. Pensar en tres franjas al diseñar cualquier vista: móvil (base, <640),
  tablet (`md`), escritorio (`lg`+).
- **Viewport de referencia mínimo: 360–375px de ancho.** Ninguna vista puede producir scroll
  horizontal del body a ese ancho — es el invariante que se verifica antes de dar una UI por
  terminada (ver checklist) y el que protege el gate automatizado (`e2e/responsive.spec.ts`).
- **Grids**: siempre arrancan en `grid-cols-1` (o el mínimo real de columnas) y escalan con
  `sm:`/`md:`/`lg:`. Prohibido un `grid-cols-N` fijo sin variante responsive en un contenedor
  estructural (layout de página, secciones) — sí se tolera en detalles no estructurales.
- **Tablas de ERP**: envueltas siempre en `overflow-x-auto rounded-lg border` (patrón ya vigente en
  el repo). En móvil el scroll horizontal de la tabla es aceptable; lo que nunca es aceptable es que
  la tabla rompa el ancho del layout que la contiene.
- **Navegación**: el chrome de la app (sidebar) colapsa a un drawer/overlay (`Sheet` de shadcn) con
  disparador (hamburguesa) por debajo de `md`. Nunca una barra lateral de ancho fijo que reste ancho
  útil al contenido en móvil.
- **Sin anchos fijos estructurales**: prohibido `w-[###px]` en contenedores de layout (sidebar,
  secciones, wrappers de página). Ancho fluido con tope (`w-full max-w-*`). `min-w-[...]` solo se
  tolera en elementos no estructurales (celdas, tooltips).
- **Targets táctiles**: el mínimo de 40px de alto (línea de accesibilidad de abajo) aplica con
  especial atención en móvil, donde el dedo reemplaza al cursor de precisión.

## Modo oscuro y accesibilidad

- Todo componente se verifica **en claro y en oscuro** (clase `.dark`; la variante ya está
  configurada en `globals.css`). Nunca un color que solo funciona en un tema.
- Contraste AA mínimo (4.5:1 texto normal, 3:1 texto grande/iconos).
- Focus siempre visible con el `ring` del sistema — jamás `outline-none` sin reemplazo.
- Targets interactivos ≥ 40px de alto en la práctica (`h-9`/`h-10` de shadcn cumplen).
- Inputs siempre con `<Label>` asociado; tablas con `<th>` reales.

## Checklist de salida (antes de dar la UI por terminada)

- [ ] Cero colores/espaciados/radios hardcodeados — solo tokens y escala Tailwind.
- [ ] Revisado en modo claro Y oscuro.
- [ ] Los 4 estados presentes: loading, empty, error, feedback de mutación.
- [ ] Una sola acción primaria por vista; iconos con nombre accesible.
- [ ] Cifras con `tabular-nums` alineadas a la derecha.
- [ ] Motion ≤250 ms, solo opacity/transform, con reduced-motion respetado.
- [ ] Diseñado mobile-first: clases base = móvil, breakpoints solo amplían hacia arriba.
- [ ] Verificado a 360–375px sin scroll horizontal del body; y revisado en `md`/`lg`.
- [ ] Grids arrancan en 1 columna (o el mínimo real) y escalan; sin `grid-cols-N` fijo estructural.
- [ ] Navegación/overlays usables en móvil (drawer/`Sheet`, nunca sidebar fija robando ancho).
