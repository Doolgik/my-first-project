# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_PUSHER_KEY
ARG VITE_PUSHER_CLUSTER
ARG VITE_PUSHER_HOST
ARG VITE_PUSHER_PORT
ARG VITE_PUSHER_USE_TLS
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUSHER_KEY=$VITE_PUSHER_KEY
ENV VITE_PUSHER_CLUSTER=$VITE_PUSHER_CLUSTER
ENV VITE_PUSHER_HOST=$VITE_PUSHER_HOST
ENV VITE_PUSHER_PORT=$VITE_PUSHER_PORT
ENV VITE_PUSHER_USE_TLS=$VITE_PUSHER_USE_TLS
RUN npm run build

# --- Runtime stage (nginx) ---
FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
