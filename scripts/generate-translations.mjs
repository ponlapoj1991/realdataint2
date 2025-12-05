import fs from 'fs/promises';
import path from 'path';

const projectRoot = process.cwd();
const pptistSrc = path.resolve(projectRoot, 'integrations', 'pptist', 'src');
const localeDir = path.join(pptistSrc, 'locales');
const manualLocalePath = path.join(localeDir, 'en.ts');
const autoLocalePath = path.join(localeDir, 'generated.ts');

const FILE_EXTENSIONS = new Set(['.vue', '.ts', '.js', '.scss', '.md']);
const HAN_REGEX = /\p{Script=Han}{2,}/gu;
const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const CONCURRENCY = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await getFiles(full)));
    else if (FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function extractTranslations(content) {
  const regex = /\{\s*zh:\s*'([^']+)'\s*,\s*en:\s*'([^']*)'/g;
  const entries = new Map();
  let match;
  while ((match = regex.exec(content))) {
    entries.set(match[1], match[2]);
  }
  return entries;
}

async function collectChineseStrings() {
  const files = await getFiles(pptistSrc);
  const found = new Set();
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    let match;
    while ((match = HAN_REGEX.exec(text))) {
      found.add(match[0]);
    }
  }
  return found;
}

async function translateText(text) {
  const url = `${TRANSLATE_URL}?client=gtx&sl=zh-CN&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const translated = data[0].map((chunk) => chunk[0]).join('').trim();
  return translated || text;
}

async function translateBatch(strings) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < strings.length) {
      const current = strings[index++];
      try {
        const translated = await translateText(current);
        results.push({ zh: current, en: translated });
      } catch (error) {
        console.warn(`[translate] Failed for "${current}": ${error.message}. Using fallback.`);
        results.push({ zh: current, en: current });
      }
      await sleep(150);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, strings.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function formatEntry({ zh, en }) {
  const safeZh = zh.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeEn = en.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `  { zh: '${safeZh}', en: '${safeEn}' },`;
}

async function main() {
  console.log('[translate] Collecting Chinese strings...');
  const strings = await collectChineseStrings();
  console.log(`[translate] Found ${strings.size} unique strings.`);

  const manualContent = await fs.readFile(manualLocalePath, 'utf8');
  const manualEntries = extractTranslations(manualContent);

  let autoEntries = new Map();
  try {
    const autoContent = await fs.readFile(autoLocalePath, 'utf8');
    autoEntries = extractTranslations(autoContent);
  } catch {
    // ignore if file missing
  }

  const existing = new Map([...manualEntries, ...autoEntries]);
  const missing = Array.from(strings).filter((text) => !existing.has(text));
  console.log(`[translate] Missing ${missing.length} strings.`);

  const translated = await translateBatch(missing);
  translated.forEach((entry) => existing.set(entry.zh, entry.en));

  const sortedEntries = Array.from(existing.entries())
    .map(([zh, en]) => ({ zh, en }))
    .sort((a, b) => a.zh.localeCompare(b.zh));

  const fileContent = `import type { TranslationEntry } from './en';\n\nexport const autoTranslations: TranslationEntry[] = [\n${sortedEntries
    .map(formatEntry)
    .join('\n')}\n];\n`;

  await fs.mkdir(localeDir, { recursive: true });
  await fs.writeFile(autoLocalePath, fileContent, 'utf8');
  console.log(`[translate] Wrote ${sortedEntries.length} entries to ${path.relative(projectRoot, autoLocalePath)}`);
}

main().catch((error) => {
  console.error('[translate] Failed:', error);
  process.exit(1);
});
