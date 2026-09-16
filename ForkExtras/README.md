# ClientRuleSet fork extensions

This fork keeps upstream `SukkaW/Surge` source/build code as clean as possible and puts fork-specific behavior under `ForkExtras/`.

## Build model

```text
SukkaW/Surge upstream
       ↓ every 6 hours / manual safe sync
this fork master
       ↓ build-input fingerprint + latest stable compiler check
       ↓ pnpm build
standard upstream outputs
       ↓ ForkExtras client adapters
       ↓ strict SRS/MRS verification
       ↓ manifest + SHA-256 integrity files
client-facing Release outputs
       ↓
rules-dist
```

Fork-only source rules can live under `ForkExtras/Source/domainset/`, `ForkExtras/Source/non_ip/`, and `ForkExtras/Source/ip/`; they are overlaid only inside the Actions runner. The build fails before overlay if a fork-only file would overwrite an upstream `Source/` file with the same relative path.

## Build reproducibility and compiler policy

The build planner fingerprints tracked build inputs (`Build/`, `Source/`, the executable/configuration parts of `ForkExtras/`, and Node/pnpm/TypeScript build configuration) instead of rebuilding for documentation-only commits. A rebuild is required when the fingerprint changes, when the latest stable sing-box or Mihomo release changes, or when a manual `force_rebuild` is requested.

SRS and MRS compilers are intentionally **not pinned to a fixed application version**. Every build queries GitHub's latest stable release endpoints (authenticated with the workflow `GITHUB_TOKEN`), resolves explicit sing-box and Mihomo release tags, pulls those exact container tags, verifies the binaries report the expected versions, and records both image tags and resolved image digests in `rules-dist/BUILD-METADATA.json`.

The source commit used for a build is immutable: the build job checks out the exact commit SHA selected by the planner rather than re-reading a moving `master` branch.

GitHub Actions themselves are pinned to immutable commit SHAs for supply-chain safety. `.github/dependabot.yml` checks for GitHub Actions updates weekly and can update those pins.

Published integrity metadata includes:

- `BUILD-METADATA.json`: source/upstream SHAs, build-input fingerprint, compiler releases/digests, and adapter summaries.
- `MANIFEST.json`: SHA-256 and byte size for every payload file.
- `SHA256SUMS`: release-wide checksums, verified again in the publish job before `rules-dist` is updated.
- `FILES.txt`: deterministic file index.

The release also compares SRS/MRS counts with the previous successful build. A moderate drop emits a warning; a severe drop blocks publication so a generator regression cannot silently replace a healthy release with a much smaller one.

## Sync credentials

Upstream synchronization currently uses the repository secret `SYNC_TOKEN`, a fine-grained PAT limited to this repository with the minimum permissions required to update `master` when an upstream merge contains workflow changes. Ordinary `push` builds do not receive this token.

For a long-lived non-personal credential, the same sync step can later be migrated to a GitHub App installation token. That migration requires creating a GitHub App in the account/organization and supplying its App ID and private key as repository secrets; the build workflow is otherwise structured so only the sync job needs that credential.

## Dynamic clients

`ForkExtras/clients.yml` controls enabled outputs. Adapter implementations live under `ForkExtras/Clients/adapters/`.

Current configuration supports Surge, Clash/Mihomo, sing-box, Shadowrocket, Quantumult X, Surfboard, and Legacy Clash Premium. New clients require a config entry plus an adapter, not edits to upstream `Build/`.

Published client-facing directories include `Surge/`, `Clash/Release/`, `sing-box/Release/`, `Shadowrocket/Release/`, and `QuantumultX/Release/`.

Clash Release prefers MRS only when conversion is lossless. sing-box Release requires successful SRS compilation in strict automated releases. Quantumult X writes unsupported rule semantics to adjacent `*.unsupported.txt` files instead of silently discarding them.

## Mobile configuration guardrails

When generating configuration files for mobile clients (especially iOS/tvOS Network Extension clients and Android clients), **do not automatically enable every ruleset merely because it exists in `rules-dist`**.

The upstream SukkaW README states that the large advertising / privacy / malware / phishing blocking rules are only recommended for Surge on macOS, and recommends dedicated blocking tools on mobile for better performance. Therefore the following rulesets are **mobile opt-in only** and must not be added to generated mobile configurations unless the user explicitly asks for them:

- `reject_domainset` (`domainset/reject`): large base blocking domain set.
- `reject_extra_domainset` (`domainset/reject_extra`): large supplementary blocking domain set; upstream also warns that enabling it together with the base set increases memory usage and matching cost on Clash/Mihomo.
- `reject_phishing` (`domainset/reject_phishing`): very large phishing-domain set.
- `reject-url-regex` (`non_ip/reject-url-regex`): requires MITM/URL-REGEX semantics and has high runtime overhead.

For mobile configuration generation, the normal smaller reject rules such as `reject_non_ip_drop`, `reject_non_ip`, `reject_non_ip_no_drop`, and `reject_ip` are **not covered by the exclusion above** and may remain enabled when appropriate.

**Generation rule:** future mobile config updates must preserve this opt-in policy. Do not re-add the four heavy rules above during ruleset synchronization, regeneration, or "use all latest rules" operations unless the user explicitly overrides this guardrail.
