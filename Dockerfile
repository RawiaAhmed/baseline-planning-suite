# One Dockerfile, one target per container. Each app still builds on its own;
# sharing the install step only saves time.

# ---------- install all workspaces ----------
FROM node:22-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
COPY services/people-api/package.json services/people-api/
COPY services/delivery-api/package.json services/delivery-api/
COPY apps/shell/package.json apps/shell/
COPY apps/people/package.json apps/people/
COPY apps/delivery/package.json apps/delivery/
RUN npm ci
COPY . .

# ---------- APIs (run TypeScript directly with tsx) ----------
FROM deps AS people-api
WORKDIR /repo/services/people-api
ENV PEOPLE_API_PORT=4001 DATA_FILE=/data/people.json SEED_FILE=/repo/fixtures/baseline-seed.json
CMD ["npm", "start"]

FROM deps AS delivery-api
WORKDIR /repo/services/delivery-api
ENV DELIVERY_API_PORT=4002 DATA_FILE=/data/delivery.json SEED_FILE=/repo/fixtures/baseline-seed.json
CMD ["npm", "start"]

# ---------- front-end builds ----------
FROM deps AS shell-build
RUN npm run build -w @baseline/shell

FROM deps AS people-build
RUN npm run build -w @baseline/people

FROM deps AS delivery-build
RUN npm run build -w @baseline/delivery

# ---------- front-end containers (nginx) ----------
FROM nginx:1.27-alpine AS shell
COPY docker/shell.nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/write-config.sh /docker-entrypoint.d/40-write-config.sh
RUN chmod +x /docker-entrypoint.d/40-write-config.sh
COPY --from=shell-build /repo/apps/shell/dist /usr/share/nginx/html

FROM nginx:1.27-alpine AS people-web
COPY docker/remote.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=people-build /repo/apps/people/dist /usr/share/nginx/html

FROM nginx:1.27-alpine AS delivery-web
COPY docker/remote.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=delivery-build /repo/apps/delivery/dist /usr/share/nginx/html
