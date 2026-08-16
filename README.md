> **This repo is archived.** `@domandigital/graph` now lives in the
> [dd-packages](https://github.com/Doman-Digital/dd-packages) monorepo, at
> [`packages/graph`](https://github.com/Doman-Digital/dd-packages/tree/main/packages/graph).
> Open issues and PRs there. This repo's history was preserved via subtree
> merge; its own commits and tags stay here for reference.

# @domandigital/graph

Schema.org entity-graph builders for Doman Digital client sites: a stable
`@id` vocabulary, node builders for the common entity kinds (Organization,
WebSite, Person, Place, Service, Article, FAQPage, BreadcrumbList, ItemList,
OfferCatalog), and a validator that catches unresolved `@id` references and
duplicate `@id`s before they ship.

**Read [PRINCIPLES.md](PRINCIPLES.md) before wiring this into a new repo or
extending it.** This README is the API reference; PRINCIPLES.md is the
long-term contract that keeps the portfolio from drifting back into
disconnected schema islands.

## Why this exists

Across the portfolio, structured data was reimplemented per repo. The
recurring defect: `provider` / `worksFor` / `publisher` nested as literal
objects instead of `{'@id': ...}` references, so a page's Service and the
sitewide Organization it belongs to are disconnected in the eyes of anything
parsing the graph. This package makes the connected version the default, and
adds a check (`findGraphIssues`) that fails loudly when a ref doesn't
resolve or two nodes collide on one `@id` -- the two failure modes hand-written
JSON-LD kept shipping.

Proven in production shape against two differently-structured sites before
extraction: `dd-templates` (multi-niche template, per-author Person nodes,
`/service-areas/` + `/blog/` routing) and `RMP-Electrical` (single business,
one founder, `/electrician/` + `/guides/` routing). Both consume this package
with zero routing configuration -- every `@id` is root-anchored
(`${siteUrl}/#kind-slug`), not built from the entity's own page path.

## Install

```bash
pnpm add @domandigital/graph
```

Public on npm, Apache-2.0, published with provenance from a tagged release.
ESM and CJS builds ship together, each with its own types, so it works under
both `import` and `require`. Requires Node 20 or newer.

Earlier versions were consumed as a git dependency pinned to a tag. If you're
upgrading a repo that still does that, replace the
`github:Doman-Digital/dd-graph#vX.Y.Z` specifier with a normal semver range.
You can also drop `resolve.preserveSymlinks: true` from `vitest.config.ts` if
it was added for this package: that worked around pnpm putting a literal `#`
in the git dependency's virtual-store path, which Vite truncated as a URL
fragment. Registry installs have no `#` in the path, so the workaround is
dead weight now.

## Usage

```ts
import { createGraphIds, buildSpine, buildService, buildGraph, findGraphIssues } from "@domandigital/graph";

const ids = createGraphIds(siteUrl);

const graph = buildGraph([
  ...buildSpine(
    { name: "Acme Electrical", description: "...", url: siteUrl },
    { name: "Acme Electrical", url: siteUrl },
    ids,
    "Electrician",
  ),
  buildService({ name: "Rewiring", slug: "rewiring", url: `${siteUrl}/services/rewiring` }, ids),
]);

// In CI or a test: fail the build if the graph doesn't resolve.
const issues = findGraphIssues(graph);
if (issues.length > 0) throw new Error(issues.join("\n"));
```

Render `graph` as a single `<script type="application/ld+json">` per page.
This package doesn't ship a React/Next component for that -- emission
strategy (`next/script` vs a plain `<script>`) is a per-site choice -- but
does export `escapeJsonLdForScript(json)` so CMS-authored strings (a
testimonial quote, an FAQ answer) can't break out of the script tag:

```tsx
import { escapeJsonLdForScript } from "@domandigital/graph";

export function JsonLdScript({ graph }: { graph: JsonLdGraph }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonLdForScript(JSON.stringify(graph)) }}
    />
  );
}
```

## What stays in the consumer

- Niche/business-type mapping (e.g. "salon" → `['BeautySalon', 'HealthAndBeautyBusiness', 'LocalBusiness']`).
- CMS-shape adapters (mapping your Sanity/CMS document shape onto `OrganizationInput` etc).
- `aggregateRating` provenance/gating logic -- whether you're allowed to emit a rating at all is a compliance decision, not a graph-shape one.
- The actual `<script>` emission component.

## Development

```bash
pnpm install
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit
pnpm build        # tsup -> dist/
```

CI runs all three on every push and pull request, across Node 20, 22 and 24.

## Versioning

Semver, published to npm on tag push. Bump `version` in `package.json`, commit,
then tag (`git tag vX.Y.Z && git push --tags`). The release workflow checks the
tag against `package.json` and refuses to publish if they disagree, then builds
and publishes via npm trusted publishing, so no npm token is stored anywhere and
every release carries a provenance attestation.

Consumers use a normal semver range. Because this is still `0.x`, a minor bump
can carry a type change that surfaces as a compile error in a consumer, which is
the system working: the `v0.1.0` to `v0.1.1` null/undefined fix did exactly that
within minutes of being wired up.
