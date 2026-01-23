FROM node:18-slim AS builder

WORKDIR /app

# Install dependencies separately for caching
COPY package*.json ./
RUN npm install

# Copy all source
COPY . .

# Set build environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the app
RUN npm run build

# Runner stage
FROM node:18-slim AS runner

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Environment variables for execution
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
