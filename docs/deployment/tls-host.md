# Production TLS notes

TLS is terminated by the **system Nginx on the production host**, not by Docker Nginx. Do not place or commit certificates in this repository. Follow [docs/deployment/nginx-templates.md](./nginx-templates.md) and the templates there.

The certificate must cover `napare.sano.ru`, `www.napare.sano.ru`, `student.napare.sano.ru`, `teacher.napare.sano.ru` and `admin.napare.sano.ru`. The developer workspace shares the `napare.sano.ru/developer/` path and needs no separate hostname.
