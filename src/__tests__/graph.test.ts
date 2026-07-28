import { describe, expect, it } from "vitest";
import { createGraphIds } from "../ids";
import { buildGraph, findGraphIssues } from "../graph";
import {
  buildArticle,
  buildBreadcrumbs,
  buildOfferCatalog,
  buildOrganization,
  buildPerson,
  buildPlace,
  buildService,
  buildSpine,
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
