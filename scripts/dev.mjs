import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

const IMAGE = 'gladys-ff-agent-dev:1.0.0';
const SESSION_FILE = 'data/dev-session.json';
const [command, selectorArgument] = process.argv.slice(2);

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const selector = selectorArgument || process.env.GLADYS_INTEGRATION_SELECTOR || 'ext-dev-ff-agent';
const host = new URL(process.env.GLADYS_HOST_API_URL || 'http://localhost:1443');
if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) {
  throw new Error('Dev registration only supports a loopback Gladys instance, never production.');
}
if (!/^ext-[a-z0-9-]+$/.test(selector)) throw new Error('Invalid integration selector');

function docker(args, inherit = false) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new Error('Docker command failed. Is Docker Desktop running?');
  }
  return result.stdout;
}

async function savePrivate(file, data) {
  await mkdir('data', { recursive: true });
  await writeFile(file, data, { mode: 0o600 });
  await chmod(file, 0o600);
}

async function request(route, body, accessToken) {
  const response = await fetch(new URL(route, host), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'gladys-ff-agent-local-development',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    throw new Error(
      `Local Gladys API returned HTTP ${response.status}. For authentication errors run npm run dev:login.`,
    );
  }
  return response.json();
}

async function prompt(label, hidden = false) {
  if (!process.stdin.isTTY)
    throw new Error('Run npm run dev:login once in an interactive Mac terminal.');
  const output = hidden
    ? new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      })
    : process.stdout;
  const input = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write(label);
  try {
    return await input.question('');
  } finally {
    input.close();
    if (hidden) process.stdout.write('\n');
  }
}

async function login() {
  console.log(`One-time admin login to ${host.origin}. Password is hidden and never stored.`);
  const email = await prompt('Local Gladys email: ');
  const password = await prompt('Local Gladys password: ', true);
  const session = await request('/api/v1/login', { email, password });
  if (session.role !== 'admin') throw new Error('A local Gladys admin account is required.');
  await savePrivate(
    SESSION_FILE,
    `${JSON.stringify({ origin: host.origin, refresh_token: session.refresh_token })}\n`,
  );
  console.log('Local development session saved with permissions 600. No password stored.');
  await sync();
}

async function devManifest() {
  const manifest = JSON.parse(await readFile('gladys-assistant-integration.json', 'utf8'));
  return { ...manifest, docker_image: IMAGE };
}

async function prepare(manifest) {
  manifest ||= await devManifest();
  // Gladys' supported dev-update path refreshes the manifest from this image label.
  docker(
    [
      'build',
      '-f',
      'Dockerfile.dev',
      '--label',
      `io.gladysassistant.manifest=${JSON.stringify(manifest)}`,
      '-t',
      IMAGE,
      '.',
    ],
    true,
  );
  await mkdir('data', { recursive: true });
  await writeFile('data/dev-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Development image and embedded manifest ready: ${IMAGE}`);
}

async function connect() {
  const [container] = JSON.parse(docker(['inspect', `gladys-${selector}`]));
  if (container.Config.Image !== IMAGE) {
    throw new Error('Refusing credentials from a non-development integration container.');
  }
  const environment = Object.fromEntries(
    container.Config.Env.map((entry) => {
      const separator = entry.indexOf('=');
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
  const token = environment.GLADYS_INTEGRATION_TOKEN;
  if (!token || environment.GLADYS_INTEGRATION_SELECTOR !== selector || /[\r\n]/.test(token)) {
    throw new Error('Container has no matching integration credentials');
  }
  const settings = {
    GLADYS_HOST_API_URL: host.origin,
    GLADYS_INTEGRATION_SELECTOR: selector,
    GLADYS_INTEGRATION_TOKEN: token,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  };
  await savePrivate(
    '.env',
    `${Object.entries(settings)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`,
  );
  Object.assign(process.env, settings);
  console.log('Development SDK credentials synchronized; token not printed.');
}

async function sync() {
  let session;
  try {
    session = JSON.parse(await readFile(SESSION_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error('One-time setup required: run npm run dev:login in your Mac terminal.', {
      cause: error,
    });
  }
  if (session.origin !== host.origin)
    throw new Error('Saved session belongs to another Gladys address. Run dev:login.');
  const { access_token } = await request('/api/v1/access_token', {
    refresh_token: session.refresh_token,
  });
  const integrations = await request('/api/v1/external_integration', undefined, access_token);
  const installed = integrations.find((integration) => integration.selector === selector);
  const manifest = await devManifest();
  if (installed && (installed.docker_image !== IMAGE || installed.store_slug)) {
    throw new Error('Refusing to update a non-development integration.');
  }
  if (!installed || JSON.stringify(installed.manifest) !== JSON.stringify(manifest)) {
    await prepare(manifest);
    const updated = installed
      ? await request(`/api/v1/external_integration/${selector}/update`, {}, access_token)
      : await request(
          '/api/v1/external_integration',
          { docker_image: IMAGE, manifest },
          access_token,
        );
    if (
      updated.selector !== selector ||
      JSON.stringify(updated.manifest) !== JSON.stringify(manifest)
    ) {
      throw new Error(
        'Registration differs from the requested dev manifest. Inspect Gladys before retrying.',
      );
    }
    console.log(
      `Updated ${selector} through Gladys. Existing settings and scene references are preserved.`,
    );
  } else {
    console.log('Development registration already current; no rebuild or update needed.');
  }
  await connect();
}

try {
  if (command === 'login') await login();
  else if (command === 'prepare') await prepare();
  else if (command === 'connect') await connect();
  else if (command === 'sync' || command === 'run') {
    await sync();
    if (command === 'run') await import('../index.js');
  } else
    throw new Error('Use npm start, npm run dev, dev:login, dev:sync, dev:prepare or dev:connect.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
