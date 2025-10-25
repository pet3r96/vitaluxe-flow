-- Add 'amazon' as a valid carrier option to shipping_carrier enum
ALTER TYPE shipping_carrier ADD VALUE IF NOT EXISTS 'amazon';