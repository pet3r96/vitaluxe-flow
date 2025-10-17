-- 1) Create table for product visibility overrides per topline rep
create table if not exists public.rep_product_visibility (
  topline_rep_id uuid not null,
  product_id uuid not null,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rep_product_visibility_pkey primary key (topline_rep_id, product_id),
  constraint rep_product_visibility_product_fk
    foreign key (product_id) references public.products(id) on delete cascade,
  constraint rep_product_visibility_topline_fk
    foreign key (topline_rep_id) references public.reps(id) on delete cascade
);

-- Helpful indexes
create index if not exists rep_product_visibility_topline_idx
  on public.rep_product_visibility (topline_rep_id);
create index if not exists rep_product_visibility_product_idx
  on public.rep_product_visibility (product_id);

-- Enable Row Level Security
alter table public.rep_product_visibility enable row level security;

-- Clean up existing policies to avoid conflicts on repeated migrations
drop policy if exists "Toplines can view their visibility" on public.rep_product_visibility;
drop policy if exists "Toplines can insert their visibility" on public.rep_product_visibility;
drop policy if exists "Toplines can update their visibility" on public.rep_product_visibility;
drop policy if exists "Toplines can delete their visibility" on public.rep_product_visibility;
drop policy if exists "Admins can manage all visibility" on public.rep_product_visibility;

-- RLS: Toplines manage only their own rows
create policy "Toplines can view their visibility"
  on public.rep_product_visibility
  for select
  using (
    has_role(auth.uid(), 'topline'::app_role)
    and topline_rep_id = get_current_user_rep_id()
  );

create policy "Toplines can insert their visibility"
  on public.rep_product_visibility
  for insert
  with check (
    has_role(auth.uid(), 'topline'::app_role)
    and topline_rep_id = get_current_user_rep_id()
  );

create policy "Toplines can update their visibility"
  on public.rep_product_visibility
  for update
  using (
    has_role(auth.uid(), 'topline'::app_role)
    and topline_rep_id = get_current_user_rep_id()
  )
  with check (
    has_role(auth.uid(), 'topline'::app_role)
    and topline_rep_id = get_current_user_rep_id()
  );

create policy "Toplines can delete their visibility"
  on public.rep_product_visibility
  for delete
  using (
    has_role(auth.uid(), 'topline'::app_role)
    and topline_rep_id = get_current_user_rep_id()
  );

-- RLS: Admins manage all
create policy "Admins can manage all visibility"
  on public.rep_product_visibility
  for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- 2) Function: return active products visible for current user
create or replace function public.get_visible_products_for_user()
returns table (id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  my_topline uuid;
  is_admin boolean;
begin
  -- Admins see all active products
  is_admin := has_role(auth.uid(), 'admin'::app_role);
  if is_admin then
    return query
      select p.id
      from public.products p
      where p.active = true;
    return;
  end if;

  -- Resolve governing topline (for providers/downlines, etc.)
  my_topline := get_my_topline_rep_id();

  -- If not linked to any topline, default to all active
  if my_topline is null then
    return query
      select p.id
      from public.products p
      where p.active = true;
    return;
  end if;

  -- Active products not explicitly hidden by this topline
  return query
    select p.id
    from public.products p
    where p.active = true
      and not exists (
        select 1
        from public.rep_product_visibility v
        where v.topline_rep_id = my_topline
          and v.product_id = p.id
          and v.visible = false
      );
end;
$$;