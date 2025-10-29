interface AppointmentWithLayout {
  id: string;
  start_time: string;
  end_time: string;
  columnIndex: number;
  columnWidth: number;
  columnLeft: number;
  maxConcurrent: number;
}

export function doAppointmentsOverlap(a: any, b: any): boolean {
  const aStart = new Date(a.start_time).getTime();
  const aEnd = new Date(a.end_time).getTime();
  const bStart = new Date(b.start_time).getTime();
  const bEnd = new Date(b.end_time).getTime();
  
  return aStart < bEnd && bStart < aEnd;
}

export function detectOverlaps(appointments: any[]): any[] {
  if (appointments.length === 0) return [];
  
  // Sort appointments by start time, then by duration (longer first)
  const sorted = [...appointments].sort((a, b) => {
    const aStart = new Date(a.start_time).getTime();
    const bStart = new Date(b.start_time).getTime();
    if (aStart !== bStart) return aStart - bStart;
    
    const aDuration = new Date(a.end_time).getTime() - aStart;
    const bDuration = new Date(b.end_time).getTime() - bStart;
    return bDuration - aDuration; // Longer appointments first
  });
  
  const result: any[] = [];
  const columns: any[][] = [];
  
  for (const appointment of sorted) {
    // Find the first column where this appointment doesn't overlap with any existing appointment
    let placed = false;
    
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const column = columns[colIndex];
      const hasOverlap = column.some(existing => doAppointmentsOverlap(appointment, existing));
      
      if (!hasOverlap) {
        column.push(appointment);
        
        // Find all appointments that overlap with this one to calculate max concurrent
        const overlapping = sorted.filter(other => 
          other.id !== appointment.id && doAppointmentsOverlap(appointment, other)
        );
        const maxConcurrent = overlapping.length + 1;
        
        result.push({
          ...appointment,
          columnIndex: colIndex,
          columnWidth: (100 / maxConcurrent) - 0.5, // Small gap between columns
          columnLeft: (100 / maxConcurrent) * colIndex,
          maxConcurrent
        });
        
        placed = true;
        break;
      }
    }
    
    // If not placed in any existing column, create a new column
    if (!placed) {
      columns.push([appointment]);
      
      const overlapping = sorted.filter(other => 
        other.id !== appointment.id && doAppointmentsOverlap(appointment, other)
      );
      const maxConcurrent = overlapping.length + 1;
      
      result.push({
        ...appointment,
        columnIndex: columns.length - 1,
        columnWidth: (100 / maxConcurrent) - 0.5,
        columnLeft: (100 / maxConcurrent) * (columns.length - 1),
        maxConcurrent
      });
    }
  }
  
  return result;
}
