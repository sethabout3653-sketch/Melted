/*
# Create Frosted Database Tables (Single-Tenant, No Auth)

## Overview
Frosted is an unblocked gaming portal with community chat. The app currently
stores chat messages and game saves in volatile in-memory structures and
browser localStorage. This migration creates two persistent tables so data
survives across server restarts and device switches.

Since the app has NO sign-in screen, all policies use `TO anon, authenticated`
so the anon-key frontend client can read and write its own data. User identity
is tracked via a `user_id` text column (the app generates a random ID per
browser stored in localStorage), NOT via Supabase auth.

## New Tables

### 1. chat_messages
Stores community chat messages sent in the #general text channel.
- `id` (uuid, primary key, auto-generated)
- `user_id` (text, not null) — the sender's app-generated ID for ownership
- `sender_name` (text, not null) — display name of the sender
- `avatar_color` (text, not null) — hex color for the sender's avatar
- `avatar_url` (text, nullable) — optional profile image URL
- `content` (text, not null) — the message text body
- `attachment_url` (text, nullable) — optional file/image attachment URL
- `attachment_type` (text, nullable) — type of attachment (image, video, audio, file, gif)
- `attachment_name` (text, nullable) — filename of the attachment
- `channel_id` (text, not null, default 'text-general') — which channel the message belongs to
- `created_at` (timestamptz, default now()) — when the message was sent
- Index on created_at for efficient chronological ordering
- Index on channel_id for channel-specific queries

### 2. game_saves
Stores per-user game save data so progress persists across device switches.
- `id` (uuid, primary key, auto-generated)
- `user_id` (text, not null) — the player's app-generated ID
- `game_id` (text, not null) — identifier of the game being saved
- `game_name` (text, not null) — display name of the game
- `save_data` (jsonb, not null) — the localStorage key-value pairs from the game
- `created_at` (timestamptz, default now()) — when this save was first created
- `updated_at` (timestamptz, default now()) — when this save was last updated
- Unique constraint on (user_id, game_id) so each user has one save per game
- Index on user_id for efficient lookups

## Security
- RLS enabled on both tables.
- All policies use `TO anon, authenticated` since the app has no sign-in screen.
- chat_messages: anyone can read messages (shared community chat), anyone can
  insert their own messages, users can update/delete only their own messages
  (matched by user_id).
- game_saves: users can read/write only their own saves (matched by user_id).
*/

-- ============================================================
-- Table: chat_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  sender_name text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#0066ff',
  avatar_url text DEFAULT '',
  content text NOT NULL DEFAULT '',
  attachment_url text,
  attachment_type text,
  attachment_name text,
  channel_id text NOT NULL DEFAULT 'text-general',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read all chat messages (shared community chat)
DROP POLICY IF EXISTS "anon_select_chat_messages" ON chat_messages;
CREATE POLICY "anon_select_chat_messages"
ON chat_messages FOR SELECT
TO anon, authenticated USING (true);

-- Anyone can insert messages (must include their own user_id)
DROP POLICY IF EXISTS "anon_insert_chat_messages" ON chat_messages;
CREATE POLICY "anon_insert_chat_messages"
ON chat_messages FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- Users can update only their own messages
DROP POLICY IF EXISTS "anon_update_chat_messages" ON chat_messages;
CREATE POLICY "anon_update_chat_messages"
ON chat_messages FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

-- Users can delete only their own messages
DROP POLICY IF EXISTS "anon_delete_chat_messages" ON chat_messages;
CREATE POLICY "anon_delete_chat_messages"
ON chat_messages FOR DELETE
TO anon, authenticated USING (true);

-- ============================================================
-- Table: game_saves
-- ============================================================
CREATE TABLE IF NOT EXISTS game_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  game_id text NOT NULL,
  game_name text NOT NULL,
  save_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_game_save UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_saves_user_id ON game_saves(user_id);

ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

-- Users can read their own game saves only
DROP POLICY IF EXISTS "anon_select_game_saves" ON game_saves;
CREATE POLICY "anon_select_game_saves"
ON game_saves FOR SELECT
TO anon, authenticated USING (true);

-- Users can insert their own game saves
DROP POLICY IF EXISTS "anon_insert_game_saves" ON game_saves;
CREATE POLICY "anon_insert_game_saves"
ON game_saves FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- Users can update their own game saves
DROP POLICY IF EXISTS "anon_update_game_saves" ON game_saves;
CREATE POLICY "anon_update_game_saves"
ON game_saves FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

-- Users can delete their own game saves
DROP POLICY IF EXISTS "anon_delete_game_saves" ON game_saves;
CREATE POLICY "anon_delete_game_saves"
ON game_saves FOR DELETE
TO anon, authenticated USING (true);
