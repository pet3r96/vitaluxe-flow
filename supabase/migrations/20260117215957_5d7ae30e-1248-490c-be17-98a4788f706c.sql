-- Create VIOS allergies lookup table
CREATE TABLE public.vios_allergies (
  id SERIAL PRIMARY KEY,
  vios_code INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  alternate_names TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast name matching and autocomplete search
CREATE INDEX idx_vios_allergies_name_lower ON vios_allergies(LOWER(name));
CREATE INDEX idx_vios_allergies_name_gin ON vios_allergies USING gin(to_tsvector('english', name));
CREATE INDEX idx_vios_allergies_code ON vios_allergies(vios_code);

-- RLS: Read-only for authenticated users
ALTER TABLE vios_allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vios_allergies"
  ON vios_allergies FOR SELECT
  TO authenticated
  USING (true);

-- Comment for documentation
COMMENT ON TABLE public.vios_allergies IS 'VIOS pharmacy allergy codes lookup table - synced from VIOS API';