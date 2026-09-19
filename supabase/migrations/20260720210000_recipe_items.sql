create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  product_id uuid not null references public.products(id),
  component_product_id uuid not null references public.products(id),
  qty numeric(14,3) not null check (qty > 0),
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, component_product_id)
);

create index recipe_items_product_id_idx on public.recipe_items(product_id);
create index recipe_items_tenant_id_idx on public.recipe_items(tenant_id);

create trigger recipe_items_set_updated_at
  before update on public.recipe_items
  for each row execute function public.set_updated_at();

alter table public.recipe_items enable row level security;

create policy "recipe_items_tenant_select" on public.recipe_items for select
  using (tenant_id in (select public.user_tenant_ids()));

create policy "recipe_items_admin_write" on public.recipe_items for all
  using (public.user_is_tenant_admin(tenant_id))
  with check (public.user_is_tenant_admin(tenant_id));

-- RPC
create or replace function public.save_recipe(p_product_id uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
  v_product_kind text;
  v_item record;
  v_component_tenant_id uuid;
begin
  -- Validate product
  select tenant_id, kind into v_tenant_id, v_product_kind
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'product_not_found';
  end if;

  if v_product_kind != 'finished' then
    raise exception 'product_not_finished';
  end if;

  -- Validate permissions
  if not public.user_is_tenant_admin(v_tenant_id) then
    raise exception 'permission_denied';
  end if;

  -- Atomic replace
  delete from public.recipe_items where product_id = p_product_id;

  for v_item in select * from jsonb_to_recordset(p_items) as x(component_product_id uuid, qty numeric) loop
    if v_item.qty <= 0 then
      raise exception 'recipe_qty_invalid';
    end if;

    -- Validate component belongs to same tenant
    select tenant_id into v_component_tenant_id
    from public.products
    where id = v_item.component_product_id;

    if not found then
      raise exception 'component_not_found';
    end if;

    if v_component_tenant_id != v_tenant_id then
      raise exception 'component_tenant_mismatch';
    end if;

    insert into public.recipe_items (
      tenant_id,
      product_id,
      component_product_id,
      qty
    ) values (
      v_tenant_id,
      p_product_id,
      v_item.component_product_id,
      v_item.qty
    );
  end loop;
end;
$$;

grant select, insert, update, delete on public.recipe_items to authenticated, service_role;

