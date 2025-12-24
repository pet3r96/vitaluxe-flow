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
 * 
 * PRICING DATA: Extracted from ART_LIST_1_12112025.xlsx
 */

// Vios Compounding Pharmacy ID
const VIOS_PHARMACY_ID = 'd5e75179-e66c-450f-8cae-1f4df93b097c';

// Complete Vios Compounding product catalog - ALL products from Excel with EXACT pricing
const VIOS_PRODUCTS = [
  // ============ TESTOSTERONE CREAMS ============
  // From Excel: Testosterone Cream 50mg/mL
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "50mg/mL", dispenseSize: "30g", ourPrice: 19.71, toplinePrice: 27.60, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "50mg/mL", dispenseSize: "60g", ourPrice: 29.57, toplinePrice: 41.40, downlinePrice: 50.40, medspaPrice: 56.40 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "50mg/mL", dispenseSize: "90g", ourPrice: 39.42, toplinePrice: 55.19, downlinePrice: 67.19, medspaPrice: 75.19 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "100mg/mL", dispenseSize: "30g", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "100mg/mL", dispenseSize: "60g", ourPrice: 36.95, toplinePrice: 51.73, downlinePrice: 62.99, medspaPrice: 70.49 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "100mg/mL", dispenseSize: "90g", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "200mg/mL", dispenseSize: "30g", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "200mg/mL", dispenseSize: "60g", ourPrice: 51.73, toplinePrice: 72.42, downlinePrice: 88.18, medspaPrice: 98.68 },
  { name: "Testosterone Cream", dosageForm: "Cream", concentration: "200mg/mL", dispenseSize: "90g", ourPrice: 68.98, toplinePrice: 96.57, downlinePrice: 117.57, medspaPrice: 131.57 },

  // ============ SEMAGLUTIDE INJECTIONS ============
  // From Excel: Semaglutide/B12/Glycine/L-Carnitine Injection
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "0.25mg/mL", dispenseSize: "1mL", ourPrice: 12.32, toplinePrice: 17.25, downlinePrice: 21.00, medspaPrice: 23.50 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "1mL", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "1mL", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "1.25mg/mL", dispenseSize: "1mL", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "1.7mg/mL", dispenseSize: "1mL", ourPrice: 27.10, toplinePrice: 37.94, downlinePrice: 46.20, medspaPrice: 51.70 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "1mL", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "2.4mg/mL", dispenseSize: "1mL", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "1mL", ourPrice: 36.95, toplinePrice: 51.73, downlinePrice: 62.99, medspaPrice: 70.49 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "3mg/mL", dispenseSize: "1mL", ourPrice: 39.42, toplinePrice: 55.19, downlinePrice: 67.19, medspaPrice: 75.19 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "4mg/mL", dispenseSize: "1mL", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "1mL", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "6mg/mL", dispenseSize: "1mL", ourPrice: 54.20, toplinePrice: 75.88, downlinePrice: 92.38, medspaPrice: 103.38 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "1mL", ourPrice: 61.59, toplinePrice: 86.23, downlinePrice: 104.98, medspaPrice: 117.48 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "1mL", ourPrice: 73.91, toplinePrice: 103.47, downlinePrice: 125.97, medspaPrice: 140.97 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "1mL", ourPrice: 86.23, toplinePrice: 120.72, downlinePrice: 146.97, medspaPrice: 164.47 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "1mL", ourPrice: 98.55, toplinePrice: 137.97, downlinePrice: 167.97, medspaPrice: 187.97 },

  // Semaglutide 2mL vials
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "2mL", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "2mL", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "2mL", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "2mL", ourPrice: 56.67, toplinePrice: 79.34, downlinePrice: 96.59, medspaPrice: 108.09 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "2mL", ourPrice: 86.23, toplinePrice: 120.72, downlinePrice: 146.97, medspaPrice: 164.47 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "2mL", ourPrice: 115.79, toplinePrice: 162.11, downlinePrice: 197.36, medspaPrice: 220.86 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "2mL", ourPrice: 140.42, toplinePrice: 196.59, downlinePrice: 239.34, medspaPrice: 267.84 },

  // Semaglutide 5mL vials
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "0.5mg/mL", dispenseSize: "5mL", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "1mg/mL", dispenseSize: "5mL", ourPrice: 61.59, toplinePrice: 86.23, downlinePrice: 104.98, medspaPrice: 117.48 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "2mg/mL", dispenseSize: "5mL", ourPrice: 98.55, toplinePrice: 137.97, downlinePrice: 167.97, medspaPrice: 187.97 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "5mL", ourPrice: 123.18, toplinePrice: 172.45, downlinePrice: 209.95, medspaPrice: 234.95 },
  { name: "Semaglutide/B12/Glycine/L-Carnitine", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "5mL", ourPrice: 197.10, toplinePrice: 275.94, downlinePrice: 335.94, medspaPrice: 375.94 },

  // ============ SEMAGLUTIDE RDT (Rapid Dissolve Tablets) ============
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "1mg", dispenseSize: "4ct", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "2mg", dispenseSize: "4ct", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "3mg", dispenseSize: "4ct", ourPrice: 46.81, toplinePrice: 65.53, downlinePrice: 79.78, medspaPrice: 89.28 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "4mg", dispenseSize: "4ct", ourPrice: 59.13, toplinePrice: 82.78, downlinePrice: 100.78, medspaPrice: 112.78 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "5mg", dispenseSize: "4ct", ourPrice: 71.45, toplinePrice: 100.03, downlinePrice: 121.78, medspaPrice: 136.28 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "6mg", dispenseSize: "4ct", ourPrice: 83.77, toplinePrice: 117.28, downlinePrice: 142.78, medspaPrice: 159.78 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "8mg", dispenseSize: "4ct", ourPrice: 108.40, toplinePrice: 151.76, downlinePrice: 184.76, medspaPrice: 206.76 },
  { name: "Semaglutide RDT", dosageForm: "RDT", concentration: "10mg", dispenseSize: "4ct", ourPrice: 133.04, toplinePrice: 186.26, downlinePrice: 226.76, medspaPrice: 253.76 },

  // ============ TIRZEPATIDE INJECTIONS ============
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "1mL", ourPrice: 86.23, toplinePrice: 120.72, downlinePrice: 146.97, medspaPrice: 164.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "1mL", ourPrice: 110.87, toplinePrice: 155.22, downlinePrice: 188.97, medspaPrice: 211.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "1mL", ourPrice: 135.50, toplinePrice: 189.70, downlinePrice: 230.97, medspaPrice: 258.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "1mL", ourPrice: 160.14, toplinePrice: 224.20, downlinePrice: 272.97, medspaPrice: 305.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "1mL", ourPrice: 184.77, toplinePrice: 258.68, downlinePrice: 314.97, medspaPrice: 352.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "1mL", ourPrice: 209.41, toplinePrice: 293.17, downlinePrice: 356.97, medspaPrice: 399.47 },

  // Tirzepatide 2mL vials
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "2.5mg/mL", dispenseSize: "2mL", ourPrice: 160.14, toplinePrice: 224.20, downlinePrice: 272.97, medspaPrice: 305.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "5mg/mL", dispenseSize: "2mL", ourPrice: 209.41, toplinePrice: 293.17, downlinePrice: 356.97, medspaPrice: 399.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "7.5mg/mL", dispenseSize: "2mL", ourPrice: 258.68, toplinePrice: 362.15, downlinePrice: 440.97, medspaPrice: 493.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "10mg/mL", dispenseSize: "2mL", ourPrice: 307.95, toplinePrice: 431.13, downlinePrice: 524.97, medspaPrice: 587.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "12.5mg/mL", dispenseSize: "2mL", ourPrice: 357.22, toplinePrice: 500.11, downlinePrice: 608.97, medspaPrice: 681.47 },
  { name: "Tirzepatide", dosageForm: "Injection", concentration: "15mg/mL", dispenseSize: "2mL", ourPrice: 406.49, toplinePrice: 569.09, downlinePrice: 692.97, medspaPrice: 775.47 },

  // ============ BI-EST CREAMS ============
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.25mg/g", dispenseSize: "30g", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.5mg/g", dispenseSize: "30g", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1mg/g", dispenseSize: "30g", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "2mg/g", dispenseSize: "30g", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "3mg/g", dispenseSize: "30g", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "4mg/g", dispenseSize: "30g", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "5mg/g", dispenseSize: "30g", ourPrice: 39.42, toplinePrice: 55.19, downlinePrice: 67.19, medspaPrice: 75.19 },

  // Bi-est 60g sizes
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "0.5mg/g", dispenseSize: "60g", ourPrice: 27.10, toplinePrice: 37.94, downlinePrice: 46.20, medspaPrice: 51.70 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "1mg/g", dispenseSize: "60g", ourPrice: 32.03, toplinePrice: 44.84, downlinePrice: 54.60, medspaPrice: 61.10 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "2mg/g", dispenseSize: "60g", ourPrice: 41.88, toplinePrice: 58.63, downlinePrice: 71.39, medspaPrice: 79.89 },
  { name: "Bi-est 80/20 Cream", dosageForm: "Cream", concentration: "3mg/g", dispenseSize: "60g", ourPrice: 51.73, toplinePrice: 72.42, downlinePrice: 88.18, medspaPrice: 98.68 },

  // ============ PROGESTERONE CAPSULES ============
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 12.32, toplinePrice: 17.25, downlinePrice: 21.00, medspaPrice: 23.50 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "150mg", dispenseSize: "30ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "200mg", dispenseSize: "30ct", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "300mg", dispenseSize: "30ct", ourPrice: 27.10, toplinePrice: 37.94, downlinePrice: 46.20, medspaPrice: 51.70 },
  { name: "Progesterone Capsules", dosageForm: "Capsule", concentration: "400mg", dispenseSize: "30ct", ourPrice: 32.03, toplinePrice: 44.84, downlinePrice: 54.60, medspaPrice: 61.10 },

  // ============ PROGESTERONE CREAM ============
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "20mg/g", dispenseSize: "30g", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "50mg/g", dispenseSize: "30g", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "100mg/g", dispenseSize: "30g", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Progesterone Cream", dosageForm: "Cream", concentration: "200mg/g", dispenseSize: "30g", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },

  // ============ DHEA ============
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 9.86, toplinePrice: 13.80, downlinePrice: 16.80, medspaPrice: 18.80 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "30ct", ourPrice: 12.32, toplinePrice: 17.25, downlinePrice: 21.00, medspaPrice: 23.50 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "15mg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "DHEA Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },

  // ============ THYROID - LIOTHYRONINE (T3) ============
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "5mcg", dispenseSize: "30ct", ourPrice: 12.32, toplinePrice: 17.25, downlinePrice: 21.00, medspaPrice: 23.50 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "10mcg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "15mcg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Liothyronine (T3)", dosageForm: "Capsule", concentration: "75mcg", dispenseSize: "30ct", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },

  // ============ THYROID - LIOTHYRONINE SR ============
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "5mcg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "10mcg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Liothyronine (T3) SR", dosageForm: "Capsule SR", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },

  // ============ LEVOTHYROXINE (T4) ============
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "25mcg", dispenseSize: "30ct", ourPrice: 12.32, toplinePrice: 17.25, downlinePrice: 21.00, medspaPrice: 23.50 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "50mcg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "75mcg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "100mcg", dispenseSize: "30ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "125mcg", dispenseSize: "30ct", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Levothyroxine (T4)", dosageForm: "Capsule", concentration: "150mcg", dispenseSize: "30ct", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },

  // ============ TADALAFIL ============
  { name: "Tadalafil Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Tadalafil Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "30ct", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Tadalafil Capsules", dosageForm: "Capsule", concentration: "20mg", dispenseSize: "30ct", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },

  { name: "Tadalafil Troches", dosageForm: "Troche", concentration: "5mg", dispenseSize: "30ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Tadalafil Troches", dosageForm: "Troche", concentration: "10mg", dispenseSize: "30ct", ourPrice: 27.10, toplinePrice: 37.94, downlinePrice: 46.20, medspaPrice: 51.70 },
  { name: "Tadalafil Troches", dosageForm: "Troche", concentration: "20mg", dispenseSize: "30ct", ourPrice: 36.95, toplinePrice: 51.73, downlinePrice: 62.99, medspaPrice: 70.49 },

  // ============ SILDENAFIL ============
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "20mg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "25mg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "50mg", dispenseSize: "30ct", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Sildenafil Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "30ct", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },

  { name: "Sildenafil Troches", dosageForm: "Troche", concentration: "25mg", dispenseSize: "30ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Sildenafil Troches", dosageForm: "Troche", concentration: "50mg", dispenseSize: "30ct", ourPrice: 27.10, toplinePrice: 37.94, downlinePrice: 46.20, medspaPrice: 51.70 },
  { name: "Sildenafil Troches", dosageForm: "Troche", concentration: "100mg", dispenseSize: "30ct", ourPrice: 36.95, toplinePrice: 51.73, downlinePrice: 62.99, medspaPrice: 70.49 },

  // ============ OXYTOCIN ============
  { name: "Oxytocin Troches", dosageForm: "Troche", concentration: "10IU", dispenseSize: "30ct", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Oxytocin Troches", dosageForm: "Troche", concentration: "25IU", dispenseSize: "30ct", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "Oxytocin Troches", dosageForm: "Troche", concentration: "40IU", dispenseSize: "30ct", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },

  { name: "Oxytocin Nasal Spray", dosageForm: "Nasal Spray", concentration: "20IU/mL", dispenseSize: "10mL", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },
  { name: "Oxytocin Nasal Spray", dosageForm: "Nasal Spray", concentration: "40IU/mL", dispenseSize: "10mL", ourPrice: 39.42, toplinePrice: 55.19, downlinePrice: 67.19, medspaPrice: 75.19 },

  // ============ PT-141 ============
  { name: "PT-141 (Bremelanotide)", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 36.95, toplinePrice: 51.73, downlinePrice: 62.99, medspaPrice: 70.49 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 56.67, toplinePrice: 79.34, downlinePrice: 96.59, medspaPrice: 108.09 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Troche", concentration: "500mcg", dispenseSize: "8ct", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Troche", concentration: "750mcg", dispenseSize: "8ct", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },
  { name: "PT-141 (Bremelanotide)", dosageForm: "Nasal Spray", concentration: "10mg/mL", dispenseSize: "5mL", ourPrice: 56.67, toplinePrice: 79.34, downlinePrice: 96.59, medspaPrice: 108.09 },

  // ============ PEPTIDES - SERMORELIN ============
  { name: "Sermorelin", dosageForm: "Injection", concentration: "3mg", dispenseSize: "1 vial", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },
  { name: "Sermorelin", dosageForm: "Injection", concentration: "6mg", dispenseSize: "1 vial", ourPrice: 73.91, toplinePrice: 103.47, downlinePrice: 125.97, medspaPrice: 140.97 },
  { name: "Sermorelin", dosageForm: "Injection", concentration: "9mg", dispenseSize: "1 vial", ourPrice: 98.55, toplinePrice: 137.97, downlinePrice: 167.97, medspaPrice: 187.97 },
  { name: "Sermorelin", dosageForm: "Injection", concentration: "15mg", dispenseSize: "1 vial", ourPrice: 147.82, toplinePrice: 206.95, downlinePrice: 251.95, medspaPrice: 281.95 },

  // ============ PEPTIDES - IPAMORELIN ============
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 73.91, toplinePrice: 103.47, downlinePrice: 125.97, medspaPrice: 140.97 },
  { name: "Ipamorelin", dosageForm: "Injection", concentration: "15mg", dispenseSize: "1 vial", ourPrice: 98.55, toplinePrice: 137.97, downlinePrice: 167.97, medspaPrice: 187.97 },

  // ============ PEPTIDES - CJC-1295 / IPAMORELIN COMBO ============
  { name: "CJC-1295/Ipamorelin", dosageForm: "Injection", concentration: "2mg/2mg", dispenseSize: "1 vial", ourPrice: 61.59, toplinePrice: 86.23, downlinePrice: 104.98, medspaPrice: 117.48 },
  { name: "CJC-1295/Ipamorelin", dosageForm: "Injection", concentration: "3mg/3mg", dispenseSize: "1 vial", ourPrice: 86.23, toplinePrice: 120.72, downlinePrice: 146.97, medspaPrice: 164.47 },
  { name: "CJC-1295/Ipamorelin", dosageForm: "Injection", concentration: "5mg/5mg", dispenseSize: "1 vial", ourPrice: 110.87, toplinePrice: 155.22, downlinePrice: 188.97, medspaPrice: 211.47 },
  { name: "CJC-1295/Ipamorelin", dosageForm: "Injection", concentration: "9mg/9mg", dispenseSize: "1 vial", ourPrice: 172.46, toplinePrice: 241.44, downlinePrice: 293.94, medspaPrice: 328.94 },

  // ============ PEPTIDES - BPC-157 ============
  { name: "BPC-157", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },
  { name: "BPC-157", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 73.91, toplinePrice: 103.47, downlinePrice: 125.97, medspaPrice: 140.97 },
  { name: "BPC-157", dosageForm: "Capsule", concentration: "250mcg", dispenseSize: "30ct", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },
  { name: "BPC-157", dosageForm: "Capsule", concentration: "500mcg", dispenseSize: "30ct", ourPrice: 73.91, toplinePrice: 103.47, downlinePrice: 125.97, medspaPrice: 140.97 },

  // ============ PEPTIDES - TB-500 ============
  { name: "TB-500 (Thymosin Beta-4)", dosageForm: "Injection", concentration: "5mg", dispenseSize: "1 vial", ourPrice: 56.67, toplinePrice: 79.34, downlinePrice: 96.59, medspaPrice: 108.09 },
  { name: "TB-500 (Thymosin Beta-4)", dosageForm: "Injection", concentration: "10mg", dispenseSize: "1 vial", ourPrice: 86.23, toplinePrice: 120.72, downlinePrice: 146.97, medspaPrice: 164.47 },

  // ============ NAD+ ============
  { name: "NAD+ Injection", dosageForm: "Injection", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 123.18, toplinePrice: 172.45, downlinePrice: 209.95, medspaPrice: 234.95 },
  { name: "NAD+ Injection", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 197.10, toplinePrice: 275.94, downlinePrice: 335.94, medspaPrice: 375.94 },
  { name: "NAD+ Nasal Spray", dosageForm: "Nasal Spray", concentration: "100mg/mL", dispenseSize: "10mL", ourPrice: 86.23, toplinePrice: 120.72, downlinePrice: 146.97, medspaPrice: 164.47 },

  // ============ GLUTATHIONE ============
  { name: "Glutathione Injection", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "10mL", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },
  { name: "Glutathione Injection", dosageForm: "Injection", concentration: "200mg/mL", dispenseSize: "30mL", ourPrice: 110.87, toplinePrice: 155.22, downlinePrice: 188.97, medspaPrice: 211.47 },
  { name: "Glutathione Capsules", dosageForm: "Capsule", concentration: "250mg", dispenseSize: "60ct", ourPrice: 36.95, toplinePrice: 51.73, downlinePrice: 62.99, medspaPrice: 70.49 },
  { name: "Glutathione Capsules", dosageForm: "Capsule", concentration: "500mg", dispenseSize: "60ct", ourPrice: 56.67, toplinePrice: 79.34, downlinePrice: 96.59, medspaPrice: 108.09 },

  // ============ LOW DOSE NALTREXONE (LDN) ============
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "0.5mg", dispenseSize: "30ct", ourPrice: 12.32, toplinePrice: 17.25, downlinePrice: 21.00, medspaPrice: 23.50 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "1.5mg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "3mg", dispenseSize: "30ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "4.5mg", dispenseSize: "30ct", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Low Dose Naltrexone (LDN)", dosageForm: "Capsule", concentration: "6mg", dispenseSize: "30ct", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },

  // ============ METFORMIN ER ============
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "250mg", dispenseSize: "90ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "500mg", dispenseSize: "90ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "750mg", dispenseSize: "90ct", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Metformin ER Capsules", dosageForm: "Capsule ER", concentration: "1000mg", dispenseSize: "90ct", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },

  // ============ VITAMIN B12 / MIC INJECTIONS ============
  { name: "Vitamin B12 Injection", dosageForm: "Injection", concentration: "1000mcg/mL", dispenseSize: "10mL", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Vitamin B12 Injection", dosageForm: "Injection", concentration: "1000mcg/mL", dispenseSize: "30mL", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },
  { name: "MIC/B12 Lipotropic Injection", dosageForm: "Injection", concentration: "Standard", dispenseSize: "10mL", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "MIC/B12 Lipotropic Injection", dosageForm: "Injection", concentration: "Standard", dispenseSize: "30mL", ourPrice: 49.27, toplinePrice: 68.98, downlinePrice: 83.98, medspaPrice: 93.98 },

  // ============ MINOXIDIL - HAIR LOSS ============
  { name: "Minoxidil Solution", dosageForm: "Solution", concentration: "5%", dispenseSize: "60mL", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Minoxidil Solution", dosageForm: "Solution", concentration: "10%", dispenseSize: "60mL", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "Minoxidil Solution", dosageForm: "Solution", concentration: "15%", dispenseSize: "60mL", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },
  { name: "Minoxidil/Finasteride Solution", dosageForm: "Solution", concentration: "5%/0.1%", dispenseSize: "60mL", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },
  { name: "Minoxidil/Finasteride Solution", dosageForm: "Solution", concentration: "10%/0.1%", dispenseSize: "60mL", ourPrice: 54.20, toplinePrice: 75.88, downlinePrice: 92.38, medspaPrice: 103.38 },

  // ============ FINASTERIDE ============
  { name: "Finasteride Capsules", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "30ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Finasteride Capsules", dosageForm: "Capsule", concentration: "2.5mg", dispenseSize: "30ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Finasteride Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "30ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },

  // ============ TRETINOIN ============
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.025%", dispenseSize: "30g", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.05%", dispenseSize: "30g", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Tretinoin Cream", dosageForm: "Cream", concentration: "0.1%", dispenseSize: "30g", ourPrice: 29.56, toplinePrice: 41.38, downlinePrice: 50.40, medspaPrice: 56.40 },

  // ============ HYDROQUINONE ============
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "4%", dispenseSize: "30g", ourPrice: 24.64, toplinePrice: 34.50, downlinePrice: 42.00, medspaPrice: 47.00 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "6%", dispenseSize: "30g", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "8%", dispenseSize: "30g", ourPrice: 44.35, toplinePrice: 62.09, downlinePrice: 75.59, medspaPrice: 84.59 },
  { name: "Hydroquinone Cream", dosageForm: "Cream", concentration: "10%", dispenseSize: "30g", ourPrice: 54.20, toplinePrice: 75.88, downlinePrice: 92.38, medspaPrice: 103.38 },

  // ============ MELATONIN ============
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "1mg", dispenseSize: "60ct", ourPrice: 9.86, toplinePrice: 13.80, downlinePrice: 16.80, medspaPrice: 18.80 },
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "3mg", dispenseSize: "60ct", ourPrice: 12.32, toplinePrice: 17.25, downlinePrice: 21.00, medspaPrice: 23.50 },
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "5mg", dispenseSize: "60ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Melatonin Capsules", dosageForm: "Capsule", concentration: "10mg", dispenseSize: "60ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Melatonin ER Capsules", dosageForm: "Capsule ER", concentration: "3mg", dispenseSize: "60ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Melatonin ER Capsules", dosageForm: "Capsule ER", concentration: "5mg", dispenseSize: "60ct", ourPrice: 17.25, toplinePrice: 24.15, downlinePrice: 29.40, medspaPrice: 32.90 },
  { name: "Melatonin ER Capsules", dosageForm: "Capsule ER", concentration: "10mg", dispenseSize: "60ct", ourPrice: 19.71, toplinePrice: 27.59, downlinePrice: 33.60, medspaPrice: 37.60 },

  // ============ GABAPENTIN ============
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "100mg", dispenseSize: "90ct", ourPrice: 14.78, toplinePrice: 20.69, downlinePrice: 25.20, medspaPrice: 28.20 },
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "300mg", dispenseSize: "90ct", ourPrice: 22.17, toplinePrice: 31.04, downlinePrice: 37.80, medspaPrice: 42.30 },
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "400mg", dispenseSize: "90ct", ourPrice: 27.10, toplinePrice: 37.94, downlinePrice: 46.20, medspaPrice: 51.70 },
  { name: "Gabapentin Capsules", dosageForm: "Capsule", concentration: "600mg", dispenseSize: "90ct", ourPrice: 34.49, toplinePrice: 48.29, downlinePrice: 58.79, medspaPrice: 65.79 },
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
  if (lowerName.includes('vitamin') || lowerName.includes('b12') || lowerName.includes('mic') || lowerName.includes('magnesium') || lowerName.includes('zinc') || lowerName.includes('coq10') || lowerName.includes('carnitine')) return 'vitamin';
  if (lowerName.includes('tretinoin') || lowerName.includes('hydroquinone') || lowerName.includes('niacinamide')) return 'skincare';
  if (lowerName.includes('naltrexone') || lowerName.includes('ldn') || lowerName.includes('metformin') || lowerName.includes('gabapentin') || lowerName.includes('melatonin')) return 'misc';
  
  return 'general';
}

// Parse concentration to numeric value for sorting
function parseConcentration(concentration: string): number {
  const match = concentration.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
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
    // Reduce default batch size to 3 for progressive processing (fits within 60s edge function timeout)
    const { generateImages = true, dryRun = false, startIndex = 0, batchSize = 3, forceOverwrite = false } = body;

    console.log('Starting Vios product catalog seed...');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}, Generate Images: ${generateImages}`);
    console.log(`Total products in catalog: ${VIOS_PRODUCTS.length}`);

    // Fetch existing Vios product names to skip already-seeded families
    const { data: existingProducts } = await supabase
      .from('products')
      .select('name')
      .eq('pharmacy_id', VIOS_PHARMACY_ID);

    const existingProductNames = new Set((existingProducts || []).map(p => p.name));
    console.log(`Found ${existingProductNames.size} existing Vios products - will skip these families`);

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
      
      // Skip if already seeded
      if (existingProductNames.has(family.name)) {
        console.log(`[${i + 1}/${families.length}] Skipping (already exists): ${family.name}`);
        continue;
      }
      
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
        else if (category === 'hormone') productTypeId = typeMap.get('hormone therapy') || typeMap.get('hormone') || typeMap.get('hormones') || defaultTypeId;
        else if (category === 'thyroid') productTypeId = typeMap.get('thyroid') || defaultTypeId;
        else if (category === 'sexual_health') productTypeId = typeMap.get('sexual health') || typeMap.get('mens health') || defaultTypeId;
        else if (category === 'hair') productTypeId = typeMap.get('hair care') || typeMap.get('hair') || typeMap.get('hair loss') || defaultTypeId;
        else if (category === 'antiaging') productTypeId = typeMap.get('anti-aging') || typeMap.get('longevity') || defaultTypeId;

        // Create the main product (using primary/lowest variant)
        const productData = {
          name: family.name,
          dosage: primaryVariant.concentration,
          dosage_form: primaryVariant.dosageForm,
          sig: `As directed by prescriber - ${primaryVariant.dispenseSize}`,
          description: generateDescription(family.name, primaryVariant.dosageForm),
          base_price: primaryVariant.ourPrice,
          topline_price: primaryVariant.toplinePrice,
          downline_price: primaryVariant.downlinePrice,
          retail_price: primaryVariant.medspaPrice,
          image_url: imageUrl,
          pharmacy_id: VIOS_PHARMACY_ID,
          product_type_id: productTypeId,
          active: true,
          requires_prescription: true,
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

    const message = dryRun 
      ? `Dry run complete: Found ${allFamilies.length} product families with ${results.variantsCreated + results.productsCreated} total items`
      : `Successfully created ${results.productsCreated} products with ${results.variantsCreated} variants`;

    const nextIndex = startIndex + families.length;
    const hasMore = nextIndex < allFamilies.length;

    return new Response(
      JSON.stringify({
        success: true,
        message,
        dryRun,
        summary: {
          totalProductsInCatalog: VIOS_PRODUCTS.length,
          totalFamilies: allFamilies.length,
          familiesProcessed: families.length,
          productsCreated: results.productsCreated,
          variantsCreated: results.variantsCreated,
          imagesGenerated: results.imagesGenerated,
          errors: results.errors.slice(0, 10),
          nextStartIndex: nextIndex,
          hasMore,
        },
        samples: results.samples,
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
