# NaPare production deployment

This repository prepares the Docker side of the deployment. The production server, system Nginx, DNS, SSL and Cockpit remain outside the repository and must be configured by the operator.

## Domains

| Domain | Application |
|---|---|
| `napare.sano.ru` | Main site via Docker Nginx (`127.0.0.1:8080`) |
| `student.napare.sano.ru` | Student (`127.0.0.1:3001`) |
| `teacher.napare.sano.ru` | Teacher/staff (`127.0.0.1:3002`) |
| `admin.napare.sano.ru` | Admin (`127.0.0.1:3003`) |
| `developer.napare.sano.ru` | Developer (`127.0.0.1:3004`) |
| `napare.sano.ru/admin/` | Cockpit (`127.0.0.1:9090`) |

`admin.napare.sano.ru` and `napare.sano.ru/admin/` are separate virtual hosts/locations and must not be merged.

## DNS

Create these `A` records at the DNS provider, all pointing to the production server IP:

`napare.sano.ru`, `student.napare.sano.ru`, `teacher.napare.sano.ru`, `admin.napare.sano.ru`, `developer.napare.sano.ru`.

DNS changes are not performed by this project.

## Server deployment

On the server, after copying the repository and creating a private `.env` from `.env.example`:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend nginx web-student web-staff web-admin web-developer
curl -fsS http://127.0.0.1:8080/api/v1/health
curl -fsS http://127.0.0.1:3001/
curl -fsS http://127.0.0.1:3002/
curl -fsS http://127.0.0.1:3003/
curl -fsS http://127.0.0.1:3004/
```

Do not use `docker compose down -v`, `docker system prune`, or any command that removes volumes. The Compose file keeps PostgreSQL and Redis on internal networks and binds the web ports to loopback only.

Copy the templates from `deploy/nginx/` to the system Nginx configuration directory, remove `.example`, set certificate paths, then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The templates cover HTTPS and HTTP-to-HTTPS redirects. Obtain/renew certificates on the server with the existing ACME/Certbot process; include the apex and all four subdomains. If Certbot is used, verify with `sudo certbot certificates` and `sudo certbot renew --dry-run`.

## Post-deploy checklist

- `docker compose ps` shows healthy backend, web apps and Docker Nginx.
- `https://napare.sano.ru/` loads the main app.
- `https://student.napare.sano.ru/`, `https://teacher.napare.sano.ru/`, `https://admin.napare.sano.ru/` and `https://developer.napare.sano.ru/` load at `/`, without `/student`, `/teacher`, `/admin` or `/developer` prefixes.
- Each app can call its same-origin `/api/v1/health`/API routes and login/refresh/logout works.
- `https://napare.sano.ru/admin/` reaches Cockpit, while `https://admin.napare.sano.ru/` reaches the admin frontend.
- Browser devtools show no requests to Docker-only names, `localhost`, `127.0.0.1` or ports `3000`–`3004`.
- PostgreSQL, Redis and the web ports are not reachable from the public interface.
- `sudo nginx -t` passes and certificate renewal is scheduled/tested.

Production DNS, TLS, external Nginx routing, Cockpit and public-browser checks require the production server: **Требует проверки на production-сервере**.
