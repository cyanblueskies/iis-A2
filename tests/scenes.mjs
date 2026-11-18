// Scene checks: every ?scene= link must render the state it claims.
//
// The engine has its own cases (tests/run.mjs). This file covers the other half:
// the interface. It serves the folder, loads each scene in headless Chrome and
// looks for the one sentence that only that state contains. A blank panel or a
// thrown exception fails the run, which is exactly the failure a screenshot
// review misses.
//
// Run: node tests/scenes.mjs        (needs python3; skips if Chrome is absent)

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8137;

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

const SCENES = [
  { name: 'confirm-proposal', expect: 'Proposed action' },
  { name: 'confirm-done', expect: 'Moved to Friday 09:00' },
  { name: 'undo-window', expect: 'Undo restores the calendar entry' },
  { name: 'undo-reverted', expect: 'Calendar restored at 00:12' },
  { name: 'undo-draft', expect: 'Draft' },
  { name: 'undo-corrected', expect: 'Correction sent at 00:12' },
  { name: 'undo-expired', expect: 'window closed' },
  { name: 'blocked', expect: 'Stopped before execution' },
  { name: 'clarify', expect: 'Needs one thing from you' },
  { name: 'decline', expect: 'Declined, control returned' },
];

// A fresh profile per run: Chrome will otherwise serve cached JS from a
// previous run and the checks pass or fail against the wrong code.
const PROFILE = mkdtempSync(join(tmpdir(), 'scene-check-'));
process.on('exit', () => rmSync(PROFILE, { recursive: true, force: true }));

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.log('No Chrome found — skipping the scene checks.');
  process.exit(0);
}

const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
  cwd: ROOT,
  stdio: 'ignore',
});

const stop = () => {
  if (!server.killed) server.kill();
};
process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('local server did not start');
}

function dump(url) {
  const out = spawnSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      `--user-data-dir=${PROFILE}`,
      '--virtual-time-budget=2500',
      '--dump-dom',
      url,
    ],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 12 * 1024 * 1024 },
  );
  return `${out.stdout || ''}${out.stderr || ''}`;
}

// The same ten scene names are written down three times: in app.js, in
// scenes.html and in this file. Three hand-kept lists drift, so check them.
function sceneNames() {
  const app = readFileSync(join(ROOT, 'js', 'app.js'), 'utf8');
  const block = app.slice(app.indexOf('const SCENES = {'), app.indexOf('const params ='));
  const inApp = [...block.matchAll(/^\s{2}'?([a-z][a-z-]*)'?:\s*\{/gm)].map((m) => m[1]);

  const page = readFileSync(join(ROOT, 'scenes.html'), 'utf8');
  const inPage = [...page.matchAll(/scene=([a-z][a-z-]*)/g)].map((m) => m[1]);

  return {
    app: [...new Set(inApp)].sort(),
    page: [...new Set(inPage)].sort(),
    test: SCENES.map((s) => s.name).sort(),
  };
}

let failed = 0;
const names = sceneNames();
const same =
  names.app.join() === names.page.join() && names.page.join() === names.test.join();
if (!same) {
  failed += 1;
  console.log('FAIL  the three scene lists disagree');
  console.log('      app.js:  ', names.app.join(', '));
  console.log('      scenes:  ', names.page.join(', '));
  console.log('      tests:   ', names.test.join(', '));
} else {
  console.log(`ok    the three scene lists agree (${names.test.length} scenes)`);
}

await waitForServer();

for (const scene of SCENES) {
  const url = `http://127.0.0.1:${PORT}/index.html?scene=${scene.name}`;
  const dom = dump(url);
  const hasMarker = dom.includes(scene.expect);
  const threw = /Uncaught |TypeError|ReferenceError/.test(dom);
  if (hasMarker && !threw) {
    console.log(`ok    ${scene.name}`);
  } else {
    failed += 1;
    console.log(
      `FAIL  ${scene.name} — ${threw ? 'the page threw' : `missing “${scene.expect}”`}`,
    );
  }
}

stop();
const checks = SCENES.length + 1; // the ten scenes plus the list check
console.log(`\n${checks - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
