# Infrastructure

Инфраструктура проекта: Kubernetes, Terraform, Docker.

---

## 1. Обзор архитектуры

```mermaid
graph TB
    subgraph Internet
        Users[Users]
        MAX[MAX Platform]
    end

    subgraph YandexCloud
        subgraph K8s["Kubernetes Cluster"]
            subgraph Backend
                BE1[Backend Pod 1]
                BE2[Backend Pod 2]
                BE3[Backend Pod 3]
            end
            subgraph Web
                WEB1[Web Pod 1]
                WEB2[Web Pod 2]
            end
            subgraph Workers
                W1[Notification Worker]
                W2[Schedule Sync Worker]
            end
        end

        subgraph Databases
            PG[(PostgreSQL)]
            Redis[(Redis)]
            S3[(Object Storage)]
        end

        subgraph Monitoring
            Sentry[Sentry]
            PostHog[PostHog]
        end
    end

    Users --> K8s
    MAX --> K8s
    K8s --> Databases
    K8s --> Monitoring
```

---

## 2. Yandex Cloud Resources

### Kubernetes Cluster

| Ресурс | Значение |
|--------|----------|
| Кластер | napare-cluster |
| Зона | ru-central1-a, ru-central1-b |
| Нода (default pool) | 3 × Standard-4 (4 vCPU, 8 GB RAM) |
| Нода (worker pool) | 2 × Standard-2 (2 vCPU, 4 GB RAM) |
| Kubernetes version | 1.29 |
| Networking | Cilium |

### PostgreSQL (Managed)

| Параметр | Значение |
|----------|----------|
| Кластер | napare-db |
| Версия | 16 |
| Режим | HA (3 реплики) |
| Ресурсы | 4 vCPU, 16 GB RAM |
| Диск | 100 GB SSD |
| Бэкап | Ежедневный, 7 дней |

### Redis (Managed)

| Параметр | Значение |
|----------|----------|
| Кластер | napare-redis |
| Версия | 7 |
| Режим | Standalone |
| Ресурсы | 2 vCPU, 4 GB RAM |
| Память | 8 GB |

### Object Storage (S3)

| Параметр | Значение |
|----------|----------|
| Бакет | napare-files |
| Регион | ru-central1 |
| Lifecycle | 90 дней → IA, 365 дней → Archive |
| CORS | Разрешён для web/mobile |

---

## 3. Terraform

### Структура

```
infrastructure/
├── terraform/
│   ├── modules/
│   │   ├── k8s-cluster/
│   │   ├── postgres/
│   │   ├── redis/
│   │   └── s3/
│   ├── environments/
│   │   ├── staging/
│   │   └── production/
│   └── main.tf
├── helm/
│   ├── backend/
│   ├── web/
│   └── workers/
└── scripts/
    ├── setup.sh
    └── teardown.sh
```

### Пример main.tf

```hcl
terraform {
  required_providers {
    yandex = {
      source  = "yandex-cloud/yandex"
      version = "~> 0.100"
    }
  }

  backend "s3" {
    bucket = "napare-terraform"
    key    = "prod/terraform.tfstate"
    region = "ru-central1"
  }
}

provider "yandex" {
  zone = "ru-central1-a"
}

module "k8s" {
  source = "./modules/k8s-cluster"

  cluster_name = "napare-cluster"
  environment  = "production"
  node_groups = [
    {
      name       = "default"
      node_count = 3
      cpu        = 4
      memory     = 8192
    },
    {
      name       = "workers"
      node_count = 2
      cpu        = 2
      memory     = 4096
    }
  ]
}

module "postgres" {
  source = "./modules/postgres"

  cluster_name = "napare-db"
  environment  = "production"
  version      = "16"
  ha           = true
  cpu          = 4
  memory       = 16384
  disk_size    = 100
}

module "redis" {
  source = "./modules/redis"

  cluster_name = "napare-redis"
  environment  = "production"
  version      = "7"
  memory       = 8192
}

module "s3" {
  source = "./modules/s3"

  bucket_name = "napare-files"
  region      = "ru-central1"
}
```

---

## 4. Kubernetes Manifests

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: napare/backend:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: backend-secrets
                  key: database-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: backend-secrets
                  key: jwt-secret
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: production
spec:
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: 3000
  type: ClusterIP
```

### Web Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: napare/web:latest
          ports:
            - containerPort: 3000
          env:
            - name: NEXT_PUBLIC_API_URL
              value: "https://api.napare.ru"
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
```

### Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: napare-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
    - hosts:
        - napare.ru
        - api.napare.ru
        - staging.napare.ru
      secretName: napare-tls
  rules:
    - host: napare.ru
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 3000
    - host: api.napare.ru
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: backend
                port:
                  number: 3000
```

### HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## 5. Secrets Management

### K8s Secrets

```bash
# Создать секреты
kubectl create secret generic backend-secrets \
  --from-literal=database-url='postgresql://napare:PASSWORD@pg-host:5432/napare' \
  --from-literal=jwt-secret='YOUR_JWT_SECRET' \
  --from-literal=s3-access-key='YOUR_S3_KEY' \
  --from-literal=s3-secret-key='YOUR_S3_SECRET' \
  -n production

kubectl create secret generic push-secrets \
  --from-literal=fcm-private-key='YOUR_FCM_KEY' \
  --from-literal=apns-private-key='YOUR_APNS_KEY' \
  -n production
```

### Правила

1. **Никогда** не коммитить секреты в git
2. Использовать K8s Secrets или Yandex Lockbox
3. Ротация секретов каждые 90 дней
4. Использовать least privilege для сервисных аккаунтов

---

## 6. Networking

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: web
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - protocol: TCP
          port: 6379
```

### Service Mesh (опционально)

Для продвинутого routing и observability:
- Istio или Linkerd
- mTLS между сервисами
- Traffic splitting для canary deployments

---

## 7. Мониторинг и алертинг

### Prometheus + Grafana

```yaml
# helm-chart для Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
```

### Алерты

| Алерт | Условие | Действие |
|-------|---------|----------|
| HighErrorRate | 5xx > 1% за 5 минут | Telegram + PagerDuty |
| HighLatency | p95 > 1 сек за 5 минут | Telegram |
| PodCrashLoop | Restart > 3 за 10 минут | Telegram |
| HighMemory | Memory > 90% за 10 минут | Telegram |
| DiskSpace | Disk > 85% | Telegram |
| SSLCertExpiry | < 7 дней | Email |

---

## 8. Бэкап и восстановление

### PostgreSQL

```bash
# Бэкап (ежедневный cron)
pg_dump -h $PG_HOST -U $PG_USER -d napare > backup_$(date +%Y%m%d).sql

# Восстановление
psql -h $PG_HOST -U $PG_USER -d napare < backup_20240115.sql
```

### Redis

```bash
# Бэкап
redis-cli BGSAVE

# Восстановление
cp dump.rdb /var/lib/redis/dump.rdb
```

### Object Storage

- Версионирование включено
- Lifecycle policy: 90 дней → IA, 365 дней → Archive
- Cross-region replication (опционально)

---

## 9. Стоимость (ориентировочно)

### Production (300 студентов, 30 преподавателей)

| Ресурс | Конфигурация | Стоимость/мес |
|--------|--------------|---------------|
| K8s Cluster | 3 × Standard-4 + 2 × Standard-2 | ~15 000 ₽ |
| PostgreSQL | HA, 4 vCPU, 16 GB RAM | ~8 000 ₽ |
| Redis | 2 vCPU, 8 GB RAM | ~3 000 ₽ |
| Object Storage | 50 GB | ~500 ₽ |
| Load Balancer | 1 шт | ~2 000 ₽ |
| Домен + SSL | .ru + Let's Encrypt | ~1 000 ₽ |
| **Итого** | | **~29 500 ₽/мес** |

### Scaling

| Метрика | 300 студентов | 1000 студентов | 5000 студентов |
|---------|---------------|----------------|----------------|
| Backend Pods | 2-3 | 3-5 | 5-10 |
| DB CPU | 20% | 40% | 70% |
| Redis Memory | 1 GB | 3 GB | 8 GB |
| Storage | 50 GB | 200 GB | 1 TB |
| Стоимость | ~30K ₽ | ~50K ₽ | ~120K ₽ |

---

## 10. См. также

- [ops/deployment.md](deployment.md) — пошаговый деплой
- [ops/cicd.md](cicd.md) — CI/CD pipeline
- [ops/monitoring.md](monitoring.md) — мониторинг
