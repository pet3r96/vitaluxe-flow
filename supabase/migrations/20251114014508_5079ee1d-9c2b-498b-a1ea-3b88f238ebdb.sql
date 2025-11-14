-- Create security definer function to check if user can view a provider's profile
-- This avoids infinite recursion in RLS policies
create or replace function public.can_view_provider_profile(_viewer_id uuid, _profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Check if viewer is the profile owner
  select exists (
    select 1 where _viewer_id = _profile_id
  )
  -- OR viewer is admin
  or exists (
    select 1 from user_roles
    where user_id = _viewer_id and role = 'admin'
  )
  -- OR viewer is a practice (doctor) and profile belongs to a provider in their practice
  or exists (
    select 1 from providers
    where practice_id = _viewer_id
      and user_id = _profile_id
      and active = true
  )
  -- OR viewer is staff and profile belongs to a provider in their practice
  or exists (
    select 1
    from practice_staff ps
    join providers p on p.practice_id = ps.practice_id
    where ps.user_id = _viewer_id
      and ps.active = true
      and p.user_id = _profile_id
      and p.active = true
  )
  -- OR viewer is a provider and profile belongs to another provider in the same practice
  or exists (
    select 1
    from providers viewer_provider
    join providers target_provider on target_provider.practice_id = viewer_provider.practice_id
    where viewer_provider.user_id = _viewer_id
      and target_provider.user_id = _profile_id
      and viewer_provider.active = true
      and target_provider.active = true
  );
$$;

-- Add comment explaining the function
comment on function public.can_view_provider_profile is 
'Security definer function to check if a user can view a provider profile. Returns true if viewer is: the profile owner, admin, practice owner of the provider, staff in the same practice, or provider in the same practice.';

-- Create RLS policy for practices/staff/providers to read provider profiles
-- This allows reading minimal fields needed for provider selects
create policy "Practices and staff can view provider profiles"
on public.profiles
for select
using (
  can_view_provider_profile(auth.uid(), id)
);

-- Grant execute permission on the function to authenticated users
grant execute on function public.can_view_provider_profile to authenticated;