-- Populate missing provider credentials with test data

-- Provider 1: Dr. Sarah Johnson
UPDATE profiles
SET 
  full_name = 'Dr. Sarah Johnson',
  npi = '1234567890',
  dea = 'BJ1234567',
  license_number = 'ML-38383920',
  phone = '(555) 123-4567'
WHERE id = '61608b66-9ccf-4bfa-b665-d5fbb07c6bee';

-- Provider 2: Dr. Michael Chen
UPDATE profiles
SET 
  full_name = 'Dr. Michael Chen',
  npi = '1234567891',
  dea = 'BC2345678',
  license_number = 'ML-38383921',
  phone = '(555) 234-5678'
WHERE id = 'b235e520-b95e-4b85-b28e-7359f93a600a';

-- Provider 3: Dr. Jennifer Martinez
UPDATE profiles
SET 
  full_name = 'Dr. Jennifer Martinez',
  npi = '1234567892',
  dea = 'BM3456789',
  license_number = 'ML-38383922',
  phone = '(555) 345-6789'
WHERE id = 'a78d664e-a6e8-45ba-9a1e-f6aff4562af8';

-- Provider 4: Dr. Robert Williams
UPDATE profiles
SET 
  full_name = 'Dr. Robert Williams',
  npi = '1234567893',
  dea = 'BW4567890',
  license_number = 'ML-38383923',
  phone = '(555) 456-7890'
WHERE id = '421d8e6e-fa25-4ca0-a743-b92a99f36bdc';