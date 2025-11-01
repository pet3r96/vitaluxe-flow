import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';

describe('Time Format Consistency', () => {
  it('should format morning times with AM', () => {
    const date = new Date('2025-11-01T09:00:00Z');
    const formatted = format(date, 'h:mm a');
    
    expect(formatted).toMatch(/^\d{1,2}:\d{2} AM$/);
    expect(formatted).not.toContain('09:00'); // Should not have leading zero
    expect(formatted).not.toContain('09:00:00'); // Should not have seconds
  });

  it('should format afternoon times with PM', () => {
    const date = new Date('2025-11-01T14:30:00Z');
    const formatted = format(date, 'h:mm a');
    
    expect(formatted).toMatch(/^\d{1,2}:\d{2} PM$/);
    expect(formatted).not.toContain('14:30'); // Should not be 24-hour format
    expect(formatted).not.toContain('14:30:00'); // Should not have seconds
  });

  it('should format late night times with PM', () => {
    const date = new Date('2025-11-01T23:00:00Z');
    const formatted = format(date, 'h:mm a');
    
    expect(formatted).toMatch(/11:00 PM/);
    expect(formatted).not.toContain('23:00'); // Should not be 24-hour format
  });

  it('should format noon correctly', () => {
    const date = new Date('2025-11-01T12:00:00Z');
    const formatted = format(date, 'h:mm a');
    
    expect(formatted).toMatch(/12:00 PM/);
  });

  it('should format midnight correctly', () => {
    const date = new Date('2025-11-01T00:00:00Z');
    const formatted = format(date, 'h:mm a');
    
    expect(formatted).toMatch(/12:00 AM/);
  });

  it('should never include seconds in appointment times', () => {
    const times = [
      new Date('2025-11-01T09:00:00Z'),
      new Date('2025-11-01T14:30:00Z'),
      new Date('2025-11-01T23:00:00Z'),
    ];

    times.forEach(time => {
      const formatted = format(time, 'h:mm a');
      expect(formatted).not.toMatch(/:\d{2}:\d{2}/); // Should not have :MM:SS
      expect(formatted).toMatch(/^\d{1,2}:\d{2} [AP]M$/); // Should be H:MM AM/PM
    });
  });

  it('should maintain consistency across date-fns format patterns', () => {
    const date = new Date('2025-11-01T14:30:00Z');
    
    // All these patterns should produce 12-hour format
    const pattern1 = format(date, 'h:mm a'); // 2:30 PM
    const pattern2 = format(date, 'h:mma'); // 2:30PM (no space)
    const pattern3 = format(date, "h:mm aaaaa'm'"); // 2:30 p
    
    expect(pattern1).toContain('PM');
    expect(pattern2).toContain('PM');
    
    // Should never produce 24-hour format
    expect(pattern1).not.toContain('14:');
    expect(pattern1).not.toContain('14:30');
  });

  it('should format time ranges correctly', () => {
    const start = new Date('2025-11-01T14:30:00Z');
    const end = new Date('2025-11-01T15:00:00Z');
    
    const startFormatted = format(start, 'h:mm a');
    const endFormatted = format(end, 'h:mm a');
    const range = `${startFormatted} - ${endFormatted}`;
    
    expect(range).toMatch(/\d{1,2}:\d{2} PM - \d{1,2}:\d{2} PM/);
    expect(range).not.toContain('14:');
    expect(range).not.toContain('15:');
  });

  it('should handle timezone conversions while maintaining 12-hour format', () => {
    // Even with timezone conversions, output should be 12-hour
    const utcDate = new Date('2025-11-01T14:30:00Z');
    const formatted = format(utcDate, 'h:mm a');
    
    // Regardless of input timezone, output should be 12-hour with AM/PM
    expect(formatted).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
  });

  it('should not drift time values by minutes', () => {
    const originalTime = new Date('2025-11-01T14:30:00Z');
    const formatted = format(originalTime, 'h:mm a');
    
    // Should maintain exact minute values
    expect(formatted).toContain(':30');
    expect(formatted).not.toContain(':29'); // No drift to 14:29
    expect(formatted).not.toContain(':31'); // No drift to 14:31
  });
});
