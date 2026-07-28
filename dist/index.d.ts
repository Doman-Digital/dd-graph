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
    place: (slug: string) => string;
    article: (slug: string) => string;
    breadcrumb: (path: string) => string;
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
    /** Pre-shaped schema.org rows: one entry per group of days sharing hours.
     * Adapt your CMS's per-day shape to this before calling. */
    openingHoursSpecification?: Array<{
        dayOfWeek: string[];
        opens: string;
        closes: string;
    }>;
    /** @id refs to Place nodes elsewhere in the same graph. */
    areaServedIds?: string[];
    sameAs?: string[];
    aggregateRating?: {
        ratingValue: number;
        reviewCount: number;
    } | null;
    /** Pre-built OfferCatalog (see buildOfferCatalog), passed through as-is. */
    hasOfferCatalog?: Record<string, unknown>;
    /** @id ref to a Person node -- the founder/owner, if the business has one
     * canonical figurehead worth naming on the Organization itself. */
    founderId?: Nullable<string>;
};
declare function buildOrganization(input: OrganizationInput, ids: GraphIds, types?: string | string[]): Record<string, unknown>;
declare function buildWebsite(input: {
    name: string;
    url: string;
}, ids: GraphIds): {
    "@type": string;
    "@id": string;
    name: string;
    url: string;
    publisher: {
        "@id": string;
    };
};
/** Convenience for the two nodes almost every page includes: Organization +
 * WebSite. A founder/team Person is deliberately NOT bundled here -- not
 * every business has one canonical figurehead -- add `buildPerson(...)`
 * alongside this in the consumer if it does. */
declare function buildSpine(organizationInput: OrganizationInput, websiteInput: {
    name: string;
    url: string;
}, ids: GraphIds, types?: string | string[]): [ReturnType<typeof buildOrganization>, ReturnType<typeof buildWebsite>];
type PersonInput = {
    name: string;
    slug: string;
    jobTitle?: Nullable<string>;
    description?: Nullable<string>;
    imageUrl?: Nullable<string>;
    credentials?: Array<{
        label: string;
        number?: Nullable<string>;
        url?: Nullable<string>;
    }>;
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
type BreadcrumbItem = {
    name: string;
    url: string;
};
declare function buildBreadcrumbs(items: BreadcrumbItem[], id?: string): {
    itemListElement: {
        "@type": string;
        position: number;
        name: string;
        item: string;
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

declare function escapeJsonLdForScript(json: string): string;

export { type ArticleInput, type BreadcrumbItem, type FAQInput, type GraphIds, type JsonLdGraph, type JsonLdNode, type OrganizationInput, type PersonInput, type PlaceInput, type ServiceInput, buildArticle, buildBreadcrumbs, buildFAQPage, buildGraph, buildItemList, buildOfferCatalog, buildOrganization, buildPerson, buildPlace, buildService, buildSpine, buildWebsite, createGraphIds, escapeJsonLdForScript, findGraphIssues };
