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
    
    // Draw lock icon manually (centered under title) - improved design
    const lockX = pageWidth / 2;
    const lockY = 18;
    const lockSize = 10;
    
    // Lock shackle (U-shape) - draw first, with thicker lines in gold
    doc.setLineWidth(3);
    doc.setDrawColor(218, 165, 32);
    const shackleWidth = lockSize * 0.7;
    const shackleHeight = lockSize * 0.7;
    // Draw thicker U-shape for shackle
    doc.line(lockX - shackleWidth/2, lockY, lockX - shackleWidth/2, lockY - shackleHeight);
    doc.line(lockX - shackleWidth/2, lockY - shackleHeight, lockX + shackleWidth/2, lockY - shackleHeight);
    doc.line(lockX + shackleWidth/2, lockY - shackleHeight, lockX + shackleWidth/2, lockY);
    
    // Lock body (rounded rectangle) in gold
    doc.setFillColor(218, 165, 32);
    doc.roundedRect(lockX - lockSize/2, lockY, lockSize, lockSize, 1.5, 1.5, 'F');
    
    // Keyhole in dark grey - larger and more visible
    doc.setFillColor(55, 65, 81);
    doc.circle(lockX, lockY + lockSize/3, lockSize/5, 'F');
    doc.rect(lockX - lockSize/10, lockY + lockSize/3, lockSize/5, lockSize/2.5, 'F');
    
    // VitaLuxe branding in light grey
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('VitaLuxe Services', pageWidth / 2, 34, { align: 'center' });
    
    return 50; // Space after header
  };

  // Section Title Helper
  const addSectionTitle = (title: string, currentY: number): number => {
    doc.setTextColor(218, 165, 32); // Gold
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, pageWidth / 2, currentY, { align: 'center' });
    return currentY + 8;
  };

  // Footer with Timestamp
  const addFooter = () => {
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
    doc.text(timestamp, pageWidth / 2, pageHeight - 10, { align: 'center' });
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
      0: { cellWidth: 50, fontStyle: 'bold' },
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
        fillColor: [240, 240, 240],
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
      cond.notes || '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Condition', 'Diagnosis Date', 'Severity', 'Notes']],
      body: conditionsData,
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
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
        2: { cellWidth: 25 },
        3: { cellWidth: 60 },
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
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Allergen', 'Reaction', 'Severity']],
      body: allergiesData,
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
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
        0: { cellWidth: 60 },
        1: { cellWidth: 70 },
        2: { cellWidth: 40 },
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
        0: { cellWidth: 50, fontStyle: 'bold' },
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
        fillColor: [240, 240, 240],
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
        fillColor: [240, 240, 240],
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
        fillColor: [240, 240, 240],
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
        fillColor: [240, 240, 240],
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

  // Add footer with timestamp to all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter();
  }

  return doc.output('blob');
};
