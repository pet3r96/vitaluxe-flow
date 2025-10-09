-- Create patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  birth_date DATE,
  allergies TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for patients table
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create policies for patients table
CREATE POLICY "All authenticated users can view patients" 
ON public.patients 
FOR SELECT 
USING (true);

CREATE POLICY "All authenticated users can create patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "All authenticated users can update patients" 
ON public.patients 
FOR UPDATE 
USING (true);

-- Add patient_id column to cart_lines
ALTER TABLE public.cart_lines 
ADD COLUMN patient_id UUID REFERENCES public.patients(id);

-- Add patient_id column to order_lines
ALTER TABLE public.order_lines 
ADD COLUMN patient_id UUID REFERENCES public.patients(id);

-- Create update trigger for patients
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert test products
INSERT INTO public.products (name, base_price, retail_price, topline_price, downline_price, dosage, sig, active) VALUES
('Semaglutide 0.25mg', 299.99, 399.99, 369.99, 329.99, '0.25mg/0.5ml', 'Inject subcutaneously once weekly', true),
('Semaglutide 0.5mg', 329.99, 429.99, 399.99, 359.99, '0.5mg/0.5ml', 'Inject subcutaneously once weekly', true),
('Semaglutide 1.0mg', 359.99, 459.99, 429.99, 389.99, '1.0mg/0.5ml', 'Inject subcutaneously once weekly', true),
('Tirzepatide 2.5mg', 399.99, 529.99, 499.99, 449.99, '2.5mg/0.5ml', 'Inject subcutaneously once weekly', true),
('Tirzepatide 5.0mg', 429.99, 559.99, 529.99, 479.99, '5.0mg/0.5ml', 'Inject subcutaneously once weekly', true),
('Tirzepatide 7.5mg', 459.99, 589.99, 559.99, 509.99, '7.5mg/0.5ml', 'Inject subcutaneously once weekly', true),
('Vitamin B12 1000mcg', 49.99, 79.99, 69.99, 59.99, '1000mcg/ml', 'Inject intramuscularly monthly', true),
('NAD+ 100mg', 149.99, 199.99, 179.99, 159.99, '100mg/2ml', 'Inject subcutaneously as directed', true),
('Lipo-Mino Mix', 89.99, 129.99, 119.99, 99.99, '10ml vial', 'Inject subcutaneously 2-3 times weekly', true),
('Testosterone Cypionate 200mg', 199.99, 279.99, 249.99, 219.99, '200mg/ml', 'Inject intramuscularly weekly', true);

-- Insert test patients
INSERT INTO public.patients (name, email, phone, address, birth_date, allergies, notes) VALUES
('John Smith', 'john.smith@email.com', '(555) 123-4567', '123 Main St, Anytown, CA 90210', '1985-06-15', 'Penicillin', 'Type 2 diabetes patient'),
('Sarah Johnson', 'sarah.j@email.com', '(555) 234-5678', '456 Oak Ave, Springfield, TX 75001', '1992-03-22', 'None known', 'Weight management program'),
('Michael Davis', 'mdavis@email.com', '(555) 345-6789', '789 Pine St, Riverside, FL 33101', '1978-11-08', 'Sulfa drugs', 'Low testosterone treatment'),
('Emily Wilson', 'emily.wilson@email.com', '(555) 456-7890', '321 Elm Dr, Lakewood, NY 10001', '1989-07-12', 'Latex', 'Wellness optimization'),
('Robert Brown', 'rbrown@email.com', '(555) 567-8901', '654 Maple Ln, Hillcrest, AZ 85001', '1995-01-30', 'Shellfish', 'Hormone replacement therapy');