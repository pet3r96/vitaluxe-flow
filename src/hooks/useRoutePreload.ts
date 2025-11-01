import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface PreloadConfig {
  route: string;
  queryKey: string[];
  queryFn: () => Promise<any>;
}

/**
 * Preload data for likely next routes to reduce loading time
 * 
 * Usage: useRoutePreload([
 *   { route: '/orders', queryKey: ['orders'], queryFn: fetchOrders },
 * ]);
 */
export const useRoutePreload = (configs: PreloadConfig[]) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const handleLinkHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      // Find matching preload config
      const config = configs.find(c => href.includes(c.route));
      if (!config) return;

      // Debounce - only preload if user hovers for 200ms
      const timeoutId = setTimeout(() => {
        // Check if data is already cached
        const cached = queryClient.getQueryData(config.queryKey);
        if (!cached) {
          // Prefetch data in background
          queryClient.prefetchQuery({
            queryKey: config.queryKey,
            queryFn: config.queryFn,
            staleTime: 5 * 60 * 1000, // Use cached data for 5 minutes
          });
        }
      }, 200);

      // Clear timeout if mouse leaves quickly
      const handleMouseLeave = () => clearTimeout(timeoutId);
      link.addEventListener('mouseleave', handleMouseLeave, { once: true });
    };

    document.addEventListener('mouseover', handleLinkHover);
    return () => document.removeEventListener('mouseover', handleLinkHover);
  }, [configs, queryClient, user]);
};
