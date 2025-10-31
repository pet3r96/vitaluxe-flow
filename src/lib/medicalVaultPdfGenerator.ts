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

function calculateBMI(heightInches?: number, weightPounds?: number): string {
  if (!heightInches || !weightPounds) return 'N/A';
  const bmi = (weightPounds / (heightInches * heightInches)) * 703;
  return bmi.toFixed(1);
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
  let yPosition = 20;

  // Color scheme
  const primaryColor: [number, number, number] = [251, 191, 36]; // yellow-400
  const textColor: [number, number, number] = [31, 41, 55]; // gray-800
  const lightGray: [number, number, number] = [243, 244, 246]; // gray-100

  // Cover Page
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('🛡️ MEDICAL VAULT', pageWidth / 2, 25, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprehensive Health Record', pageWidth / 2, 35, { align: 'center' });

  yPosition = 70;
  doc.setTextColor(...textColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${patientAccount.first_name} ${patientAccount.last_name}`, pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const age = calculateAge(patientAccount.date_of_birth);
  doc.text(`DOB: ${format(new Date(patientAccount.date_of_birth), 'MMM dd, yyyy')} (Age: ${age})`, pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 8;
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy \'at\' h:mm a')}`, pageWidth / 2, yPosition, { align: 'center' });

  // Demographics Section
  yPosition += 20;
  doc.setTextColor(...textColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DEMOGRAPHICS', 14, yPosition);
  
  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const demographics = [
    ['Name:', `${patientAccount.first_name} ${patientAccount.last_name}`],
    ['Date of Birth:', `${format(new Date(patientAccount.date_of_birth), 'MMM dd, yyyy')} (Age: ${age})`],
    ['Gender:', patientAccount.gender_at_birth || 'Not provided'],
    ['Address:', patientAccount.address && patientAccount.city 
      ? `${patientAccount.address}, ${patientAccount.city}, ${patientAccount.state} ${patientAccount.zip_code}`
      : 'Not provided']
  ];

  demographics.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 20, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 50, yPosition);
    yPosition += 7;
  });

  // Start new page for medical sections
  doc.addPage();
  yPosition = 20;

  // Medications Section
  addSectionHeader(doc, '💊 MEDICATIONS', yPosition);
  yPosition += 10;
  
  if (medications.length > 0) {
    const medData = medications
      .filter(m => m.is_active)
      .map(m => [
        m.medication_name,
        m.dosage || 'N/A',
        m.frequency || 'N/A',
        m.start_date ? format(new Date(m.start_date), 'MMM yyyy') : 'N/A'
      ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Medication', 'Dosage', 'Frequency', 'Started']],
      body: medData.length > 0 ? medData : [['No active medications', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [251, 191, 36], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No medications recorded', 20, yPosition);
    yPosition += 15;
  }

  // Check if we need a new page
  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  // Medical Conditions Section
  addSectionHeader(doc, '❤️ MEDICAL CONDITIONS', yPosition);
  yPosition += 10;
  
  if (conditions.length > 0) {
    const condData = conditions
      .filter(c => c.is_active)
      .map(c => [
        c.condition_name,
        c.severity || 'N/A',
        c.date_diagnosed ? format(new Date(c.date_diagnosed), 'MMM yyyy') : 'N/A',
        c.description || ''
      ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Condition', 'Severity', 'Diagnosed', 'Notes']],
      body: condData.length > 0 ? condData : [['No active conditions', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No conditions recorded', 20, yPosition);
    yPosition += 15;
  }

  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  // Allergies Section
  addSectionHeader(doc, '⚠️ ALLERGIES', yPosition);
  yPosition += 10;
  
  if (allergies.length > 0) {
    const allergyData = allergies.map(a => [
      a.allergen_name,
      a.reaction_type || 'N/A',
      a.severity || 'N/A',
      a.notes || ''
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Allergen', 'Reaction', 'Severity', 'Notes']],
      body: allergyData,
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No known allergies (NKA)', 20, yPosition);
    yPosition += 15;
  }

  if (yPosition > pageHeight - 80) {
    doc.addPage();
    yPosition = 20;
  }

  // Vitals Section
  addSectionHeader(doc, '📊 VITALS / BIOMETRICS', yPosition);
  yPosition += 10;
  
  if (vitals.length > 0) {
    const latestVital = vitals[0];
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Quick Look:', 20, yPosition);
    yPosition += 7;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const vitalInfo = [
      `Height: ${latestVital.height_inches ? `${latestVital.height_inches}"` : 'N/A'}`,
      `Weight: ${latestVital.weight_pounds ? `${latestVital.weight_pounds} lbs` : 'N/A'}`,
      `BMI: ${calculateBMI(latestVital.height_inches, latestVital.weight_pounds)}`,
      `BP: ${latestVital.blood_pressure_systolic && latestVital.blood_pressure_diastolic 
        ? `${latestVital.blood_pressure_systolic}/${latestVital.blood_pressure_diastolic}` : 'N/A'}`,
      `Pulse: ${latestVital.pulse || 'N/A'}`,
      `O2 Sat: ${latestVital.oxygen_saturation ? `${latestVital.oxygen_saturation}%` : 'N/A'}`
    ];
    
    vitalInfo.forEach(info => {
      doc.text(`• ${info}`, 25, yPosition);
      yPosition += 6;
    });
    yPosition += 5;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No vitals recorded', 20, yPosition);
    yPosition += 15;
  }

  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  // Immunizations Section
  addSectionHeader(doc, '💉 IMMUNIZATIONS', yPosition);
  yPosition += 10;
  
  if (immunizations.length > 0) {
    const immunizationData = immunizations.map(i => [
      i.vaccine_name,
      i.date_administered ? format(new Date(i.date_administered), 'MMM dd, yyyy') : 'N/A',
      i.provider_name || 'N/A'
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Vaccine', 'Date', 'Provider']],
      body: immunizationData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No immunizations recorded', 20, yPosition);
    yPosition += 15;
  }

  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  // Surgeries Section
  addSectionHeader(doc, '✂️ SURGERIES', yPosition);
  yPosition += 10;
  
  if (surgeries.length > 0) {
    const surgeryData = surgeries.map(s => [
      s.surgery_type,
      s.surgery_date ? format(new Date(s.surgery_date), 'MMM dd, yyyy') : 'N/A',
      s.surgeon_name || 'N/A',
      s.hospital_name || 'N/A'
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Surgery', 'Date', 'Surgeon', 'Hospital']],
      body: surgeryData,
      theme: 'grid',
      headStyles: { fillColor: [168, 85, 247], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No surgeries recorded', 20, yPosition);
    yPosition += 15;
  }

  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  // Pharmacies Section
  addSectionHeader(doc, '🏥 PHARMACIES', yPosition);
  yPosition += 10;
  
  if (pharmacies.length > 0) {
    pharmacies.forEach(p => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const name = p.is_preferred ? `★ ${p.pharmacy_name} (Preferred)` : p.pharmacy_name;
      doc.text(name, 20, yPosition);
      yPosition += 6;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (p.address) {
        doc.text(`${p.address}, ${p.city}, ${p.state} ${p.zip_code}`, 25, yPosition);
        yPosition += 5;
      }
      if (p.phone) {
        doc.text(`Phone: ${p.phone}`, 25, yPosition);
        yPosition += 5;
      }
      yPosition += 3;
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No pharmacies recorded', 20, yPosition);
    yPosition += 15;
  }

  if (yPosition > pageHeight - 60) {
    doc.addPage();
    yPosition = 20;
  }

  // Emergency Contacts Section
  addSectionHeader(doc, '📞 EMERGENCY CONTACTS', yPosition);
  yPosition += 10;
  
  if (emergencyContacts.length > 0) {
    const contactData = emergencyContacts
      .sort((a, b) => (a.contact_order || 0) - (b.contact_order || 0))
      .map(c => [
        c.name,
        c.relationship || 'N/A',
        c.phone || 'N/A',
        c.email || 'N/A'
      ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Name', 'Relationship', 'Phone', 'Email']],
      body: contactData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('No emergency contacts recorded', 20, yPosition);
  }

  // Footer on last page
  addFooter(doc, doc.internal.pages.length - 1);

  return doc.output('blob');
}

function addSectionHeader(doc: jsPDF, title: string, yPosition: number) {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(title, 14, yPosition);
  doc.setDrawColor(229, 231, 235);
  doc.line(14, yPosition + 2, doc.internal.pageSize.getWidth() - 14, yPosition + 2);
}

function addFooter(doc: jsPDF, pageNumber: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Page ${pageNumber} | Generated: ${format(new Date(), 'MMM dd, yyyy')} | powered by VitaLuxe Services`,
    doc.internal.pageSize.getWidth() / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}
