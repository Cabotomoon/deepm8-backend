# Production-ready Node.js image for Railway
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
# Use npm ci for faster, reproducible builds
RUN npm ci --only=production

# Copy application code
COPY index.js ./
COPY .env* ./ 2>/dev/null || true

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Railway automatically sets PORT env var
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-3001}/health', (r) => {if(r.statusCode === 200) process.exit(0); else process.exit(1);})"

# Start the application
CMD ["node", "index.js"]
