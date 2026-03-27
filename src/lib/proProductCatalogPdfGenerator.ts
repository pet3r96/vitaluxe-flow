/**
 * Professional Use Products Catalog PDF Generator
 * Dark cover, gold accents, "PROFESSIONAL USE ONLY" branding
 * Cards: name + image + price + "Pack of 10"
 */

import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { getTotalPages } from '@/types/pdf';
import logoDarkBg from '@/assets/vitaluxe-logo-dark-bg.png';

interface ProProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
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
const HEADER_H = 10;
const CARDS_PER_PAGE = 6;

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
    return imageToBase64(logoDarkBg);
  } catch {
    return null;
  }
}

async function fetchProProducts(): Promise<ProProduct[]> {
  const { data, error } = await supabase
    .from('pro_products')
    .select('id, name, price, image_url')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image_url: p.image_url,
  }));
}

function fmt(value: number): string {
  return `$${value.toFixed(2)}`;
}

// ── Card renderer ──
function drawCard(
  doc: jsPDF,
  product: ProProduct,
  imgBase64: string | null,
  x: number,
  y: number
) {
  // Shadow
  doc.setFillColor(...SHADOW_GREY);
  doc.roundedRect(x + 1.5, y + 1.5, CARD_W, CARD_H, 1.5, 1.5, 'F');

  // Card background
  doc.setFillColor(...WHITE);
  doc.roundedRect(x, y, CARD_W, CARD_H, 1.5, 1.5, 'F');

  // Border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, CARD_W, CARD_H, 1.5, 1.5, 'S');

  // "PROFESSIONAL USE ONLY" pill — top-left
  const pillText = 'PROFESSIONAL USE ONLY';
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  const pillW = Math.min(doc.getTextWidth(pillText) + 5, CARD_W - 8);
  const pillH = 4.5;
  const pillX = x + 3;
  const pillY = y + 3;
  doc.setFillColor(...DARK_BG);
  doc.roundedRect(pillX, pillY, pillW, pillH, 1.2, 1.2, 'F');
  doc.setTextColor(...GOLD);
  doc.text(pillText, pillX + pillW / 2, pillY + 3.2, { align: 'center' });

  // Product image
  const imgX = x + (CARD_W - IMG_SIZE) / 2;
  const imgY = y + 9;

  if (imgBase64) {
    try {
      doc.addImage(imgBase64, 'PNG', imgX + 2, imgY + 2, IMG_SIZE - 4, IMG_SIZE - 4);
    } catch { /* skip */ }
  } else {
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.circle(x + CARD_W / 2, imgY + IMG_SIZE / 2, 10, 'S');
  }

  let textY = imgY + IMG_SIZE + 3;

  // Product name
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

  // "Pack of 10" label
  doc.setTextColor(...MID_GREY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Pack of 10', x + CARD_W / 2, textY, { align: 'center' });
  textY += 3;

  // Gold hairline
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(x + 8, textY, x + CARD_W - 8, textY);
  textY += 5;

  // Price
  doc.setTextColor(...BLACK);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(product.price), x + CARD_W / 2, textY, { align: 'center' });
}

function drawPageHeader(doc: jsPDF, pageWidth: number) {
  doc.setTextColor(...GOLD);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('FOR PROFESSIONAL USE ONLY', pageWidth / 2, MARGIN, { align: 'center' });
}

function drawFooter(doc: jsPDF, pageNum: number, totalPages: number, pageWidth: number, pageHeight: number) {
  const footerY = pageHeight - FOOTER_H;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, footerY, pageWidth - MARGIN, footerY);

  doc.setTextColor(...MID_GREY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('For Professional Use Only — Not for Patient Distribution', MARGIN, footerY + 5);
  doc.text('Vitaluxe Services', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - MARGIN, footerY + 5, { align: 'right' });
}

// ── Main export ──
export async function generateProProductCatalogPDF(
  onProgress?: (message: string) => void
): Promise<Blob> {
  onProgress?.('Fetching professional products...');
  const allProducts = await fetchProProducts();

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
      doc.addImage(logoBase64, 'AUTO', (pageWidth - 60) / 2, coverY, 60, 42);
      coverY += 55;
    } catch { coverY += 10; }
  }

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(pageWidth * 0.15, coverY, pageWidth * 0.85, coverY);
  coverY += 18;

  doc.setTextColor(...GOLD);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('PROFESSIONAL USE', pageWidth / 2, coverY, { align: 'center' });
  coverY += 12;
  doc.text('PRODUCTS', pageWidth / 2, coverY, { align: 'center' });
  coverY += 14;

  // "FOR PROFESSIONAL USE ONLY" subtitle
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...WHITE);
  doc.text('FOR PROFESSIONAL USE ONLY', pageWidth / 2, coverY, { align: 'center' });
  coverY += 5;
  doc.setFontSize(9);
  doc.setTextColor(...MID_GREY);
  doc.text('All pricing is per pack of 10 units', pageWidth / 2, coverY, { align: 'center' });
  coverY += 14;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(pageWidth * 0.25, coverY, pageWidth * 0.75, coverY);
  coverY += 20;

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

  // ── PRODUCT PAGES ──
  const col1X = MARGIN;
  const col2X = MARGIN + CARD_W + COL_GAP;
  const gridTopY = MARGIN + HEADER_H;

  for (let i = 0; i < allProducts.length; i++) {
    const indexOnPage = i % CARDS_PER_PAGE;
    if (indexOnPage === 0) doc.addPage();

    const col = indexOnPage % 2;
    const row = Math.floor(indexOnPage / 2);
    const cardX = col === 0 ? col1X : col2X;
    const cardY = gridTopY + row * (CARD_H + ROW_GAP);

    drawCard(doc, allProducts[i], imageMap.get(allProducts[i].id) || null, cardX, cardY);
  }

  // ── Headers & Footers ──
  const totalPages = getTotalPages(doc);
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageHeader(doc, pageWidth);
    drawFooter(doc, i, totalPages, pageWidth, pageHeight);
  }

  onProgress?.('Done!');
  return doc.output('blob');
}
