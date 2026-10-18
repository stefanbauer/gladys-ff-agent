# Changelog

Changes to FF-Agent for Gladys Assistant.

## [Unreleased]

### Changed

- Send widget accept and decline responses immediately on click, without a browser confirmation dialog.
- Record the sent decision in reply history separately from FF-Agent's no-active-incident response, and remove redundant HTTP-success text from the widget.
- Display reception and reply times in the browser's local timezone through Gladys's native date rendering, instead of fixed UTC strings.
- Document installation from the GitHub repository URL using the published public images.

## [1.0.0] - 2026-10-18

### Changed

- Release only on explicit version tags without a `v` prefix or a manual release request, with an initial-version option, matching metadata checks and CI on the exact release commit before publishing multi-architecture images and the GitHub Release.
- Rewrite the README in English around setup, daily use, troubleshooting and local development; keep publishing instructions in a separate maintainer guide.
- Use matching blue primary buttons for widget acceptance and rejection, retaining distinct check and X icons.
- Redesign the incident widget around idle, open alarm and sent acceptance states, with a local End incident button instead of a countdown, immediate dismissal after rejection/no-active-incident responses, retained last-reply history and protection against concurrent response clicks. Errors keep alarms open; no operational confirmation is implied. Label the reply time clearly and remove the operational verification prompt in all languages.
- Send reply validation and HTTP error messages as separate English, French and German translations, selected by Gladys rather than displayed together.
- Clarify in all three languages that replies and local simulation need no Plus/Open API key; only incoming FF-Agent webhook alarms require them.
- Show a clear reply UUID check hint for FF-Agent's observed URL error, without technical provider wording or assumptions about what the UUID identifies.
- Remove the redundant webhook URL action; use the native Gladys Plus Webhooks card and concise multilingual FF-Agent setup instructions in Configuration.
- Remove the separate reply settings check action; acceptance and rejection already validate their required settings before sending and evaluate HTTP results.
- Replace the static development warning in the connection status with a clear connected message in English, French and German; per-request result messages remain unchanged.
- Clarify in English, French and German that FF-Agent's HTTP 200 response without a matching active incident means the request succeeded and no incident is currently active.
- Remove incident details, simulation variables and category filters for privacy; scenes receive only a locally generated reception timestamp.
- Simplify reply scene outputs to a single HTTP success boolean, including false for failed or unconfirmed requests.
- Allow an optional per-acceptance transport override in scene and configuration actions, falling back to the unchanged configured default.

### Added

- Release preparation runbook covering GitHub-URL installation without store discovery, GHCR visibility and supported container platforms; CI now runs application tests inside the production image with networking disabled and sandbox limits.
- Source repository metadata on published container images to link the GHCR package to its GitHub repository without changing package visibility.
- Privacy-safe diagnostic logs for alarm reception, event publication, reply attempts and HTTP/network outcomes; document local-terminal versus production-container logs and the supervision Start button.
- Native Gladys Plus alarm webhook (POST JSON `{}`), ignoring payload details and generating only a local reception timestamp.
- Concise configuration and FF-Agent webhook setup texts in English, French and German.
- Multilingual reply UUID guidance with the FF-Agent profile location and an anonymized URL example.
- Provider scaffold based on the official JavaScript template and SDK.
- Synthetic incident scene trigger, real no-ID response actions, and a dashboard widget.
- Safe local Node hot-reload development against Gladys with a Docker registration image.
- English, French and German user documentation, tests, and prepared build/release workflows.
- Visible, editable reply UUID, CAR/BICYCLE/FEET choices and a Gladys house picker with validation before sending.
- Documented Plus webhook architecture and local authenticated REST simulation, without linking production Plus.
- Automatic local registration updates on dev startup and manifest changes, preserving config and scene references.
- Multilingual webhook setup guidance directly in the Gladys configuration, mapping FF-Agent form fields.
- Real accept/reject HTTP requests with five-second timeout, no automatic retries or redirects, and explicit distinction between HTTP delivery and FF-Agent confirmation.
- Recognizes the observed FF-Agent HTTP 200 message for no matching active incident instead of reporting acceptance or rejection.
- Repository-root 800×534 JPEG cover with the FF-Agent logo and wordmark on a seamless edge-to-edge red gradient, with a GitHub raw-image manifest reference prepared for publication.

[Unreleased]: https://github.com/stefanbauer/gladys-ff-agent/compare/1.0.0...HEAD
[1.0.0]: https://github.com/stefanbauer/gladys-ff-agent/releases/tag/1.0.0
