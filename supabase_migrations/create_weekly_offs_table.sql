-- Create the weekly_offs table
CREATE TABLE public.weekly_offs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year text NOT NULL,
    week_number integer NOT NULL,
    is_off boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add primary key constraint (this automatically creates an index)
ALTER TABLE public.weekly_offs ADD CONSTRAINT weekly_offs_pkey PRIMARY KEY (id);

-- Add unique constraint for year and week_number to prevent duplicates (this also creates an index)
ALTER TABLE public.weekly_offs ADD CONSTRAINT weekly_offs_year_week_number_key UNIQUE (year, week_number);

-- Enable Row Level Security (RLS) for the table
ALTER TABLE public.weekly_offs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for weekly_offs table
CREATE POLICY "Enable read access for all users" ON "public"."weekly_offs"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON "public"."weekly_offs"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON "public"."weekly_offs"
AS PERMISSIVE FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users only" ON "public"."weekly_offs"
AS PERMISSIVE FOR DELETE
TO authenticated
USING (true);