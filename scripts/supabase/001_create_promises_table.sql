-- Drop table if it exists (USE WITH CAUTION IN PRODUCTION)
DROP TABLE IF EXISTS public.promises;

-- Create the promises table
CREATE TABLE public.promises (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    message TEXT NOT NULL,
    deadline BIGINT NOT NULL, -- Storing timestamp as BIGINT
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed'
    proof TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    admin_adjusted_progress INT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.promises ENABLE ROW LEVEL SECURITY;

-- Policy for public read access (all promises)
CREATE POLICY "Public promises are viewable by everyone."
ON public.promises FOR SELECT
USING (true);

-- Policy for users to insert their own promises
CREATE POLICY "Users can insert their own promises."
ON public.promises FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND address = (SELECT address FROM public.users WHERE id = auth.uid()));

-- Policy for users to update their own active promises, and for admin to update any promise
CREATE POLICY "Users can update their own active promises and admin can update any."
ON public.promises FOR UPDATE
USING (
  (auth.uid() IS NOT NULL AND address = (SELECT address FROM public.users WHERE id = auth.uid()) AND status = 'active')
  OR
  (auth.role() = 'service_role')
);

-- Policy for users to request deletion of their own promises (handled by admin API)
-- This policy is more about allowing the API to read/write delete requests, not direct user deletion.
-- Actual deletion is handled by admin API with service role key.
-- For direct user-initiated delete requests, the API route will handle the permission check.
