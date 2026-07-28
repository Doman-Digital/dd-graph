// `<`, `>`, `&`, and the two Unicode line-separator code points are escaped
// so a CMS-authored string (a testimonial quote, an FAQ answer) embedded in
// the graph can't break out of a <script> tag or form an invalid JS line
// terminator. This is the one piece of framework-specific-adjacent code kept
// generic here; the actual <script> tag (next/script vs plain <script>) is
// each site's own choice, so this package has no React/Next dependency.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export function escapeJsonLdForScript(json: string): string {
  return json
    .split("<").join("\\u003c")
    .split(">").join("\\u003e")
    .split("&").join("\\u0026")
    .split(LINE_SEPARATOR).join("\\u2028")
    .split(PARAGRAPH_SEPARATOR).join("\\u2029");
}
