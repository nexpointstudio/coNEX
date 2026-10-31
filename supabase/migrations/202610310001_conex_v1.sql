create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index invites_valid_idx on public.invites (expires_at) where used_at is null;

create table public.channels (
  id text primary key,
  label text not null,
  constraint allowed_channel check (id in ('geral', 'desenvolvimento', 'compartilhamentos'))
);
insert into public.channels (id, label) values
  ('geral', 'geral'), ('desenvolvimento', 'desenvolvimento'), ('compartilhamentos', 'compartilhamentos');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null references public.channels(id),
  author_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now(),
  constraint content_length check (char_length(btrim(content)) between 1 and 2000 and content = btrim(content))
);
create index messages_page_idx on public.messages (channel_id, created_at desc, id desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  channel_id text not null references public.channels(id),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, message_id)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, channel_id) where read_at is null;

create table public.account_attempts (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index account_attempts_window_idx on public.account_attempts (bucket, created_at desc);

create function public.is_member() returns boolean language sql stable security definer
  set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and active)
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.account_attempts enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (public.is_member());
create policy channels_read on public.channels for select to authenticated using (public.is_member());
create policy messages_read on public.messages for select to authenticated using (public.is_member());
create policy messages_send on public.messages for insert to authenticated
  with check (public.is_member() and author_id = (select auth.uid()));
create policy notifications_read on public.notifications for select to authenticated
  using (public.is_member() and user_id = (select auth.uid()));
create policy notifications_mark on public.notifications for update to authenticated
  using (public.is_member() and user_id = (select auth.uid()))
  with check (public.is_member() and user_id = (select auth.uid()));

revoke all on public.invites, public.account_attempts from anon, authenticated;
grant select on public.profiles, public.channels, public.messages, public.notifications to authenticated;
grant insert on public.messages to authenticated;
grant update (read_at) on public.notifications to authenticated;

create function public.create_message_notifications() returns trigger language plpgsql security definer
  set search_path = '' as $$
begin
  insert into public.notifications (user_id, message_id, channel_id)
  select id, new.id, new.channel_id from public.profiles
  where active and id <> new.author_id
  on conflict (user_id, message_id) do nothing;
  return new;
end
$$;
revoke all on function public.create_message_notifications() from public, anon, authenticated;
create trigger message_notifications after insert on public.messages
  for each row execute function public.create_message_notifications();

-- Only the Edge Function service role may call this atomic rate limiter.
create function public.check_account_rate(p_bucket text, p_limit int, p_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if length(p_bucket) > 250 or p_limit not between 1 and 20 or p_seconds not between 30 and 3600 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext(p_bucket));
  select count(*) into n from public.account_attempts
    where bucket = p_bucket and created_at > now() - make_interval(secs => p_seconds);
  if n >= p_limit then return false; end if;
  insert into public.account_attempts(bucket) values (p_bucket);
  return true;
end
$$;
revoke all on function public.check_account_rate(text, int, int) from public, anon, authenticated;
grant execute on function public.check_account_rate(text, int, int) to service_role;

-- Realtime authorization still follows table RLS.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
