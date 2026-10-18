import { randomUUID } from 'node:crypto';
import { logger } from '@gladysassistant/integration-sdk';
import { getReplySettings, localizedError, sendReply } from './ff-agent.js';

const HISTORY_LABELS = {
  accepted: { en: 'Acceptance sent', fr: 'Acceptation envoyée', de: 'Zusage gesendet' },
  declined: { en: 'Rejection sent', fr: 'Refus envoyé', de: 'Absage gesendet' },
};
const RESPONSE_LABELS = {
  no_active_incident: {
    en: 'HTTP 200 OK — no active incident',
    fr: 'HTTP 200 OK — aucune intervention active',
    de: 'HTTP 200 OK — aktuell kein Einsatz aktiv',
  },
  accepted: {
    en: 'Acceptance sent — unconfirmed',
    fr: 'Acceptation envoyée — non confirmée',
    de: 'Zusage gesendet — unbestätigt',
  },
  declined: {
    en: 'Rejection sent — unconfirmed',
    fr: 'Refus envoyé — non confirmé',
    de: 'Absage gesendet — unbestätigt',
  },
};

// Only the latest alarm and reply are kept in memory; never webhook payloads.
export function registerHandlers(gladys, request = globalThis.fetch) {
  let incident = null;
  let lastReply = null;
  let replying = false;

  async function receiveIncident(test = false) {
    incident = {
      // Local widget revision only, never FF-Agent data or a scene variable.
      incident_id: randomUUID(),
      received_at: new Date().toISOString(),
      test,
      response: 'pending',
    };
    logger.info(`${test ? 'Test alarm' : 'Alarm webhook'} received; payload not logged or stored.`);
    try {
      await gladys.publishSceneEvent('incident_received', { received_at: incident.received_at });
      logger.info('Alarm event published to Gladys.');
    } catch (error) {
      logger.error('Could not publish alarm event to Gladys.');
      throw error;
    }
    gladys.requestWidgetRefresh('incident');
  }

  gladys.onWebhook('incident', async ({ method }) => {
    // A webhook is an alarm signal, not a source of incident details.
    if (method !== 'POST') {
      logger.warn('Ignored alarm webhook: POST required.');
      return;
    }
    await receiveIncident();
  });

  async function simulateIncident() {
    await receiveIncident(true);
    return {
      en: 'Test alarm sent to Gladys. Only the locally generated reception time is passed on.',
      fr: 'Alerte de test envoyée à Gladys. Seule l’heure de réception générée localement est transmise.',
      de: 'Testalarm an Gladys gesendet. Nur der lokal erzeugte Empfangszeitpunkt wird weitergegeben.',
    };
  }

  async function respond(decision, { transport } = {}) {
    if (replying) {
      throw localizedError({
        en: 'A reply is already being sent. Please wait and check FF-Agent before retrying.',
        fr: 'Une réponse est déjà en cours. Patientez et vérifiez FF-Agent avant de réessayer.',
        de: 'Eine Rückmeldung wird bereits gesendet. Bitte warten und vor erneutem Senden FF-Agent prüfen.',
      });
    }
    replying = true;
    const currentIncident = incident;
    try {
      let settings;
      try {
        const houses = decision === 'accepted' ? await gladys.getHouses() : [];
        settings = getReplySettings(
          { ...gladys.config, transport: transport || gladys.config.transport },
          houses,
          decision,
        );
      } catch (error) {
        logger.warn(
          `Reply ${decision} not sent: check reply settings and Gladys house availability.`,
        );
        throw error;
      }
      logger.info(`Sending ${decision} reply to FF-Agent.`);
      const result = await sendReply(settings, decision, request);
      const repliedAt = Date.now();
      lastReply = {
        decision,
        response: result.response,
        replied_at: repliedAt,
        test: currentIncident?.test || false,
      };
      // Do not attach an in-flight reply to a different alarm received meanwhile.
      if (currentIncident) {
        currentIncident.response = result.response;
      }
      gladys.requestWidgetRefresh('incident');
      return result;
    } finally {
      replying = false;
    }
  }

  gladys.onAction('simulate_incident', simulateIncident);
  for (const [key, decision] of Object.entries({
    accept_incident: 'accepted',
    decline_incident: 'declined',
  })) {
    gladys.onSceneAction(key, async (fields) => {
      try {
        await respond(decision, fields);
        return { success: true };
      } catch {
        // A timeout is not confirmation that FF-Agent did not process the request.
        return { success: false };
      }
    });
    gladys.onAction(key, async (fields) => {
      const result = await respond(decision, fields);
      return RESPONSE_LABELS[result.response];
    });
  }

  gladys.onWidgetGet('incident', () => {
    const pending = incident?.response === 'pending';
    const accepted = incident?.response === 'accepted';
    const items = [];
    const dates = [];
    if (pending || accepted) {
      dates.push({
        title: { en: 'Received', fr: 'Reçue le', de: 'Empfangen' },
        // An explicit offset keeps midnight an instant, not a calendar-only date in Gladys.
        date: incident.received_at.replace('Z', '+00:00'),
      });
    }
    if (lastReply) {
      if (!accepted) {
        items.push({
          label: pending
            ? lastReply.test
              ? { en: 'Previous test', fr: 'Test précédent', de: 'Zuvor (Test)' }
              : { en: 'Previous reply', fr: 'Réponse avant', de: 'Zuvor' }
            : lastReply.test
              ? { en: 'Last test reply', fr: 'Dernier test', de: 'Letzter Test' }
              : { en: 'Last reply', fr: 'Dernière réponse', de: 'Letzte Antwort' },
          value: HISTORY_LABELS[lastReply.decision],
          icon: lastReply.decision === 'accepted' ? 'check' : 'x',
          color: 'success',
        });
      }
      dates.push({
        title: { en: 'Replied at', fr: 'Réponse à', de: 'Rückmeldung um' },
        date: new Date(lastReply.replied_at).toISOString().replace('Z', '+00:00'),
      });
    }
    return {
      ttl_seconds: 10,
      components: [
        {
          type: 'value',
          value: pending
            ? incident.test
              ? { en: 'TEST ALARM', fr: 'TEST', de: 'TESTALARM' }
              : { en: 'ALARM', fr: 'ALERTE', de: 'ALARM' }
            : accepted
              ? { en: 'Sent', fr: 'Envoyée', de: 'Gesendet' }
              : { en: 'No alarm', fr: 'En veille', de: 'Kein Alarm' },
          label: pending
            ? { en: 'Reply needed', fr: 'Réponse attendue', de: 'Rückmeldung offen' }
            : accepted
              ? {
                  en: 'Acceptance to FF-Agent',
                  fr: 'Acceptation à FF-Agent',
                  de: 'Zusage an FF-Agent',
                }
              : {
                  en: 'No pending alarm',
                  fr: 'Aucune alerte en attente',
                  de: 'Kein offener Alarm',
                },
          icon: pending ? 'bell' : accepted ? 'check-circle' : 'bell-off',
          color: pending ? 'danger' : accepted ? 'success' : 'neutral',
        },
        ...(pending || !lastReply || lastReply.response === 'no_active_incident'
          ? [
              {
                type: 'text',
                variant: 'body',
                text: pending
                  ? incident.test
                    ? {
                        en: 'Test alarm. Accept or decline — both buttons send REAL replies to FF-Agent.',
                        fr: 'Alerte de test. Accepter ou refuser envoie une VRAIE réponse à FF-Agent.',
                        de: 'Testalarm. Zu- oder absagen — beide Buttons senden ECHTE Rückmeldungen an FF-Agent.',
                      }
                    : {
                        en: 'Please accept or decline. Your reply is sent directly to FF-Agent.',
                        fr: 'Acceptez ou refusez. Votre réponse est envoyée directement à FF-Agent.',
                        de: 'Bitte zu- oder absagen. Deine Rückmeldung geht direkt an FF-Agent.',
                      }
                  : lastReply
                    ? {
                        en: 'FF-Agent reports no active incident.',
                        fr: 'FF-Agent indique qu’aucune intervention n’est active.',
                        de: 'FF-Agent meldet aktuell keinen aktiven Einsatz.',
                      }
                    : {
                        en: 'Incoming alarms appear here. No alarm received in this session yet.',
                        fr: 'Les alertes reçues apparaissent ici. Aucune alerte reçue dans cette session.',
                        de: 'Eingehende Alarmierungen erscheinen hier. In dieser Sitzung noch keinen Alarm empfangen.',
                      },
              },
            ]
          : []),
        ...(dates.length ? [{ type: 'card-list', items: dates }] : []),
        ...(items.length ? [{ type: 'status', items }] : []),
        ...(accepted
          ? [
              {
                type: 'button',
                label: { en: 'End incident', fr: 'Terminer l’intervention', de: 'Einsatz beenden' },
                icon: 'check-circle',
                action: { key: 'finish', params: { incident_id: incident.incident_id } },
              },
              {
                type: 'text',
                variant: 'caption',
                text: {
                  en: 'Ending only resets this display.',
                  fr: 'Clôture locale, sans envoi à FF-Agent.',
                  de: 'Beenden setzt nur die Anzeige zurück.',
                },
              },
            ]
          : []),
        ...(pending
          ? [
              {
                type: 'button',
                label: { en: 'Accept', fr: 'Accepter', de: 'Zusagen' },
                icon: 'check',
                style: 'primary',
                action: {
                  key: 'accept',
                  params: { incident_id: incident.incident_id },
                },
              },
              {
                type: 'button',
                label: { en: 'Decline', fr: 'Refuser', de: 'Absagen' },
                icon: 'x',
                style: 'primary',
                action: {
                  key: 'decline',
                  params: { incident_id: incident.incident_id },
                },
              },
            ]
          : []),
      ],
    };
  });

  gladys.onWidgetAction('incident', async (key, { incident_id }) => {
    if (key === 'finish') {
      if (!incident || incident_id !== incident.incident_id || incident.response !== 'accepted') {
        throw localizedError({
          en: 'This acceptance is no longer current. Refresh the widget.',
          fr: 'Cette acceptation n’est plus actuelle. Actualisez le widget.',
          de: 'Diese Zusage ist nicht mehr aktuell. Bitte das Widget aktualisieren.',
        });
      }
      incident = null;
      gladys.requestWidgetRefresh('incident');
      return {
        en: 'Display reset. No reply sent to FF-Agent.',
        fr: 'Affichage réinitialisé. Aucune réponse envoyée à FF-Agent.',
        de: 'Anzeige zurückgesetzt. Keine Rückmeldung an FF-Agent gesendet.',
      };
    }
    const decision = { accept: 'accepted', decline: 'declined' }[key];
    if (!decision) throw new Error('Unknown incident action');
    if (!incident || incident_id !== incident.incident_id || incident.response !== 'pending') {
      throw localizedError({
        en: 'This alarm is no longer open. Refresh the widget.',
        fr: 'Cette alerte n’est plus en attente. Actualisez le widget.',
        de: 'Dieser Alarm ist nicht mehr offen. Bitte das Widget aktualisieren.',
      });
    }
    const result = await respond(decision);
    return RESPONSE_LABELS[result.response];
  });

  gladys.on('connected', () => {
    gladys.requestWidgetRefresh('incident');
    gladys
      .setConnectionStatus(true, {
        en: 'Integration connected. Acceptances and rejections are sent directly to FF-Agent.',
        fr: 'Intégration connectée. Les acceptations et les refus sont envoyés directement à FF-Agent.',
        de: 'Integration verbunden. Zu- und Absagen werden direkt an FF-Agent gesendet.',
      })
      .catch((error) => {
        logger.error('Cannot report response action status to Gladys', error);
      });
  });
}
