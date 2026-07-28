export type JsonLdNode = Record<string, unknown>;
export type JsonLdGraph = { "@context": "https://schema.org"; "@graph": JsonLdNode[] };

// Compose a final <script> graph from one-or-more nodes, dropping any that
// weren't built (conditional nodes return null upstream).
export function buildGraph(nodes: Array<JsonLdNode | null | undefined>): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter((n): n is JsonLdNode => Boolean(n)),
  };
}

// A "pure ref" is exactly the shape our node builders emit for a relation:
// {'@id': 'https://...'} and nothing else. Full nodes always carry more than
// just '@id' (at minimum '@type'), so this can't mistake a node for a ref.
function isPureRef(value: unknown): value is { "@id": string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length === 1 && keys[0] === "@id" && typeof (value as Record<string, unknown>)["@id"] === "string";
}

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
export function findGraphIssues(graph: JsonLdGraph): string[] {
  const issues: string[] = [];
  const idCounts = new Map<string, number>();

  for (const node of graph["@graph"]) {
    const id = node["@id"];
    if (typeof id === "string") {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  }
  for (const [id, count] of idCounts) {
    if (count > 1) issues.push(`duplicate @id (${count}×): ${id}`);
  }

  const definedIds = new Set(idCounts.keys());

  const walk = (value: unknown, path: string) => {
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
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, `${path}.${key}`);
      }
    }
  };

  graph["@graph"].forEach((node, index) => walk(node, `@graph[${index}]`));

  return issues;
}
