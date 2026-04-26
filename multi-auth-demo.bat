@echo off
echo ==================================================
echo    Flora-Yield: Multi-Instance Auth Demo  
echo ==================================================
echo.
echo Starting Service Registry ^& Gateway...
start cmd /k "npm run start:registry"
timeout /t 3 /nobreak >nul
start cmd /k "npm run start:gateway"
timeout /t 5 /nobreak >nul
echo.
echo Starting AUTH-SERVICE Instance 1 ^(Port 5001^)...
start cmd /k "cd services\auth-service && set PORT=5001 && npm start"
timeout /t 3 /nobreak >nul
echo Starting AUTH-SERVICE Instance 2 ^(Port 5007^)...
start cmd /k "cd services\auth-service && set PORT=5007 && npm start"
echo.
echo ==================================================
echo           LIVE DEMO INSTRUCTIONS:              
echo ==================================================
echo 1. Registry Dashboard: http://localhost:3001/dashboard
echo    ^<- Shows 2x "auth-service" instances UP
echo.
echo 2. Test Load Balancing:
echo    curl http://localhost:3000/api/auth/login -d "{\"email\":\"test@test.com\",\"password\":\"pass\"}" -H "Content-Type: application/json"
echo    ^<- Gateway rotates between 5001 ^& 5007 ^(check logs^)
echo.
echo 3. Simulate Failure: Close/kill Port 5007 terminal
echo    ^<- 60s later: Registry marks DOWN, requests skip it!
echo.
echo 4. Restart: set PORT=5007 && cd services/auth-service && npm start
echo.
echo ENDPOINTS:
echo - Services: http://localhost:3001/services/auth-service
echo - Gateway:  http://localhost:3000/api/auth/me
pause
