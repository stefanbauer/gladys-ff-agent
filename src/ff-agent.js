import { logger } from '@gladysassistant/integration-sdk';

// Gladys forwards error.message to its localized action error display.
export function localizedError(message) {
  const error = new Error(message.en);
  error.message = message;
  return error;
}

// Personal reply links supplied by the user. Never log these URLs or follow redirects.
export function getReplySettings(config, houses, decision) {
  const reply_uuid = (config.reply_uuid || '').trim();
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(reply_uuid)) {
    throw localizedError({
      en: 'Configure a reply UUID.',
      fr: 'Configurez un UUID de réponse.',
      de: 'Rückmelde-UUID konfigurieren.',
    });
  }
  if (decision === 'declined') return { reply_uuid };
  const { transport = 'CAR', home_house } = config;
  if (!['CAR', 'BICYCLE', 'FEET'].includes(transport)) {
    throw localizedError({
      en: 'Invalid transport.',
      fr: 'Moyen de transport invalide.',
      de: 'Ungültige Anreiseart.',
    });
  }
  const home = houses.find((house) => house.selector === home_house);
  if (!home) {
    throw localizedError({
      en: 'Select your Gladys home.',
      fr: 'Sélectionnez votre maison dans Gladys.',
      de: 'Zuhause in Gladys auswählen.',
    });
  }
  if (
    !Number.isFinite(home.latitude) ||
    Math.abs(home.latitude) > 90 ||
    !Number.isFinite(home.longitude) ||
    Math.abs(home.longitude) > 180
  ) {
    throw localizedError({
      en: 'Set the house location in Gladys.',
      fr: 'Renseignez la position de la maison dans Gladys.',
      de: 'Hausstandort in Gladys hinterlegen.',
    });
  }
  return {
    reply_uuid,
    transport,
    latitude: home.latitude,
    longitude: home.longitude,
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
    logger.warn(`Reply ${decision}: network outcome unconfirmed; no automatic retry.`);
    throw localizedError({
      en: 'FF-Agent request not confirmed. Check FF-Agent before retrying.',
      fr: 'Requête FF-Agent non confirmée. Vérifiez FF-Agent avant de réessayer.',
      de: 'FF-Agent-Anfrage nicht bestätigt. Vor erneutem Senden in FF-Agent prüfen.',
    });
  }
  if (!response.ok) {
    logger.warn(`Reply ${decision}: HTTP ${response.status}; response not confirmed.`);
    if (
      response.status === 500 &&
      body.trim() === 'Cannot update status of Person. Internal Error - Check URL!'
    ) {
      throw localizedError({
        en: 'Check the reply UUID in the integration settings.',
        fr: 'Vérifiez l’UUID de réponse dans la configuration.',
        de: 'Bitte die Rückmelde-UUID in der Integrationskonfiguration prüfen.',
      });
    }
    throw localizedError({
      en: `FF-Agent HTTP ${response.status}: response not confirmed; check FF-Agent before retrying.`,
      fr: `FF-Agent HTTP ${response.status} : réponse non confirmée ; vérifiez FF-Agent avant de réessayer.`,
      de: `FF-Agent HTTP ${response.status}: Rückmeldung nicht bestätigt; vor erneutem Senden in FF-Agent prüfen.`,
    });
  }
  if (body.trim() === 'Updated MissionStatus: kein passender Einsatz aktiv') {
    logger.info(`Reply ${decision}: HTTP ${response.status}; no active incident.`);
    return { response: 'no_active_incident' };
  }
  // A 2xx only confirms HTTP delivery, not the person's actual mission response.
  logger.info(
    `Reply ${decision}: HTTP ${response.status}; delivered, operational response unconfirmed.`,
  );
  return { response: decision };
}
