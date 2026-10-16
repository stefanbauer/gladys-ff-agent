import { randomUUID } from 'node:crypto';
import { logger } from '@gladysassistant/integration-sdk';
import { getReplySettings, sendReply } from './ff-agent.js';

const REAL_RESPONSES = {
  en: 'Real FF-Agent requests, even for test alarms. Verify responses in FF-Agent.',
  fr: 'Envois réels, même pour les tests. Vérifiez la réponse dans FF-Agent.',
  de: 'Echte FF-Agent-Anfragen, auch beim Testalarm. Rückmeldung in FF-Agent prüfen.',
};
const RESPONSE_LABELS = {
  pending: { en: 'Pending', fr: 'En attente', de: 'Offen' },
  no_active_incident: {
    en: 'No matching active incident',
    fr: 'Aucune intervention active',
    de: 'Kein passender Einsatz aktiv',
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

// Alarm reception is not implemented yet; the test alarm remains in memory.
export function registerHandlers(gladys, request = globalThis.fetch) {
  let incident = null;

  async function simulateIncident() {
    incident = {
      incident_id: `demo-${randomUUID()}`,
      title: 'DEMO: Technical assistance',
      category: 'exercise',
      location: 'Example fire station',
      received_at: new Date().toISOString(),
      simulated: true,
      response: 'pending',
    };
    const { response: _response, ...event } = incident;
    await gladys.publishSceneEvent('incident_received', event);
    gladys.requestWidgetRefresh('incident');
    return {
      en: `Demo incident ${event.incident_id} sent to Gladys.`,
      fr: `Intervention fictive ${event.incident_id} envoyée à Gladys.`,
      de: `Übungseinsatz ${event.incident_id} an Gladys gesendet.`,
    };
  }

  async function respond(decision) {
    const currentIncident = incident;
    const houses = decision === 'accepted' ? await gladys.getHouses() : [];
    const settings = getReplySettings(gladys.config, houses, decision);
    const result = await sendReply(settings, decision, request);
    // Do not attach an in-flight reply to a different alarm received meanwhile.
    if (currentIncident) currentIncident.response = result.response;
    gladys.requestWidgetRefresh('incident');
    return result;
  }

  gladys.onAction('check_response_settings', async () => {
    const houses = await gladys.getHouses();
    const { house_name, transport } = getReplySettings(gladys.config, houses, 'accepted');
    return {
      en: `Settings and coordinates for ${house_name} (${transport}) available. No FF-Agent request sent; this is not a connection test.`,
      fr: `Configuration et coordonnées de ${house_name} (${transport}) disponibles. Aucun envoi à FF-Agent ; ce n'est pas un test de connexion.`,
      de: `Einstellungen und Koordinaten für ${house_name} (${transport}) verfügbar. Kein FF-Agent-Aufruf; dies ist kein Verbindungstest.`,
    };
  });

  gladys.onAction('simulate_incident', simulateIncident);
  for (const [key, decision] of Object.entries({
    accept_incident: 'accepted',
    decline_incident: 'declined',
  })) {
    gladys.onSceneAction(key, () => respond(decision));
    gladys.onAction(key, async () => {
      const result = await respond(decision);
      return RESPONSE_LABELS[result.response];
    });
  }

  gladys.onWidgetGet('incident', () => ({
    ttl_seconds: 10,
    components: [
      { type: 'text', variant: 'caption', text: REAL_RESPONSES },
      {
        type: 'text',
        variant: 'body',
        text: incident
          ? `${incident.title}\n${incident.location}\nID: ${incident.incident_id}`
          : {
              en: 'No demo incident. Use “Simulate incident” in the integration configuration.',
              fr: 'Aucune intervention fictive. Utilisez « Simuler » dans la configuration.',
              de: 'Kein Übungseinsatz. In der Integrationskonfiguration „Einsatz simulieren“ wählen.',
            },
      },
      ...(incident
        ? [
            {
              type: 'status',
              items: [
                {
                  label: { en: 'Response', fr: 'Réponse', de: 'Rückmeldung' },
                  value: RESPONSE_LABELS[incident.response],
                  color: 'warning',
                },
              ],
            },
            ...(incident.response === 'pending'
              ? [
                  {
                    type: 'button',
                    label: { en: 'Accept', fr: 'Accepter', de: 'Zusagen' },
                    style: 'primary',
                    action: {
                      key: 'accept',
                      params: { incident_id: incident.incident_id },
                      confirm: true,
                    },
                  },
                  {
                    type: 'button',
                    label: { en: 'Decline', fr: 'Refuser', de: 'Absagen' },
                    style: 'danger',
                    action: {
                      key: 'decline',
                      params: { incident_id: incident.incident_id },
                      confirm: true,
                    },
                  },
                ]
              : []),
          ]
        : []),
    ],
  }));

  gladys.onWidgetAction('incident', async (key, { incident_id }) => {
    const decision = { accept: 'accepted', decline: 'declined' }[key];
    if (!decision) throw new Error('Unknown incident action');
    if (!incident || incident_id !== incident.incident_id || incident.response !== 'pending') {
      throw new Error(
        'Widget is outdated; refresh it. / Widget ist veraltet; bitte aktualisieren.',
      );
    }
    const result = await respond(decision);
    return RESPONSE_LABELS[result.response];
  });

  gladys.on('connected', () => {
    gladys.requestWidgetRefresh('incident');
    gladys
      .setConnectionStatus(true, {
        en: 'HTTP response actions ready. FF-Agent confirmation has not been verified.',
        fr: 'Actions HTTP disponibles. Confirmation FF-Agent non vérifiée.',
        de: 'HTTP-Rückmeldeaktionen bereit. FF-Agent-Bestätigung noch nicht geprüft.',
      })
      .catch((error) => {
        logger.error('Cannot report response action status to Gladys', error);
      });
  });
}
