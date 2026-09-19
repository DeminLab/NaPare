# NaPare production deployment

This repository prepares the Docker side of the deployment. The production server, system Nginx, DNS, SSL and Cockpit remain outside the repository and must be configured by the operator.

## Domains

| Domain | Application |
|---|---|
| `napare.sano.ru` | Main page and shared login via Docker Nginx (`127.0.0.1:8080`) |
| `napare.sano.ru/student/` | Student workspace (`127.0.0.1:3002`) |
| `napare.sano.ru/staff/` | Teacher/staff workspace (`127.0.0.1:3003`) |
| `napare.sano.ru/deanery/` | Deanery workspace (`127.0.0.1:3004`) |
| `developer.napare.sano.ru` | Developer (`127.0.0.1:3005`) |
| `napare.sano.ru/admin/` | Cockpit (`127.0.0.1:9090`) |

`napare.sano.ru/deanery/` is intentionally distinct from the host-owned Cockpit location at `napare.sano.ru/admin/`.

## DNS

Create these `A` records at the DNS provider, all pointing to the production server IP:

`napare.sano.ru`, `www.napare.sano.ru`, `developer.napare.sano.ru`.

DNS changes are not performed by this project.

## Server deployment

On the server, after copying the repository and creating a private `.env` from `.env.example`:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend nginx web-portal web-student web-staff web-admin web-developer
curl -fsS http://127.0.0.1:8080/api/v1/health
curl -fsS http://127.0.0.1:3001/
curl -fsS http://127.0.0.1:3002/student/today
curl -fsS http://127.0.0.1:3003/staff/today
curl -fsS http://127.0.0.1:3004/deanery/dashboard
curl -fsS http://127.0.0.1:3005/
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
- `https://napare.sano.ru/` loads the main page and `https://napare.sano.ru/login` is the only public login.
- Role credentials redirect to `https://napare.sano.ru/student/`, `/staff/` or `/deanery/`; developer login remains on `https://developer.napare.sano.ru/`.
- Each workspace can call same-origin `/api/v1/health`/API routes and refresh/logout returns to the shared login.
- `https://napare.sano.ru/admin/` remains Cockpit, while `https://napare.sano.ru/deanery/` reaches the deanery frontend.
- Browser devtools show no requests to Docker-only names, `localhost`, `127.0.0.1` or ports `3000`–`3005`.
- PostgreSQL, Redis and the web ports are not reachable from the public interface.
- `sudo nginx -t` passes and certificate renewal is scheduled/tested.

Production DNS, TLS, external Nginx routing, Cockpit and public-browser checks require the production server: **Требует проверки на production-сервере**.
