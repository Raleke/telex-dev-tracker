# Use lightweight Node 20 image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install production dependencies
RUN npm ci --production --legacy-peer-deps

# Copy the rest of the code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port for the app
EXPOSE 8080

# Define environment variables
ENV NODE_ENV=production

# Start the app
CMD ["node", "dist/index.js"]