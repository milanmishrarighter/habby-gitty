-- Add sort_order column to habits table
ALTER TABLE habits
ADD COLUMN sort_order INT;

-- Set initial sort_order for existing habits based on their created_at timestamp
-- This ensures existing habits have a default order.
-- Newer habits (more recent created_at) will have a lower sort_order (appear higher).
WITH ranked_habits AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn -- 0-indexed order
  FROM habits
)
UPDATE habits
SET sort_order = rh.rn
FROM ranked_habits rh
WHERE habits.id = rh.id;

-- Make sort_order NOT NULL and add a default value for new habits
ALTER TABLE habits
ALTER COLUMN sort_order SET NOT NULL,
ALTER COLUMN sort_order SET DEFAULT 0; -- Default to 0, new habits will be inserted at the top

-- Create a unique index on sort_order to prevent duplicates, if desired.
-- This might be too restrictive if you want to allow temporary duplicate orders before re-saving.
-- For now, we'll rely on the application logic to manage unique ordering.
-- CREATE UNIQUE INDEX habits_sort_order_idx ON habits (sort_order);