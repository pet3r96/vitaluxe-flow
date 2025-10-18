# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build arguments for Supabase credentials (optional)
ARG VITE_SUPABASE_URL="https://qbtsfajshnrwwlfzkeog.supabase.co"
ARG VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidHNmYWpzaG5yd3dsZnprZW9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5OTQxMTEsImV4cCI6MjA3NTU3MDExMX0.dqoXG339wvLXWT-uphEjdslgxZD12DBwyrfaFi4NOro"

# Set environment variables for build process (with defaults)
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install wget for health checks and serve for static file serving
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Set production environment
ENV NODE_ENV=production
ENV PORT=80

# Install serve globally for static file serving
RUN npm install -g serve

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Set proper permissions
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose correct port (matching deploy.yml)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Start the application with serve
CMD ["serve", "-s", "dist", "-l", "80"]
