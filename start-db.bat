@echo off
echo ========================================================
echo Starting local PostgreSQL server on port 5433...
echo ========================================================
if not exist "%~dp0.pgdata" (
    echo Initializing database cluster in %~dp0.pgdata...
    "C:\Program Files\PostgreSQL\18\bin\initdb.exe" -D "%~dp0.pgdata" -U postgres -A trust -E UTF8
    echo port = 5433 >> "%~dp0.pgdata\postgresql.conf"
    echo fsync = off >> "%~dp0.pgdata\postgresql.conf"
    echo synchronous_commit = off >> "%~dp0.pgdata\postgresql.conf"
    echo full_page_writes = off >> "%~dp0.pgdata\postgresql.conf"
)
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" start -D "%~dp0.pgdata" -l "%~dp0pg.log"
"C:\Program Files\PostgreSQL\18\bin\createdb.exe" -h 127.0.0.1 -p 5433 -U postgres brightloop 2>nul
"C:\Program Files\PostgreSQL\18\bin\createdb.exe" -h 127.0.0.1 -p 5433 -U postgres brightloop_test 2>nul
"C:\Program Files\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 -p 5433
echo Database is up and running on port 5433!
