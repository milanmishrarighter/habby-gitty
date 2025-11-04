-- Create the table
CREATE TABLE public.yearly_nothings_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    year TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, year)
);

-- Enable Row Level Security
ALTER TABLE public.yearly_nothings_counts ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to select their own records
CREATE POLICY "Allow authenticated users to read their own yearly_nothings_counts"
ON public.yearly_nothings_counts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for authenticated users to insert their own records
CREATE POLICY "Allow authenticated users to insert their own yearly_nothings_counts"
ON public.yearly_nothings_counts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for authenticated users to update their own records
CREATE POLICY "Allow authenticated users to update their own yearly_nothings_counts"
ON public.yearly_nothings_counts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Set up automatic updated_at timestamp
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.yearly_nothings_counts
FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');