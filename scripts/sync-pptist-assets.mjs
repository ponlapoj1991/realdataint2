import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'integrations', 'pptist', 'dist');
const publicDir = path.join(rootDir, 'public');
const targetDir = path.join(publicDir, 'build-reports');

async function syncAssets() {
  if (!existsSync(sourceDir)) {
    throw new Error(
      `PPTist dist not found at ${path.relative(rootDir, sourceDir)}. ` +
        'Make sure you have run "npm --prefix integrations/pptist run build" first.'
    );
  }

  await fs.mkdir(publicDir, { recursive: true });
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });

  console.log(`[pptist] Copied assets to ${path.relative(rootDir, targetDir)}`);
}

syncAssets().catch((error) => {
  console.error('[pptist] Failed to sync assets:', error.message);
  process.exitCode = 1;
});
