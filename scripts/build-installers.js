const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function buildInstaller(config) {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const tempNsiPath = path.join(rootDir, `installer-${config.appId}.nsi`);

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const binaryPath = path.join(distDir, config.binaryName);
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Binary not found at ${binaryPath}. Please build it first.`);
  }

  const iconPath = path.join(rootDir, config.iconRelPath);
  const outInstallerPath = path.join(distDir, config.installerName);

  // Generate NSIS script
  const nsiContent = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

Unicode True
Name "${config.appName}"
OutFile "${outInstallerPath.replace(/\\/g, '/')}"
InstallDir "$LOCALAPPDATA\\Programs\\${config.installDirName}"
InstallDirRegKey HKCU "Software\\${config.appId}" "Install_Dir"
RequestExecutionLevel user

!define MUI_ICON "${iconPath.replace(/\\/g, '/')}"
!define MUI_UNICON "${iconPath.replace(/\\/g, '/')}"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\\${config.binaryName}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${config.appName}"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  
  File "${binaryPath.replace(/\\/g, '/')}"
  
  WriteUninstaller "$INSTDIR\\uninstall.exe"
  
  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\\${config.appName}"
  CreateShortcut "$SMPROGRAMS\\${config.appName}\\${config.appName}.lnk" "$INSTDIR\\${config.binaryName}" "" "$INSTDIR\\${config.binaryName}" 0
  CreateShortcut "$SMPROGRAMS\\${config.appName}\\Uninstall.lnk" "$INSTDIR\\uninstall.exe" "" "$INSTDIR\\uninstall.exe" 0
  CreateShortcut "$DESKTOP\\${config.appName}.lnk" "$INSTDIR\\${config.binaryName}" "" "$INSTDIR\\${config.binaryName}" 0

  ; Registry for Add/Remove Programs
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "DisplayName" "${config.appName}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "UninstallString" '"$INSTDIR\\uninstall.exe"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "DisplayIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "Publisher" "Andrey Eremin"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\\${config.appName}.lnk"
  Delete "$SMPROGRAMS\\${config.appName}\\${config.appName}.lnk"
  Delete "$SMPROGRAMS\\${config.appName}\\Uninstall.lnk"
  RMDir "$SMPROGRAMS\\${config.appName}"
  
  Delete "$INSTDIR\\${config.binaryName}"
  Delete "$INSTDIR\\uninstall.exe"
  RMDir "$INSTDIR"
  
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}"
  DeleteRegKey HKCU "Software\\${config.appId}"
SectionEnd
`;

  fs.writeFileSync(tempNsiPath, nsiContent);

  try {
    console.log(`[NSIS] Compiling installer for ${config.appName}...`);
    execSync(`makensis "${tempNsiPath}"`, { stdio: 'inherit' });
    console.log(`[NSIS] Successfully generated installer: dist/${config.installerName}`);
  } finally {
    if (fs.existsSync(tempNsiPath)) {
      fs.unlinkSync(tempNsiPath);
    }
  }
}

function main() {
  const apps = [
    {
      appId: 'DesktopMail',
      appName: 'Desktop Mail',
      installDirName: 'DesktopMail',
      binaryName: 'desktop-gmail.exe',
      installerName: 'desktop-gmail-setup.exe',
      iconRelPath: 'apps/desktop-gmail/src-tauri/icons/icon.ico'
    },
    {
      appId: 'DesktopCalendar',
      appName: 'Desktop Calendar',
      installDirName: 'DesktopCalendar',
      binaryName: 'desktop-gcalendar.exe',
      installerName: 'desktop-gcalendar-setup.exe',
      iconRelPath: 'apps/desktop-gcalendar/src-tauri/icons/icon.ico'
    }
  ];

  for (const app of apps) {
    buildInstaller(app);
  }
}

main();
