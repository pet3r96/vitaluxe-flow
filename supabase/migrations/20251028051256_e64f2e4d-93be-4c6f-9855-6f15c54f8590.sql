-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule trial payment reminders check (daily at 9 AM UTC)
SELECT cron.schedule(
  'check-trial-payment-reminders',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/check-trial-payment-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidHNmYWpzaG5yd3dsZnprZW9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDExMSwiZXhwIjoyMDc1NTcwMTExfQ.5YnRg3n6lOAZYg9MHOyxfMcdqnjdRFXoM5-WD4X-3Ss"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule trial to active conversion (daily at 10 AM UTC)
SELECT cron.schedule(
  'convert-trial-to-active',
  '0 10 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/convert-trial-to-active',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidHNmYWpzaG5yd3dsZnprZW9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDExMSwiZXhwIjoyMDc1NTcwMTExfQ.5YnRg3n6lOAZYg9MHOyxfMcdqnjdRFXoM5-WD4X-3Ss"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule subscription renewals (daily at 11 AM UTC)
SELECT cron.schedule(
  'handle-subscription-renewal',
  '0 11 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/handle-subscription-renewal',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidHNmYWpzaG5yd3dsZnprZW9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTk5NDExMSwiZXhwIjoyMDc1NTcwMTExfQ.5YnRg3n6lOAZYg9MHOyxfMcdqnjdRFXoM5-WD4X-3Ss"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);