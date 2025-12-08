-- Add user_id column to habits table
ALTER TABLE habits
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable Row Level Security on the habits table
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow authenticated users to insert their own habits
CREATE POLICY "Authenticated users can insert their own habits"
ON habits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create a policy to allow authenticated users to select their own habits
CREATE POLICY "Authenticated users can select their own habits"
ON habits FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create a policy to allow authenticated users to update their own habits
CREATE POLICY "Authenticated users can update their own habits"
ON habits FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create a policy to allow authenticated users to delete their own habits
CREATE POLICY "Authenticated users can delete their own habits"
TO authenticated
ON habits FOR DELETE
USING (auth.uid() = user_id);