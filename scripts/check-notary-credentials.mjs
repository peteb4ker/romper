#!/usr/bin/env node
/**
 * Check the App Store Connect API key the macOS notarize step uses, before
 * a release builds anything (RE-18). v1.3.0 was lost to an expired Apple
 * agreement that only showed up as a 403 at notarize time, after every
 * platform had built.
 *
 *   ASC_API_KEY_JSON='{...}' node scripts/check-notary-credentials.mjs
 *
 * ASC_API_KEY_JSON is the output of `rcodesign
 * encode-app-store-connect-api-key` (issuer_id, key_id, private_key), where
 * private_key is the base64 of the .p8 key's PKCS#8 DER (#719). The
 * check signs a short-lived token with the key and lists notary
 * submissions: a bad key gets 401, a missing or expired agreement 403.
 */
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const NOTARY_SUBMISSIONS =
  "https://appstoreconnect.apple.com/notary/v2/submissions";

/**
 * ASC_API_KEY_JSON, as rcodesign writes it
 * @typedef {{ issuer_id: string, key_id: string, private_key: string }} NotaryKey
 *
 * The part of `fetch` the check uses, so tests can answer for Apple
 * @typedef {(url: string, init: { headers: Record<string, string> }) => Promise<{ json(): Promise<unknown>, ok: boolean, status: number }>} Fetch
 */

/**
 * Check the key; resolves to { ok, message }.
 * @param {string | undefined} keyJson ASC_API_KEY_JSON
 * @param {Fetch} [fetchImpl]
 * @returns {Promise<{ message: string, ok: boolean }>}
 */
export async function checkNotaryCredentials(keyJson, fetchImpl = fetch) {
  let key;
  try {
    key = JSON.parse(keyJson ?? "");
  } catch {
    return { message: "ASC_API_KEY_JSON is not valid JSON", ok: false };
  }
  const missing = ["issuer_id", "key_id", "private_key"].filter(
    (field) => !key?.[field],
  );
  if (missing.length > 0) {
    return {
      message: `ASC_API_KEY_JSON is missing ${missing.join(", ")}`,
      ok: false,
    };
  }

  let token;
  try {
    token = notaryToken(key);
  } catch (error) {
    return { message: /** @type {Error} */ (error).message, ok: false };
  }

  let response;
  try {
    response = await fetchImpl(`${NOTARY_SUBMISSIONS}?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    return {
      message: `Couldn't reach Apple's notary service: ${/** @type {Error} */ (error).message}`,
      ok: false,
    };
  }
  if (response.ok) {
    return { message: "App Store Connect accepted the notary key", ok: true };
  }

  const detail = await appleErrorDetail(response);
  const reason =
    response.status === 401
      ? "Apple rejected the API key (revoked, or the wrong issuer or key ID)"
      : response.status === 403
        ? "Apple refused the request; a required agreement may be missing or expired, which the Apple Developer account holder must accept"
        : `Apple's notary service answered ${response.status}`;
  return { message: detail ? `${reason}: ${detail}` : reason, ok: false };
}

/**
 * An ES256 token App Store Connect accepts for 10 minutes.
 * @param {NotaryKey} key
 * @param {number} [now] epoch milliseconds
 */
export function notaryToken(key, now = Date.now()) {
  /** @param {object} value */
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const issuedAt = Math.floor(now / 1000);
  const unsigned = `${encode({ alg: "ES256", kid: key.key_id, typ: "JWT" })}.${encode(
    {
      aud: "appstoreconnect-v1",
      exp: issuedAt + 600,
      iat: issuedAt,
      iss: key.issuer_id,
    },
  )}`;
  const signature = crypto.sign("sha256", Buffer.from(unsigned), {
    dsaEncoding: "ieee-p1363",
    key: notaryPrivateKey(key.private_key),
  });
  return `${unsigned}.${signature.toString("base64url")}`;
}

export const UNREADABLE_KEY =
  "ASC_API_KEY_JSON private_key couldn't be read as a PKCS#8 key";

/**
 * The signing key from ASC_API_KEY_JSON's private_key. rcodesign stores the
 * base64 of the .p8 file's PKCS#8 DER; PEM text, raw or base64-encoded, is
 * accepted too. Throws UNREADABLE_KEY, never the key, when none of them fit.
 * @param {string} privateKey
 */
export function notaryPrivateKey(privateKey) {
  try {
    const text = String(privateKey);
    if (text.includes("-----BEGIN")) {
      return crypto.createPrivateKey(text);
    }
    const decoded = Buffer.from(text, "base64");
    const decodedText = decoded.toString("utf8");
    if (decodedText.includes("-----BEGIN")) {
      return crypto.createPrivateKey(decodedText);
    }
    return crypto.createPrivateKey({
      format: "der",
      key: decoded,
      type: "pkcs8",
    });
  } catch {
    throw new Error(UNREADABLE_KEY);
  }
}

/**
 * What Apple's error response says went wrong; empty if it doesn't say
 * @param {{ json(): Promise<unknown> }} response
 */
async function appleErrorDetail(response) {
  try {
    const body =
      /** @type {{ errors?: { detail?: string, title?: string }[] } | null} */ (
        await response.json()
      );
    return (body?.errors ?? [])
      .map((error) => error.detail ?? error.title)
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = await checkNotaryCredentials(process.env.ASC_API_KEY_JSON);
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(`::error::${result.message}`);
    process.exit(1);
  }
}
