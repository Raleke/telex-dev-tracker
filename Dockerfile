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

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --production --legacy-peer-deps

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port for the app
EXPOSE 8080

# Define environment variables
ENV NODE_ENV=production

# Start the app
CMD ["node", "dist/index.js"]
