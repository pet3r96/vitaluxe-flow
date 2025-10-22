/**
 * Performance utilities for monitoring and optimization
 */

/**
 * Debounce function - limits how often a function can be called
 * Useful for search inputs, scroll handlers, etc.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function - ensures function is called at most once per interval
 * Useful for resize handlers, scroll events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Measure component render time
 */
export const measureRenderTime = (componentName: string) => {
  const start = performance.now();
  return () => {
    const end = performance.now();
    console.log(`${componentName} rendered in ${(end - start).toFixed(2)}ms`);
  };
};

/**
 * Check if device is mobile for conditional loading
 */
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Lazy load images with intersection observer
 */
export const lazyLoadImage = (img: HTMLImageElement) => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const imgElement = entry.target as HTMLImageElement;
          imgElement.src = imgElement.dataset.src || "";
          imgElement.classList.add("loaded");
          observer.unobserve(imgElement);
        }
      });
    },
    {
      rootMargin: "50px",
    }
  );

  observer.observe(img);
};

/**
 * Batch multiple state updates
 */
export const batchUpdates = <T>(updates: (() => void)[]) => {
  // React 18 automatic batching handles this, but keeping for explicit control
  updates.forEach((update) => update());
};
