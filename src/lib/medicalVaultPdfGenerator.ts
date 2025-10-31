import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  // Compact Color Palette
  const colors = {
    dark: [31, 41, 55] as [number, number, number],
    gold: [218, 165, 32] as [number, number, number],
    blue: [59, 130, 246] as [number, number, number],
    lightBlue: [239, 246, 255] as [number, number, number],
    red: [239, 68, 68] as [number, number, number],
    lightRed: [254, 242, 242] as [number, number, number],
    orange: [249, 115, 22] as [number, number, number],
    lightOrange: [255, 247, 237] as [number, number, number],
    green: [34, 197, 94] as [number, number, number],
    lightGreen: [240, 253, 244] as [number, number, number],
    purple: [168, 85, 247] as [number, number, number],
    lightPurple: [250, 245, 255] as [number, number, number],
    teal: [20, 184, 166] as [number, number, number],
    lightTeal: [240, 253, 250] as [number, number, number],
    gray: [156, 163, 175] as [number, number, number],
    lightGray: [249, 250, 251] as [number, number, number],
  };

  // Compact Header (25px)
  const addHeader = (y: number) => {
    doc.setFillColor(...colors.dark);
    doc.rect(0, y, pageWidth, 25, 'F');
    
    doc.setTextColor(...colors.gold);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
    doc.text(`MEDICAL RECORD - ${fullName.toUpperCase()}`, pageWidth / 2, y + 10, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('VitaLuxe Services', pageWidth / 2, y + 17, { align: 'center' });
    
    return y + 25;
  };

  yPos = addHeader(yPos);
  yPos += 6;

  // Compact Demographics (18px tall boxes)
  const addDemographics = (y: number) => {
    const boxWidth = (pageWidth - 20) / 3;
    const boxHeight = 18;
    const startX = 10;

    // Patient box
    doc.setFillColor(...colors.lightBlue);
    doc.rect(startX, y, boxWidth - 2, boxHeight, 'F');
    doc.setDrawColor(...colors.blue);
    doc.rect(startX, y, boxWidth - 2, boxHeight, 'S');
    
    doc.setTextColor(...colors.blue);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT', startX + 3, y + 6);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : 'N/A';
    const gender = patient.gender || 'N/A';
    doc.text(`${age} yrs, ${gender}`, startX + 3, y + 13);

    // DOB box
    const dobX = startX + boxWidth;
    doc.setFillColor(...colors.lightGreen);
    doc.rect(dobX, y, boxWidth - 2, boxHeight, 'F');
    doc.setDrawColor(...colors.green);
    doc.rect(dobX, y, boxWidth - 2, boxHeight, 'S');
    
    doc.setTextColor(...colors.green);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE OF BIRTH', dobX + 3, y + 6);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const dob = patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A';
    doc.text(dob, dobX + 3, y + 13);

    // Location box
    const locX = dobX + boxWidth;
    doc.setFillColor(...colors.lightOrange);
    doc.rect(locX, y, boxWidth - 2, boxHeight, 'F');
    doc.setDrawColor(...colors.orange);
    doc.rect(locX, y, boxWidth - 2, boxHeight, 'S');
    
    doc.setTextColor(...colors.orange);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('LOCATION', locX + 3, y + 6);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const location = patient.city && patient.state ? `${patient.city}, ${patient.state}` : 'N/A';
    doc.text(location, locX + 3, y + 13);

    return y + boxHeight;
  };

  yPos = addDemographics(yPos);
  yPos += 8;

  // Compact Section Header (10px)
  const addSectionHeader = (y: number, title: string, bgColor: [number, number, number]) => {
    if (y > pageHeight - 30) {
      doc.addPage();
      y = addHeader(10);
      y += 6;
    }

    doc.setFillColor(...bgColor);
    doc.rect(10, y, pageWidth - 20, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), 12, y + 7);

    return y + 10;
  };

  // Check page break
  const checkPageBreak = (y: number, neededSpace: number = 20) => {
    if (y > pageHeight - neededSpace) {
      doc.addPage();
      y = addHeader(10);
      return y + 6;
    }
    return y;
  };

  // Add compact badge
  const addBadge = (x: number, y: number, text: string, bgColor: [number, number, number]) => {
    const textWidth = doc.getTextWidth(text);
    doc.setFillColor(...bgColor);
    doc.roundedRect(x, y - 5, textWidth + 4, 7, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(text, x + 2, y);
  };

  // MEDICATIONS (14px per item)
  if (medications.length > 0) {
    yPos = addSectionHeader(yPos, 'MEDICATIONS', colors.blue);
    yPos += 2;

    medications.forEach((med) => {
      yPos = checkPageBreak(yPos, 20);

      doc.setFillColor(...colors.lightBlue);
      doc.rect(10, yPos, pageWidth - 20, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, yPos, pageWidth - 20, 14, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(med.medication_name.toUpperCase(), 12, yPos + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const details = `${med.dosage || 'N/A'} • ${med.frequency || 'N/A'}`;
      doc.text(details, 12, yPos + 11);

      const startDate = med.start_date ? new Date(med.start_date).toLocaleDateString() : 'N/A';
      doc.setFontSize(6);
      doc.setTextColor(...colors.gray);
      doc.text(`Started: ${startDate}`, pageWidth - 60, yPos + 6);

      if (med.is_active) {
        addBadge(pageWidth - 30, yPos + 6, 'Active', colors.green);
      }

      yPos += 16;
    });
  }

  // CONDITIONS (14px per item)
  if (conditions.length > 0) {
    yPos = checkPageBreak(yPos, 20);
    yPos = addSectionHeader(yPos, 'MEDICAL CONDITIONS', colors.red);
    yPos += 2;

    conditions.forEach((cond) => {
      yPos = checkPageBreak(yPos, 20);

      doc.setFillColor(...colors.lightRed);
      doc.rect(10, yPos, pageWidth - 20, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, yPos, pageWidth - 20, 14, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(cond.condition_name.toUpperCase(), 12, yPos + 6);

      if (cond.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const truncatedNotes = cond.notes.length > 60 ? cond.notes.substring(0, 60) + '...' : cond.notes;
        doc.text(truncatedNotes, 12, yPos + 11);
      }

      const diagDate = cond.diagnosis_date ? new Date(cond.diagnosis_date).toLocaleDateString() : 'N/A';
      doc.setFontSize(6);
      doc.setTextColor(...colors.gray);
      doc.text(`Diagnosed: ${diagDate}`, pageWidth - 70, yPos + 6);

      if (cond.severity) {
        const severityColor = cond.severity === 'Severe' ? colors.red : 
                              cond.severity === 'Moderate' ? colors.orange : colors.green;
        addBadge(pageWidth - 30, yPos + 6, cond.severity, severityColor);
      }

      yPos += 16;
    });
  }

  // ALLERGIES (14px per item)
  if (allergies.length > 0) {
    yPos = checkPageBreak(yPos, 20);
    yPos = addSectionHeader(yPos, 'ALLERGIES', colors.orange);
    yPos += 2;

    allergies.forEach((allergy) => {
      yPos = checkPageBreak(yPos, 20);

      doc.setFillColor(...colors.lightOrange);
      doc.rect(10, yPos, pageWidth - 20, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, yPos, pageWidth - 20, 14, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const allergenName = allergy.allergen || allergy.allergen_name || 'Unknown Allergen';
      doc.text(allergenName.toUpperCase(), 12, yPos + 6);

      const reaction = allergy.reaction || allergy.reaction_type;
      if (reaction) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`Reaction: ${reaction}`, 12, yPos + 11);
      }

      if (allergy.severity) {
        const severityColor = allergy.severity === 'Severe' ? colors.red : 
                              allergy.severity === 'Moderate' ? colors.orange : colors.green;
        addBadge(pageWidth - 30, yPos + 6, allergy.severity, severityColor);
      }

      yPos += 16;
    });
  }

  // VITALS (30px compact box)
  const latestVital = vitals.find(v => hasVitalData(v));
  if (latestVital) {
    yPos = checkPageBreak(yPos, 35);
    yPos = addSectionHeader(yPos, 'VITAL SIGNS', colors.green);
    yPos += 2;

    doc.setFillColor(...colors.lightGreen);
    doc.rect(10, yPos, pageWidth - 20, 30, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, yPos, pageWidth - 20, 30, 'S');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    const leftX = 12;
    const rightX = pageWidth / 2 + 5;
    let vitalY = yPos + 6;

    if (latestVital.height_inches || latestVital.weight_pounds) {
      const height = latestVital.height_inches ? `${Math.floor(latestVital.height_inches / 12)}'${latestVital.height_inches % 12}" (${latestVital.height_inches}")` : 'N/A';
      doc.text(`Height: ${height}`, leftX, vitalY);
      
      if (latestVital.blood_pressure_systolic && latestVital.blood_pressure_diastolic) {
        doc.text(`BP: ${latestVital.blood_pressure_systolic}/${latestVital.blood_pressure_diastolic} mmHg`, rightX, vitalY);
      }
      vitalY += 5;
    }

    if (latestVital.weight_pounds) {
      doc.text(`Weight: ${latestVital.weight_pounds} lbs`, leftX, vitalY);
      
      const heartRate = latestVital.heart_rate || latestVital.pulse;
      if (heartRate) {
        doc.text(`Pulse: ${heartRate} bpm`, rightX, vitalY);
      }
      vitalY += 5;
    }

    const bmi = calculateBMI(latestVital.height_inches || undefined, latestVital.weight_pounds || undefined);
    if (bmi) {
      doc.text(`BMI: ${bmi.toFixed(1)}`, leftX, vitalY);
      
      if (latestVital.oxygen_saturation) {
        doc.text(`O2 Sat: ${latestVital.oxygen_saturation}%`, rightX, vitalY);
      }
      vitalY += 5;
    }

    if (latestVital.temperature) {
      doc.text(`Temp: ${latestVital.temperature}°F`, leftX, vitalY);
      
      if (latestVital.respiratory_rate) {
        doc.text(`Resp Rate: ${latestVital.respiratory_rate} /min`, rightX, vitalY);
      }
    }

    yPos += 32;
  }

  // IMMUNIZATIONS (14px per item)
  if (immunizations.length > 0) {
    yPos = checkPageBreak(yPos, 20);
    yPos = addSectionHeader(yPos, 'IMMUNIZATIONS', colors.purple);
    yPos += 2;

    immunizations.forEach((imm) => {
      yPos = checkPageBreak(yPos, 20);

      doc.setFillColor(...colors.lightPurple);
      doc.rect(10, yPos, pageWidth - 20, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, yPos, pageWidth - 20, 14, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(imm.vaccine_name, 12, yPos + 6);

      const adminDate = imm.date_administered ? new Date(imm.date_administered).toLocaleDateString() : 'N/A';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Administered: ${adminDate}`, 12, yPos + 11);

      if (imm.provider) {
        doc.setFontSize(6);
        doc.setTextColor(...colors.gray);
        doc.text(`Provider: ${imm.provider}`, pageWidth - 80, yPos + 6);
      }

      yPos += 16;
    });
  }

  // SURGERIES (14px per item)
  if (surgeries.length > 0) {
    yPos = checkPageBreak(yPos, 20);
    yPos = addSectionHeader(yPos, 'SURGICAL HISTORY', colors.purple);
    yPos += 2;

    surgeries.forEach((surgery) => {
      yPos = checkPageBreak(yPos, 20);

      doc.setFillColor(...colors.lightPurple);
      doc.rect(10, yPos, pageWidth - 20, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, yPos, pageWidth - 20, 14, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const procedureName = surgery.procedure_name || surgery.surgery_type || 'Unknown Procedure';
      doc.text(procedureName, 12, yPos + 6);

      const surgDate = surgery.surgery_date ? new Date(surgery.surgery_date).toLocaleDateString() : 'N/A';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const surgeonName = surgery.surgeon || surgery.surgeon_name;
      const surgDetails = surgeonName ? `${surgDate} | Dr. ${surgeonName}` : surgDate;
      doc.text(surgDetails, 12, yPos + 11);

      if (surgery.hospital) {
        doc.setFontSize(6);
        doc.setTextColor(...colors.gray);
        doc.text(surgery.hospital, pageWidth - 80, yPos + 6);
      }

      yPos += 16;
    });
  }

  // PHARMACIES (14px per item)
  if (pharmacies.length > 0) {
    yPos = checkPageBreak(yPos, 20);
    yPos = addSectionHeader(yPos, 'PHARMACIES', colors.teal);
    yPos += 2;

    pharmacies.forEach((pharm) => {
      yPos = checkPageBreak(yPos, 20);

      doc.setFillColor(...colors.lightTeal);
      doc.rect(10, yPos, pageWidth - 20, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, yPos, pageWidth - 20, 14, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(pharm.pharmacy_name, 12, yPos + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const pharmDetails = `${pharm.phone_number || 'N/A'} | ${pharm.address || 'N/A'}`;
      doc.text(pharmDetails, 12, yPos + 11);

      if (pharm.is_preferred) {
        addBadge(pageWidth - 35, yPos + 6, 'Preferred', colors.teal);
      }

      yPos += 16;
    });
  }

  // EMERGENCY CONTACTS (14px per item)
  if (emergencyContacts.length > 0) {
    yPos = checkPageBreak(yPos, 20);
    yPos = addSectionHeader(yPos, 'EMERGENCY CONTACTS', colors.red);
    yPos += 2;

    emergencyContacts.forEach((contact) => {
      yPos = checkPageBreak(yPos, 20);

      doc.setFillColor(...colors.lightRed);
      doc.rect(10, yPos, pageWidth - 20, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, yPos, pageWidth - 20, 14, 'S');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      const contactName = contact.contact_name || contact.name || 'Unknown Contact';
      doc.text(contactName, 12, yPos + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const phoneNumber = contact.phone_number || contact.phone;
      const contactDetails = `${contact.relationship || 'N/A'} | ${phoneNumber || 'N/A'}`;
      doc.text(contactDetails, 12, yPos + 11);

      yPos += 16;
    });
  }

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(...colors.gray);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 10, pageHeight - 5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 5);
  }

  return doc.output('blob');
};
