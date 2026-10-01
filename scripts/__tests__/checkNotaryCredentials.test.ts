// @vitest-environment node
import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  checkNotaryCredentials,
  notaryToken,
} from "../check-notary-credentials.mjs";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
});
const KEY = {
  issuer_id: "69a6de7e-1111-2222-3333-444455556666",
  key_id: "ABC123DEFG",
  private_key: privateKey.export({ format: "pem", type: "pkcs8" }) as string,
};
const KEY_JSON = JSON.stringify(KEY);

function answer(status: number, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  });
}

describe("notaryToken", () => {
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
    expect(
      crypto.verify(
        "sha256",
        Buffer.from(`${header}.${payload}`),
        { dsaEncoding: "ieee-p1363", key: publicKey },
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
  });
});

describe("checkNotaryCredentials (RE-18)", () => {
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
