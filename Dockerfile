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

# ── prisma-cli: instala o CLI completo num dir isolado.
#    Todo o node_modules daqui e mesclado no runner para que o CLI tenha
#    todas as deps transitivas disponiveis (effect, @prisma/dev, proper-lockfile, etc.). ──
FROM base AS prisma-cli
WORKDIR /prisma-runner
RUN npm install prisma@7.8.0 --save-exact

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

# curl: necessario para o healthcheck do Coolify (alpine nao tem por padrao)
RUN apk add --no-cache curl

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Prisma client gerado pelo builder (necessario para o app Next em runtime)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Mescla TODO o node_modules do prisma-cli: garante que o CLI tem
# acesso a todas as deps transitivas sem ter que listar individualmente.
COPY --from=prisma-cli /prisma-runner/node_modules ./node_modules

# Sobrescreve com o @prisma client gerado pelo builder (tem o client compilado
# contra o schema especifico do projeto — nao o generico do prisma-cli)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
