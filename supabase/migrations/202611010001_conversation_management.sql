-- Nexus AI v0.4: account-scoped conversation history
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations(user_id, updated_at desc);
create index if not exists conversation_messages_conversation_created_idx
  on public.conversation_messages(conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "Users can view their own conversations" on public.conversations;
create policy "Users can view their own conversations"
  on public.conversations for select using (auth.uid() = user_id);
drop policy if exists "Users can create their own conversations" on public.conversations;
create policy "Users can create their own conversations"
  on public.conversations for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own conversations" on public.conversations;
create policy "Users can update their own conversations"
  on public.conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own conversations" on public.conversations;
create policy "Users can delete their own conversations"
  on public.conversations for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own conversation messages" on public.conversation_messages;
create policy "Users can view their own conversation messages"
  on public.conversation_messages for select using (auth.uid() = user_id);
drop policy if exists "Users can add messages to their own conversations" on public.conversation_messages;
create policy "Users can add messages to their own conversations"
  on public.conversation_messages for insert with check (
    auth.uid() = user_id and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
drop policy if exists "Users can delete their own conversation messages" on public.conversation_messages;
create policy "Users can delete their own conversation messages"
  on public.conversation_messages for delete using (auth.uid() = user_id);

create or replace function public.touch_conversation_updated_at()
returns trigger language plpgsql as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists conversation_message_touch_parent on public.conversation_messages;
create trigger conversation_message_touch_parent
after insert on public.conversation_messages
for each row execute function public.touch_conversation_updated_at();
