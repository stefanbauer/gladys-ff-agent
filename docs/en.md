# FF-Agent for Gladys Assistant

This external provider integration targets Gladys Assistant 5.2.1 or newer.
**Accept/reject actions send real HTTP requests to FF-Agent.** Incoming alarms
are not implemented yet. HTTP success does not prove FF-Agent recorded the mission
response; check it there. This does not replace official alarm systems.

## Configuration and use

Install the local development image and manifest as described in the repository README.
Start the integration's local Node process. In Configuration, press **Simulate incident**.
Add **FF-Agent incident** to a dashboard to see the latest incident and its response
buttons. Widget buttons require confirmation and send real requests, even for a test
alarm. **Test scenes can also send real responses.** Configuration and scene actions
need no additional incident ID and no prior alarm.

The reply UUID stays visible and editable. Acceptance also requires transport
(CAR/BICYCLE/FEET) and a native Gladys house selection. Rejection only needs the UUID.
Coordinates come from the selected Gladys house, requiring
the declared location permission. **Check reply settings** validates these values
without contacting FF-Agent or displaying the UUID or coordinates. Simulation
does not require these settings. Never share personal reply links.

## Prepare the FF-Agent generic webhook

The configuration page explains the FF-Agent form directly. Do not enable delivery
yet: reception and the final JSON payload are not implemented. Prepare POST, HTTPS,
no Basic authentication, no additional headers, and JSON format (FF-Agent sets
Content-Type automatically). Once reception is implemented, use Gladys' native
Webhooks section to save the Plus Open API key and obtain the complete URL. Omit
`https://` from FF-Agent's URL field if its protocol dropdown already supplies it.
The URL is secret; never use a personal accept/reject link as the alarm endpoint.

The body needs confirmed FF-Agent incident variables and JSON escaping, not guessed
placeholders. Connection and processing each have a five-second timeout according
to the FF-Agent form. Test delivery before operational use. FF-Agent cannot reach
this Mac through localhost: local authenticated REST simulation is separate from
the eventual Plus delivery test. Do not change the existing production Plus link.

The scene trigger **Incident received** exposes `incident_id`, `title`, `category`,
`location`, `received_at`, and `simulated`. The optional category filter matches
`exercise` for test alarms. **Accept incident** and **Decline incident** need no
fields. Their outputs are `response`, `http_status` and `confirmed: false`; the
trigger's `simulated` flag describes the alarm only. Requests time out after five
seconds with no automatic retries or redirects. Check FF-Agent before retrying
an uncertain result.

## Limitations and troubleshooting

Only the latest synthetic incident is held in memory; restarting clears it.
Docker Desktop and Node 24 are required for the documented local setup. Keep the
registration container running and use only one active SDK process per selector.
`npm run dev` synchronizes registration and the integration token automatically. Never commit
tokens or actual incident data. See the repository README for setup and logs.
