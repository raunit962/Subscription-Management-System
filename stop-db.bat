@echo off
echo Stopping PostgreSQL server...
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" stop -D "%~dp0.pgdata"
echo Database stopped.
