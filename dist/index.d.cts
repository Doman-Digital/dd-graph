/**
 * Stable @id vocabulary for a sitewide schema.org entity graph.
 *
 * Every id is root-anchored (`${siteUrl}/#kind-slug`) rather than built from
 * the entity's own page path. Two consuming sites (dd-templates,
 * RMP-Electrical) route the same entity kinds through different paths --
 * `/services/`, `/electrician/`, `/guides/`, `/team/` vs no team route at
 * all -- and `@id` only has to be a stable identifier, not a resolvable URL.
 * Anchoring at the root removes routing configuration from this package
 * entirely: every consumer gets the same ids with zero setup.
 *
 * `breadcrumb` is the one exception: a BreadcrumbList is inherently
 * page-scoped (one per page), so incorporating the real path is meaningful,
 * not arbitrary.
 *
 * `org` and `website` keep the `#organization` / `#website` convention three
 * independent repos in the portfolio (Doman-Digital, sen-sphere,
 * RMP-Electrical) had already converged on before this package existed.
 */
declare function createGraphIds(siteUrl: string): {
    org: string;
    website: string;
    person: (slug: string) => string;
    service: (slug: string) => string;
    product: (slug: string) => string;
    place: (slug: string) => string;
    article: (slug: string) => string;
    breadcrumb: (path: string) => string;
    /** Page-identity nodes (WebPage/ContactPage/CollectionPage) are inherently
     * page-scoped, same reasoning as `breadcrumb`. */
    webpage: (path: string) => string;
};
type GraphIds = ReturnType<typeof createGraphIds>;

type JsonLdNode = Record<string, unknown>;
type JsonLdGraph = {
    "@context": "https://schema.org";
    "@graph": JsonLdNode[];
};
declare function buildGraph(nodes: Array<JsonLdNode | null | undefined>): JsonLdGraph;
/**
 * Validates a graph is self-contained: every `{'@id': X}` reference resolves
 * to a node with `@id: X` somewhere in the same `@graph`, and no two nodes
 * share an `@id`. Returns an empty array when the graph is clean.
 *
 * This is the check that catches the class of bug where `provider` /
 * `worksFor` / `publisher` drift into a nested literal instead of a real
 * reference, and the case of two differently-typed nodes accidentally
 * sharing one `@id` (which JSON-LD parsers merge into one contradictory
 * node).
 */
declare function findGraphIssues(graph: JsonLdGraph): string[];

type Nullable<T> = T | null | undefined;
type OrganizationInput = {
    name: string;
    legalName?: Nullable<string>;
    /** A distinct public-facing name the business also trades under (e.g. a
     * practitioner's personal brand) -- separate from `legalName`, which is
     * the registered entity name. */
    alternateName?: Nullable<string>;
    description: string;
    url: string;
    phone?: Nullable<string>;
    email?: Nullable<string>;
    /** A brand mark image. Distinct from `image` (general photography). */
    logoUrl?: Nullable<string>;
    image?: string[];
    address?: {
        streetAddress?: Nullable<string>;
        locality?: Nullable<string>;
        region?: Nullable<string>;
        postalCode?: Nullable<string>;
        country?: Nullable<string>;
    } | null;
    geo?: {
        latitude: string;
        longitude: string;
    } | null;
    priceRange?: Nullable<string>;
    /** Free-text schema.org `openingHours` (e.g. "Appointments only", or a
     * Mo-Fr/09:00-17:00-style string) -- distinct from the structured
     * `openingHoursSpecification` below. Use this when the business doesn't
     * have machine-readable per-day hours to offer. */
    openingHours?: Nullable<string>;
    /** Pre-shaped schema.org rows: one entry per group of days sharing hours.
     * Adapt your CMS's per-day shape to this before calling. */
    openingHoursSpecification?: Array<{
        dayOfWeek: string[];
        opens: string;
        closes: string;
    }>;
    /** @id refs to Place nodes elsewhere in the same graph. */
    areaServedIds?: string[];
    /** Free-text `areaServed` (e.g. a city name) -- use when the consumer
     * doesn't model service areas as their own Place nodes. Distinct from
     * `areaServedIds`; set at most one of the two. */
    areaServed?: Nullable<string>;
    /** A `GeoCircle` service radius (e.g. "we cover a 15km radius around
     * this point") -- a third `areaServed` representation, for a mobile/
     * local-radius business with no fixed set of named areas. Set at most
     * one of `areaServedIds` / `areaServed` / `areaServedGeoCircle`. */
    areaServedGeoCircle?: {
        latitude: number;
        longitude: number;
        radiusMeters: string;
    } | null;
    sameAs?: string[];
    /** Year (or full date) the business was founded, e.g. "2018". */
    foundingDate?: Nullable<string>;
    /** `number` for a computed/live value; `string` to preserve a source
     * literal's exact representation verbatim (e.g. a CMS or hand-written
     * value already typed as "5.0"/"411") rather than silently reformatting
     * it through JS number coercion. */
    aggregateRating?: {
        ratingValue: number | string;
        reviewCount: number | string;
    } | null;
    /** Pre-built OfferCatalog (see buildOfferCatalog), passed through as-is. */
    hasOfferCatalog?: Record<string, unknown>;
    /** @id ref to a Person node -- the founder/owner, if the business has one
     * canonical figurehead worth naming on the Organization itself. */
    founderId?: Nullable<string>;
    contactPoint?: Array<{
        contactType: string;
        email?: Nullable<string>;
        telephone?: Nullable<string>;
        areaServed?: Nullable<string>;
        availableLanguage?: string[];
    }>;
    /** Registry identifiers (Companies House number, a regulator registration,
     * etc.) as `PropertyValue` rows -- generic Organization data, not niche
     * mapping, so it stays in the package rather than a per-consumer literal. */
    identifiers?: Array<{
        propertyID: string;
        name?: Nullable<string>;
        value: string;
        url?: Nullable<string>;
    }>;
};
declare function buildOrganization(input: OrganizationInput, ids: GraphIds, types?: string | string[]): Record<string, unknown>;
type WebsiteInput = {
    name: string;
    url: string;
    description?: Nullable<string>;
    /** e.g. a booking ReserveAction or a site SearchAction -- schema.org's
     * generic WebSite.potentialAction shape, parameterized by @type so this
     * one field covers any of them rather than adding a new field per
     * action kind. */
    potentialAction?: {
        type: string;
        targetUrlTemplate: string;
        resultType?: Nullable<string>;
    } | null;
};
declare function buildWebsite(input: WebsiteInput, ids: GraphIds): Record<string, unknown>;
/** Convenience for the two nodes almost every page includes: Organization +
 * WebSite. A founder/team Person is deliberately NOT bundled here -- not
 * every business has one canonical figurehead -- add `buildPerson(...)`
 * alongside this in the consumer if it does. */
declare function buildSpine(organizationInput: OrganizationInput, websiteInput: WebsiteInput, ids: GraphIds, types?: string | string[]): [ReturnType<typeof buildOrganization>, ReturnType<typeof buildWebsite>];
type PersonInput = {
    name: string;
    slug: string;
    jobTitle?: Nullable<string>;
    description?: Nullable<string>;
    imageUrl?: Nullable<string>;
    sameAs?: string[];
    credentials?: Array<{
        label: string;
        number?: Nullable<string>;
        url?: Nullable<string>;
    }>;
    /** Professional credentials as `EducationalOccupationalCredential` -- the
     * correct schema.org shape for a regulator registration, professional-body
     * membership, or qualification (distinct from `credentials` above, which
     * emits the weaker generic `identifier`/`PropertyValue` shape). */
    hasCredential?: Array<{
        category: string;
        name: string;
        identifier?: Nullable<string>;
        url?: Nullable<string>;
    }>;
    /** Pre-built OfferCatalog (see buildOfferCatalog), passed through as-is --
     * for an independent practitioner whose own services are worth listing on
     * their Person node, distinct from the Organization they work for. */
    hasOfferCatalog?: Record<string, unknown>;
};
declare function buildPerson(input: PersonInput, ids: GraphIds): Record<string, unknown>;
type PlaceInput = {
    name: string;
    slug: string;
    description?: Nullable<string>;
    postcodeArea?: Nullable<string>;
    postcodes?: Nullable<string[]>;
    /** County/region name, expressed as a nested AdministrativeArea literal on
     * this Place -- not a second, unlinked areaServed entry. Use when there's
     * no separate document/entity for the county itself. */
    county?: Nullable<string>;
};
declare function buildPlace(input: PlaceInput, ids: GraphIds): Record<string, unknown>;
type ServiceInput = {
    name: string;
    slug: string;
    description?: Nullable<string>;
    serviceType?: Nullable<string>;
    priceFromMinor?: Nullable<number>;
    priceUnit?: Nullable<string>;
    url: string;
};
declare function buildService(input: ServiceInput, ids: GraphIds): Record<string, unknown>;
/** OfferCatalog whose Offers point at the same Service `@id`s the individual
 * service pages emit, rather than re-serialising each as an anonymous inline
 * literal. Callers must include the corresponding buildService(...) nodes in
 * the same graph. */
declare function buildOfferCatalog(name: string, services: Array<{
    slug: string;
}>, ids: GraphIds): {
    "@type": string;
    name: string;
    itemListElement: {
        "@type": string;
        itemOffered: {
            "@id": string;
        };
    }[];
};
type FAQInput = {
    question: string;
    answerText: string;
};
declare function buildFAQPage(faqs: FAQInput[], opts?: {
    id?: string;
    speakable?: boolean;
}): Record<string, unknown> | null;
/** `url` is optional per schema.org's own BreadcrumbList spec -- Google's
 * guidance is to omit it for the current page and for any crumb that has no
 * real navigable URL yet, rather than pointing structured data at a URL
 * that doesn't resolve. */
type BreadcrumbItem = {
    name: string;
    url?: Nullable<string>;
};
declare function buildBreadcrumbs(items: BreadcrumbItem[], id?: string): {
    itemListElement: {
        item?: string | undefined;
        "@type": string;
        position: number;
        name: string;
    }[];
    "@id"?: string | undefined;
    "@type": string;
};
declare function buildItemList(items: {
    name: string;
    url: string;
}[]): {
    "@type": string;
    itemListElement: {
        "@type": string;
        position: number;
        name: string;
        url: string;
    }[];
};
type ArticleInput = {
    slug: string;
    headline: string;
    description?: Nullable<string>;
    datePublished?: Nullable<string>;
    dateModified?: Nullable<string>;
    imageUrl?: Nullable<string>;
    /** slug of a Person node elsewhere in the same graph (see buildPerson). */
    authorSlug?: Nullable<string>;
    speakable?: {
        cssSelector: string[];
    };
};
declare function buildArticle(input: ArticleInput, ids: GraphIds): Record<string, unknown>;
/** Generic per-page identity node. One per page, linked to the sitewide
 * WebSite and Organization by @id rather than a page re-declaring either. */
type WebPageInput = {
    path: string;
    url: string;
    name: string;
    description?: Nullable<string>;
    dateModified?: Nullable<string>;
    inLanguage?: Nullable<string>;
};
declare function buildWebPage(input: WebPageInput, ids: GraphIds): Record<string, unknown>;
type ContactPageInput = {
    path: string;
    url: string;
    name: string;
};
/** `mainEntity` references the sitewide Organization by @id -- see
 * `OrganizationInput.contactPoint` for the actual contact-point data, rather
 * than re-declaring a second, disconnected Organization literal here. */
declare function buildContactPage(input: ContactPageInput, ids: GraphIds): {
    "@type": string;
    "@id": string;
    url: string;
    name: string;
    isPartOf: {
        "@id": string;
    };
    mainEntity: {
        "@id": string;
    };
};
type CollectionPageInput = {
    path: string;
    url: string;
    name: string;
    items: Array<{
        name: string;
        url: string;
    }>;
    inLanguage?: Nullable<string>;
};
declare function buildCollectionPage(input: CollectionPageInput, ids: GraphIds): Record<string, unknown>;
type ReviewInput = {
    authorName: string;
    reviewBody: string;
    ratingValue?: number | null;
    url?: Nullable<string>;
};
/** `itemReviewed` references the sitewide Organization by @id. No `@id` of
 * its own -- nothing else in the graph needs to reference a testimonial. */
declare function buildReview(input: ReviewInput, ids: GraphIds): Record<string, unknown>;
type ProductInput = {
    slug: string;
    name: string;
    url: string;
    imageUrl?: Nullable<string>;
    brandName?: Nullable<string>;
    category?: Nullable<string>;
    description?: Nullable<string>;
    /** Rendered as PropertyValue rows -- spec-sheet style facts about the
     * product (e.g. engine, power), not generic Organization identifiers. */
    additionalProperty?: Array<{
        name: string;
        value: string;
    }>;
    /** Omit entirely for a rate-on-application product with no public price --
     * an Offer with a fabricated price is invalid structured data. */
    offers?: {
        price: string;
        priceCurrency: string;
        /** e.g. "DAY" for a day-rate rental. Adds a UnitPriceSpecification
         * alongside the flat Offer price when set. */
        unitText?: Nullable<string>;
        availability?: Nullable<string>;
    } | null;
    /** `number` for a computed/live value; `string` to preserve a source
     * literal's exact representation verbatim (see Organization's
     * aggregateRating for the same reasoning). Unlike Organization, no
     * bestRating/worstRating defaults are added -- a Product's rating is
     * often narrower provenance than the sitewide one, so this stays a
     * plain pass-through of exactly what's given. */
    aggregateRating?: {
        ratingValue: number | string;
        reviewCount: number | string;
    } | null;
};
declare function buildProduct(input: ProductInput, ids: GraphIds): Record<string, unknown>;
type SoftwareApplicationInput = {
    slug: string;
    name: string;
    applicationCategory: string;
    operatingSystem?: Nullable<string>;
    description?: Nullable<string>;
    url?: Nullable<string>;
    /** @id ref to the Organization node that publishes this software --
     * schema.org's SoftwareApplication inherits `publisher` from
     * CreativeWork. Optional since not every consumer's Organization is
     * the software's own publisher (e.g. a marketplace listing). */
    publisherId?: Nullable<string>;
    offers?: Array<{
        name: string;
        price: string;
        priceCurrency: string;
        url?: Nullable<string>;
    }>;
};
/** For a SaaS product's own marketing site -- distinct from Product/
 * Service, which model a physical good or a booked service. Reuses the
 * `product` @id namespace (both are "sellable things" in schema.org's
 * ontology) rather than adding a fourth id-kind for a shape most
 * consumers in this portfolio will never need. */
declare function buildSoftwareApplication(input: SoftwareApplicationInput, ids: GraphIds): Record<string, unknown>;

declare function escapeJsonLdForScript(json: string): string;

export { type ArticleInput, type BreadcrumbItem, type CollectionPageInput, type ContactPageInput, type FAQInput, type GraphIds, type JsonLdGraph, type JsonLdNode, type OrganizationInput, type PersonInput, type PlaceInput, type ProductInput, type ReviewInput, type ServiceInput, type SoftwareApplicationInput, type WebPageInput, type WebsiteInput, buildArticle, buildBreadcrumbs, buildCollectionPage, buildContactPage, buildFAQPage, buildGraph, buildItemList, buildOfferCatalog, buildOrganization, buildPerson, buildPlace, buildProduct, buildReview, buildService, buildSoftwareApplication, buildSpine, buildWebPage, buildWebsite, createGraphIds, escapeJsonLdForScript, findGraphIssues };
