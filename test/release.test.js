// -----------------------------------------------------------------------------
// Release helpers (.github/scripts/release.mjs). The release commit is pushed
// straight to the default branch, so what it writes must pass the same
// Prettier check as any pull request: these tests run the helpers on the
// repository's real manifest and changelog and format the result.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { bumpManifest, releaseNotes, rollChangelog } from '../.github/scripts/release.mjs';

const REPO = 'https://github.com/me/my-integration';
const manifestPath = fileURLToPath(
  new URL('../gladys-assistant-integration.json', import.meta.url),
);
const changelogPath = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));

async function assertPrettierClean(text, filepath) {
  const options = { ...(await prettier.resolveConfig(filepath)), filepath };
  assert.equal(await prettier.format(text, options), text, `${filepath} would fail format:check`);
}

test('bumpManifest only changes version and docker_image, keeping the layout', async () => {
  const text = await readFile(manifestPath, 'utf8');
  const bumped = bumpManifest(text, '9.8.7', 'ghcr.io/me/my-integration:9.8.7');

  const manifest = JSON.parse(bumped);
  assert.equal(manifest.version, '9.8.7');
  assert.equal(manifest.docker_image, 'ghcr.io/me/my-integration:9.8.7');

  const changedLines = bumped.split('\n').filter((line, i) => line !== text.split('\n')[i]);
  assert.equal(changedLines.length, 2);
  await assertPrettierClean(bumped, manifestPath);
});

test('bumpManifest leaves the image of a sub-container alone', () => {
  const text = `{
  "containers": [{ "name": "mqtt", "docker_image": "eclipse-mosquitto:2.0.20" }],
  "version": "1.0.0",
  "docker_image": "ghcr.io/me/my-integration:1.0.0"
}
`;
  const manifest = JSON.parse(bumpManifest(text, '1.1.0', 'ghcr.io/me/my-integration:1.1.0'));
  assert.equal(manifest.containers[0].docker_image, 'eclipse-mosquitto:2.0.20');
  assert.equal(manifest.docker_image, 'ghcr.io/me/my-integration:1.1.0');
});

test('bumpManifest points the sub-containers running its own image at the release', async () => {
  const text = `{
  "version": "1.0.0",
  "docker_image": "ghcr.io/me/my-integration:1.0.0",
  "containers": [
    { "name": "worker", "docker_image": "ghcr.io/me/my-integration:1.0.0" },
    { "name": "stale", "docker_image": "ghcr.io/me/my-integration:0.9.0" },
    { "name": "mqtt", "docker_image": "eclipse-mosquitto:2.0.20" },
    { "name": "lookalike", "docker_image": "ghcr.io/me/my-integration-db:1.0.0" }
  ]
}
`;
  const bumped = bumpManifest(text, '1.1.0', 'ghcr.io/me/my-integration:1.1.0');
  const images = JSON.parse(bumped).containers.map((container) => container.docker_image);
  assert.deepEqual(images, [
    'ghcr.io/me/my-integration:1.1.0',
    'ghcr.io/me/my-integration:1.1.0',
    'eclipse-mosquitto:2.0.20',
    'ghcr.io/me/my-integration-db:1.0.0',
  ]);
  await assertPrettierClean(bumped, manifestPath);
});

test('bumpManifest follows the image to a new name, and reads a registry port', () => {
  // A repository created from the template releases under its own name.
  const text = `{
  "version": "1.0.0",
  "docker_image": "localhost:5000/template:1.0.0",
  "containers": [{ "name": "worker", "docker_image": "localhost:5000/template:1.0.0" }]
}
`;
  const manifest = JSON.parse(bumpManifest(text, '1.0.1', 'ghcr.io/me/mine:1.0.1'));
  assert.equal(manifest.docker_image, 'ghcr.io/me/mine:1.0.1');
  assert.equal(manifest.containers[0].docker_image, 'ghcr.io/me/mine:1.0.1');
});

test('bumpManifest refuses a manifest without a top-level version', () => {
  assert.throws(() => bumpManifest('{\n  "name": "x"\n}\n', '1.0.0', 'img:1.0.0'), /"version"/);
});

test('rollChangelog keeps the real changelog Prettier-clean', async () => {
  const text = await readFile(changelogPath, 'utf8');
  const rolled = rollChangelog(text, '9.8.7', '2026-01-02', REPO);
  assert.notEqual(rolled, text, 'CHANGELOG.md needs a "## [Unreleased]" section');
  assert.equal(releaseNotes(rolled, '9.8.7'), releaseNotes(text, 'Unreleased'));
  assert.equal(releaseNotes(rolled, 'Unreleased'), '');
  // Only the sections moved: the text above them is untouched.
  const intro = (changelog) => changelog.slice(0, changelog.search(/^## /m));
  assert.equal(intro(rolled), intro(text));
  await assertPrettierClean(rolled, changelogPath);
});

test('rollChangelog moves Unreleased under the version, first release', () => {
  const text = `# Changelog

## [Unreleased]

### Added

- Thing.

[Unreleased]: https://github.com/template/repo/commits/main
`;
  assert.equal(
    rollChangelog(text, '1.0.1', '2026-01-02', REPO),
    `# Changelog

## [Unreleased]

## [1.0.1] - 2026-01-02

### Added

- Thing.

[Unreleased]: ${REPO}/compare/1.0.1...HEAD
[1.0.1]: ${REPO}/releases/tag/1.0.1
`,
  );
});

test('rollChangelog compares with the previous version, links or not', () => {
  const text = `# Changelog

## [Unreleased]

- Fix.

## [1.0.1] - 2026-01-02

- Thing.
`;
  assert.equal(
    rollChangelog(text, '1.0.2', '2026-02-03', REPO),
    `# Changelog

## [Unreleased]

## [1.0.2] - 2026-02-03

- Fix.

## [1.0.1] - 2026-01-02

- Thing.

[Unreleased]: ${REPO}/compare/1.0.2...HEAD
[1.0.2]: ${REPO}/compare/1.0.1...1.0.2
`,
  );
});

test('rollChangelog with an empty Unreleased section still names the version', () => {
  const rolled = rollChangelog('# Changelog\n\n## [Unreleased]\n', '1.0.1', '2026-01-02', REPO);
  assert.match(rolled, /## \[Unreleased\]\n\n## \[1\.0\.1\] - 2026-01-02\n\n\[Unreleased\]: /);
});

test('rollChangelog leaves a changelog without Unreleased section alone', () => {
  const text = '# Changelog\n\nAdd changes under `## [Unreleased]`.\n\n## [1.0.0] - 2026-01-01\n';
  assert.equal(rollChangelog(text, '1.0.1', '2026-01-02', REPO), text);
});

test('rollChangelog does not release the same version twice', () => {
  const text = '# Changelog\n\n## [Unreleased]\n\n## [1.0.1] - 2026-01-02\n\n- Thing.\n';
  assert.equal(rollChangelog(text, '1.0.1', '2026-01-03', REPO), text);
});

test('releaseNotes returns the section of a version', () => {
  const text = `# Changelog

## [Unreleased]

## [1.0.2] - 2026-02-03

### Fixed

- Fix.

## [1.0.1] - 2026-01-02

- Thing.

[Unreleased]: ${REPO}/compare/1.0.2...HEAD
`;
  assert.equal(releaseNotes(text, '1.0.2'), '### Fixed\n\n- Fix.');
  assert.equal(releaseNotes(text, '1.0.1'), '- Thing.');
  assert.equal(releaseNotes(text, '1.0.0'), '');
  assert.equal(releaseNotes(text, '1.0'), '');
});

test('release CLI prepares the initial version and checks all published version metadata', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'ff-agent-release-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const script = fileURLToPath(new URL('../.github/scripts/release.mjs', import.meta.url));
  const image = 'ghcr.io/me/my-integration:1.0.0';
  const files = {
    'package.json': JSON.stringify({ version: '1.0.0' }),
    'package-lock.json': JSON.stringify({
      version: '1.0.0',
      packages: { '': { version: '1.0.0' } },
    }),
    'gladys-assistant-integration.json': `{
  "version": "1.0.0",
  "docker_image": "${image}"
}
`,
    'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n- Initial functionality.\n',
  };
  for (const [file, text] of Object.entries(files)) await writeFile(join(cwd, file), text);
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  const prepared = run('prepare', '1.0.0', image, REPO);
  assert.equal(prepared.status, 0, prepared.stderr);
  const checked = run('check', '1.0.0', image);
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8')).version, '1.0.0');
  const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf8');
  assert.equal(releaseNotes(changelog, '1.0.0'), '- Initial functionality.');

  // Each mismatch is independently rejected, rather than merely failing because
  // another file is already inconsistent.
  const invalid = [
    ['package.json', JSON.stringify({ version: '1.0.1' })],
    [
      'package-lock.json',
      JSON.stringify({ version: '1.0.1', packages: { '': { version: '1.0.0' } } }),
    ],
    [
      'package-lock.json',
      JSON.stringify({ version: '1.0.0', packages: { '': { version: '1.0.1' } } }),
    ],
    [
      'gladys-assistant-integration.json',
      JSON.stringify({ version: '1.0.1', docker_image: image }),
    ],
    [
      'gladys-assistant-integration.json',
      JSON.stringify({ version: '1.0.0', docker_image: `${image}-wrong` }),
    ],
    ['CHANGELOG.md', files['CHANGELOG.md']],
    [
      'CHANGELOG.md',
      changelog.replace('## [Unreleased]', '## [Unreleased]\n\n- Not yet released.'),
    ],
  ];
  for (const [file, text] of invalid) {
    const original = await readFile(join(cwd, file), 'utf8');
    await writeFile(join(cwd, file), text);
    assert.notEqual(run('check', '1.0.0', image).status, 0, `Must reject inconsistent ${file}`);
    await writeFile(join(cwd, file), original);
  }
  assert.notEqual(run('check', '1.0.1', image).status, 0, 'Must reject the wrong tag version');
  assert.notEqual(run('check', '01.0.0', image).status, 0, 'Must reject non-semver versions');
});
