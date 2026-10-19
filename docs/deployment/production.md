# NaPare production deployment

This repository prepares the Docker side of the deployment. The production server, system Nginx, DNS, SSL and Cockpit remain outside the repository and must be configured by the operator.

## Domains

| Domain | Application |
|---|---|
| `napare.sano.ru` | Main page and shared login via Docker Nginx (`127.0.0.1:8080`) |
| `napare.sano.ru/student/` | Student workspace (`127.0.0.1:3002`) |
| `napare.sano.ru/staff/` | Teacher/staff workspace (`127.0.0.1:3003`) |
| `napare.sano.ru/deanery/` | Deanery workspace (`127.0.0.1:3004`) |
| `napare.sano.ru/developer/` | Developer workspace (`127.0.0.1:3005`, routed by Docker Nginx) |
| `napare.sano.ru/max/` | Main web portal with MAX Bridge login (routed by Docker Nginx) |
| `napare.sano.ru/admin/` | Cockpit (`127.0.0.1:9090`) |

`napare.sano.ru/deanery/` is intentionally distinct from the host-owned Cockpit location at `napare.sano.ru/admin/`.

## DNS

Create these `A` records at the DNS provider, all pointing to the production server IP:

`napare.sano.ru` and `www.napare.sano.ru`.

DNS changes are not performed by this project.

### Using a different public domain

The checked-in production defaults target `napare.sano.ru`. If the hackathon deployment uses another domain, update the origin consistently before building:

1. Set `CORS_ORIGIN`, all four `NEXT_PUBLIC_*_URL` values, and `PUBLIC_APP_URL` in the private `.env` file to the new HTTPS origin and its `/student`, `/staff`, `/deanery`, and `/developer` paths.
2. Replace the canonical host and certificate paths in `deploy/nginx/*.conf.example` and the `server_name` in `infrastructure/nginx/nginx.conf`; request certificates for the new apex and any `www` name you use.
3. Point DNS and the host's HTTPS reverse proxy to this deployment's loopback port `127.0.0.1:8080`.
4. Set the approved MAX bot's Open button and `MAX_PUBLIC_URL` for `scripts/verify-max-deployment.sh` to the same public HTTPS origin. The MAX URL must be the site root (or `/max/` alias), not a Docker-only address.

Build the frontend images after changing the `.env` values because the `NEXT_PUBLIC_*_URL` settings are embedded at image build time. This Compose setup expects the browser to use the website origin and Nginx to proxy `/api/` to the backend. Hosting the API on a separate public origin needs an additional proxy/client configuration change and a matching `CORS_ORIGIN` entry.

## Backend outbound connectivity

The backend joins `egress` for outbound HTTPS to `rasp.sano.ru` and other integrations. The `app` and `data` networks remain internal; no new host port is published. A backend attached only to internal networks cannot reach the schedule source and returns 502 for `/api/v1/auth/rasp-years`.

After updating Compose, recreate the backend with `docker compose -f docker-compose.prod.yml up -d --no-deps backend`. Verify the public source from inside the container and `/api/v1/auth/rasp-years` through Nginx. Rebuild changed web images for the manifest and MAX/client fixes.

## Server deployment

After the repository has been cloned and the private `.env` has been configured, update `main` and rebuild the production Compose stack from the repository root:

```bash
git pull --ff-only origin main
docker compose config
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend nginx web-portal web-student web-staff web-admin web-developer
curl -fsS http://127.0.0.1:8080/api/v1/health
curl -fsS http://127.0.0.1:3001/
curl -fsS http://127.0.0.1:3002/student/today
curl -fsS http://127.0.0.1:3003/staff/today
curl -fsS http://127.0.0.1:3004/deanery/dashboard
curl -fsS http://127.0.0.1:3005/developer/login
```

In production the backend runs pending TypeORM migrations automatically when it starts (`migrationsRun: true`). No separate migration command is required for this Compose deployment. Review backend startup logs and confirm the migration table is current. Back up PostgreSQL before release; never run `docker compose down -v`.

Do not use `docker compose down -v`, `docker system prune`, or any command that removes volumes. The Compose file keeps PostgreSQL and Redis on internal networks and binds the web ports to loopback only.

Copy the templates from `deploy/nginx/` to the system Nginx configuration directory, remove `.example`, set certificate paths, then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

The templates cover HTTPS and HTTP-to-HTTPS redirects. Obtain/renew certificates on the server with the existing ACME/Certbot process; include the apex and all four subdomains. If Certbot is used, verify with `sudo certbot certificates` and `sudo certbot renew --dry-run`.

## Post-deploy checklist

Changes prepared on 2026-10-16 add migrations `1700000000020` (curator assignments) and `1700000000021` (platform control). Review both and take a restorable database backup before updating backend. Owner binding and the optional host agent require the separate [platform control installation](platform-control.md); a Git push does not install or activate them. Android is built independently: see [Android guide](../clients/android-webview.md) and [RuStore preparation](rustore-publication.md).

- After the GitHub staging workflow deploys an image set, its smoke job runs `scripts/verify-max-deployment.sh` against `STAGING_URL`; production still requires the same check after its manual server deployment.
- `docker compose ps` shows healthy backend, web apps and Docker Nginx.
- Docker Nginx health is checked through `/nginx-health`; separately check `/` and `/max/` so an application error is not mistaken for an Nginx process failure.
- `https://napare.sano.ru/` loads the main page and `https://napare.sano.ru/login` is the only public login.
- All role credentials use the shared `https://napare.sano.ru/login`; developer accounts redirect to `/developer/api` on the same domain.
- Each workspace can call same-origin `/api/v1/health`/API routes and refresh/logout returns to the shared login.
- `https://napare.sano.ru/admin/` remains Cockpit, while `https://napare.sano.ru/deanery/` reaches the deanery frontend.
- Run `bash scripts/verify-max-deployment.sh` after deploy. It checks for the same landing-page marker and MAX Bridge script on `/` and `/max/`, and reports the retired Vite app when its `/max/assets/` bundle path is still served. An HTTP 200 alone is insufficient. Separately verify on a real MAX device that the bot's configured Open button launches the site, MAX Bridge authentication redirects linked users to their role workspace, and first-link plus QR attendance work; source checks alone do not confirm these platform and production settings.
- Browser devtools show no requests to Docker-only names, `localhost`, `127.0.0.1` or ports `3000`–`3006`.
- PostgreSQL, Redis and the web ports are not reachable from the public interface.
- `sudo nginx -t` passes and certificate renewal is scheduled/tested.

Production DNS, TLS, external Nginx routing, Cockpit and public-browser checks require the production server: **Требует проверки на production-сервере**.
