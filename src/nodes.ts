import type { GraphIds } from "./ids";

// Node builders for a sitewide schema.org entity graph. Every relation that
// would naively be a nested literal (provider, worksFor, publisher, isPartOf,
// founder) is instead a `{'@id': ...}` reference into the sitewide spine, so
// the graph stays one connected entity instead of N disconnected islands.
//
// These builders are deliberately domain-agnostic: niche/business-type
// mapping (e.g. "salon" -> ['BeautySalon', 'HealthAndBeautyBusiness',
// 'LocalBusiness']), CMS-shape adapters, and env-gated fields like
// aggregateRating provenance stay in the consuming site, not here.
//
// Optional string-ish fields accept `| null` as well as `| undefined`:
// Sanity (and most headless CMSes) return unset fields as `null`, not
// `undefined`, so requiring `undefined` here would force every consumer to
// coerce at the call site. Falsy checks in the builders below (`if
// (input.x)`) already treat both the same at runtime.
type Nullable<T> = T | null | undefined;

export type OrganizationInput = {
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
  geo?: { latitude: string; longitude: string } | null;
  priceRange?: Nullable<string>;
  /** Pre-shaped schema.org rows: one entry per group of days sharing hours.
   * Adapt your CMS's per-day shape to this before calling. */
  openingHoursSpecification?: Array<{ dayOfWeek: string[]; opens: string; closes: string }>;
  /** @id refs to Place nodes elsewhere in the same graph. */
  areaServedIds?: string[];
  sameAs?: string[];
  aggregateRating?: { ratingValue: number; reviewCount: number } | null;
  /** Pre-built OfferCatalog (see buildOfferCatalog), passed through as-is. */
  hasOfferCatalog?: Record<string, unknown>;
  /** @id ref to a Person node -- the founder/owner, if the business has one
   * canonical figurehead worth naming on the Organization itself. */
  founderId?: Nullable<string>;
  contactPoint?: Array<{
    contactType: string;
    email?: Nullable<string>;
    telephone?: Nullable<string>;
  }>;
};

export function buildOrganization(
  input: OrganizationInput,
  ids: GraphIds,
  types: string | string[] = "LocalBusiness",
) {
  const node: Record<string, unknown> = {
    "@type": types,
    "@id": ids.org,
    name: input.name,
    description: input.description,
    url: input.url,
  };
  if (input.legalName) node.legalName = input.legalName;
  if (input.phone) node.telephone = input.phone;
  if (input.email) node.email = input.email;
  if (input.logoUrl) node.logo = input.logoUrl;
  if (input.image && input.image.length > 0) node.image = input.image;
  if (input.address) node.address = { "@type": "PostalAddress", ...input.address };
  if (input.geo) node.geo = { "@type": "GeoCoordinates", ...input.geo };
  if (input.priceRange) node.priceRange = input.priceRange;
  if (input.openingHoursSpecification && input.openingHoursSpecification.length > 0) {
    node.openingHoursSpecification = input.openingHoursSpecification.map((h) => ({
      "@type": "OpeningHoursSpecification",
      ...h,
    }));
  }
  if (input.areaServedIds && input.areaServedIds.length > 0) {
    node.areaServed = input.areaServedIds.map((id) => ({ "@id": id }));
  }
  if (input.sameAs && input.sameAs.length > 0) node.sameAs = input.sameAs;
  if (input.aggregateRating) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      bestRating: 5,
      worstRating: 1,
      ...input.aggregateRating,
    };
  }
  if (input.hasOfferCatalog) node.hasOfferCatalog = input.hasOfferCatalog;
  if (input.founderId) node.founder = { "@id": input.founderId };
  if (input.contactPoint && input.contactPoint.length > 0) {
    node.contactPoint = input.contactPoint.map((c) => ({ "@type": "ContactPoint", ...c }));
  }
  return node;
}

export function buildWebsite(input: { name: string; url: string }, ids: GraphIds) {
  return {
    "@type": "WebSite",
    "@id": ids.website,
    name: input.name,
    url: input.url,
    publisher: { "@id": ids.org },
  };
}

/** Convenience for the two nodes almost every page includes: Organization +
 * WebSite. A founder/team Person is deliberately NOT bundled here -- not
 * every business has one canonical figurehead -- add `buildPerson(...)`
 * alongside this in the consumer if it does. */
export function buildSpine(
  organizationInput: OrganizationInput,
  websiteInput: { name: string; url: string },
  ids: GraphIds,
  types?: string | string[],
): [ReturnType<typeof buildOrganization>, ReturnType<typeof buildWebsite>] {
  return [buildOrganization(organizationInput, ids, types), buildWebsite(websiteInput, ids)];
}

export type PersonInput = {
  name: string;
  slug: string;
  jobTitle?: Nullable<string>;
  description?: Nullable<string>;
  imageUrl?: Nullable<string>;
  sameAs?: string[];
  credentials?: Array<{ label: string; number?: Nullable<string>; url?: Nullable<string> }>;
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
};

export function buildPerson(input: PersonInput, ids: GraphIds) {
  const node: Record<string, unknown> = {
    "@type": "Person",
    "@id": ids.person(input.slug),
    name: input.name,
    worksFor: { "@id": ids.org },
  };
  if (input.jobTitle) node.jobTitle = input.jobTitle;
  if (input.description) node.description = input.description;
  if (input.imageUrl) node.image = input.imageUrl;
  if (input.sameAs && input.sameAs.length > 0) node.sameAs = input.sameAs;
  if (input.credentials && input.credentials.length > 0) {
    node.identifier = input.credentials
      .filter((c) => c.number)
      .map((c) => ({
        "@type": "PropertyValue",
        propertyID: c.label,
        value: c.number,
        ...(c.url ? { url: c.url } : {}),
      }));
  }
  if (input.hasCredential && input.hasCredential.length > 0) {
    node.hasCredential = input.hasCredential.map((c) => ({
      "@type": "EducationalOccupationalCredential",
      credentialCategory: c.category,
      name: c.name,
      ...(c.identifier ? { identifier: c.identifier } : {}),
      ...(c.url ? { url: c.url } : {}),
    }));
  }
  return node;
}

export type PlaceInput = {
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

export function buildPlace(input: PlaceInput, ids: GraphIds) {
  const node: Record<string, unknown> = {
    "@type": "Place",
    "@id": ids.place(input.slug),
    name: input.name,
  };
  if (input.description) node.description = input.description;
  if (input.postcodeArea) {
    node.additionalProperty = {
      "@type": "PropertyValue",
      name: "postcodeArea",
      value: input.postcodeArea,
    };
  } else if (input.postcodes && input.postcodes.length > 0) {
    node.additionalProperty = {
      "@type": "PropertyValue",
      name: "postcodes",
      value: input.postcodes.join(", "),
    };
  }
  if (input.county) {
    node.containedInPlace = { "@type": "AdministrativeArea", name: input.county };
  }
  return node;
}

export type ServiceInput = {
  name: string;
  slug: string;
  description?: Nullable<string>;
  serviceType?: Nullable<string>;
  priceFromMinor?: Nullable<number>;
  priceUnit?: Nullable<string>;
  url: string;
};

export function buildService(input: ServiceInput, ids: GraphIds) {
  const node: Record<string, unknown> = {
    "@type": "Service",
    "@id": ids.service(input.slug),
    name: input.name,
    url: input.url,
    provider: { "@id": ids.org },
    isPartOf: { "@id": ids.website },
  };
  if (input.description) node.description = input.description;
  if (input.serviceType) node.serviceType = input.serviceType;
  if (input.priceFromMinor) {
    node.offers = {
      "@type": "Offer",
      price: (input.priceFromMinor / 100).toFixed(2),
      priceCurrency: "GBP",
      ...(input.priceUnit ? { description: input.priceUnit } : {}),
    };
  }
  return node;
}

/** OfferCatalog whose Offers point at the same Service `@id`s the individual
 * service pages emit, rather than re-serialising each as an anonymous inline
 * literal. Callers must include the corresponding buildService(...) nodes in
 * the same graph. */
export function buildOfferCatalog(name: string, services: Array<{ slug: string }>, ids: GraphIds) {
  return {
    "@type": "OfferCatalog",
    name,
    itemListElement: services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@id": ids.service(s.slug) },
    })),
  };
}

export type FAQInput = { question: string; answerText: string };

export function buildFAQPage(faqs: FAQInput[], opts?: { id?: string; speakable?: boolean }) {
  if (faqs.length === 0) return null;
  const node: Record<string, unknown> = {
    "@type": "FAQPage",
    ...(opts?.id ? { "@id": opts.id } : {}),
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answerText },
    })),
  };
  if (opts?.speakable) {
    node.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: ["[data-speakable-question]", "[data-speakable-answer]"],
    };
  }
  return node;
}

export type BreadcrumbItem = { name: string; url: string };

export function buildBreadcrumbs(items: BreadcrumbItem[], id?: string) {
  return {
    "@type": "BreadcrumbList",
    ...(id ? { "@id": id } : {}),
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildItemList(items: { name: string; url: string }[]) {
  return {
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export type ArticleInput = {
  slug: string;
  headline: string;
  description?: Nullable<string>;
  datePublished?: Nullable<string>;
  dateModified?: Nullable<string>;
  imageUrl?: Nullable<string>;
  /** slug of a Person node elsewhere in the same graph (see buildPerson). */
  authorSlug?: Nullable<string>;
  speakable?: { cssSelector: string[] };
};

export function buildArticle(input: ArticleInput, ids: GraphIds) {
  const node: Record<string, unknown> = {
    "@type": "Article",
    "@id": ids.article(input.slug),
    headline: input.headline,
    publisher: { "@id": ids.org },
    isPartOf: { "@id": ids.website },
  };
  if (input.description) node.description = input.description;
  if (input.datePublished) node.datePublished = input.datePublished;
  if (input.dateModified) node.dateModified = input.dateModified;
  if (input.imageUrl) node.image = [input.imageUrl];
  if (input.authorSlug) node.author = { "@id": ids.person(input.authorSlug) };
  if (input.speakable) {
    node.speakable = { "@type": "SpeakableSpecification", cssSelector: input.speakable.cssSelector };
  }
  return node;
}

/** Generic per-page identity node. One per page, linked to the sitewide
 * WebSite and Organization by @id rather than a page re-declaring either. */
export type WebPageInput = {
  path: string;
  url: string;
  name: string;
  description?: Nullable<string>;
  dateModified?: Nullable<string>;
  inLanguage?: Nullable<string>;
};

export function buildWebPage(input: WebPageInput, ids: GraphIds) {
  const node: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": ids.webpage(input.path),
    url: input.url,
    name: input.name,
    isPartOf: { "@id": ids.website },
    about: { "@id": ids.org },
  };
  if (input.description) node.description = input.description;
  if (input.dateModified) node.dateModified = input.dateModified;
  if (input.inLanguage) node.inLanguage = input.inLanguage;
  return node;
}

export type ContactPageInput = { path: string; url: string; name: string };

/** `mainEntity` references the sitewide Organization by @id -- see
 * `OrganizationInput.contactPoint` for the actual contact-point data, rather
 * than re-declaring a second, disconnected Organization literal here. */
export function buildContactPage(input: ContactPageInput, ids: GraphIds) {
  return {
    "@type": "ContactPage",
    "@id": ids.webpage(input.path),
    url: input.url,
    name: input.name,
    isPartOf: { "@id": ids.website },
    mainEntity: { "@id": ids.org },
  };
}

export type CollectionPageInput = {
  path: string;
  url: string;
  name: string;
  items: Array<{ name: string; url: string }>;
  inLanguage?: Nullable<string>;
};

export function buildCollectionPage(input: CollectionPageInput, ids: GraphIds) {
  const node: Record<string, unknown> = {
    "@type": "CollectionPage",
    "@id": ids.webpage(input.path),
    url: input.url,
    name: input.name,
    isPartOf: { "@id": ids.website },
    about: { "@id": ids.org },
    mainEntity: buildItemList(input.items),
  };
  if (input.inLanguage) node.inLanguage = input.inLanguage;
  return node;
}

export type ReviewInput = {
  authorName: string;
  reviewBody: string;
  ratingValue?: number | null;
  url?: Nullable<string>;
};

/** `itemReviewed` references the sitewide Organization by @id. No `@id` of
 * its own -- nothing else in the graph needs to reference a testimonial. */
export function buildReview(input: ReviewInput, ids: GraphIds) {
  const node: Record<string, unknown> = {
    "@type": "Review",
    itemReviewed: { "@id": ids.org },
    author: { "@type": "Person", name: input.authorName },
    reviewBody: input.reviewBody,
  };
  if (typeof input.ratingValue === "number" && input.ratingValue >= 1 && input.ratingValue <= 5) {
    node.reviewRating = {
      "@type": "Rating",
      ratingValue: input.ratingValue,
      bestRating: 5,
      worstRating: 1,
    };
  }
  if (input.url) node.url = input.url;
  return node;
}
