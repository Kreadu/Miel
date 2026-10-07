// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { isCompanyLogoUrl, loadPdfLogo } from "./pdf-logo";

const BASE = "https://abc.supabase.co";
const OK_URL = `${BASE}/storage/v1/object/public/company-logos/t1/logo.png`;

describe("isCompanyLogoUrl (S26-03)", () => {
  it("acepta solo el bucket company-logos del propio proyecto", () => {
    expect(isCompanyLogoUrl(OK_URL, BASE)).toBe(true);
    expect(isCompanyLogoUrl("https://evil.co/storage/v1/object/public/company-logos/x.png", BASE)).toBe(false);
    expect(isCompanyLogoUrl(`${BASE}/storage/v1/object/public/product-photos/x.png`, BASE)).toBe(false);
    expect(isCompanyLogoUrl(`${BASE}/storage/v1/object/public/company-logos/../secret`, BASE)).toBe(false);
    expect(isCompanyLogoUrl("no es url", BASE)).toBe(false);
    expect(isCompanyLogoUrl(OK_URL, "")).toBe(false);
  });
});

describe("loadPdfLogo (S26-03)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(type: string, ok = true) {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: ok ? 200 : 404, headers: { "content-type": type } }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("PNG y JPG se usan; WEBP no (react-pdf no lo lee)", async () => {
    stubFetch("image/png");
    expect(await loadPdfLogo(OK_URL, BASE)).toMatchObject({ format: "png" });
    stubFetch("image/jpeg");
    expect(await loadPdfLogo(OK_URL, BASE)).toMatchObject({ format: "jpg" });
    stubFetch("image/webp");
    expect(await loadPdfLogo(OK_URL, BASE)).toBeNull();
  });

  it("sin logo, URL ajena o descarga fallida → null sin pedir nada afuera", async () => {
    const fetchMock = stubFetch("image/png", false);
    expect(await loadPdfLogo(null, BASE)).toBeNull();
    expect(await loadPdfLogo("https://evil.co/x.png", BASE)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await loadPdfLogo(OK_URL, BASE)).toBeNull();
  });
});
