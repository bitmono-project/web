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
RUN npm init -y && npm install express@4 http-proxy-middleware@3 @resvg/resvg-js@2 marked@18
COPY --from=build /app/dist ./dist
# All server modules (server.mjs entrypoint + og.mjs, seo.mjs, blog.mjs it imports). Glob so a new module
# can't be left out of the image — that crash-loops the container (ERR_MODULE_NOT_FOUND).
COPY *.mjs ./
COPY og ./og
COPY blog ./blog
ENV NODE_ENV=production
EXPOSE 8429
CMD ["node", "server.mjs"]
