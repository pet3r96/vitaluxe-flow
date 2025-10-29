import { format } from 'date-fns';

/**
 * Download a base64-encoded PDF file
 */
export const downloadPdfFromBase64 = (
  base64Data: string,
  filename: string
) => {
  const linkSource = `data:application/pdf;base64,${base64Data}`;
  const downloadLink = document.createElement("a");
  downloadLink.href = linkSource;
  downloadLink.download = filename;
  downloadLink.click();
};

/**
 * Format appointment time range for display
 */
export const formatAppointmentTime = (startTime: string, endTime: string) => {
  return `${format(new Date(startTime), 'h:mm a')} - ${format(new Date(endTime), 'h:mm a')}`;
};

/**
 * Get formatted status text with emoji
 */
export const getStatusBadgeText = (status: string) => {
  const statusMap: Record<string, string> = {
    'scheduled': '✓ Scheduled',
    'confirmed': '✓✓ Confirmed',
    'checked_in': '→ Checked In',
    'in_progress': '⚡ In Progress',
    'completed': '✅ Completed',
    'cancelled': '❌ Cancelled',
    'no_show': '⊘ No Show',
    'rescheduled': '↻ Rescheduled'
  };
  return statusMap[status] || status;
};

/**
 * Generate filename for daily schedule PDF
 */
export const generateScheduleFilename = (
  date: Date,
  providerName?: string
): string => {
  const dateStr = format(date, 'yyyy-MM-dd');
  if (providerName && providerName !== 'All Providers') {
    const sanitizedName = providerName.replace(/[^a-z0-9]/gi, '_');
    return `${sanitizedName}_Schedule_${dateStr}.pdf`;
  }
  return `DailySchedule_${dateStr}.pdf`;
};
