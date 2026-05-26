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

# ── prisma-cli: instala o CLI com todas as deps transitivas num dir isolado.
#    O npm install completo garante a arvore correta de sub-deps que o
#    @prisma/config precisa ao carregar prisma.config.ts em runtime. ──
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

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Prisma client gerado pelo builder (necessario para o app Next em runtime)
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Deps transitivas completas de @prisma/config + prisma CLI
# (calculadas via npm ls: effect, c12 e sub-deps, fast-check, pure-rand, etc.)
COPY --from=prisma-cli /prisma-runner/node_modules/@standard-schema ./node_modules/@standard-schema
COPY --from=prisma-cli /prisma-runner/node_modules/c12 ./node_modules/c12
COPY --from=prisma-cli /prisma-runner/node_modules/chokidar ./node_modules/chokidar
COPY --from=prisma-cli /prisma-runner/node_modules/confbox ./node_modules/confbox
COPY --from=prisma-cli /prisma-runner/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=prisma-cli /prisma-runner/node_modules/defu ./node_modules/defu
COPY --from=prisma-cli /prisma-runner/node_modules/destr ./node_modules/destr
COPY --from=prisma-cli /prisma-runner/node_modules/dotenv ./node_modules/dotenv
COPY --from=prisma-cli /prisma-runner/node_modules/effect ./node_modules/effect
COPY --from=prisma-cli /prisma-runner/node_modules/empathic ./node_modules/empathic
COPY --from=prisma-cli /prisma-runner/node_modules/exsolve ./node_modules/exsolve
COPY --from=prisma-cli /prisma-runner/node_modules/fast-check ./node_modules/fast-check
COPY --from=prisma-cli /prisma-runner/node_modules/giget ./node_modules/giget
COPY --from=prisma-cli /prisma-runner/node_modules/jiti ./node_modules/jiti
COPY --from=prisma-cli /prisma-runner/node_modules/ohash ./node_modules/ohash
COPY --from=prisma-cli /prisma-runner/node_modules/pathe ./node_modules/pathe
COPY --from=prisma-cli /prisma-runner/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=prisma-cli /prisma-runner/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=prisma-cli /prisma-runner/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=prisma-cli /prisma-runner/node_modules/rc9 ./node_modules/rc9
COPY --from=prisma-cli /prisma-runner/node_modules/readdirp ./node_modules/readdirp
COPY --from=prisma-cli /prisma-runner/node_modules/prisma ./node_modules/prisma

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# node <realpath do CLI> garante que __dirname = node_modules/prisma/build/
# (evita o problema do symlink .bin/prisma resolvendo __dirname errado no wasm)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
