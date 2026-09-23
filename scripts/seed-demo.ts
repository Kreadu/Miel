// Seed de demo para prospectos (S9-02). Ver specs/S9-02-seeds-demo.md.
//
// Dos clientes Supabase:
// - `admin` (service_role): limpieza idempotente, catálogos base (CRUD sin lógica
//   transaccional: bodegas, proveedores, clientes, productos, recetas) y post-datado de
//   fechas tras cada operación (simula que los eventos ocurrieron en meses pasados).
// - `authed` (anon + sesión del usuario demo): invoca las RPCs reales de negocio
//   (create_purchase/receive_purchase, register_production, create_sale/confirm_sale,
//   pagos) porque dependen de auth.uid()/user_tenant_ids() — así los datos de demo
//   respetan las mismas invariantes que la app real (regla #2 de AGENTS.md).
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error(
    'Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local'
  );
  process.exit(1);
}
// Reasignados a consts explícitamente tipados: TypeScript no propaga el narrowing del guard
// anterior dentro de funciones anidadas declaradas más abajo (p. ej. `run()`).
const SUPABASE_URL: string = supabaseUrl;
const ANON_KEY: string = anonKey;
const SERVICE_KEY: string = serviceKey;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_EMAIL = 'demo@miel.test';
const DEMO_PASSWORD = 'password123';
const DEMO_TENANT_NAME = 'Miel Demo';

// Tablas hijas del tenant demo, en orden seguro para borrado (hijas antes que padres,
// ya que las FK son `on delete restrict`).
const TENANT_CHILD_TABLES = [
  'customer_interactions',
  'customer_payments',
  'supplier_payments',
  'sale_items',
  'purchase_items',
  'stock_movements',
  'sales',
  'purchases',
  'sale_counters',
  'expenses',
  'recipe_items',
  'cash_sessions',
  'products',
  'customers',
  'suppliers',
  'warehouses',
  'memberships',
];

function monthsAgo(months: number, dayOffset = 0): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() + dayOffset);
  return d;
}
const iso = (d: Date) => d.toISOString();

/** Limpieza idempotente (CA2): borra en reversa cualquier dato previo del tenant demo. */
async function cleanupExistingDemo() {
  const { data: tenants, error } = await admin.from('tenants').select('id').eq('name', DEMO_TENANT_NAME);
  if (error) throw error;

  for (const t of tenants ?? []) {
    console.log(`Limpiando datos previos del tenant ${t.id}...`);
    for (const table of TENANT_CHILD_TABLES) {
      const { error: delErr } = await admin.from(table).delete().eq('tenant_id', t.id);
      if (delErr) throw delErr;
    }
    const { error: tErr } = await admin.from('tenants').delete().eq('id', t.id);
    if (tErr) throw tErr;
  }

  const { data: authUsers, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = authUsers.users.find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    console.log('Borrando usuario demo anterior...');
    const { error: delUserErr } = await admin.auth.admin.deleteUser(existing.id);
    if (delUserErr) throw delUserErr;
  }
}

async function run() {
  console.log('Iniciando generación de datos de demo...');
  await cleanupExistingDemo();

  console.log('Creando usuario demo...');
  const { data: createdUser, error: createUserErr } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (createUserErr) throw createUserErr;
  const userId = createdUser.user.id;

  console.log('Creando tenant y membership owner...');
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({ name: DEMO_TENANT_NAME, nit: '900123456-1', currency: 'COP' })
    .select('id')
    .single();
  if (tenantErr) throw tenantErr;
  const tenantId = tenant.id;

  const { error: memErr } = await admin
    .from('memberships')
    .insert({ tenant_id: tenantId, user_id: userId, role: 'owner', created_by: userId });
  if (memErr) throw memErr;

  console.log('Iniciando sesión como usuario demo (las RPCs de negocio requieren auth.uid())...');
  const authed = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInErr } = await authed.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signInErr) throw signInErr;

  // Helper de catálogo (admin, sin lógica transaccional: bodegas/proveedores/clientes/
  // productos/recetas son CRUD simple, cubierto por RLS de sus propias historias).
  const insertCatalog = async (table: string, payload: Record<string, unknown>) => {
    const row: Record<string, unknown> = { ...payload, tenant_id: tenantId };
    if (row.created_by === undefined) row.created_by = userId;
    const { data, error } = await admin.from(table).insert(row).select('id').single();
    if (error) {
      console.error(`Error insertando catálogo en ${table}:`, error);
      throw error;
    }
    return data as { id: string };
  };

  const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await authed.rpc(fn, args);
    if (error) {
      console.error(`Error en RPC ${fn}:`, error);
      throw error;
    }
    return data as T;
  };

  // 1. Bodegas
  console.log('Insertando bodegas...');
  const whPrincipal = await insertCatalog('warehouses', { name: 'Principal' });
  await insertCatalog('warehouses', { name: 'Secundaria' });

  // 2. Proveedores y clientes
  console.log('Insertando proveedores y clientes...');
  const supEmpaques = await insertCatalog('suppliers', {
    name: 'Empaques de Colombia',
    nit: '800111222',
    email: 'ventas@empaques.co',
  });
  const supAgro = await insertCatalog('suppliers', { name: 'AgroInsumos S.A.', nit: '800333444' });

  const customer1 = await insertCatalog('customers', {
    name: 'Juan Pérez',
    doc_type: 'cc',
    doc_number: '101010',
    email: 'juan@example.com',
  });
  const customer2 = await insertCatalog('customers', {
    name: 'Supermercado Central',
    doc_type: 'nit',
    doc_number: '900555666',
  });
  const customer3 = await insertCatalog('customers', { name: 'Ana Gómez', doc_type: 'cc', doc_number: '202020' });

  // 3. Productos (insumos y terminados)
  console.log('Insertando productos (insumos y terminados)...');
  const pAzucar = await insertCatalog('products', { name: 'Azúcar Refinada', sku: 'INS-AZU-01', kind: 'raw', price: 0, min_stock: 50 });
  const pFruta = await insertCatalog('products', { name: 'Fruta Base', sku: 'INS-FRU-01', kind: 'raw', price: 0, min_stock: 100 });
  const pFrasco = await insertCatalog('products', { name: 'Frasco de Vidrio 250ml', sku: 'INS-FRA-01', kind: 'raw', price: 0, min_stock: 200 });
  const pEtiqueta = await insertCatalog('products', { name: 'Etiqueta Miel', sku: 'INS-ETI-01', kind: 'raw', price: 0, min_stock: 200 });

  const mMielPequena = await insertCatalog('products', {
    name: 'Miel Premium 250ml', sku: 'TER-MIE-250', kind: 'finished', price: 15000, min_stock: 20, tax_rate: 19,
  });
  const mMielGrande = await insertCatalog('products', {
    name: 'Miel Premium 500ml', sku: 'TER-MIE-500', kind: 'finished', price: 25000, min_stock: 10, tax_rate: 19,
  });

  // Recetas (por unidad de producto terminado)
  console.log('Insertando recetas...');
  const RECIPE_PEQUENA = [
    { productId: pFrasco.id, qty: 1 },
    { productId: pEtiqueta.id, qty: 1 },
    { productId: pAzucar.id, qty: 0.1 },
    { productId: pFruta.id, qty: 0.5 },
  ];
  const RECIPE_GRANDE = [
    { productId: pFrasco.id, qty: 1 },
    { productId: pEtiqueta.id, qty: 1 },
    { productId: pAzucar.id, qty: 0.2 },
    { productId: pFruta.id, qty: 1 },
  ];
  for (const item of RECIPE_PEQUENA) {
    await insertCatalog('recipe_items', { product_id: mMielPequena.id, component_product_id: item.productId, qty: item.qty });
  }
  for (const item of RECIPE_GRANDE) {
    await insertCatalog('recipe_items', { product_id: mMielGrande.id, component_product_id: item.productId, qty: item.qty });
  }

  // 4. Compras: create_purchase + receive_purchase inyectan stock de insumos y pueblan CxP.
  console.log('Simulando compras y recepción de insumos...');
  const simulatePurchase = async (
    supplierId: string,
    items: { productId: string; qty: number; unitCost: number }[],
    date: Date,
    paymentRatio = 0
  ) => {
    const purchaseId = await rpc<string>('create_purchase', {
      p_supplier_id: supplierId,
      p_status: 'ordered',
      p_items: items.map((i) => ({ product_id: i.productId, qty: i.qty, unit_cost: i.unitCost, tax_rate: 0 })),
    });
    await rpc('receive_purchase', { p_purchase_id: purchaseId, p_warehouse_id: whPrincipal.id });

    // Post-datar: la orden, sus movimientos de stock (ref_type='purchase') y, si aplica, el pago.
    await admin
      .from('purchases')
      .update({ created_at: iso(date), issued_at: iso(date), received_at: iso(date) })
      .eq('id', purchaseId);
    await admin
      .from('stock_movements')
      .update({ created_at: iso(date) })
      .eq('ref_type', 'purchase')
      .eq('ref_id', purchaseId);

    if (paymentRatio > 0) {
      const { data: purchase } = await admin.from('purchases').select('total').eq('id', purchaseId).single();
      const amount = Number(purchase?.total ?? 0) * paymentRatio;
      if (amount > 0) {
        // register_supplier_payment recibe p_paid_at directo: no requiere post-datado.
        await rpc('register_supplier_payment', {
          p_supplier_id: supplierId,
          p_purchase_id: purchaseId,
          p_amount: amount,
          p_method: 'transfer',
          p_paid_at: iso(date),
        });
      }
    }
    return purchaseId;
  };

  await simulatePurchase(
    supAgro.id,
    [
      { productId: pAzucar.id, qty: 200, unitCost: 2000 },
      { productId: pFruta.id, qty: 500, unitCost: 3000 },
    ],
    monthsAgo(3, 5),
    1
  );
  await simulatePurchase(
    supEmpaques.id,
    [
      { productId: pFrasco.id, qty: 1000, unitCost: 500 },
      { productId: pEtiqueta.id, qty: 1000, unitCost: 100 },
    ],
    monthsAgo(3, 8),
    0.5
  );

  // 5. Producción: register_production consume insumos según receta y genera terminado.
  console.log('Simulando producción...');
  const simulateProduction = async (
    productId: string,
    recipe: { productId: string; qty: number }[],
    outputQty: number,
    date: Date
  ) => {
    const windowStart = new Date();
    await rpc('register_production', {
      p_tenant_id: tenantId,
      p_warehouse_id: whPrincipal.id,
      p_product_id: productId,
      p_output_qty: outputQty,
      p_consumptions: recipe.map((r) => ({ product_id: r.productId, qty: r.qty * outputQty })),
    });
    // Post-datar los movimientos (consumo + entrada) generados por esta corrida.
    await admin
      .from('stock_movements')
      .update({ created_at: iso(date) })
      .eq('tenant_id', tenantId)
      .in('kind', ['production_in', 'production_out'])
      .gte('created_at', windowStart.toISOString());
  };

  await simulateProduction(mMielPequena.id, RECIPE_PEQUENA, 150, monthsAgo(2, 10));
  await simulateProduction(mMielGrande.id, RECIPE_GRANDE, 80, monthsAgo(2, 15));
  await simulateProduction(mMielPequena.id, RECIPE_PEQUENA, 50, monthsAgo(0, 0));

  // 6. Ventas: create_sale + confirm_sale bajan stock de terminados y congelan costo.
  console.log('Generando ventas y pagos...');
  const simulateSale = async (
    customerId: string,
    items: { productId: string; qty: number; unitPrice: number; taxRate: number; discount?: number }[],
    date: Date,
    finalStatus: 'confirmed' | 'shipped' | 'delivered',
    paymentRatio = 0
  ) => {
    const saleId = await rpc<string>('create_sale', {
      p_tenant_id: tenantId,
      p_customer_id: customerId,
      p_items: items.map((i) => ({
        product_id: i.productId, qty: i.qty, unit_price: i.unitPrice, tax_rate: i.taxRate, discount: i.discount ?? 0,
      })),
    });
    await rpc('confirm_sale', { p_sale_id: saleId, p_warehouse_id: whPrincipal.id });

    const salesUpdate: Record<string, unknown> = { created_at: iso(date), issued_at: iso(date) };
    if (finalStatus === 'shipped' || finalStatus === 'delivered') {
      salesUpdate.status = finalStatus;
      salesUpdate.shipping_address = 'Calle Falsa 123';
      salesUpdate.shipped_at = iso(date);
    }
    if (finalStatus === 'delivered') {
      salesUpdate.delivered_at = iso(date);
    }
    await admin.from('sales').update(salesUpdate).eq('id', saleId);
    await admin.from('stock_movements').update({ created_at: iso(date) }).eq('ref_type', 'sale').eq('ref_id', saleId);

    if (paymentRatio > 0) {
      const { data: sale } = await admin.from('sales').select('total').eq('id', saleId).single();
      const amount = Number(sale?.total ?? 0) * paymentRatio;
      if (amount > 0) {
        await rpc('register_customer_payment', {
          p_customer_id: customerId,
          p_sale_id: saleId,
          p_amount: amount,
          p_method: 'transfer',
          p_paid_at: iso(date),
        });
      }
    }
    return saleId;
  };

  await simulateSale(
    customer1.id,
    [{ productId: mMielPequena.id, qty: 10, unitPrice: 15000, taxRate: 19 }],
    monthsAgo(2, 2),
    'delivered',
    1
  );
  await simulateSale(
    customer2.id,
    [{ productId: mMielGrande.id, qty: 5, unitPrice: 25000, taxRate: 19 }],
    monthsAgo(1, 1),
    'shipped',
    0.5
  );
  await simulateSale(
    customer1.id,
    [{ productId: mMielPequena.id, qty: 20, unitPrice: 14000, taxRate: 19, discount: 500 }],
    monthsAgo(0, 0),
    'delivered',
    1
  );
  await simulateSale(
    customer3.id,
    [{ productId: mMielGrande.id, qty: 2, unitPrice: 25000, taxRate: 19 }],
    monthsAgo(0, 0),
    'confirmed',
    0
  );

  // 7. Gastos generales (sin RPC en S7-01: CRUD directo con rol admin/owner)
  console.log('Insertando gastos generales...');
  const insertExpense = async (amount: number, date: Date, kind: 'fixed' | 'variable', category: string, supplierId: string | null = null) => {
    const { error } = await authed.from('expenses').insert({
      tenant_id: tenantId,
      amount,
      paid_at: iso(date),
      kind,
      category,
      method: 'cash',
      supplier_id: supplierId,
      description: `Gasto de ${category}`,
      created_by: userId,
    });
    if (error) { console.error('Error insertando gasto:', error); throw error; }
  };

  for (let i = 0; i < 3; i++) {
    const monthDate = monthsAgo(i, 3);
    await insertExpense(1200000, monthDate, 'fixed', 'Arriendo');
    await insertExpense(250000, monthDate, 'fixed', 'Servicios');
    await insertExpense(150000, monthDate, 'variable', 'Publicidad');
    await insertExpense(300000, monthDate, 'variable', 'Transporte');
  }

  // 8. CRM: interacciones postventa (append-only, sin RPC — cualquier rol registra)
  console.log('Generando historial CRM...');
  const insertInteraction = async (customerId: string, kind: string, note: string, date: Date) => {
    const { error } = await authed.from('customer_interactions').insert({
      tenant_id: tenantId,
      customer_id: customerId,
      kind,
      note,
      created_at: iso(date),
      created_by: userId,
    });
    if (error) { console.error('Error insertando interacción CRM:', error); throw error; }
  };

  await insertInteraction(customer1.id, 'followup', 'Llamada de seguimiento, cliente satisfecho con el producto.', monthsAgo(1, 0));
  await insertInteraction(customer2.id, 'promo', 'Se envió correo con promoción de fin de año.', monthsAgo(1, 0));

  console.log('=========================================================');
  console.log('✅ Seed completado con éxito.');
  console.log(`Tenant: ${DEMO_TENANT_NAME}`);
  console.log(`Usuario: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log('=========================================================');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
