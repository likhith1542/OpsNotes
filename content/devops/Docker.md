---
title: Docker
description: The complete guide to Docker architecture, concepts, CLI, Dockerfile, Compose, networking, storage, security, and production best practices.
order: 1
---

## Table of Contents

1. [What is Docker?](#what-is-docker)
2. [How Docker works — architecture](#how-docker-works--architecture)
3. [Installation](#installation)
4. [Core concepts](#core-concepts)
   - [Images](#images)
   - [Containers](#containers)
   - [Registries](#registries)
   - [Volumes](#volumes)
   - [Networks](#networks)
5. [Dockerfile reference](#dockerfile-reference)
6. [Docker CLI reference](#docker-cli-reference)
7. [Docker Compose](#docker-compose)
8. [Networking deep dive](#networking-deep-dive)
9. [Storage and volumes deep dive](#storage-and-volumes-deep-dive)
10. [Multi-stage builds](#multi-stage-builds)
11. [Security](#security)
12. [Resource limits and runtime constraints](#resource-limits-and-runtime-constraints)
13. [Logging and monitoring](#logging-and-monitoring)
14. [Docker in CI/CD](#docker-in-cicd)
15. [Docker vs virtual machines](#docker-vs-virtual-machines)
16. [Best practices](#best-practices)
17. [Common patterns](#common-patterns)
18. [Troubleshooting](#troubleshooting)
19. [Glossary](#glossary)



## What is Docker?

Docker is an open-source platform for building, shipping, and running applications inside **containers** — lightweight, isolated processes that package an application together with all its dependencies (libraries, configs, runtimes) so it runs identically on any host.

**Key benefits:**

- **Consistency** — "works on my machine" stops being an excuse. The container carries everything it needs.
- **Isolation** — processes, filesystems, and networks are namespaced away from the host and from each other.
- **Speed** — containers start in milliseconds vs minutes for VMs because they share the host kernel.
- **Portability** — build once, run anywhere: laptop → CI server → cloud → on-prem.
- **Density** — dozens of containers can run on one host; VMs typically cap at single digits.

Docker was released in 2013 by Docker Inc. The underlying technology (Linux namespaces, cgroups) has existed in the kernel since ~2008 — Docker made it developer-friendly.



## How Docker works — architecture

```
┌─────────────────────────────────────────────────┐
│                  Docker CLI                     │  ← you type here
└──────────────────┬──────────────────────────────┘
                   │  REST API (unix socket or TCP)
┌──────────────────▼──────────────────────────────┐
│             Docker Daemon (dockerd)             │
│                                                 │
│  ┌──────────────┐  ┌───────────┐  ┌──────────┐  │
│  │ Image cache  │  │ Container │  │ Network  │  │
│  │  (layers)    │  │  runtime  │  │  mgmt    │  │
│  └──────────────┘  └───────────┘  └──────────┘  │
└─────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│           Container Runtime (containerd)        │
│                + runc (OCI runtime)             │
└─────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                Linux Kernel                     │
│   namespaces (pid, net, mnt, uts, ipc, user)   │
│   cgroups (CPU, memory, I/O limits)            │
│   OverlayFS (union filesystem for layers)      │
└─────────────────────────────────────────────────┘
```

### Components

| Component | Role |
|||
| **Docker CLI** | User-facing tool. Sends commands to the daemon over a REST API. |
| **Docker daemon (`dockerd`)** | Long-running background process. Manages images, containers, networks, volumes. |
| **containerd** | Industry-standard container runtime. Handles image pull/push and container lifecycle. |
| **runc** | Low-level OCI runtime. Actually calls the Linux kernel to create namespaces and cgroups. |
| **Docker Registry** | Image storage server. Docker Hub is the default public registry. |

### What makes a container

| Kernel feature | What it provides |
|||
| **PID namespace** | Container has its own process tree. PID 1 inside ≠ PID 1 outside. |
| **Network namespace** | Isolated network stack: own IP, routing table, iptables rules. |
| **Mount namespace** | Own filesystem view via OverlayFS. |
| **UTS namespace** | Own hostname. |
| **IPC namespace** | Isolated inter-process communication (shared memory, semaphores). |
| **User namespace** | Map container root (uid 0) to an unprivileged host uid (optional but recommended). |
| **cgroups** | Enforce resource limits: max CPU shares, memory ceiling, I/O bandwidth. |
| **OverlayFS** | Union mount of read-only image layers + a thin read-write container layer on top. |



## Installation

### Linux (Ubuntu/Debian)

```bash
# Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Set up the apt repository
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Run without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### macOS / Windows

Download **Docker Desktop** from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop).

Docker Desktop runs a lightweight Linux VM (using Apple Hypervisor / WSL2) to host the daemon. The CLI on the host communicates with it transparently.

### Verify installation

```bash
docker --version       # Docker version 26.x.x
docker info            # Daemon details, storage driver, runtime
docker run hello-world # Pull and run the hello-world test image
```



## Core concepts

### Images

An image is a **read-only, layered filesystem snapshot** that contains everything needed to run a process: OS base, runtimes, libraries, app code, and the default command.

- Immutable — running a container never changes the image.
- Composed of **layers** stored in a content-addressable store. Layers are shared across images (e.g. many images share the same Ubuntu base layer, stored only once on disk).
- Identified by a **reference**: `[registry/][namespace/]name[:tag][@digest]`

```bash
# Examples
nginx                         # docker.io/library/nginx:latest
node:20-alpine                # Official Node.js on Alpine Linux
myrepo/myapp:1.4.2            # Private image, tag 1.4.2
nginx@sha256:abc123...        # Pinned by digest (immutable)
```

**Image layer internals (OverlayFS):**

```
Layer 4 (R/W) ─── container layer  ← writes go here, discarded on rm
Layer 3 (RO)  ─── COPY app/ /app
Layer 2 (RO)  ─── RUN npm install
Layer 1 (RO)  ─── FROM node:20-alpine
```

Each `RUN`, `COPY`, `ADD` in a Dockerfile creates a new layer. Unchanged layers are cached and reused between builds.

### Containers

A container is a **running instance of an image** — a set of Linux processes with isolated namespaces and cgroups.

- Has its own writable layer on top of the image layers (changes are ephemeral by default).
- Is identified by a 64-char hex ID or a human-readable name.
- Lifecycle: `created → running → paused → stopped → removed`

```
Image (read-only layers)
       +
Writable container layer
       =
Running container
```

### Registries

A registry stores and distributes images. The default is **Docker Hub** (`docker.io`).

| Registry | URL | Notes |
||||
| Docker Hub | `docker.io` | Default public registry. Free tier with rate limits. |
| GitHub Container Registry | `ghcr.io` | Integrated with GitHub Actions. |
| Amazon ECR | `<acct>.dkr.ecr.<region>.amazonaws.com` | Private, IAM-based auth. |
| Google Artifact Registry | `<region>-docker.pkg.dev` | GCP-native. |
| Azure Container Registry | `<name>.azurecr.io` | Azure-native. |
| Self-hosted | Any host | Run `registry:2` image locally or use Harbor/Nexus. |

```bash
docker login ghcr.io -u USERNAME --password-stdin < token.txt
docker push ghcr.io/myorg/myapp:1.0.0
docker pull ghcr.io/myorg/myapp:1.0.0
```

### Volumes

By default, files written inside a container are lost when the container is removed. **Volumes** provide persistent storage.

Three storage types:

| Type | Syntax | Managed by Docker | Use case |
|||||
| **Named volume** | `myapp-data:/data` | Yes — stored in `/var/lib/docker/volumes/` | Databases, persistent state |
| **Bind mount** | `/host/path:/container/path` | No — any host path | Dev: live-reload source code |
| **tmpfs mount** | `tmpfs:/run/secrets` | In-memory only | Sensitive ephemeral data |

```bash
# Create and use a named volume
docker volume create pgdata
docker run -v pgdata:/var/lib/postgresql/data postgres:16

# Bind mount (dev workflow)
docker run -v $(pwd):/app -w /app node:20 npm start

# Inspect
docker volume ls
docker volume inspect pgdata
```

### Networks

Docker containers communicate over virtual networks managed by the daemon.

| Driver | Scope | Use case |
||||
| `bridge` | Single host | Default. Containers on same bridge can reach each other by IP. Custom bridges also resolve by container name. |
| `host` | Single host | Container shares host network stack. No isolation. Highest performance. |
| `none` | Single host | No networking. Fully isolated. |
| `overlay` | Multi-host (Swarm) | Spans multiple Docker hosts. Requires Swarm or external key-value store. |
| `macvlan` | Single host | Assigns a MAC address to the container. Appears as a physical device on the network. |
| `ipvlan` | Single host | Similar to macvlan but shares MAC. Useful in environments that restrict multiple MACs. |

```bash
# Create a custom bridge network
docker network create mynet

# Connect containers — they resolve each other by name
docker run -d --name db --network mynet postgres:16
docker run -d --name app --network mynet myapp:latest
# inside `app`: ping db works, psql -h db works
```



## Dockerfile reference

A `Dockerfile` is a text file containing instructions to build an image. Each instruction creates a layer.

### Complete instruction set

```dockerfile
# syntax=docker/dockerfile:1
# ↑ Enable BuildKit syntax (recommended)

# ─── Base image ────────────────────────────────────────
FROM ubuntu:22.04
# FROM <image>[:<tag>] [AS <name>]
# Must be first instruction (after ARG). Multiple FROM = multi-stage build.

# ─── Build-time arguments ──────────────────────────────
ARG NODE_VERSION=20
ARG BUILDPLATFORM
# Available only during build. Not persisted in the final image.
# Override: docker build --build-arg NODE_VERSION=18 .

# ─── Environment variables ─────────────────────────────
ENV APP_ENV=production \
    PORT=3000
# Persisted in the image. Available at runtime.

# ─── Working directory ─────────────────────────────────
WORKDIR /app
# Creates directory if it doesn't exist. All subsequent relative paths
# are relative to WORKDIR.

# ─── Copy files ────────────────────────────────────────
COPY package*.json ./
# COPY [--chown=user:group] [--chmod=755] <src>... <dest>
# src is relative to build context. Respects .dockerignore.

ADD https://example.com/file.tar.gz /tmp/
# ADD can also fetch URLs and auto-extract tar archives.
# Prefer COPY for local files (more explicit).

# ─── Run commands ──────────────────────────────────────
RUN npm ci --omit=dev
# Executes in a shell (/bin/sh -c). Creates a new layer.
# Combine related commands with && to reduce layers:
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Shell form vs exec form:
RUN echo "shell form"             # /bin/sh -c "echo ..."
RUN ["echo", "exec form"]         # exec directly, no shell expansion

# ─── Cache mounts (BuildKit) ───────────────────────────
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ─── Expose ports ──────────────────────────────────────
EXPOSE 3000
EXPOSE 3000/udp
# Documentation only. Doesn't actually publish. Use -p at runtime.

# ─── Volumes ───────────────────────────────────────────
VOLUME ["/data"]
# Declares a mount point. Creates anonymous volume if none provided.

# ─── User ──────────────────────────────────────────────
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
# Switch to non-root user. Best practice for security.
# USER <user>[:<group>] or USER <UID>[:<GID>]

# ─── Labels ────────────────────────────────────────────
LABEL org.opencontainers.image.source="https://github.com/org/repo" \
      org.opencontainers.image.version="1.0.0" \
      maintainer="team@example.com"

# ─── Health check ──────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
# HEALTHCHECK NONE  ← disable inherited healthcheck

# ─── Entry point and default command ───────────────────
ENTRYPOINT ["node", "server.js"]
# The main process. Not overridden by `docker run <image> <cmd>`.

CMD ["--port", "3000"]
# Default arguments appended to ENTRYPOINT.
# Overridden by anything after the image name: docker run myapp --port 8080

# Patterns:
# ENTRYPOINT + CMD     → fixed binary, overridable args (most common)
# CMD only             → fully overridable default command
# ENTRYPOINT only      → hard-coded command, no default args

# ─── Shell ─────────────────────────────────────────────
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
# Change the default shell for RUN instructions.

# ─── Signal ────────────────────────────────────────────
STOPSIGNAL SIGTERM
# Signal sent to container on `docker stop`. Default SIGTERM.

# ─── OnBuild ───────────────────────────────────────────
ONBUILD COPY . /app
# Triggers only when this image is used as a base in another Dockerfile.
# Useful for base images shared across many projects.
```

### .dockerignore

Equivalent to `.gitignore` — excludes files from the build context (what gets sent to the daemon).

```
# .dockerignore
node_modules
.git
.env
*.log
dist
coverage
.DS_Store
**/__pycache__
**/*.pyc
```

A smaller build context = faster builds and smaller images.



## Docker CLI reference

### Image commands

```bash
# Build
docker build -t myapp:1.0 .
docker build -t myapp:1.0 -f Dockerfile.prod .
docker build --build-arg ENV=prod --no-cache -t myapp:1.0 .
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:1.0 --push .

# List
docker images
docker image ls --filter dangling=true   # untagged layers
docker image ls --format "{{.Repository}}:{{.Tag}} {{.Size}}"

# Pull / push / tag
docker pull node:20-alpine
docker push myrepo/myapp:1.0
docker tag myapp:1.0 myrepo/myapp:1.0

# Inspect
docker image inspect nginx
docker history nginx                      # layer breakdown
docker image inspect --format '{{.Config.Cmd}}' nginx

# Remove
docker rmi myapp:1.0
docker image prune                        # remove dangling images
docker image prune -a                     # remove all unused images
```

### Container commands

```bash
# Run
docker run nginx                                    # foreground
docker run -d nginx                                 # detached (background)
docker run -it ubuntu bash                          # interactive TTY
docker run --rm nginx                               # auto-remove on exit
docker run --name web -d -p 8080:80 nginx           # named, port mapped
docker run -e NODE_ENV=production myapp             # env var
docker run --env-file .env myapp                    # env file
docker run -v mydata:/data -v $(pwd):/app myapp     # volumes
docker run --network mynet myapp                    # custom network
docker run --cpus="1.5" --memory="512m" myapp       # resource limits
docker run --user 1000:1000 myapp                   # run as user
docker run --read-only myapp                        # read-only rootfs
docker run --restart unless-stopped nginx           # restart policy

# Lifecycle
docker start <container>
docker stop <container>                 # SIGTERM, then SIGKILL after 10s
docker stop -t 30 <container>           # wait 30s before SIGKILL
docker restart <container>
docker pause <container>                # freeze (SIGSTOP cgroup)
docker unpause <container>
docker kill <container>                 # SIGKILL immediately
docker kill -s SIGHUP <container>       # custom signal

# List
docker ps                               # running
docker ps -a                            # all (including stopped)
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker ps --filter status=exited

# Inspect / info
docker inspect <container>              # full JSON metadata
docker inspect -f '{{.NetworkSettings.IPAddress}}' <container>
docker stats                            # live CPU/mem/net/IO
docker stats --no-stream                # snapshot
docker top <container>                  # running processes
docker port <container>                 # port mappings

# Interact
docker exec -it <container> bash        # open shell in running container
docker exec <container> cat /etc/hosts
docker attach <container>               # attach to PID 1 stdout/stdin
docker cp <container>:/app/log.txt .    # copy file out
docker cp ./config.json <container>:/app/

# Logs
docker logs <container>
docker logs -f <container>              # follow (like tail -f)
docker logs --tail 100 <container>
docker logs --since 2h <container>
docker logs --timestamps <container>

# Remove
docker rm <container>
docker rm -f <container>                # force-remove running container
docker container prune                  # remove all stopped containers
```

### System commands

```bash
docker system df                        # disk usage breakdown
docker system prune                     # remove stopped containers, unused networks, dangling images
docker system prune -a --volumes        # nuclear clean — remove everything unused
docker system info                      # daemon configuration
docker version                          # client + daemon versions
docker events                           # real-time event stream from daemon
docker events --filter type=container --filter event=die
```

### Volume commands

```bash
docker volume create mydata
docker volume ls
docker volume inspect mydata
docker volume rm mydata
docker volume prune                     # remove all unused volumes
```

### Network commands

```bash
docker network create mynet
docker network create --driver overlay --attachable mynet
docker network ls
docker network inspect mynet
docker network connect mynet <container>
docker network disconnect mynet <container>
docker network rm mynet
docker network prune
```



## Docker Compose

Docker Compose is a tool for defining and running **multi-container applications** using a YAML file.

### compose.yaml (v2 format — current standard)

```yaml
# compose.yaml
name: myapp

services:

  # ─── Web application ──────────────────────────────
  web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_VERSION: "20"
      target: production           # multi-stage build target
    image: myapp:latest
    container_name: myapp-web
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "127.0.0.1:9229:9229"      # localhost-only debug port
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://postgres:secret@db:5432/myapp
    env_file:
      - .env
    volumes:
      - uploads:/app/uploads
      - ./logs:/app/logs            # bind mount for logs
    networks:
      - frontend
      - backend
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=Host(`app.example.com`)"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ─── Database ─────────────────────────────────────
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    expose:
      - "5432"                       # only reachable from other containers

  # ─── Cache ────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass secret
    volumes:
      - redisdata:/data
    networks:
      - backend

  # ─── Reverse proxy ────────────────────────────────
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - certdata:/etc/letsencrypt
    networks:
      - frontend
    depends_on:
      - web

# ─── Named volumes ────────────────────────────────────
volumes:
  pgdata:
  redisdata:
  uploads:
  certdata:

# ─── Networks ─────────────────────────────────────────
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true          # no external internet access
```

### Compose CLI

```bash
# Start / stop
docker compose up                       # foreground
docker compose up -d                    # detached
docker compose up --build               # rebuild images first
docker compose up --scale web=3         # run 3 replicas of web
docker compose down                     # stop + remove containers + networks
docker compose down -v                  # also remove volumes
docker compose stop                     # stop without removing
docker compose start                    # start existing containers

# Status
docker compose ps
docker compose logs
docker compose logs -f web
docker compose top

# Exec / run
docker compose exec web bash
docker compose run --rm web npm test    # one-off command

# Config
docker compose config                   # validate + print merged config
docker compose convert                  # normalise to canonical format

# Multiple files (override pattern)
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

### Override files

```yaml
# compose.override.yaml — merged automatically in dev
services:
  web:
    build:
      target: development
    volumes:
      - .:/app                          # live code reload
    environment:
      NODE_ENV: development
    command: npm run dev
  db:
    ports:
      - "5432:5432"                     # expose DB port in dev
```



## Networking deep dive

### How container DNS works

Containers on a **custom bridge network** get automatic DNS resolution by name. The embedded DNS server (`127.0.0.11`) maps container names to their IP addresses.

```
app container                 DNS server (127.0.0.11)
     │  "what is db?"               │
     │──────────────────────────────►│
     │                              │ look up container named "db"
     │◄─────────────────────────────│
     │  "172.20.0.3"                │
     │
     │  TCP connect to 172.20.0.3:5432
```

This only works on **custom** bridges, not the default `bridge` network.

### Port publishing

```bash
-p 8080:80          # host port 8080 → container port 80 (TCP)
-p 8080:80/udp      # UDP
-p 127.0.0.1:80:80  # bind only to localhost (safer)
-p 80               # random host port → container 80
-P                  # publish ALL exposed ports to random host ports
```

### Network drivers in detail

**bridge (default)**

```
Host
├── docker0 (bridge, 172.17.0.1/16)
│   ├── veth0abc → container-A (172.17.0.2)
│   └── veth1def → container-B (172.17.0.3)
└── eth0 (host NIC, reaches internet)
```

Outbound traffic is NAT'd via iptables MASQUERADE. Inbound requires `-p` port publishing.

**host**

Container process binds directly to host NICs. No NAT, no virtual interface. Lowest latency; no isolation.

**overlay (Swarm / multi-host)**

Uses VXLAN encapsulation. Container-to-container traffic across hosts is tunnelled inside UDP packets. Requires a key-value store (built into Swarm).

**macvlan**

Gives each container a real MAC address, making it appear as a separate physical device on the LAN. Useful for legacy applications that expect to be on the physical network.



## Storage and volumes deep dive

### OverlayFS explained

```
Read-write layer  ── created per container, ephemeral
─────────────────────────────────────────────────────
Image layer N     ── RUN npm install (your deps)
Image layer N-1   ── COPY package.json (your files)
Image layer N-2   ── FROM node:20-alpine (OS + node)
```

When a container reads a file, OverlayFS looks from the top down and returns the first match. When it writes a file, it copies it to the top layer first (copy-on-write). This means writes are slightly more expensive than native but reads of existing files are zero-cost.

### Volume drivers

```bash
# Local NFS mount
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=addr=192.168.1.10,rw \
  --opt device=:/exports/data \
  nfsdata

# tmpfs (in-memory, survives container restarts but not host reboots)
docker run --mount type=tmpfs,destination=/tmp,tmpfs-size=64m myapp
```

Third-party drivers: `rexray` (cloud block storage), `convoy`, `portworx`, `storageos`.

### Backup and restore

```bash
# Backup a volume
docker run --rm \
  -v mydata:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/mydata.tar.gz -C /source .

# Restore
docker run --rm \
  -v mydata:/dest \
  -v $(pwd):/backup \
  alpine tar xzf /backup/mydata.tar.gz -C /dest
```



## Multi-stage builds

Multi-stage builds use multiple `FROM` instructions in one Dockerfile to produce a minimal final image — build tools and intermediate artifacts are discarded.

```dockerfile
# syntax=docker/dockerfile:1

# ── Stage 1: Build ────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build                       # outputs to /build/dist

# ── Stage 2: Test (optional) ──────────────────────────────
FROM builder AS tester
RUN npm test

# ── Stage 3: Production runtime ───────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json .
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

```bash
# Build only the production stage
docker build --target production -t myapp:1.0 .

# Result: ~80MB instead of ~900MB (no build tools, dev deps, or source)
```



## Security

### Run as non-root

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

```bash
docker run --user 1000:1000 myimage
```

### Read-only filesystem

```bash
docker run --read-only --tmpfs /tmp --tmpfs /run myimage
```

### Drop capabilities

```bash
# Drop all Linux capabilities, add back only what's needed
docker run \
  --cap-drop ALL \
  --cap-add NET_BIND_SERVICE \
  myimage
```

### Seccomp profiles

```bash
# Apply a custom seccomp profile
docker run --security-opt seccomp=./my-profile.json myimage

# Disable seccomp (not recommended)
docker run --security-opt seccomp=unconfined myimage
```

### AppArmor / SELinux

```bash
docker run --security-opt apparmor=docker-default myimage
docker run --security-opt label=type:container_t myimage   # SELinux
```

### Secrets (not environment variables)

```bash
# Docker secret (Swarm)
echo "mysecretpassword" | docker secret create db_password -
docker service create \
  --secret db_password \
  --env DB_PASSWORD_FILE=/run/secrets/db_password \
  myapp

# Compose secrets
# compose.yaml:
secrets:
  db_password:
    file: ./db_password.txt
services:
  web:
    secrets:
      - db_password
```

### Image scanning

```bash
docker scout cves myimage:latest          # Docker Scout (built-in)
trivy image myimage:latest                # Trivy (open source)
grype myimage:latest                      # Grype by Anchore
snyk container test myimage:latest        # Snyk
```

### Signing images (Docker Content Trust)

```bash
export DOCKER_CONTENT_TRUST=1
docker push myrepo/myimage:1.0            # signs on push
docker pull myrepo/myimage:1.0            # verifies on pull
```

### Key security rules summary

| Rule | Why |
|||
| Never run as root inside a container | Limits blast radius if compromised |
| Use official or verified base images | Reduces supply chain risk |
| Pin base image versions with digests | Prevents silent upstream changes |
| Never store secrets in image layers or env vars | Layer history is inspectable |
| Use `--read-only` where possible | Prevents in-place binary tampering |
| Scan images in CI before pushing | Catch CVEs before they reach production |
| Enable Docker Content Trust | Prevents pulling unsigned/tampered images |
| Limit capabilities with `--cap-drop ALL` | Reduces kernel attack surface |



## Resource limits and runtime constraints

```bash
# CPU
--cpus="1.5"                   # max 1.5 logical CPUs
--cpu-shares=512               # relative weight (default 1024)
--cpuset-cpus="0,1"            # pin to physical cores 0 and 1

# Memory
--memory="512m"                # hard limit — OOM killed if exceeded
--memory-swap="1g"             # memory + swap combined limit
--memory-reservation="256m"   # soft limit / hint

# I/O
--device-read-bps /dev/sda:10mb    # max read throughput
--device-write-bps /dev/sda:10mb
--device-read-iops /dev/sda:100
--device-write-iops /dev/sda:100

# Process limits
--pids-limit=100               # max processes inside container

# Restart policies
--restart no                   # never restart (default)
--restart on-failure            # restart on non-zero exit
--restart on-failure:5          # max 5 retries
--restart always               # always restart (even after docker restart)
--restart unless-stopped       # always restart unless manually stopped
```



## Logging and monitoring

### Log drivers

```bash
# Configure globally in /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Per container
docker run \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=5 \
  nginx
```

| Driver | Description |
|||
| `json-file` | Default. Writes JSON to `/var/lib/docker/containers/<id>/<id>-json.log` |
| `local` | Optimised binary format. Lower overhead than json-file. |
| `syslog` | Forward to syslog daemon. |
| `journald` | Forward to systemd journal. |
| `gelf` | Graylog Extended Log Format (Graylog, Logstash). |
| `fluentd` | Forward to Fluentd. |
| `awslogs` | Amazon CloudWatch Logs. |
| `gcplogs` | Google Cloud Logging. |
| `splunk` | Splunk HTTP Event Collector. |
| `none` | Disable all logging. |

### Runtime stats

```bash
docker stats                                    # live table of all containers
docker stats --format "{{.Container}}: CPU {{.CPUPerc}} MEM {{.MemUsage}}"
docker stats --no-stream mycontainer           # one-shot snapshot
```

### Prometheus metrics

Enable the metrics endpoint in `/etc/docker/daemon.json`:

```json
{
  "metrics-addr": "0.0.0.0:9323",
  "experimental": true
}
```

Scrape `http://<host>:9323/metrics` with Prometheus.



## Docker in CI/CD

### GitHub Actions

```yaml
# .github/workflows/docker.yml
name: Build and push

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha
            type=semver,pattern={{version}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### GitLab CI

```yaml
# .gitlab-ci.yml
build:
  image: docker:26
  services:
    - docker:26-dind
  variables:
    DOCKER_TLS_CERTDIR: "/certs"
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
```



## Docker vs virtual machines

| Dimension | Docker container | Virtual machine |
||||
| **Startup time** | Milliseconds | Seconds to minutes |
| **Disk footprint** | MBs (shared layers) | GBs (full OS per VM) |
| **Memory overhead** | Very low | 512MB–2GB per VM |
| **Isolation level** | Process isolation (shared kernel) | Full hardware virtualisation |
| **Kernel** | Shares host kernel | Own kernel per VM |
| **Security boundary** | Weaker (namespace escape possible) | Stronger (hypervisor boundary) |
| **Portability** | Build once, run anywhere (same OS family) | Full OS portability |
| **Use case** | Microservices, CI/CD, 12-factor apps | Multi-OS, legacy apps, strong isolation |

Containers and VMs are complementary, not competing. In production, you typically run containers **inside** VMs (e.g. EC2 instances running Docker or K8s nodes).



## Best practices

### Dockerfile

1. **Use specific base image tags.** `FROM node:20.11.0-alpine3.19` not `FROM node:latest`.
2. **Pin with digest for critical workloads.** `FROM node:20-alpine@sha256:abc123...`
3. **Minimise layers.** Chain `RUN` commands with `&&`. Each layer adds overhead.
4. **Order for cache efficiency.** Copy dependency manifests first, install deps, then copy source. Source changes won't invalidate the dependency cache layer.

   ```dockerfile
   COPY package*.json ./     ← rarely changes
   RUN npm ci                ← cached until package.json changes
   COPY . .                  ← changes every build
   ```

5. **Use `.dockerignore`.** Always. Keep the build context small.
6. **Use multi-stage builds.** Never ship build tools or dev dependencies.
7. **Run as non-root.** Always add a dedicated user.
8. **Use `COPY` not `ADD`** unless you specifically need URL fetching or tar extraction.
9. **Use `dumb-init` or `tini`** as PID 1 to handle signals and zombie processes correctly.
10. **Set `HEALTHCHECK`.** Orchestrators use it to decide if a container is healthy.

### Images

- Prefer Alpine or distroless base images for production (smaller attack surface).
- Scan images before pushing (`docker scout`, `trivy`).
- Use a private registry for proprietary images.
- Tag releases semantically (`1.4.2`) not just `latest`.

### Running containers

- Set `--restart unless-stopped` for services.
- Always set `--memory` limits to prevent OOM situations from cascading.
- Use `--read-only` with tmpfs for writable paths where possible.
- Use named volumes (not bind mounts) in production.
- Mount secrets via files, not environment variables.

### Compose

- Separate `compose.yaml` (base) from `compose.override.yaml` (dev) and `compose.prod.yaml` (prod).
- Use `depends_on` with `condition: service_healthy` for proper ordering.
- Define explicit networks; never rely on the default bridge.
- Use `profiles` to group optional services (e.g. monitoring, docs).



## Common patterns

### Init containers (startup ordering)

```yaml
services:
  migrate:
    image: myapp:latest
    command: npm run migrate
    depends_on:
      db:
        condition: service_healthy
  web:
    image: myapp:latest
    depends_on:
      migrate:
        condition: service_completed_successfully
```

### Sidecar containers

```yaml
services:
  app:
    image: myapp:latest
    volumes:
      - logs:/var/log/app

  log-shipper:
    image: fluent/fluent-bit
    volumes:
      - logs:/var/log/app:ro     # reads from the same volume
      - ./fluent-bit.conf:/etc/fluent-bit/fluent-bit.conf:ro

volumes:
  logs:
```

### Distroless production image

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /build
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM gcr.io/distroless/static-debian12
COPY --from=builder /build/server /server
ENTRYPOINT ["/server"]
```

Result: image contains only the binary and its dependencies. No shell, no package manager. ~5MB total.

### Docker-in-Docker (DinD) for CI

```yaml
# Use the Docker socket instead of true DinD — safer
services:
  ci-runner:
    image: docker:26-cli
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

Mounting the Docker socket gives the container full daemon access — be aware this is effectively root-equivalent on the host.



## Troubleshooting

### Container won't start

```bash
docker logs <container>                # check output / error
docker inspect <container>             # check State.ExitCode, State.Error
docker run -it --entrypoint bash myimage  # override entrypoint to debug
```

Common causes: port already in use, missing environment variables, wrong entrypoint, missing file at startup.

### Container exits immediately

```bash
docker logs <container>                # did PID 1 crash?
docker run -it myimage sh              # run interactively to investigate
```

PID 1 must stay running — if your command exits, the container exits.

### Can't connect between containers

```bash
docker network inspect mynet          # check both containers are on same network
docker exec containerA ping containerB # test reachability
docker exec containerA nslookup containerB  # test DNS
```

Most common cause: containers on different networks, or using the default bridge (which doesn't support DNS by name).

### Volume permissions

```bash
docker run -v mydata:/data myimage ls -la /data
# If permission denied: chown inside container, or set --user to match host uid
docker run -v mydata:/data --user $(id -u):$(id -g) myimage
```

### Disk space

```bash
docker system df                       # what's using space
docker system prune -a --volumes       # reclaim everything unused
docker buildx prune                    # clear BuildKit cache
```

### Slow builds

- Move `COPY . .` to the last possible instruction (maximise cache hits on earlier layers).
- Enable BuildKit: `DOCKER_BUILDKIT=1 docker build .`
- Use `--mount=type=cache` for package manager caches.
- Use a `.dockerignore` to reduce context size.



## Glossary

| Term | Definition |
|||
| **Image** | Read-only layered filesystem snapshot. Blueprint for containers. |
| **Container** | Running instance of an image. Isolated process with its own namespaces. |
| **Layer** | A single filesystem diff within an image. Created by each Dockerfile instruction. |
| **Registry** | Server that stores and serves Docker images. |
| **Dockerfile** | Text file of instructions for building an image. |
| **Docker Compose** | Tool for defining and running multi-container apps via YAML. |
| **Volume** | Persistent storage managed by Docker, decoupled from the container lifecycle. |
| **Bind mount** | Mounting a host directory directly into a container. |
| **Bridge network** | Virtual switch on a single host connecting containers. |
| **Overlay network** | Multi-host virtual network spanning Docker nodes (Swarm). |
| **BuildKit** | Next-generation Docker build engine with parallel builds, cache mounts, secrets. |
| **Buildx** | Docker CLI plugin for BuildKit, enabling multi-platform builds. |
| **containerd** | Industry-standard container runtime that Docker delegates to. |
| **runc** | Low-level OCI runtime that calls the Linux kernel to create containers. |
| **OCI** | Open Container Initiative — standards for image format and runtime. |
| **Namespace** | Linux kernel feature providing process isolation (PID, net, mnt, etc.). |
| **cgroup** | Linux kernel feature enforcing resource limits (CPU, memory, I/O). |
| **OverlayFS** | Union filesystem that stacks read-only image layers + a writable container layer. |
| **ENTRYPOINT** | The main process of a container. Not overridden by `docker run` arguments. |
| **CMD** | Default arguments to ENTRYPOINT. Overridden by `docker run` arguments. |
| **Multi-stage build** | Using multiple FROM instructions to produce a minimal final image. |
| **Distroless** | Minimal base images containing only the app and its runtime — no shell or package manager. |
| **Docker Scout** | Docker's built-in image vulnerability scanning tool. |
| **Content Trust (DCT)** | Feature for signing and verifying images using Notary. |
| **Healthcheck** | Command Docker runs to determine if a container is healthy. |
| **Init process (tini/dumb-init)** | Minimal PID 1 that correctly handles signals and zombie processes. |
| **Swarm** | Docker's built-in container orchestration system (multi-host). |
| **Context** | Files sent to the Docker daemon when building an image. |
| **Dangling image** | An untagged image layer no longer referenced by any tagged image. |



*Generated with Docker 26.x reference. Always check [docs.docker.com](https://docs.docker.com) for the latest.*