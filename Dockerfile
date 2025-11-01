# Build stage
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --legacy-peer-deps

# Copy the rest of the code
COPY . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Add metadata labels
LABEL maintainer="telex-dev-tracker"
LABEL version="1.0.0"
LABEL description="Telex Dev Tracker - A development tracking assistant bot"

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory inside the container
WORKDIR /app

# Change ownership of /app to nodejs user
RUN chown -R nodejs:nodejs /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Switch to nodejs user for dependency installation
USER nodejs

# Install production dependencies only
RUN npm ci --production --legacy-peer-deps && npm cache clean --force

# Switch back to root for copying built files
USER root

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership of dist directory only to non-root user
RUN chown -R nodejs:nodejs /app/dist

# Switch back to nodejs user
USER nodejs

# Expose port for the app
EXPOSE 8080

# Define environment variables
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the app
CMD ["node", "dist/index.js"]
