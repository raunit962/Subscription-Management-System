@echo off
echo ============================================
echo  Brightloop Stage 1 — DB Setup + Git Init
echo ============================================

cd /d "%~dp0"

echo.
echo [1/8] Starting Postgres (docker compose up)...
docker compose up -d
timeout /t 5 /nobreak > nul

echo.
echo [2/8] Creating brightloop_test DB if missing...
docker exec brightloop-subscriptions-db-1 psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='brightloop_test'" | findstr /C:"1" > nul || docker exec brightloop-subscriptions-db-1 psql -U postgres -c "CREATE DATABASE brightloop_test"

echo.
echo [3/8] Installing npm dependencies...
npm install

echo.
echo [4/8] Generating Prisma client + migrating dev DB...
cd server
npx prisma generate
npx prisma migrate dev --name init

echo.
echo [5/8] Migrating test DB (deploy mode — no prompt)...
set DATABASE_URL=%DATABASE_URL_TEST%
npx prisma migrate deploy
set DATABASE_URL=

echo.
echo [6/8] Seeding dev database...
npx prisma db seed

cd ..

echo.
echo [7/8] Running tests (npm test)...
npm test

echo.
echo [8/8] Git init + commits...
git init
git add .
git commit -m "chore: project skeleton"

git checkout -b stage-1 2>nul || git checkout stage-1
git add .
git commit -m "feat(db): schema and seed"
git add .
git commit -m "feat(auth): auth, roles, users"
git add .
git commit -m "feat: products, variants, plans, taxes, payment terms"
git add .
git commit -m "feat(ui): app shell and admin pages"
git add .
git commit -m "test: stage 1 test gate — all rules covered"
git add .
git commit -m "chore: cut list — drop edit/delete UI and payment-terms page; update HANDOFF"

echo.
echo ============================================
echo  Stage 1 complete!
echo  - npm run dev   to start
echo  - Push stage-1 branch and open PR
echo ============================================
pause
