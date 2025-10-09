-- Add orphaned_pharmacies_converted column to sync_logs table
ALTER TABLE public.sync_logs 
ADD COLUMN IF NOT EXISTS orphaned_pharmacies_converted integer NOT NULL DEFAULT 0;