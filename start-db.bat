@echo off
echo Starting local PostgreSQL server on port 5433...
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" start -D "%~dp0.pgdata" -l "%~dp0pg.log"
"C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -p 5433
echo Database is ready!
