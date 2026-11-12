<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- EZRA's personality lives in `src/lib/ezra-persona.ts` and is shared by chat (`src/routes/api/chat.ts`) and voice (`src/lib/live-relay.server.ts`); edit persona there so both stay consistent.
- Chat streams through the `/api/chat` server route (bearer-verified) using the AI SDK UI message stream over Gateway SDK events; only the newest user message is sent, history is loaded from the database.
- Chat attachments are stored in the private `chat-attachments` bucket under `{userId}/{threadId}/`; message rows keep `storage:` paths, signed URLs are created on read.
- Voice uses the Live relay over `/api/live` (dev via `live-vite-plugin.ts`, deployed via `src/server.ts`); the browser sends its session token in `app.start` and the relay verifies it before opening a paid session.
- The UI is Arabic-first with `dir="rtl"` on `<html>`; use logical spacing (`ms-`/`me-`/`start`/`end`) and `dir="auto"` on user/AI text.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate); `/` is a public splash that forwards signed-in users to `/home`.