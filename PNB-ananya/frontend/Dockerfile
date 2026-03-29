FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Expose Vite's default dev port
EXPOSE 5173

# Run Vite in dev mode with host zero to bind to Docker interface
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
