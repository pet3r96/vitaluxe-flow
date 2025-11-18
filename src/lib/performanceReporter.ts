/**
 * Performance Reporter - Console utility for viewing performance metrics
 */
import { getPerformanceReport, clearPerformanceMetrics } from './performanceMonitor';

/**
 * Display performance report in console
 * Usage: window.showPerformance()
 */
export const showPerformanceReport = () => {
  const report = getPerformanceReport();
  
  console.group('📊 Performance Report');
  console.log(`Total Measurements: ${report.totalMeasurements}`);
  console.log(`Average Load Time: ${report.averageLoadTime}ms`);
  
  if (report.slowestPage) {
    console.log(`🐌 Slowest: ${report.slowestPage.name} (${report.slowestPage.time}ms)`);
  }
  
  if (report.fastestPage) {
    console.log(`⚡ Fastest: ${report.fastestPage.name} (${report.fastestPage.time}ms)`);
  }
  
  console.log('\nAll Metrics:');
  console.table(report.allMetrics);
  console.groupEnd();
  
  return report;
};

/**
 * Clear all performance metrics
 * Usage: window.clearPerformance()
 */
export const clearPerformance = () => {
  clearPerformanceMetrics();
  console.log('✅ Performance metrics cleared');
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.showPerformance = showPerformanceReport;
  // @ts-ignore
  window.clearPerformance = clearPerformance;
  
  console.log('📊 Performance tools available:');
  console.log('  • window.showPerformance() - View performance report');
  console.log('  • window.clearPerformance() - Clear metrics');
}
