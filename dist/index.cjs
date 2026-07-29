"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  buildArticle: () => buildArticle,
  buildBreadcrumbs: () => buildBreadcrumbs,
  buildCollectionPage: () => buildCollectionPage,
  buildContactPage: () => buildContactPage,
  buildFAQPage: () => buildFAQPage,
  buildGraph: () => buildGraph,
  buildItemList: () => buildItemList,
  buildOfferCatalog: () => buildOfferCatalog,
  buildOrganization: () => buildOrganization,
  buildPerson: () => buildPerson,
  buildPlace: () => buildPlace,
  buildReview: () => buildReview,
  buildService: () => buildService,
  buildSpine: () => buildSpine,
  buildWebPage: () => buildWebPage,
  buildWebsite: () => buildWebsite,
  createGraphIds: () => createGraphIds,
  escapeJsonLdForScript: () => escapeJsonLdForScript,
  findGraphIssues: () => findGraphIssues
});
module.exports = __toCommonJS(index_exports);

// src/ids.ts
function createGraphIds(siteUrl) {
  const url = siteUrl.replace(/\/$/, "");
  return {
    org: `${url}/#organization`,
    website: `${url}/#website`,
    person: (slug) => `${url}/#person-${slug}`,
    service: (slug) => `${url}/#service-${slug}`,
    place: (slug) => `${url}/#place-${slug}`,
    article: (slug) => `${url}/#article-${slug}`,
    breadcrumb: (path) => `${url}${path}#breadcrumb`,
    /** Page-identity nodes (WebPage/ContactPage/CollectionPage) are inherently
     * page-scoped, same reasoning as `breadcrumb`. */
    webpage: (path) => `${url}${path}#webpage`
  };
}

// src/graph.ts
function buildGraph(nodes) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter((n) => Boolean(n))
  };
}
function isPureRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === "@id" && typeof value["@id"] === "string";
}
function findGraphIssues(graph) {
  const issues = [];
  const idCounts = /* @__PURE__ */ new Map();
  for (const node of graph["@graph"]) {
    const id = node["@id"];
    if (typeof id === "string") {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  }
  for (const [id, count] of idCounts) {
    if (count > 1) issues.push(`duplicate @id (${count}\xD7): ${id}`);
  }
  const definedIds = new Set(idCounts.keys());
  const walk = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (isPureRef(value)) {
      if (!definedIds.has(value["@id"])) {
        issues.push(`unresolved @id ref at ${path}: ${value["@id"]}`);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        walk(child, `${path}.${key}`);
      }
    }
  };
  graph["@graph"].forEach((node, index) => walk(node, `@graph[${index}]`));
  return issues;
}

// src/nodes.ts
function buildOrganization(input, ids, types = "LocalBusiness") {
  const node = {
    "@type": types,
    "@id": ids.org,
    name: input.name,
    description: input.description,
    url: input.url
  };
  if (input.legalName) node.legalName = input.legalName;
  if (input.alternateName) node.alternateName = input.alternateName;
  if (input.phone) node.telephone = input.phone;
  if (input.email) node.email = input.email;
  if (input.logoUrl) node.logo = input.logoUrl;
  if (input.image && input.image.length > 0) node.image = input.image;
  if (input.address) node.address = { "@type": "PostalAddress", ...input.address };
  if (input.geo) node.geo = { "@type": "GeoCoordinates", ...input.geo };
  if (input.priceRange) node.priceRange = input.priceRange;
  if (input.openingHours) node.openingHours = input.openingHours;
  if (input.openingHoursSpecification && input.openingHoursSpecification.length > 0) {
    node.openingHoursSpecification = input.openingHoursSpecification.map((h) => ({
      "@type": "OpeningHoursSpecification",
      ...h
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
      ...input.aggregateRating
    };
  }
  if (input.hasOfferCatalog) node.hasOfferCatalog = input.hasOfferCatalog;
  if (input.founderId) node.founder = { "@id": input.founderId };
  if (input.contactPoint && input.contactPoint.length > 0) {
    node.contactPoint = input.contactPoint.map((c) => ({ "@type": "ContactPoint", ...c }));
  }
  if (input.identifiers && input.identifiers.length > 0) {
    node.identifier = input.identifiers.map((i) => ({ "@type": "PropertyValue", ...i }));
  }
  return node;
}
function buildWebsite(input, ids) {
  return {
    "@type": "WebSite",
    "@id": ids.website,
    name: input.name,
    url: input.url,
    publisher: { "@id": ids.org }
  };
}
function buildSpine(organizationInput, websiteInput, ids, types) {
  return [buildOrganization(organizationInput, ids, types), buildWebsite(websiteInput, ids)];
}
function buildPerson(input, ids) {
  const node = {
    "@type": "Person",
    "@id": ids.person(input.slug),
    name: input.name,
    worksFor: { "@id": ids.org }
  };
  if (input.jobTitle) node.jobTitle = input.jobTitle;
  if (input.description) node.description = input.description;
  if (input.imageUrl) node.image = input.imageUrl;
  if (input.sameAs && input.sameAs.length > 0) node.sameAs = input.sameAs;
  if (input.credentials && input.credentials.length > 0) {
    node.identifier = input.credentials.filter((c) => c.number).map((c) => ({
      "@type": "PropertyValue",
      propertyID: c.label,
      value: c.number,
      ...c.url ? { url: c.url } : {}
    }));
  }
  if (input.hasCredential && input.hasCredential.length > 0) {
    node.hasCredential = input.hasCredential.map((c) => ({
      "@type": "EducationalOccupationalCredential",
      credentialCategory: c.category,
      name: c.name,
      ...c.identifier ? { identifier: c.identifier } : {},
      ...c.url ? { url: c.url } : {}
    }));
  }
  return node;
}
function buildPlace(input, ids) {
  const node = {
    "@type": "Place",
    "@id": ids.place(input.slug),
    name: input.name
  };
  if (input.description) node.description = input.description;
  if (input.postcodeArea) {
    node.additionalProperty = {
      "@type": "PropertyValue",
      name: "postcodeArea",
      value: input.postcodeArea
    };
  } else if (input.postcodes && input.postcodes.length > 0) {
    node.additionalProperty = {
      "@type": "PropertyValue",
      name: "postcodes",
      value: input.postcodes.join(", ")
    };
  }
  if (input.county) {
    node.containedInPlace = { "@type": "AdministrativeArea", name: input.county };
  }
  return node;
}
function buildService(input, ids) {
  const node = {
    "@type": "Service",
    "@id": ids.service(input.slug),
    name: input.name,
    url: input.url,
    provider: { "@id": ids.org },
    isPartOf: { "@id": ids.website }
  };
  if (input.description) node.description = input.description;
  if (input.serviceType) node.serviceType = input.serviceType;
  if (input.priceFromMinor) {
    node.offers = {
      "@type": "Offer",
      price: (input.priceFromMinor / 100).toFixed(2),
      priceCurrency: "GBP",
      ...input.priceUnit ? { description: input.priceUnit } : {}
    };
  }
  return node;
}
function buildOfferCatalog(name, services, ids) {
  return {
    "@type": "OfferCatalog",
    name,
    itemListElement: services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@id": ids.service(s.slug) }
    }))
  };
}
function buildFAQPage(faqs, opts) {
  if (faqs.length === 0) return null;
  const node = {
    "@type": "FAQPage",
    ...opts?.id ? { "@id": opts.id } : {},
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answerText }
    }))
  };
  if (opts?.speakable) {
    node.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: ["[data-speakable-question]", "[data-speakable-answer]"]
    };
  }
  return node;
}
function buildBreadcrumbs(items, id) {
  return {
    "@type": "BreadcrumbList",
    ...id ? { "@id": id } : {},
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}
function buildItemList(items) {
  return {
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url
    }))
  };
}
function buildArticle(input, ids) {
  const node = {
    "@type": "Article",
    "@id": ids.article(input.slug),
    headline: input.headline,
    publisher: { "@id": ids.org },
    isPartOf: { "@id": ids.website }
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
function buildWebPage(input, ids) {
  const node = {
    "@type": "WebPage",
    "@id": ids.webpage(input.path),
    url: input.url,
    name: input.name,
    isPartOf: { "@id": ids.website },
    about: { "@id": ids.org }
  };
  if (input.description) node.description = input.description;
  if (input.dateModified) node.dateModified = input.dateModified;
  if (input.inLanguage) node.inLanguage = input.inLanguage;
  return node;
}
function buildContactPage(input, ids) {
  return {
    "@type": "ContactPage",
    "@id": ids.webpage(input.path),
    url: input.url,
    name: input.name,
    isPartOf: { "@id": ids.website },
    mainEntity: { "@id": ids.org }
  };
}
function buildCollectionPage(input, ids) {
  const node = {
    "@type": "CollectionPage",
    "@id": ids.webpage(input.path),
    url: input.url,
    name: input.name,
    isPartOf: { "@id": ids.website },
    about: { "@id": ids.org },
    mainEntity: buildItemList(input.items)
  };
  if (input.inLanguage) node.inLanguage = input.inLanguage;
  return node;
}
function buildReview(input, ids) {
  const node = {
    "@type": "Review",
    itemReviewed: { "@id": ids.org },
    author: { "@type": "Person", name: input.authorName },
    reviewBody: input.reviewBody
  };
  if (typeof input.ratingValue === "number" && input.ratingValue >= 1 && input.ratingValue <= 5) {
    node.reviewRating = {
      "@type": "Rating",
      ratingValue: input.ratingValue,
      bestRating: 5,
      worstRating: 1
    };
  }
  if (input.url) node.url = input.url;
  return node;
}

// src/escape.ts
var LINE_SEPARATOR = String.fromCharCode(8232);
var PARAGRAPH_SEPARATOR = String.fromCharCode(8233);
function escapeJsonLdForScript(json) {
  return json.split("<").join("\\u003c").split(">").join("\\u003e").split("&").join("\\u0026").split(LINE_SEPARATOR).join("\\u2028").split(PARAGRAPH_SEPARATOR).join("\\u2029");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildArticle,
  buildBreadcrumbs,
  buildCollectionPage,
  buildContactPage,
  buildFAQPage,
  buildGraph,
  buildItemList,
  buildOfferCatalog,
  buildOrganization,
  buildPerson,
  buildPlace,
  buildReview,
  buildService,
  buildSpine,
  buildWebPage,
  buildWebsite,
  createGraphIds,
  escapeJsonLdForScript,
  findGraphIssues
});
