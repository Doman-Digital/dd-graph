import { describe, expect, it } from "vitest";
import { createGraphIds } from "../ids";
import { buildGraph, findGraphIssues } from "../graph";
import {
  buildArticle,
  buildBreadcrumbs,
  buildCollectionPage,
  buildContactPage,
  buildOfferCatalog,
  buildOrganization,
  buildPerson,
  buildPlace,
  buildReview,
  buildService,
  buildSpine,
  buildWebPage,
} from "../nodes";

const SITE_URL = "https://example-electrician.co.uk";

const ORG_INPUT = {
  name: "Acme Electrical",
  description: "Domestic and commercial electricians.",
  url: SITE_URL,
};
const WEBSITE_INPUT = { name: "Acme Electrical", url: SITE_URL };

describe("findGraphIssues", () => {
  it("is clean for a spine + service + place graph with proper @id refs", () => {
    const ids = createGraphIds(SITE_URL);
    const graph = buildGraph([
      ...buildSpine(ORG_INPUT, WEBSITE_INPUT, ids, "Electrician"),
      buildPlace({ name: "Uxbridge", slug: "uxbridge", county: "Greater London" }, ids),
      buildService({ name: "Rewiring", slug: "rewiring", url: `${SITE_URL}/services/rewiring` }, ids),
      buildBreadcrumbs([{ name: "Home", url: SITE_URL }], ids.breadcrumb("/")),
    ]);

    expect(findGraphIssues(graph)).toEqual([]);
  });

  it("flags an unresolved @id ref -- the exact bug this package exists to catch", () => {
    const ids = createGraphIds(SITE_URL);
    // Service.provider is always {'@id': ids.org}; if the Organization node
    // itself never makes it into the graph, that ref dangles.
    const graph = buildGraph([buildService({ name: "Rewiring", slug: "rewiring", url: "x" }, ids)]);

    const issues = findGraphIssues(graph);
    expect(issues.some((i) => i.includes("unresolved @id ref") && i.includes(ids.org))).toBe(true);
  });

  it("flags two differently-typed nodes sharing the same @id", () => {
    const ids = createGraphIds(SITE_URL);
    const [organization, website] = buildSpine(ORG_INPUT, WEBSITE_INPUT, ids);
    // Reproduces the live MMM-Beauty bug: an Organization and an unrelated
    // node type emitted with the identical @id, which JSON-LD parsers merge
    // into one contradictory node.
    const impostor = { "@type": "NailSalon", "@id": ids.org, name: "Someone Else" };
    const graph = buildGraph([organization, website, impostor]);

    const issues = findGraphIssues(graph);
    expect(issues.some((i) => i.includes("duplicate @id") && i.includes(ids.org))).toBe(true);
  });

  it("resolves an OfferCatalog whose Offers reference included Service nodes", () => {
    const ids = createGraphIds(SITE_URL);
    const services = [{ slug: "rewiring", name: "Rewiring", url: `${SITE_URL}/services/rewiring` }];
    const graph = buildGraph([
      ...buildSpine(
        { ...ORG_INPUT, hasOfferCatalog: buildOfferCatalog("Electrical Services", services, ids) },
        WEBSITE_INPUT,
        ids,
      ),
      ...services.map((s) => buildService(s, ids)),
    ]);

    expect(findGraphIssues(graph)).toEqual([]);
  });

  it("flags an OfferCatalog referencing a Service left out of the graph", () => {
    const ids = createGraphIds(SITE_URL);
    const services = [{ slug: "rewiring", name: "Rewiring", url: `${SITE_URL}/services/rewiring` }];
    const graph = buildGraph([
      ...buildSpine(
        { ...ORG_INPUT, hasOfferCatalog: buildOfferCatalog("Electrical Services", services, ids) },
        WEBSITE_INPUT,
        ids,
      ),
    ]);

    const issues = findGraphIssues(graph);
    expect(issues.some((i) => i.includes("unresolved @id ref") && i.includes(ids.service("rewiring")))).toBe(true);
  });

  it("resolves a Person referenced by both Organization.founder and Article.author", () => {
    const ids = createGraphIds(SITE_URL);
    const graph = buildGraph([
      ...buildSpine({ ...ORG_INPUT, founderId: ids.person("founder") }, WEBSITE_INPUT, ids),
      buildPerson({ name: "Ryan", slug: "founder", jobTitle: "Owner" }, ids),
      buildArticle({ slug: "eicr-guide", headline: "What is an EICR?", authorSlug: "founder" }, ids),
    ]);

    expect(findGraphIssues(graph)).toEqual([]);
  });
});

describe("buildSpine / buildOrganization / buildWebsite", () => {
  it("gives Organization and WebSite stable, cross-linked @ids", () => {
    const ids = createGraphIds(SITE_URL);
    const [organization, website] = buildSpine(ORG_INPUT, WEBSITE_INPUT, ids, "Electrician");

    expect(organization["@id"]).toBe(ids.org);
    expect(organization["@type"]).toBe("Electrician");
    expect(website["@id"]).toBe(ids.website);
    expect(website.publisher).toEqual({ "@id": ids.org });
  });

  it("only sets founder when founderId is provided -- not every business has one figurehead", () => {
    const ids = createGraphIds(SITE_URL);
    const withFounder = buildOrganization({ ...ORG_INPUT, founderId: ids.person("founder") }, ids);
    const withoutFounder = buildOrganization(ORG_INPUT, ids);

    expect(withFounder.founder).toEqual({ "@id": ids.person("founder") });
    expect(withoutFounder.founder).toBeUndefined();
  });

  it("uses root-anchored ids, independent of any consumer's routing", () => {
    const ids = createGraphIds(SITE_URL);
    expect(ids.org).toBe(`${SITE_URL}/#organization`);
    expect(ids.website).toBe(`${SITE_URL}/#website`);
    expect(ids.service("rewiring")).toBe(`${SITE_URL}/#service-rewiring`);
    expect(ids.place("uxbridge")).toBe(`${SITE_URL}/#place-uxbridge`);
    expect(ids.person("founder")).toBe(`${SITE_URL}/#person-founder`);
  });
});

describe("buildService", () => {
  it("references the org and website by @id instead of nesting literals", () => {
    const ids = createGraphIds(SITE_URL);
    const service = buildService({ name: "Rewiring", slug: "rewiring", url: "x" }, ids);

    expect(service.provider).toEqual({ "@id": ids.org });
    expect(service.isPartOf).toEqual({ "@id": ids.website });
    expect(service["@id"]).toBe(ids.service("rewiring"));
  });
});

describe("buildOrganization identifiers", () => {
  it("emits identifier PropertyValue rows only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const withIdentifiers = buildOrganization(
      { ...ORG_INPUT, identifiers: [{ propertyID: "Companies House", value: "12345678" }] },
      ids,
    );
    const withoutIdentifiers = buildOrganization(ORG_INPUT, ids);

    expect(withIdentifiers.identifier).toEqual([
      { "@type": "PropertyValue", propertyID: "Companies House", value: "12345678" },
    ]);
    expect(withoutIdentifiers.identifier).toBeUndefined();
  });
});

describe("buildOrganization alternateName", () => {
  it("emits alternateName only when provided, distinct from legalName", () => {
    const ids = createGraphIds(SITE_URL);
    const withAlternate = buildOrganization({ ...ORG_INPUT, alternateName: "Also Known As" }, ids);
    const withoutAlternate = buildOrganization(ORG_INPUT, ids);

    expect(withAlternate.alternateName).toBe("Also Known As");
    expect(withoutAlternate.alternateName).toBeUndefined();
  });
});

describe("buildOrganization openingHours", () => {
  it("emits free-text openingHours distinct from openingHoursSpecification", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization({ ...ORG_INPUT, openingHours: "Appointments only" }, ids);

    expect(node.openingHours).toBe("Appointments only");
    expect(node.openingHoursSpecification).toBeUndefined();
  });
});

describe("buildPerson", () => {
  it("emits sameAs and hasCredential as EducationalOccupationalCredential, distinct from identifier", () => {
    const ids = createGraphIds(SITE_URL);
    const person = buildPerson(
      {
        name: "Jane Doe",
        slug: "jane",
        sameAs: ["https://register.example/jane"],
        hasCredential: [{ category: "Professional regulator", name: "HCPC registration", identifier: "OT12345" }],
      },
      ids,
    );

    expect(person.sameAs).toEqual(["https://register.example/jane"]);
    expect(person.hasCredential).toEqual([
      {
        "@type": "EducationalOccupationalCredential",
        credentialCategory: "Professional regulator",
        name: "HCPC registration",
        identifier: "OT12345",
      },
    ]);
    expect(person.identifier).toBeUndefined();
  });
});

describe("buildPlace", () => {
  it("expresses a county as containedInPlace, not a second disconnected areaServed entry", () => {
    const ids = createGraphIds(SITE_URL);
    const place = buildPlace({ name: "Hayes", slug: "hayes", county: "Greater London" }, ids);

    expect(place["@id"]).toBe(ids.place("hayes"));
    expect(place.containedInPlace).toEqual({ "@type": "AdministrativeArea", name: "Greater London" });
  });
});

describe("buildArticle", () => {
  it("references publisher/isPartOf/author by @id, no nested literals", () => {
    const ids = createGraphIds(SITE_URL);
    const article = buildArticle(
      { slug: "eicr-guide", headline: "What is an EICR?", authorSlug: "founder" },
      ids,
    );

    expect(article.publisher).toEqual({ "@id": ids.org });
    expect(article.isPartOf).toEqual({ "@id": ids.website });
    expect(article.author).toEqual({ "@id": ids.person("founder") });
  });
});

describe("buildWebPage", () => {
  it("references isPartOf/about by @id and uses the page-scoped webpage id", () => {
    const ids = createGraphIds(SITE_URL);
    const page = buildWebPage({ path: "/about", url: `${SITE_URL}/about`, name: "About" }, ids);

    expect(page["@id"]).toBe(ids.webpage("/about"));
    expect(page.isPartOf).toEqual({ "@id": ids.website });
    expect(page.about).toEqual({ "@id": ids.org });
  });
});

describe("buildContactPage", () => {
  it("references the sitewide Organization via mainEntity instead of a second literal", () => {
    const ids = createGraphIds(SITE_URL);
    const page = buildContactPage({ path: "/contact", url: `${SITE_URL}/contact`, name: "Contact" }, ids);

    expect(page.mainEntity).toEqual({ "@id": ids.org });
    expect(page["@id"]).toBe(ids.webpage("/contact"));
  });
});

describe("buildCollectionPage", () => {
  it("builds mainEntity as an ItemList and references isPartOf/about by @id", () => {
    const ids = createGraphIds(SITE_URL);
    const page = buildCollectionPage(
      {
        path: "/resources",
        url: `${SITE_URL}/resources`,
        name: "Resources",
        items: [{ name: "Guide", url: `${SITE_URL}/resources/guide` }],
      },
      ids,
    );

    expect(page.isPartOf).toEqual({ "@id": ids.website });
    expect(page.about).toEqual({ "@id": ids.org });
    expect(page.mainEntity).toEqual({
      "@type": "ItemList",
      itemListElement: [{ "@type": "ListItem", position: 1, name: "Guide", url: `${SITE_URL}/resources/guide` }],
    });
  });
});

describe("buildReview", () => {
  it("references itemReviewed by @id and omits reviewRating when no rating is given", () => {
    const ids = createGraphIds(SITE_URL);
    const review = buildReview({ authorName: "Jane", reviewBody: "Great service." }, ids);

    expect(review.itemReviewed).toEqual({ "@id": ids.org });
    expect(review.reviewRating).toBeUndefined();
  });

  it("includes reviewRating when a valid 1-5 rating is given", () => {
    const ids = createGraphIds(SITE_URL);
    const review = buildReview({ authorName: "Jane", reviewBody: "Great service.", ratingValue: 5 }, ids);

    expect(review.reviewRating).toEqual({ "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 });
  });
});

describe("buildOrganization contactPoint", () => {
  it("emits ContactPoint nodes only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const withContact = buildOrganization(
      { ...ORG_INPUT, contactPoint: [{ contactType: "customer support", email: "hi@example.com" }] },
      ids,
    );
    const withoutContact = buildOrganization(ORG_INPUT, ids);

    expect(withContact.contactPoint).toEqual([
      { "@type": "ContactPoint", contactType: "customer support", email: "hi@example.com" },
    ]);
    expect(withoutContact.contactPoint).toBeUndefined();
  });
});

describe("findGraphIssues -- new node kinds", () => {
  it("is clean for a spine + WebPage + ContactPage + CollectionPage + Review graph", () => {
    const ids = createGraphIds(SITE_URL);
    const graph = buildGraph([
      ...buildSpine(ORG_INPUT, WEBSITE_INPUT, ids),
      buildWebPage({ path: "/about", url: `${SITE_URL}/about`, name: "About" }, ids),
      buildContactPage({ path: "/contact", url: `${SITE_URL}/contact`, name: "Contact" }, ids),
      buildCollectionPage(
        {
          path: "/resources",
          url: `${SITE_URL}/resources`,
          name: "Resources",
          items: [{ name: "Guide", url: `${SITE_URL}/resources/guide` }],
        },
        ids,
      ),
      buildReview({ authorName: "Jane", reviewBody: "Great service.", ratingValue: 5 }, ids),
    ]);

    expect(findGraphIssues(graph)).toEqual([]);
  });
});
