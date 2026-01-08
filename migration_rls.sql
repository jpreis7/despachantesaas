-- Add user_id column to tables
ALTER TABLE public.services ADD COLUMN user_id uuid references auth.users default auth.uid();
ALTER TABLE public.clients ADD COLUMN user_id uuid references auth.users default auth.uid();
ALTER TABLE public.dispatchers ADD COLUMN user_id uuid references auth.users default auth.uid();

-- Force RLS on tables
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatchers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (optional, to be safe)
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.services;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.clients;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.dispatchers;

-- Create Policies for services
CREATE POLICY "Users can manage their own services" ON public.services
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create Policies for clients
CREATE POLICY "Users can manage their own clients" ON public.clients
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create Policies for dispatchers
CREATE POLICY "Users can manage their own dispatchers" ON public.dispatchers
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
