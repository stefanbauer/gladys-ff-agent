# FF-Agent integration guidance

This is an independent Gladys Assistant external `provider` integration using
the official JavaScript SDK. Node 24+, ESM, no transpilation. Gladys core lives
in the sibling `../gladys` repository: do not change it to implement this integration.

## Scope and safety

- Reply actions use the user-supplied FF-Agent accept/reject links and send real
  requests. Never execute these against a real personal UUID during automated
  verification. Inject the HTTP boundary in tests; do not invent provider APIs.
- Never log or commit credentials, actual incident payloads or personal data.
  Local SDK tokens belong in ignored `.env`; dev helper writes it with mode 600.
- The reply UUID is intentionally a visible, editable string, not a secret field.
  Do not commit a real value. Test alarms are synthetic, but can trigger real
  reply actions. Mark them clearly. HTTP delivery is not provider confirmation.
- `index.js` only bootstraps the SDK. `src/app.js` registers testable handlers;
  `src/ff-agent.js` owns the HTTP transport, separate from Gladys UI code.
- Stable manifest keys are persisted by Gladys. Preserve published trigger,
  action and widget keys. Texts are multilingual (`en`, `fr`, `de`).
- Alarm triggers carry only locally generated `received_at`, with no filters or
  FF-Agent incident details. Reply scenes expose only HTTP `success`, not proof
  of an operational response. Optional transport overrides never change saved config.
- Incoming `incident` webhooks accept POST as an alarm signal and ignore the body.
  Use native `getWebhooks()` for URLs; never duplicate the reserved Plus key config.
  HTTP 200 from the relay is not proof of delivery. No deduplication without event IDs.
- The production container has a read-only rootfs. Write only to `/data`.
  Alarm and last-reply state are intentionally in memory, not production persistence.
  Successful rejection/no-active-incident replies clear the local alarm display;
  acceptance stays visible until the local End incident button is used, then history only.
  Ending only resets the display and never sends an FF-Agent request.
  New alarms always reopen the widget; old or concurrent clicks cannot dismiss them.
- One active SDK client per selector. `Dockerfile.dev` is an idle registration
  container, never a production image. Follow README for local development.
- Do not start or configure orbs. Development uses the local Mac and Docker Desktop.

## Verification and releases

Develop directly on `main` for this integration: the user works on one task at a
time and does not want routine feature branches or extra worktrees. Preserve and
inspect existing changes when continuing in a new thread. Separate branches or
worktrees are only needed if the user later requests parallel development.

Run `npm run format`, `npm run format:check`, `npm run lint`, `npm test`,
and `npx github:GladysAssistant/integration-store --skip-image-check .`.
Tests use `@gladysassistant/integration-sdk/testing` and no external network.
Inspect widgets rendered in real Gladys when changing their content.

Add user-visible changes to `CHANGELOG.md` under Unreleased. Versions are managed
by the retained Release workflow; keep package, lockfile, manifest and image tag
aligned. The source repository is public, but has no public image or catalog entry.
The user explicitly forbids a Gladys Store listing at this stage. Never add the
`gladys-assistant-integration` GitHub topic: it opts a public repository into indexing.
Publishing an image, creating a release, pushing release tags, or enabling catalog
discovery needs separate explicit user authorization. Normal CI only builds, never pushes images.
