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
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const appVersion = pkg.version;
  const quadVersion = appVersion.split('.').concat(['0', '0', '0']).slice(0, 4).join('.');

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

  const searchDirs = [
    path.join(rootDir, 'target', 'x86_64-pc-windows-msvc', 'release'),
    path.join(rootDir, 'target', 'release'),
    path.join(rootDir, 'target', 'x86_64-pc-windows-msvc', 'debug'),
    path.join(rootDir, 'target', 'debug'),
    distDir
  ];
  let binaryPath = null;
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const candidate = path.join(dir, config.binaryName);
    if (fs.existsSync(candidate)) {
      binaryPath = candidate;
      break;
    }
  }

  if (!binaryPath) {
    throw new Error(`Binary not found for ${config.binaryName}. Please build it first.`);
  }

  // Ensure dist has the freshest compiled binary before packaging installer
  const distBinaryPath = path.join(distDir, config.binaryName);
  if (binaryPath !== distBinaryPath) {
    fs.copyFileSync(binaryPath, distBinaryPath);
  }
  binaryPath = distBinaryPath;

  const iconPath = path.join(rootDir, config.iconRelPath);
  const pngPath = path.join(rootDir, config.pngRelPath);
  const wizardBmpPath = path.join(rootDir, config.wizardBmp);
  const outInstallerPath = path.join(distDir, config.installerName);

  // Generate protocol & default app registration commands
  let protocolRegistration = '';
  let protocolUnregistration = '';

  if (config.appId === 'DesktopMail') {
    protocolRegistration = `
  ; Default Programs & URL Protocol Association for mailto:
  WriteRegStr HKCU "Software\\RegisteredApplications" "${config.appName}" "Software\\DesktopMail\\Capabilities"
  WriteRegStr HKCU "Software\\RegisteredApplications" "DesktopMail" "Software\\DesktopMail\\Capabilities"
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities" "ApplicationCompany" "Andrey Eremin"
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities" "ApplicationDescription" "Native-feeling Windows 11 desktop wrapper for Mail"
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities" "ApplicationIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\DesktopMail\\Capabilities\\URLAssociations" "mailto" "DesktopMail.Url.mailto"

  ; Applications registration: Ensures Windows 11 "Select a default app" list displays "Desktop Mail" instead of "desktop-mail.exe"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "FriendlyAppName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "ApplicationCompany" "Andrey Eremin"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "AppUserModelId" "com.andrey.desktop-mail"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}\\SupportedProtocols\\mailto" "" ""
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  ; App Paths
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${config.binaryName}" "" '"$INSTDIR\\${config.binaryName}"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${config.binaryName}" "Path" '"$INSTDIR"'

  ; ProgID for mailto:
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto" "URL Protocol" ""
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto" "FriendlyTypeName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto" "AppUserModelId" "com.andrey.desktop-mail"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\Application" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\Application" "ApplicationCompany" "Andrey Eremin"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\Application" "ApplicationDescription" "Native-feeling Windows 11 desktop wrapper for Mail"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\Application" "ApplicationIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\Application" "AppUserModelId" "com.andrey.desktop-mail"
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopMail.Url.mailto\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  ; Clients\\Mail registration for legacy & modern Windows Mail pickers
  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail" "DLLPath" ""
  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Clients\\Mail\\Desktop Mail\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  ; Action Center Notification AUMID Registration
  WriteRegStr HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-mail" "DisplayName" "Desktop Mail"
  WriteRegDWORD HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-mail" "ShowInSettings" 1
  WriteRegStr HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-mail" "IconUri" "$INSTDIR\\app.png"
  WriteRegStr HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-mail" "IconPath" "$INSTDIR\\app.ico"
`;
    protocolUnregistration = `
  DeleteRegValue HKCU "Software\\RegisteredApplications" "${config.appName}"
  DeleteRegValue HKCU "Software\\RegisteredApplications" "DesktopMail"
  DeleteRegKey HKCU "Software\\DesktopMail"
  DeleteRegKey HKCU "Software\\Classes\\Applications\\${config.binaryName}"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${config.binaryName}"
  DeleteRegKey HKCU "Software\\Classes\\DesktopMail.Url.mailto"
  DeleteRegKey HKCU "Software\\Clients\\Mail\\Desktop Mail"
  DeleteRegKey HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-mail"
`;
  } else if (config.appId === 'DesktopCalendar') {
    protocolRegistration = `
  ; Default Programs & URL Protocol Association for webcal: and .ics:
  WriteRegStr HKCU "Software\\RegisteredApplications" "${config.appName}" "Software\\DesktopCalendar\\Capabilities"
  WriteRegStr HKCU "Software\\RegisteredApplications" "DesktopCalendar" "Software\\DesktopCalendar\\Capabilities"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities" "ApplicationCompany" "Andrey Eremin"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities" "ApplicationDescription" "Native-feeling Windows 11 desktop wrapper for Calendar"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities" "ApplicationIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities\\URLAssociations" "webcal" "DesktopCalendar.Url.webcal"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities\\URLAssociations" "webcals" "DesktopCalendar.Url.webcal"
  WriteRegStr HKCU "Software\\DesktopCalendar\\Capabilities\\FileAssociations" ".ics" "DesktopCalendar.Assoc.ics"

  ; Applications registration: Ensures Windows 11 "Select a default app" list displays "Desktop Calendar" instead of "desktop-calendar.exe"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "FriendlyAppName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "ApplicationCompany" "Andrey Eremin"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}" "AppUserModelId" "com.andrey.desktop-calendar"
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}\\SupportedProtocols\\webcal" "" ""
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}\\SupportedProtocols\\webcals" "" ""
  WriteRegStr HKCU "Software\\Classes\\Applications\\${config.binaryName}\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  ; App Paths
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${config.binaryName}" "" '"$INSTDIR\\${config.binaryName}"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${config.binaryName}" "Path" '"$INSTDIR"'

  ; ProgID for webcal:
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal" "URL Protocol" ""
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal" "FriendlyTypeName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal" "AppUserModelId" "com.andrey.desktop-calendar"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\Application" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\Application" "ApplicationCompany" "Andrey Eremin"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\Application" "ApplicationDescription" "Native-feeling Windows 11 desktop wrapper for Calendar"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\Application" "ApplicationIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\Application" "AppUserModelId" "com.andrey.desktop-calendar"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Url.webcal\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  ; ProgID for .ics files:
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics" "FriendlyTypeName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics" "AppUserModelId" "com.andrey.desktop-calendar"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\Application" "ApplicationName" "${config.appName}"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\Application" "ApplicationCompany" "Andrey Eremin"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\Application" "ApplicationDescription" "Native-feeling Windows 11 desktop wrapper for Calendar"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\Application" "ApplicationIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\Application" "AppUserModelId" "com.andrey.desktop-calendar"
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  ; Clients\\Calendar registration
  WriteRegStr HKCU "Software\\Clients\\Calendar\\Desktop Calendar" "" "${config.appName}"
  WriteRegStr HKCU "Software\\Clients\\Calendar\\Desktop Calendar\\DefaultIcon" "" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Clients\\Calendar\\Desktop Calendar\\shell\\open\\command" "" '"$INSTDIR\\${config.binaryName}" "%1"'

  ; Action Center Notification AUMID Registration
  WriteRegStr HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-calendar" "DisplayName" "Desktop Calendar"
  WriteRegDWORD HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-calendar" "ShowInSettings" 1
  WriteRegStr HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-calendar" "IconUri" "$INSTDIR\\app.png"
  WriteRegStr HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-calendar" "IconPath" "$INSTDIR\\app.ico"
`;
    protocolUnregistration = `
  DeleteRegValue HKCU "Software\\RegisteredApplications" "${config.appName}"
  DeleteRegValue HKCU "Software\\RegisteredApplications" "DesktopCalendar"
  DeleteRegKey HKCU "Software\\DesktopCalendar"
  DeleteRegKey HKCU "Software\\Classes\\Applications\\${config.binaryName}"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${config.binaryName}"
  DeleteRegKey HKCU "Software\\Classes\\DesktopCalendar.Url.webcal"
  DeleteRegKey HKCU "Software\\Classes\\DesktopCalendar.Assoc.ics"
  DeleteRegKey HKCU "Software\\Clients\\Calendar\\Desktop Calendar"
  DeleteRegKey HKCU "Software\\Classes\\AppUserModelId\\com.andrey.desktop-calendar"
`;
  }

  // Generate NSIS script with DPI awareness, modern graphics, and complete VERSIONINFO metadata
  const nsiContent = `
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

Unicode True
ManifestDPIAware true

Name "${config.appName}"
OutFile "${outInstallerPath.replace(/\\/g, '/')}"
InstallDir "$LOCALAPPDATA\\Programs\\${config.installDirName}"
InstallDirRegKey HKCU "Software\\${config.appId}" "Install_Dir"
RequestExecutionLevel user

; Version Information for Windows File Properties Details Tab
VIProductVersion "${quadVersion}"
VIFileVersion "${quadVersion}"
VIAddVersionKey "ProductName" "${config.appName}"
VIAddVersionKey "ProductVersion" "${appVersion}"
VIAddVersionKey "Comments" "${config.appName} Windows 11 Installer"
VIAddVersionKey "CompanyName" "Andrey Eremin"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 Andrey Eremin. MIT License."
VIAddVersionKey "FileDescription" "${config.appName} Setup"
VIAddVersionKey "FileVersion" "${quadVersion}"
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

Function .onInit
  InitPluginsDir
  ; Terminate any existing running instance as soon as setup starts
  nsExec::Exec '"$SYSDIR\\taskkill.exe" /F /IM "${config.binaryName}" /T'
FunctionEnd

Function un.onInit
  InitPluginsDir
  nsExec::Exec '"$SYSDIR\\taskkill.exe" /F /IM "${config.binaryName}" /T'
FunctionEnd

Section "Install"
  ; Terminate any existing running instance to release Windows file locks
  DetailPrint "Closing running instances of ${config.appName}..."
  nsExec::Exec '"$SYSDIR\\taskkill.exe" /F /IM "${config.binaryName}" /T'
  Sleep 1000

  SetOverwrite on
  SetOutPath "$INSTDIR"

  ; Ensure any existing installed binary is cleanly unlinked and always overwritten
  ClearErrors
  Delete "$INSTDIR\\${config.binaryName}"
  \${If} \${Errors}
    DetailPrint "Waiting for file locks on ${config.appName} to release..."
    nsExec::Exec '"$SYSDIR\\taskkill.exe" /F /IM "${config.binaryName}" /T'
    Sleep 1500
    ClearErrors
    Delete "$INSTDIR\\${config.binaryName}"
  \${EndIf}

  File "${binaryPath.replace(/\\/g, '/')}"
  File "/oname=app.ico" "${iconPath.replace(/\\/g, '/')}"
  File "/oname=app.png" "${pngPath.replace(/\\/g, '/')}"
  
  WriteUninstaller "$INSTDIR\\uninstall.exe"
  
  ; Shortcuts
  CreateDirectory "$SMPROGRAMS\\${config.appName}"
  CreateShortcut "$SMPROGRAMS\\${config.appName}\\${config.appName}.lnk" "$INSTDIR\\${config.binaryName}" "" "$INSTDIR\\app.ico" 0
  CreateShortcut "$SMPROGRAMS\\${config.appName}\\Uninstall.lnk" "$INSTDIR\\uninstall.exe" "" "$INSTDIR\\uninstall.exe" 0
  CreateShortcut "$DESKTOP\\${config.appName}.lnk" "$INSTDIR\\${config.binaryName}" "" "$INSTDIR\\app.ico" 0

  ; Registry for Add/Remove Programs
  WriteRegStr HKCU "Software\\${config.appId}" "Install_Dir" "$INSTDIR"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "DisplayName" "${config.appName}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "UninstallString" '"$INSTDIR\\uninstall.exe"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "DisplayIcon" '"$INSTDIR\\${config.binaryName}",0'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "DisplayVersion" "${appVersion}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "Publisher" "Andrey Eremin"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${config.appId}" "NoRepair" 1

  ${protocolRegistration}
SectionEnd

Section "Uninstall"
  ; Terminate running instances before uninstallation
  DetailPrint "Closing running instances of ${config.appName}..."
  nsExec::Exec '"$SYSDIR\\taskkill.exe" /F /IM "${config.binaryName}" /T'
  Sleep 1000

  Delete "$DESKTOP\\${config.appName}.lnk"
  Delete "$SMPROGRAMS\\${config.appName}\\${config.appName}.lnk"
  Delete "$SMPROGRAMS\\${config.appName}\\Uninstall.lnk"
  RMDir "$SMPROGRAMS\\${config.appName}"
  
  Delete "$INSTDIR\\${config.binaryName}"
  Delete "$INSTDIR\\app.ico"
  Delete "$INSTDIR\\app.png"
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
      pngRelPath: 'apps/desktop-mail/src-tauri/icons/512x512.png',
      wizardBmp: 'shared/installer/wizard_mail.bmp'
    },
    {
      appId: 'DesktopCalendar',
      appName: 'Desktop Calendar',
      installDirName: 'DesktopCalendar',
      binaryName: 'desktop-calendar.exe',
      installerName: 'desktop-calendar-setup.exe',
      iconRelPath: 'apps/desktop-calendar/src-tauri/icons/icon.ico',
      pngRelPath: 'apps/desktop-calendar/src-tauri/icons/512x512.png',
      wizardBmp: 'shared/installer/wizard_cal.bmp'
    }
  ];

  for (const app of apps) {
    buildInstaller(app);
  }
}

main();
