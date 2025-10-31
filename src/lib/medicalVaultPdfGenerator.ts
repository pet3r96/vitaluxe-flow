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

  // UI Color Palette (matching Medical Vault design)
  const darkBg = [17, 24, 39] as [number, number, number]; // gray-900
  const gold = [251, 191, 36] as [number, number, number]; // yellow-400
  const brownGold = [161, 98, 7] as [number, number, number]; // yellow-700
  const lightGray = [229, 231, 235] as [number, number, number]; // gray-200
  const mediumGray = [107, 114, 128] as [number, number, number]; // gray-500
  const white = [255, 255, 255] as [number, number, number];

  // Section colors matching UI gradient scheme
  const blue = {
    gradient: [59, 130, 246] as [number, number, number], // blue-500
    light: [219, 234, 254] as [number, number, number], // blue-100
    dark: [30, 58, 138] as [number, number, number] // blue-900
  };

  const red = {
    gradient: [239, 68, 68] as [number, number, number], // red-500
    light: [254, 226, 226] as [number, number, number], // red-100
    dark: [127, 29, 29] as [number, number, number] // red-900
  };

  const orange = {
    gradient: [249, 115, 22] as [number, number, number], // orange-500
    light: [255, 237, 213] as [number, number, number], // orange-100
    dark: [124, 45, 18] as [number, number, number] // orange-900
  };

  const green = {
    gradient: [34, 197, 94] as [number, number, number], // green-500
    light: [220, 252, 231] as [number, number, number], // green-100
    dark: [20, 83, 45] as [number, number, number] // green-900
  };

  const purple = {
    gradient: [168, 85, 247] as [number, number, number], // purple-500
    light: [243, 232, 255] as [number, number, number], // purple-100
    dark: [88, 28, 135] as [number, number, number] // purple-900
  };

  const teal = {
    gradient: [20, 184, 166] as [number, number, number], // teal-500
    light: [204, 251, 241] as [number, number, number], // teal-100
    dark: [19, 78, 74] as [number, number, number] // teal-900
  };

  // === HEADER SECTION ===
  // Dark gradient background
  doc.setFillColor(...darkBg);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Shield icon with gold gradient
  doc.setFillColor(...gold);
  doc.circle(pageWidth / 2, 15, 6, 'F');
  doc.setTextColor(...darkBg);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('✓', pageWidth / 2, 17.5, { align: 'center' });
  
  // Patient name in gold
  doc.setTextColor(...gold);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${patientAccount.first_name} ${patientAccount.last_name} Secure Medical Vault`, pageWidth / 2, 28, { align: 'center' });
  
  // Subtitle
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text('powered by VitaLuxe Services', pageWidth / 2, 38, { align: 'center' });

  yPosition = 55;

  // === DEMOGRAPHICS SECTION (Three Gold Boxes) ===
  const boxWidth = (pageWidth - 40) / 3;
  const boxHeight = 28;
  const boxSpacing = 2;
  const startX = 14;

  // Box 1: Full Name
  doc.setFillColor(...brownGold);
  doc.roundedRect(startX, yPosition, boxWidth - boxSpacing, boxHeight, 3, 3, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('👤 Full Name', startX + 4, yPosition + 7);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${patientAccount.first_name} ${patientAccount.last_name}`, startX + 4, yPosition + 16);
  if (patientAccount.gender_at_birth) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gender: ${patientAccount.gender_at_birth}`, startX + 4, yPosition + 23);
  }

  // Box 2: Date of Birth
  doc.setFillColor(...brownGold);
  doc.roundedRect(startX + boxWidth, yPosition, boxWidth - boxSpacing, boxHeight, 3, 3, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('📅 Date of Birth', startX + boxWidth + 4, yPosition + 7);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const age = calculateAge(patientAccount.date_of_birth);
  doc.text(format(new Date(patientAccount.date_of_birth), 'MMM dd, yyyy'), startX + boxWidth + 4, yPosition + 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Age: ${age} years`, startX + boxWidth + 4, yPosition + 23);

  // Box 3: Address
  doc.setFillColor(...brownGold);
  doc.roundedRect(startX + boxWidth * 2, yPosition, boxWidth - boxSpacing, boxHeight, 3, 3, 'F');
  doc.setTextColor(...white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('📍 Address', startX + boxWidth * 2 + 4, yPosition + 7);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (patientAccount.address) {
    const addressLines = doc.splitTextToSize(patientAccount.address, boxWidth - 12);
    doc.text(addressLines[0], startX + boxWidth * 2 + 4, yPosition + 14);
    if (patientAccount.city) {
      doc.text(`${patientAccount.city}, ${patientAccount.state}`, startX + boxWidth * 2 + 4, yPosition + 20);
      if (patientAccount.zip_code) {
        doc.text(patientAccount.zip_code, startX + boxWidth * 2 + 4, yPosition + 25);
      }
    }
  } else {
    doc.text('Not provided', startX + boxWidth * 2 + 4, yPosition + 16);
  }

  yPosition += boxHeight + 12;

  // === MEDICATIONS SECTION ===
  const activeMeds = medications.filter(m => m.is_active && m.medication_name);
  
  if (activeMeds.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '💊 Medications', yPosition, blue.gradient, blue.light);
    yPosition += 15;
    
    activeMeds.forEach((med, index) => {
      yPosition = checkPageBreak(doc, yPosition, 30);
      
      // Light blue card
      doc.setFillColor(...blue.light);
      doc.roundedRect(20, yPosition, pageWidth - 40, 22, 3, 3, 'F');
      
      // Medication name
      doc.setTextColor(...blue.dark);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(med.medication_name, 26, yPosition + 7);
      
      // Dosage and frequency
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumGray);
      const medInfo = `${med.dosage || 'No dosage'} • ${med.frequency || 'As needed'}`;
      doc.text(medInfo, 26, yPosition + 13);
      
      // Start date
      if (med.start_date) {
        doc.setFontSize(8);
        doc.text(`Started: ${format(new Date(med.start_date), 'MMM dd, yyyy')}`, 26, yPosition + 18);
      }
      
      // Active badge
      doc.setFillColor(...green.gradient);
      doc.roundedRect(pageWidth - 55, yPosition + 6, 30, 10, 2, 2, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Active', pageWidth - 52, yPosition + 13);
      
      yPosition += 26;
    });
    
    yPosition += 8;
  }

  // === MEDICAL CONDITIONS SECTION ===
  const activeConditions = conditions.filter(c => c.is_active && c.condition_name);
  
  if (activeConditions.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '❤️ Medical Conditions', yPosition, red.gradient, red.light);
    yPosition += 15;
    
    activeConditions.forEach((cond, index) => {
      yPosition = checkPageBreak(doc, yPosition, 30);
      
      // Light red card
      doc.setFillColor(...red.light);
      doc.roundedRect(20, yPosition, pageWidth - 40, 24, 3, 3, 'F');
      
      // Condition name
      doc.setTextColor(...red.dark);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(cond.condition_name, 26, yPosition + 7);
      
      // Description
      if (cond.description) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mediumGray);
        const descLines = doc.splitTextToSize(cond.description, pageWidth - 100);
        doc.text(descLines[0], 26, yPosition + 13);
      }
      
      // Diagnosis date
      if (cond.date_diagnosed) {
        doc.setFontSize(8);
        doc.text(`Diagnosed: ${format(new Date(cond.date_diagnosed), 'MMM dd, yyyy')}`, 26, yPosition + 19);
      }
      
      // Severity badge
      if (cond.severity) {
        const severityColors = {
          'Severe': [220, 38, 38] as [number, number, number],
          'Moderate': [249, 115, 22] as [number, number, number],
          'Mild': [34, 197, 94] as [number, number, number]
        };
        const severityColor = severityColors[cond.severity as keyof typeof severityColors] || green.gradient;
        doc.setFillColor(...severityColor);
        doc.roundedRect(pageWidth - 60, yPosition + 6, 35, 10, 2, 2, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(cond.severity, pageWidth - 57, yPosition + 13);
      }
      
      yPosition += 28;
    });
    
    yPosition += 8;
  }

  // === ALLERGIES SECTION ===
  if (allergies.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '⚠️ Allergies', yPosition, orange.gradient, orange.light);
    yPosition += 15;
    
    allergies.forEach((allergy, index) => {
      yPosition = checkPageBreak(doc, yPosition, 25);
      
      // Light orange card
      doc.setFillColor(...orange.light);
      doc.roundedRect(20, yPosition, pageWidth - 40, 20, 3, 3, 'F');
      
      // Allergen name
      doc.setTextColor(...orange.dark);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(allergy.allergen_name, 26, yPosition + 7);
      
      // Reaction type
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumGray);
      doc.text(`Reaction: ${allergy.reaction_type || 'Not specified'}`, 26, yPosition + 13);
      
      // Severity badge
      if (allergy.severity) {
        const severityColors = {
          'Severe': [220, 38, 38] as [number, number, number],
          'Moderate': [249, 115, 22] as [number, number, number],
          'Mild': [34, 197, 94] as [number, number, number]
        };
        const severityColor = severityColors[allergy.severity as keyof typeof severityColors] || orange.gradient;
        doc.setFillColor(...severityColor);
        doc.roundedRect(pageWidth - 60, yPosition + 5, 35, 10, 2, 2, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(allergy.severity, pageWidth - 57, yPosition + 12);
      }
      
      yPosition += 24;
    });
    
    yPosition += 8;
  }

  // === VITALS / BIOMETRICS SECTION ===
  const vitalsWithData = vitals.filter(v => hasVitalData(v));
  
  if (vitalsWithData.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '📊 Vitals / Biometrics', yPosition, green.gradient, green.light);
    yPosition += 15;
    
    const latestVital = vitalsWithData[0];
    
    // Quick Look box
    doc.setFillColor(...green.light);
    doc.roundedRect(20, yPosition, pageWidth - 40, 45, 3, 3, 'F');
    
    doc.setTextColor(...green.dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Quick Look', 26, yPosition + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mediumGray);
    let vitalY = yPosition + 16;
    
    // Left column
    if (latestVital.height_inches) {
      const feet = Math.floor(latestVital.height_inches / 12);
      const inches = latestVital.height_inches % 12;
      doc.text(`Height: ${feet}'${inches}" (${latestVital.height_inches} in)`, 26, vitalY);
      vitalY += 6;
    }
    
    if (latestVital.weight_pounds) {
      doc.text(`Weight: ${latestVital.weight_pounds} lbs`, 26, vitalY);
      vitalY += 6;
    }
    
    const bmi = calculateBMI(latestVital.height_inches, latestVital.weight_pounds);
    if (bmi) {
      doc.setTextColor(...green.dark);
      doc.setFont('helvetica', 'bold');
      doc.text(`BMI: ${bmi}`, 26, vitalY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumGray);
      doc.setFontSize(7);
      doc.text('(Auto-calculated)', 50, vitalY);
    }
    
    // Right column
    vitalY = yPosition + 16;
    const rightX = pageWidth / 2 + 5;
    
    if (latestVital.blood_pressure_systolic && latestVital.blood_pressure_diastolic) {
      doc.setFontSize(9);
      doc.text(`Blood Pressure: ${latestVital.blood_pressure_systolic}/${latestVital.blood_pressure_diastolic} mmHg`, rightX, vitalY);
      vitalY += 6;
    }
    
    if (latestVital.pulse) {
      doc.text(`Pulse: ${latestVital.pulse} bpm`, rightX, vitalY);
      vitalY += 6;
    }
    
    if (latestVital.oxygen_saturation) {
      doc.text(`O2 Saturation: ${latestVital.oxygen_saturation}%`, rightX, vitalY);
    }
    
    yPosition += 50;
  }

  // === IMMUNIZATIONS SECTION ===
  if (immunizations.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '💉 Immunizations', yPosition, purple.gradient, purple.light);
    yPosition += 15;
    
    immunizations.forEach((imm, index) => {
      yPosition = checkPageBreak(doc, yPosition, 20);
      
      doc.setFillColor(...purple.light);
      doc.roundedRect(20, yPosition, pageWidth - 40, 16, 3, 3, 'F');
      
      doc.setTextColor(...purple.dark);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(imm.vaccine_name, 26, yPosition + 7);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumGray);
      if (imm.date_administered) {
        doc.text(`Administered: ${format(new Date(imm.date_administered), 'MMM dd, yyyy')}`, 26, yPosition + 12);
      }
      
      yPosition += 20;
    });
    
    yPosition += 8;
  }

  // === SURGERIES SECTION ===
  if (surgeries.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '✂️ Surgeries', yPosition, purple.gradient, purple.light);
    yPosition += 15;
    
    surgeries.forEach((surgery, index) => {
      yPosition = checkPageBreak(doc, yPosition, 25);
      
      doc.setFillColor(...purple.light);
      doc.roundedRect(20, yPosition, pageWidth - 40, 22, 3, 3, 'F');
      
      doc.setTextColor(...purple.dark);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(surgery.surgery_type, 26, yPosition + 7);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumGray);
      if (surgery.surgery_date) {
        doc.text(`Date: ${format(new Date(surgery.surgery_date), 'MMM dd, yyyy')}`, 26, yPosition + 13);
      }
      if (surgery.hospital_name) {
        doc.text(`Hospital: ${surgery.hospital_name}`, 26, yPosition + 18);
      }
      
      yPosition += 26;
    });
    
    yPosition += 8;
  }

  // === PHARMACIES SECTION ===
  if (pharmacies.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '🏥 Pharmacies', yPosition, teal.gradient, teal.light);
    yPosition += 15;
    
    pharmacies.forEach((pharm, index) => {
      yPosition = checkPageBreak(doc, yPosition, 25);
      
      doc.setFillColor(...teal.light);
      doc.roundedRect(20, yPosition, pageWidth - 40, 22, 3, 3, 'F');
      
      doc.setTextColor(...teal.dark);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(pharm.pharmacy_name, 26, yPosition + 7);
      
      // Preferred star
      if (pharm.is_preferred) {
        doc.setFillColor(...gold);
        doc.circle(pageWidth - 30, yPosition + 8, 4, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(9);
        doc.text('★', pageWidth - 32, yPosition + 10);
      }
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumGray);
      if (pharm.address) {
        doc.text(`${pharm.address}, ${pharm.city}, ${pharm.state}`, 26, yPosition + 13);
      }
      if (pharm.phone) {
        doc.text(`Phone: ${pharm.phone}`, 26, yPosition + 18);
      }
      
      yPosition += 26;
    });
    
    yPosition += 8;
  }

  // === EMERGENCY CONTACTS SECTION ===
  if (emergencyContacts.length > 0) {
    yPosition = checkPageBreak(doc, yPosition, 60);
    
    addSectionHeader(doc, '📞 Emergency Contacts', yPosition, red.gradient, red.light);
    yPosition += 15;
    
    emergencyContacts
      .sort((a, b) => (a.contact_order || 0) - (b.contact_order || 0))
      .forEach((contact, index) => {
        yPosition = checkPageBreak(doc, yPosition, 20);
        
        doc.setFillColor(...red.light);
        doc.roundedRect(20, yPosition, pageWidth - 40, 18, 3, 3, 'F');
        
        doc.setTextColor(...red.dark);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(contact.name, 26, yPosition + 7);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mediumGray);
        doc.text(`${contact.relationship || 'Contact'} • ${contact.phone || 'No phone'}`, 26, yPosition + 13);
        
        yPosition += 22;
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

function addSectionHeader(
  doc: jsPDF,
  title: string,
  yPosition: number,
  gradientColor: [number, number, number],
  lightColor: [number, number, number]
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Background with gradient effect
  doc.setFillColor(...lightColor);
  doc.roundedRect(14, yPosition, pageWidth - 28, 12, 3, 3, 'F');
  
  // Colored accent bar on left
  doc.setFillColor(...gradientColor);
  doc.roundedRect(14, yPosition, 4, 12, 1, 1, 'F');
  
  // Title text
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gradientColor);
  doc.text(title, 24, yPosition + 8);
}

function addFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
  
  // Footer text
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

function checkPageBreak(doc: jsPDF, yPosition: number, requiredSpace: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPosition + requiredSpace > pageHeight - 25) {
    doc.addPage();
    return 20;
  }
  return yPosition;
}
