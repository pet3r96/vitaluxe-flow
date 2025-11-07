# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_BUILD_ID="dev"

ENV npm_config_yes=true

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_BUILD_ID=$VITE_BUILD_ID

COPY package*.json ./
RUN apk add --no-cache python3 make g++ libc6-compat
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy built assets and node_modules from builder to avoid reinstalling
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Run serve directly from node_modules
CMD ["node_modules/.bin/serve", "-s", "dist", "-l", "8080"]

