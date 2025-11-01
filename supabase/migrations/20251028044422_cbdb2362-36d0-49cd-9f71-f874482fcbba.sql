-- Add 'subscription' to app_role enum in a separate transaction
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'subscription';