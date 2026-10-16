import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const replyConfig = {
  reply_uuid: '00000000-0000-4000-8000-000000000001',
  transport: 'BICYCLE',
  home_house: 'selected-home',
};
const houses = [
  { selector: 'other-home', name: 'Other', latitude: 42, longitude: 15 },
  { selector: 'selected-home', name: 'Selected', latitude: 0, longitude: -73.5 },
];

// All tests inject the HTTP boundary: never contact a real FF-Agent reply link.
async function world(options, request = async () => new Response('', { status: 200 })) {
  const gladys = createFakeGladys({ config: replyConfig, houses, ...options });
  registerHandlers(gladys, request);
  await gladys.connect();
  return gladys;
}

async function content(gladys) {
  const ack = await gladys.fake.widgetGet('incident', {});
  assert.equal(ack.success, true);
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  return ack.data.content;
}

test('manifest declares a version-aligned provider without device or network permissions', () => {
  assert.equal(manifest.type, 'provider');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/stefanbauer/gladys-ff-agent:${pkg.version}`);
  assert.equal(manifest.location, true);
  assert.equal(manifest.config_schema.find((field) => field.key === 'reply_uuid').type, 'string');
  assert.equal(manifest.config_schema.find((field) => field.key === 'home_house').source, 'houses');
  for (const schema of [manifest.actions, manifest.scene_actions]) {
    for (const key of ['accept_incident', 'decline_incident']) {
      assert.deepEqual(schema.find((action) => action.key === key).fields || [], []);
    }
  }
  for (const capability of ['network_discovery', 'containers', 'webhooks']) {
    assert.equal(manifest[capability], undefined);
  }
});

test('reply settings read the selected Gladys house, accept zero coordinates, reject missing locations and keep the UUID private', async () => {
  const config = {
    reply_uuid: '00000000-0000-4000-8000-000000000001',
    transport: 'CAR',
    home_house: 'selected-home',
  };
  const gladys = await world({
    config,
    houses: [
      { id: 'other', selector: 'other', name: 'Other', latitude: null, longitude: null },
      {
        id: 'selected',
        selector: 'selected-home',
        name: 'Selected',
        latitude: 0,
        longitude: -73.5,
      },
    ],
  });
  for (const transport of ['CAR', 'BICYCLE', 'FEET']) {
    await gladys.fake.configUpdated({ ...config, transport });
    const ack = await gladys.fake.action('check_response_settings');
    assert.equal(ack.success, true);
    assert.match(ack.data.message.en, new RegExp(`Selected \\(${transport}\\)`));
    assert.equal(JSON.stringify(ack).includes(config.reply_uuid), false);
    assert.equal(JSON.stringify(ack).includes('-73.5'), false);
  }
  for (const invalid of [{ reply_uuid: '' }, { transport: 'UNKNOWN' }, { home_house: 'missing' }]) {
    await gladys.fake.configUpdated({ ...config, ...invalid });
    assert.equal((await gladys.fake.action('check_response_settings')).success, false);
  }
  await gladys.fake.configUpdated(config);
  gladys.fake.houses[1].latitude = null;
  assert.equal((await gladys.fake.action('check_response_settings')).success, false);
});

test('no incident means no response buttons; simulation publishes the declared event and actionable ID', async () => {
  const gladys = await world();
  assert.equal((await content(gladys)).components.filter((c) => c.type === 'button').length, 0);
  assert.equal((await gladys.fake.action('simulate_incident')).success, true);
  const event = gladys.fake.sceneEvents[0];
  assert.equal(event.key, 'incident_received');
  assert.equal(event.data.simulated, true);
  assert.equal(event.data.category, 'exercise');
  assert.match(event.data.incident_id, /^demo-/);
  assert.deepEqual(
    Object.keys(event.data).sort(),
    manifest.scene_triggers[0].variables.map((v) => v.key).sort(),
  );
  const buttons = (await content(gladys)).components.filter((c) => c.type === 'button');
  assert.deepEqual(
    buttons.map((b) => b.action.key),
    ['accept', 'decline'],
  );
  for (const button of buttons) {
    assert.equal(button.action.params.incident_id, event.data.incident_id);
    assert.equal(button.action.confirm, true);
  }
});

test('real scene and configuration replies need no incident ID or prior alarm', async () => {
  for (const decision of ['accept', 'decline']) {
    const gladys = await world();
    const ack = await gladys.fake.sceneAction(`${decision}_incident`);
    assert.equal(ack.success, true);
    assert.deepEqual(ack.data.outputs, {
      response: decision === 'accept' ? 'accepted' : 'declined',
      confirmed: false,
      http_status: 200,
    });
    assert.equal(gladys.fake.sceneEvents.length, 0);
    await gladys.fake.action('simulate_incident');
    assert.equal((await gladys.fake.action(`${decision}_incident`)).success, true);
    assert.equal(gladys.fake.sceneEvents.length, 1);
    assert.equal((await content(gladys)).components.filter((c) => c.type === 'button').length, 0);
  }
});

test('outdated widgets and unknown widget commands cannot send a response', async () => {
  const gladys = await world();
  await gladys.fake.action('simulate_incident');
  const staleId = gladys.fake.sceneEvents[0].data.incident_id;
  await gladys.fake.action('simulate_incident');
  const incident_id = gladys.fake.sceneEvents[1].data.incident_id;
  assert.equal(
    (await gladys.fake.widgetAction('incident', 'accept', { incident_id: staleId })).success,
    false,
  );
  assert.equal(
    (await gladys.fake.widgetAction('incident', 'unknown', { incident_id })).success,
    false,
  );
  assert.equal(
    (await gladys.fake.widgetAction('incident', 'decline', { incident_id })).success,
    true,
  );
  assert.equal(
    (await gladys.fake.widgetAction('incident', 'accept', { incident_id })).success,
    false,
  );
  const status = (await content(gladys)).components.find((c) => c.type === 'status');
  assert.equal(status.items[0].value.en, 'Rejection sent — unconfirmed');
});

test('acceptance uses the selected house and transport; rejection needs only the configured UUID', async () => {
  for (const transport of ['CAR', 'BICYCLE', 'FEET']) {
    const gladys = await world({ config: { ...replyConfig, transport } }, async (url, options) => {
      assert.equal(url.origin, 'https://www.ff-agent.com');
      assert.equal(
        url.pathname,
        '/app2/missionreplies/00000000-0000-4000-8000-000000000001/accept',
      );
      assert.deepEqual(Object.fromEntries(url.searchParams), { transport, lat: '0', lng: '-73.5' });
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 204 });
    });
    // Response bodies are irrelevant to our conservative HTTP-delivery result.
    assert.equal((await gladys.fake.action('accept_incident')).success, true);
  }
  const gladys = await world(
    { config: { reply_uuid: replyConfig.reply_uuid }, houses: [] },
    async (url) => {
      assert.equal(
        url.href,
        'https://www.ff-agent.com/app2/missionreplies/00000000-0000-4000-8000-000000000001/reject',
      );
      return new Response('', { status: 200 });
    },
  );
  assert.equal((await gladys.fake.action('decline_incident')).success, true);
});

test('HTTP errors, redirects and uncertain network outcomes never claim success or change the widget', async () => {
  for (const status of [302, 401, 500, null]) {
    let attempts = 0;
    const gladys = await world(undefined, async () => {
      attempts++;
      if (status === null) throw new Error(`Network failure with secret ${replyConfig.reply_uuid}`);
      return new Response(null, { status });
    });
    await gladys.fake.action('simulate_incident');
    const ack = await gladys.fake.action('accept_incident');
    assert.equal(ack.success, false);
    assert.equal(JSON.stringify(ack).includes(replyConfig.reply_uuid), false);
    assert.equal(attempts, 1);
    assert.equal(
      (await content(gladys)).components.find((c) => c.type === 'status').items[0].value.en,
      'Pending',
    );
  }
});

test('a reply completing after a new test alarm does not answer that new alarm', async () => {
  let complete;
  let requested;
  const started = new Promise((resolve) => {
    requested = resolve;
  });
  const gladys = await world(
    undefined,
    () =>
      new Promise((resolve) => {
        complete = resolve;
        requested();
      }),
  );
  await gladys.fake.action('simulate_incident');
  const reply = gladys.fake.action('accept_incident');
  await started;
  await gladys.fake.action('simulate_incident');
  complete(new Response('', { status: 200 }));
  assert.equal((await reply).success, true);
  assert.equal(
    (await content(gladys)).components.find((c) => c.type === 'status').items[0].value.en,
    'Pending',
  );
});

test('the observed no-active-incident HTTP 200 response is not an acceptance or rejection', async () => {
  for (const decision of ['accept', 'decline']) {
    const gladys = await world(
      undefined,
      async () =>
        new Response('Updated MissionStatus: kein passender Einsatz aktiv', { status: 200 }),
    );
    const scene = await gladys.fake.sceneAction(`${decision}_incident`);
    assert.equal(scene.success, true);
    assert.deepEqual(scene.data.outputs, {
      response: 'no_active_incident',
      confirmed: false,
      http_status: 200,
    });
    await gladys.fake.action('simulate_incident');
    const ack = await gladys.fake.action(`${decision}_incident`);
    assert.equal(ack.data.message.de, 'Kein passender Einsatz aktiv');
    assert.equal(
      (await content(gladys)).components.find((c) => c.type === 'status').items[0].value.de,
      'Kein passender Einsatz aktiv',
    );
  }
});
