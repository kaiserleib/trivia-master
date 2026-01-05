-- User settings table for storing per-user API keys
create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  claude_api_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table user_settings enable row level security;

-- Users can only see and modify their own settings
create policy "Users can view own settings" on user_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert own settings" on user_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);

create policy "Users can delete own settings" on user_settings
  for delete using (auth.uid() = user_id);
