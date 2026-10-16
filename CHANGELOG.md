# Changelog

Changes to FF-Agent for Gladys Assistant. Nothing has been released yet.

## [Unreleased]

### Added

- Provider scaffold based on the official JavaScript template and SDK.
- Synthetic incident scene trigger, real no-ID response actions, and a dashboard widget.
- Safe local Node hot-reload development against Gladys with a Docker registration image.
- English, French and German user documentation, tests, and prepared build/release workflows.
- Visible, editable reply UUID, CAR/BICYCLE/FEET choices and a Gladys house picker with a no-send location check.
- Documented Plus webhook architecture and local authenticated REST simulation, without linking production Plus.
- Automatic local registration updates on dev startup and manifest changes, preserving config and scene references.
- Multilingual webhook setup guidance directly in the Gladys configuration, mapping FF-Agent form fields and clearly marking the URL and payload as pending.
- Real accept/reject HTTP requests with five-second timeout, no automatic retries or redirects, and explicit distinction between HTTP delivery and FF-Agent confirmation.
- Recognizes the observed FF-Agent HTTP 200 message for no matching active incident instead of reporting acceptance or rejection.
- Repository-root 800×534 JPEG cover with the FF-Agent logo and wordmark on a seamless edge-to-edge red gradient, with a GitHub raw-image manifest reference prepared for publication.

[Unreleased]: https://github.com/stefanbauer/gladys-ff-agent/commits/main
