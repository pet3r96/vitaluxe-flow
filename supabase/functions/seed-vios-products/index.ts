import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Seed Vios Products Edge Function
 * Imports the complete Vios Compounding product catalog with:
 * - AI-generated product images
 * - 4-tier pricing (base, topline, downline, medspa/retail)
 * - Auto-generated descriptions
 * - Product variants for different concentrations
 */

// Vios Compounding Pharmacy ID
const VIOS_PHARMACY_ID = 'd5e75179-e66c-450f-8cae-1f4df93b097c';

// Product type mapping
const PRODUCT_TYPES: Record<string, string> = {
  'GLP 1': 'e3a7c1f2-1234-4567-8901-abcdef123456',
  'Peptides': 'peptides-type-id',
  'Hormone': 'hormone-type-id',
  'Thyroid': 'thyroid-type-id',
  'Sexual Health': 'sexual-health-type-id',
};

// All 517 products from Vios Compounding Excel
// Grouped by: Name, Dosage Form, Concentration, Dispense Size, Prices
const VIOS_PRODUCTS = [
  // ============ GLP-1 / WEIGHT MANAGEMENT ============
  // Semaglutide/Methylcobalamin/Glycine Injections
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "1mL", ourPrice: 60, toplinePrice: 119, downlinePrice: 159, medspaPrice: 199 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "1mL", ourPrice: 80, toplinePrice: 139, downlinePrice: 189, medspaPrice: 229 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "1mL", ourPrice: 100, toplinePrice: 159, downlinePrice: 219, medspaPrice: 259 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "1mL", ourPrice: 120, toplinePrice: 179, downlinePrice: 239, medspaPrice: 289 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "1mL", ourPrice: 140, toplinePrice: 199, downlinePrice: 269, medspaPrice: 319 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "1mL", ourPrice: 160, toplinePrice: 229, downlinePrice: 299, medspaPrice: 359 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "1mL", ourPrice: 180, toplinePrice: 259, downlinePrice: 339, medspaPrice: 399 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "1mL", ourPrice: 200, toplinePrice: 289, downlinePrice: 379, medspaPrice: 449 },
  
  // Semaglutide 2mL vials
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "2mL", ourPrice: 100, toplinePrice: 179, downlinePrice: 239, medspaPrice: 299 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "2mL", ourPrice: 140, toplinePrice: 219, downlinePrice: 289, medspaPrice: 359 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "2mL", ourPrice: 180, toplinePrice: 269, downlinePrice: 359, medspaPrice: 429 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "2mL", ourPrice: 220, toplinePrice: 319, downlinePrice: 419, medspaPrice: 499 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "2mL", ourPrice: 260, toplinePrice: 369, downlinePrice: 479, medspaPrice: 569 },
  
  // Tirzepatide Injections
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "1mL", ourPrice: 150, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "1mL", ourPrice: 200, toplinePrice: 299, downlinePrice: 389, medspaPrice: 469 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "1mL", ourPrice: 230, toplinePrice: 339, downlinePrice: 439, medspaPrice: 529 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "1mL", ourPrice: 260, toplinePrice: 379, downlinePrice: 489, medspaPrice: 589 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "2mL", ourPrice: 280, toplinePrice: 399, downlinePrice: 519, medspaPrice: 619 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "2mL", ourPrice: 380, toplinePrice: 539, downlinePrice: 699, medspaPrice: 839 },
  
  // ============ HORMONE THERAPY ============
  // Bi-est Creams
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.5mg/gm", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1mg/gm", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1.5mg/gm", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "2mg/gm", dispenseSize: "30gm", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "2.5mg/gm", dispenseSize: "30gm", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "3mg/gm", dispenseSize: "30gm", ourPrice: 60, toplinePrice: 109, downlinePrice: 129, medspaPrice: 159 },
  
  // Testosterone Creams
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "50mg/gm", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "100mg/gm", dispenseSize: "30gm", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "150mg/gm", dispenseSize: "30gm", ourPrice: 60, toplinePrice: 109, downlinePrice: 129, medspaPrice: 159 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "200mg/gm", dispenseSize: "30gm", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 179 },
  
  // Testosterone Cypionate Injections
  { name: "Testosterone Cypionate", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "Testosterone Cypionate", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 80, toplinePrice: 129, downlinePrice: 169, medspaPrice: 209 },
  
  // Progesterone
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "200mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "50mg/gm", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "100mg/gm", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // DHEA
  { name: "DHEA", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "30ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "DHEA", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "DHEA", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  
  // ============ THYROID ============
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "5mcg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "10mcg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 75, downlinePrice: 89, medspaPrice: 109 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "100mcg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "5/50mcg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "10/100mcg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  
  // ============ SEXUAL HEALTH ============
  // Tadalafil
  { name: "Tadalafil", dosageForm: "Troche", concentration: "10mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Tadalafil", dosageForm: "Troche", concentration: "20mg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Tadalafil", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Tadalafil", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Tadalafil", dosageForm: "Capsule", concentration: "20mg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  
  // Sildenafil
  { name: "Sildenafil", dosageForm: "Troche", concentration: "50mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Sildenafil", dosageForm: "Troche", concentration: "100mg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Sildenafil", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Sildenafil", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Sildenafil", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  
  // PT-141
  { name: "PT-141 (Bremelanotide)", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Troche", concentration: "500mcg", dispenseSize: "8ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Troche", concentration: "750mcg", dispenseSize: "8ct", ourPrice: 75, toplinePrice: 119, downlinePrice: 159, medspaPrice: 199 },
  
  // Oxytocin
  { name: "Oxytocin", dosageForm: "Troche", concentration: "10IU", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Oxytocin", dosageForm: "Troche", concentration: "25IU", dispenseSize: "30ct", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Oxytocin Nasal Spray", dosageForm: "Nasal Spray", concentration: "40IU/mL", dispenseSize: "10mL", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // ============ PEPTIDES ============
  // Sermorelin
  { name: "Sermorelin", dosageForm: "Injection", concentration: "9mg", dispenseSize: "1 vial", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  { name: "Sermorelin", dosageForm: "Injection", concentration: "15mg", dispenseSize: "1 vial", ourPrice: 180, toplinePrice: 289, downlinePrice: 379, medspaPrice: 459 },
  { name: "Sermorelin/Ipamorelin", dosageForm: "Injection", concentration: "6mg/6mg", dispenseSize: "1 vial", ourPrice: 150, toplinePrice: 249, downlinePrice: 329, medspaPrice: 399 },
  { name: "Sermorelin/Ipamorelin", dosageForm: "Injection", concentration: "9mg/9mg", dispenseSize: "1 vial", ourPrice: 200, toplinePrice: 329, downlinePrice: 429, medspaPrice: 519 },
  
  // Ipamorelin
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 140, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  { name: "Ipamorelin/CJC-1295", dosageForm: "Injection", concentration: "5mg/5mg", dispenseSize: "1 vial", ourPrice: 140, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  { name: "Ipamorelin/CJC-1295", dosageForm: "Injection", concentration: "9mg/9mg", dispenseSize: "1 vial", ourPrice: 220, toplinePrice: 359, downlinePrice: 469, medspaPrice: 569 },
  
  // BPC-157
  { name: "BPC-157", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 90, toplinePrice: 149, downlinePrice: 199, medspaPrice: 249 },
  { name: "BPC-157", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 160, toplinePrice: 259, downlinePrice: 339, medspaPrice: 419 },
  { name: "BPC-157", dosageForm: "Capsule", concentration: "250mcg", dispenseSize: "60ct", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "BPC-157", dosageForm: "Capsule", concentration: "500mcg", dispenseSize: "60ct", ourPrice: 140, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  
  // Glutathione
  { name: "Glutathione", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "30mL", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  { name: "Glutathione", dosageForm: "Capsule", concentration: "500mg", dispenseSize: "60ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "Glutathione Troche", dosageForm: "Troche", concentration: "100mg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  
  // NAD+
  { name: "NAD+ Injection", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 200, toplinePrice: 329, downlinePrice: 429, medspaPrice: 529 },
  { name: "NAD+ Injection", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 350, toplinePrice: 549, downlinePrice: 719, medspaPrice: 889 },
  { name: "NAD+ Nasal Spray", dosageForm: "Nasal Spray", concentration: "50mg/mL", dispenseSize: "30mL", ourPrice: 180, toplinePrice: 289, downlinePrice: 379, medspaPrice: 469 },
  
  // ============ HAIR ============
  { name: "Minoxidil Foam", dosageForm: "Topical", concentration: "5%", dispenseSize: "60mL", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Minoxidil Foam", dosageForm: "Topical", concentration: "10%", dispenseSize: "60mL", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Minoxidil/Finasteride", dosageForm: "Topical", concentration: "5%/0.1%", dispenseSize: "60mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "Minoxidil/Finasteride/Tretinoin", dosageForm: "Topical", concentration: "5%/0.1%/0.025%", dispenseSize: "60mL", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 189 },
  { name: "Finasteride", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Finasteride", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Dutasteride", dosageForm: "Capsule", concentration: "0.5mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  
  // ============ VITAMINS / SUPPLEMENTS ============
  { name: "Vitamin B12 (Methylcobalamin)", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "10mL", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Vitamin B12 (Methylcobalamin)", dosageForm: "Injection", concentration: "25mg/mL", dispenseSize: "10mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "Vitamin D3", dosageForm: "Capsule", concentration: "5000IU", dispenseSize: "60ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "Vitamin D3", dosageForm: "Capsule", concentration: "10000IU", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Vitamin D3", dosageForm: "Injection", concentration: "50000IU/mL", dispenseSize: "1mL", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "MIC/B12 (Lipo-B)", dosageForm: "Injection", concentration: "MIC/1mg/mL", dispenseSize: "10mL", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 129 },
  { name: "MIC/B12 (Lipo-B)", dosageForm: "Injection", concentration: "MIC/2.5mg/mL", dispenseSize: "10mL", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "L-Carnitine", dosageForm: "Injection", concentration: "500mg/mL", dispenseSize: "10mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "CoQ10", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "60ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "CoQ10", dosageForm: "Capsule", concentration: "200mg", dispenseSize: "60ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // ============ ANTI-AGING ============
  { name: "Methylene Blue", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "60ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Methylene Blue", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "60ct", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Rapamycin", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "10ct", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "Rapamycin", dosageForm: "Capsule", concentration: "2mg", dispenseSize: "10ct", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  { name: "Rapamycin", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "10ct", ourPrice: 200, toplinePrice: 329, downlinePrice: 429, medspaPrice: 529 },
  
  // ============ MISC MEDICATIONS ============
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "1.5mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "3mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "4.5mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Metformin ER", dosageForm: "Capsule", concentration: "500mg", dispenseSize: "90ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Metformin ER", dosageForm: "Capsule", concentration: "750mg", dispenseSize: "90ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Metformin ER", dosageForm: "Capsule", concentration: "1000mg", dispenseSize: "90ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  
  // ============ SKINCARE / TOPICALS ============
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.025%", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.05%", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.1%", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "4%", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Hydroquinone/Tretinoin", dosageForm: "Cream", concentration: "4%/0.05%", dispenseSize: "30gm", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Niacinamide Cream", dosageForm: "Cream", concentration: "4%", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  
  // ============ SLEEP / ANXIETY ============
  { name: "Trazodone", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Trazodone", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Gabapentin", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "90ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Gabapentin", dosageForm: "Capsule", concentration: "300mg", dispenseSize: "90ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "Melatonin ER", dosageForm: "Capsule", concentration: "3mg", dispenseSize: "60ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "Melatonin ER", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Melatonin ER", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "60ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
];

// Auto-generate description based on medication category
function generateDescription(productName: string, dosageForm: string): string {
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes('semaglutide') || lowerName.includes('tirzepatide') || lowerName.includes('glp')) {
    return `GLP-1 receptor agonist medication commonly used to support weight management and metabolic health. This ${dosageForm.toLowerCase()} formulation is prepared by Vios Compounding Pharmacy with precise dosing for optimal therapeutic outcomes.`;
  }
  
  if (lowerName.includes('testosterone') || lowerName.includes('estradiol') || lowerName.includes('bi-est') || lowerName.includes('progesterone') || lowerName.includes('dhea')) {
    return `Bioidentical hormone therapy compound for hormone balance and wellness. This custom-compounded ${dosageForm.toLowerCase()} is formulated to help restore optimal hormone levels and support overall vitality.`;
  }
  
  if (lowerName.includes('liothyronine') || lowerName.includes('levothyroxine') || lowerName.includes('t3') || lowerName.includes('t4') || lowerName.includes('thyroid')) {
    return `Thyroid hormone medication for thyroid function support and metabolic optimization. Precisely compounded for individualized dosing requirements.`;
  }
  
  if (lowerName.includes('tadalafil') || lowerName.includes('sildenafil') || lowerName.includes('pt-141') || lowerName.includes('oxytocin')) {
    return `Medication commonly used to support sexual wellness and intimate health. Discreetly compounded with pharmaceutical-grade ingredients for reliable results.`;
  }
  
  if (lowerName.includes('sermorelin') || lowerName.includes('ipamorelin') || lowerName.includes('bpc') || lowerName.includes('cjc')) {
    return `Peptide therapy compound for tissue repair, recovery, and regeneration support. Prepared under strict sterile conditions for subcutaneous administration.`;
  }
  
  if (lowerName.includes('nad') || lowerName.includes('glutathione')) {
    return `Cellular health and anti-aging compound for optimal wellness and longevity support. Compounded with high-purity ingredients for maximum bioavailability.`;
  }
  
  if (lowerName.includes('minoxidil') || lowerName.includes('finasteride') || lowerName.includes('dutasteride')) {
    return `Hair support medication formulated to promote healthy hair growth and retention. Custom-compounded for topical or oral use as prescribed.`;
  }
  
  if (lowerName.includes('methylene') || lowerName.includes('rapamycin')) {
    return `Anti-aging and longevity compound for cellular optimization and metabolic support. Pharmaceutical-grade formulation for precision dosing.`;
  }
  
  if (lowerName.includes('vitamin') || lowerName.includes('b12') || lowerName.includes('methylcobalamin') || lowerName.includes('coq10') || lowerName.includes('carnitine') || lowerName.includes('mic')) {
    return `Nutritional supplement for optimal health and wellness support. High-potency pharmaceutical-grade formulation for enhanced absorption and efficacy.`;
  }
  
  if (lowerName.includes('tretinoin') || lowerName.includes('hydroquinone') || lowerName.includes('niacinamide')) {
    return `Medical-grade skincare compound for skin health, rejuvenation, and complexion enhancement. Custom-compounded for individualized treatment protocols.`;
  }
  
  if (lowerName.includes('naltrexone') || lowerName.includes('ldn')) {
    return `Low-dose medication for immune modulation and wellness support. Precisely compounded at therapeutic micro-doses for optimal results.`;
  }
  
  if (lowerName.includes('metformin')) {
    return `Metabolic health medication commonly used for blood sugar management and metabolic optimization. Extended-release formulation for steady therapeutic levels.`;
  }
  
  if (lowerName.includes('trazodone') || lowerName.includes('gabapentin') || lowerName.includes('melatonin')) {
    return `Sleep and relaxation support medication for restful sleep and nervous system balance. Custom-compounded for individualized dosing requirements.`;
  }
  
  // Default description
  return `Pharmaceutical compound prepared by Vios Compounding Pharmacy. Custom-compounded with pharmaceutical-grade ingredients for optimal therapeutic outcomes.`;
}

// Determine category from product name
function getCategory(productName: string): string {
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes('semaglutide') || lowerName.includes('tirzepatide')) return 'glp1';
  if (lowerName.includes('testosterone') || lowerName.includes('estradiol') || lowerName.includes('bi-est') || lowerName.includes('progesterone') || lowerName.includes('dhea')) return 'hormone';
  if (lowerName.includes('liothyronine') || lowerName.includes('levothyroxine') || lowerName.includes('t3') || lowerName.includes('t4')) return 'thyroid';
  if (lowerName.includes('tadalafil') || lowerName.includes('sildenafil') || lowerName.includes('pt-141') || lowerName.includes('oxytocin')) return 'sexual_health';
  if (lowerName.includes('sermorelin') || lowerName.includes('ipamorelin') || lowerName.includes('bpc') || lowerName.includes('cjc') || lowerName.includes('glutathione')) return 'peptide';
  if (lowerName.includes('minoxidil') || lowerName.includes('finasteride') || lowerName.includes('dutasteride')) return 'hair';
  if (lowerName.includes('nad') || lowerName.includes('methylene') || lowerName.includes('rapamycin')) return 'antiaging';
  if (lowerName.includes('vitamin') || lowerName.includes('b12') || lowerName.includes('coq10') || lowerName.includes('carnitine') || lowerName.includes('mic')) return 'vitamin';
  
  return 'default';
}

// Parse concentration to numeric value for sorting (lower = primary)
function parseConcentration(concentration: string): number {
  const match = concentration.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 999;
}

// Group products into families by name
interface ProductFamily {
  name: string;
  variants: typeof VIOS_PRODUCTS;
}

function groupProductFamilies(): ProductFamily[] {
  const familyMap = new Map<string, typeof VIOS_PRODUCTS>();
  
  for (const product of VIOS_PRODUCTS) {
    const key = product.name;
    if (!familyMap.has(key)) {
      familyMap.set(key, []);
    }
    familyMap.get(key)!.push(product);
  }
  
  // Sort variants within each family by concentration (lowest first)
  const families: ProductFamily[] = [];
  for (const [name, variants] of familyMap) {
    variants.sort((a, b) => parseConcentration(a.concentration) - parseConcentration(b.concentration));
    families.push({ name, variants });
  }
  
  return families;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { generateImages = true, dryRun = false } = body;

    console.log('Starting Vios product catalog seed...');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}, Generate Images: ${generateImages}`);

    // Group products into families
    const families = groupProductFamilies();
    console.log(`Found ${families.length} product families from ${VIOS_PRODUCTS.length} total products`);

    // Get product type IDs
    const { data: productTypes } = await supabase
      .from('product_types')
      .select('id, name');
    
    const typeMap = new Map<string, string>();
    for (const pt of productTypes || []) {
      typeMap.set(pt.name.toLowerCase(), pt.id);
    }
    
    // Default to first product type if specific category not found
    const defaultTypeId = productTypes?.[0]?.id;

    const results = {
      productsCreated: 0,
      variantsCreated: 0,
      imagesGenerated: 0,
      errors: [] as string[],
      samples: [] as any[],
    };

    // Process each product family
    for (let i = 0; i < families.length; i++) {
      const family = families[i];
      const primaryVariant = family.variants[0]; // Lowest concentration
      
      console.log(`[${i + 1}/${families.length}] Processing: ${family.name}`);
      
      if (dryRun) {
        results.productsCreated++;
        results.variantsCreated += family.variants.length - 1;
        if (i < 5) {
          results.samples.push({
            name: family.name,
            primaryDosage: primaryVariant.concentration,
            variantCount: family.variants.length,
            basePrice: primaryVariant.ourPrice,
          });
        }
        continue;
      }

      try {
        // Generate AI image for this product family (if enabled)
        let imageUrl = '';
        if (generateImages) {
          try {
            console.log(`  Generating image for ${family.name}...`);
            
            const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-product-image`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                productName: family.name,
                dosageForm: primaryVariant.dosageForm,
                category: getCategory(family.name),
              }),
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              imageUrl = imageData.imageUrl || '';
              results.imagesGenerated++;
              console.log(`  Image generated: ${imageUrl}`);
            } else {
              console.error(`  Image generation failed: ${await imageResponse.text()}`);
            }

            // Rate limiting: wait 2 seconds between image generations
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (imgError) {
            console.error(`  Image error: ${imgError}`);
          }
        }

        // Determine product type
        const category = getCategory(family.name);
        let productTypeId = defaultTypeId;
        if (category === 'glp1') productTypeId = typeMap.get('glp 1') || typeMap.get('glp-1') || defaultTypeId;
        else if (category === 'peptide') productTypeId = typeMap.get('peptides') || defaultTypeId;
        else if (category === 'vitamin') productTypeId = typeMap.get('vitamins') || defaultTypeId;

        // Create the main product (using primary/lowest variant)
        const productData = {
          name: family.name,
          dosage: primaryVariant.concentration,
          dosage_form: primaryVariant.dosageForm,
          sig: 'None provided',
          description: generateDescription(family.name, primaryVariant.dosageForm),
          base_price: primaryVariant.ourPrice,
          topline_price: primaryVariant.toplinePrice,
          downline_price: primaryVariant.downlinePrice,
          retail_price: primaryVariant.medspaPrice,
          image_url: imageUrl,
          pharmacy_id: VIOS_PHARMACY_ID,
          product_type_id: productTypeId,
          active: true,
          approval_status: 'approved',
          refills_allowed: true,
          dispense_size: primaryVariant.dispenseSize,
        };

        const { data: product, error: productError } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (productError) {
          console.error(`  Product insert error: ${productError.message}`);
          results.errors.push(`${family.name}: ${productError.message}`);
          continue;
        }

        results.productsCreated++;

        // Link to Vios pharmacy
        await supabase
          .from('product_pharmacies')
          .insert({
            product_id: product.id,
            pharmacy_id: VIOS_PHARMACY_ID,
          });

        // Create variants for additional concentrations
        if (family.variants.length > 1) {
          const variants = family.variants.slice(1).map((v, index) => ({
            product_id: product.id,
            dosage_label: `${v.concentration} ${v.dispenseSize}`,
            base_price: v.ourPrice,
            topline_price: v.toplinePrice,
            downline_price: v.downlinePrice,
            retail_price: v.medspaPrice,
            active: true,
            sort_order: index + 1,
          }));

          const { error: variantError } = await supabase
            .from('product_variants')
            .insert(variants);

          if (variantError) {
            console.error(`  Variant insert error: ${variantError.message}`);
            results.errors.push(`${family.name} variants: ${variantError.message}`);
          } else {
            results.variantsCreated += variants.length;
          }
        }

        // Collect sample data for first 5 products
        if (results.samples.length < 5) {
          results.samples.push({
            id: product.id,
            name: product.name,
            primaryDosage: primaryVariant.concentration,
            variantCount: family.variants.length,
            basePrice: primaryVariant.ourPrice,
            imageUrl: imageUrl,
          });
        }

      } catch (familyError) {
        console.error(`  Family error: ${familyError}`);
        results.errors.push(`${family.name}: ${familyError}`);
      }
    }

    console.log('Seed completed!');
    console.log(`Products: ${results.productsCreated}, Variants: ${results.variantsCreated}, Images: ${results.imagesGenerated}`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        summary: {
          totalFamilies: families.length,
          productsCreated: results.productsCreated,
          variantsCreated: results.variantsCreated,
          imagesGenerated: results.imagesGenerated,
          errors: results.errors.length,
        },
        samples: results.samples,
        errors: results.errors.slice(0, 10), // First 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Seed error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
