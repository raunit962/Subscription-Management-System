@echo off
echo ========================================================
echo Starting Brightloop (Database + Server + Client)...
echo ========================================================
call start-db.bat
echo.
echo Starting backend server on http://localhost:4001 and frontend on http://localhost:5173...
start "Brightloop Server (Port 4001)" cmd /k "npm.cmd run dev -w server"
start "Brightloop Client (Port 5173)" cmd /k "npm.cmd run dev -w client"
echo.
echo ========================================================
echo Servers are launching in separate windows!
echo Open your browser at: http://localhost:5173
echo.
echo Quick Demo Logins:
echo   Admin:    admin@brightloop.com / Admin@123!
echo   Staff:    staff@brightloop.com / Staff@123!
echo   Customer: alice@example.com    / Portal@123!
echo ========================================================
