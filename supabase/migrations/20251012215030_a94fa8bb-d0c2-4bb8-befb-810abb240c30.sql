-- Add prescription writing fields to cart_lines
ALTER TABLE cart_lines ADD COLUMN custom_sig TEXT;
ALTER TABLE cart_lines ADD COLUMN custom_dosage TEXT;
ALTER TABLE cart_lines ADD COLUMN order_notes TEXT;
ALTER TABLE cart_lines ADD COLUMN prescription_method TEXT CHECK (prescription_method IN ('upload', 'written'));

-- Add prescription writing fields to order_lines
ALTER TABLE order_lines ADD COLUMN custom_sig TEXT;
ALTER TABLE order_lines ADD COLUMN custom_dosage TEXT;
ALTER TABLE order_lines ADD COLUMN order_notes TEXT;
ALTER TABLE order_lines ADD COLUMN prescription_method TEXT CHECK (prescription_method IN ('upload', 'written'));