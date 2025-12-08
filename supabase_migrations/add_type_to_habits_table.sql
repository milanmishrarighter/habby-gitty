-- Add 'type' column to the habits table
ALTER TABLE habits
ADD COLUMN type text NOT NULL DEFAULT 'tracking';

-- Update existing rows to set 'type' to 'tracking' if they were created before this column existed
UPDATE habits
SET type = 'tracking'
WHERE type IS NULL;