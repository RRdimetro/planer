@echo off
setlocal
set "FOCUS_DATA_DIR="
set "FOCUS_DEV_URL="
set "ELECTRON_RUN_AS_NODE="
set "FOCUS_DEMO=1"
set "FOCUS_HOME_CONCEPT=B"
set "FOCUS_DEMO_EMPTY=1"
if not exist "%~dp0FOCUS_OS_PRO_Forest_Noir_V4_Preview_UNTESTED.exe" (
  echo Extract the complete Windows preview ZIP into one folder.
  pause
  exit /b 1
)
start "" "%~dp0FOCUS_OS_PRO_Forest_Noir_V4_Preview_UNTESTED.exe"
endlocal
