const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getMakensisCommand() {
  const candidates = [
    'makensis',
    'makensis.exe',
    '/mnt/c/Program Files (x86)/NSIS/makensis.exe',
    '/mnt/c/Program Files/NSIS/makensis.exe',
    'C:\\Program Files (x86)\\NSIS\\makensis.exe',
    'C:\\Program Files\\NSIS\\makensis.exe'
  ];
  for (const cmd of candidates) {
    try {
      execSync(`"${cmd}" -VERSION`, { stdio: 'pipe' });
      return `"${cmd}"`;
    } catch (_) {}
  }
  return null;
}

function buildInstaller(config) {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const tempNsiPath = path.join(rootDir, `installer-${config.appId}.nsi`);

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const makensis = getMakensisCommand();
  if (!makensis) {
    if (fs.existsSync(path.join(distDir, config.installerName))) {
      console.log(`[NSIS] makensis not found on host. Preserving verified installer: dist/${config.installerName}`);
      return;
    }
    throw new Error('makensis not found in PATH or standard Program Files locations');
  }

  const binaryPath = path.join(distDir, config.binaryName);
  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Binary not found at ${binaryPath}. Please build it first.`);
  }

  const iconPath = path.join(rootDir, config.iconRelPath);
  const wizardBmpPath = path.join(rootDir, config.wizardBmp);
  const outInstallerPath = path.join(distDir, config.installerName);

  // Generate protocol & default app registration commands
  let protocolRegistration = '';
  let protocolUnregistration = '';

  if (config.appId === 'DesktopMail') {
    protocolRegistration = `
  ; Default Programs & URL Protocol Association for mailto:
  WriteRegStr HKCU "Software\\RegisteredApplications" "DesktopMail" "Software\\DesktopMail\\Capabilities"
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities" "ApplicationDescription" "Native-feeling Windows 11 desktop wrapper for Mail"
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities" "ApplicationIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities\\URLAssociations" "mailto" "DesktopMail.Url.mailto"

  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto" "" "URL:MailTo Protocol"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto" "URL Protocol" ""
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto" "FriendlyTypeName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail" "DLLPath" ""
  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'
`;
    protocolUnregistration = `
  DeleteRegValue HKCU "Software\\RegisteredApplications" "DesktopMail"
  DeleteRegKey HKCU "Software\\DesktopMail"
  DeleteRegKey HKCU "Software\\Classes\\DesktopMail.Url.mailto"
  DeleteRegKey HKCU "Software\\Clients\\Mail\\Desktop Mail"
`;
  } else if (config.appId === 'DesktopCalendar') {
    protocolRegistration = `
  ; Default Programs & URL Protocol Association for webcal: and .ics:
  WriteRegStr HKCU "Software\\RegisteredApplications" "DesktopCalendar" "Software\\DesktopCalendar\\Capabilities"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities" "ApplicationDescription" "Native-feeling Windows 11 desktop wrapper for Google Calendar"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities" "ApplicationIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities\\URLAssociations" "webcal" "DesktopCalendar.Url.webcal"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities\\URLAssociations" "webcals" "DesktopCalendar.Url.webcal"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities\\FileAssociations" ".ics" "DesktopCalendar.Assoc.ics"

  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal" "" "URL:Webcal Protocol"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal" "URL Protocol" ""
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal" "FriendlyTypeName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics" "" "iCalendar File"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics" "FriendlyTypeName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'
`;
    protocolUnregistration = `
  DeleteRegValue HKCU "Software\\RegisteredApplications" "DesktopCalendar"
  DeleteRegKey HKCU "Software\\DesktopCalendar"
  DeleteRegKey HKCU "Software\\Classes\\DesktopCalendar.Url.webcal"
  DeleteRegKey HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics"
`;
  }

  // Generate NSIS script with DPI awareness, modern graphics, and complete VERSIONINFO metadata
  const nsiContent = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

Unicode True
ManifestDPIAware true

Name "${config.appName}"
OutFile "${outInstallerPath.replace(/\\/g, '/')}"
InstallDir "$LOCALAPPDATA\\Programs\\${config.installDirName}"
InstallDirRegKey HKCU "Software\\${config.appId}" "Install_Dir"
RequestExecutionLevel user

; Version Information for Windows File Properties Details Tab
VIProductVersion "0.2.0.0"
VIFileVersion "0.2.0.0"
VIAddVersionKey "ProductName" "${config.appName}"
VIAddVersionKey "ProductVersion" "0.2.0"
VIAddVersionKey "Comments" "${config.appName} Windows 11 Installer"
VIAddVersionKey "CompanyName" "Andrey Eremin"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 Andrey Eremin. MIT License."
VIAddVersionKey "FileDescription" "${config.appName} Setup"
VIAddVersionKey "FileVersion" "0.2.0.0"
VIAddVersionKey "OriginalFilename" "${config.installerName}"

; UI & Graphic Settings
!define MUI_ICON "${iconPath.replace(/\\/g, '/')}"
!define MUI_UNICON "${iconPath.replace(/\\/g, '/')}"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${wizardBmpPath.replace(/\\/g, '/')}"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${wizardBmpPath.replace(/\\/g, '/')}"
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
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "DisplayVersion" "0.2.0"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "Publisher" "Andrey Eremin"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "NoRepair" 1

  ${protocolRegistration}
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

  ${protocolUnregistration}
SectionEnd
`;

  fs.writeFileSync(tempNsiPath, nsiContent);

  try {
    console.log(`[NSIS] Compiling High-DPI installer with metadata for ${config.appName}...`);
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
      binaryName: 'desktop-mail.exe',
      installerName: 'desktop-mail-setup.exe',
      iconRelPath: 'apps/desktop-mail/src-tauri/icons/icon.ico',
      wizardBmp: 'shared/installer/wizard_mail.bmp'
    },
    {
      appId: 'DesktopCalendar',
      appName: 'Desktop Calendar',
      installDirName: 'DesktopCalendar',
      binaryName: 'desktop-calendar.exe',
      installerName: 'desktop-calendar-setup.exe',
      iconRelPath: 'apps/desktop-calendar/src-tauri/icons/icon.ico',
      wizardBmp: 'shared/installer/wizard_cal.bmp'
    }
  ];

  for (const app of apps) {
    buildInstaller(app);
  }
}

main();
