import { test, expect } from '@playwright/test';

test.describe('Flujo core de negocio (Humo)', () => {
  const ts = Date.now();
  const testEmail = `test-${ts}@miel.test`;
  const testPassword = 'password123';
  const tenantName = `Empresa Test ${ts}`;
  const bodegaName = `Bodega ${ts}`;
  const productoName = `Producto ${ts}`;
  const productoSku = `SKU-${ts}`;

  test('login -> producto -> movimiento -> venta -> despacho', async ({ page }) => {
    // 1. Registro e inicio de sesión
    await page.goto('/signup');
    await page.getByLabel('Correo electrónico').fill(testEmail);
    await page.getByLabel('Contraseña', { exact: true }).fill(testPassword);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // 2. Onboarding (crear tenant)
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByLabel('Nombre de la empresa').fill(tenantName);
    await page.getByRole('button', { name: 'Crear empresa' }).click();

    // 3. Inicio: solo Módulos y Resumen gerencial, sin accesos directos (S14-07, supersede S14-02/S14-06)
    await expect(page).toHaveURL(/\/inicio/);
    const modulos = page.getByRole('heading', { name: 'Módulos' });
    const resumen = page.getByRole('heading', { name: 'Resumen gerencial' });
    await expect(modulos).toBeVisible();
    await expect(resumen).toBeVisible();
    const modulosY = (await modulos.boundingBox())!.y;
    const resumenY = (await resumen.boundingBox())!.y;
    expect(modulosY).toBeLessThan(resumenY);
    await expect(page.locator('a[href="/finanzas"]')).toHaveCount(0);

    await page.goto('/inventario/bodegas');
    await page.getByLabel('Nombre de la bodega').fill(bodegaName);
    await page.getByRole('button', { name: 'Crear bodega' }).click();
    
    // Verificamos que la bodega se creó y aparece en la lista
    await expect(page.getByText(bodegaName)).toBeVisible();

    // 4. Crear producto (S19-24: mismo formulario que el Catálogo, detrás de "Generar producto")
    await page.goto('/inventario/productos');
    await page.getByRole('button', { name: 'Generar producto' }).click();
    await page.getByLabel('Código (SKU)').fill(productoSku);
    await page.getByLabel('Nombre', { exact: true }).fill(productoName);
    await page.getByRole('combobox', { name: 'Tipo' }).click();
    await page.getByRole('option', { name: 'Terminado' }).click();
    await page.getByLabel('Costo').fill('100');
    await page.getByLabel('Precio de venta').fill('200');
    await page.getByRole('button', { name: 'Crear producto' }).click();

    await expect(page.getByText(productoName)).toBeVisible();

    // 4b. Editar producto desde su tarjeta (S19-24)
    const productoNameEditado = `${productoName} editado`;
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await page.getByLabel('Nombre', { exact: true }).fill(productoNameEditado);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(productoNameEditado)).toBeVisible();

    // 4c. Logo/"Miel" del sidebar vuelve a Inicio desde cualquier pantalla (S14-03)
    await page.locator('aside').getByRole('link', { name: 'Miel', exact: true }).click();
    await expect(page).toHaveURL(/\/inicio/);

    // 4d. La empresa se funda solo en el registro inicial: /onboarding?crear ya no ofrece
    // crear otra estando autenticado con membership (S14-04)
    await page.goto('/onboarding?crear');
    await expect(page).toHaveURL(/\/inicio/);

    // 5. (S19-30) Ya no hay "Registrar movimiento de stock" en /inventario. PENDIENTE: el paso 8
    // (confirmar venta) necesita stock — reescribir para ingresarlo recibiendo una orden de compra.

    // 5c. Abrir caja: ayuda en lenguaje llano (S14-05)
    await page.goto('/ventas/caja');
    await expect(page.getByText(/dinero con el que arrancas el turno/i)).toBeVisible();
    await page.getByLabel('Monto base de caja').fill('50000');
    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(page.getByText(/sesión abierta desde/i)).toBeVisible();

    // 6. Crear cliente
    await page.goto('/ventas/clientes');
    await page.getByLabel('Nombre').fill('Cliente E2E');
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(page.getByText('Cliente E2E')).toBeVisible();

    // 7. Venta
    await page.goto('/ventas/pedidos');
    await page.getByRole('combobox', { name: 'Cliente' }).click();
    await page.getByRole('option', { name: 'Cliente E2E' }).click();

    await page.getByText('Selecciona un producto').click();
    await page.getByRole('option', { name: new RegExp(productoName) }).click();
    
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    
    // Verificamos que la venta aparece en estado borrador
    await expect(page.getByRole('cell', { name: 'Borrador' })).toBeVisible();

    // 8. Confirmar venta
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await page.getByText('Bodega origen...').click();
    await page.getByRole('option', { name: bodegaName }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();

    // Verificamos que pasó a Confirmada
    await expect(page.getByRole('cell', { name: 'Confirmada' })).toBeVisible();

    // 9. Despacho
    await page.getByRole('button', { name: 'Despachar' }).click();
    await page.getByPlaceholder('Dirección de envío...').fill('Calle 123');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('cell', { name: 'Despachada' })).toBeVisible();
  });
});
