# Brightloop Subscription Management System

## Prerequisites

- Node.js 20+
- Docker & Docker Compose

## Setup

```bash
# 1. Start Postgres
docker compose up -d

# 2. Copy env file
cp .env.example .env

# 3. Install, migrate & seed
npm run setup

# 4. Start dev servers (client :5173, server :4000)
npm run dev
```

## Demo Logins

| Role     | Email                  | Password    |
|----------|------------------------|-------------|
| Admin    | admin@brightloop.com   | Admin@123!  |
| Internal | staff@brightloop.com   | Staff@123!  |
| Portal   | alice@example.com      | Portal@123! |
| Portal   | bob@example.com        | Portal@123! |

## Scripts

| Command          | Description                        |
|------------------|------------------------------------|
| `npm run setup`  | Install + migrate + seed           |
| `npm run dev`    | Start client & server              |
| `npm test`       | Run server tests                   |
| `npm run seed`   | Re-seed the database               |

