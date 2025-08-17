-- Create the users table
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(), -- Link to auth.users
    address TEXT PRIMARY KEY, -- Wallet address as primary key
    reputation INT NOT NULL DEFAULT 0,
    completed_promises INT NOT NULL DEFAULT 0,
    failed_promises INT NOT NULL DEFAULT 0,
    total_promises INT NOT NULL DEFAULT 0,
    streak INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy for users to insert their own profile on first login/interaction
CREATE POLICY "Users can create their own profile."
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy for users to view their own profile
CREATE POLICY "Users can view their own profile."
ON public.users FOR SELECT
USING (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update their own profile."
ON public.users FOR UPDATE
USING (auth.uid() = id);

-- Policy for all users to view basic user data (e.g., for global stats, top performer)
CREATE POLICY "All users can view basic user data."
ON public.users FOR SELECT
USING (true);
