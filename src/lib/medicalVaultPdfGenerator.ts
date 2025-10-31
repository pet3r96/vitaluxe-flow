import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface PatientAccount {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  gender_at_birth?: string;
}

interface Medication {
  medication_name: string;
  dosage?: string;
  frequency?: string;
  start_date?: string;
  stop_date?: string;
  is_active: boolean;
  notes?: string;
}

interface Condition {
  condition_name: string;
  description?: string;
  severity?: string;
  date_diagnosed?: string;
  is_active: boolean;
}

interface Allergy {
  allergen_name: string;
  reaction_type?: string;
  severity?: string;
  notes?: string;
}

interface Vital {
  height_inches?: number;
  weight_pounds?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  pulse?: number;
  temperature?: number;
  oxygen_saturation?: number;
  cholesterol?: number;
  blood_sugar?: number;
  date_recorded: string;
}

interface Immunization {
  vaccine_name: string;
  date_administered?: string;
  provider_name?: string;
  lot_number?: string;
  notes?: string;
}

interface Surgery {
  surgery_type: string;
  surgery_date?: string;
  surgeon_name?: string;
  hospital_name?: string;
  complications?: string;
  notes?: string;
}

interface Pharmacy {
  pharmacy_name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  is_preferred: boolean;
}

interface EmergencyContact {
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  contact_order?: number;
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateBMI(heightInches?: number, weightPounds?: number): number | null {
  if (!heightInches || !weightPounds) return null;
  const bmi = (weightPounds / (heightInches * heightInches)) * 703;
  return Math.round(bmi * 10) / 10;
}

function hasVitalData(vital: Vital): boolean {
  return !!(
    vital.height_inches ||
    vital.weight_pounds ||
    vital.blood_pressure_systolic ||
    vital.blood_pressure_diastolic ||
    vital.pulse ||
    vital.temperature ||
    vital.oxygen_saturation ||
    vital.cholesterol ||
    vital.blood_sugar
  );
}

export async function generateMedicalVaultPDF(
  patientAccount: PatientAccount,
  medications: Medication[] = [],
  conditions: Condition[] = [],
  allergies: Allergy[] = [],
  vitals: Vital[] = [],
  immunizations: Immunization[] = [],
  surgeries: Surgery[] = [],
  pharmacies: Pharmacy[] = [],
  emergencyContacts: EmergencyContact[] = []
): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 0;

  // Medical color scheme - professional blues and grays
  const primaryBlue: [number, number, number] = [37, 99, 235]; // blue-600
  const lightBlue: [number, number, number] = [219, 234, 254]; // blue-100
  const darkGray: [number, number, number] = [31, 41, 55]; // gray-800
  const mediumGray: [number, number, number] = [107, 114, 128]; // gray-500

  // === HEADER SECTION ===
  // Professional medical document header
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // VitaLuxe Services branding
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('VITALUXE SERVICES', 14, 12);
  
  // Main title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MEDICAL RECORD', pageWidth / 2, 28, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprehensive Health Information', pageWidth / 2, 37, { align: 'center' });

  // Add spacing after header
  yPosition = 60;

  // === PATIENT INFORMATION BOX ===
  const age = calculateAge(patientAccount.date_of_birth);
  
  // Patient name box
  doc.setFillColor(...lightBlue);
  doc.rect(14, yPosition, pageWidth - 28, 18, 'F');
  
  doc.setTextColor(...darkGray);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${patientAccount.first_name} ${patientAccount.last_name}`, 20, yPosition + 8);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`DOB: ${format(new Date(patientAccount.date_of_birth), 'MMM dd, yyyy')} | Age: ${age} | Gender: ${patientAccount.gender_at_birth || 'Not specified'}`, 20, yPosition + 14);

  yPosition += 28;

  // === DEMOGRAPHICS SECTION ===
  addSectionHeader(doc, 'PATIENT DEMOGRAPHICS', yPosition);
  yPosition += 12;
  
  // Demographics in a clean table format
  const demographicsData = [];
  if (patientAccount.address && patientAccount.city) {
    demographicsData.push(['Address', `${patientAccount.address}, ${patientAccount.city}, ${patientAccount.state} ${patientAccount.zip_code}`]);
  }
  
  if (demographicsData.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      body: demographicsData,
      theme: 'plain',
      styles: { 
        fontSize: 10,
        cellPadding: 4,
        textColor: [31, 41, 55]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: 20, right: 20 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    yPosition += 5;
  }

  // Add generation timestamp
  doc.setFontSize(8);
  doc.setTextColor(...mediumGray);
  doc.text(`Document Generated: ${format(new Date(), 'MMMM dd, yyyy \'at\' h:mm a')}`, 20, yPosition);
  yPosition += 15;

  // === MEDICAL SECTIONS START ===
  
  // Filter for active medications
  const activeMeds = medications.filter(m => m.is_active && m.medication_name);
  
  if (activeMeds.length > 0) {
    checkPageBreak(doc, yPosition, 40);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'CURRENT MEDICATIONS', yPosition);
    yPosition += 12;
    
    const medData = activeMeds.map(m => [
      m.medication_name,
      m.dosage || '',
      m.frequency || '',
      m.start_date ? format(new Date(m.start_date), 'MMM yyyy') : ''
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Medication', 'Dosage', 'Frequency', 'Start Date']],
      body: medData,
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: { 
        fontSize: 9,
        cellPadding: 5
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Filter for active conditions
  const activeConditions = conditions.filter(c => c.is_active && c.condition_name);
  
  if (activeConditions.length > 0) {
    checkPageBreak(doc, yPosition, 40);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'MEDICAL CONDITIONS', yPosition);
    yPosition += 12;
    
    const condData = activeConditions.map(c => [
      c.condition_name,
      c.severity || '',
      c.date_diagnosed ? format(new Date(c.date_diagnosed), 'MMM yyyy') : '',
      c.description || ''
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Condition', 'Severity', 'Diagnosed', 'Notes']],
      body: condData,
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: { 
        fontSize: 9,
        cellPadding: 5
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Allergies Section
  if (allergies.length > 0) {
    checkPageBreak(doc, yPosition, 40);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'ALLERGIES', yPosition);
    yPosition += 12;
    
    const allergyData = allergies.map(a => [
      a.allergen_name,
      a.reaction_type || '',
      a.severity || '',
      a.notes || ''
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Allergen', 'Reaction', 'Severity', 'Notes']],
      body: allergyData,
      theme: 'grid',
      headStyles: { 
        fillColor: [220, 38, 38],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: { 
        fontSize: 9,
        cellPadding: 5
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Vitals Section - only if there's actual data
  const vitalsWithData = vitals.filter(v => hasVitalData(v));
  
  if (vitalsWithData.length > 0) {
    checkPageBreak(doc, yPosition, 60);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'VITAL SIGNS & BIOMETRICS', yPosition);
    yPosition += 12;
    
    const latestVital = vitalsWithData[0];
    const vitalInfo: string[][] = [];
    
    if (latestVital.height_inches) {
      const feet = Math.floor(latestVital.height_inches / 12);
      const inches = latestVital.height_inches % 12;
      vitalInfo.push(['Height', `${feet}'${inches}" (${latestVital.height_inches} inches)`]);
    }
    
    if (latestVital.weight_pounds) {
      vitalInfo.push(['Weight', `${latestVital.weight_pounds} lbs`]);
    }
    
    const bmi = calculateBMI(latestVital.height_inches, latestVital.weight_pounds);
    if (bmi) {
      vitalInfo.push(['BMI', `${bmi}`]);
    }
    
    if (latestVital.blood_pressure_systolic && latestVital.blood_pressure_diastolic) {
      vitalInfo.push(['Blood Pressure', `${latestVital.blood_pressure_systolic}/${latestVital.blood_pressure_diastolic} mmHg`]);
    }
    
    if (latestVital.pulse) {
      vitalInfo.push(['Heart Rate', `${latestVital.pulse} bpm`]);
    }
    
    if (latestVital.temperature) {
      vitalInfo.push(['Temperature', `${latestVital.temperature}°F`]);
    }
    
    if (latestVital.oxygen_saturation) {
      vitalInfo.push(['Oxygen Saturation', `${latestVital.oxygen_saturation}%`]);
    }
    
    if (latestVital.cholesterol) {
      vitalInfo.push(['Cholesterol', `${latestVital.cholesterol} mg/dL`]);
    }
    
    if (latestVital.blood_sugar) {
      vitalInfo.push(['Blood Sugar', `${latestVital.blood_sugar} mg/dL`]);
    }
    
    if (vitalInfo.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        body: vitalInfo,
        theme: 'striped',
        styles: { 
          fontSize: 10,
          cellPadding: 5
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: 20, right: 20 }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 5;
      
      doc.setFontSize(8);
      doc.setTextColor(...mediumGray);
      doc.text(`Last recorded: ${format(new Date(latestVital.date_recorded), 'MMM dd, yyyy')}`, 20, yPosition);
      yPosition += 15;
    }
  }

  // Immunizations Section
  if (immunizations.length > 0) {
    checkPageBreak(doc, yPosition, 40);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'IMMUNIZATION HISTORY', yPosition);
    yPosition += 12;
    
    const immunizationData = immunizations.map(i => [
      i.vaccine_name,
      i.date_administered ? format(new Date(i.date_administered), 'MMM dd, yyyy') : '',
      i.provider_name || ''
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Vaccine', 'Date Administered', 'Provider']],
      body: immunizationData,
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: { 
        fontSize: 9,
        cellPadding: 5
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Surgeries Section
  if (surgeries.length > 0) {
    checkPageBreak(doc, yPosition, 40);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'SURGICAL HISTORY', yPosition);
    yPosition += 12;
    
    const surgeryData = surgeries.map(s => [
      s.surgery_type,
      s.surgery_date ? format(new Date(s.surgery_date), 'MMM dd, yyyy') : '',
      s.surgeon_name || '',
      s.hospital_name || ''
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Procedure', 'Date', 'Surgeon', 'Hospital']],
      body: surgeryData,
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: { 
        fontSize: 9,
        cellPadding: 5
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Pharmacies Section
  if (pharmacies.length > 0) {
    checkPageBreak(doc, yPosition, 40);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'PHARMACY INFORMATION', yPosition);
    yPosition += 12;
    
    pharmacies.forEach((p, index) => {
      if (index > 0) yPosition += 8;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkGray);
      const name = p.is_preferred ? `${p.pharmacy_name} (PREFERRED)` : p.pharmacy_name;
      doc.text(name, 20, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (p.address) {
        doc.text(`${p.address}, ${p.city}, ${p.state} ${p.zip_code}`, 20, yPosition);
        yPosition += 5;
      }
      if (p.phone) {
        doc.text(`Phone: ${p.phone}`, 20, yPosition);
        yPosition += 5;
      }
    });
    yPosition += 10;
  }

  // Emergency Contacts Section
  if (emergencyContacts.length > 0) {
    checkPageBreak(doc, yPosition, 40);
    yPosition = getCurrentY(doc, yPosition);
    
    addSectionHeader(doc, 'EMERGENCY CONTACTS', yPosition);
    yPosition += 12;
    
    const contactData = emergencyContacts
      .sort((a, b) => (a.contact_order || 0) - (b.contact_order || 0))
      .map(c => [
        c.name,
        c.relationship || '',
        c.phone || '',
        c.email || ''
      ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Name', 'Relationship', 'Phone', 'Email']],
      body: contactData,
      theme: 'grid',
      headStyles: { 
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: { 
        fontSize: 9,
        cellPadding: 5
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Add footer to all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  return doc.output('blob');
}

function addSectionHeader(doc: jsPDF, title: string, yPosition: number) {
  doc.setFillColor(37, 99, 235);
  doc.rect(14, yPosition - 3, doc.internal.pageSize.getWidth() - 28, 8, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, 18, yPosition + 3);
}

function addFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Footer line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);
  
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  
  // Left side - VitaLuxe Services
  doc.text('VitaLuxe Services - Secure Medical Records', 14, pageHeight - 12);
  
  // Center - Generated date
  doc.text(
    `Generated: ${format(new Date(), 'MMM dd, yyyy')}`,
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );
  
  // Right side - Page number
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    pageWidth - 14,
    pageHeight - 12,
    { align: 'right' }
  );
}

function checkPageBreak(doc: jsPDF, yPosition: number, requiredSpace: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPosition + requiredSpace > pageHeight - 30) {
    doc.addPage();
    return 20;
  }
  return yPosition;
}

function getCurrentY(doc: jsPDF, yPosition: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPosition + 40 > pageHeight - 30) {
    return 20;
  }
  return yPosition;
}
