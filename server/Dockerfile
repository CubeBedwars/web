# Voxel Bedwars Dedicated Multiplayer & Uptime Monitoring Server
# Lightweight alpine container suitable for 24/7 free tier container runtimes (e.g. Koyeb, Hugging Face Spaces Docker, Fly.io, Railway)

FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy application source
COPY index.js ./

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run server
CMD ["node", "index.js"]
