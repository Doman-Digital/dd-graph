import { describe, expect, it } from "vitest";
import { escapeJsonLdForScript } from "../escape";

describe("escapeJsonLdForScript", () => {
  it("neutralizes </script> closure attacks", () => {
    const evil = JSON.stringify({ description: "Hi </script><img src=x onerror=alert(1)>" });
    const result = escapeJsonLdForScript(evil);

    expect(result).not.toContain("</script>");
    expect(result).not.toContain("</");
    expect(JSON.parse(result).description).toBe("Hi </script><img src=x onerror=alert(1)>");
  });

  it("escapes ampersands so HTML entities don't decode", () => {
    const result = escapeJsonLdForScript(JSON.stringify({ q: "tom & jerry" }));

    expect(result).not.toContain("&");
    expect(JSON.parse(result).q).toBe("tom & jerry");
  });

  it("escapes opening and closing angle brackets", () => {
    const result = escapeJsonLdForScript(JSON.stringify({ tag: "<b>bold</b>" }));

    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(JSON.parse(result).tag).toBe("<b>bold</b>");
  });

  it("escapes U+2028/U+2029 line/paragraph separators", () => {
    const result = escapeJsonLdForScript(
      JSON.stringify({ text: `line1${String.fromCharCode(0x2028)}line2${String.fromCharCode(0x2029)}line3` }),
    );

    expect(result).not.toContain(String.fromCharCode(0x2028));
    expect(result).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(result).text).toBe(
      `line1${String.fromCharCode(0x2028)}line2${String.fromCharCode(0x2029)}line3`,
    );
  });
});
