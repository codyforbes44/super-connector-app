#!/usr/bin/env node
/**
 * Keeps twa-manifest.json (Bubblewrap / Google Play TWA) in sync with
 * public/manifest.webmanifest, and bumps the Android versionCode when the
 * web manifest changed.
 *
 * Usage:
 *   node scripts/sync-twa-manifest.mjs            # sync + bump if changed
 *   node scripts/sync-twa-manifest.mjs --check    # exit 1 if out of sync (CI guard)
 *   node scripts/sync-twa-manifest.mjs --no-bump  # sync without bumping version
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_MANIFEST = resolve(root, 'public/manifest.webmanifest');
const TWA_MANIFEST = resolve(root, 'twa-manifest.json');

const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const noBump = args.has('--no-bump');

const web = JSON.parse(readFileSync(WEB_MANIFEST, 'utf8'));
const twa = JSON.parse(readFileSync(TWA_MANIFEST, 'utf8'));
const before = JSON.stringify(twa);

const origin = `https://${twa.host}`;
const abs = (p) => (/^https?:\/\//.test(p) ? p : `${origin}${p.startsWith('/') ? '' : '/'}${p}`);

const pickIcon = (purpose, size) => {
  const match = (web.icons ?? []).find(
    (i) => (i.purpose ?? 'any').split(' ').includes(purpose) && i.sizes === size,
  );
  return match ? abs(match.src) : undefined;
};

twa.name = web.name ?? twa.name;
twa.fullName = web.name ?? twa.fullName;
twa.launcherName = web.short_name ?? twa.launcherName;
twa.shortName = web.short_name ?? twa.shortName;
twa.display = web.display ?? twa.display;
twa.orientation = web.orientation ?? twa.orientation;
twa.startUrl = web.start_url ?? twa.startUrl;
twa.themeColor = web.theme_color ?? twa.themeColor;
twa.navigationColor = web.theme_color ?? twa.navigationColor;
twa.backgroundColor = web.background_color ?? twa.backgroundColor;
twa.iconUrl = pickIcon('any', '512x512') ?? twa.iconUrl;
twa.maskableIconUrl = pickIcon('maskable', '512x512') ?? twa.maskableIconUrl;

twa.shortcuts = (web.shortcuts ?? []).slice(0, 4).map((s) => ({
  name: s.name,
  shortName: s.short_name ?? s.name,
  url: s.url,
  icon: s.icons?.[0]?.src ? abs(s.icons[0].src) : abs('/icon-192.png'),
}));

const changed = JSON.stringify(twa) !== before;

if (check) {
  if (changed) {
    console.error('twa-manifest.json is out of sync with public/manifest.webmanifest.');
    console.error('Run: npm run twa:sync');
    process.exit(1);
  }
  console.log('twa-manifest.json is in sync.');
  process.exit(0);
}

if (changed && !noBump) {
  const code = Number.parseInt(twa.appVersion ?? '1', 10) || 1;
  twa.appVersion = String(code + 1);
  const [maj = '1', min = '0', patch = '0'] = String(twa.appVersionName ?? '1.0.0').split('.');
  twa.appVersionName = `${maj}.${min}.${Number.parseInt(patch, 10) + 1}`;
}

writeFileSync(TWA_MANIFEST, `${JSON.stringify(twa, null, 2)}\n`);
console.log(
  changed
    ? `Synced twa-manifest.json (versionCode ${twa.appVersion}, ${twa.appVersionName}).`
    : 'twa-manifest.json already in sync.',
);