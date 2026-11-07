-- Add client_game_id column to scores table for deduplication of guest progress sync
ALTER TABLE scores ADD COLUMN IF NOT EXISTS client_game_id uuid;

-- Create unique index on client_game_id to prevent duplicate submissions
CREATE UNIQUE INDEX IF NOT EXISTS scores_client_game_id_unique ON scores (client_game_id) WHERE client_game_id IS NOT NULL;

-- Add index for faster queries on client_game_id
CREATE INDEX IF NOT EXISTS scores_client_game_id_idx ON scores (client_game_id);