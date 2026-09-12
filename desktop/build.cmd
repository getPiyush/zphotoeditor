@echo off
REM One-command build for Windows: creates an isolated venv, installs the
REM parent project's and the desktop wrapper's dependencies into it, then
REM runs build.py. See build.py for what it produces and its cross-platform
REM caveat (this only builds a Windows executable).
setlocal

set "SCRIPT_DIR=%~dp0"
set "PARENT_DIR=%SCRIPT_DIR%.."
set "VENV_DIR=%SCRIPT_DIR%.build-venv"
set "PY="

where py >nul 2>nul
if %errorlevel%==0 set "PY=py"
if not defined PY (
    where python >nul 2>nul
    if %errorlevel%==0 set "PY=python"
)

if not defined PY (
    echo Python was not found on this machine.
    echo Install it from https://www.python.org/downloads/windows/
    echo ^(the installer has an "Add python.exe to PATH" checkbox -- check it^)
    exit /b 1
)

"%PY%" -m venv "%VENV_DIR%" || exit /b 1

set "VPY=%VENV_DIR%\Scripts\python.exe"
"%VPY%" -m pip install --quiet --upgrade pip
"%VPY%" -m pip install --quiet -r "%PARENT_DIR%\requirements.txt" -r "%SCRIPT_DIR%requirements.txt"
"%VPY%" "%SCRIPT_DIR%build.py"

echo Done. Executable is in %SCRIPT_DIR%dist\
endlocal
