# @domandigital/graph

Schema.org entity-graph builders for Doman Digital client sites: a stable
`@id` vocabulary, node builders for the common entity kinds (Organization,
WebSite, Person, Place, Service, Article, FAQPage, BreadcrumbList, ItemList,
OfferCatalog), and a validator that catches unresolved `@id` references and
duplicate `@id`s before they ship.

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

Not published to npm. Consumed as a git dependency pinned to a tag:

```json
{
  "dependencies": {
    "@domandigital/graph": "github:Doman-Digital/dd-graph#v0.1.1"
  }
}
```

`dist/` is committed to this repo (no CI build step runs on a git-dependency
install), so no build step is required in the consuming project beyond a
normal `pnpm install`.

### Known gotcha: Vitest + pnpm git dependencies

If a consuming project uses Vitest and a test imports a real value (not just
a type) from this package, add `resolve.preserveSymlinks: true` to
`vitest.config.ts`:

```ts
export default defineConfig({
  resolve: { preserveSymlinks: true },
  // ...
});
```

Why: pnpm names this package's virtual-store folder with the git commit
after a literal `#` (`@domandigital+graph@git+https+++...#<commit>`).
Vite/vite-node's realpath-to-file-URL resolution treats that `#` as a URL
fragment delimiter and truncates the path there, so it can never find the
module -- even though plain Node ESM and Next's own webpack/Turbopack
bundler resolve the same package fine. `preserveSymlinks` stops Vite from
ever following the `node_modules/@domandigital/graph` symlink into that
`#`-containing real path. Both `dd-templates` and `RMP-Electrical` hit this;
RMP's tests import `createGraphIds` directly and needed the fix, while
dd-templates' tests currently only import types (erased at compile time) so
it didn't surface there -- but the fix is in both configs regardless.

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
pnpm test        # vitest
pnpm typecheck    # tsc --noEmit
pnpm build        # tsup -> dist/ (commit the result)
```

## Versioning

Tag-based, not npm-published. Bump `version` in `package.json`, rebuild
`dist/`, commit, and tag (`git tag vX.Y.Z && git push --tags`). Consumers pin
to a tag in their `package.json`, never to a branch.
