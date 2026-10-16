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
- The production container has a read-only rootfs. Write only to `/data`.
  Current demo state is intentionally in memory, not production persistence.
- One active SDK client per selector. `Dockerfile.dev` is an idle registration
  container, never a production image. Follow README for local development.
- Do not start or configure orbs. Development uses the local Mac and Docker Desktop.

## Verification and releases

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
