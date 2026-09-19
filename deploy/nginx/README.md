# System Nginx templates

These files are templates for the **system Nginx on the production host**. They are not Docker configuration and are not applied automatically by this repository.

Before enabling them:

1. Create DNS `A` records for `napare.sano.ru`, `www.napare.sano.ru` and `developer.napare.sano.ru` pointing to the server IP. The former student, teacher and admin host templates only redirect old bookmarks to the shared origin.
2. Copy the matching `.conf.example` files to the host's Nginx configuration directory, remove the `.example` suffix, and adjust paths if the distribution uses a different layout.
3. Install certificates for the apex, `www` and developer names. Keep the legacy names in a certificate only while their redirect templates remain enabled. A wildcard `*.napare.sano.ru` does not cover the apex `napare.sano.ru`, so include both names in the certificate request.
4. Replace the certificate paths in the templates, then run `sudo nginx -t` and `sudo systemctl reload nginx`.

The Docker stack binds only to loopback:

- `127.0.0.1:8080` — Docker Nginx for `napare.sano.ru`;
- `127.0.0.1:3001` — portal;
- `127.0.0.1:3002` — student;
- `127.0.0.1:3003` — teacher/staff;
- `127.0.0.1:3004` — deanery;
- `127.0.0.1:3005` — developer.

The `/admin/` location in the apex template is reserved for Cockpit at `127.0.0.1:9090` and is intentionally separate from `admin.napare.sano.ru`.

Certificate lifecycle is host-owned: use the distribution's Certbot package or the existing ACME provider on the server, verify with `sudo certbot certificates` (if Certbot is used), and test renewal with `sudo certbot renew --dry-run`. Do not run those commands as part of the local repository deployment.
