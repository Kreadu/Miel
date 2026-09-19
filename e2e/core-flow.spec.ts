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

    // 3. Inicio: accesos directos y módulos primero, resumen gerencial abajo (S14-02)
    await expect(page).toHaveURL(/\/inicio/);
    const vender = page.locator('a[href="/ventas/pos"]');
    const modulos = page.getByRole('heading', { name: 'Módulos' });
    const resumen = page.getByRole('heading', { name: 'Resumen gerencial' });
    await expect(vender).toBeVisible();
    await expect(modulos).toBeVisible();
    await expect(resumen).toBeVisible();
    const venderY = (await vender.boundingBox())!.y;
    const modulosY = (await modulos.boundingBox())!.y;
    const resumenY = (await resumen.boundingBox())!.y;
    expect(venderY).toBeLessThan(modulosY);
    expect(modulosY).toBeLessThan(resumenY);
    await expect(page.locator('a[href="/finanzas"]')).toHaveCount(0);

    await page.goto('/inventario/bodegas');
    await page.getByLabel('Nombre de la bodega').fill(bodegaName);
    await page.getByRole('button', { name: 'Crear bodega' }).click();
    
    // Verificamos que la bodega se creó y aparece en la lista
    await expect(page.getByText(bodegaName)).toBeVisible();

    // 4. Crear producto
    await page.goto('/inventario/productos');
    await page.getByLabel('SKU').fill(productoSku);
    await page.getByLabel('Nombre').fill(productoName);
    // Expand kind select
    await page.getByRole('combobox', { name: 'Tipo' }).click();
    await page.getByRole('option', { name: 'Terminado' }).click();
    await page.getByLabel('Costo').fill('100');
    await page.getByLabel('Precio de venta').fill('200');
    await page.getByRole('button', { name: 'Crear producto' }).click();

    await expect(page.getByText(productoName)).toBeVisible();

    // 4b. Editar producto (S13-02): formulario a ancho completo vía ?editar, no en <tr>
    const productoNameEditado = `${productoName} editado`;
    await page.getByRole('row', { name: new RegExp(productoName) }).getByRole('link', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\?editar=/);
    await page.getByLabel('Nombre').fill(productoNameEditado);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page).toHaveURL('/inventario/productos');
    await expect(page.getByText(productoNameEditado)).toBeVisible();

    // 4c. Logo/"Miel" del sidebar vuelve a Inicio desde cualquier pantalla (S14-03)
    await page.locator('aside').getByRole('link', { name: 'Miel', exact: true }).click();
    await expect(page).toHaveURL(/\/inicio/);

    // 4d. La empresa se funda solo en el registro inicial: /onboarding?crear ya no ofrece
    // crear otra estando autenticado con membership (S14-04)
    await page.goto('/onboarding?crear');
    await expect(page).toHaveURL(/\/inicio/);

    // 5. Movimiento de stock (Ingresar stock)
    await page.goto('/inventario');
    
    // Abrir el form de ingreso manual
    await page.getByRole('button', { name: '+ Registrar movimiento de stock' }).click();
    
    // Llenar el form
    await page.getByText('Selecciona un producto').click();
    await page.getByRole('option', { name: new RegExp(productoName) }).click();
    
    await page.getByText('Selecciona una bodega').click();
    await page.getByRole('option', { name: bodegaName }).click();

    await page.getByLabel('Cantidad (Entrada)').fill('50');
    await page.getByLabel('Costo unitario').fill('100');
    await page.getByRole('button', { name: 'Guardar movimiento' }).click();

    // Verificamos que se reflejó en el inventario (el stock sube a 50)
    await expect(page.getByRole('cell', { name: '50' }).first()).toBeVisible();

    // 5b. Salida de stock (S13-03): kind=out, el campo Costo desaparece, el stock baja
    await page.getByRole('button', { name: '+ Registrar movimiento de stock' }).click();
    await page.getByText('Selecciona un producto').click();
    await page.getByRole('option', { name: new RegExp(productoName) }).click();
    await page.getByText('Selecciona una bodega').click();
    await page.getByRole('option', { name: bodegaName }).click();

    await page.getByRole('combobox', { name: 'Tipo de movimiento' }).click();
    await page.getByRole('option', { name: 'Salida' }).click();
    await expect(page.getByLabel('Costo unitario')).not.toBeVisible();

    await page.getByLabel('Cantidad (Salida)').fill('5');
    await page.getByRole('button', { name: 'Guardar movimiento' }).click();

    await expect(page.getByRole('cell', { name: '45' }).first()).toBeVisible();

    // 5c. Abrir caja: ayuda en lenguaje llano (S14-05)
    await page.goto('/ventas/caja');
    await expect(page.getByText(/dinero con el que arrancas el turno/i)).toBeVisible();
    await page.getByLabel('Monto base de caja').fill('50000');
    await page.getByRole('button', { name: 'Abrir caja' }).click();
    await expect(page.getByText(/sesión abierta desde/i)).toBeVisible();

    // 5d. Alta rápida de cliente desde el POS (S15-02/ADR-033)
    await page.goto('/ventas/pos');
    await page.getByRole('button', { name: 'Nuevo cliente' }).click();
    await page.getByLabel('Nombre').fill('Cliente POS E2E');
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(page.getByRole('combobox', { name: 'Cliente (Opcional)' })).toContainText(
      'Cliente POS E2E',
    );

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
