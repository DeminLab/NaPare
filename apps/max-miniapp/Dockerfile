FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/max-miniapp/dist /usr/share/nginx/html
COPY apps/max-miniapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
