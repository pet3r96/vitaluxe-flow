-- Step 1: Add new shipping speed enum values only
ALTER TYPE shipping_speed ADD VALUE IF NOT EXISTS 'priority';
ALTER TYPE shipping_speed ADD VALUE IF NOT EXISTS 'first_class';