import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface TreatmentPlan {
  id: string;
  plan_title: string;
  diagnosis_condition?: string;
  treatment_protocols: string;
  notes?: string;
  status: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  created_at: string;
  created_by_name: string;
  responsible_provider_name?: string;
  target_completion_date?: string;
  is_locked: boolean;
  locked_at?: string;
  locked_by_name?: string;
}

interface TreatmentPlanGoal {
  id: string;
  goal_description: string;
  status: 'ongoing' | 'achieved' | 'modified' | 'abandoned';
  is_specific?: boolean;
  is_measurable?: boolean;
  is_achievable?: boolean;
  is_relevant?: boolean;
  is_time_bound?: boolean;
  date_achieved?: string;
  achievement_notes?: string;
}

interface TreatmentPlanUpdate {
  id: string;
  update_type: 'progress_note' | 'status_change' | 'goal_update' | 'treatment_completed' | 'complication' | 'patient_feedback' | 'provider_note';
  update_content: string;
  created_at: string;
  created_by_name: string;
  created_by_role: string;
}

interface TreatmentPlanAttachment {
  id: string;
  file_name: string;
  attachment_type: string;
  file_size?: number;
}

interface TreatmentPlanPDFData {
  plan: TreatmentPlan;
  goals: TreatmentPlanGoal[];
  updates: TreatmentPlanUpdate[];
  attachments: TreatmentPlanAttachment[];
  patientName: string;
}

const statusLabels = {
  planned: 'Planned',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const updateTypeLabels = {
  progress_note: 'Progress Note',
  status_change: 'Status Change',
  goal_update: 'Goal Update',
  treatment_completed: 'Treatment Completed',
  complication: 'Complication',
  patient_feedback: 'Patient Feedback',
  provider_note: 'Provider Note',
};

const goalStatusLabels = {
  ongoing: 'Ongoing',
  achieved: 'Achieved',
  modified: 'Modified',
  abandoned: 'Abandoned',
};

export const generateTreatmentPlanPDF = async (data: TreatmentPlanPDFData): Promise<Blob> => {
  const { plan, goals, updates, attachments, patientName } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Colors matching the medical vault design
  const goldColor = [218, 165, 32] as [number, number, number];
  const darkGrey = [55, 65, 81] as [number, number, number];
  const lightGrey = [243, 244, 246] as [number, number, number];

  // Helper function to check if we need a new page
  const checkPageBreak = (neededSpace: number): void => {
    if (yPos + neededSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Helper function to add section title with divider
  const addSectionTitle = (title: string): void => {
    checkPageBreak(15);
    doc.setFillColor(...goldColor);
    doc.rect(10, yPos, pageWidth - 20, 0.5, 'F');
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...darkGrey);
    doc.text(title, 10, yPos);
    yPos += 8;
  };

  // Helper function to add a field with label and value
  const addField = (label: string, value: string): void => {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...darkGrey);
    doc.text(label + ':', 10, yPos);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, pageWidth - 70);
    doc.text(lines, 60, yPos);
    yPos += (lines.length * 5) + 2;
  };

  // Add footer function
  const addFooter = (): void => {
    const totalPages = (doc as any).internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      doc.text(
        `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        10,
        pageHeight - 10
      );
      doc.text(
        'CONFIDENTIAL MEDICAL RECORD',
        pageWidth - 10,
        pageHeight - 10,
        { align: 'right' }
      );
    }
  };

  // === HEADER ===
  doc.setFillColor(...darkGrey);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Add shield/lock icon
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(1.5);
  doc.setFillColor(255, 255, 255);
  
  // Shield outline
  const shieldX = 15;
  const shieldY = 12;
  doc.triangle(shieldX, shieldY, shieldX + 5, shieldY, shieldX + 2.5, shieldY + 6, 'FD');
  
  // Lock on shield
  doc.setLineWidth(0.5);
  doc.circle(shieldX + 2.5, shieldY + 2.5, 1, 'S');
  doc.rect(shieldX + 1.5, shieldY + 3, 2, 1.5, 'S');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('TREATMENT PLAN', 25, 17);
  
  doc.setFontSize(12);
  doc.text(patientName, 25, 24);

  // VitaLuxe branding
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...goldColor);
  doc.text('VitaLuxe Services', pageWidth - 15, 17, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Integrated Health Management', pageWidth - 15, 22, { align: 'right' });

  yPos = 45;

  // === PLAN OVERVIEW ===
  addSectionTitle('Plan Overview');
  
  addField('Plan Title', plan.plan_title);
  addField('Status', statusLabels[plan.status]);
  addField('Created By', `${plan.created_by_name} on ${format(new Date(plan.created_at), 'MMM dd, yyyy')}`);
  
  if (plan.responsible_provider_name) {
    addField('Responsible Provider', plan.responsible_provider_name);
  }
  
  if (plan.target_completion_date) {
    addField('Target Completion', format(new Date(plan.target_completion_date), 'MMM dd, yyyy'));
  }

  if (plan.is_locked) {
    const lockInfo = plan.locked_at 
      ? `Locked on ${format(new Date(plan.locked_at), 'MMM dd, yyyy')}${plan.locked_by_name ? ` by ${plan.locked_by_name}` : ''}`
      : 'Locked';
    addField('Lock Status', lockInfo);
  }

  yPos += 5;

  // === CLINICAL INFORMATION ===
  addSectionTitle('Clinical Information');

  if (plan.diagnosis_condition) {
    addField('Diagnosis/Condition', plan.diagnosis_condition);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  checkPageBreak(8);
  doc.text('Treatment Protocols:', 10, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  const protocolLines = doc.splitTextToSize(plan.treatment_protocols, pageWidth - 25);
  checkPageBreak(protocolLines.length * 5 + 5);
  doc.text(protocolLines, 15, yPos);
  yPos += (protocolLines.length * 5) + 5;

  if (plan.notes) {
    doc.setFont('helvetica', 'bold');
    checkPageBreak(8);
    doc.text('Additional Notes:', 10, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(plan.notes, pageWidth - 25);
    checkPageBreak(notesLines.length * 5 + 5);
    doc.text(notesLines, 15, yPos);
    yPos += (notesLines.length * 5) + 5;
  }

  yPos += 5;

  // === TREATMENT GOALS ===
  addSectionTitle(`Treatment Goals (${goals.length})`);

  if (goals.length > 0) {
    checkPageBreak(50);
    
    const goalsTableData = goals.map(goal => {
      const smartBadges = [];
      if (goal.is_specific) smartBadges.push('S');
      if (goal.is_measurable) smartBadges.push('M');
      if (goal.is_achievable) smartBadges.push('A');
      if (goal.is_relevant) smartBadges.push('R');
      if (goal.is_time_bound) smartBadges.push('T');
      
      let additionalInfo = smartBadges.length > 0 ? `SMART: ${smartBadges.join(', ')}` : '';
      
      if (goal.date_achieved) {
        additionalInfo += `\nAchieved: ${format(new Date(goal.date_achieved), 'MMM dd, yyyy')}`;
      }
      
      if (goal.achievement_notes) {
        additionalInfo += `\nNotes: ${goal.achievement_notes}`;
      }

      return [
        goal.goal_description,
        goalStatusLabels[goal.status],
        additionalInfo || '-'
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Goal Description', 'Status', 'Details']],
      body: goalsTableData,
      theme: 'striped',
      headStyles: {
        fillColor: darkGrey,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: lightGrey,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 70 },
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  } else {
    checkPageBreak(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('No goals defined for this treatment plan.', 15, yPos);
    yPos += 10;
  }

  // === PROGRESS TIMELINE ===
  addSectionTitle(`Progress Timeline (${updates.length} Updates)`);

  if (updates.length > 0) {
    checkPageBreak(50);

    // Sort updates by date (most recent first)
    const sortedUpdates = [...updates].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const updatesTableData = sortedUpdates.map(update => [
      format(new Date(update.created_at), 'MMM dd, yyyy HH:mm'),
      updateTypeLabels[update.update_type],
      `${update.created_by_name} (${update.created_by_role})`,
      update.update_content,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Date/Time', 'Type', 'Created By', 'Content']],
      body: updatesTableData,
      theme: 'striped',
      headStyles: {
        fillColor: darkGrey,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: lightGrey,
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 40 },
        3: { cellWidth: 75 },
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  } else {
    checkPageBreak(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('No updates recorded for this treatment plan.', 15, yPos);
    yPos += 10;
  }

  // === ATTACHMENTS ===
  if (attachments.length > 0) {
    addSectionTitle(`Attachments (${attachments.length})`);

    checkPageBreak(50);

    const attachmentsTableData = attachments.map(attachment => {
      const sizeText = attachment.file_size 
        ? `${(attachment.file_size / 1024).toFixed(1)} KB`
        : '-';
      
      return [
        attachment.file_name,
        attachment.attachment_type.replace('_', ' '),
        sizeText,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['File Name', 'Type', 'Size']],
      body: attachmentsTableData,
      theme: 'striped',
      headStyles: {
        fillColor: darkGrey,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: lightGrey,
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 50 },
        2: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
    
    checkPageBreak(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text('Note: Attachments are available in digital format within the treatment plan.', 15, yPos);
  }

  // Add footers to all pages
  addFooter();

  // Return as Blob
  return doc.output('blob');
};
