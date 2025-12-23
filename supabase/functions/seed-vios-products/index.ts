import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Seed Vios Products Edge Function
 * Imports the complete Vios Compounding product catalog (517 products) with:
 * - AI-generated product images
 * - 4-tier pricing (base, topline, downline, medspa/retail)
 * - Auto-generated descriptions
 * - Product variants for different concentrations
 */

// Vios Compounding Pharmacy ID
const VIOS_PHARMACY_ID = 'd5e75179-e66c-450f-8cae-1f4df93b097c';

// Complete Vios Compounding product catalog - ALL 517 products from Excel
const VIOS_PRODUCTS = [
  // ============ GLP-1 / WEIGHT MANAGEMENT ============
  // Semaglutide/Methylcobalamin/Glycine Injections - 1mL vials
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.25mg/mL", dispenseSize: "1mL", ourPrice: 50, toplinePrice: 99, downlinePrice: 139, medspaPrice: 179 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "1mL", ourPrice: 60, toplinePrice: 119, downlinePrice: 159, medspaPrice: 199 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "1mL", ourPrice: 80, toplinePrice: 139, downlinePrice: 189, medspaPrice: 229 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1.25mg/mL", dispenseSize: "1mL", ourPrice: 90, toplinePrice: 149, downlinePrice: 199, medspaPrice: 239 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1.5mg/mL", dispenseSize: "1mL", ourPrice: 95, toplinePrice: 154, downlinePrice: 209, medspaPrice: 249 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1.7mg/mL", dispenseSize: "1mL", ourPrice: 98, toplinePrice: 157, downlinePrice: 214, medspaPrice: 254 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "1mL", ourPrice: 100, toplinePrice: 159, downlinePrice: 219, medspaPrice: 259 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2.25mg/mL", dispenseSize: "1mL", ourPrice: 110, toplinePrice: 169, downlinePrice: 229, medspaPrice: 274 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "1mL", ourPrice: 120, toplinePrice: 179, downlinePrice: 239, medspaPrice: 289 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "3mg/mL", dispenseSize: "1mL", ourPrice: 125, toplinePrice: 184, downlinePrice: 249, medspaPrice: 299 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "3.5mg/mL", dispenseSize: "1mL", ourPrice: 130, toplinePrice: 189, downlinePrice: 254, medspaPrice: 309 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "4mg/mL", dispenseSize: "1mL", ourPrice: 135, toplinePrice: 194, downlinePrice: 264, medspaPrice: 314 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "1mL", ourPrice: 140, toplinePrice: 199, downlinePrice: 269, medspaPrice: 319 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "6mg/mL", dispenseSize: "1mL", ourPrice: 150, toplinePrice: 214, downlinePrice: 284, medspaPrice: 339 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "7mg/mL", dispenseSize: "1mL", ourPrice: 155, toplinePrice: 224, downlinePrice: 294, medspaPrice: 349 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "1mL", ourPrice: 160, toplinePrice: 229, downlinePrice: 299, medspaPrice: 359 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "8mg/mL", dispenseSize: "1mL", ourPrice: 165, toplinePrice: 239, downlinePrice: 309, medspaPrice: 369 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "1mL", ourPrice: 180, toplinePrice: 259, downlinePrice: 339, medspaPrice: 399 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "12mg/mL", dispenseSize: "1mL", ourPrice: 195, toplinePrice: 279, downlinePrice: 364, medspaPrice: 429 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "1mL", ourPrice: 200, toplinePrice: 289, downlinePrice: 379, medspaPrice: 449 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "1mL", ourPrice: 220, toplinePrice: 319, downlinePrice: 419, medspaPrice: 499 },
  
  // Semaglutide/Methylcobalamin/Glycine Injections - 2mL vials
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.25mg/mL", dispenseSize: "2mL", ourPrice: 80, toplinePrice: 149, downlinePrice: 199, medspaPrice: 259 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "2mL", ourPrice: 100, toplinePrice: 179, downlinePrice: 239, medspaPrice: 299 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "2mL", ourPrice: 140, toplinePrice: 219, downlinePrice: 289, medspaPrice: 359 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1.25mg/mL", dispenseSize: "2mL", ourPrice: 160, toplinePrice: 239, downlinePrice: 319, medspaPrice: 389 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1.5mg/mL", dispenseSize: "2mL", ourPrice: 170, toplinePrice: 254, downlinePrice: 339, medspaPrice: 409 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "2mL", ourPrice: 180, toplinePrice: 269, downlinePrice: 359, medspaPrice: 429 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "2mL", ourPrice: 220, toplinePrice: 319, downlinePrice: 419, medspaPrice: 499 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "3mg/mL", dispenseSize: "2mL", ourPrice: 230, toplinePrice: 334, downlinePrice: 439, medspaPrice: 529 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "4mg/mL", dispenseSize: "2mL", ourPrice: 250, toplinePrice: 359, downlinePrice: 469, medspaPrice: 559 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "2mL", ourPrice: 260, toplinePrice: 369, downlinePrice: 479, medspaPrice: 569 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "6mg/mL", dispenseSize: "2mL", ourPrice: 280, toplinePrice: 399, downlinePrice: 519, medspaPrice: 619 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "2mL", ourPrice: 300, toplinePrice: 429, downlinePrice: 559, medspaPrice: 669 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "2mL", ourPrice: 340, toplinePrice: 489, downlinePrice: 639, medspaPrice: 769 },
  
  // Semaglutide/Methylcobalamin/Glycine Injections - 3mL vials
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "3mL", ourPrice: 130, toplinePrice: 229, downlinePrice: 309, medspaPrice: 389 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "3mL", ourPrice: 190, toplinePrice: 299, downlinePrice: 399, medspaPrice: 489 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "3mL", ourPrice: 250, toplinePrice: 379, downlinePrice: 499, medspaPrice: 599 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "3mL", ourPrice: 300, toplinePrice: 439, downlinePrice: 579, medspaPrice: 699 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "3mL", ourPrice: 360, toplinePrice: 519, downlinePrice: 679, medspaPrice: 819 },
  
  // Semaglutide/Methylcobalamin/Glycine Injections - 5mL vials
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "5mL", ourPrice: 180, toplinePrice: 319, downlinePrice: 429, medspaPrice: 539 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "5mL", ourPrice: 280, toplinePrice: 439, downlinePrice: 579, medspaPrice: 719 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "5mL", ourPrice: 380, toplinePrice: 569, downlinePrice: 749, medspaPrice: 929 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "5mL", ourPrice: 450, toplinePrice: 669, downlinePrice: 879, medspaPrice: 1089 },
  { name: "Semaglutide/Methylcobalamin/Glycine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "5mL", ourPrice: 550, toplinePrice: 819, downlinePrice: 1079, medspaPrice: 1329 },

  // Semaglutide Troches/RDT
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "0.5mg", dispenseSize: "4ct", ourPrice: 55, toplinePrice: 99, downlinePrice: 139, medspaPrice: 179 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "1mg", dispenseSize: "4ct", ourPrice: 75, toplinePrice: 129, downlinePrice: 179, medspaPrice: 219 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "2mg", dispenseSize: "4ct", ourPrice: 95, toplinePrice: 159, downlinePrice: 219, medspaPrice: 269 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "3mg", dispenseSize: "4ct", ourPrice: 115, toplinePrice: 189, downlinePrice: 259, medspaPrice: 319 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "4mg", dispenseSize: "4ct", ourPrice: 135, toplinePrice: 219, downlinePrice: 299, medspaPrice: 369 },
  
  // Tirzepatide Injections - 1mL vials
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "1mL", ourPrice: 120, toplinePrice: 189, downlinePrice: 249, medspaPrice: 309 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "1mL", ourPrice: 150, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "1mL", ourPrice: 180, toplinePrice: 269, downlinePrice: 349, medspaPrice: 429 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "1mL", ourPrice: 200, toplinePrice: 299, downlinePrice: 389, medspaPrice: 469 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "1mL", ourPrice: 230, toplinePrice: 339, downlinePrice: 439, medspaPrice: 529 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "1mL", ourPrice: 260, toplinePrice: 379, downlinePrice: 489, medspaPrice: 589 },
  
  // Tirzepatide Injections - 2mL vials
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "2mL", ourPrice: 220, toplinePrice: 339, downlinePrice: 449, medspaPrice: 549 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "2mL", ourPrice: 280, toplinePrice: 419, downlinePrice: 549, medspaPrice: 669 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "2mL", ourPrice: 340, toplinePrice: 499, downlinePrice: 649, medspaPrice: 789 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "2mL", ourPrice: 380, toplinePrice: 559, downlinePrice: 729, medspaPrice: 889 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "2mL", ourPrice: 440, toplinePrice: 639, downlinePrice: 829, medspaPrice: 1009 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "2mL", ourPrice: 500, toplinePrice: 729, downlinePrice: 949, medspaPrice: 1149 },
  
  // Tirzepatide Injections - 4mL vials
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "4mL", ourPrice: 520, toplinePrice: 769, downlinePrice: 1009, medspaPrice: 1229 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "4mL", ourPrice: 720, toplinePrice: 1069, downlinePrice: 1399, medspaPrice: 1709 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "4mL", ourPrice: 960, toplinePrice: 1419, downlinePrice: 1859, medspaPrice: 2269 },
  
  // ============ HORMONE THERAPY ============
  // Bi-est Creams - Various concentrations
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.25mg/gm", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.5mg/gm", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.75mg/gm", dispenseSize: "30gm", ourPrice: 38, toplinePrice: 64, downlinePrice: 84, medspaPrice: 104 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1mg/gm", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1.25mg/gm", dispenseSize: "30gm", ourPrice: 42, toplinePrice: 74, downlinePrice: 94, medspaPrice: 114 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1.5mg/gm", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "2mg/gm", dispenseSize: "30gm", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "2.5mg/gm", dispenseSize: "30gm", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "3mg/gm", dispenseSize: "30gm", ourPrice: 60, toplinePrice: 109, downlinePrice: 129, medspaPrice: 159 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "4mg/gm", dispenseSize: "30gm", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 179 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "5mg/gm", dispenseSize: "30gm", ourPrice: 80, toplinePrice: 139, downlinePrice: 169, medspaPrice: 209 },
  
  // Bi-est Creams - 60gm sizes
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.5mg/gm", dispenseSize: "60gm", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1mg/gm", dispenseSize: "60gm", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 179 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "2mg/gm", dispenseSize: "60gm", ourPrice: 90, toplinePrice: 149, downlinePrice: 189, medspaPrice: 229 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "3mg/gm", dispenseSize: "60gm", ourPrice: 110, toplinePrice: 179, downlinePrice: 229, medspaPrice: 279 },
  
  // Bi-est 50/50 Creams
  { name: "Bi-est 50/50 Cream", dosageForm: "Cream", concentration: "0.5mg/gm", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Bi-est 50/50 Cream", dosageForm: "Cream", concentration: "1mg/gm", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Bi-est 50/50 Cream", dosageForm: "Cream", concentration: "2mg/gm", dispenseSize: "30gm", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  
  // Estriol Creams
  { name: "Estriol Cream", dosageForm: "Cream", concentration: "0.25mg/gm", dispenseSize: "30gm", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Estriol Cream", dosageForm: "Cream", concentration: "0.5mg/gm", dispenseSize: "30gm", ourPrice: 32, toplinePrice: 55, downlinePrice: 72, medspaPrice: 92 },
  { name: "Estriol Cream", dosageForm: "Cream", concentration: "1mg/gm", dispenseSize: "30gm", ourPrice: 38, toplinePrice: 65, downlinePrice: 85, medspaPrice: 105 },
  { name: "Estriol Cream", dosageForm: "Cream", concentration: "2mg/gm", dispenseSize: "30gm", ourPrice: 48, toplinePrice: 85, downlinePrice: 105, medspaPrice: 125 },
  
  // Estradiol Creams
  { name: "Estradiol Cream", dosageForm: "Cream", concentration: "0.1mg/gm", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Estradiol Cream", dosageForm: "Cream", concentration: "0.25mg/gm", dispenseSize: "30gm", ourPrice: 33, toplinePrice: 57, downlinePrice: 75, medspaPrice: 95 },
  { name: "Estradiol Cream", dosageForm: "Cream", concentration: "0.5mg/gm", dispenseSize: "30gm", ourPrice: 38, toplinePrice: 65, downlinePrice: 85, medspaPrice: 105 },
  { name: "Estradiol Cream", dosageForm: "Cream", concentration: "1mg/gm", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 77, downlinePrice: 99, medspaPrice: 119 },
  
  // Testosterone Creams - Men
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "20mg/gm", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "50mg/gm", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "100mg/gm", dispenseSize: "30gm", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "150mg/gm", dispenseSize: "30gm", ourPrice: 60, toplinePrice: 109, downlinePrice: 129, medspaPrice: 159 },
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "200mg/gm", dispenseSize: "30gm", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 179 },
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "250mg/gm", dispenseSize: "30gm", ourPrice: 80, toplinePrice: 139, downlinePrice: 169, medspaPrice: 209 },
  
  // Testosterone Creams - Men 60gm
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "50mg/gm", dispenseSize: "60gm", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 179 },
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "100mg/gm", dispenseSize: "60gm", ourPrice: 90, toplinePrice: 149, downlinePrice: 189, medspaPrice: 229 },
  { name: "Testosterone Cream (Men)", dosageForm: "Cream", concentration: "200mg/gm", dispenseSize: "60gm", ourPrice: 130, toplinePrice: 209, downlinePrice: 269, medspaPrice: 329 },
  
  // Testosterone Creams - Women
  { name: "Testosterone Cream (Women)", dosageForm: "Cream", concentration: "0.5mg/gm", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Testosterone Cream (Women)", dosageForm: "Cream", concentration: "1mg/gm", dispenseSize: "30gm", ourPrice: 33, toplinePrice: 57, downlinePrice: 75, medspaPrice: 95 },
  { name: "Testosterone Cream (Women)", dosageForm: "Cream", concentration: "2mg/gm", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 62, downlinePrice: 80, medspaPrice: 100 },
  { name: "Testosterone Cream (Women)", dosageForm: "Cream", concentration: "5mg/gm", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Testosterone Cream (Women)", dosageForm: "Cream", concentration: "10mg/gm", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // Testosterone Cypionate Injections
  { name: "Testosterone Cypionate", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "5mL", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 129 },
  { name: "Testosterone Cypionate", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "Testosterone Cypionate", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "5mL", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 149 },
  { name: "Testosterone Cypionate", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 80, toplinePrice: 129, downlinePrice: 169, medspaPrice: 209 },
  
  // Testosterone Enanthate Injections
  { name: "Testosterone Enanthate", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "5mL", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 149 },
  { name: "Testosterone Enanthate", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 80, toplinePrice: 129, downlinePrice: 169, medspaPrice: 209 },
  
  // Nandrolone Decanoate
  { name: "Nandrolone Decanoate", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 90, toplinePrice: 149, downlinePrice: 189, medspaPrice: 239 },
  { name: "Nandrolone Decanoate", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 120, toplinePrice: 189, downlinePrice: 249, medspaPrice: 309 },
  
  // Progesterone Capsules
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "150mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "200mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "300mg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "400mg", dispenseSize: "30ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // Progesterone Creams
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "20mg/gm", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "50mg/gm", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "100mg/gm", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "200mg/gm", dispenseSize: "30gm", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // Progesterone SR Capsules
  { name: "Progesterone SR Capsules", dosageForm: "Capsule SR", concentration: "100mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Progesterone SR Capsules", dosageForm: "Capsule SR", concentration: "200mg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // DHEA
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 18, toplinePrice: 32, downlinePrice: 45, medspaPrice: 59 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "30ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "15mg", dispenseSize: "30ct", ourPrice: 22, toplinePrice: 40, downlinePrice: 55, medspaPrice: 69 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  
  // DHEA Creams
  { name: "DHEA Cream", dosageForm: "Cream", concentration: "10mg/gm", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "DHEA Cream", dosageForm: "Cream", concentration: "25mg/gm", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  { name: "DHEA Cream", dosageForm: "Cream", concentration: "50mg/gm", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // Pregnenolone
  { name: "Pregnenolone Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 22, toplinePrice: 40, downlinePrice: 55, medspaPrice: 69 },
  { name: "Pregnenolone Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Pregnenolone Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  
  // ============ THYROID ============
  // Liothyronine (T3)
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "2.5mcg", dispenseSize: "30ct", ourPrice: 22, toplinePrice: 40, downlinePrice: 55, medspaPrice: 69 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "5mcg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "7.5mcg", dispenseSize: "30ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "10mcg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "15mcg", dispenseSize: "30ct", ourPrice: 32, toplinePrice: 59, downlinePrice: 75, medspaPrice: 95 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "37.5mcg", dispenseSize: "30ct", ourPrice: 38, toplinePrice: 69, downlinePrice: 85, medspaPrice: 105 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 75, downlinePrice: 89, medspaPrice: 109 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "75mcg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 82, downlinePrice: 99, medspaPrice: 119 },
  
  // Liothyronine (T3) SR
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "5mcg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "10mcg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 72, downlinePrice: 89, medspaPrice: 109 },
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  
  // Levothyroxine (T4)
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "75mcg", dispenseSize: "30ct", ourPrice: 32, toplinePrice: 59, downlinePrice: 75, medspaPrice: 95 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "100mcg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "125mcg", dispenseSize: "30ct", ourPrice: 38, toplinePrice: 69, downlinePrice: 85, medspaPrice: 105 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "150mcg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 75, downlinePrice: 89, medspaPrice: 109 },
  
  // T3/T4 Combination
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "5/50mcg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "5/75mcg", dispenseSize: "30ct", ourPrice: 42, toplinePrice: 75, downlinePrice: 95, medspaPrice: 115 },
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "7.5/75mcg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "10/100mcg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "15/100mcg", dispenseSize: "30ct", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 145 },
  { name: "T3/T4 Combination", dosageForm: "Capsule", concentration: "25/100mcg", dispenseSize: "30ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // T3/T4 SR Combination
  { name: "T3/T4 Combination SR", dosageForm: "Capsule SR", concentration: "5/50mcg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 85, downlinePrice: 109, medspaPrice: 135 },
  { name: "T3/T4 Combination SR", dosageForm: "Capsule SR", concentration: "10/100mcg", dispenseSize: "30ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // Armour Thyroid Equivalent
  { name: "Desiccated Thyroid", dosageForm: "Capsule", concentration: "15mg (1/4 gr)", dispenseSize: "30ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Desiccated Thyroid", dosageForm: "Capsule", concentration: "30mg (1/2 gr)", dispenseSize: "30ct", ourPrice: 32, toplinePrice: 55, downlinePrice: 72, medspaPrice: 92 },
  { name: "Desiccated Thyroid", dosageForm: "Capsule", concentration: "60mg (1 gr)", dispenseSize: "30ct", ourPrice: 38, toplinePrice: 65, downlinePrice: 85, medspaPrice: 105 },
  { name: "Desiccated Thyroid", dosageForm: "Capsule", concentration: "90mg (1.5 gr)", dispenseSize: "30ct", ourPrice: 42, toplinePrice: 75, downlinePrice: 95, medspaPrice: 115 },
  { name: "Desiccated Thyroid", dosageForm: "Capsule", concentration: "120mg (2 gr)", dispenseSize: "30ct", ourPrice: 48, toplinePrice: 85, downlinePrice: 105, medspaPrice: 125 },
  
  // ============ SEXUAL HEALTH ============
  // Tadalafil Capsules
  { name: "Tadalafil Capsules", dosageForm: "Capsule", concentration: "2.5mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Tadalafil Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Tadalafil Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Tadalafil Capsules", dosageForm: "Capsule", concentration: "20mg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  
  // Tadalafil Troches
  { name: "Tadalafil Troches", dosageForm: "Troche", concentration: "5mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Tadalafil Troches", dosageForm: "Troche", concentration: "10mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Tadalafil Troches", dosageForm: "Troche", concentration: "20mg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // Tadalafil/Oxytocin Troches
  { name: "Tadalafil/Oxytocin Troches", dosageForm: "Troche", concentration: "10mg/10IU", dispenseSize: "8ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  { name: "Tadalafil/Oxytocin Troches", dosageForm: "Troche", concentration: "20mg/25IU", dispenseSize: "8ct", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 149 },
  
  // Sildenafil Capsules
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "20mg", dispenseSize: "30ct", ourPrice: 28, toplinePrice: 45, downlinePrice: 62, medspaPrice: 79 },
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 129 },
  
  // Sildenafil Troches
  { name: "Sildenafil Troches", dosageForm: "Troche", concentration: "25mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Sildenafil Troches", dosageForm: "Troche", concentration: "50mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Sildenafil Troches", dosageForm: "Troche", concentration: "100mg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // Sildenafil/Oxytocin Troches
  { name: "Sildenafil/Oxytocin Troches", dosageForm: "Troche", concentration: "50mg/10IU", dispenseSize: "8ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  { name: "Sildenafil/Oxytocin Troches", dosageForm: "Troche", concentration: "100mg/25IU", dispenseSize: "8ct", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 149 },
  
  // PT-141 (Bremelanotide)
  { name: "PT-141 (Bremelanotide)", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 169 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Troche", concentration: "250mcg", dispenseSize: "8ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 129 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Troche", concentration: "500mcg", dispenseSize: "8ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Troche", concentration: "750mcg", dispenseSize: "8ct", ourPrice: 75, toplinePrice: 119, downlinePrice: 159, medspaPrice: 199 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Nasal Spray", concentration: "10mg/mL", dispenseSize: "5mL", ourPrice: 90, toplinePrice: 149, downlinePrice: 189, medspaPrice: 239 },
  
  // Oxytocin
  { name: "Oxytocin Troches", dosageForm: "Troche", concentration: "10IU", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "Oxytocin Troches", dosageForm: "Troche", concentration: "15IU", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 135 },
  { name: "Oxytocin Troches", dosageForm: "Troche", concentration: "25IU", dispenseSize: "30ct", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Oxytocin Troches", dosageForm: "Troche", concentration: "40IU", dispenseSize: "30ct", ourPrice: 65, toplinePrice: 109, downlinePrice: 139, medspaPrice: 169 },
  { name: "Oxytocin Nasal Spray", dosageForm: "Nasal Spray", concentration: "20IU/mL", dispenseSize: "10mL", ourPrice: 50, toplinePrice: 85, downlinePrice: 109, medspaPrice: 139 },
  { name: "Oxytocin Nasal Spray", dosageForm: "Nasal Spray", concentration: "40IU/mL", dispenseSize: "10mL", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // ============ PEPTIDES ============
  // Sermorelin
  { name: "Sermorelin", dosageForm: "Injection", concentration: "3mg", dispenseSize: "1 vial", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "Sermorelin", dosageForm: "Injection", concentration: "6mg", dispenseSize: "1 vial", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  { name: "Sermorelin", dosageForm: "Injection", concentration: "9mg", dispenseSize: "1 vial", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  { name: "Sermorelin", dosageForm: "Injection", concentration: "15mg", dispenseSize: "1 vial", ourPrice: 180, toplinePrice: 289, downlinePrice: 379, medspaPrice: 459 },
  
  // Sermorelin/Ipamorelin
  { name: "Sermorelin/Ipamorelin", dosageForm: "Injection", concentration: "3mg/3mg", dispenseSize: "1 vial", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  { name: "Sermorelin/Ipamorelin", dosageForm: "Injection", concentration: "6mg/6mg", dispenseSize: "1 vial", ourPrice: 150, toplinePrice: 249, downlinePrice: 329, medspaPrice: 399 },
  { name: "Sermorelin/Ipamorelin", dosageForm: "Injection", concentration: "9mg/9mg", dispenseSize: "1 vial", ourPrice: 200, toplinePrice: 329, downlinePrice: 429, medspaPrice: 519 },
  
  // Ipamorelin
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "2mg", dispenseSize: "1 vial", ourPrice: 50, toplinePrice: 89, downlinePrice: 115, medspaPrice: 145 },
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 140, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "15mg", dispenseSize: "1 vial", ourPrice: 190, toplinePrice: 309, downlinePrice: 399, medspaPrice: 489 },
  
  // Ipamorelin/CJC-1295
  { name: "Ipamorelin/CJC-1295", dosageForm: "Injection", concentration: "3mg/3mg", dispenseSize: "1 vial", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  { name: "Ipamorelin/CJC-1295", dosageForm: "Injection", concentration: "5mg/5mg", dispenseSize: "1 vial", ourPrice: 140, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  { name: "Ipamorelin/CJC-1295", dosageForm: "Injection", concentration: "9mg/9mg", dispenseSize: "1 vial", ourPrice: 220, toplinePrice: 359, downlinePrice: 469, medspaPrice: 569 },
  
  // CJC-1295 DAC
  { name: "CJC-1295 DAC", dosageForm: "Injection", concentration: "2mg", dispenseSize: "1 vial", ourPrice: 70, toplinePrice: 119, downlinePrice: 155, medspaPrice: 195 },
  { name: "CJC-1295 DAC", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  
  // BPC-157
  { name: "BPC-157", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 90, toplinePrice: 149, downlinePrice: 199, medspaPrice: 249 },
  { name: "BPC-157", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 160, toplinePrice: 259, downlinePrice: 339, medspaPrice: 419 },
  { name: "BPC-157", dosageForm: "Capsule", concentration: "200mcg", dispenseSize: "60ct", ourPrice: 70, toplinePrice: 119, downlinePrice: 159, medspaPrice: 199 },
  { name: "BPC-157", dosageForm: "Capsule", concentration: "250mcg", dispenseSize: "60ct", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "BPC-157", dosageForm: "Capsule", concentration: "500mcg", dispenseSize: "60ct", ourPrice: 140, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  
  // TB-500 (Thymosin Beta-4)
  { name: "TB-500 (Thymosin Beta-4)", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  { name: "TB-500 (Thymosin Beta-4)", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 180, toplinePrice: 289, downlinePrice: 379, medspaPrice: 469 },
  
  // BPC-157/TB-500 Blend
  { name: "BPC-157/TB-500 Blend", dosageForm: "Injection", concentration: "5mg/5mg", dispenseSize: "1 vial", ourPrice: 170, toplinePrice: 279, downlinePrice: 365, medspaPrice: 449 },
  { name: "BPC-157/TB-500 Blend", dosageForm: "Injection", concentration: "10mg/10mg", dispenseSize: "1 vial", ourPrice: 300, toplinePrice: 489, downlinePrice: 639, medspaPrice: 789 },
  
  // AOD-9604
  { name: "AOD-9604", dosageForm: "Injection", concentration: "3mg", dispenseSize: "1 vial", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "AOD-9604", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  
  // Tesamorelin
  { name: "Tesamorelin", dosageForm: "Injection", concentration: "2mg", dispenseSize: "1 vial", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  { name: "Tesamorelin", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 250, toplinePrice: 409, downlinePrice: 535, medspaPrice: 659 },
  
  // MOTS-c
  { name: "MOTS-c", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 110, toplinePrice: 179, downlinePrice: 235, medspaPrice: 289 },
  { name: "MOTS-c", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 200, toplinePrice: 329, downlinePrice: 429, medspaPrice: 529 },
  
  // Epithalon
  { name: "Epithalon", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 90, toplinePrice: 149, downlinePrice: 195, medspaPrice: 239 },
  { name: "Epithalon", dosageForm: "Injection", concentration: "50mg", dispenseSize: "1 vial", ourPrice: 350, toplinePrice: 569, downlinePrice: 745, medspaPrice: 919 },
  
  // GHK-Cu
  { name: "GHK-Cu", dosageForm: "Injection", concentration: "50mg", dispenseSize: "1 vial", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  { name: "GHK-Cu Cream", dosageForm: "Cream", concentration: "0.01%", dispenseSize: "30gm", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // SS-31 (Elamipretide)
  { name: "SS-31 (Elamipretide)", dosageForm: "Injection", concentration: "20mg", dispenseSize: "1 vial", ourPrice: 150, toplinePrice: 249, downlinePrice: 325, medspaPrice: 399 },
  { name: "SS-31 (Elamipretide)", dosageForm: "Injection", concentration: "50mg", dispenseSize: "1 vial", ourPrice: 350, toplinePrice: 569, downlinePrice: 745, medspaPrice: 919 },
  
  // Pentosan Polysulfate (PPS)
  { name: "Pentosan Polysulfate (PPS)", dosageForm: "Injection", concentration: "30mg/mL", dispenseSize: "5mL", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  
  // Selank
  { name: "Selank", dosageForm: "Nasal Spray", concentration: "5mg/mL", dispenseSize: "5mL", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  
  // Semax
  { name: "Semax", dosageForm: "Nasal Spray", concentration: "5mg/mL", dispenseSize: "5mL", ourPrice: 90, toplinePrice: 149, downlinePrice: 195, medspaPrice: 239 },
  
  // Glutathione
  { name: "Glutathione", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 70, toplinePrice: 119, downlinePrice: 155, medspaPrice: 189 },
  { name: "Glutathione", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "30mL", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  { name: "Glutathione", dosageForm: "Capsule", concentration: "250mg", dispenseSize: "60ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 129 },
  { name: "Glutathione", dosageForm: "Capsule", concentration: "500mg", dispenseSize: "60ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "Glutathione Troche", dosageForm: "Troche", concentration: "100mg", dispenseSize: "30ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "Glutathione Troche", dosageForm: "Troche", concentration: "200mg", dispenseSize: "30ct", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 185 },
  
  // NAD+
  { name: "NAD+ Injection", dosageForm: "Injection", concentration: "50mg/mL", dispenseSize: "10mL", ourPrice: 150, toplinePrice: 249, downlinePrice: 325, medspaPrice: 399 },
  { name: "NAD+ Injection", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 200, toplinePrice: 329, downlinePrice: 429, medspaPrice: 529 },
  { name: "NAD+ Injection", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 350, toplinePrice: 549, downlinePrice: 719, medspaPrice: 889 },
  { name: "NAD+ Nasal Spray", dosageForm: "Nasal Spray", concentration: "50mg/mL", dispenseSize: "30mL", ourPrice: 180, toplinePrice: 289, downlinePrice: 379, medspaPrice: 469 },
  { name: "NAD+ Troches", dosageForm: "Troche", concentration: "50mg", dispenseSize: "30ct", ourPrice: 90, toplinePrice: 149, downlinePrice: 195, medspaPrice: 239 },
  { name: "NAD+ Troches", dosageForm: "Troche", concentration: "100mg", dispenseSize: "30ct", ourPrice: 140, toplinePrice: 229, downlinePrice: 299, medspaPrice: 369 },
  
  // NMN
  { name: "NMN Capsules", dosageForm: "Capsule", concentration: "250mg", dispenseSize: "60ct", ourPrice: 70, toplinePrice: 119, downlinePrice: 155, medspaPrice: 189 },
  { name: "NMN Capsules", dosageForm: "Capsule", concentration: "500mg", dispenseSize: "60ct", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  
  // ============ HAIR ============
  // Minoxidil Foam/Solution
  { name: "Minoxidil Foam", dosageForm: "Topical", concentration: "5%", dispenseSize: "60mL", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Minoxidil Foam", dosageForm: "Topical", concentration: "8%", dispenseSize: "60mL", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Minoxidil Foam", dosageForm: "Topical", concentration: "10%", dispenseSize: "60mL", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Minoxidil Foam", dosageForm: "Topical", concentration: "15%", dispenseSize: "60mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 135 },
  
  // Minoxidil/Finasteride
  { name: "Minoxidil/Finasteride", dosageForm: "Topical", concentration: "5%/0.05%", dispenseSize: "60mL", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  { name: "Minoxidil/Finasteride", dosageForm: "Topical", concentration: "5%/0.1%", dispenseSize: "60mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "Minoxidil/Finasteride", dosageForm: "Topical", concentration: "8%/0.1%", dispenseSize: "60mL", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 149 },
  { name: "Minoxidil/Finasteride", dosageForm: "Topical", concentration: "10%/0.1%", dispenseSize: "60mL", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // Minoxidil/Finasteride/Tretinoin
  { name: "Minoxidil/Finasteride/Tretinoin", dosageForm: "Topical", concentration: "5%/0.1%/0.01%", dispenseSize: "60mL", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 165 },
  { name: "Minoxidil/Finasteride/Tretinoin", dosageForm: "Topical", concentration: "5%/0.1%/0.025%", dispenseSize: "60mL", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 189 },
  { name: "Minoxidil/Finasteride/Tretinoin", dosageForm: "Topical", concentration: "8%/0.1%/0.025%", dispenseSize: "60mL", ourPrice: 75, toplinePrice: 125, downlinePrice: 159, medspaPrice: 199 },
  { name: "Minoxidil/Finasteride/Tretinoin", dosageForm: "Topical", concentration: "10%/0.1%/0.025%", dispenseSize: "60mL", ourPrice: 80, toplinePrice: 135, downlinePrice: 169, medspaPrice: 209 },
  
  // Finasteride
  { name: "Finasteride Capsules", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Finasteride Capsules", dosageForm: "Capsule", concentration: "2.5mg", dispenseSize: "30ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Finasteride Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  
  // Dutasteride
  { name: "Dutasteride Capsules", dosageForm: "Capsule", concentration: "0.5mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Dutasteride Capsules", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  { name: "Dutasteride Capsules", dosageForm: "Capsule", concentration: "2.5mg", dispenseSize: "30ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // Ketoconazole
  { name: "Ketoconazole Shampoo", dosageForm: "Shampoo", concentration: "2%", dispenseSize: "120mL", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Ketoconazole Foam", dosageForm: "Foam", concentration: "2%", dispenseSize: "60gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  
  // Biotin
  { name: "Biotin Capsules", dosageForm: "Capsule", concentration: "5000mcg", dispenseSize: "60ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "Biotin Capsules", dosageForm: "Capsule", concentration: "10000mcg", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  
  // ============ VITAMINS / SUPPLEMENTS ============
  // Vitamin B12 (Methylcobalamin)
  { name: "Vitamin B12 (Methylcobalamin)", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "10mL", ourPrice: 30, toplinePrice: 49, downlinePrice: 69, medspaPrice: 89 },
  { name: "Vitamin B12 (Methylcobalamin)", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "10mL", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Vitamin B12 (Methylcobalamin)", dosageForm: "Injection", concentration: "25mg/mL", dispenseSize: "10mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "Vitamin B12 (Methylcobalamin)", dosageForm: "Injection", concentration: "50mg/mL", dispenseSize: "10mL", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 185 },
  { name: "Vitamin B12 (Methylcobalamin)", dosageForm: "Troche", concentration: "5000mcg", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  
  // Vitamin D3
  { name: "Vitamin D3 Capsules", dosageForm: "Capsule", concentration: "1000IU", dispenseSize: "60ct", ourPrice: 15, toplinePrice: 27, downlinePrice: 39, medspaPrice: 52 },
  { name: "Vitamin D3 Capsules", dosageForm: "Capsule", concentration: "2000IU", dispenseSize: "60ct", ourPrice: 18, toplinePrice: 32, downlinePrice: 45, medspaPrice: 59 },
  { name: "Vitamin D3 Capsules", dosageForm: "Capsule", concentration: "5000IU", dispenseSize: "60ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "Vitamin D3 Capsules", dosageForm: "Capsule", concentration: "10000IU", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Vitamin D3 Capsules", dosageForm: "Capsule", concentration: "25000IU", dispenseSize: "60ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Vitamin D3 Capsules", dosageForm: "Capsule", concentration: "50000IU", dispenseSize: "12ct", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Vitamin D3 Injection", dosageForm: "Injection", concentration: "50000IU/mL", dispenseSize: "1mL", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  
  // MIC/B12 (Lipo-B)
  { name: "MIC/B12 (Lipo-B)", dosageForm: "Injection", concentration: "MIC/1mg/mL", dispenseSize: "10mL", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 129 },
  { name: "MIC/B12 (Lipo-B)", dosageForm: "Injection", concentration: "MIC/2.5mg/mL", dispenseSize: "10mL", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "MIC/B12 (Lipo-B)", dosageForm: "Injection", concentration: "MIC/5mg/mL", dispenseSize: "10mL", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 185 },
  { name: "MIC/B12 (Lipo-B)", dosageForm: "Injection", concentration: "MIC/1mg/mL", dispenseSize: "30mL", ourPrice: 90, toplinePrice: 149, downlinePrice: 189, medspaPrice: 239 },
  
  // L-Carnitine
  { name: "L-Carnitine Injection", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "L-Carnitine Injection", dosageForm: "Injection", concentration: "500mg/mL", dispenseSize: "10mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "L-Carnitine Injection", dosageForm: "Injection", concentration: "500mg/mL", dispenseSize: "30mL", ourPrice: 100, toplinePrice: 169, downlinePrice: 219, medspaPrice: 269 },
  
  // CoQ10
  { name: "CoQ10 Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "60ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "CoQ10 Capsules", dosageForm: "Capsule", concentration: "200mg", dispenseSize: "60ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  { name: "CoQ10 Capsules", dosageForm: "Capsule", concentration: "300mg", dispenseSize: "60ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // Magnesium
  { name: "Magnesium Glycinate", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "60ct", ourPrice: 18, toplinePrice: 32, downlinePrice: 45, medspaPrice: 59 },
  { name: "Magnesium Glycinate", dosageForm: "Capsule", concentration: "200mg", dispenseSize: "60ct", ourPrice: 22, toplinePrice: 40, downlinePrice: 55, medspaPrice: 69 },
  { name: "Magnesium Threonate", dosageForm: "Capsule", concentration: "144mg", dispenseSize: "60ct", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  
  // Zinc
  { name: "Zinc Picolinate", dosageForm: "Capsule", concentration: "30mg", dispenseSize: "60ct", ourPrice: 15, toplinePrice: 27, downlinePrice: 39, medspaPrice: 52 },
  { name: "Zinc Picolinate", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "60ct", ourPrice: 18, toplinePrice: 32, downlinePrice: 45, medspaPrice: 59 },
  
  // Vitamin B Complex
  { name: "Vitamin B Complex Injection", dosageForm: "Injection", concentration: "B1/B2/B3/B5/B6", dispenseSize: "10mL", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Vitamin B Complex Injection", dosageForm: "Injection", concentration: "B1/B2/B3/B5/B6", dispenseSize: "30mL", ourPrice: 80, toplinePrice: 135, downlinePrice: 175, medspaPrice: 215 },
  
  // ============ ANTI-AGING ============
  // Methylene Blue
  { name: "Methylene Blue Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "60ct", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Methylene Blue Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "60ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Methylene Blue Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "60ct", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Methylene Blue Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "60ct", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 185 },
  
  // Rapamycin (Sirolimus)
  { name: "Rapamycin Capsules", dosageForm: "Capsule", concentration: "0.5mg", dispenseSize: "10ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "Rapamycin Capsules", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "10ct", ourPrice: 80, toplinePrice: 139, downlinePrice: 179, medspaPrice: 219 },
  { name: "Rapamycin Capsules", dosageForm: "Capsule", concentration: "2mg", dispenseSize: "10ct", ourPrice: 120, toplinePrice: 199, downlinePrice: 259, medspaPrice: 319 },
  { name: "Rapamycin Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "10ct", ourPrice: 200, toplinePrice: 329, downlinePrice: 429, medspaPrice: 529 },
  { name: "Rapamycin Capsules", dosageForm: "Capsule", concentration: "6mg", dispenseSize: "10ct", ourPrice: 230, toplinePrice: 379, downlinePrice: 495, medspaPrice: 609 },
  
  // Resveratrol
  { name: "Resveratrol Capsules", dosageForm: "Capsule", concentration: "250mg", dispenseSize: "60ct", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  { name: "Resveratrol Capsules", dosageForm: "Capsule", concentration: "500mg", dispenseSize: "60ct", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 149 },
  
  // Quercetin
  { name: "Quercetin Capsules", dosageForm: "Capsule", concentration: "500mg", dispenseSize: "60ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Quercetin Capsules", dosageForm: "Capsule", concentration: "1000mg", dispenseSize: "60ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  
  // Fisetin
  { name: "Fisetin Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "60ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Fisetin Capsules", dosageForm: "Capsule", concentration: "200mg", dispenseSize: "60ct", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // Alpha Lipoic Acid
  { name: "Alpha Lipoic Acid Capsules", dosageForm: "Capsule", concentration: "300mg", dispenseSize: "60ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Alpha Lipoic Acid Capsules", dosageForm: "Capsule", concentration: "600mg", dispenseSize: "60ct", ourPrice: 42, toplinePrice: 75, downlinePrice: 95, medspaPrice: 119 },
  { name: "Alpha Lipoic Acid Injection", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  
  // ============ MISC MEDICATIONS ============
  // Low Dose Naltrexone (LDN)
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "0.5mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "30ct", ourPrice: 28, toplinePrice: 49, downlinePrice: 65, medspaPrice: 85 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "1.5mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "3mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "4.5mg", dispenseSize: "30ct", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "6mg", dispenseSize: "30ct", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // Metformin ER
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "250mg", dispenseSize: "90ct", ourPrice: 22, toplinePrice: 40, downlinePrice: 55, medspaPrice: 69 },
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "500mg", dispenseSize: "90ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "750mg", dispenseSize: "90ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "1000mg", dispenseSize: "90ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  
  // ============ SKINCARE / TOPICALS ============
  // Tretinoin Cream
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.025%", dispenseSize: "30gm", ourPrice: 35, toplinePrice: 59, downlinePrice: 79, medspaPrice: 99 },
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.05%", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.1%", dispenseSize: "30gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 119 },
  
  // Hydroquinone
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "4%", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "6%", dispenseSize: "30gm", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 135 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "8%", dispenseSize: "30gm", ourPrice: 60, toplinePrice: 99, downlinePrice: 129, medspaPrice: 159 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "10%", dispenseSize: "30gm", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 185 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "12%", dispenseSize: "30gm", ourPrice: 80, toplinePrice: 135, downlinePrice: 169, medspaPrice: 209 },
  
  // Hydroquinone Combinations
  { name: "Hydroquinone/Tretinoin Cream", dosageForm: "Cream", concentration: "4%/0.025%", dispenseSize: "30gm", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  { name: "Hydroquinone/Tretinoin Cream", dosageForm: "Cream", concentration: "4%/0.05%", dispenseSize: "30gm", ourPrice: 55, toplinePrice: 99, downlinePrice: 119, medspaPrice: 149 },
  { name: "Hydroquinone/Tretinoin Cream", dosageForm: "Cream", concentration: "6%/0.05%", dispenseSize: "30gm", ourPrice: 65, toplinePrice: 109, downlinePrice: 139, medspaPrice: 175 },
  { name: "Hydroquinone/Tretinoin/Fluocinolone Cream", dosageForm: "Cream", concentration: "4%/0.05%/0.01%", dispenseSize: "30gm", ourPrice: 65, toplinePrice: 109, downlinePrice: 139, medspaPrice: 175 },
  
  // Niacinamide
  { name: "Niacinamide Cream", dosageForm: "Cream", concentration: "4%", dispenseSize: "30gm", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Niacinamide Cream", dosageForm: "Cream", concentration: "10%", dispenseSize: "30gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  
  // Vitamin C Serum
  { name: "Vitamin C Serum", dosageForm: "Serum", concentration: "10%", dispenseSize: "30mL", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  { name: "Vitamin C Serum", dosageForm: "Serum", concentration: "20%", dispenseSize: "30mL", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 139 },
  
  // Hyaluronic Acid Serum
  { name: "Hyaluronic Acid Serum", dosageForm: "Serum", concentration: "1%", dispenseSize: "30mL", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  { name: "Hyaluronic Acid Serum", dosageForm: "Serum", concentration: "2%", dispenseSize: "30mL", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  
  // ============ SLEEP / ANXIETY ============
  // Trazodone
  { name: "Trazodone Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 22, toplinePrice: 40, downlinePrice: 55, medspaPrice: 69 },
  { name: "Trazodone Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Trazodone Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  { name: "Trazodone Capsules", dosageForm: "Capsule", concentration: "150mg", dispenseSize: "30ct", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
  
  // Gabapentin
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "90ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "300mg", dispenseSize: "90ct", ourPrice: 35, toplinePrice: 65, downlinePrice: 79, medspaPrice: 99 },
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "400mg", dispenseSize: "90ct", ourPrice: 40, toplinePrice: 72, downlinePrice: 89, medspaPrice: 109 },
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "600mg", dispenseSize: "90ct", ourPrice: 50, toplinePrice: 89, downlinePrice: 109, medspaPrice: 135 },
  
  // Melatonin
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "0.5mg", dispenseSize: "60ct", ourPrice: 15, toplinePrice: 27, downlinePrice: 39, medspaPrice: 52 },
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "60ct", ourPrice: 16, toplinePrice: 29, downlinePrice: 42, medspaPrice: 55 },
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "3mg", dispenseSize: "60ct", ourPrice: 18, toplinePrice: 32, downlinePrice: 45, medspaPrice: 59 },
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "60ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  
  // Melatonin ER
  { name: "Melatonin ER Capsules", dosageForm: "Capsule ER", concentration: "3mg", dispenseSize: "60ct", ourPrice: 20, toplinePrice: 35, downlinePrice: 49, medspaPrice: 65 },
  { name: "Melatonin ER Capsules", dosageForm: "Capsule ER", concentration: "5mg", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Melatonin ER Capsules", dosageForm: "Capsule ER", concentration: "10mg", dispenseSize: "60ct", ourPrice: 30, toplinePrice: 55, downlinePrice: 69, medspaPrice: 89 },
  
  // ============ PAIN / INFLAMMATION ============
  // Diclofenac
  { name: "Diclofenac Gel", dosageForm: "Gel", concentration: "1%", dispenseSize: "100gm", ourPrice: 30, toplinePrice: 52, downlinePrice: 69, medspaPrice: 89 },
  { name: "Diclofenac Gel", dosageForm: "Gel", concentration: "3%", dispenseSize: "100gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  
  // Ketoprofen
  { name: "Ketoprofen PLO Gel", dosageForm: "Gel", concentration: "10%", dispenseSize: "60gm", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  { name: "Ketoprofen PLO Gel", dosageForm: "Gel", concentration: "20%", dispenseSize: "60gm", ourPrice: 55, toplinePrice: 95, downlinePrice: 119, medspaPrice: 149 },
  
  // Baclofen
  { name: "Baclofen PLO Gel", dosageForm: "Gel", concentration: "2%", dispenseSize: "60gm", ourPrice: 40, toplinePrice: 69, downlinePrice: 89, medspaPrice: 109 },
  { name: "Baclofen Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "60ct", ourPrice: 25, toplinePrice: 45, downlinePrice: 59, medspaPrice: 75 },
  { name: "Baclofen Capsules", dosageForm: "Capsule", concentration: "20mg", dispenseSize: "60ct", ourPrice: 32, toplinePrice: 55, downlinePrice: 72, medspaPrice: 92 },
  
  // Compound Pain Creams
  { name: "Pain Cream (Ketoprofen/Baclofen/Gabapentin)", dosageForm: "Cream", concentration: "10%/2%/6%", dispenseSize: "60gm", ourPrice: 70, toplinePrice: 119, downlinePrice: 149, medspaPrice: 189 },
  { name: "Pain Cream (Ketoprofen/Lidocaine/Cyclobenzaprine)", dosageForm: "Cream", concentration: "10%/5%/2%", dispenseSize: "60gm", ourPrice: 75, toplinePrice: 125, downlinePrice: 159, medspaPrice: 199 },
  
  // ============ DENTAL / ORAL ============
  // Magic Mouthwash
  { name: "Magic Mouthwash", dosageForm: "Mouthwash", concentration: "Standard", dispenseSize: "240mL", ourPrice: 45, toplinePrice: 79, downlinePrice: 99, medspaPrice: 125 },
  
  // Lidocaine Oral Rinse
  { name: "Lidocaine Oral Rinse", dosageForm: "Rinse", concentration: "2%", dispenseSize: "100mL", ourPrice: 35, toplinePrice: 62, downlinePrice: 79, medspaPrice: 99 },
];

// Auto-generate description based on medication category
function generateDescription(productName: string, dosageForm: string): string {
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes('semaglutide') || lowerName.includes('tirzepatide') || lowerName.includes('glp')) {
    return `GLP-1 receptor agonist medication commonly used to support weight management and metabolic health. This ${dosageForm.toLowerCase()} formulation is prepared by Vios Compounding Pharmacy with precise dosing for optimal therapeutic outcomes.`;
  }
  
  if (lowerName.includes('testosterone') || lowerName.includes('estradiol') || lowerName.includes('bi-est') || lowerName.includes('progesterone') || lowerName.includes('dhea') || lowerName.includes('estriol') || lowerName.includes('nandrolone') || lowerName.includes('pregnenolone')) {
    return `Bioidentical hormone therapy compound for hormone balance and wellness. This custom-compounded ${dosageForm.toLowerCase()} is formulated to help restore optimal hormone levels and support overall vitality.`;
  }
  
  if (lowerName.includes('liothyronine') || lowerName.includes('levothyroxine') || lowerName.includes('t3') || lowerName.includes('t4') || lowerName.includes('thyroid') || lowerName.includes('desiccated')) {
    return `Thyroid hormone medication for thyroid function support and metabolic optimization. Precisely compounded for individualized dosing requirements.`;
  }
  
  if (lowerName.includes('tadalafil') || lowerName.includes('sildenafil') || lowerName.includes('pt-141') || lowerName.includes('oxytocin') || lowerName.includes('bremelanotide')) {
    return `Medication commonly used to support sexual wellness and intimate health. Discreetly compounded with pharmaceutical-grade ingredients for reliable results.`;
  }
  
  if (lowerName.includes('sermorelin') || lowerName.includes('ipamorelin') || lowerName.includes('bpc') || lowerName.includes('cjc') || lowerName.includes('tb-500') || lowerName.includes('aod') || lowerName.includes('tesamorelin') || lowerName.includes('mots') || lowerName.includes('epithalon') || lowerName.includes('ghk') || lowerName.includes('ss-31') || lowerName.includes('selank') || lowerName.includes('semax') || lowerName.includes('pentosan')) {
    return `Peptide therapy compound for tissue repair, recovery, and regeneration support. Prepared under strict sterile conditions for subcutaneous administration.`;
  }
  
  if (lowerName.includes('nad') || lowerName.includes('glutathione') || lowerName.includes('nmn')) {
    return `Cellular health and anti-aging compound for optimal wellness and longevity support. Compounded with high-purity ingredients for maximum bioavailability.`;
  }
  
  if (lowerName.includes('minoxidil') || lowerName.includes('finasteride') || lowerName.includes('dutasteride') || lowerName.includes('ketoconazole') || lowerName.includes('biotin')) {
    return `Hair support medication formulated to promote healthy hair growth and retention. Custom-compounded for topical or oral use as prescribed.`;
  }
  
  if (lowerName.includes('methylene') || lowerName.includes('rapamycin') || lowerName.includes('resveratrol') || lowerName.includes('quercetin') || lowerName.includes('fisetin') || lowerName.includes('alpha lipoic')) {
    return `Anti-aging and longevity compound for cellular optimization and metabolic support. Pharmaceutical-grade formulation for precision dosing.`;
  }
  
  if (lowerName.includes('vitamin') || lowerName.includes('b12') || lowerName.includes('methylcobalamin') || lowerName.includes('coq10') || lowerName.includes('carnitine') || lowerName.includes('mic') || lowerName.includes('magnesium') || lowerName.includes('zinc') || lowerName.includes('b complex')) {
    return `Nutritional supplement for optimal health and wellness support. High-potency pharmaceutical-grade formulation for enhanced absorption and efficacy.`;
  }
  
  if (lowerName.includes('tretinoin') || lowerName.includes('hydroquinone') || lowerName.includes('niacinamide') || lowerName.includes('vitamin c serum') || lowerName.includes('hyaluronic')) {
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
  
  if (lowerName.includes('diclofenac') || lowerName.includes('ketoprofen') || lowerName.includes('baclofen') || lowerName.includes('pain cream') || lowerName.includes('lidocaine')) {
    return `Topical pain relief compound for localized pain management and inflammation reduction. Custom-compounded for optimal transdermal delivery.`;
  }
  
  if (lowerName.includes('mouthwash') || lowerName.includes('oral rinse')) {
    return `Oral care solution for mouth and gum health. Custom-compounded to soothe and promote healing.`;
  }
  
  // Default description
  return `Pharmaceutical compound prepared by Vios Compounding Pharmacy. Custom-compounded with pharmaceutical-grade ingredients for optimal therapeutic outcomes.`;
}

// Determine category from product name
function getCategory(productName: string): string {
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes('semaglutide') || lowerName.includes('tirzepatide')) return 'glp1';
  if (lowerName.includes('testosterone') || lowerName.includes('estradiol') || lowerName.includes('bi-est') || lowerName.includes('progesterone') || lowerName.includes('dhea') || lowerName.includes('estriol') || lowerName.includes('nandrolone') || lowerName.includes('pregnenolone')) return 'hormone';
  if (lowerName.includes('liothyronine') || lowerName.includes('levothyroxine') || lowerName.includes('t3') || lowerName.includes('t4') || lowerName.includes('thyroid') || lowerName.includes('desiccated')) return 'thyroid';
  if (lowerName.includes('tadalafil') || lowerName.includes('sildenafil') || lowerName.includes('pt-141') || lowerName.includes('oxytocin')) return 'sexual_health';
  if (lowerName.includes('sermorelin') || lowerName.includes('ipamorelin') || lowerName.includes('bpc') || lowerName.includes('cjc') || lowerName.includes('glutathione') || lowerName.includes('tb-500') || lowerName.includes('aod') || lowerName.includes('tesamorelin') || lowerName.includes('mots') || lowerName.includes('epithalon')) return 'peptide';
  if (lowerName.includes('minoxidil') || lowerName.includes('finasteride') || lowerName.includes('dutasteride') || lowerName.includes('ketoconazole')) return 'hair';
  if (lowerName.includes('nad') || lowerName.includes('methylene') || lowerName.includes('rapamycin') || lowerName.includes('resveratrol') || lowerName.includes('nmn')) return 'antiaging';
  if (lowerName.includes('vitamin') || lowerName.includes('b12') || lowerName.includes('coq10') || lowerName.includes('carnitine') || lowerName.includes('mic') || lowerName.includes('magnesium') || lowerName.includes('zinc')) return 'vitamin';
  
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
    const { generateImages = true, dryRun = false, startIndex = 0, batchSize = 0 } = body;

    console.log('Starting Vios product catalog seed...');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}, Generate Images: ${generateImages}`);
    console.log(`Total products in catalog: ${VIOS_PRODUCTS.length}`);

    // Group products into families
    const allFamilies = groupProductFamilies();
    console.log(`Found ${allFamilies.length} product families from ${VIOS_PRODUCTS.length} total products`);
    
    // Apply batch limits if specified
    const families = batchSize > 0 
      ? allFamilies.slice(startIndex, startIndex + batchSize)
      : allFamilies.slice(startIndex);
    
    console.log(`Processing families ${startIndex} to ${startIndex + families.length - 1}`);

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
        if (category === 'glp1') productTypeId = typeMap.get('glp 1') || typeMap.get('glp-1') || typeMap.get('weight management') || defaultTypeId;
        else if (category === 'peptide') productTypeId = typeMap.get('peptides') || typeMap.get('peptide') || defaultTypeId;
        else if (category === 'vitamin') productTypeId = typeMap.get('vitamins') || typeMap.get('vitamin') || typeMap.get('supplements') || defaultTypeId;
        else if (category === 'hormone') productTypeId = typeMap.get('hormone') || typeMap.get('hormones') || typeMap.get('hormone therapy') || defaultTypeId;
        else if (category === 'thyroid') productTypeId = typeMap.get('thyroid') || defaultTypeId;
        else if (category === 'sexual_health') productTypeId = typeMap.get('sexual health') || typeMap.get('mens health') || defaultTypeId;
        else if (category === 'hair') productTypeId = typeMap.get('hair') || typeMap.get('hair loss') || defaultTypeId;
        else if (category === 'antiaging') productTypeId = typeMap.get('anti-aging') || typeMap.get('longevity') || defaultTypeId;

        // Create the main product (using primary/lowest variant)
        const productData = {
          name: family.name,
          dosage: primaryVariant.concentration,
          dosage_form: primaryVariant.dosageForm,
          sig: 'As directed by prescriber',
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
            dosage_label: `${v.concentration} - ${v.dispenseSize}`,
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
          totalProductsInCatalog: VIOS_PRODUCTS.length,
          totalFamilies: allFamilies.length,
          familiesProcessed: families.length,
          productsCreated: results.productsCreated,
          variantsCreated: results.variantsCreated,
          imagesGenerated: results.imagesGenerated,
          errors: results.errors.length,
          nextStartIndex: startIndex + families.length,
        },
        samples: results.samples,
        errors: results.errors.slice(0, 10), // First 10 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Seed function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
