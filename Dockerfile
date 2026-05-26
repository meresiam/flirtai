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
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# prisma CLI invocado pelo caminho real (nao via .bin/prisma symlink): o Prisma 7
# resolve os .wasm relativo ao dir do entrypoint, e via symlink ele procurava em
# .bin/ em vez de prisma/build/. node <realpath> faz __dirname = prisma/build/.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
