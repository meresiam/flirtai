FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ── deps ──
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY tsconfig.json ./tsconfig.json
RUN npm ci

# ── prisma-cli: instala o CLI com todas as deps transitivas (effect, c12, etc.)
#    num dir isolado para nao contaminar o bundle da app ──
FROM base AS prisma-cli
WORKDIR /prisma-runner
RUN npm install prisma@7.8.0 --save-exact 2>&1

# ── builder ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ── runner ──
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Prisma client (gerado pelo builder — necessario para o app em runtime)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg

# Prisma CLI completo com todas as deps transitivas (effect, c12, empathic, etc.)
COPY --from=prisma-cli /prisma-runner/node_modules /prisma-runner/node_modules

RUN chown -R nextjs:nodejs /app /prisma-runner
USER nextjs

EXPOSE 3000

# Usa o CLI do prisma-runner (tem todas as deps) para migrate, depois sobe o Next
CMD ["sh", "-c", "node /prisma-runner/node_modules/prisma/build/index.js migrate deploy && node server.js"]
