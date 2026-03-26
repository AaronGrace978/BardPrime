@echo off
title BardPrime — Your Personal Bard
color 0E

echo.
echo   ============================================
echo   =                                          =
echo   =       BardPrime - Your Personal Bard     =
echo   =                                          =
echo   ============================================
echo.

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

:: Check for Rust/Cargo
where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Rust not found. Install from https://rustup.rs
    pause
    exit /b 1
)

:: Check for Python
set "PYTHON="
if exist "C:\Users\AGrac\AppData\Local\Programs\Python\Python313\python.exe" (
    set "PYTHON=C:\Users\AGrac\AppData\Local\Programs\Python\Python313\python.exe"
) else if exist "A:\Python\python.exe" (
    set "PYTHON=A:\Python\python.exe"
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        set "PYTHON=python"
    ) else (
        echo [ERROR] Python not found.
        pause
        exit /b 1
    )
)

echo   Python:  %PYTHON%
echo   Node:    & node --version
echo   Cargo:   & cargo --version

:: Install Python deps if needed
echo.
echo   [1/3] Checking Python dependencies...
%PYTHON% -c "import dotenv, requests, numpy" >nul 2>&1
if %errorlevel% neq 0 (
    echo         Installing Python packages...
    %PYTHON% -m pip install -r "%~dp0requirements.txt" --quiet
)
echo         OK

:: Install npm deps if needed
echo   [2/3] Checking frontend dependencies...
if not exist "%~dp0app\node_modules" (
    echo         Installing npm packages...
    cd /d "%~dp0app"
    npm install --silent
    cd /d "%~dp0"
)
echo         OK

:: Launch
echo   [3/3] Launching BardPrime...
echo.
echo   ============================================
echo   =  Starting Tauri dev server...            =
echo   =  The app window will open shortly.       =
echo   =  Press Ctrl+C here to stop.              =
echo   ============================================
echo.

cd /d "%~dp0app"
npm run tauri dev
