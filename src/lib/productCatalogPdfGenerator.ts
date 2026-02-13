/**
 * Product Catalog PDF Generator
 * Sleek modern catalog — no TOC, category pill inside cards
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

// ── Colors ──
const BLACK: [number, number, number] = [0, 0, 0];
const GOLD: [number, number, number] = [218, 165, 32];
const WHITE: [number, number, number] = [255, 255, 255];
const MID_GREY: [number, number, number] = [150, 150, 150];
const DARK_BG: [number, number, number] = [35, 35, 35];
const SHADOW_GREY: [number, number, number] = [220, 220, 220];

// ── Layout constants (mm) ──
const MARGIN = 12;
const CARD_W = 90;
const CARD_H = 88;
const COL_GAP = 6;
const ROW_GAP = 3;
const IMG_SIZE = 46;
const FOOTER_H = 14;
const CARDS_PER_PAGE = 6; // 3 rows x 2 cols

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

async function fetchAllProducts(): Promise<CatalogProduct[]> {
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

  const result: CatalogProduct[] = [];
  for (const p of (products || [])) {
    const category = (p.product_types as any)?.name || 'Uncategorized';
    result.push({
      id: p.id, name: p.name, image_url: p.image_url, dosage_form: p.dosage_form,
      category, variants: variantMap.get(p.id) || [],
    });
  }

  // Sort alphabetically by name
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function fmt(value: number | null): string {
  if (value == null) return 'N/A';
  return `$${value.toFixed(2)}`;
}

// ── Card renderer (modern minimal) ──

function drawCard(
  doc: jsPDF,
  product: CatalogProduct,
  imgBase64: string | null,
  x: number,
  y: number
) {
  // Shadow effect — subtle offset rectangle
  doc.setFillColor(...SHADOW_GREY);
  doc.roundedRect(x + 1.5, y + 1.5, CARD_W, CARD_H, 1.5, 1.5, 'F');

  // Card background
  doc.setFillColor(...WHITE);
  doc.roundedRect(x, y, CARD_W, CARD_H, 1.5, 1.5, 'F');

  // Thin border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, CARD_W, CARD_H, 1.5, 1.5, 'S');

  // Category pill — top-left
  const pillText = product.category.toUpperCase();
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  const pillW = Math.min(doc.getTextWidth(pillText) + 5, CARD_W - 8);
  const pillH = 4.5;
  const pillX = x + 3;
  const pillY = y + 3;
  doc.setFillColor(...DARK_BG);
  doc.roundedRect(pillX, pillY, pillW, pillH, 1.2, 1.2, 'F');
  doc.setTextColor(...GOLD);
  doc.text(pillText, pillX + pillW / 2, pillY + 3.2, { align: 'center' });

  // Product image — centered, no background box
  const imgX = x + (CARD_W - IMG_SIZE) / 2;
  const imgY = y + 9;

  if (imgBase64) {
    try {
      doc.addImage(imgBase64, 'PNG', imgX + 2, imgY + 2, IMG_SIZE - 4, IMG_SIZE - 4);
    } catch { /* skip */ }
  } else {
    // Placeholder circle
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.circle(x + CARD_W / 2, imgY + IMG_SIZE / 2, 10, 'S');
  }

  let textY = imgY + IMG_SIZE + 3;

  // Product name — 11pt bold
  doc.setTextColor(...BLACK);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  let displayName = product.name;
  const maxNameWidth = CARD_W - 8;
  while (doc.getTextWidth(displayName) > maxNameWidth && displayName.length > 10) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== product.name) displayName += '…';
  doc.text(displayName, x + CARD_W / 2, textY, { align: 'center' });
  textY += 3.5;

  // Dosage form — 7pt grey
  if (product.dosage_form) {
    doc.setTextColor(...MID_GREY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(product.dosage_form, x + CARD_W / 2, textY, { align: 'center' });
    textY += 3;
  } else {
    textY += 2;
  }

  // Thin gold hairline
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(x + 8, textY, x + CARD_W - 8, textY);
  textY += 3;

  // Pricing area
  if (product.variants.length === 0) {
    doc.setTextColor(...MID_GREY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Contact for pricing', x + CARD_W / 2, textY, { align: 'center' });
  } else if (product.variants.length === 1) {
    doc.setTextColor(...BLACK);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(product.variants[0].retail_price), x + CARD_W / 2, textY + 1, { align: 'center' });
  } else {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const maxLines = 5;
    const variants = product.variants.slice(0, maxLines);
    for (const v of variants) {
      if (textY > y + CARD_H - 3) break; // safety: don't overflow
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
      textY += 3.5;
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
  const allProducts = await fetchAllProducts();

  onProgress?.('Loading logo...');
  const logoBase64 = await fetchLogo();

  onProgress?.('Loading product images...');
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
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let coverY = 25;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'AUTO', (pageWidth - 130) / 2, coverY, 130, 50);
      coverY += 60;
    } catch { coverY += 10; }
  }

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(pageWidth * 0.15, coverY, pageWidth * 0.85, coverY);
  coverY += 18;

  doc.setTextColor(...GOLD);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUCT CATALOG', pageWidth / 2, coverY, { align: 'center' });
  coverY += 18;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(pageWidth * 0.25, coverY, pageWidth * 0.75, coverY);
  coverY += 28;

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

  // ── PRODUCT PAGES — 6 per page (3 rows x 2 cols), alphabetical ──
  const col1X = MARGIN;
  const col2X = MARGIN + CARD_W + COL_GAP;
  const gridTopY = MARGIN + 2;

  for (let i = 0; i < allProducts.length; i++) {
    const indexOnPage = i % CARDS_PER_PAGE;

    if (indexOnPage === 0) {
      doc.addPage();
    }

    const col = indexOnPage % 2;
    const row = Math.floor(indexOnPage / 2);
    const cardX = col === 0 ? col1X : col2X;
    const cardY = gridTopY + row * (CARD_H + ROW_GAP);

    drawCard(doc, allProducts[i], imageMap.get(allProducts[i].id) || null, cardX, cardY);
  }

  // ── Footers ──
  const totalPages = getTotalPages(doc);
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, i, totalPages, pageWidth, pageHeight);
  }

  onProgress?.('Done!');
  return doc.output('blob');
}
