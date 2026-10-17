# FF-Agent für Gladys Assistant

Eigenständige externe `provider`-Integration für Gladys Assistant **ab 5.2.1**,
auf Basis des [offiziellen JavaScript-Templates](https://github.com/GladysAssistant/integration-template-js)
und des offiziellen SDK 0.15.0. Keine Änderungen am Gladys-Kern erforderlich.

> **Rückmeldeaktionen senden echt an FF-Agent.** Kein Simulationsmodus für Zu-/Absagen.
> HTTP-Erfolg ist noch keine bestätigte Einsatzrückmeldung; die FF-Agent-Antwortsemantik
> muss praktisch geprüft werden. „Einsatz simulieren“
> erzeugt Testdaten, kann aber Szenen mit echten Rückmeldeaktionen auslösen.

**Zu- und Absagen benötigen weder Gladys Plus noch einen Open-API-Key.** Plus samt
Key wird nur für echte eingehende FF-Agent-Alarme über den Webhook benötigt, die
den Szenentrigger auslösen. „Einsatz simulieren“ löst denselben Trigger lokal ohne Plus/Key aus.

## Was bereits funktioniert

- Native Plus-Webhooks empfangen ein datensparsames Alarmsignal (`POST`, JSON `{}`).
  Die native Karte **Gladys-Plus-Webhooks** zeigt die aktuelle URL.
- „Einsatz simulieren“ in der Integrationskonfiguration publiziert den Trigger
  `incident_received` ausschließlich mit `received_at`: dem lokal erzeugten Empfangszeitpunkt.
  Aus Datenschutzgründen gibt es keine Einsatzdaten und keinen Kategorie-Filter.
- Die Aktionen `accept_incident` und `decline_incident` senden HTTP-GET-Anfragen
  an die persönlichen FF-Agent-Rückmeldelinks. Keine zusätzliche Einsatz-ID nötig,
  auch kein zuvor empfangener oder simulierter Alarm.
- Das Widget **FF-Agent Einsatz** zeigt offene Alarme mit bestätigungspflichtigen
  Zu-/Absagebuttons, eine manuell beendbare Zusageanzeige und die letzte Rückmeldung.
  Veraltete und gleichzeitig ausgelöste Rückmeldeklicks werden abgewiesen.
- Dieselben Rückmeldeoperationen stehen als Konfigurationsbuttons bereit.
- Sichtbares, bearbeitbares UUID-Feld, Anreise-Dropdown und native Gladys-Hausauswahl.
  Jede Zu-/Absage prüft ihre benötigten Einstellungen vor dem echten FF-Agent-Aufruf.
- Englische, französische und deutsche Beschriftungen und Nutzerdokumentation.

### Widget-Zustände

- **Ruhe:** „Kein Alarm“ bedeutet kein offener, lokal empfangener Alarm – nicht,
  dass FF-Agent geprüft wurde oder die Alarmverbindung funktioniert.
- **Alarm:** roter Alarmstatus, Empfangszeit und Zu-/Absagebuttons. Unbeantwortete
  Alarme bleiben offen. Testalarme sind erkennbar; ihre Rückmeldungen senden echt.
- **Zusage gesendet:** nach HTTP-Erfolg grüne Anzeige bis „Einsatz beenden“ gedrückt
  wird. Danach wieder Ruhe mit letzter Rückmeldung und Zeitpunkt.
- **Absage gesendet:** nach HTTP-Erfolg sofort Ruhe; letzte Rückmeldung bleibt sichtbar.
- **Kein aktiver Einsatz:** meldet FF-Agent dies ausdrücklich, sofort Ruhe statt
  einer vermeintlichen Zusage. Die letzte Antwort bleibt sichtbar.
- **Fehler/Timeout:** Alarm nicht ausblenden, keine erfolgreiche Rückmeldung merken.
  Vor Wiederholung in FF-Agent prüfen; keine automatische Wiederholung.

Die Anzeige bestätigt nur HTTP-Zustellung, keine operative Einsatzrückmeldung.
„Einsatz beenden“ setzt nur die lokale Anzeige zurück und sendet nichts an FF-Agent. Die
Anzeige aktualisiert sich regulär alle zehn Sekunden; Browserpause oder fehlende
Verbindung können sie verzögern. Ein neuer Alarm ersetzt den offenen Zustand,
auch während der Zusageanzeige; alte laufende Anfragen dürfen ihn nicht quittieren.
Die letzte erfolgreiche Anfrage bleibt bis zur nächsten erhalten, auch ohne
vorherigen Alarm bei Szenen-/Konfigurationsaktionen. Empfang und Rückmeldung
bleiben nur im Arbeitsspeicher; Neustart löscht beide. Zeitangaben sind in UTC.

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

### Überwachung und Protokolle

„Starten“ in Gladys steuert den Docker-Container und startet einen laufenden
Container erneut. Der Button ist auch bei RUNNING sichtbar; er ist dann nicht
nötig. Im lokalen Entwicklungsmodus startet er **nicht** den Node-Prozess auf
dem Mac: dafür weiterhin `npm run dev` verwenden.

Die Integration protokolliert Alarmempfang, Testalarme, Übergabe des Ereignisses
an Gladys sowie Zu-/Absageanfragen mit HTTP-Status oder unbestätigtem Netzwerkergebnis.
Fehlende Einstellungen werden vor dem Senden gemeldet. Die technischen Logs sind
auf Englisch und enthalten Zeitstempel, aber keine UUIDs, Koordinaten, Schlüssel,
URLs, Webhookinhalte oder rohen FF-Agent-Antworten. UI-Rückmeldefehler werden
getrennt nach Gladys-Sprache angezeigt (Deutsch, Englisch oder Französisch).

Lokal stehen die Logs im Terminal von `npm run dev`. Der Gladys-Bereich „Protokolle“
liest nur Docker-Ausgaben und bleibt beim inaktiven Registrierungscontainer leer.
Beim normalen Produktionsimage läuft Node im Container; dieselben Logs erscheinen
dort nach dem Aktualisieren in Gladys. Ein Empfangslog bestätigt weder die Ausführung
aller Szenen noch eine operative Einsatzrückmeldung.

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
5. Für Szenen: Trigger **Einsatz eingegangen** auswählen; es gibt keinen Filter.
   Zusagen können optional eine Anreiseart festlegen; Absagen benötigen keine Felder.

`npm run dev` lädt Codeänderungen automatisch neu; dabei geht der letzte Alarm verloren.
Ohne Hot Reload genügt `npm start`. Gladys selbst läuft separat weiter.

### Rückmeldekonfiguration

Die Rückmelde-UUID wird als normales Gladys-Textfeld gespeichert und bleibt beim
Bearbeiten sichtbar. Keine reale UUID committen oder in Logs ausgeben.
In FF-Agent unter **Persönliches Profil → „Weblinks für Einsatzmeldung“** findest du
die Links. Beispiel mit unkenntlicher UUID:
`https://www.ff-agent.com/app2/missionreplies/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/accept`.
Nur die eigene UUID anstelle der x zwischen `/missionreplies/` und `/accept` bzw.
`/reject` kopieren, nicht die gesamte URL oder Parameter wie `?transport=CAR`.
Nur die eingegebene UUID wird gespeichert; der Link wird daraus bei einer Aktion
erzeugt. Laut Nutzer benötigen Zu-/Absagen keine zusätzliche Einsatz-ID.

Anreiseart: Auto (`CAR`), Fahrrad (`BICYCLE`), zu Fuß (`FEET`), gemäß Nutzerangaben.
Bei einer Zusage kann die Anreiseart optional in der Szenenaktion oder beim
Konfigurationsbutton überschrieben werden. Leer bedeutet: Standard aus der
Konfiguration. Die Überschreibung gilt nur für diesen Aufruf, nicht für spätere
Zusagen. Widget-Buttons verwenden den konfigurierten Standard.
„Zuhause in Gladys“ ist eine native Hausauswahl. Latitude/Longitude kommen über das
SDK aus dem **gewählten** Haus, nicht aus einem eigenen Koordinatenformular und nicht
aus dem ersten Haus der Liste. Deshalb fordert das Manifest `location: true` an.
Bei fehlendem Standort wird eine Zusage vor dem Versand mit einer Fehlermeldung abgebrochen.
Eine Absage verwendet nur die UUID; Anreiseart und Hauskoordinaten sind dafür nicht nötig.

Es gelten fünf Sekunden HTTP-Timeout, keine automatischen Wiederholungen und keine
Weiterleitungen. Bei Timeout oder HTTP-Fehler ist unklar, ob FF-Agent die Rückmeldung
bereits verarbeitet hat: vor erneutem Senden dort prüfen. Beide Szenenaktionen liefern
nur `success` (Anfrage erfolgreich): `true` bei HTTP 2xx, auch wenn gerade kein Einsatz
aktiv ist; `false` bei ungültiger Konfiguration, HTTP-Fehler oder unbestätigter Übertragung.
Die Szene kann diesen Wert in Folgeschritten auswerten und läuft auch bei `false` weiter.
Dies ist keine fachliche Bestätigung einer Zu-/Absage. Bei Timeout kann FF-Agent die
Anfrage dennoch verarbeitet haben; `false` ist keine sichere Ablehnung und darf keine
automatischen Wiederholungen auslösen. Konfigurations- und Widget-Buttons zeigen
weiterhin detaillierte Meldungen bzw. Fehler. Automatisierte Tests verwenden nur HTTP-Doubles.

### Alarmeingang: Plus öffentlich, REST lokal

FF-Agent → Gladys Plus → nativer Integrationswebhook `incident` → Szenentrigger.
Die gewünschte Instanz muss mit Plus verbunden sein. Unter Plus → Einstellungen →
Open API einen Key erzeugen und in Gladys im nativen Bereich **Webhooks** dieser
Integration speichern. Keine eigene Schlüsselverwaltung in der Integration.
Die native Webhooks-Karte zeigt die vom Gladys-Kern erzeugte URL samt Schlüssel,
auch nach Schlüsselwechsel. Ein zusätzlicher URL-Aktionsbutton ist nicht nötig.
Die URL-Form ist:

```text
https://api.gladysgateway.com/v1/api/external-integration/<OPEN_API_KEY>/<SELECTOR>/<WEBHOOK_KEY>
```

Das ist **nicht** der `/device/state`-Endpunkt des älteren Open-API-Tutorials:
der nimmt Sensorwerte entgegen, keine beliebigen Einsatz-JSONs.
In FF-Agent einen generischen Webhook mit **POST**, **HTTPS** und **JSON-Body `{}`**
eintragen. Bei separater Protokollauswahl `https://` von der URL entfernen.
Keine Basis-Authentifizierung und keine zusätzlichen Header; JSON setzt den Content-Type.
Die URL enthält den Plus-Key: privat halten, bei Offenlegung den Key widerrufen/ersetzen
und die neue URL in FF-Agent eintragen. Niemals den persönlichen Rückmeldelink nutzen.

FF-Agent liefert aus Datenschutzgründen keine Einsatzdetails. Es genügt nur
ein Alarmsignal, ohne ID, Stichwort, Kategorie, Ort oder FF-Agent-Zeitstempel.
Die Integration erzeugt `received_at` auf dem Gladys-System selbst (UTC/ISO 8601).
Auch Testalarme geben nur dieses Feld weiter; es gibt keine Simulationsvariable.
Der Handler ignoriert den Body vollständig und verarbeitet nur POST als Alarmsignal;
GET löst keinen Alarm aus. Der Modus `fire_and_forget` bestätigt sofort, unabhängig
von der Szenenausführung. **HTTP 200 allein beweist keinen Alarmempfang:** gestoppte
Integrationen oder Verbindungsprobleme können ebenfalls 200 ergeben und Signale verlieren.
Vor echtem Einsatz daher einen Test aus FF-Agent senden und Trigger/Widget in Gladys prüfen.
Jeder zugestellte POST zählt als Alarm; ohne Ereignis-ID sind Wiederholungen nicht
zuverlässig unterscheidbar. Keine garantierte Zustellung, Persistenz oder Replay-Erkennung;
dies ersetzt keine offizielle Alarmierung.
Die ausführliche [Einrichtungsanleitung](docs/de.md) enthält die Formularzuordnung.

Für lokale Tests ohne Plus ist bereits die normale, authentifizierte Aktions-API nutzbar:

```bash
curl -X POST http://localhost:1443/api/v1/external_integration/ext-dev-ff-agent/action/simulate_incident \
  -H 'Authorization: Bearer <LOKALER_GLADYS_ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data '{"fields":{}}'
```

Sie erzeugt einen Testalarm über denselben Empfangspfad wie der Plus-Webhook.
Der Access-Token stammt aus der lokalen Benutzeranmeldung, **nicht** aus Plus oder
der Integrationstoken-`.env`.
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

Als Nächstes: echte Ende-zu-Ende-Zustellung FF-Agent → Plus → Gladys auf der
gewünschten Plus-Instanz prüfen sowie die tatsächliche Zu-/Absagebestätigung klären.
Keine Bestätigungsstatuscodes raten. Ohne Ereignis-ID ist Replay-Erkennung nicht
zuverlässig möglich. Alarmzustand bleibt derzeit ausschließlich im Arbeitsspeicher.

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
