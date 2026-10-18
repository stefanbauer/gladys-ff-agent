# FF-Agent for Gladys Assistant

Receive FF-Agent incident alarms in Gladys, respond with an acceptance or rejection,
and use alarms in your scenes and dashboard.

- Dashboard widget with alarm status, response buttons and reply history.
- Scene trigger for incoming alarms and actions for accepting or declining.
- Car, bicycle or walking transport, with coordinates from your selected Gladys house.
- English, French and German interface and documentation.

> **Responses are real, including responses to simulated alarms.** A successful
> HTTP request does not confirm that FF-Agent recorded your operational response.
> This integration does not replace official alarm systems.

## Requirements and availability

- Gladys Assistant **5.2.1 or newer**, with Docker support for external integrations.
- Your personal FF-Agent reply UUID for accepting or declining incidents.
- **Gladys Plus and an Open API key only for incoming FF-Agent alarms.** Replies
  and local alarm simulation work without Plus.

## Installation

In Gladys, open **Integrations**, choose installation from a GitHub URL, and enter:

```text
https://github.com/stefanbauer/gladys-ff-agent
```

Gladys reads the manifest and downloads the matching public container image
automatically. Images support `linux/amd64` and `linux/arm64`, including Linux
containers on Docker Desktop for Intel and Apple Silicon Macs.

Once indexed, the integration is also available in the Gladys Store. GitHub-URL
installation works independently of catalog indexing. Install future releases
through Gladys's integration update controls; no manual Docker commands are needed.

## Configure responses

Open **FF-Agent → Configuration** in Gladys:

1. Enter your **Reply UUID**. Find your links in FF-Agent under **Personal profile →
   “Weblinks für Einsatzmeldung”**. From a link such as
   `https://www.ff-agent.com/app2/missionreplies/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/accept`,
   copy only the UUID between `/missionreplies/` and `/accept` or `/reject`, not
   the whole URL or query parameters. The field remains visible and editable.
2. Choose your default **Transport**: car, bicycle or on foot.
3. Select **Home in Gladys**. Set that house's location in Gladys so the integration
   can use its coordinates for acceptances.

Rejection only needs the UUID. Neither response needs an incident ID or a
previously received alarm. Keep your UUID and personal reply links private.

## Receive alarms from FF-Agent

1. Connect your Gladys instance to Gladys Plus. Create an Open API key under
   **Plus → Settings → Open API**.
2. Save the key in the integration's **Gladys Plus Webhooks** card and copy the
   displayed alarm URL.
3. In FF-Agent, configure a **Generic webhook** with **POST**, **HTTPS**, **JSON**
   and body **`{}`**. Use the copied URL, without Basic authentication or extra
   headers. If FF-Agent has a separate protocol selector, omit `https://` from
   the URL field.
4. Send a test from FF-Agent and check that the alarm appears in Gladys.

Keep the webhook URL private: it contains your Plus key. After rotating the key,
copy the new URL into FF-Agent. Do not use a personal reply link as the webhook URL.

Only an alarm signal is processed; the body is ignored. No incident title,
location or other incident details are stored. A successful webhook HTTP response
alone does not prove delivery to the integration, so always check reception in
Gladys before relying on it.

## Dashboard and scenes

Add the **FF-Agent incident** widget to a dashboard:

| State                               | Behavior                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| No alarm                            | No locally received alarm is open. This is not a check of FF-Agent or the alarm connection.           |
| Alarm                               | Shows the reception time and buttons to accept or decline immediately, without a confirmation dialog. |
| Acceptance sent                     | Stays visible until **End incident**, which only clears the local display and sends no request.       |
| Rejection sent / no active incident | Returns to idle immediately and retains the last reply and its time.                                  |
| Error or timeout                    | Keeps the alarm open. Check FF-Agent before trying again.                                             |

A new alarm reopens the widget. The display normally refreshes every ten seconds.
Alarm and reply history are held in memory and cleared on restart. Times use your
browser's local timezone. Reply history records the decision sent; an explicit
FF-Agent “no active incident” response is shown separately, not as the last decision.

In scenes, choose **Incident received** as the trigger and **Accept incident** or
**Decline incident** as actions. The trigger exposes only `received_at`, the
locally generated reception time; there are no incident filters or details.
Acceptance actions can override transport for that request. Leaving it empty uses
the configured default; widget buttons always use the default.

Both scene actions return `success`: `true` for HTTP 2xx, including an explicit
“no active incident” response, and `false` for invalid settings, HTTP errors or an
unconfirmed request. Scenes continue after `false`. This is an HTTP result, not
an operational confirmation, and must not be used for automatic retries.

To try the widget without an incoming webhook, use **Simulate incident** in
Configuration. **Check your scenes first:** simulation triggers the same scenes,
and response actions still send real requests.

## Troubleshooting

- **UUID error:** check that the reply field contains only your UUID, not a URL.
- **Acceptance cannot be sent:** check the selected house's coordinates and transport.
  Rejection does not need either setting.
- **Timeout or HTTP error:** check the outcome in FF-Agent before retrying. Requests
  time out after five seconds and are never retried automatically.
- **Missing alarms:** check the integration is running, the Plus webhook URL is
  current, and a test from FF-Agent reaches the widget. Delivery is not guaranteed;
  missed alarms are not replayed. Repeated POSTs are treated as separate alarms.
- **Logs:** use the integration's Logs view for a production container. During
  local development, application logs appear in the `npm run dev` terminal instead.

More documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md).

## Local development

Requires **Node.js 24+**, **Docker** (Docker Desktop on macOS) and a running local
Gladys instance. See the [Gladys development setup guides](https://gladysassistant.com/docs/dev/developing-a-service/#setting-up-a-development-environment)
for setting up Gladys itself.

```sh
git clone https://github.com/stefanbauer/gladys-ff-agent.git
cd gladys-ff-agent
npm ci
npm run dev:login
npm run dev
```

`dev:login` asks for a **local Gladys admin account**, not a Plus account. The
helper uses `http://localhost:1443` by default; for a different local address, set
`GLADYS_HOST_API_URL` in `.env` (see [.env.example](.env.example)). Only loopback
addresses are supported. The password is not saved; the local session is stored
in ignored `data/dev-session.json`. Run `dev:login` again if that session expires.

The helper installs or updates a local registration container and synchronizes
the SDK token automatically. The integration itself runs in your terminal with
hot reload. **Run only one SDK process per selector.** Gladys's Start/Stop controls
manage the registration container, not the terminal process.

- `npm start`: run without hot reload.
- `npm run dev:sync`: synchronize registration without starting the SDK; stop the
  development process before using it.
- Keep `.env` and `data/dev-session.json` private and out of version control.
- Reloading the integration clears its in-memory alarm and reply history.

Run checks before submitting changes:

```sh
npm run format:check
npm run lint
npm test
npx github:GladysAssistant/integration-store .
```

Tests use the SDK test environment and injected HTTP responses, not real FF-Agent
requests. For an unpublished candidate whose image does not exist yet, use the
validator's `--skip-image-check` option, then repeat the full check after publication.
The production `Dockerfile` packages the application itself; `Dockerfile.dev` is
only the idle registration container used by the local helper.

For container verification and publishing, see the [maintainer release guide](docs/releasing.md).
