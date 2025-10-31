/**
 * Medical API Service
 * Provides autocomplete functionality for medications, conditions, and allergens
 * using public NIH APIs
 */

export interface MedicalSuggestion {
  value: string;
  label: string;
  code?: string;
}

/**
 * Search medications using RxNorm API
 * @param query - Search term (minimum 2 characters)
 * @returns Array of medication suggestions
 */
export async function searchMedications(query: string): Promise<MedicalSuggestion[]> {
  if (query.length < 2) return [];

  try {
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=10`
    );
    
    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    const candidates = data.approximateGroup?.candidate || [];
    
    return candidates.map((candidate: any) => ({
      value: candidate.name,
      label: candidate.name,
      code: candidate.rxcui,
    }));
  } catch (error) {
    console.error('Error fetching medications:', error);
    return [];
  }
}

/**
 * Search medical conditions using NIH Clinical Tables API
 * @param query - Search term (minimum 2 characters)
 * @returns Array of condition suggestions
 */
export async function searchConditions(query: string): Promise<MedicalSuggestion[]> {
  if (query.length < 2) return [];

  try {
    const response = await fetch(
      `https://clinicaltables.nlm.nih.gov/api/conditions/v3/search?terms=${encodeURIComponent(query)}&maxList=10`
    );
    
    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    const results = data[3] || [];
    
    return results.map((item: any) => ({
      value: item[0],
      label: item[0],
      code: item[1], // ICD-10 code if available
    }));
  } catch (error) {
    console.error('Error fetching conditions:', error);
    return [];
  }
}

/**
 * Common allergens list (used as fallback and for quick suggestions)
 */
const COMMON_ALLERGENS = [
  // Medications
  "Penicillin", "Amoxicillin", "Ampicillin", "Sulfa drugs", "Aspirin", "Ibuprofen",
  "Codeine", "Morphine", "Latex", "Contrast dye", "Lidocaine",
  // Foods
  "Peanuts", "Tree nuts", "Almonds", "Walnuts", "Cashews", "Shellfish", "Shrimp",
  "Crab", "Lobster", "Fish", "Eggs", "Milk", "Dairy", "Soy", "Wheat", "Gluten",
  "Sesame", "Strawberries", "Tomatoes",
  // Environmental
  "Pollen", "Grass pollen", "Tree pollen", "Ragweed", "Dust mites", "Pet dander",
  "Cat dander", "Dog dander", "Mold", "Bee stings", "Wasp stings", "Fire ants",
  "Nickel", "Fragrance", "Formaldehyde",
];

/**
 * Common vaccines list from CDC CVX code set
 * Includes active and commonly administered vaccines with CVX codes
 */
const COMMON_VACCINES = [
  // COVID-19
  { name: "COVID-19, mRNA (Pfizer-BioNTech)", code: "208" },
  { name: "COVID-19, mRNA (Moderna)", code: "207" },
  { name: "COVID-19, vector (Janssen)", code: "212" },
  
  // Influenza
  { name: "Influenza, seasonal, injectable", code: "141" },
  { name: "Influenza, seasonal, intranasal", code: "149" },
  { name: "Influenza, high dose seasonal", code: "161" },
  
  // Childhood vaccines
  { name: "DTaP (Diphtheria, Tetanus, Pertussis)", code: "20" },
  { name: "DT (pediatric)", code: "28" },
  { name: "Tdap (Tetanus, Diphtheria, acellular Pertussis)", code: "115" },
  { name: "Td (adult)", code: "113" },
  { name: "Tetanus toxoid, adsorbed", code: "35" },
  
  { name: "MMR (Measles, Mumps, Rubella)", code: "03" },
  { name: "Measles", code: "05" },
  { name: "Mumps", code: "07" },
  { name: "Rubella", code: "06" },
  { name: "MMRV (Measles, Mumps, Rubella, Varicella)", code: "94" },
  
  { name: "Polio, inactivated (IPV)", code: "10" },
  { name: "Polio, oral", code: "02" },
  
  { name: "Varicella (Chickenpox)", code: "21" },
  { name: "Zoster (Shingles), recombinant", code: "187" },
  { name: "Zoster (Shingles), live", code: "121" },
  
  { name: "Hepatitis A, adult", code: "83" },
  { name: "Hepatitis A, pediatric", code: "52" },
  { name: "Hepatitis B, adult", code: "43" },
  { name: "Hepatitis B, pediatric", code: "08" },
  { name: "Hepatitis A and B", code: "104" },
  
  { name: "HPV, quadrivalent", code: "62" },
  { name: "HPV, 9-valent", code: "165" },
  
  { name: "Hib (Haemophilus influenzae type b)", code: "49" },
  { name: "Hib-Hep B", code: "51" },
  
  // Pneumococcal
  { name: "Pneumococcal conjugate PCV 13", code: "133" },
  { name: "Pneumococcal conjugate PCV 15", code: "216" },
  { name: "Pneumococcal conjugate PCV 20", code: "215" },
  { name: "Pneumococcal polysaccharide PPV23", code: "33" },
  
  // Meningococcal
  { name: "Meningococcal conjugate (MenACWY)", code: "114" },
  { name: "Meningococcal B (MenB)", code: "162" },
  { name: "Meningococcal B, recombinant", code: "163" },
  
  // Rotavirus
  { name: "Rotavirus, pentavalent", code: "116" },
  { name: "Rotavirus, monovalent", code: "119" },
  
  // Other common vaccines
  { name: "BCG (Tuberculosis)", code: "19" },
  { name: "Rabies", code: "40" },
  { name: "Yellow fever", code: "37" },
  { name: "Japanese encephalitis", code: "134" },
  { name: "Typhoid, oral", code: "25" },
  { name: "Typhoid, injectable", code: "101" },
  { name: "Anthrax", code: "24" },
  { name: "Smallpox", code: "75" },
  { name: "Mpox (Monkeypox)", code: "206" },
  { name: "RSV, maternal", code: "314" },
  { name: "RSV, monoclonal antibody", code: "309" },
  { name: "Dengue", code: "171" },
  { name: "Cholera", code: "174" },
  { name: "Ebola", code: "204" },
];

/**
 * Search allergens (combines RxNorm API and common allergens list)
 * @param query - Search term (minimum 2 characters)
 * @returns Array of allergen suggestions
 */
export async function searchAllergens(query: string): Promise<MedicalSuggestion[]> {
  if (query.length < 2) return [];

  const lowerQuery = query.toLowerCase();

  // Filter common allergens
  const commonMatches = COMMON_ALLERGENS
    .filter(allergen => allergen.toLowerCase().includes(lowerQuery))
    .slice(0, 5)
    .map(allergen => ({
      value: allergen,
      label: allergen,
    }));

  // Try to fetch medication allergens from RxNorm
  try {
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(query)}&maxEntries=5`
    );
    
    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    const candidates = data.approximateGroup?.candidate || [];
    
    const medicationMatches = candidates.map((candidate: any) => ({
      value: candidate.name,
      label: `${candidate.name} (medication)`,
      code: candidate.rxcui,
    }));

    // Combine and deduplicate results
    const combined = [...commonMatches, ...medicationMatches];
    const unique = combined.filter((item, index, self) => 
      index === self.findIndex(t => t.value.toLowerCase() === item.value.toLowerCase())
    );

    return unique.slice(0, 10);
  } catch (error) {
    console.error('Error fetching medication allergens:', error);
    // Return common allergens as fallback
    return commonMatches;
  }
}

/**
 * Search vaccines from CDC CVX code set
 * @param query - Search term (minimum 2 characters)
 * @returns Array of vaccine suggestions with CVX codes
 */
export async function searchVaccines(query: string): Promise<MedicalSuggestion[]> {
  if (query.length < 2) return [];

  const lowerQuery = query.toLowerCase();

  // Filter common vaccines
  const matches = COMMON_VACCINES
    .filter(vaccine => vaccine.name.toLowerCase().includes(lowerQuery))
    .slice(0, 10)
    .map(vaccine => ({
      value: vaccine.name,
      label: vaccine.name,
      code: vaccine.code,
    }));

  return matches;
}
