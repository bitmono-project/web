FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

FROM node:22-alpine AS final
WORKDIR /app
RUN npm init -y && npm install express@4 http-proxy-middleware@3
COPY --from=build /app/dist ./dist
COPY server.mjs ./
ENV NODE_ENV=production
EXPOSE 8429
CMD ["node", "server.mjs"]
