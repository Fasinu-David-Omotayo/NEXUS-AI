-- Nexus AI secure desktop pairing migration
-- Apply this in the Supabase SQL Editor for the Nexus AI project.
-- Pairing codes and device tokens are stored as hashes, never in plaintext.

create extension if not exists pgcrypto;

create or replace function public.claim_nexus_desktop_pairing(
  p_code_hash text,
  p_device_name text,
  p_operating_system text,
  p_token_hash text
)
returns table (device_id uuid, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pairing_row public.desktop_pairing_codes%rowtype;
  new_device_id uuid;
begin
  if p_code_hash is null or length(p_code_hash) <> 64
     or p_token_hash is null or length(p_token_hash) <> 64 then
    raise exception 'Invalid pairing credentials';
  end if;

  if p_device_name is null or length(trim(p_device_name)) < 1
     or length(p_device_name) > 120 then
    raise exception 'Invalid device name';
  end if;

  if p_operating_system is null or length(p_operating_system) > 80 then
    raise exception 'Invalid operating system';
  end if;

  -- Lock the one-time code row so two agents cannot claim it concurrently.
  select *
    into pairing_row
    from public.desktop_pairing_codes
   where code_hash = p_code_hash
     and claimed_at is null
     and expires_at > now()
   for update;

  if not found then
    raise exception 'Pairing code is invalid, expired, or already used';
  end if;

  insert into public.desktop_devices (
    user_id,
    device_name,
    operating_system,
    status,
    token_hash,
    paired_at,
    last_seen_at
  )
  values (
    pairing_row.user_id,
    trim(p_device_name),
    trim(p_operating_system),
    'offline',
    p_token_hash,
    now(),
    now()
  )
  returning id into new_device_id;

  update public.desktop_pairing_codes
     set claimed_at = now(),
         device_id = new_device_id
   where id = pairing_row.id
     and claimed_at is null;

  if not found then
    raise exception 'Pairing code has already been claimed';
  end if;

  return query select new_device_id, pairing_row.user_id;
end;
$$;

revoke all on function public.claim_nexus_desktop_pairing(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_nexus_desktop_pairing(text, text, text, text)
  to service_role;

comment on function public.claim_nexus_desktop_pairing(text, text, text, text)
  is 'Atomically claims a one-time Nexus desktop pairing code; callable only by the Supabase service role.';
