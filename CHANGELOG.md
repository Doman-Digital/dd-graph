# Changelog

All notable changes to `@domandigital/graph`.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

While the package is `0.x`, a minor bump can carry a type change that surfaces
as a compile error in a consumer. That's intended: the input types are the
contract, and a compile error at upgrade time beats a silently malformed graph
in production.

Releases before 0.5.2 were consumed as git dependencies pinned to a tag. This
file was written retroactively from that tag history, so entries below 0.5.2
describe what shipped rather than what was recorded at the time.

## [Unreleased]

### Added

- `./package.json` is now exposed in the `exports` map. Tooling that reads a
  dependency's manifest (bundler plugins, version probes) previously hit
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- CI on every push and pull request: typecheck, test and build across Node 20,
  22 and 24. Previously the only workflow was the tag-triggered release, so
  nothing checked a commit before it merged.

### Changed

- `engines.node` raised from `>=18` to `>=20`. Node 18 reached end of life in
  April 2025, and the previous range was never exercised by anything.
- README rewritten for npm distribution. The install section still described the
  package as unpublished and documented a `resolve.preserveSymlinks` workaround
  that only ever applied to pnpm git dependencies.

## [0.5.1] - 2026-08-16

### Changed

- Licensed Apache-2.0, with publish metadata (repository, homepage, bugs) and
  `publishConfig` for public access and provenance. First version published to
  the npm registry.

## [0.5.0] - 2026-07-30

### Added

- `ReviewInput.reply` and `ReviewInput.datePublished`. A business's reply to a
  review is emitted as a `Comment` attributed to the sitewide Organization by
  `@id`, using the standard `comment` property `Review` inherits from
  `CreativeWork`. Pairs with `@domandigital/gbp`'s review fetch.

## [0.4.4] - 2026-07-30

### Added

- `WebsiteInput.speakable`, for voice assistants.

## [0.4.3] - 2026-07-30

### Added

- `OrganizationInput.hasMap`, `paymentAccepted` and `currenciesAccepted`.

### Changed

- `OrganizationInput.areaServed` accepts a string array as well as a single
  string. An array emits anonymous `{'@type': 'City', name}` literals, for a
  business that names several towns without modelling each as its own linked
  `Place` node.

## [0.4.2] - 2026-07-29

### Added

- `WebsiteInput.inLanguage`.
- `ProductInput.offers.sellerId`, an `@id` ref to the selling Organization.
  Without it, consumers fell back to a disconnected `Organization` literal,
  which is the exact island defect this package exists to prevent.
- Test coverage for `escapeJsonLdForScript`.

## [0.4.1] - 2026-07-29

### Added

- `ContactPoint.areaServed` and `ContactPoint.availableLanguage`.

## [0.4.0] - 2026-07-29

### Added

- `buildSoftwareApplication` and `SoftwareApplicationInput`, for a SaaS
  product's own marketing site. Reuses the `product` `@id` namespace rather than
  adding a fourth id kind.

## [0.3.3] - 2026-07-29

### Added

- `WebsiteInput.description`.

## [0.3.2] - 2026-07-29

### Added

- `WebsiteInput.potentialAction`, parameterised by `@type` so one field covers a
  booking `ReserveAction`, a site `SearchAction`, or any other.
- `OrganizationInput.areaServedGeoCircle`, a service radius for a mobile or
  local-radius business with no fixed set of named areas.

## [0.3.1] - 2026-07-29

### Fixed

- `BreadcrumbItem.url` is now optional, matching schema.org's own
  `BreadcrumbList` spec. Google's guidance is to omit the URL for the current
  page and for any crumb with no navigable URL, rather than pointing structured
  data at something that doesn't resolve.

## [0.3.0] - 2026-07-29

### Added

- `buildProduct` and `ProductInput`, including `UnitPriceSpecification` for
  day-rate style pricing. Omitting `offers` entirely is supported, for a
  rate-on-application product where a fabricated price would be invalid
  structured data.
- `OrganizationInput.areaServed` as free text.
- `ids.product(slug)`.

## [0.2.7] - 2026-07-29

### Added

- `PersonInput.hasOfferCatalog`, for an independent practitioner whose own
  services belong on their `Person` node rather than the Organization's.

## [0.2.6] - 2026-07-29

### Fixed

- **`buildOrganization` emitted the wrong schema.org property names for
  addresses.** It wrote `locality`, `region` and `country`, where the
  `PostalAddress` vocabulary requires `addressLocality`, `addressRegion` and
  `addressCountry`. Parsers silently ignore unrecognised properties, so any
  graph built with an earlier version has been shipping an address that
  consumers of the JSON-LD could not read. The input field names are unchanged,
  so this is a drop-in upgrade.

  This is the one release in the 0.2.x to 0.5.x range that changes emitted
  output. If you're upgrading from below 0.2.6, expect the rendered JSON-LD to
  differ, correctly.

## [0.2.5] - 2026-07-29

### Added

- `OrganizationInput.foundingDate`.

### Changed

- `aggregateRating.ratingValue` and `reviewCount` accept a string as well as a
  number, so a source literal like `"5.0"` survives verbatim instead of being
  reformatted through JS number coercion.

## [0.2.4] - 2026-07-29

### Added

- `OrganizationInput.openingHours` as free text, distinct from the structured
  `openingHoursSpecification`, for a business with no machine-readable per-day
  hours to offer.

## [0.2.3] - 2026-07-29

### Added

- `OrganizationInput.alternateName`, a public-facing trading name distinct from
  `legalName`.

## [0.2.2] - 2026-07-28

### Added

- `OrganizationInput.identifiers`, emitted as `PropertyValue` rows for a
  Companies House number, a regulator registration and similar.

## [0.2.1] - 2026-07-28

### Added

- `PersonInput.sameAs`.
- `PersonInput.hasCredential`, emitted as
  `EducationalOccupationalCredential`. This is the correct shape for a regulator
  registration or professional-body membership, and is distinct from the weaker
  generic `identifier` shape the existing `credentials` field produces.

## [0.2.0] - 2026-07-28

### Added

- `buildWebPage`, `buildContactPage`, `buildCollectionPage` and `buildReview`,
  with their input types.
- `ids.webpage(path)`. Page identity nodes are inherently page-scoped, the same
  reasoning that already applied to `ids.breadcrumb`.

## [0.1.1] - 2026-07-28

### Changed

- Optional string-ish fields accept `null` as well as `undefined`. Sanity and
  most headless CMSes return unset fields as `null`, so requiring `undefined`
  forced a coercion at every call site. Falsy checks in the builders already
  treated both the same at runtime.

  This surfaced as real compile errors in a consumer within minutes of being
  wired up, which is the intended behaviour of a type-level contract.

## [0.1.0] - 2026-07-28

### Added

- Initial release. Stable root-anchored `@id` vocabulary (`createGraphIds`),
  node builders for Organization, WebSite, Person, Place, Service, Article,
  FAQPage, BreadcrumbList, ItemList and OfferCatalog, graph composition
  (`buildGraph`), `<script>`-safe escaping (`escapeJsonLdForScript`), and
  `findGraphIssues` to catch unresolved `@id` references and duplicate `@id`s
  before they ship.

[Unreleased]: https://github.com/Doman-Digital/dd-graph/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/Doman-Digital/dd-graph/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/Doman-Digital/dd-graph/compare/v0.4.4...v0.5.0
[0.4.4]: https://github.com/Doman-Digital/dd-graph/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/Doman-Digital/dd-graph/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/Doman-Digital/dd-graph/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/Doman-Digital/dd-graph/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Doman-Digital/dd-graph/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/Doman-Digital/dd-graph/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/Doman-Digital/dd-graph/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/Doman-Digital/dd-graph/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.7...v0.3.0
[0.2.7]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/Doman-Digital/dd-graph/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Doman-Digital/dd-graph/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Doman-Digital/dd-graph/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Doman-Digital/dd-graph/releases/tag/v0.1.0
