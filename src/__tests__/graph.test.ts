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
  buildProduct,
  buildReview,
  buildService,
  buildSoftwareApplication,
  buildSpine,
  buildWebPage,
  buildWebsite,
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

describe("buildOrganization hasMap / paymentAccepted / currenciesAccepted", () => {
  it("emits each only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const withFields = buildOrganization(
      {
        ...ORG_INPUT,
        hasMap: "https://maps.example.com/acme",
        paymentAccepted: "Cash, Credit Card, Debit Card",
        currenciesAccepted: "GBP",
      },
      ids,
    );
    const withoutFields = buildOrganization(ORG_INPUT, ids);

    expect(withFields.hasMap).toBe("https://maps.example.com/acme");
    expect(withFields.paymentAccepted).toBe("Cash, Credit Card, Debit Card");
    expect(withFields.currenciesAccepted).toBe("GBP");
    expect(withoutFields.hasMap).toBeUndefined();
    expect(withoutFields.paymentAccepted).toBeUndefined();
    expect(withoutFields.currenciesAccepted).toBeUndefined();
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

describe("buildOrganization address", () => {
  it("maps locality/region/country to the real schema.org PostalAddress property names", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization(
      {
        ...ORG_INPUT,
        address: {
          streetAddress: "1 Example St",
          locality: "Uxbridge",
          region: "Greater London",
          postalCode: "UB10 9BZ",
          country: "GB",
        },
      },
      ids,
    );

    expect(node.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "1 Example St",
      addressLocality: "Uxbridge",
      addressRegion: "Greater London",
      postalCode: "UB10 9BZ",
      addressCountry: "GB",
    });
  });
});

describe("buildOrganization foundingDate", () => {
  it("emits foundingDate only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const withDate = buildOrganization({ ...ORG_INPUT, foundingDate: "2018" }, ids);
    const withoutDate = buildOrganization(ORG_INPUT, ids);

    expect(withDate.foundingDate).toBe("2018");
    expect(withoutDate.foundingDate).toBeUndefined();
  });
});

describe("buildOrganization aggregateRating", () => {
  it("preserves a string-typed rating verbatim, not coerced to a number", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization(
      { ...ORG_INPUT, aggregateRating: { ratingValue: "5.0", reviewCount: "411" } },
      ids,
    );

    expect(node.aggregateRating).toEqual({
      "@type": "AggregateRating",
      bestRating: 5,
      worstRating: 1,
      ratingValue: "5.0",
      reviewCount: "411",
    });
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

  it("passes hasOfferCatalog through as-is, for an independent practitioner's own services", () => {
    const ids = createGraphIds(SITE_URL);
    const catalog = { "@type": "OfferCatalog", name: "Jane's services", itemListElement: [] };
    const person = buildPerson({ name: "Jane Doe", slug: "jane", hasOfferCatalog: catalog }, ids);

    expect(person.hasOfferCatalog).toBe(catalog);
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

describe("buildSoftwareApplication", () => {
  it("links publisher by @id and maps offers, only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const bare = buildSoftwareApplication(
      { slug: "acme-app", name: "Acme App", applicationCategory: "BusinessApplication" },
      ids,
    );
    const full = buildSoftwareApplication(
      {
        slug: "acme-app",
        name: "Acme App",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        publisherId: ids.org,
        offers: [{ name: "Starter", price: "45", priceCurrency: "GBP" }],
      },
      ids,
    );

    expect(bare["@id"]).toBe(ids.product("acme-app"));
    expect(bare.publisher).toBeUndefined();
    expect(bare.offers).toBeUndefined();
    expect(full.publisher).toEqual({ "@id": ids.org });
    expect(full.offers).toEqual([{ "@type": "Offer", name: "Starter", price: "45", priceCurrency: "GBP" }]);
  });
});

describe("buildBreadcrumbs", () => {
  it("omits item for a crumb with no url, per schema.org's own optionality", () => {
    const node = buildBreadcrumbs([
      { name: "Home", url: SITE_URL },
      { name: "Self-drive" },
      { name: "London" },
    ]);

    expect(node.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Self-drive" },
      { "@type": "ListItem", position: 3, name: "London" },
    ]);
  });
});

describe("buildProduct", () => {
  it("omits offers for a rate-on-application product and includes it otherwise", () => {
    const ids = createGraphIds(SITE_URL);
    const poa = buildProduct(
      { slug: "huracan-london", name: "Huracán hire, London", url: `${SITE_URL}/huracan-london` },
      ids,
    );
    const priced = buildProduct(
      {
        slug: "huracan-london",
        name: "Huracán hire, London",
        url: `${SITE_URL}/huracan-london`,
        offers: { price: "1500", priceCurrency: "GBP", unitText: "DAY" },
      },
      ids,
    );

    expect(poa.offers).toBeUndefined();
    expect(priced.offers).toEqual({
      "@type": "Offer",
      priceCurrency: "GBP",
      price: "1500",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/huracan-london`,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "1500",
        priceCurrency: "GBP",
        unitText: "DAY",
      },
    });
  });

  it("preserves a string-typed aggregateRating verbatim, with no bestRating/worstRating defaults", () => {
    const ids = createGraphIds(SITE_URL);
    const product = buildProduct(
      {
        slug: "huracan-london",
        name: "Huracán hire, London",
        url: `${SITE_URL}/huracan-london`,
        aggregateRating: { ratingValue: "4.7", reviewCount: "180" },
      },
      ids,
    );

    expect(product.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.7",
      reviewCount: "180",
    });
  });

  it("has a stable @id distinct from other product slugs", () => {
    const ids = createGraphIds(SITE_URL);
    const product = buildProduct(
      { slug: "huracan-london", name: "Huracán hire, London", url: `${SITE_URL}/huracan-london` },
      ids,
    );

    expect(product["@id"]).toBe(ids.product("huracan-london"));
  });

  it("emits offers.seller as an @id ref when sellerId is given, omits it otherwise", () => {
    const ids = createGraphIds(SITE_URL);
    const withSeller = buildProduct(
      {
        slug: "the-journal",
        name: "The Self-Love Journal",
        url: `${SITE_URL}/journal`,
        offers: { price: "32", priceCurrency: "GBP", sellerId: ids.org },
      },
      ids,
    );
    const withoutSeller = buildProduct(
      {
        slug: "the-journal",
        name: "The Self-Love Journal",
        url: `${SITE_URL}/journal`,
        offers: { price: "32", priceCurrency: "GBP" },
      },
      ids,
    );

    expect(withSeller.offers).toMatchObject({ seller: { "@id": ids.org } });
    expect((withoutSeller.offers as Record<string, unknown>).seller).toBeUndefined();
  });
});

describe("buildOrganization areaServed", () => {
  it("emits free-text areaServed when no areaServedIds are given", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization({ ...ORG_INPUT, areaServed: "London" }, ids);

    expect(node.areaServed).toBe("London");
  });

  it("emits an array of anonymous City literals when areaServed is a string array", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization({ ...ORG_INPUT, areaServed: ["Brackley", "Banbury"] }, ids);

    expect(node.areaServed).toEqual([
      { "@type": "City", name: "Brackley" },
      { "@type": "City", name: "Banbury" },
    ]);
  });

  it("prefers areaServedIds as @id refs when both are given", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization(
      { ...ORG_INPUT, areaServed: "London", areaServedIds: [ids.place("london")] },
      ids,
    );

    expect(node.areaServed).toEqual([{ "@id": ids.place("london") }]);
  });

  it("emits a GeoCircle when areaServedGeoCircle is given and no areaServedIds", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization(
      { ...ORG_INPUT, areaServedGeoCircle: { latitude: 51.7, longitude: -0.9, radiusMeters: "15000" } },
      ids,
    );

    expect(node.areaServed).toEqual({
      "@type": "GeoCircle",
      geoMidpoint: { "@type": "GeoCoordinates", latitude: 51.7, longitude: -0.9 },
      geoRadius: "15000",
    });
  });

  it("prefers areaServedIds over areaServedGeoCircle when both are given", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization(
      {
        ...ORG_INPUT,
        areaServedIds: [ids.place("chinnor")],
        areaServedGeoCircle: { latitude: 51.7, longitude: -0.9, radiusMeters: "15000" },
      },
      ids,
    );

    expect(node.areaServed).toEqual([{ "@id": ids.place("chinnor") }]);
  });
});

describe("buildWebsite description", () => {
  it("emits description only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const withDescription = buildWebsite({ name: "Acme", url: SITE_URL, description: "A site." }, ids);
    const withoutDescription = buildWebsite({ name: "Acme", url: SITE_URL }, ids);

    expect(withDescription.description).toBe("A site.");
    expect(withoutDescription.description).toBeUndefined();
  });
});

describe("buildWebsite potentialAction", () => {
  it("emits potentialAction with an EntryPoint target and optional result", () => {
    const ids = createGraphIds(SITE_URL);
    const website = buildWebsite(
      {
        name: "Acme",
        url: SITE_URL,
        potentialAction: {
          type: "ReserveAction",
          targetUrlTemplate: `${SITE_URL}/booking`,
          resultType: "Reservation",
        },
      },
      ids,
    );

    expect(website.potentialAction).toEqual({
      "@type": "ReserveAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/booking` },
      result: { "@type": "Reservation" },
    });
  });

  it("omits potentialAction when not given", () => {
    const ids = createGraphIds(SITE_URL);
    const website = buildWebsite({ name: "Acme", url: SITE_URL }, ids);

    expect(website.potentialAction).toBeUndefined();
  });
});

describe("buildWebsite inLanguage", () => {
  it("emits inLanguage only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const withLang = buildWebsite({ name: "Acme", url: SITE_URL, inLanguage: "en-GB" }, ids);
    const withoutLang = buildWebsite({ name: "Acme", url: SITE_URL }, ids);

    expect(withLang.inLanguage).toBe("en-GB");
    expect(withoutLang.inLanguage).toBeUndefined();
  });
});

describe("buildWebsite speakable", () => {
  it("emits speakable only when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const withSpeakable = buildWebsite(
      { name: "Acme", url: SITE_URL, speakable: { cssSelector: ["h1", "[data-speakable]"] } },
      ids,
    );
    const withoutSpeakable = buildWebsite({ name: "Acme", url: SITE_URL }, ids);

    expect(withSpeakable.speakable).toEqual({
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "[data-speakable]"],
    });
    expect(withoutSpeakable.speakable).toBeUndefined();
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

  it("passes through areaServed and availableLanguage when provided", () => {
    const ids = createGraphIds(SITE_URL);
    const node = buildOrganization(
      {
        ...ORG_INPUT,
        contactPoint: [
          { contactType: "customer support", email: "hi@example.com", areaServed: "GB", availableLanguage: ["en"] },
        ],
      },
      ids,
    );

    expect(node.contactPoint).toEqual([
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hi@example.com",
        areaServed: "GB",
        availableLanguage: ["en"],
      },
    ]);
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
