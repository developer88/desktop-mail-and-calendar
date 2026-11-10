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
    distDir,
    path.join(rootDir, 'target', 'release'),
    path.join(rootDir, 'target', 'x86_64-pc-windows-msvc', 'release'),
    path.join(rootDir, 'target', 'x86_64-pc-windows-msvc', 'debug'),
    path.join(rootDir, 'target', 'debug')
  ];

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const apps = [
    { name: 'desktop-gmail', binaryNames: ['desktop-gmail.exe', 'desktop-gmail'] },
    { name: 'desktop-gcalendar', binaryNames: ['desktop-gcalendar.exe', 'desktop-gcalendar'] }
  ];

  const releaseFiles = [];
  const checksums = [];

  for (const app of apps) {
    let foundPath = null;
    let foundName = null;

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      for (const bName of app.binaryNames) {
        const candidate = path.join(dir, bName);
        if (fs.existsSync(candidate)) {
          foundPath = candidate;
          foundName = bName;
          break;
        }
      }
      if (foundPath) break;
    }

    if (foundPath) {
      const destPath = path.join(distDir, foundName);
      if (foundPath !== destPath) {
        fs.copyFileSync(foundPath, destPath);
      }
      const sha256 = calculateSha256(destPath);
      const stats = fs.statSync(destPath);

      releaseFiles.push({
        app: app.name,
        filename: foundName,
        sizeBytes: stats.size,
        sha256: sha256
      });
      checksums.push(`${sha256}  ${foundName}`);
      console.log(`[Release] Staged ${app.name} -> dist/${foundName} (${stats.size} bytes)`);
    } else {
      console.log(`[Release] Info: Binary for ${app.name} not compiled yet.`);
    }
  }

  fs.writeFileSync(path.join(distDir, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');

  const manifest = {
    version: '0.1.0',
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
