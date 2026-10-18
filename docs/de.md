# FF-Agent — Entwicklungsgrundgerüst

Diese externe Provider-Integration benötigt Gladys Assistant ab 5.2.1.
**Zu-/Absageaktionen senden echte HTTP-Anfragen an FF-Agent.** HTTP-Erfolg bestätigt noch keine fachliche
Übernahme in FF-Agent; diese muss dort geprüft werden.

Zu- und Absagen benötigen weder Gladys Plus noch einen Open-API-Key. Nur für
echte eingehende FF-Agent-Alarme über den Webhook sind Plus und Key nötig.
„Einsatz simulieren“ löst den Szenentrigger auch lokal ohne Plus/Key aus.

Installation und lokaler Start sind im README beschrieben. Anschließend unter
Konfiguration „Einsatz simulieren“ wählen und das Widget „FF-Agent Einsatz“ zum
Dashboard hinzufügen. Dort erscheinen bestätigungspflichtige Rückmeldebuttons.
Auch diese senden echt. **Testalarme können über Szenen echte Rückmeldungen auslösen.**
Die Konfigurationsbuttons und Szenenaktionen brauchen keine zusätzliche Einsatz-ID
und keinen zuvor simulierten Alarm.

Die Rückmelde-UUID findest du in **FF-Agent → Persönliches Profil → „Weblinks für Einsatzmeldung“**.
Beispiel: `https://www.ff-agent.com/app2/missionreplies/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/accept`.
Nur die eigene UUID anstelle der x zwischen `/missionreplies/` und `/accept` oder
`/reject` kopieren, nicht die gesamte URL oder Parameter wie `?transport=CAR`.
Die Rückmelde-UUID bleibt sichtbar und bearbeitbar. Für Zusagen sind zusätzlich
Anreiseart (CAR/BICYCLE/FEET) und Zuhause nötig; Absagen verwenden nur die UUID.
Die Anreiseart kann bei einer Zusage optional pro Szenenaktion oder Konfigurationsbutton
überschrieben werden. Leer verwendet den Standard aus der Konfiguration, ohne ihn
zu verändern. Widget-Buttons verwenden weiterhin diesen Standard.
Die Koordinaten kommen aus dem gewählten Gladys-Haus, nicht aus einem
separaten Eingabefeld. Dafür fordert die Integration Standortzugriff an.
Zu-/Absageaktionen prüfen die benötigten Einstellungen vor dem echten Aufruf und
werten anschließend die HTTP-Antwort aus. Ein separater Prüfbutton ist nicht nötig.
Die Testerzeugung benötigt diese Einstellungen nicht. Niemals persönliche Rückmeldelinks teilen.

## FF-Agent: Generischen Webhook einrichten

Gewünschte Gladys-Instanz mit Plus verbinden. Unter Plus → Einstellungen → Open API
einen Schlüssel erzeugen und in Gladys im nativen Bereich **Webhooks** speichern.
Die Karte **Gladys-Plus-Webhooks** zeigt die aktuelle vollständige URL samt Schlüssel.
Diese in FF-Agent im Formular **Generischer Webhook** hinterlegen:

| FF-Agent-Feld           | Eintrag                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Bemerkung               | `Gladys – FF-Agent Einsatzalarmierung`                                                                                         |
| Versand/Daten           | **POST**                                                                                                                       |
| Protokoll               | **https://**                                                                                                                   |
| URL                     | Die angezeigte Gladys-Webhook-URL übernehmen. Bei separater Protokollauswahl ohne `https://`, damit es nicht doppelt vorkommt. |
| Basis-Authentifizierung | Nicht setzen; kein Benutzername oder Passwort.                                                                                 |
| Header                  | Keine zusätzlichen Header für den Plus-Webhook nötig.                                                                          |
| Inhalt / Format         | **JSON**; FF-Agent setzt `Content-Type` laut Formular automatisch.                                                             |
| Body                    | `{}` — ein leeres JSON-Objekt, ohne personenbezogene Daten oder Einsatzdetails.                                                |

Die URL ist wie ein Passwort zu behandeln. Nicht den persönlichen Zu-/Absagelink verwenden.
Bei Schlüsselwechsel neue URL abrufen und in FF-Agent ersetzen. Der Body wird ignoriert,
nicht gespeichert und nicht an Szenen weitergegeben. Nur POST löst den Alarm aus.

FF-Agent begrenzt Verbindungsaufbau und Verarbeitung auf jeweils fünf Sekunden.
Gladys bestätigt im Modus `fire_and_forget` sofort, ohne auf Szenen zu warten.
**HTTP 200 allein bestätigt keinen Empfang:** bei gestoppter Integration oder
Verbindungsproblemen können Alarme verloren gehen. Vor produktiver Nutzung einen
Testalarm aus FF-Agent senden und Empfang im Gladys-Widget bzw. Szenentrigger prüfen.
Jeder POST zählt als Alarm; ohne Ereignis-ID ist keine zuverlässige Dublettenerkennung
möglich. Diese Integration ersetzt keine offizielle Alarmierung.

Lokal bleibt die bereits verknüpfte produktive Plus-Instanz unverändert.
`localhost` ist aus der FF-Agent-Cloud nicht erreichbar. Die lokale REST-Simulation
nutzt denselben Empfangspfad, prüft aber nicht den Versand aus FF-Agent über Plus.
Siehe [Plus Open API](https://gladysassistant.com/docs/plus/open-api/) und
[lokale REST-API](https://gladysassistant.com/docs/api/rest-api/).

Szenen können den Trigger „Einsatz eingegangen“ und die Aktionen „Einsatz zusagen“
/ „Einsatz absagen“ nutzen. Der Trigger hat keinen Filter und gibt ausschließlich
`received_at` weiter: den lokal auf dem Gladys-System erzeugten Empfangszeitpunkt
in UTC/ISO 8601, nicht von FF-Agent. Keine Einsatz-ID, Stichwort, Kategorie, Ort
oder Simulationsvariable. Auch Testalarme geben nur diesen Zeitpunkt weiter;
das Widget kennzeichnet sie als Test und zeigt keine erfundenen Einsatzdetails.

Beide Szenenaktionen liefern nur `success` („Anfrage erfolgreich (HTTP)“): ja bei
HTTP 2xx, auch ohne aktiven Einsatz; nein bei ungültigen Einstellungen, HTTP-Fehlern
oder unbestätigter Übertragung. Die Szene läuft danach weiter und kann das Ergebnis
auswerten. Das bestätigt keine tatsächliche Einsatzrückmeldung. Bei Timeout kann
FF-Agent bereits verarbeitet haben; nein darf keine automatische Wiederholung auslösen.
Konfigurations- und Widget-Buttons zeigen weiterhin detaillierte Meldungen bzw. Fehler.
Timeout nach fünf Sekunden, keine automatischen Wiederholungen oder Weiterleitungen.
Bei Fehler oder unklarem Ergebnis vor erneutem Senden den Status in FF-Agent prüfen.

Nur der letzte Alarm bleibt im Speicher; ein Neustart löscht ihn.
`npm run dev` gleicht Registrierung und Integrationstoken automatisch ab.
Niemals Tokens, Passwörter oder reale Einsatzdaten ins Repository übernehmen.

## Widget: Alarm und Rückmeldung

„Kein Alarm“ heißt: kein offener, lokal empfangener Alarm – keine Prüfung von
FF-Agent oder der Alarmverbindung. Ein Alarm zeigt einen roten Status, Empfangszeit
und Zu-/Absagebuttons ohne zusätzliche Bestätigungsabfrage. Testalarme bleiben klar erkennbar.
Nach erfolgreicher HTTP-Zusage zeigt das Widget „Gesendet“, bis „Einsatz beenden“
gedrückt wird. Danach wieder Ruhe mit letzter Rückmeldung und Rückmeldezeit.
Eine erfolgreiche HTTP-Absage oder „kein aktiver Einsatz“ beendet die lokale
Alarmanzeige sofort. Fehler/Timeout lassen sie offen; keine automatische Wiederholung.
Ein neuer Alarm unterbricht auch eine Zusageanzeige. Alte oder gleichzeitige Klicks
können ihn nicht quittieren. Szenen-/Konfigurationsaktionen aktualisieren dieselbe Historie.
Die Anzeige bestätigt nur HTTP-Zustellung, nicht die operative Rückmeldung.
„Einsatz beenden“ setzt nur die Anzeige zurück und sendet nichts an FF-Agent.
Die Anzeige aktualisiert sich regulär alle zehn Sekunden;
Browserpausen/Verbindungsfehler können die Anzeige verzögern. Zeiten erscheinen in
der lokalen Zeitzone deines Browsers. Die Historie zeigt die gesendete Entscheidung;
eine ausdrückliche FF-Agent-Antwort „kein aktiver Einsatz“ erscheint separat.
Nur letzter Alarm und letzte erfolgreiche Anfrage bleiben im Speicher, bis zum Neustart.

**Überwachung → Starten** startet den Docker-Container, bei laufendem Container
als Neustart. Bei bestehender Verbindung ist das nicht nötig. Der lokale Node-Prozess
auf dem Mac wird damit nicht gestartet; dafür `npm run dev` verwenden.
**Protokolle** zeigt nur Docker-Ausgaben: lokal die Logs im Terminal von `npm run dev`
lesen, nicht im inaktiven Registrierungscontainer. Beim Produktionsimage erscheinen
dieselben Logs nach dem Aktualisieren in Gladys. Technische Logs sind auf Englisch:
Alarm-/Testempfang, Ereignisübergabe, Zu-/Absageversuche, HTTP-Status und Fehler.
Keine UUIDs, Koordinaten, Schlüssel, URLs, Webhookinhalte oder rohen FF-Agent-Antworten.
Empfang bestätigt weder Szenenausführung noch operative Rückmeldung. UI-Rückmeldefehler
werden in der eingestellten Gladys-Sprache angezeigt.
