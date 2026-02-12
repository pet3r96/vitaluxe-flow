/**
 * Product Catalog PDF Generator
 * Print-ready branded catalog with 2-column grid layout
 * Black / White / Gold theme
 */

import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { getTotalPages } from '@/types/pdf';

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

// ── Colors ──
const BLACK: [number, number, number] = [0, 0, 0];
const GOLD: [number, number, number] = [218, 165, 32];
const WHITE: [number, number, number] = [255, 255, 255];
const LIGHT_GREY: [number, number, number] = [240, 240, 240];
const MID_GREY: [number, number, number] = [150, 150, 150];

// ── Layout constants (mm) ──
const MARGIN = 12;
const CARD_W = 90;    // card width
const CARD_H = 82;    // card height
const COL_GAP = 6;    // gap between columns
const ROW_GAP = 3;    // gap between rows
const IMG_SIZE = 48;  // image box size
const HEADER_H = 22;  // category header bar height (taller)
const FOOTER_H = 14;  // footer area height
const CORNER_LEN = 4; // gold corner accent length

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

async function fetchLogo(): Promise<string | null> {
  try {
    const { data } = supabase.storage.from('branding-assets').getPublicUrl('vitaluxe-logo-dark-bg.png');
    if (!data?.publicUrl) return null;
    return imageToBase64(data.publicUrl);
  } catch {
    return null;
  }
}

async function fetchCatalogData(): Promise<CategoryGroup[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select(`id, name, image_url, dosage_form, active, product_types(name)`)
    .eq('active', true)
    .order('name');
  if (error) throw error;

  const productIds = (products || []).map(p => p.id);
  const { data: variants, error: vError } = await supabase
    .from('product_variants')
    .select('product_id, dosage_label, retail_price, active, sort_order')
    .in('product_id', productIds)
    .eq('active', true)
    .order('sort_order');
  if (vError) throw vError;

  const variantMap = new Map<string, { dosage_label: string; retail_price: number | null }[]>();
  for (const v of (variants || [])) {
    if (!variantMap.has(v.product_id)) variantMap.set(v.product_id, []);
    variantMap.get(v.product_id)!.push({ dosage_label: v.dosage_label, retail_price: v.retail_price });
  }

  const categoryMap = new Map<string, CatalogProduct[]>();
  for (const p of (products || [])) {
    const category = (p.product_types as any)?.name || 'Uncategorized';
    if (!categoryMap.has(category)) categoryMap.set(category, []);
    categoryMap.get(category)!.push({
      id: p.id, name: p.name, image_url: p.image_url, dosage_form: p.dosage_form,
      category, variants: variantMap.get(p.id) || [],
    });
  }

  return Array.from(categoryMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, products]) => ({ name, products }));
}

function fmt(value: number | null): string {
  if (value == null) return 'N/A';
  return `$${value.toFixed(2)}`;
}

// ── Rendering helpers ──

function drawCategoryHeader(doc: jsPDF, name: string, pageWidth: number) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, HEADER_H + 4, 'F');
  doc.setTextColor(...GOLD);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(name.toUpperCase(), pageWidth / 2, HEADER_H - 2, { align: 'center' });
  // Gold underline accent
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(pageWidth * 0.2, HEADER_H + 2, pageWidth * 0.8, HEADER_H + 2);
}

function drawCornerAccents(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  // Top-left
  doc.line(x, y, x + CORNER_LEN, y);
  doc.line(x, y, x, y + CORNER_LEN);
  // Top-right
  doc.line(x + w, y, x + w - CORNER_LEN, y);
  doc.line(x + w, y, x + w, y + CORNER_LEN);
  // Bottom-left
  doc.line(x, y + h, x + CORNER_LEN, y + h);
  doc.line(x, y + h, x, y + h - CORNER_LEN);
  // Bottom-right
  doc.line(x + w, y + h, x + w - CORNER_LEN, y + h);
  doc.line(x + w, y + h, x + w, y + h - CORNER_LEN);
}

function drawCard(
  doc: jsPDF,
  product: CatalogProduct,
  imgBase64: string | null,
  x: number,
  y: number
) {
  // Outer black border
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.rect(x, y, CARD_W, CARD_H);

  // Inner gold accent border
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(x + 1.5, y + 1.5, CARD_W - 3, CARD_H - 3);

  // Gold corner accents
  drawCornerAccents(doc, x, y, CARD_W, CARD_H);

  // Image area — rounded rect background
  const imgBoxX = x + (CARD_W - IMG_SIZE) / 2;
  const imgBoxY = y + 3;
  doc.setFillColor(...LIGHT_GREY);
  doc.roundedRect(imgBoxX, imgBoxY, IMG_SIZE, IMG_SIZE, 2, 2, 'F');

  if (imgBase64) {
    try {
      doc.addImage(imgBase64, 'PNG', imgBoxX + 2, imgBoxY + 2, IMG_SIZE - 4, IMG_SIZE - 4);
    } catch { /* skip */ }
  }

  let textY = imgBoxY + IMG_SIZE + 5;

  // Product name
  doc.setTextColor(...BLACK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  let displayName = product.name;
  const maxNameWidth = CARD_W - 10;
  while (doc.getTextWidth(displayName) > maxNameWidth && displayName.length > 10) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== product.name) displayName += '…';
  doc.text(displayName, x + CARD_W / 2, textY, { align: 'center' });
  textY += 5;

  // Dosage form
  if (product.dosage_form) {
    doc.setTextColor(...MID_GREY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(product.dosage_form, x + CARD_W / 2, textY, { align: 'center' });
    textY += 4;
  } else {
    textY += 2;
  }

  // Gold gradient bar behind "Practice Price"
  const barH = 4.5;
  doc.setFillColor(218, 165, 32);
  doc.roundedRect(x + 10, textY - 3, CARD_W - 20, barH, 1, 1, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PRACTICE PRICE', x + CARD_W / 2, textY - 0.2, { align: 'center' });
  textY += 5.5;

  if (product.variants.length === 0) {
    doc.setTextColor(...BLACK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Contact for pricing', x + CARD_W / 2, textY, { align: 'center' });
  } else if (product.variants.length === 1) {
    doc.setTextColor(...BLACK);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(product.variants[0].retail_price), x + CARD_W / 2, textY + 2, { align: 'center' });
  } else {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const maxLines = 5;
    const variants = product.variants.slice(0, maxLines);
    for (const v of variants) {
      doc.setTextColor(60, 60, 60);
      let label = v.dosage_label;
      const priceStr = fmt(v.retail_price);
      const availableW = CARD_W - 16;
      const priceW = doc.getTextWidth(priceStr);
      const maxLabelW = availableW - priceW - 4;
      while (doc.getTextWidth(label) > maxLabelW && label.length > 5) {
        label = label.slice(0, -1);
      }
      if (label !== v.dosage_label) label += '…';

      doc.text(label, x + 6, textY);
      doc.text(priceStr, x + CARD_W - 6, textY, { align: 'right' });
      textY += 4;
    }
    if (product.variants.length > maxLines) {
      doc.setTextColor(...MID_GREY);
      doc.setFontSize(6);
      doc.text(`+${product.variants.length - maxLines} more`, x + CARD_W / 2, textY, { align: 'center' });
    }
  }
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number, pageWidth: number, pageHeight: number) {
  const footerY = pageHeight - FOOTER_H;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, footerY, pageWidth - MARGIN, footerY);

  doc.setTextColor(...MID_GREY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Confidential — For Authorized Partners Only', MARGIN, footerY + 5);
  doc.text('Vitaluxe Services', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN, footerY + 5, { align: 'right' });
}

// ── Main export ──

export async function generateProductCatalogPDF(
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('Fetching product data...');
  const categories = await fetchCatalogData();

  onProgress?.('Loading logo...');
  const logoBase64 = await fetchLogo();

  onProgress?.('Loading product images...');
  const allProducts = categories.flatMap(c => c.products);
  const imageMap = new Map<string, string | null>();

  for (let i = 0; i < allProducts.length; i += 10) {
    const batch = allProducts.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async p => {
        if (!p.image_url) return { id: p.id, data: null };
        return { id: p.id, data: await imageToBase64(p.image_url) };
      })
    );
    results.forEach(r => imageMap.set(r.id, r.data));
    onProgress?.(`Loading images... ${Math.min(i + 10, allProducts.length)}/${allProducts.length}`);
  }

  onProgress?.('Generating PDF...');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── COVER PAGE ──
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let coverY = 45;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', (pageWidth - 90) / 2, coverY, 90, 34);
      coverY += 48;
    } catch { coverY += 10; }
  }

  // Gold rule
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(pageWidth * 0.15, coverY, pageWidth * 0.85, coverY);
  coverY += 18;

  doc.setTextColor(...GOLD);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUCT CATALOG', pageWidth / 2, coverY, { align: 'center' });
  coverY += 18;

  // Gold rule
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(pageWidth * 0.25, coverY, pageWidth * 0.75, coverY);
  coverY += 28;

  // Company info
  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
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
  coverY += 22;

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  doc.text(`Generated: ${dateStr}`, pageWidth / 2, coverY, { align: 'center' });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.text('Confidential — For Authorized Partners Only', pageWidth / 2, pageHeight - 12, { align: 'center' });

  // ── TABLE OF CONTENTS ──
  doc.addPage();
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, HEADER_H + 4, 'F');
  doc.setTextColor(...GOLD);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TABLE OF CONTENTS', pageWidth / 2, HEADER_H - 2, { align: 'center' });

  let tocY = HEADER_H + 18;
  const tocEntries: { name: string; y: number }[] = [];

  for (const cat of categories) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.text(cat.name, MARGIN + 5, tocY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MID_GREY);
    const countStr = `${cat.products.length} product${cat.products.length !== 1 ? 's' : ''}`;
    doc.text(countStr, pageWidth - MARGIN - 40, tocY);

    // Dotted leader
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 2], 0);
    const nameW = doc.getTextWidth(cat.name);
    doc.line(MARGIN + 5 + nameW + 3, tocY, pageWidth - MARGIN - 42, tocY);
    doc.setLineDashPattern([], 0);

    // Gold accent
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(MARGIN + 5, tocY + 3, pageWidth - MARGIN - 5, tocY + 3);

    tocEntries.push({ name: cat.name, y: tocY });
    tocY += 12;
  }

  // ── PRODUCT PAGES — 2-column grid ──
  const col1X = MARGIN;
  const col2X = MARGIN + CARD_W + COL_GAP;
  const gridTopY = HEADER_H + 8;

  for (const cat of categories) {
    doc.addPage();
    cat.startPage = doc.getNumberOfPages();
    drawCategoryHeader(doc, cat.name, pageWidth);

    let col = 0;
    let row = 0;

    for (let pIdx = 0; pIdx < cat.products.length; pIdx++) {
      const cardX = col === 0 ? col1X : col2X;
      const cardY = gridTopY + row * (CARD_H + ROW_GAP);

      // Check page break
      if (cardY + CARD_H > pageHeight - FOOTER_H - 2) {
        doc.addPage();
        drawCategoryHeader(doc, cat.name, pageWidth);
        col = 0;
        row = 0;
      }

      const finalX = col === 0 ? col1X : col2X;
      const finalY = gridTopY + row * (CARD_H + ROW_GAP);

      drawCard(doc, cat.products[pIdx], imageMap.get(cat.products[pIdx].id) || null, finalX, finalY);

      if (col === 0) {
        col = 1;
      } else {
        col = 0;
        row++;
      }
    }
  }

  // ── Footers ──
  const totalPages = getTotalPages(doc);
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages, pageWidth, pageHeight);
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
      doc.text(`p. ${cat.startPage}`, pageWidth - MARGIN - 5, entry.y, { align: 'right' });
    }
  }

  onProgress?.('Done!');
  return doc.output('blob');
}
