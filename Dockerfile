# syntax=docker/dockerfile:1

# --- Angular production build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src

# Auth0 callback/logout/web origins must match the public URL (Compose serves on :80).
ARG AUTH0_APP_ORIGIN=http://localhost
RUN sed -i "s|export const AUTH0_APP_ORIGIN = '.*'|export const AUTH0_APP_ORIGIN = '${AUTH0_APP_ORIGIN}'|" \
  src/app/core/auth/auth0.config.ts

RUN npm run build

# --- nginx: SPA + reverse proxy to API ---
FROM nginx:1.27-alpine AS final
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/game-library/browser /usr/share/nginx/html

EXPOSE 80
