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
export function createGraphIds(siteUrl: string) {
  const url = siteUrl.replace(/\/$/, "");
  return {
    org: `${url}/#organization`,
    website: `${url}/#website`,
    person: (slug: string) => `${url}/#person-${slug}`,
    service: (slug: string) => `${url}/#service-${slug}`,
    place: (slug: string) => `${url}/#place-${slug}`,
    article: (slug: string) => `${url}/#article-${slug}`,
    breadcrumb: (path: string) => `${url}${path}#breadcrumb`,
    /** Page-identity nodes (WebPage/ContactPage/CollectionPage) are inherently
     * page-scoped, same reasoning as `breadcrumb`. */
    webpage: (path: string) => `${url}${path}#webpage`,
  };
}

export type GraphIds = ReturnType<typeof createGraphIds>;
