import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Data Structures
export interface PatientAccount {
  id?: string;
  user_id?: string;
  first_name: string | null;
  middle_name?: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender?: string | null;
  phone_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  blood_type?: string | null;
  height_inches?: number | null;
  weight_pounds?: number | null;
  primary_care_physician?: string | null;
  email?: string | null;
}

export interface Medication {
  id?: string;
  medication_name: string;
  dosage?: string | null;
  frequency?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  prescribing_doctor?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface Condition {
  id?: string;
  condition_name: string;
  diagnosis_date?: string | null;
  severity?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface Allergy {
  id?: string;
  allergen?: string | null;
  allergen_name?: string | null;
  reaction?: string | null;
  reaction_type?: string | null;
  severity?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface Vital {
  id?: string;
  recorded_date?: string;
  date_recorded?: string;
  height_inches?: number | null;
  weight_pounds?: number | null;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  heart_rate?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  respiratory_rate?: number | null;
  oxygen_saturation?: number | null;
  blood_glucose?: number | null;
}

export interface Immunization {
  id?: string;
  vaccine_name: string;
  date_administered?: string | null;
  provider?: string | null;
  notes?: string | null;
}

export interface Surgery {
  id?: string;
  procedure_name?: string;
  surgery_type?: string;
  surgery_date?: string | null;
  surgeon?: string | null;
  surgeon_name?: string | null;
  hospital?: string | null;
  notes?: string | null;
}

export interface Pharmacy {
  id?: string;
  pharmacy_name: string;
  phone_number?: string | null;
  address?: string | null;
  is_preferred?: boolean;
}

export interface EmergencyContact {
  id?: string;
  contact_name?: string;
  name?: string;
  relationship?: string | null;
  phone_number?: string | null;
  phone?: string | null;
  email?: string | null;
}

// Utility Functions
const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const calculateBMI = (heightInches?: number, weightPounds?: number): number | null => {
  if (!heightInches || !weightPounds) return null;
  return (weightPounds / (heightInches * heightInches)) * 703;
};

const hasVitalData = (vital: Vital): boolean => {
  return !!(
    vital.height_inches ||
    vital.weight_pounds ||
    vital.blood_pressure_systolic ||
    vital.heart_rate ||
    vital.pulse ||
    vital.temperature ||
    vital.oxygen_saturation
  );
};

// PDF Generation Function
export const generateMedicalVaultPDF = async (
  patient: PatientAccount,
  medications: Medication[],
  conditions: Condition[],
  allergies: Allergy[],
  vitals: Vital[],
  immunizations: Immunization[],
  surgeries: Surgery[],
  pharmacies: Pharmacy[],
  emergencyContacts: EmergencyContact[]
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
    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    doc.text(`MEDICAL RECORD - ${fullName.toUpperCase()}`, pageWidth / 2, 14, { align: 'center' });
    
    // Draw professional shield/lock icon (centered under title)
    const iconX = pageWidth / 2;
    const iconY = 20;
    const iconScale = 5;
    
    // Shield shape using simple shapes
    doc.setFillColor(218, 165, 32); // Gold
    
    // Top triangle of shield
    const shieldTop = iconY - iconScale * 0.7;
    const shieldBottom = iconY + iconScale * 0.6;
    const shieldWidth = iconScale * 0.9;
    
    // Draw shield body as a rounded rectangle with pointed bottom
    doc.roundedRect(
      iconX - shieldWidth/2, 
      shieldTop, 
      shieldWidth, 
      (shieldBottom - shieldTop) * 0.7, 
      iconScale * 0.15, 
      iconScale * 0.15, 
      'F'
    );
    
    // Bottom triangle for pointed shield
    const triangleTop = shieldTop + (shieldBottom - shieldTop) * 0.6;
    // Left side of triangle
    doc.setLineWidth(0);
    for (let i = 0; i < shieldWidth/2; i += 0.5) {
      doc.line(
        iconX - shieldWidth/2 + i, 
        triangleTop + i * 0.5,
        iconX - shieldWidth/2 + i + 0.5, 
        triangleTop + (i + 0.5) * 0.5
      );
    }
    // Right side of triangle
    for (let i = 0; i < shieldWidth/2; i += 0.5) {
      doc.line(
        iconX + i, 
        triangleTop + (shieldWidth/2 - i) * 0.5,
        iconX + i + 0.5, 
        triangleTop + (shieldWidth/2 - i - 0.5) * 0.5
      );
    }
    
    // Lock symbol inside shield - clean and crisp
    doc.setFillColor(55, 65, 81); // Dark grey
    doc.setDrawColor(55, 65, 81);
    
    const lockBodyWidth = iconScale * 0.35;
    const lockBodyHeight = iconScale * 0.3;
    const lockCenterY = iconY + iconScale * 0.05;
    
    // Lock shackle (top arc) using semicircle
    const shackleRadius = lockBodyWidth * 0.38;
    const shackleTop = lockCenterY - lockBodyHeight * 0.45;
    
    // Draw shackle with thick lines
    doc.setLineWidth(1.2);
    // Left side of shackle
    doc.line(iconX - shackleRadius, lockCenterY - lockBodyHeight * 0.2, iconX - shackleRadius, shackleTop + shackleRadius);
    // Top arc of shackle (approximate with small segments)
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
    // Right side of shackle
    doc.line(iconX + shackleRadius, lockCenterY - lockBodyHeight * 0.2, iconX + shackleRadius, shackleTop + shackleRadius);
    
    // Lock body - smooth rounded rectangle
    doc.roundedRect(
      iconX - lockBodyWidth / 2, 
      lockCenterY - lockBodyHeight * 0.2, 
      lockBodyWidth, 
      lockBodyHeight, 
      1, 
      1, 
      'F'
    );
    
    // Keyhole - clean and prominent
    doc.setFillColor(218, 165, 32); // Gold keyhole for contrast
    // Top circle of keyhole
    doc.circle(iconX, lockCenterY + lockBodyHeight * 0.05, iconScale * 0.055, 'F');
    // Bottom slot of keyhole
    doc.rect(
      iconX - iconScale * 0.03, 
      lockCenterY + lockBodyHeight * 0.05, 
      iconScale * 0.06, 
      lockBodyHeight * 0.3, 
      'F'
    );
    
    // VitaLuxe branding in light grey
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('VitaLuxe Services', pageWidth / 2, 34, { align: 'center' });
    
    return 50; // Space after header
  };

  // Helper to check if we need a page break before adding content
  const checkPageBreak = (currentY: number, minSpaceNeeded: number = 30): number => {
    if (currentY + minSpaceNeeded > pageHeight - 20) {
      doc.addPage();
      addHeader();
      return 50; // Start after header
    }
    return currentY;
  };

  // Section Title Helper with gold divider line
  const addSectionTitle = (title: string, currentY: number): number => {
    // Check if we need a page break before adding section
    currentY = checkPageBreak(currentY, 30);
    
    doc.setTextColor(218, 165, 32); // Gold
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, currentY, { align: 'center' });
    
    // Add subtle gold divider line below title
    const lineWidth = pageWidth * 0.8;
    const lineX = (pageWidth - lineWidth) / 2;
    doc.setDrawColor(218, 165, 32);
    doc.setLineWidth(0.3);
    doc.line(lineX, currentY + 2, lineX + lineWidth, currentY + 2);
    
    return currentY + 10;
  };

  // Footer with Timestamp and Page Numbers
  const addFooter = (pageNum: number, totalPages: number) => {
    const currentDate = new Date();
    const timestamp = `Downloaded: ${currentDate.toLocaleString('en-US', { 
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
    
    // Page number on left
    doc.text(`Page ${pageNum} of ${totalPages}`, 15, pageHeight - 10, { align: 'left' });
    
    // Timestamp on right
    doc.text(timestamp, pageWidth - 15, pageHeight - 10, { align: 'right' });
  };

  yPos = addHeader();

  // Patient Demographics Section
  yPos = addSectionTitle('PATIENT DEMOGRAPHICS', yPos);
  
  const demographicsData = [
    ['Name', `${patient.first_name || ''} ${patient.middle_name || ''} ${patient.last_name || ''}`.trim()],
    ['Date of Birth', patient.date_of_birth ? `${new Date(patient.date_of_birth).toLocaleDateString()} (Age: ${calculateAge(patient.date_of_birth)} years)` : 'N/A'],
    ['Gender', patient.gender || 'N/A'],
    ['Phone', patient.phone_number || 'N/A'],
    ['Email', patient.email || 'N/A'],
    ['Address', [patient.address_line1, patient.address_line2, `${patient.city || ''}, ${patient.state || ''} ${patient.zip_code || ''}`.trim()].filter(Boolean).join(', ') || 'N/A'],
    ['Blood Type', patient.blood_type || 'N/A'],
    ['Primary Care Physician', patient.primary_care_physician || 'N/A'],
  ];

  autoTable(doc, {
    startY: yPos,
    body: demographicsData,
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

  // MEDICATIONS Section
  if (medications.length > 0) {
    yPos = addSectionTitle('MEDICATIONS', yPos);
    
    const medicationsData = medications.map(med => [
      med.medication_name,
      med.dosage || 'N/A',
      med.frequency || 'N/A',
      med.start_date ? new Date(med.start_date).toLocaleDateString() : 'N/A',
      med.is_active ? 'Active' : 'Inactive',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Medication', 'Dosage', 'Frequency', 'Start Date', 'Status']],
      body: medicationsData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // CONDITIONS Section
  if (conditions.length > 0) {
    yPos = addSectionTitle('MEDICAL CONDITIONS', yPos);
    
    const conditionsData = conditions.map(cond => [
      cond.condition_name,
      cond.diagnosis_date ? new Date(cond.diagnosis_date).toLocaleDateString() : 'N/A',
      cond.severity || 'N/A',
      cond.is_active ? 'Active' : 'Inactive',
      cond.notes || '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Condition', 'Diagnosis Date', 'Severity', 'Status', 'Notes']],
      body: conditionsData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 53 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // ALLERGIES Section
  if (allergies.length > 0) {
    yPos = addSectionTitle('ALLERGIES', yPos);
    
    const allergiesData = allergies.map(allergy => [
      allergy.allergen || allergy.allergen_name || 'Unknown',
      allergy.reaction || allergy.reaction_type || 'N/A',
      allergy.severity || 'N/A',
      (allergy as any).is_active !== undefined ? ((allergy as any).is_active ? 'Active' : 'Inactive') : 'Active',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Allergen', 'Reaction', 'Severity', 'Status']],
      body: allergiesData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 60 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // VITAL SIGNS Section
  const latestVital = vitals.find(v => hasVitalData(v));
  if (latestVital) {
    yPos = addSectionTitle('VITAL SIGNS', yPos);
    
    const height = latestVital.height_inches ? `${Math.floor(latestVital.height_inches / 12)}'${latestVital.height_inches % 12}"` : 'N/A';
    const weight = latestVital.weight_pounds ? `${latestVital.weight_pounds} lbs` : 'N/A';
    const bmi = calculateBMI(latestVital.height_inches || undefined, latestVital.weight_pounds || undefined);
    const bp = (latestVital.blood_pressure_systolic && latestVital.blood_pressure_diastolic) 
      ? `${latestVital.blood_pressure_systolic}/${latestVital.blood_pressure_diastolic} mmHg` 
      : 'N/A';
    const pulse = (latestVital.heart_rate || latestVital.pulse) ? `${latestVital.heart_rate || latestVital.pulse} bpm` : 'N/A';
    const temp = latestVital.temperature ? `${latestVital.temperature}°F` : 'N/A';
    const o2 = latestVital.oxygen_saturation ? `${latestVital.oxygen_saturation}%` : 'N/A';
    const resp = latestVital.respiratory_rate ? `${latestVital.respiratory_rate} /min` : 'N/A';

    const vitalsData = [
      ['Height', height],
      ['Weight', weight],
      ['BMI', bmi ? bmi.toFixed(1) : 'N/A'],
      ['Blood Pressure', bp],
      ['Pulse', pulse],
      ['Temperature', temp],
      ['O2 Saturation', o2],
      ['Respiratory Rate', resp],
    ];

    autoTable(doc, {
      startY: yPos,
      body: vitalsData,
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
  }

  // IMMUNIZATIONS Section
  if (immunizations.length > 0) {
    yPos = addSectionTitle('IMMUNIZATIONS', yPos);
    
    const immunizationsData = immunizations.map(imm => [
      imm.vaccine_name,
      imm.date_administered ? new Date(imm.date_administered).toLocaleDateString() : 'N/A',
      imm.provider || 'N/A',
      imm.notes || '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Vaccine', 'Date Administered', 'Provider', 'Notes']],
      body: immunizationsData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { cellWidth: 45 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // SURGERIES Section
  if (surgeries.length > 0) {
    yPos = addSectionTitle('SURGICAL HISTORY', yPos);
    
    const surgeriesData = surgeries.map(surgery => [
      surgery.procedure_name || surgery.surgery_type || 'Unknown',
      surgery.surgery_date ? new Date(surgery.surgery_date).toLocaleDateString() : 'N/A',
      surgery.surgeon || surgery.surgeon_name || 'N/A',
      surgery.hospital || 'N/A',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Procedure', 'Date', 'Surgeon', 'Hospital']],
      body: surgeriesData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 50 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // PHARMACIES Section
  if (pharmacies.length > 0) {
    yPos = addSectionTitle('PREFERRED PHARMACIES', yPos);
    
    const pharmaciesData = pharmacies.map(pharm => [
      pharm.pharmacy_name,
      pharm.phone_number || 'N/A',
      pharm.address || 'N/A',
      pharm.is_preferred ? 'Yes' : 'No',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Pharmacy Name', 'Phone', 'Address', 'Preferred']],
      body: pharmaciesData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 35 },
        2: { cellWidth: 60 },
        3: { cellWidth: 25 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // EMERGENCY CONTACTS Section
  if (emergencyContacts.length > 0) {
    yPos = addSectionTitle('EMERGENCY CONTACTS', yPos);
    
    const contactsData = emergencyContacts.map(contact => [
      contact.contact_name || contact.name || 'Unknown',
      contact.relationship || 'N/A',
      contact.phone_number || contact.phone || 'N/A',
      contact.email || 'N/A',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Name', 'Relationship', 'Phone', 'Email']],
      body: contactsData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249],
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 55 },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Add footer with page numbers and timestamp to all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  return doc.output('blob');
};
