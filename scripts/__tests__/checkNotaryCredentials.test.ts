// @vitest-environment node
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  checkNotaryCredentials,
  notaryToken,
  UNREADABLE_KEY,
} from "../check-notary-credentials.mjs";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const PEM = privateKey.export({ format: "pem", type: "pkcs8" }) as string;
const DER = privateKey.export({ format: "der", type: "pkcs8" });
// What `rcodesign encode-app-store-connect-api-key` writes: the base64 of
// the .p8 file's PKCS#8 DER (UnifiedApiKey::from_ecdsa_pem_path).
const RCODESIGN_KEY = DER.toString("base64");
const KEY = {
  issuer_id: "69a6de7e-1111-2222-3333-444455556666",
  key_id: "ABC123DEFG",
  private_key: RCODESIGN_KEY,
};
const KEY_JSON = JSON.stringify(KEY);
const GARBAGE_KEY = "bm90IGEga2V5"; // base64 of "not a key"

function answer(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  });
}

function signedByKey(token: string) {
  const [header, payload, signature] = token.split(".");
  return crypto.verify(
    "sha256",
    Buffer.from(`${header}.${payload}`),
    { dsaEncoding: "ieee-p1363", key: publicKey },
    Buffer.from(signature, "base64url"),
  );
}

describe("[Q-05] notaryToken", () => {
  it("is an ES256 token for App Store Connect, signed by the key", () => {
    const now = Date.UTC(2026, 9, 1);
    const [header, payload, signature] = notaryToken(KEY, now).split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "ABC123DEFG",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      aud: "appstoreconnect-v1",
      exp: now / 1000 + 600,
      iat: now / 1000,
      iss: KEY.issuer_id,
    });
    expect(signedByKey(`${header}.${payload}.${signature}`)).toBe(true);
  });

  it.each([
    ["base64 of PKCS#8 DER, as rcodesign writes it", RCODESIGN_KEY],
    ["PEM text", PEM],
    ["base64 of PEM text", Buffer.from(PEM).toString("base64")],
  ])("reads a private_key that is %s (#719)", (_encoding, private_key) => {
    expect(signedByKey(notaryToken({ ...KEY, private_key }))).toBe(true);
  });

  it("says the key is unreadable without printing it", () => {
    expect(() => notaryToken({ ...KEY, private_key: GARBAGE_KEY })).toThrow(
      new Error(UNREADABLE_KEY),
    );
  });
});

describe("[Q-05] checkNotaryCredentials (RE-18)", () => {
  it("passes when Apple accepts the key", async () => {
    const fetchImpl = answer(200, { data: [] });

    const result = await checkNotaryCredentials(KEY_JSON, fetchImpl);

    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      "https://appstoreconnect.apple.com/notary/v2/submissions?limit=1",
    );
    expect(init.headers.Authorization).toMatch(
      /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/,
    );
  });

  it("explains an expired agreement, with Apple's words", async () => {
    const result = await checkNotaryCredentials(
      KEY_JSON,
      answer(403, {
        errors: [{ detail: "A required agreement is missing or has expired." }],
      }),
    );

    expect(result).toEqual({
      message:
        "Apple refused the request; a required agreement may be missing or expired, which the Apple Developer account holder must accept: A required agreement is missing or has expired.",
      ok: false,
    });
  });

  it("explains a rejected key", async () => {
    const result = await checkNotaryCredentials(KEY_JSON, answer(401));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Apple rejected the API key");
  });

  it("fails when Apple can't be reached", async () => {
    const result = await checkNotaryCredentials(
      KEY_JSON,
      vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")),
    );
    expect(result).toEqual({
      message: "Couldn't reach Apple's notary service: getaddrinfo ENOTFOUND",
      ok: false,
    });
  });

  it("explains a private_key it can't read, without calling Apple", async () => {
    const fetchImpl = vi.fn();

    const result = await checkNotaryCredentials(
      JSON.stringify({ ...KEY, private_key: GARBAGE_KEY }),
      fetchImpl,
    );

    expect(result).toEqual({
      message: "ASC_API_KEY_JSON private_key couldn't be read as a PKCS#8 key",
      ok: false,
    });
    expect(result.message).not.toContain(GARBAGE_KEY);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "ASC_API_KEY_JSON is not valid JSON"],
    ["not json", "ASC_API_KEY_JSON is not valid JSON"],
    [
      JSON.stringify({ key_id: "x" }),
      "ASC_API_KEY_JSON is missing issuer_id, private_key",
    ],
  ])("rejects a malformed key (%s)", async (json, message) => {
    const fetchImpl = vi.fn();
    expect(await checkNotaryCredentials(json, fetchImpl)).toEqual({
      message,
      ok: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
