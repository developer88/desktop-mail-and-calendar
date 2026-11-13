const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

console.log('Running E2E Binary, Installer, PE Resource & Manifest Verification Tests...');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const expectedVersion = pkgJson.version;

// Helper to verify Windows PE (MZ + PE\0\0 header)
function verifyPeHeader(filePath) {
  assert(fs.existsSync(filePath), `Missing expected artifact: ${filePath}`);
  const buf = fs.readFileSync(filePath);
  assert(buf.length > 100 * 1024, `${path.basename(filePath)} is unexpectedly small (${buf.length} bytes)`);

  // Check DOS 'MZ' magic
  assert.strictEqual(buf[0], 0x4d, `${path.basename(filePath)} missing MZ header byte 0`);
  assert.strictEqual(buf[1], 0x5a, `${path.basename(filePath)} missing MZ header byte 1`);

  // Check PE signature offset at 0x3C
  const peOffset = buf.readUInt32LE(0x3c);
  assert(peOffset > 0 && peOffset + 4 < buf.length, `${path.basename(filePath)} invalid e_lfanew offset`);
  assert.strictEqual(buf.subarray(peOffset, peOffset + 4).toString('ascii'), 'PE\0\0', `${path.basename(filePath)} missing PE\\0\\0 signature`);

  return buf;
}

// Helper to search UTF-16LE string inside a PE binary's VERSIONINFO resource
function containsUtf16LeString(buf, str) {
  const target = Buffer.from(str, 'utf16le');
  return buf.indexOf(target) !== -1;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// ============================================================================
// 1. Verify Version Synchronization Across Entire Monorepo
// ============================================================================
console.log(`\n[1/4] Verifying version synchronization (${expectedVersion}) across all manifests...`);
{
  const cargoRoot = fs.readFileSync(path.join(root, 'Cargo.toml'), 'utf8');
  assert(cargoRoot.includes(`version = "${expectedVersion}"`), `Root Cargo.toml must have version = "${expectedVersion}"`);

  const mailTauriConf = JSON.parse(fs.readFileSync(path.join(root, 'apps/desktop-mail/tauri.conf.json'), 'utf8'));
  assert.strictEqual(mailTauriConf.version, expectedVersion, 'desktop-mail/tauri.conf.json version mismatch');
  assert.strictEqual(mailTauriConf.productName, 'Desktop Mail');

  const calTauriConf = JSON.parse(fs.readFileSync(path.join(root, 'apps/desktop-calendar/tauri.conf.json'), 'utf8'));
  assert.strictEqual(calTauriConf.version, expectedVersion, 'desktop-calendar/tauri.conf.json version mismatch');
  assert.strictEqual(calTauriConf.productName, 'Desktop Calendar');

  const titlebarJs = fs.readFileSync(path.join(root, 'shared/scripts/titlebar.js'), 'utf8');
  assert(titlebarJs.includes(`verNum.textContent = '${expectedVersion}'`), 'titlebar.js must display current version');

  console.log(`PASS: All workspace manifests synchronized to v${expectedVersion}.`);
}

// ============================================================================
// 2. Verify Compiled Portable Executables & Embedded PE Resources
// ============================================================================
console.log('\n[2/4] Verifying compiled PE executables and embedded VERSIONINFO metadata...');
{
  const mailExePath = path.join(distDir, 'desktop-mail.exe');
  const calExePath = path.join(distDir, 'desktop-calendar.exe');

  const mailBuf = verifyPeHeader(mailExePath);
  assert(
    containsUtf16LeString(mailBuf, 'Desktop Mail'),
    'desktop-mail.exe must have "Desktop Mail" embedded in UTF-16LE VERSIONINFO resources (fixes taskbar right-click name)'
  );
  assert(
    containsUtf16LeString(mailBuf, expectedVersion),
    `desktop-mail.exe must have version "${expectedVersion}" embedded in UTF-16LE VERSIONINFO resources`
  );

  const calBuf = verifyPeHeader(calExePath);
  assert(
    containsUtf16LeString(calBuf, 'Desktop Calendar'),
    'desktop-calendar.exe must have "Desktop Calendar" embedded in UTF-16LE VERSIONINFO resources (fixes taskbar right-click name)'
  );
  assert(
    containsUtf16LeString(calBuf, expectedVersion),
    `desktop-calendar.exe must have version "${expectedVersion}" embedded in UTF-16LE VERSIONINFO resources`
  );

  console.log('PASS: Portable executables have valid PE headers and embedded UTF-16LE VERSIONINFO metadata.');
}

// ============================================================================
// 3. Verify NSIS Setup Installers & Metadata
// ============================================================================
console.log('\n[3/4] Verifying NSIS setup installers and embedded metadata...');
{
  const mailSetupPath = path.join(distDir, 'desktop-mail-setup.exe');
  const calSetupPath = path.join(distDir, 'desktop-calendar-setup.exe');

  const mailSetupBuf = verifyPeHeader(mailSetupPath);
  const calSetupBuf = verifyPeHeader(calSetupPath);

  assert(mailSetupBuf.indexOf(Buffer.from('Nullsoft', 'ascii')) !== -1, 'desktop-mail-setup.exe must be a valid Nullsoft NSIS installer');
  assert(calSetupBuf.indexOf(Buffer.from('Nullsoft', 'ascii')) !== -1, 'desktop-calendar-setup.exe must be a valid Nullsoft NSIS installer');

  // Verify installer VERSIONINFO metadata in UTF-16LE
  assert(
    containsUtf16LeString(mailSetupBuf, 'Desktop Mail Setup'),
    'desktop-mail-setup.exe must have "Desktop Mail Setup" embedded in FileDescription metadata'
  );
  assert(
    containsUtf16LeString(calSetupBuf, 'Desktop Calendar Setup'),
    'desktop-calendar-setup.exe must have "Desktop Calendar Setup" embedded in FileDescription metadata'
  );
  assert(
    containsUtf16LeString(mailSetupBuf, 'Andrey Eremin'),
    'desktop-mail-setup.exe must have CompanyName "Andrey Eremin"'
  );
  assert(
    containsUtf16LeString(calSetupBuf, 'Andrey Eremin'),
    'desktop-calendar-setup.exe must have CompanyName "Andrey Eremin"'
  );

  // Verify build-installers.js configures High-DPI and Default Apps protocol associations
  const installerScript = fs.readFileSync(path.join(root, 'scripts/build-installers.js'), 'utf8');
  assert(installerScript.includes('ManifestDPIAware true'), 'NSIS script must enable ManifestDPIAware true for sharp rendering on High-DPI');
  assert(installerScript.includes('RegisteredApplications'), 'NSIS script must register RegisteredApplications for Windows Default Apps');
  assert(installerScript.includes('URLAssociations'), 'NSIS script must register URLAssociations');
  assert(installerScript.includes('DesktopMail.Url.mailto'), 'NSIS script must register DesktopMail.Url.mailto for mailto: links');
  assert(installerScript.includes('DesktopCalendar.Url.webcal'), 'NSIS script must register DesktopCalendar.Url.webcal for webcal: links');
  assert(installerScript.includes('DesktopCalendar.Assoc.ics'), 'NSIS script must register DesktopCalendar.Assoc.ics for .ics files');

  console.log('PASS: Both NSIS setup installers verified with complete metadata, High-DPI awareness, and Default Apps protocol registrations.');
}

// ============================================================================
// 4. Verify Release Manifest & SHA256SUMS Integrity
// ============================================================================
console.log('\n[4/4] Verifying dist/release-manifest.json and dist/SHA256SUMS.txt...');
{
  const manifestPath = path.join(distDir, 'release-manifest.json');
  const sumsPath = path.join(distDir, 'SHA256SUMS.txt');

  assert(fs.existsSync(manifestPath), 'dist/release-manifest.json must exist');
  assert(fs.existsSync(sumsPath), 'dist/SHA256SUMS.txt must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.version, expectedVersion, 'release-manifest.json version must match package.json');
  assert.strictEqual(manifest.artifacts.length, 4, 'release-manifest.json must list all 4 release artifacts');

  const sumsContent = fs.readFileSync(sumsPath, 'utf8');

  for (const artifact of manifest.artifacts) {
    const filePath = path.join(distDir, artifact.filename);
    assert(fs.existsSync(filePath), `Artifact ${artifact.filename} listed in manifest must exist on disk`);
    const actualSize = fs.statSync(filePath).size;
    const actualHash = sha256File(filePath);

    assert.strictEqual(artifact.sizeBytes, actualSize, `Size mismatch in release-manifest.json for ${artifact.filename}`);
    assert.strictEqual(artifact.sha256, actualHash, `SHA-256 mismatch in release-manifest.json for ${artifact.filename}`);
    assert(
      sumsContent.includes(`${actualHash}  ${artifact.filename}`),
      `SHA256SUMS.txt missing exact checksum entry for ${artifact.filename}`
    );
  }

  console.log('PASS: Release manifest and SHA256SUMS match all 4 staged artifacts.');
}

console.log('\nALL E2E BINARY & INSTALLER VERIFICATION TESTS PASSED!');
