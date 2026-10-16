// Personal reply links supplied by the user. Never log these URLs or follow redirects.
export function getReplySettings(config, houses, decision) {
  const reply_uuid = (config.reply_uuid || '').trim();
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(reply_uuid)) {
    throw new Error('Configure a reply UUID. / Rückmelde-UUID konfigurieren.');
  }
  if (decision === 'declined') return { reply_uuid };
  const { transport = 'CAR', home_house } = config;
  if (!['CAR', 'BICYCLE', 'FEET'].includes(transport)) {
    throw new Error('Invalid transport. / Ungültige Anreiseart.');
  }
  const home = houses.find((house) => house.selector === home_house);
  if (!home) throw new Error('Select your Gladys home. / Zuhause in Gladys auswählen.');
  if (
    !Number.isFinite(home.latitude) ||
    Math.abs(home.latitude) > 90 ||
    !Number.isFinite(home.longitude) ||
    Math.abs(home.longitude) > 180
  ) {
    throw new Error('Set the house location in Gladys. / Hausstandort in Gladys hinterlegen.');
  }
  return {
    reply_uuid,
    transport,
    latitude: home.latitude,
    longitude: home.longitude,
    house_name: home.name,
  };
}

export async function sendReply(settings, decision, request = globalThis.fetch) {
  const path = decision === 'accepted' ? 'accept' : 'reject';
  const url = new URL(
    `https://www.ff-agent.com/app2/missionreplies/${settings.reply_uuid}/${path}`,
  );
  if (decision === 'accepted') {
    url.searchParams.set('transport', settings.transport);
    url.searchParams.set('lat', settings.latitude);
    url.searchParams.set('lng', settings.longitude);
  }
  let response;
  let body;
  try {
    response = await request(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    body = await response.text();
  } catch {
    // A timeout may happen after FF-Agent applied the response. Never retry automatically.
    throw new Error(
      'FF-Agent request not confirmed. Check FF-Agent before retrying. / FF-Agent-Anfrage nicht bestätigt. Vor erneutem Senden in FF-Agent prüfen.',
    );
  }
  if (!response.ok) {
    throw new Error(
      `FF-Agent HTTP ${response.status}: response not confirmed; check FF-Agent before retrying. / Rückmeldung nicht bestätigt; vor erneutem Senden in FF-Agent prüfen.`,
    );
  }
  if (body.trim() === 'Updated MissionStatus: kein passender Einsatz aktiv') {
    return { response: 'no_active_incident', confirmed: false, http_status: response.status };
  }
  // A 2xx only confirms HTTP delivery, not the person's actual mission response.
  return { response: decision, confirmed: false, http_status: response.status };
}
