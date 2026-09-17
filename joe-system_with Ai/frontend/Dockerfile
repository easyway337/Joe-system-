# Joe System (Nexus) — Frontend image
# Build:  docker build -t nexus-frontend ./frontend
# Run:    docker run -p 80:80 nexus-frontend
#
# There's no build step — this is plain HTML/CSS/JS — so the "build" is
# just nginx serving the files as-is. Before building this image for a real
# deployment, fill in the real values in js/supabase-config.js (see README);
# those values (Supabase URL + anon key) are meant to be public, so baking
# them into the image at build time is fine.

FROM nginx:1.27-alpine

# Copied explicitly (rather than `COPY . .`) so Dockerfile/nginx.conf/
# .dockerignore never end up served as static files by mistake.
COPY index.html crm.html erp.html login.html register.html /usr/share/nginx/html/
COPY css/        /usr/share/nginx/html/css/
COPY js/         /usr/share/nginx/html/js/
COPY components/ /usr/share/nginx/html/components/

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/index.html > /dev/null || exit 1
