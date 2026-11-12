# EZRA AI — Supabase schema

This folder is linked to the dedicated EZRA AI APP Supabase project.

## Current remote baseline

The remote database was configured before migration tracking was initialized. As verified on 2026-11-12, the remote `supabase_migrations.schema_migrations` history is empty even though the schema below already exists. **Do not apply a hand-written `CREATE TABLE` migration on top of this database.** That would duplicate existing objects or fail partway through.

To create the canonical baseline migration safely, use the Supabase CLI against this linked project:

```bash
npx supabase link --project-ref lctvtjlacddauhjooorj
npx supabase db pull --remote
```

The CLI's initial remote pull creates a timestamped baseline under `supabase/migrations/` and asks to record it as already applied. Accept that prompt. Then review and commit the generated migration. This captures the actual remote definitions rather than a manually reconstructed approximation.

## Verified application tables

All three tables are in the exposed `public` schema and have Row Level Security enabled.

### `public.profiles`

- `id uuid` — primary key and foreign key to `auth.users(id)`
- `display_name text`, `nickname text`, `profession text`, `lifestyle text`, `about text`, `instructions text`
- `humor_level smallint` — default 7, constrained to 0–10
- `affection_level smallint` — default 6, constrained to 0–10
- `communication_style text` — default `balanced`; allowed: `balanced`, `playful`, `calm`, `academic`
- `created_at timestamptz`, `updated_at timestamptz` — default `now()`

Authenticated users can select, insert, and update only their own profile.

### `public.conversations`

- `id uuid` — primary key, default `gen_random_uuid()`
- `user_id uuid` — foreign key to `auth.users(id)`, default `auth.uid()`
- `title text` — default Arabic title `محادثة جديدة`
- `created_at timestamptz`, `updated_at timestamptz` — default `now()`

Authenticated users can select, insert, update, and delete only their own conversations. The update policy checks ownership both before and after an update.

### `public.messages`

- `id uuid` — primary key, default `gen_random_uuid()`
- `conversation_id uuid` — foreign key to `public.conversations(id)`
- `user_id uuid` — foreign key to `auth.users(id)`, default `auth.uid()`
- `client_id text` — nullable
- `role text` — constrained to `user` or `assistant`
- `parts jsonb` — default empty array
- `created_at timestamptz` — default `now()`

Authenticated users can select and delete only their own messages. Inserts additionally verify that the referenced conversation belongs to the same authenticated user.

## Triggers and indexes

- `auth.users` trigger `on_auth_user_created` invokes `public.handle_new_user()` to create a profile after signup; duplicate profile IDs are ignored.
- `public.profiles` and `public.conversations` use `touch_updated_at()` before updates.
- Application indexes: `conversations_user_updated(user_id, updated_at DESC)` and `messages_conversation_created(conversation_id, created_at)`.

## Private file storage

Bucket `chat-attachments` is private, with a 10 MiB file-size limit. Allowed MIME types: `image/*`, `application/pdf`, `text/plain`, `text/markdown`, and `text/csv`.

Authenticated read, upload, and delete policies require the first storage path segment to equal the caller's `auth.uid()`. No public bucket access is enabled.

## Security notes

- Client applications must use the Supabase publishable key only.
- Never put a Supabase secret/service-role key in the client, repository, or a `VITE_*` variable.
- Keep RLS enabled and preserve the ownership checks above when extending the schema.
- This README is a verified schema inventory, **not** a replacement for the generated baseline migration. The CLI pull described above is still required to synchronize Git migration history with the existing remote database.
