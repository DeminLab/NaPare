# Production TLS notes

TLS is terminated by the **system Nginx on the production host**, not by Docker Nginx. Do not place or commit certificates in this repository. Follow [deploy/nginx/README.md](../../../deploy/nginx/README.md) and the templates there.

The certificate must cover `napare.sano.ru`, `www.napare.sano.ru`, `student.napare.sano.ru`, `teacher.napare.sano.ru`, `admin.napare.sano.ru` and `developer.napare.sano.ru`.
