# Architecture principles: structured data at Doman Digital

This is the gold standard for how schema.org structured data gets built
across every Doman Digital and IDS property, client-managed or bespoke. It
exists because the alternative was proven, by audit, to be the default: 8 of
13 client repos independently reinvented JSON-LD and shipped disconnected
schema islands with no `@id` linking. Read this before touching structured
data on any client site, and follow it on every new one.

## The rule

**All schema.org JSON-LD goes through `@domandigital/graph`. No repo
hand-rolls its own `ids.ts` / node builders / `<script>` emitter again.**

If you're looking at a client repo with hand-written JSON-LD that predates
this package, port it — don't extend the hand-written version. If you're
starting a new client site, wire this in on day one, not "after launch, once
SEO comes up."

## The eight things that actually matter

1. **Every relation is a reference, never a nested literal.** `provider`,
   `worksFor`, `publisher`, `isPartOf`, `founder` must be `{'@id': ...}`. This
   was the single most common defect across the portfolio: a `Service` whose
   `provider` was a hand-typed `{'@type': 'LocalBusiness', name, url}`
   literal that silently drifted from the real Organization node the moment
   either one got edited.

2. **One `<script>` tag per page, one `@graph`.** Not N sibling scripts.
   Every node that page needs — spine plus page-specific — goes in one
   `buildGraph([...])` call.

3. **Self-contained per page.** Every `@id` a page's graph references must
   resolve to a node included in that *same* graph. Don't rely on the layout
   or another route to have supplied the node. Repeating the Organization
   node per page costs about 1KB and is standard practice, not a wasteful
   duplication to "optimize away."

4. **`findGraphIssues(graph)` must run somewhere your CI actually executes,
   against the graph a real page builds** — not just unit tests of the
   adapter functions that feed it. This is the current gap in both
   `dd-templates` and `RMP-Electrical`: their local tests cover the
   CMS-shape adapters (`site-adapter.ts`, `business-types.ts`) but nothing
   yet builds an actual page's graph and asserts it's clean end-to-end. Close
   this the next time either repo is touched substantially — extract each
   page's graph-construction into a pure function of `(data, ids) => graph`
   that a component calls, so it's testable without spinning up Next's
   request lifecycle.

5. **Root-anchored, path-independent `@id`s.** `${siteUrl}/#kind-slug`, not
   built from the entity's own route. `@id` only has to be a stable
   identifier; making it path-independent is what let two sites with
   completely different routing (`/service-areas/` + `/blog/` vs
   `/electrician/` + `/guides/`) consume the identical package with zero
   configuration. Don't special-case a consumer's routing back into the
   package — if a third site's routing doesn't fit, that's a sign the
   id scheme needs to stay generic, not that the specific site needs an
   escape hatch.

6. **Domain-specific logic stays in the consumer, never in the package.**
   Niche-to-schema.org-type mapping, CMS-shape adapters
   (`SiteSettings` → `OrganizationInput`), and rating-provenance gating
   (whether you're even allowed to emit an `aggregateRating` is a compliance
   question, not a graph-shape one) are all consumer-side glue. The package
   only knows generic node shapes. If you're tempted to add an `if
   (niche === 'salon')` branch inside `@domandigital/graph`, stop — that
   belongs in the consumer's own `lib/graph/business-types.ts`.

7. **New entity kinds get added to the package, not copy-pasted locally.** If
   a third consumer needs a node type this package doesn't have yet (a
   `Product`, a `Review`), add it here, write a test, bump the version, and
   update the consumer. Don't reimplement `buildProduct` locally "just this
   once" — that's exactly how the portfolio ended up with N divergent
   `breadcrumbSchema` implementations under 4 different names before this
   package existed.

8. **Version discipline: semver on npm, published from a tag, never a branch.**
   Consumers use a normal semver range against the registry
   (`"@domandigital/graph": "^0.5.1"`). Bump the version on any type change that
   could break a consumer at compile time. The `v0.1.0` to `v0.1.1` null/undefined
   fix surfaced as real compile errors in `dd-templates` within minutes of
   wiring it up, which is the system working as intended, not a failure of
   planning.

   Pushing a `vX.Y.Z` tag triggers the release workflow, which checks the tag
   against `package.json`, then tests, builds and publishes via npm trusted
   publishing. No npm token is stored anywhere, and every release carries a
   provenance attestation.

   *Superseded, kept for context:* until 2026-08-16 these were git dependencies
   pinned to a tag, and `dist/` was committed because a git-dependency install
   runs no build step. CI builds now, so a committed `dist/` is only a second
   source of truth waiting to go stale. Removing it is tracked separately.

## The seam with `@domandigital/seo`

A sibling package, `@domandigital/seo`, owns the route-tree facts: which pages
exist, what each targets, how pages relate to each other, what belongs in the
sitemap. This package owns none of that — it only knows how to turn entity
facts into valid, connected JSON-LD.

**Neither package depends on the other.** A dependency between them would
force every consumer onto matching versions of both for any change to either,
across 15+ repos. Instead the consuming repo composes them at the call site:

```ts
// @domandigital/seo owns the route facts. `labels` is the consumer's own
// path -> label registry; the trail is derived from it.
const trail = getBreadcrumbTrail(labels, path);

// @domandigital/graph owns node shape and @id discipline.
const crumbs = buildBreadcrumbs(
  trail.map((t) => ({ name: t.label, url: `${siteUrl}${t.path}` })),
  ids.breadcrumb(path),
);
```

The one touchpoint is breadcrumbs, because a `BreadcrumbList` node is the one
JSON-LD shape that structurally requires knowing the route tree. `seo` owns
`getBreadcrumbTrail` because it owns the route tree; `graph` owns
`buildBreadcrumbs` because it owns node shape and `@id` discipline. Neither
package reaches into the other's territory: `graph` never grows a route model
of its own (don't derive a trail from `usePathname()` inside this package or
any consumer's copy of it — take it from `seo`), and `seo` never grows a
JSON-LD emitter (a "generate schema.org breadcrumbs" helper inside `seo`
would be principle 6's `if (niche === 'salon')` mistake, just at the
package-boundary level instead of inside a single consumer).

If a second touchpoint like this turns up, resist folding it into either
package by default — decide again, on its own merits, which side of the
facts/emission line it falls on.

## When you're porting a new client repo onto this package

Read `README.md` first for the API. Then:

- Find every hand-written JSON-LD generator and inventory what it currently
  emits before touching anything — you need to know what you're not allowed
  to regress (a rating gated behind an env var for compliance reasons, a
  `speakable` block, whatever's already there for a real reason).
- Map the site's `SiteSettings`-equivalent onto `OrganizationInput` in a
  local `lib/graph/site-adapter.ts` — see `dd-templates` or
  `RMP-Electrical` for the pattern.
- Convert every existing flat "areaServed as strings" or "provider as a
  literal" into `@id` refs against nodes actually included in the graph.
- Run `findGraphIssues` against representative fixture data before calling
  it done, not just "it typechecks."
- Update this document if you learn something that changes principle 1–8 —
  don't let it go stale while the portfolio evolves around it.
