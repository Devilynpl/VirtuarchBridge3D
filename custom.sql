
-- CHECK constraints
ALTER TABLE "users" ADD CONSTRAINT "check_status" CHECK ("status" IN ('online', 'offline', 'away', 'busy'));
ALTER TABLE "conversations" ADD CONSTRAINT "check_type" CHECK ("type" IN ('channel', 'direct'));
ALTER TABLE "conversation_members" ADD CONSTRAINT "check_role" CHECK ("role" IN ('owner', 'admin', 'member'));
ALTER TABLE "messages" ADD CONSTRAINT "check_type" CHECK ("type" IN ('text', 'file', 'image', 'system', 'voice', 'asset_request'));
ALTER TABLE "asset_requests" ADD CONSTRAINT "check_status" CHECK ("status" IN ('pending', 'fulfilled', 'cancelled'));

-- Full-text search on messages
ALTER TABLE "messages" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;
CREATE INDEX "idx_messages_search" ON "messages" USING GIN("search_vector");
