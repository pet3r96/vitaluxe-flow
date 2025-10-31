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
