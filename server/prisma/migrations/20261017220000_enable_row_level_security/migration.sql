-- Turn on row level security for every table, with no policies.
--
-- Why: Supabase exposes the public schema through its Data API (PostgREST),
-- reachable with the project's anon key. With RLS on and no policies, the
-- anon/authenticated roles can't read or write any row through that API.
--
-- Our Express API is unaffected: Prisma connects as the table owner (postgres),
-- and Postgres doesn't apply RLS to a table's owner.
--
-- Every future migration that creates a table must also enable RLS on it.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qr_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;