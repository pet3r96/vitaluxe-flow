/**
 * Product Catalog PDF Generator
 * Generates a professional branded catalog with all products, images, and variant pricing
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { getLastAutoTableY, getTotalPages } from '@/types/pdf';

interface CatalogProduct {
  id: string;
  name: string;
  image_url: string | null;
  dosage_form: string | null;
  category: string;
  variants: {
    dosage_label: string;
    retail_price: number | null;
  }[];
}

interface CategoryGroup {
  name: string;
  products: CatalogProduct[];
  startPage?: number;
}

/**
 * Convert an image URL to base64 data URI for PDF embedding
 */
async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Fetch the Vitaluxe logo from branding-assets bucket
 */
async function fetchLogo(): Promise<string | null> {
  try {
    const { data } = supabase.storage.from('branding-assets').getPublicUrl('vitaluxe-logo-dark-bg.png');
    if (!data?.publicUrl) return null;
    return imageToBase64(data.publicUrl);
  } catch {
    return null;
  }
}

/**
 * Fetch all active products with their variants, grouped by category
 */
async function fetchCatalogData(): Promise<CategoryGroup[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id, name, image_url, dosage_form, active,
      product_types(name)
    `)
    .eq('active', true)
    .order('name');

  if (error) throw error;

  // Fetch all variants for active products
  const productIds = (products || []).map(p => p.id);
  const { data: variants, error: vError } = await supabase
    .from('product_variants')
    .select('product_id, dosage_label, retail_price, active, sort_order')
    .in('product_id', productIds)
    .eq('active', true)
    .order('sort_order');

  if (vError) throw vError;

  // Build variant map
  const variantMap = new Map<string, { dosage_label: string; retail_price: number | null }[]>();
  for (const v of (variants || [])) {
    if (!variantMap.has(v.product_id)) variantMap.set(v.product_id, []);
    variantMap.get(v.product_id)!.push({ dosage_label: v.dosage_label, retail_price: v.retail_price });
  }

  // Group by category
  const categoryMap = new Map<string, CatalogProduct[]>();
  for (const p of (products || [])) {
    const category = (p.product_types as any)?.name || 'Uncategorized';
    if (!categoryMap.has(category)) categoryMap.set(category, []);
    categoryMap.get(category)!.push({
      id: p.id,
      name: p.name,
      image_url: p.image_url,
      dosage_form: p.dosage_form,
      category,
      variants: variantMap.get(p.id) || [],
    });
  }

  // Sort categories alphabetically
  return Array.from(categoryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, products]) => ({ name, products }));
}

/**
 * Format currency
 */
function fmt(value: number | null): string {
  if (value == null) return 'N/A';
  return `$${value.toFixed(2)}`;
}

// Colors
const DARK_GREY: [number, number, number] = [55, 65, 81];
const GOLD: [number, number, number] = [218, 165, 32];
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT_GREY: [number, number, number] = [245, 245, 245];

export async function generateProductCatalogPDF(
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('Fetching product data...');
  const categories = await fetchCatalogData();

  onProgress?.('Loading logo...');
  const logoBase64 = await fetchLogo();

  onProgress?.('Loading product images...');
  // Pre-fetch all product images
  const allProducts = categories.flatMap(c => c.products);
  const imageMap = new Map<string, string | null>();
  
  // Batch image loading (10 at a time)
  for (let i = 0; i < allProducts.length; i += 10) {
    const batch = allProducts.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async p => {
        if (!p.image_url) return { id: p.id, data: null };
        const data = await imageToBase64(p.image_url);
        return { id: p.id, data };
      })
    );
    results.forEach(r => imageMap.set(r.id, r.data));
    onProgress?.(`Loading images... ${Math.min(i + 10, allProducts.length)}/${allProducts.length}`);
  }

  onProgress?.('Generating PDF...');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ── COVER PAGE ──
  // Full dark background
  doc.setFillColor(...DARK_GREY);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Logo
  let coverY = 50;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', (pageWidth - 80) / 2, coverY, 80, 30);
      coverY += 45;
    } catch {
      coverY += 10;
    }
  }

  // Gold divider
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1);
  doc.line(pageWidth * 0.2, coverY, pageWidth * 0.8, coverY);
  coverY += 15;

  // "PRODUCT CATALOG" title
  doc.setTextColor(...GOLD);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUCT CATALOG', pageWidth / 2, coverY, { align: 'center' });
  coverY += 20;

  // Another divider
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(pageWidth * 0.3, coverY, pageWidth * 0.7, coverY);
  coverY += 25;

  // Company info
  doc.setTextColor(...WHITE);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Vitaluxe Services', pageWidth / 2, coverY, { align: 'center' });
  coverY += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('16192 Coastal Highway, Lewes, Delaware 19958', pageWidth / 2, coverY, { align: 'center' });
  coverY += 7;
  doc.text('Phone: (844) 252-5233', pageWidth / 2, coverY, { align: 'center' });
  coverY += 7;
  doc.text('https://vitaluxeservices.com', pageWidth / 2, coverY, { align: 'center' });
  coverY += 20;

  // Date generated
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.text(`Generated: ${dateStr}`, pageWidth / 2, coverY, { align: 'center' });

  // Cover footer
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text('Confidential — For Authorized Partners Only', pageWidth / 2, pageHeight - 15, { align: 'center' });

  // ── TABLE OF CONTENTS ──
  doc.addPage();
  let tocY = 30;

  doc.setFillColor(...DARK_GREY);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(...GOLD);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TABLE OF CONTENTS', pageWidth / 2, 15, { align: 'center' });

  tocY += 10;
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  // We'll fill in page numbers after rendering all products
  const tocEntries: { name: string; count: number; y: number }[] = [];

  for (const cat of categories) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(cat.name, margin + 5, tocY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`${cat.products.length} product${cat.products.length !== 1 ? 's' : ''}`, pageWidth - margin - 5, tocY, { align: 'right' });
    
    // Dotted leader line
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 2], 0);
    const textWidth = doc.getTextWidth(cat.name);
    const countText = `${cat.products.length} product${cat.products.length !== 1 ? 's' : ''}`;
    const countWidth = doc.getTextWidth(countText);
    doc.line(margin + 5 + textWidth + 3, tocY, pageWidth - margin - 5 - countWidth - 3, tocY);
    doc.setLineDashPattern([], 0);

    tocEntries.push({ name: cat.name, count: cat.products.length, y: tocY });
    tocY += 10;
  }

  // ── PRODUCT PAGES ──
  for (let catIdx = 0; catIdx < categories.length; catIdx++) {
    const cat = categories[catIdx];
    doc.addPage();
    cat.startPage = doc.getNumberOfPages();

    // Category header bar
    doc.setFillColor(...DARK_GREY);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(...GOLD);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(cat.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });

    let yPos = 32;

    for (let pIdx = 0; pIdx < cat.products.length; pIdx++) {
      const product = cat.products[pIdx];
      const imgBase64 = imageMap.get(product.id);
      
      // Estimate space needed: image row ~45 + variants table ~(variants.length * 8 + 20) + padding
      const estimatedHeight = 50 + (product.variants.length * 8) + 25;
      
      if (yPos + estimatedHeight > pageHeight - 25) {
        doc.addPage();
        // Re-add category header
        doc.setFillColor(...DARK_GREY);
        doc.rect(0, 0, pageWidth, 22, 'F');
        doc.setTextColor(...GOLD);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(cat.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });
        yPos = 32;
      }

      // Light card background
      const cardTop = yPos - 3;
      
      // Product image + name row
      let textStartX = margin;
      const imgSize = 35;
      
      if (imgBase64) {
        try {
          doc.addImage(imgBase64, 'PNG', margin, yPos, imgSize, imgSize);
          textStartX = margin + imgSize + 8;
        } catch {
          textStartX = margin;
        }
      }

      // Product name
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(product.name, textStartX, yPos + 10);

      // Dosage form
      if (product.dosage_form) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(product.dosage_form, textStartX, yPos + 17);
      }

      yPos += Math.max(imgSize + 5, 25);

      // Variants pricing table
      if (product.variants.length > 0) {
        const tableData = product.variants.map(v => [
          v.dosage_label,
          fmt(v.retail_price),
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Dosage / Size', 'Practice Price']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: DARK_GREY,
            textColor: WHITE,
            fontStyle: 'bold',
            fontSize: 8,
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [30, 30, 30],
          },
          alternateRowStyles: {
            fillColor: LIGHT_GREY,
          },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 40, halign: 'right' },
          },
          styles: {
            lineColor: [200, 200, 200],
            lineWidth: 0.2,
          },
          margin: { left: margin, right: pageWidth - margin - 120 },
          tableWidth: 120,
        });

        yPos = getLastAutoTableY(doc) + 12;
      } else {
        yPos += 5;
      }

      // Subtle divider between products
      if (pIdx < cat.products.length - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;
      }
    }
  }

  // ── FOOTERS on every page ──
  const totalPages = getTotalPages(doc);
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i === 1) continue; // Skip cover page footer (already has its own)

    doc.setFillColor(250, 250, 250);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(0, pageHeight - 12, pageWidth, pageHeight - 12);

    doc.setTextColor(120, 120, 120);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Vitaluxe Services', pageWidth / 2, pageHeight - 5, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    doc.text('Confidential — For Authorized Partners Only', margin, pageHeight - 5);
  }

  // ── Update TOC with page numbers ──
  doc.setPage(2);
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const entry = tocEntries[i];
    if (cat.startPage && entry) {
      doc.setTextColor(...GOLD);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`p. ${cat.startPage}`, pageWidth - margin - 45, entry.y);
    }
  }

  onProgress?.('Done!');
  return doc.output('blob');
}
