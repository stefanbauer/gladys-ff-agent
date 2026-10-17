# Maintainer release guide

This guide covers production-container checks and publishing. For installation,
configuration and local development, see the [README](../README.md).

**Current status:** no release image is published. Store discovery is intentionally
disabled; leave the `gladys-assistant-integration` topic unset.

## 1. Check the release candidate

Use Node 24 and run:

```sh
npm run format:check
npm run lint
npm test
npx github:GladysAssistant/integration-store --skip-image-check .
```

Review the Unreleased changelog and confirm that package, lockfile, manifest
version and Docker image tag are aligned. Skipping the image check validates
metadata only; repeat without the flag after publishing.

Build and test both production variants locally without publishing:

```sh
for arch in arm64 amd64; do
  docker build --platform "linux/$arch" -t "gladys-ff-agent-release-check:$arch" .
  docker run --rm --platform "linux/$arch" --network none --read-only \
    --cap-drop ALL --security-opt no-new-privileges \
    --memory 256m --cpus 0.5 --pids-limit 100 \
    --mount "type=bind,src=$PWD/test,dst=/app/test,readonly" \
    "gladys-ff-agent-release-check:$arch" node --test test/app.test.js
done
```

These tests verify packaged code and dependencies using fake HTTP responses.
Separately test a production container against a local Gladys instance: connection,
configuration, widget, stop/start and logs. Use a dedicated test registration
without personal reply credentials or response scenes, and clean it up afterwards.
Never run two SDK clients for the same selector. Check the image contains no local
credentials and runs as non-root with a read-only rootfs and writable `/data`.

Real FF-Agent → Plus delivery and operational reply confirmation need separate
manual verification. Do not substitute HTTP success for either result.

## 2. Publish a version

Publishing changes remote state; run these steps only for an approved release.

In GitHub **Actions → Release → Run workflow**, select the version bump. The
workflow:

1. Prepares matching package/lockfile/manifest versions and the image reference.
2. Moves the Unreleased changelog entries into the release version.
3. Pushes the release commit and annotated `X.Y.Z` tag atomically to `main`.
4. Validates the tag and metadata, then runs CI against that exact commit.
5. Only after CI passes, publishes `linux/amd64` and `linux/arm64` images with
   version and `latest` tags.
6. Only after image publication succeeds, creates the GitHub Release using the
   changelog notes.

Run it from `main`. Use `initial` for the first release: it keeps the current
`1.0.0` and is rejected once a version tag exists. Afterwards choose:

- **patch** for compatible fixes, e.g. `1.0.0` → `1.0.1`;
- **minor** for compatible features, e.g. `1.0.1` → `1.1.0`;
- **major** for incompatible changes, e.g. `1.1.0` → `2.0.0`.

The maintainer chooses the release type; the workflow does not infer it from
commits. It calculates the next version from `package.json` using `npm version`,
then synchronizes the lockfile, manifest `version` and `docker_image`. Git tags,
GitHub Release titles and image version tags use the bare number, e.g. `1.0.1`,
without a `v` prefix. No separate manual manifest update or tag creation is needed
when using the manual Release workflow.

Normal commits only add entries to Unreleased; they do not bump versions or
publish anything. Group changes into a release when they are ready for users.
The workflow needs `contents: write`, `packages: write`, and branch rules that
permit its push.

Alternatively, prepare all metadata and changelog locally, commit it to `main`
and push its `X.Y.Z` tag. This starts the same validation → CI → image → GitHub
Release pipeline, without a second version bump. Only stable versions are
supported. A tag with mismatched metadata fails before image publication.

Normal **CI** never publishes. The image and GitHub Release workflows can only
be called by another workflow; they have no independent manual/tag entry point.
The manual Release workflow continues its own pipeline after pushing its tag:
GitHub does not start another workflow for tags pushed with `GITHUB_TOKEN`.

If checks or publication fail after the tag was pushed, inspect the failure and
rerun failed jobs once the cause is resolved. Do not overwrite the tag or rerun
all jobs to create the same version again. Code fixes need a new commit and
version; an existing version always refers to the same source commit.

## 3. Make the image installable

After the first upload, open **GitHub profile → Packages → gladys-ff-agent →
Package settings → Danger Zone → Change visibility → Public**, then confirm the
package name. New personal GHCR packages default to private, independently of the
repository's visibility. **GitHub does not allow public packages to become private
again.** The image's source-repository label links it to this repository but does
not make it public.

Verify the exact image reference in the manifest is anonymously pullable, using
an empty temporary Docker client configuration rather than saved registry
credentials. Inspect its remote image index for both architectures. Then run:

```sh
npx github:GladysAssistant/integration-store .
```

Install from `https://github.com/stefanbauer/gladys-ff-agent` on a controlled Gladys
instance and check startup, configuration and the widget. This requires a public
repository and public image, but **no discovery topic**. Update the README's
availability notice when the release is actually installable.

## 4. Optional store listing

Keep this step disabled until catalog discovery is separately approved. Adding
the repository **topic** `gladys-assistant-integration` enables automatic discovery.
The indexer normally runs hourly; no maintainer PR or manual review is required.
Check its rejection report if the integration does not appear.

The store requires a valid root manifest, an anonymously pullable image and
`docs/en.md` / `docs/fr.md` with at least 300 characters each. An optional cover
must be a direct HTTPS JPEG/PNG, 800 × 534 pixels and under 150 KB.

## References

- [Gladys external integration publication](https://gladysassistant.com/docs/dev/external-integrations/)
- [GitHub package visibility](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#configuring-visibility-of-packages-for-your-personal-account)
