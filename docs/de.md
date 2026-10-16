# FF-Agent — Entwicklungsgrundgerüst

Diese externe Provider-Integration benötigt Gladys Assistant ab 5.2.1.
**Zu-/Absageaktionen senden echte HTTP-Anfragen an FF-Agent.** Der Empfang echter
Alarme ist noch nicht implementiert. HTTP-Erfolg bestätigt noch keine fachliche
Übernahme in FF-Agent; diese muss dort geprüft werden.

Installation und lokaler Start sind im README beschrieben. Anschließend unter
Konfiguration „Einsatz simulieren“ wählen und das Widget „FF-Agent Einsatz“ zum
Dashboard hinzufügen. Dort erscheinen bestätigungspflichtige Rückmeldebuttons.
Auch diese senden echt. **Testalarme können über Szenen echte Rückmeldungen auslösen.**
Die Konfigurationsbuttons und Szenenaktionen brauchen keine zusätzliche Einsatz-ID
und keinen zuvor simulierten Alarm.

Die Rückmelde-UUID bleibt sichtbar und bearbeitbar. Für Zusagen sind zusätzlich
Anreiseart (CAR/BICYCLE/FEET) und Zuhause nötig; Absagen verwenden nur die UUID.
Die Koordinaten kommen aus dem gewählten Gladys-Haus, nicht aus einem
separaten Eingabefeld. Dafür fordert die Integration Standortzugriff an.
„Rückmeldekonfiguration prüfen“ prüft diese Daten ohne echten FF-Agent-Aufruf.
Die Testerzeugung benötigt diese Einstellungen nicht. Niemals persönliche Rückmeldelinks teilen.

## FF-Agent: Generischen Webhook vorbereiten

Die Konfigurationsseite enthält dieselbe Anleitung direkt im Formular.
**Noch nicht aktivieren:** Der Alarmempfang und der verbindliche JSON-Body fehlen noch.

| FF-Agent-Feld           | Eintrag                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bemerkung               | `Gladys – FF-Agent Einsatzalarmierung`                                                                                                                           |
| Versand/Daten           | **POST**                                                                                                                                                         |
| Protokoll               | **https://**                                                                                                                                                     |
| URL                     | Später die von Gladys im Bereich **Webhooks** angezeigte URL übernehmen. Bei separater Protokollauswahl ohne `https://`, damit es nicht doppelt vorkommt.        |
| Basis-Authentifizierung | Nicht setzen; kein Benutzername oder Passwort.                                                                                                                   |
| Header                  | Keine zusätzlichen Header für den Plus-Webhook nötig.                                                                                                            |
| Inhalt / Format         | **JSON**; FF-Agent setzt `Content-Type` laut Formular automatisch.                                                                                               |
| Body                    | Noch offen: die unterstützten FF-Agent-Platzhalter und ihre JSON-Escapierung müssen bestätigt werden. Kein erfundenes Beispiel als produktive Vorlage verwenden. |

Sobald der Empfänger implementiert und im Manifest deklariert ist, nutzt Gladys
seinen nativen Webhook-Bereich: gewünschte Instanz mit Plus verbinden, unter
Plus → Einstellungen → Open API einen Schlüssel erzeugen und in Gladys im Bereich
Webhooks speichern. Gladys erzeugt dann die URL; sie enthält den Schlüssel und
ist wie ein Passwort zu behandeln. Nicht den persönlichen Zu-/Absagelink verwenden.
Ein eigener URL-Button ist dafür nicht erforderlich; die native Anzeige kann
markiert und kopiert werden.

FF-Agent begrenzt Verbindungsaufbau und Verarbeitung auf jeweils fünf Sekunden.
Der künftige Empfänger muss schnell bestätigen; Rückmeldeaktionen gehören nicht
in diesen Empfangsrequest. Vor produktiver Nutzung mit einem Testalarm prüfen.

Lokal bleibt die bereits verknüpfte produktive Plus-Instanz unverändert.
`localhost` ist aus der FF-Agent-Cloud nicht erreichbar. Die lokale REST-Simulation
testet die Integration, aber noch nicht den Versand aus FF-Agent über Plus.
Siehe [Plus Open API](https://gladysassistant.com/docs/plus/open-api/) und
[lokale REST-API](https://gladysassistant.com/docs/api/rest-api/).

Szenen können den Trigger „Einsatz eingegangen“ und die Aktionen „Einsatz zusagen“
/ „Einsatz absagen“ nutzen. Kein Einsatz-ID-Feld nötig. Der optionale Kategoriefilter ist
für Simulationen `exercise`. Weitere Triggerdaten: `title`, `location`,
`received_at` und `simulated`. Das Flag `simulated` kennzeichnet nur den Testalarm,
nicht die Rückmeldeaktion. Szenenausgaben: `response`, `http_status`, `confirmed: false`.
Timeout nach fünf Sekunden, keine automatischen Wiederholungen oder Weiterleitungen.
Bei Fehler oder unklarem Ergebnis vor erneutem Senden den Status in FF-Agent prüfen.

Nur der letzte Übungseinsatz bleibt im Speicher; ein Neustart löscht ihn.
`npm run dev` gleicht Registrierung und Integrationstoken automatisch ab.
Niemals Tokens, Passwörter oder reale Einsatzdaten ins Repository übernehmen.
