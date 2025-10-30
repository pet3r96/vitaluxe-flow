import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    // Only enable security headers in production to allow preview iframe in development
    mode === "production" && {
      name: 'security-headers',
      configureServer(server: any) {
        server.middlewares.use((_req: any, res: any, next: any) => {
          res.setHeader('X-Frame-Options', 'DENY');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-XSS-Protection', '1; mode=block');
          res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Aggressive chunk splitting for optimal caching and lazy loading
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React framework (must stay together)
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'react-vendor';
          }
          
          // React Query (separate for better caching)
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
          
          // Supabase
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase-vendor';
          }
          
          // All Radix UI components (heavily used)
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          
          // Form libraries
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'form-vendor';
          }
          
          // Chart libraries (lazy load only when needed)
          if (id.includes('chart.js') || id.includes('recharts') || id.includes('react-chartjs-2')) {
            return 'chart-vendor';
          }
          
          // PDF generation (lazy load only when needed)
          if (id.includes('jspdf')) {
            return 'pdf-vendor';
          }
          
          // Date libraries
          if (id.includes('date-fns')) {
            return 'date-vendor';
          }
          
          // Lucide icons (separate chunk)
          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }
          
          // Node modules not matched above
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Stricter chunk size warning limit (400kb instead of 500kb)
    chunkSizeWarningLimit: 400,
    // Enable minification with aggressive settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
        pure_funcs: mode === 'production' ? ['console.log', 'console.info'] : [],
        passes: 2, // Multiple passes for better compression
      },
      mangle: {
        safari10: true, // Safari 10 support
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query', '@supabase/supabase-js'],
  },
}));
