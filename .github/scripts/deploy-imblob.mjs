import fs from 'fs/promises';
import path from 'path';

const API_BASE = 'https://app.imblob.com';
const appName = process.env.IMBLOB_APP_NAME;
const apiKey = process.env.IMBLOB_API_KEY;

if (!appName || !apiKey) {
  console.error('Missing IMBLOB_APP_NAME or IMBLOB_API_KEY');
  process.exit(1);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findBuildDir() {
  const candidates = ['dist', 'build'];
  for (const dir of candidates) {
    if (await exists(dir)) return dir;
  }
  throw new Error('No build directory found. Expected dist/ or build/.');
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(full));
    } else {
      out.push(full);
    }
  }

  return out;
}

const buildDir = await findBuildDir();
const filesOnDisk = await walk(buildDir);

const files = [];
for (const filePath of filesOnDisk) {
  const rel = path.relative(buildDir, filePath).split(path.sep).join('/');
  const content = await fs.readFile(filePath, 'utf8');
  files.push({ path: rel, content });
}

if (files.length === 0) {
  throw new Error(`No files found in ${buildDir}`);
}

const res = await fetch(`${API_BASE}/v1/apps/${encodeURIComponent(appName)}/deploys`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    files,
    description: 'Automated deploy from GitHub Actions',
    preview: false
  }),
});

const text = await res.text();

if (!res.ok) {
  console.error(`Imblob deploy failed (${res.status}):`);
  console.error(text);
  process.exit(1);
}

console.log(text);
