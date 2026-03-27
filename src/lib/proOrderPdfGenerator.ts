import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ProOrderPdfData {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  shipToAddress: {
    street?: string;
    suite?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  orderDate: string;
  lineItems: {
    name: string;
    price: number;
    quantity: number;
    total: number;
  }[];
  subtotal: number;
  shipping: number;
  total: number;
}

export function generateProOrderPdf(data: ProOrderPdfData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Professional Use Peptides", pageWidth / 2, 50, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Order Form", pageWidth / 2, 70, { align: "center" });

  // Contact info section
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  const infoY = 100;
  const col1 = margin;
  const col2 = 220;
  const col3 = 400;

  doc.setFont("helvetica", "bold");
  doc.text("Contact Name:", col1, infoY);
  doc.setFont("helvetica", "normal");
  doc.text(data.contactName || "", col1 + 80, infoY);

  doc.setFont("helvetica", "bold");
  doc.text("Contact Email:", col2, infoY);
  doc.setFont("helvetica", "normal");
  doc.text(data.contactEmail || "", col2 + 80, infoY);

  doc.setFont("helvetica", "bold");
  doc.text("Contact Phone:", col3, infoY);
  doc.setFont("helvetica", "normal");
  doc.text(data.contactPhone || "", col3 + 80, infoY);

  const addrY = infoY + 20;
  doc.setFont("helvetica", "bold");
  doc.text("Ship to Address:", col1, addrY);
  doc.setFont("helvetica", "normal");
  const addrParts = [
    data.shipToAddress.street,
    data.shipToAddress.suite,
  ].filter(Boolean).join(", ");
  doc.text(addrParts || "", col1 + 90, addrY);

  const cityY = addrY + 20;
  doc.setFont("helvetica", "bold");
  doc.text("City:", col1, cityY);
  doc.setFont("helvetica", "normal");
  doc.text(data.shipToAddress.city || "", col1 + 30, cityY);

  doc.setFont("helvetica", "bold");
  doc.text("State:", col2, cityY);
  doc.setFont("helvetica", "normal");
  doc.text(data.shipToAddress.state || "", col2 + 35, cityY);

  doc.setFont("helvetica", "bold");
  doc.text("Order Date:", col3, cityY);
  doc.setFont("helvetica", "normal");
  doc.text(data.orderDate, col3 + 60, cityY);

  // Product table
  const tableData = data.lineItems.map((item) => [
    item.name,
    `$${item.price.toLocaleString()}`,
    item.quantity.toString(),
    `$${item.total.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: cityY + 25,
    head: [["Product", "Price", "Qty", "Total"]],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 220 },
      1: { cellWidth: 80, halign: "right" },
      2: { cellWidth: 60, halign: "center" },
      3: { cellWidth: 100, halign: "right" },
    },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const totalsX = pageWidth - margin - 100;
  const labelsX = totalsX - 80;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal", labelsX, finalY);
  doc.text(`$${data.subtotal.toLocaleString()}`, totalsX + 100, finalY, { align: "right" });

  doc.text("Shipping", labelsX, finalY + 18);
  doc.text(`$${data.shipping.toLocaleString()}`, totalsX + 100, finalY + 18, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", labelsX, finalY + 40);
  doc.text(`$${data.total.toLocaleString()}`, totalsX + 100, finalY + 40, { align: "right" });

  // Footer note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "*A 4% processing fee applies to credit card payments.",
    margin,
    finalY + 65
  );

  return doc;
}

export function proOrderPdfToBase64(doc: jsPDF): string {
  return doc.output("datauristring").split(",")[1];
}
