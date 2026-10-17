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

async function content(gladys, language = 'en') {
  const ack = await gladys.fake.widgetGet('incident', { language });
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
    const [transport] = schema.find((action) => action.key === 'accept_incident').fields;
    assert.equal(transport.key, 'transport');
    assert.equal(transport.type, 'select');
    assert.equal(transport.default, undefined);
    assert.notEqual(transport.required, true);
    assert.deepEqual(schema.find((action) => action.key === 'decline_incident').fields || [], []);
  }
  for (const action of manifest.scene_actions) {
    assert.deepEqual(
      action.outputs.map(({ key, type }) => ({ key, type })),
      [{ key: 'success', type: 'boolean' }],
    );
  }
  assert.deepEqual(
    manifest.webhooks.map(({ key, mode }) => ({ key, mode })),
    [{ key: 'incident', mode: 'fire_and_forget' }],
  );
  for (const capability of ['network_discovery', 'containers']) {
    assert.equal(manifest[capability], undefined);
  }
});

test('acceptance validates settings before sending, uses the selected house and keeps the UUID out of results', async () => {
  const config = {
    reply_uuid: '00000000-0000-4000-8000-000000000001',
    transport: 'CAR',
    home_house: 'selected-home',
  };
  let attempts = 0;
  const gladys = await world(
    {
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
    },
    async (url) => {
      attempts++;
      assert.deepEqual(Object.fromEntries(url.searchParams), {
        transport: ['CAR', 'BICYCLE', 'FEET'][attempts - 1],
        lat: '0',
        lng: '-73.5',
      });
      return new Response(null, { status: 200 });
    },
  );
  for (const transport of ['CAR', 'BICYCLE', 'FEET']) {
    await gladys.fake.configUpdated({ ...config, transport });
    const ack = await gladys.fake.action('accept_incident');
    assert.equal(ack.success, true);
    assert.equal(JSON.stringify(ack).includes(config.reply_uuid), false);
    assert.equal(JSON.stringify(ack).includes('-73.5'), false);
  }
  assert.equal(attempts, 3);
  for (const invalid of [{ reply_uuid: '' }, { transport: 'UNKNOWN' }, { home_house: 'missing' }]) {
    await gladys.fake.configUpdated({ ...config, ...invalid });
    assert.equal((await gladys.fake.action('accept_incident')).success, false);
  }
  await gladys.fake.configUpdated(config);
  gladys.fake.houses[1].latitude = null;
  assert.equal((await gladys.fake.action('accept_incident')).success, false);
  assert.equal(attempts, 3);
});

test('simulation publishes only the locally generated reception time, without filters or incident details', async (t) => {
  const now = new Date('2026-10-16T13:24:35.678Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  const gladys = await world();
  assert.equal((await content(gladys)).components.filter((c) => c.type === 'button').length, 0);
  assert.equal((await gladys.fake.action('simulate_incident')).success, true);
  const event = gladys.fake.sceneEvents[0];
  assert.equal(event.key, 'incident_received');
  assert.deepEqual(event.data, { received_at: '2026-10-16T13:24:35.678Z' });
  assert.deepEqual(manifest.scene_triggers[0].fields || [], []);
  assert.deepEqual(
    manifest.scene_triggers[0].variables.map((v) => v.key),
    ['received_at'],
  );
  const widget = await content(gladys);
  const text = widget.components.find((c) => c.variant === 'body').text;
  for (const language of ['en', 'fr', 'de']) {
    assert.ok(text[language]);
    assert.equal(text[language].includes('demo-'), false);
  }
  assert.ok(widget.components.find((c) => c.type === 'status').items[0].value.includes('13:24'));
  assert.equal(widget.components.find((c) => c.type === 'value').value.en, 'TEST ALARM');
  const buttons = widget.components.filter((c) => c.type === 'button');
  assert.deepEqual(
    buttons.map((b) => b.action.key),
    ['accept', 'decline'],
  );
  for (const button of buttons) {
    assert.equal(button.action.confirm, true);
  }
});

test('real scene and configuration replies need no incident ID or prior alarm', async () => {
  for (const decision of ['accept', 'decline']) {
    const gladys = await world();
    const ack = await gladys.fake.sceneAction(`${decision}_incident`);
    assert.equal(ack.success, true);
    assert.deepEqual(ack.data.outputs, { success: true });
    assert.equal(gladys.fake.sceneEvents.length, 0);
    await gladys.fake.action('simulate_incident');
    assert.equal((await gladys.fake.action(`${decision}_incident`)).success, true);
    assert.equal(gladys.fake.sceneEvents.length, 1);
    assert.deepEqual(
      (await content(gladys)).components
        .filter((c) => c.type === 'button')
        .map((c) => c.action.key),
      decision === 'accept' ? ['finish'] : [],
    );
  }
});

test('POST webhooks publish only local reception time and show a real alarm; other methods do not trigger', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-16T17:18:19.123Z') });
  const gladys = await world({ config: {} }, () => assert.fail('Reception must not send replies'));
  for (const method of ['GET', 'PUT']) {
    await gladys.fake.webhook('incident', { method });
  }
  assert.equal(gladys.fake.sceneEvents.length, 0);
  for (const body of [
    '{}',
    '{"title":"PRIVATE","received_at":"1999-01-01","incident_id":"PRIVATE"}',
  ]) {
    await gladys.fake.webhook('incident', {
      method: 'POST',
      query: {},
      body,
      contentType: 'application/json',
    });
  }
  assert.equal(gladys.fake.sceneEvents.length, 2);
  for (const event of gladys.fake.sceneEvents) {
    assert.equal(event.key, 'incident_received');
    assert.deepEqual(event.data, { received_at: '2026-10-16T17:18:19.123Z' });
  }
  const widget = await content(gladys);
  assert.equal(JSON.stringify(widget).includes('PRIVATE'), false);
  assert.equal(widget.components.find((c) => c.type === 'value').value.de, 'ALARM');
  assert.ok(widget.components.find((c) => c.type === 'status').items[0].value.includes('17:18'));
  assert.equal(widget.components.filter((c) => c.type === 'button').length, 2);
});

test('outdated widgets and unknown widget commands cannot send a response', async () => {
  const gladys = await world();
  await gladys.fake.action('simulate_incident');
  const staleParams = (await content(gladys)).components.find((c) => c.type === 'button').action
    .params;
  await gladys.fake.action('simulate_incident');
  const params = (await content(gladys)).components.find((c) => c.type === 'button').action.params;
  assert.equal((await gladys.fake.widgetAction('incident', 'accept', staleParams)).success, false);
  assert.equal((await gladys.fake.widgetAction('incident', 'unknown', params)).success, false);
  assert.equal((await gladys.fake.widgetAction('incident', 'decline', params)).success, true);
  assert.equal((await gladys.fake.widgetAction('incident', 'accept', params)).success, false);
  const status = (await content(gladys)).components.find((c) => c.type === 'status');
  assert.equal(status.items[0].value.en, 'Rejection sent');
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
    assert.equal(ack.error.en.includes('Check the reply UUID'), false);
    assert.equal(attempts, 1);
    assert.equal(
      (await content(gladys)).components.find((c) => c.type === 'value').value.en,
      'TEST ALARM',
    );
  }
});

test('the observed FF-Agent URL error suggests checking the UUID without exposing technical provider text', async () => {
  for (const decision of ['accept', 'decline']) {
    const gladys = await world(
      undefined,
      async () =>
        new Response('Cannot update status of Person. Internal Error - Check URL!\n', {
          status: 500,
        }),
    );
    const ack = await gladys.fake.action(`${decision}_incident`);
    assert.equal(ack.success, false);
    assert.deepEqual(ack.error, {
      en: 'Check the reply UUID in the integration settings.',
      fr: 'Vérifiez l’UUID de réponse dans la configuration.',
      de: 'Bitte die Rückmelde-UUID in der Integrationskonfiguration prüfen.',
    });
    for (const technical of ['Person', 'Internal Error', replyConfig.reply_uuid]) {
      assert.equal(JSON.stringify(ack.error).includes(technical), false);
    }
    const scene = await gladys.fake.sceneAction(`${decision}_incident`);
    assert.deepEqual(scene.data.outputs, { success: false });
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
    (await content(gladys)).components.find((c) => c.type === 'value').value.en,
    'TEST ALARM',
  );
});

test('widget acceptance remains until locally ended, preserving history without another HTTP request', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-17T09:41:00Z') });
  let requests = 0;
  const gladys = await world(undefined, async () => {
    requests++;
    return new Response('', { status: 200 });
  });
  assert.equal((await content(gladys)).components[0].value.en, 'No alarm');
  await gladys.fake.webhook('incident', { method: 'POST', body: '{}' });
  t.mock.timers.tick(120000);
  const params = (await content(gladys)).components.find((c) => c.type === 'button').action.params;
  assert.equal((await gladys.fake.widgetAction('incident', 'accept', params)).success, true);
  let widget = await content(gladys);
  assert.equal(widget.components[0].value.en, 'Sent');
  const finish = widget.components.find((c) => c.type === 'button');
  assert.equal(finish.action.key, 'finish');
  for (const language of ['en', 'fr', 'de']) {
    assert.ok(finish.label[language]);
    assert.ok(widget.components.find((c) => c.type === 'status').items[1].label[language]);
  }
  t.mock.timers.tick(3600000);
  widget = await content(gladys);
  assert.equal(widget.components[0].value.en, 'Sent');
  assert.equal(
    (await gladys.fake.widgetAction('incident', 'finish', finish.action.params)).success,
    true,
  );
  widget = await content(gladys);
  assert.equal(widget.components[0].value.en, 'No alarm');
  assert.equal(widget.components.filter((c) => c.type === 'button').length, 0);
  assert.equal(
    (await gladys.fake.widgetAction('incident', 'finish', finish.action.params)).success,
    false,
  );
  const history = widget.components.find((c) => c.type === 'status').items;
  assert.equal(history[0].value.en, 'Acceptance sent');
  assert.ok(history[1].value.includes('09:43'));
  assert.equal(requests, 1);
  await gladys.fake.webhook('incident', { method: 'POST', body: '{}' });
  widget = await content(gladys);
  assert.equal(widget.components[0].value.en, 'ALARM');
  assert.equal(
    (await gladys.fake.widgetAction('incident', 'finish', finish.action.params)).success,
    false,
  );
  assert.equal(widget.components.filter((c) => c.type === 'button').length, 2);
  assert.ok(
    widget.components
      .find((c) => c.type === 'status')
      .items.some((i) => i.value.en === 'Acceptance sent'),
  );
});

test('declining immediately returns idle and records the reply in all widget languages', async () => {
  const gladys = await world();
  await gladys.fake.action('simulate_incident');
  const params = (await content(gladys)).components.find((c) => c.type === 'button').action.params;
  await gladys.fake.widgetAction('incident', 'decline', params);
  for (const language of ['en', 'fr', 'de']) {
    const widget = await content(gladys, language);
    assert.equal(widget.components[0].value.en, 'No alarm');
    assert.equal(widget.components.filter((c) => c.type === 'button').length, 0);
    const history = widget.components.find((c) => c.type === 'status').items;
    assert.ok(history[0].label[language]);
    assert.ok(history[0].value[language]);
    assert.equal(history[0].value.en, 'Rejection sent');
  }
});

test('a new alarm interrupts the acceptance display and concurrent reply clicks send only once', async () => {
  let complete;
  let requested;
  const started = new Promise((resolve) => {
    requested = resolve;
  });
  let requests = 0;
  const gladys = await world(undefined, async () => {
    requests++;
    if (requests > 1) return new Response('', { status: 200 });
    return new Promise((resolve) => {
      complete = resolve;
      requested();
    });
  });
  await gladys.fake.action('simulate_incident');
  const params = (await content(gladys)).components.find((c) => c.type === 'button').action.params;
  const first = gladys.fake.widgetAction('incident', 'accept', params);
  await started;
  assert.equal((await gladys.fake.widgetAction('incident', 'decline', params)).success, false);
  assert.equal(requests, 1);
  complete(new Response('', { status: 200 }));
  assert.equal((await first).success, true);
  assert.equal((await content(gladys)).components[0].value.en, 'Sent');
  const finishParams = (await content(gladys)).components.find((c) => c.type === 'button').action
    .params;
  await gladys.fake.webhook('incident', { method: 'POST', body: '{}' });
  const widget = await content(gladys);
  assert.equal(widget.components[0].value.en, 'ALARM');
  assert.equal((await gladys.fake.widgetAction('incident', 'finish', finishParams)).success, false);
  assert.equal((await gladys.fake.widgetAction('incident', 'decline', params)).success, false);
  const freshParams = widget.components.find((c) => c.type === 'button').action.params;
  assert.equal((await gladys.fake.widgetAction('incident', 'decline', freshParams)).success, true);
  assert.equal(requests, 2);
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
    assert.deepEqual(scene.data.outputs, { success: true });
    await gladys.fake.action('simulate_incident');
    const ack = await gladys.fake.action(`${decision}_incident`);
    const expected = {
      en: 'HTTP 200 OK — no active incident',
      fr: 'HTTP 200 OK — aucune intervention active',
      de: 'HTTP 200 OK — aktuell kein Einsatz aktiv',
    };
    assert.equal(ack.success, true);
    assert.deepEqual(ack.data.message, expected);
    const status = (await content(gladys)).components.find((c) => c.type === 'status');
    assert.equal(status.items[0].value.en, 'No active incident');
    assert.equal((await content(gladys)).components[0].value.en, 'No alarm');
  }
});

test('scene replies return only a success boolean for HTTP success, failure and invalid settings', async () => {
  for (const decision of ['accept', 'decline']) {
    for (const status of [200, 204, 302, 403, 500, null]) {
      let attempts = 0;
      const gladys = await world(undefined, async () => {
        attempts++;
        if (status === null) throw new DOMException('Timeout', 'TimeoutError');
        return new Response(null, { status });
      });
      const ack = await gladys.fake.sceneAction(`${decision}_incident`);
      assert.equal(ack.success, true);
      assert.deepEqual(ack.data.outputs, { success: status === 200 || status === 204 });
      assert.equal(attempts, 1);
    }
    const gladys = await world({ config: {} }, () => assert.fail('Invalid settings must not send'));
    const ack = await gladys.fake.sceneAction(`${decision}_incident`);
    assert.deepEqual(ack.data.outputs, { success: false });
  }
});

test('acceptance transport can be overridden per action, with empty values using the unchanged configured default', async () => {
  for (const source of ['action', 'sceneAction']) {
    const sent = [];
    const gladys = await world(undefined, async (url) => {
      sent.push(url.searchParams.get('transport'));
      return new Response(null, { status: 204 });
    });
    for (const fields of [{ transport: 'CAR' }, { transport: 'FEET' }, { transport: '' }, {}]) {
      const ack = await gladys.fake[source]('accept_incident', fields);
      assert.equal(ack.success, true);
      if (source === 'sceneAction') assert.deepEqual(ack.data.outputs, { success: true });
    }
    assert.deepEqual(sent, ['CAR', 'FEET', 'BICYCLE', 'BICYCLE']);
    assert.equal(gladys.config.transport, 'BICYCLE');
    const invalid = await gladys.fake[source]('accept_incident', { transport: 'UNKNOWN' });
    if (source === 'sceneAction') assert.deepEqual(invalid.data.outputs, { success: false });
    else assert.equal(invalid.success, false);
    assert.equal(sent.length, 4);
  }
});

test('diagnostic logs describe alarm and reply outcomes without exposing private data', async (t) => {
  const lines = [];
  for (const stream of ['log', 'warn', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.join(' ')));
  }
  let outcome = 200;
  const gladys = await world(undefined, async () => {
    if (outcome === null) throw new Error(`PRIVATE_NETWORK ${replyConfig.reply_uuid}`);
    return new Response(
      outcome === 200 ? 'Updated MissionStatus: kein passender Einsatz aktiv' : 'PRIVATE_PROVIDER',
      { status: outcome },
    );
  });
  await gladys.fake.webhook('incident', {
    method: 'POST',
    query: { api_key: 'PRIVATE_KEY' },
    body: '{"title":"PRIVATE_INCIDENT"}',
    contentType: 'application/json',
  });
  await gladys.fake.action('simulate_incident');
  await gladys.fake.action('accept_incident');
  outcome = 201;
  await gladys.fake.action('decline_incident');
  outcome = 503;
  await gladys.fake.action('decline_incident');
  outcome = null;
  await gladys.fake.action('accept_incident');
  await gladys.fake.configUpdated({});
  await gladys.fake.action('accept_incident');
  const output = lines.join('\n');
  for (const diagnostic of [
    'Alarm webhook',
    'Test alarm',
    'HTTP 200',
    'no active incident',
    'HTTP 201',
    'HTTP 503',
    'network outcome unconfirmed',
    'not sent',
  ]) {
    assert.ok(output.includes(diagnostic), `Missing diagnostic: ${diagnostic}`);
  }
  for (const privateValue of [
    'PRIVATE_',
    replyConfig.reply_uuid,
    '-73.5',
    'missionreplies/',
    'api_key',
  ]) {
    assert.equal(output.includes(privateValue), false, `Leaked data: ${privateValue}`);
  }
});
