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
    doc.setFillColor(31, 41, 55); // Dark blue
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(218, 165, 32); // Gold
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    doc.text(`MEDICAL RECORD - ${fullName.toUpperCase()}`, pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('VitaLuxe Services', pageWidth / 2, 20, { align: 'center' });
    
    return 35;
  };

  yPos = addHeader();

  // Patient Demographics Table
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
    head: [['PATIENT DEMOGRAPHICS', '']],
    body: demographicsData,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'left',
    },
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

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // MEDICATIONS Table
  if (medications.length > 0) {
    const medicationsData = medications.map(med => [
      med.medication_name,
      med.dosage || 'N/A',
      med.frequency || 'N/A',
      med.start_date ? new Date(med.start_date).toLocaleDateString() : 'N/A',
      med.is_active ? 'Active' : 'Inactive',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['MEDICATIONS', '', '', '', '']],
      body: medicationsData,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'left',
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

    // Add column headers
    const startY = yPos;
    autoTable(doc, {
      startY: startY,
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // CONDITIONS Table
  if (conditions.length > 0) {
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // ALLERGIES Table
  if (allergies.length > 0) {
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // VITAL SIGNS Table
  const latestVital = vitals.find(v => hasVitalData(v));
  if (latestVital) {
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
      head: [['VITAL SIGNS', '']],
      body: vitalsData,
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
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // IMMUNIZATIONS Table
  if (immunizations.length > 0) {
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // SURGERIES Table
  if (surgeries.length > 0) {
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // PHARMACIES Table
  if (pharmacies.length > 0) {
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // EMERGENCY CONTACTS Table
  if (emergencyContacts.length > 0) {
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

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 10, pageHeight - 5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 5);
  }

  return doc.output('blob');
};
