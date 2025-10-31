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

  // Color scheme matching the UI
  const headerGold: [number, number, number] = [251, 191, 36]; // yellow-400
  const darkBg: [number, number, number] = [31, 41, 55]; // gray-800
  const lightText: [number, number, number] = [255, 255, 255];
  const mediumGray: [number, number, number] = [107, 114, 128];

  // Section colors matching UI
  const blueGradient: [number, number, number] = [59, 130, 246]; // medications
  const redGradient: [number, number, number] = [239, 68, 68]; // conditions
  const orangeGradient: [number, number, number] = [249, 115, 22]; // allergies
  const greenGradient: [number, number, number] = [16, 185, 129]; // vitals
  const purpleGradient: [number, number, number] = [168, 85, 247]; // surgeries/immunizations
  const tealGradient: [number, number, number] = [20, 184, 166]; // pharmacies

  // === HEADER SECTION ===
  // Dark header with gold gradient text
  doc.setFillColor(31, 41, 55);
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  // Shield icon area (using circle as substitute)
  doc.setFillColor(...headerGold);
  doc.circle(pageWidth / 2, 18, 8, 'F');
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('✓', pageWidth / 2, 21, { align: 'center' });
  
  // Main title in gold
  doc.setTextColor(...headerGold);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${patientAccount.first_name} ${patientAccount.last_name} Secure Medical Vault`, pageWidth / 2, 35, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text('powered by VitaLuxe Services', pageWidth / 2, 45, { align: 'center' });

  yPosition = 70;

  // === DEMOGRAPHICS SECTION ===
  // Yellow/gold background box
  doc.setFillColor(180, 140, 30);
  doc.roundedRect(14, yPosition, pageWidth - 28, 35, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('👤 Demographics', 20, yPosition + 8);
  
  const age = calculateAge(patientAccount.date_of_birth);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Full Name: ${patientAccount.first_name} ${patientAccount.last_name}`, 20, yPosition + 16);
  doc.text(`Date of Birth: ${format(new Date(patientAccount.date_of_birth), 'MMM dd, yyyy')} (Age ${age})`, 20, yPosition + 23);
  
  if (patientAccount.address && patientAccount.city) {
    doc.text(`Address: ${patientAccount.address}, ${patientAccount.city}, ${patientAccount.state} ${patientAccount.zip_code}`, 20, yPosition + 30);
  }

  yPosition += 45;

  // === MEDICATIONS SECTION ===
  const activeMeds = medications.filter(m => m.is_active && m.medication_name);
  
  if (activeMeds.length > 0) {
    checkPageBreak(doc, yPosition, 50);
    yPosition = getCurrentY(doc, yPosition);
    
    // Blue gradient header
    addColorfulSectionHeader(doc, '💊 Medications', yPosition, blueGradient);
    yPosition += 12;
    
    activeMeds.forEach((med, index) => {
      if (index > 0) yPosition += 8;
      
      // Light blue background for each med
      doc.setFillColor(219, 234, 254);
      doc.roundedRect(20, yPosition, pageWidth - 40, 18, 2, 2, 'F');
      
      doc.setTextColor(...darkBg);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(med.medication_name, 25, yPosition + 6);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${med.dosage || ''} • ${med.frequency || ''}`, 25, yPosition + 12);
      
      if (med.start_date) {
        doc.setTextColor(...mediumGray);
        doc.text(`Started: ${format(new Date(med.start_date), 'MMM dd, yyyy')}`, 25, yPosition + 16);
      }
      
      // Active badge
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(pageWidth - 60, yPosition + 4, 35, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text('Active', pageWidth - 55, yPosition + 9);
      
      yPosition += 18;
    });
    yPosition += 10;
  }

  // === MEDICAL CONDITIONS SECTION ===
  const activeConditions = conditions.filter(c => c.is_active && c.condition_name);
  
  if (activeConditions.length > 0) {
    checkPageBreak(doc, yPosition, 50);
    yPosition = getCurrentY(doc, yPosition);
    
    // Red gradient header
    addColorfulSectionHeader(doc, '❤️ Medical Conditions', yPosition, redGradient);
    yPosition += 12;
    
    activeConditions.forEach((cond, index) => {
      if (index > 0) yPosition += 8;
      
      // Light red background
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(20, yPosition, pageWidth - 40, 20, 2, 2, 'F');
      
      doc.setTextColor(...darkBg);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(cond.condition_name, 25, yPosition + 6);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      if (cond.description) {
        doc.text(cond.description.substring(0, 50) + (cond.description.length > 50 ? '...' : ''), 25, yPosition + 12);
      }
      
      if (cond.date_diagnosed) {
        doc.setTextColor(...mediumGray);
        doc.text(`Diagnosed: ${format(new Date(cond.date_diagnosed), 'MMM dd, yyyy')}`, 25, yPosition + 17);
      }
      
      // Severity badge
      if (cond.severity) {
        const severityColor: [number, number, number] = cond.severity.toLowerCase() === 'severe' ? [220, 38, 38] : 
                             cond.severity.toLowerCase() === 'moderate' ? [249, 115, 22] : [34, 197, 94];
        doc.setFillColor(...severityColor);
        doc.roundedRect(pageWidth - 60, yPosition + 4, 35, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(cond.severity, pageWidth - 55, yPosition + 9);
      }
      
      yPosition += 20;
    });
    yPosition += 10;
  }

  // === ALLERGIES SECTION ===
  if (allergies.length > 0) {
    checkPageBreak(doc, yPosition, 50);
    yPosition = getCurrentY(doc, yPosition);
    
    // Orange gradient header
    addColorfulSectionHeader(doc, '⚠️ Allergies', yPosition, orangeGradient);
    yPosition += 12;
    
    allergies.forEach((allergy, index) => {
      if (index > 0) yPosition += 8;
      
      // Light orange background
      doc.setFillColor(255, 237, 213);
      doc.roundedRect(20, yPosition, pageWidth - 40, 16, 2, 2, 'F');
      
      doc.setTextColor(...darkBg);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(allergy.allergen_name, 25, yPosition + 6);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Reaction: ${allergy.reaction_type || 'Not specified'}`, 25, yPosition + 12);
      
      // Severity badge
      if (allergy.severity) {
        const severityColor: [number, number, number] = allergy.severity.toLowerCase() === 'severe' ? [220, 38, 38] : 
                             allergy.severity.toLowerCase() === 'moderate' ? [249, 115, 22] : [34, 197, 94];
        doc.setFillColor(...severityColor);
        doc.roundedRect(pageWidth - 60, yPosition + 3, 35, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(allergy.severity, pageWidth - 55, yPosition + 8);
      }
      
      yPosition += 16;
    });
    yPosition += 10;
  }

  // === VITALS SECTION ===
  const vitalsWithData = vitals.filter(v => hasVitalData(v));
  
  if (vitalsWithData.length > 0) {
    checkPageBreak(doc, yPosition, 70);
    yPosition = getCurrentY(doc, yPosition);
    
    // Green gradient header
    addColorfulSectionHeader(doc, '📊 Vitals / Biometrics', yPosition, greenGradient);
    yPosition += 12;
    
    const latestVital = vitalsWithData[0];
    
    // Quick Look box
    doc.setFillColor(209, 250, 229);
    doc.roundedRect(20, yPosition, pageWidth - 40, 50, 2, 2, 'F');
    
    doc.setTextColor(...darkBg);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Quick Look', 25, yPosition + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let vitalY = yPosition + 15;
    
    if (latestVital.height_inches) {
      const feet = Math.floor(latestVital.height_inches / 12);
      const inches = latestVital.height_inches % 12;
      doc.text(`Height: ${feet}'${inches}" (${latestVital.height_inches} in)`, 25, vitalY);
      vitalY += 6;
    }
    
    if (latestVital.weight_pounds) {
      doc.text(`Weight: ${latestVital.weight_pounds} lbs`, 25, vitalY);
      vitalY += 6;
    }
    
    const bmi = calculateBMI(latestVital.height_inches, latestVital.weight_pounds);
    if (bmi) {
      doc.text(`BMI: ${bmi} (Auto-calculated)`, 25, vitalY);
      vitalY += 6;
    }
    
    // Right column
    vitalY = yPosition + 15;
    const rightX = pageWidth / 2 + 10;
    
    if (latestVital.blood_pressure_systolic && latestVital.blood_pressure_diastolic) {
      doc.text(`Blood Pressure: ${latestVital.blood_pressure_systolic}/${latestVital.blood_pressure_diastolic}`, rightX, vitalY);
      vitalY += 6;
    }
    
    if (latestVital.pulse) {
      doc.text(`Pulse: ${latestVital.pulse} bpm`, rightX, vitalY);
      vitalY += 6;
    }
    
    if (latestVital.oxygen_saturation) {
      doc.text(`O2 Saturation: ${latestVital.oxygen_saturation}%`, rightX, vitalY);
    }
    
    yPosition += 55;
  }

  // === IMMUNIZATIONS SECTION ===
  if (immunizations.length > 0) {
    checkPageBreak(doc, yPosition, 50);
    yPosition = getCurrentY(doc, yPosition);
    
    addColorfulSectionHeader(doc, '💉 Immunizations', yPosition, purpleGradient);
    yPosition += 12;
    
    immunizations.slice(0, 5).forEach((imm, index) => {
      if (index > 0) yPosition += 8;
      
      doc.setFillColor(243, 232, 255);
      doc.roundedRect(20, yPosition, pageWidth - 40, 14, 2, 2, 'F');
      
      doc.setTextColor(...darkBg);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(imm.vaccine_name, 25, yPosition + 6);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      if (imm.date_administered) {
        doc.setTextColor(...mediumGray);
        doc.text(format(new Date(imm.date_administered), 'MMM dd, yyyy'), 25, yPosition + 11);
      }
      
      yPosition += 14;
    });
    yPosition += 10;
  }

  // === SURGERIES SECTION ===
  if (surgeries.length > 0) {
    checkPageBreak(doc, yPosition, 50);
    yPosition = getCurrentY(doc, yPosition);
    
    addColorfulSectionHeader(doc, '✂️ Surgeries', yPosition, purpleGradient);
    yPosition += 12;
    
    surgeries.forEach((surgery, index) => {
      if (index > 0) yPosition += 8;
      
      doc.setFillColor(243, 232, 255);
      doc.roundedRect(20, yPosition, pageWidth - 40, 18, 2, 2, 'F');
      
      doc.setTextColor(...darkBg);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(surgery.surgery_type, 25, yPosition + 6);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      if (surgery.surgery_date) {
        doc.text(`Date: ${format(new Date(surgery.surgery_date), 'MMM dd, yyyy')}`, 25, yPosition + 11);
      }
      if (surgery.hospital_name) {
        doc.setTextColor(...mediumGray);
        doc.text(surgery.hospital_name, 25, yPosition + 15);
      }
      
      yPosition += 18;
    });
    yPosition += 10;
  }

  // === PHARMACIES SECTION ===
  if (pharmacies.length > 0) {
    checkPageBreak(doc, yPosition, 50);
    yPosition = getCurrentY(doc, yPosition);
    
    addColorfulSectionHeader(doc, '🏥 Pharmacies', yPosition, tealGradient);
    yPosition += 12;
    
    pharmacies.forEach((pharm, index) => {
      if (index > 0) yPosition += 8;
      
      doc.setFillColor(204, 251, 241);
      doc.roundedRect(20, yPosition, pageWidth - 40, 20, 2, 2, 'F');
      
      doc.setTextColor(...darkBg);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(pharm.pharmacy_name, 25, yPosition + 6);
      
      if (pharm.is_preferred) {
        doc.setFillColor(251, 191, 36);
        doc.circle(pageWidth - 25, yPosition + 6, 3, 'F');
        doc.setTextColor(251, 191, 36);
        doc.setFontSize(7);
        doc.text('★', pageWidth - 26, yPosition + 7);
      }
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkBg);
      if (pharm.address) {
        doc.text(`${pharm.address}, ${pharm.city}, ${pharm.state}`, 25, yPosition + 12);
      }
      if (pharm.phone) {
        doc.setTextColor(...mediumGray);
        doc.text(`Phone: ${pharm.phone}`, 25, yPosition + 17);
      }
      
      yPosition += 20;
    });
    yPosition += 10;
  }

  // === EMERGENCY CONTACTS SECTION ===
  if (emergencyContacts.length > 0) {
    checkPageBreak(doc, yPosition, 50);
    yPosition = getCurrentY(doc, yPosition);
    
    addColorfulSectionHeader(doc, '📞 Emergency Contacts', yPosition, redGradient);
    yPosition += 12;
    
    emergencyContacts
      .sort((a, b) => (a.contact_order || 0) - (b.contact_order || 0))
      .forEach((contact, index) => {
        if (index > 0) yPosition += 8;
        
        doc.setFillColor(254, 226, 226);
        doc.roundedRect(20, yPosition, pageWidth - 40, 16, 2, 2, 'F');
        
        doc.setTextColor(...darkBg);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(contact.name, 25, yPosition + 6);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`${contact.relationship || ''} • ${contact.phone || ''}`, 25, yPosition + 12);
        
        yPosition += 16;
      });
  }

  // Add footer to all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  return doc.output('blob');
}

function addColorfulSectionHeader(doc: jsPDF, title: string, yPosition: number, color: [number, number, number]) {
  // Gradient effect with two rectangles
  doc.setFillColor(...color);
  doc.roundedRect(14, yPosition, doc.internal.pageSize.getWidth() - 28, 10, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(title, 20, yPosition + 7);
}

function addFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setDrawColor(200, 200, 200);
  doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
  
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  
  doc.text('VitaLuxe Services', 14, pageHeight - 8);
  doc.text(
    `Generated: ${format(new Date(), 'MMM dd, yyyy')}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );
  doc.text(
    `Page ${pageNumber} of ${totalPages}`,
    pageWidth - 14,
    pageHeight - 8,
    { align: 'right' }
  );
}

function checkPageBreak(doc: jsPDF, yPosition: number, requiredSpace: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPosition + requiredSpace > pageHeight - 25) {
    doc.addPage();
    return 20;
  }
  return yPosition;
}

function getCurrentY(doc: jsPDF, yPosition: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPosition + 50 > pageHeight - 25) {
    return 20;
  }
  return yPosition;
}
