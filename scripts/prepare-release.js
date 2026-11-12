const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');
  const searchDirs = [
    path.join(rootDir, 'target', 'x86_64-pc-windows-msvc', 'release'),
    path.join(rootDir, 'target', 'release'),
    path.join(rootDir, 'target', 'x86_64-pc-windows-msvc', 'debug'),
    path.join(rootDir, 'target', 'debug'),
    distDir
  ];

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const targets = [
    { app: 'desktop-mail', bName: 'desktop-mail.exe' },
    { app: 'desktop-mail', bName: 'desktop-mail-setup.exe' },
    { app: 'desktop-calendar', bName: 'desktop-calendar.exe' },
    { app: 'desktop-calendar', bName: 'desktop-calendar-setup.exe' }
  ];

  const releaseFiles = [];
  const checksums = [];

  for (const item of targets) {
    let foundPath = null;

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const candidate = path.join(dir, item.bName);
      if (fs.existsSync(candidate)) {
        foundPath = candidate;
        break;
      }
    }

    if (foundPath) {
      const destPath = path.join(distDir, item.bName);
      if (foundPath !== destPath) {
        fs.copyFileSync(foundPath, destPath);
      }
      const sha256 = calculateSha256(destPath);
      const stats = fs.statSync(destPath);

      releaseFiles.push({
        app: item.app,
        filename: item.bName,
        sizeBytes: stats.size,
        sha256: sha256
      });
      checksums.push(`${sha256}  ${item.bName}`);
      console.log(`[Release] Staged ${item.app} -> dist/${item.bName} (${stats.size} bytes)`);
    } else {
      console.log(`[Release] Info: Artifact ${item.bName} not generated yet.`);
    }
  }

  fs.writeFileSync(path.join(distDir, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');

  const manifest = {
    version: '0.2.0',
    buildDate: new Date().toISOString(),
    gitCommit: getGitCommit(),
    artifacts: releaseFiles
  };

  fs.writeFileSync(
    path.join(distDir, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  console.log('[Release] Updated dist/SHA256SUMS.txt and dist/release-manifest.json');
}

main();
