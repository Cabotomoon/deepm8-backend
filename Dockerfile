# DeepM8 Backend - Railway Production Build
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy application source
COPY index.js ./

# Railway sets PORT automatically, expose default
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]
