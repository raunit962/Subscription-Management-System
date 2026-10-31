@echo off
echo ========================================================
echo Setting up Brightloop Database ^& Seeding Data...
echo ========================================================
call "%~dp0start-db.bat"
echo.
echo Running Prisma migrations and seeding...
cd /d "%~dp0server"
call npx.cmd prisma migrate deploy
call npx.cmd prisma db seed
cd /d "%~dp0"
echo.
echo ========================================================
echo Database setup and seed complete!
echo You can now run: start-dev.bat
echo ========================================================
