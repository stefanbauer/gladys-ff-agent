# FF-Agent für Gladys Assistant

Eigenständige externe `provider`-Integration für Gladys Assistant **ab 5.2.1**,
auf Basis des [offiziellen JavaScript-Templates](https://github.com/GladysAssistant/integration-template-js)
und des offiziellen SDK 0.15.0. Keine Änderungen am Gladys-Kern erforderlich.

> **Rückmeldeaktionen senden echt an FF-Agent.** Kein Simulationsmodus für Zu-/Absagen.
> HTTP-Erfolg ist noch keine bestätigte Einsatzrückmeldung; die FF-Agent-Antwortsemantik
> muss praktisch geprüft werden. Der Empfang echter Alarme fehlt noch. „Einsatz simulieren“
> erzeugt Testdaten, kann aber Szenen mit echten Rückmeldeaktionen auslösen.

## Was bereits funktioniert

- „Einsatz simulieren“ in der Integrationskonfiguration publiziert den Trigger
  `incident_received` mit ID, Stichwort, Kategorie, Ort, Zeitpunkt und `simulated: true`.
- Die Aktionen `accept_incident` und `decline_incident` senden HTTP-GET-Anfragen
  an die persönlichen FF-Agent-Rückmeldelinks. Keine zusätzliche Einsatz-ID nötig,
  auch kein zuvor empfangener oder simulierter Alarm.
- Das Widget **FF-Agent Einsatz** zeigt den letzten Übungseinsatz mit bestätigungspflichtigen
  Zu-/Absagebuttons. Veraltete Widget-Klicks werden abgewiesen.
- Dieselben Rückmeldeoperationen stehen als Konfigurationsbuttons bereit.
- Sichtbares, bearbeitbares UUID-Feld, Anreise-Dropdown und native Gladys-Hausauswahl.
  „Rückmeldekonfiguration prüfen“ liest die Koordinaten des gewählten Hauses, ohne
  FF-Agent aufzurufen oder UUID/Koordinaten im Ergebnis auszugeben.
- Englische, französische und deutsche Beschriftungen und Nutzerdokumentation.

## Lokal entwickeln

Zwei getrennte Prozesse/Terminals, beide mit Node 24:

```bash
# Terminal 1: Gladys-Backend UND Gladys-Frontend
cd ~/Herd/gladys
nvm use 24
npm start
```

```bash
# Terminal 2: diese Integration
cd ~/Herd/gladys-ff-agent
nvm use
npm run dev
```

`npm start` geht ebenfalls, dann ohne automatischen Neustart bei Änderungen.
Beim ersten Checkout einmal `npm ci` installieren.

### Einmalig: lokale Admin-Sitzung erlauben

Docker Desktop und die lokale Gladys-Instanz müssen laufen. Einmal ausführen:

```bash
npm run dev:login
```

Mit dem **lokalen Gladys-Admin-Konto** anmelden, nicht mit Gladys Plus. Das Passwort
wird verdeckt eingegeben und nicht gespeichert. Nur die lokale Refresh-Sitzung
liegt in `data/dev-session.json` (ignoriert, Dateirechte `600`); sie erlaubt dem
Entwicklungshelfer Admin-API-Zugriff. Bei Ablauf/Widerruf erneut `dev:login` ausführen.
Die Sitzung kann in Gladys unter den verbundenen Geräten widerrufen werden.

Die Admin-Sitzung wird nur vom lokalen Entwicklungshelfer für die Registrierung
benötigt, nicht vom Integrationscode selbst. Der laufende SDK-Prozess verwendet
sein eigenes, auf diese Integration begrenztes Token. Im späteren Produktionsimage
ist der Entwicklungshelfer nicht enthalten.

Danach erledigen `npm run dev` und `npm start` die Registrierung selbst:

- Unverändert: kein Build und kein Update; der SDK-Prozess startet direkt.
- Manifest geändert: lokales Registrierungsimage mit Manifest-Label bauen, die
  vorhandene Integration über Gladys aktualisieren und das rotierte SDK-Token übernehmen.
- Keine Registrierung vorhanden: über die lokale API installieren.
- Im Watch-Modus lösen Code- und Manifeständerungen diesen Ablauf automatisch aus.
- Selector, gespeicherte Konfiguration und Szenenverweise bleiben beim Update erhalten.

Kein manuelles JSON-Kopieren und keine Neuinstallation nach jeder Änderung.
`npm run dev:sync` gleicht nur die Registrierung ab, ohne den SDK-Prozess zu starten.
Nur ein Entwicklungsprozess gleichzeitig; vor einem manuellen Sync einen laufenden
Prozess mit Ctrl+C beenden und danach neu starten. Die Helfer akzeptieren ausschließlich
Loopback-Adressen und aktualisieren nur das eigene lokale Entwicklungsimage.

Das Repository darf privat bleiben. Kein Registry-Push oder Plus ist zum lokalen
Testen nötig. `.env.example` dokumentiert die SDK-Variablen. SDK-Token und Admin-Sitzung
niemals committen oder teilen. Falls ohne automatischen Abgleich gearbeitet werden muss,
bleiben `dev:prepare` und `dev:connect` verfügbar. Das Image
`gladys-ff-agent-dev:1.0.0` enthält das Manifest als Label; Gladys kann es im Entwicklermodus
direkt auslesen. Eine abweichende **lokale** Backend-Adresse kann in `.env` gesetzt werden.

**Warum ein Registrierungscontainer?** Gladys 5.2.1 installiert externe Integrationen
über seinen Docker-Supervisor; es gibt keine separate Registrierung für einen
hostlokalen Node-Prozess. `Dockerfile.dev` hält deshalb nur einen inaktiven Container
am Leben. Ausschließlich `npm run dev` verbindet das SDK. Ein zweiter aktiver SDK-Client
würde die WebSocket-Verbindung übernehmen. Dies ist eine lokale Entwicklungshilfe,
nicht das spätere Produktionsimage. Während der lokale Node-Prozess läuft, ist der
Dienststatus RUNNING; davor kann ein Verbindungs-Timeout angezeigt werden.
Der Verbindungsbadge signalisiert die Bereitschaft der HTTP-Aktionen, nicht eine
geprüfte FF-Agent-Anmeldung oder eine bestätigte Rückmeldung.

### Mehrere Integrationen parallel

Gladys nur einmal starten. Jede weitere Integration bekommt ein eigenes Repository,
ein eigenes Entwicklungsimage, einen eigenen Gladys-Selector und ein eigenes SDK-Token.
Der FF-Agent-Helfer aktualisiert ausschließlich seinen konfigurierten Selector und
verweigert Updates fremder Images oder Store-Installationen. Unterschiedliche
Integrationen können gleichzeitig verbunden sein; zwei Prozesse für **denselben**
Selector ersetzen hingegen gegenseitig ihre Verbindung. Es sind keine zusätzlichen
Frontend- oder Backend-Instanzen und für diesen SDK-Betrieb keine weiteren Ports nötig.

### Testablauf

1. Vorher Szenen prüfen: **Testalarme können echte Rückmeldeaktionen auslösen.**
   Für einen reinen lokalen Test keine Szene mit solchen Aktionen aktivieren.
2. Unter FF-Agent → Konfiguration **Einsatz simulieren** wählen.
3. Im Dashboard **FF-Agent Einsatz** hinzufügen. Die Anzeige zeigt Testdaten
   und warnt, dass Rückmeldebuttons echte Anfragen senden.
4. „Zusagen“ oder „Absagen“ nur wählen, wenn wirklich eine FF-Agent-Rückmeldung
   angefragt werden soll. Danach in FF-Agent prüfen, ob sie übernommen wurde.
5. Für Szenen: Trigger **Einsatz eingegangen** auswählen; Kategorie leer lassen
   oder `exercise` filtern. Die Rückmeldeaktionen benötigen keine Felder.

`npm run dev` lädt Codeänderungen automatisch neu; dabei geht der simulierte Einsatz verloren.
Ohne Hot Reload genügt `npm start`. Gladys selbst läuft separat weiter.

### Rückmeldekonfiguration

Die Rückmelde-UUID wird als normales Gladys-Textfeld gespeichert und bleibt beim
Bearbeiten sichtbar. Keine reale UUID committen oder in Logs ausgeben. Sie stammt aus der Form
`https://www.ff-agent.com/app2/missionreplies/<UUID>/accept` bzw. `/reject`.
Nur die eingegebene UUID wird gespeichert; der Link wird daraus bei einer Aktion
erzeugt. Laut Nutzer benötigen Zu-/Absagen keine zusätzliche Einsatz-ID.

Anreiseart: Auto (`CAR`), Fahrrad (`BICYCLE`), zu Fuß (`FEET`), gemäß Nutzerangaben.
„Zuhause in Gladys“ ist eine native Hausauswahl. Latitude/Longitude kommen über das
SDK aus dem **gewählten** Haus, nicht aus einem eigenen Koordinatenformular und nicht
aus dem ersten Haus der Liste. Deshalb fordert das Manifest `location: true` an.
Bei fehlendem Standort scheitert die Konfigurationsprüfung verständlich.
Eine Absage verwendet nur die UUID; Anreiseart und Hauskoordinaten sind dafür nicht nötig.

Es gelten fünf Sekunden HTTP-Timeout, keine automatischen Wiederholungen und keine
Weiterleitungen. Bei Timeout oder HTTP-Fehler ist unklar, ob FF-Agent die Rückmeldung
bereits verarbeitet hat: vor erneutem Senden dort prüfen. Ein HTTP-2xx-Ergebnis liefert
`response`, `confirmed: false` und `http_status` als Szenenausgaben. Es behauptet keine
fachlich bestätigte Zu-/Absage. Automatisierte Tests verwenden ausschließlich HTTP-Doubles.

### Alarmeingang: Plus später, REST lokal

Vorgesehen ist FF-Agent → Gladys Plus → externer Integrationswebhook → Szenentrigger.
Der Nutzer erzeugt dazu einen Plus-Open-API-Key. Die vom Gladys-Kern erzeugte URL-Form ist:

```text
https://api.gladysgateway.com/v1/api/external-integration/<OPEN_API_KEY>/<SELECTOR>/<WEBHOOK_KEY>
```

Das ist **nicht** der `/device/state`-Endpunkt des älteren Open-API-Tutorials:
der nimmt Sensorwerte entgegen, keine beliebigen Einsatz-JSONs.
Erst nach Festlegung des Payloads einen Webhook im Manifest deklarieren und per
SDK `onWebhook` anbinden. Zurzeit ist bewusst noch keiner registriert.
Die Konfigurationsseite erklärt bereits die FF-Agent-Formularfelder und den späteren
nativen URL-Bereich. Die ausführliche [Einrichtungsanleitung](docs/de.md) enthält die Zuordnung.

Für lokale Tests ohne Plus ist bereits die normale, authentifizierte Aktions-API nutzbar:

```bash
curl -X POST http://localhost:1443/api/v1/external_integration/ext-dev-ff-agent/action/simulate_incident \
  -H 'Authorization: Bearer <LOKALER_GLADYS_ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data '{"fields":{}}'
```

Sie erzeugt einen synthetischen Einsatz über denselben Handler wie der Konfigurationsbutton.
Der Access-Token stammt aus der lokalen Benutzeranmeldung, **nicht** aus Plus oder
der Integrationstoken-`.env`. Der spätere lokale JSON-Testeingang kann eine deklarierte
Aktion verwenden und denselben Payload-Parser wie der Plus-Webhook aufrufen.
Gladys 5.2.1 hat keinen äquivalenten lokalen Webhook-POST-Endpunkt. Die produktive,
bereits mit Plus verbundene Gladys-Instanz wird für diese Entwicklung nicht umgekoppelt.

## Qualität und Container

```bash
npm run format:check
npm run lint
npm test
npx github:GladysAssistant/integration-store --skip-image-check .
docker build -t ghcr.io/stefanbauer/gladys-ff-agent:1.0.0 .
```

Die Tests verwenden die offizielle SDK-Testumgebung und brauchen keine Netzwerkverbindung
oder FF-Agent-Zugangsdaten. Der Store-Validator benötigt beim ersten Aufruf Internetzugriff.
`--skip-image-check` ist nötig, solange noch kein Releaseimage veröffentlicht wurde.
Der normale `Dockerfile` ist das Produktionsimage (non-root, read-only-kompatibel).
Beim Container-Test **nicht** gleichzeitig einen lokalen SDK-Prozess für denselben Selector starten.

## Nächster Entwicklungsschritt

Als Nächstes: Alarm-JSON und FF-Agent-Platzhalter samt Escapierung klären sowie die
tatsächliche Zu-/Absagebestätigung prüfen. Keine Bestätigungsstatuscodes raten.
Der HTTP-Transport liegt bereits in `src/ff-agent.js`; den Alarmeingang separat
implementieren, inklusive Replay-Erkennung, Ablaufzeiten und sicherer Persistenz.
Die Gladys-Handler und stabilen Manifest-Schlüssel bleiben die Schnittstelle.

Derzeit keine lokalen HTTP-Webhookports, keine zusätzlichen Geräte und kein Gladys-Plus-Zwang.
Die dokumentierten Gladys-Webhooks laufen über Gladys Plus; sie sind nicht automatisch
ein frei erreichbarer lokaler HTTP-Eingang.

## Titelbild

`cover.jpg` liegt wie bei den Referenzintegrationen direkt im Repository-Stamm:
800 × 534 Pixel, unter 150 KB. Es zeigt das FF-Agent-Logo mit Schriftzug auf einem
nahtlosen roten Verlauf bis an alle Bildränder, ohne Foto, Rahmen oder Badge.
Das Manifest verweist auf die GitHub-Rohdatei unter `main/cover.jpg`.
Das öffentliche Repository macht diese Datei ohne Anmeldung für die lokale
Gladys-Anzeige erreichbar. Keine Tokens in die Bild-URL einbauen.

## Öffentliches Repository, kein Store-Eintrag

Der Quellcode ist öffentlich, die Integration bleibt ein Entwicklungsstand und
**darf noch nicht im Gladys Store erscheinen**. Das GitHub-Topic
`gladys-assistant-integration` deshalb **nicht setzen**: darüber entdeckt der
offizielle Indexer öffentliche Repositories. Der Repository-Name allein aktiviert
keine Katalogaufnahme. Lokale Entwicklung benötigt keine Store-Veröffentlichung.

Build-/Release-Workflows aus dem offiziellen Template sind vorbereitet, werden
aber beim normalen Branch-Push nicht veröffentlicht; CI prüft und baut nur lokal
im Runner (`push: false`). Keine Release-/Build-and-publish-Workflows manuell starten
und keine `v*`-Tags pushen: diese Schritte veröffentlichen Images bzw. Releases.
Eine spätere Veröffentlichung und Store-Aufnahme benötigen eine separate Freigabe.
Das Produktionsmanifest verweist bereits auf den zukünftigen Image-Namen; das Image
existiert vor dem ersten Release nicht in GHCR.

## Referenzen

- [Offizielle Anleitung](https://gladysassistant.com/docs/dev/external-integrations/)
- [Gladys Plus Open API](https://gladysassistant.com/docs/plus/open-api/)
- [Lokale REST API](https://gladysassistant.com/docs/api/rest-api/)
- [JavaScript-SDK](https://github.com/GladysAssistant/integration-sdk-js)
- [Elgato-Beispiel](https://github.com/guim31/gladys-elgato)
- [Homematic-Beispiel mit Szenen und Buttons](https://github.com/guim31/gladys-homematic-ccu)
