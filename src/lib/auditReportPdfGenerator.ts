import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AuditLog } from '@/hooks/useAuditLogs';

export const generateAuditReportPDF = async (
  patientName: string,
  auditLogs: AuditLog[]
): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 10;

  // Professional Header with Colors
  const addHeader = () => {
    // Dark grey header background
    doc.setFillColor(55, 65, 81);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Main title in gold
    doc.setTextColor(218, 165, 32);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`MEDICAL VAULT AUDIT LOG - ${patientName.toUpperCase()}`, pageWidth / 2, 14, { align: 'center' });
    
    // Draw professional shield/lock icon
    const iconX = pageWidth / 2;
    const iconY = 20;
    const iconScale = 5;
    
    doc.setFillColor(218, 165, 32); // Gold
    
    const shieldTop = iconY - iconScale * 0.7;
    const shieldBottom = iconY + iconScale * 0.6;
    const shieldWidth = iconScale * 0.9;
    
    doc.roundedRect(
      iconX - shieldWidth/2, 
      shieldTop, 
      shieldWidth, 
      (shieldBottom - shieldTop) * 0.7, 
      iconScale * 0.15, 
      iconScale * 0.15, 
      'F'
    );
    
    const triangleTop = shieldTop + (shieldBottom - shieldTop) * 0.6;
    for (let i = 0; i < shieldWidth/2; i += 0.5) {
      doc.line(
        iconX - shieldWidth/2 + i, 
        triangleTop + i * 0.5,
        iconX - shieldWidth/2 + i + 0.5, 
        triangleTop + (i + 0.5) * 0.5
      );
    }
    for (let i = 0; i < shieldWidth/2; i += 0.5) {
      doc.line(
        iconX + i, 
        triangleTop + (shieldWidth/2 - i) * 0.5,
        iconX + i + 0.5, 
        triangleTop + (shieldWidth/2 - i - 0.5) * 0.5
      );
    }
    
    doc.setFillColor(55, 65, 81); // Dark grey
    doc.setDrawColor(55, 65, 81);
    
    const lockBodyWidth = iconScale * 0.35;
    const lockBodyHeight = iconScale * 0.3;
    const lockCenterY = iconY + iconScale * 0.05;
    
    const shackleRadius = lockBodyWidth * 0.38;
    const shackleTop = lockCenterY - lockBodyHeight * 0.45;
    
    doc.setLineWidth(1.2);
    doc.line(iconX - shackleRadius, lockCenterY - lockBodyHeight * 0.2, iconX - shackleRadius, shackleTop + shackleRadius);
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      const angle1 = Math.PI + (i * Math.PI / segments);
      const angle2 = Math.PI + ((i + 1) * Math.PI / segments);
      doc.line(
        iconX + Math.cos(angle1) * shackleRadius,
        shackleTop + shackleRadius + Math.sin(angle1) * shackleRadius,
        iconX + Math.cos(angle2) * shackleRadius,
        shackleTop + shackleRadius + Math.sin(angle2) * shackleRadius
      );
    }
    doc.line(iconX + shackleRadius, lockCenterY - lockBodyHeight * 0.2, iconX + shackleRadius, shackleTop + shackleRadius);
    
    doc.roundedRect(
      iconX - lockBodyWidth / 2, 
      lockCenterY - lockBodyHeight * 0.2, 
      lockBodyWidth, 
      lockBodyHeight, 
      1, 
      1, 
      'F'
    );
    
    doc.setFillColor(218, 165, 32);
    doc.circle(iconX, lockCenterY + lockBodyHeight * 0.05, iconScale * 0.055, 'F');
    doc.rect(
      iconX - iconScale * 0.03, 
      lockCenterY + lockBodyHeight * 0.05, 
      iconScale * 0.06, 
      lockBodyHeight * 0.3, 
      'F'
    );
    
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('VitaLuxe Services', pageWidth / 2, 34, { align: 'center' });
    
    return 50;
  };

  const checkPageBreak = (currentY: number, minSpaceNeeded: number = 30): number => {
    if (currentY + minSpaceNeeded > pageHeight - 20) {
      doc.addPage();
      addHeader();
      return 50;
    }
    return currentY;
  };

  const addSectionTitle = (title: string, currentY: number): number => {
    currentY = checkPageBreak(currentY, 30);
    
    doc.setTextColor(218, 165, 32);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, currentY, { align: 'center' });
    
    const lineWidth = pageWidth * 0.8;
    const lineX = (pageWidth - lineWidth) / 2;
    doc.setDrawColor(218, 165, 32);
    doc.setLineWidth(0.3);
    doc.line(lineX, currentY + 2, lineX + lineWidth, currentY + 2);
    
    return currentY + 10;
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    const currentDate = new Date();
    const timestamp = `Generated: ${currentDate.toLocaleString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })}`;
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Page ${pageNum} of ${totalPages}`, 15, pageHeight - 10, { align: 'left' });
    doc.text(timestamp, pageWidth - 15, pageHeight - 10, { align: 'right' });
  };

  yPos = addHeader();

  // Summary Section
  yPos = addSectionTitle('AUDIT LOG SUMMARY', yPos);
  
  const summaryData = [
    ['Total Entries', auditLogs.length.toString()],
    ['Date Range', auditLogs.length > 0 
      ? `${new Date(auditLogs[auditLogs.length - 1].created_at).toLocaleDateString()} - ${new Date(auditLogs[0].created_at).toLocaleDateString()}`
      : 'N/A'
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    theme: 'grid',
    bodyStyles: {
      fontSize: 8,
      textColor: [0, 0, 0],
    },
    alternateRowStyles: {
      fillColor: [249, 249, 249],
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [245, 245, 245] },
      1: { cellWidth: 'auto' },
    },
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    margin: { left: 10, right: 10 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Audit Entries Section
  if (auditLogs.length > 0) {
    yPos = addSectionTitle('AUDIT ENTRIES', yPos);
    
    const getEntityTypeDisplay = (entityType: string) => {
      const mapping: Record<string, string> = {
        medication: 'Medication',
        condition: 'Condition',
        allergy: 'Allergy',
        vital: 'Vital',
        immunization: 'Immunization',
        surgery: 'Surgery',
        pharmacy: 'Pharmacy',
        emergency_contact: 'Emergency Contact',
        demographics: 'Demographics',
        pre_intake_form: 'Pre-Intake',
      };
      return mapping[entityType] || entityType;
    };

    const auditData = auditLogs.map(log => [
      new Date(log.created_at).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
      log.action_type.replace('_', ' ').toUpperCase(),
      getEntityTypeDisplay(log.entity_type),
      log.entity_name || 'N/A',
      log.changed_by_role ? log.changed_by_role.charAt(0).toUpperCase() + log.changed_by_role.slice(1) : 'System',
      log.change_summary || '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date & Time', 'Action', 'Type', 'Item', 'Changed By', 'Summary']],
      body: auditData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 20 },
        2: { cellWidth: 24 },
        3: { cellWidth: 30 },
        4: { cellWidth: 20 },
        5: { cellWidth: 44 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });
  }

  // Add footers to all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  return doc.output('blob');
};
