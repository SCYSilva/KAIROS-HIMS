# frontend/Dockerfile

FROM nginx:alpine

# Copy the pre-built static files from the local 'dist/' folder
COPY dist/ /usr/share/nginx/html

# Copy NGINX routing config (handles React Router client-side routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Setup permissions for unprivileged execution
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /usr/share/nginx/html /var/cache/nginx /etc/nginx/conf.d /var/log/nginx

USER nginx

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]