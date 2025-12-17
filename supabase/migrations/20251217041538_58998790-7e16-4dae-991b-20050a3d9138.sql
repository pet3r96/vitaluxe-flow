-- Clean up BareMeds-specific columns

-- Set all api_handler_type values to null (column can be dropped later)
UPDATE public.pharmacies
SET api_handler_type = NULL
WHERE api_handler_type IS NOT NULL;

-- Rename baremeds_response to pharmacy_response for clarity
ALTER TABLE public.pharmacy_order_jobs
RENAME COLUMN baremeds_response TO pharmacy_response;

-- Add comment for documentation
COMMENT ON COLUMN public.pharmacy_order_jobs.pharmacy_response IS 'Response from pharmacy API after successful order transmission';