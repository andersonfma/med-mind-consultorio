# Stage 1: build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG OPENAI_API_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
# BUILD_SHA é opcional: se o Easypanel passar o commit como build arg, ele aparece em
# /api/version. Sem ele, `builtAt` (carimbado abaixo) já prova que o build é recente.
ARG BUILD_SHA=unknown
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV OPENAI_API_KEY=$OPENAI_API_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
# Carimba commit + horário do build no momento em que o container é construído.
# Fica embutido no bundle e é servido por /api/version, permitindo verificar de fora
# qual código está no ar (e se o redeploy realmente reconstruiu).
RUN printf '{"sha":"%s","builtAt":"%s"}' "$BUILD_SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > src/build-info.json
RUN npm run build

# Stage 2: runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
