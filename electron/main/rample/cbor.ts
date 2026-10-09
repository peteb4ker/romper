// A CBOR (RFC 8949) codec for the subset the Rample writes to `_save`
// (#788): unsigned and negative integers, text, arrays, maps with text keys,
// false, true and null, all with definite lengths. Anything else that is
// still well formed (a float, a byte string, a tag, another simple value,
// an integer beyond a safe JavaScript number, a map with a non-text key) is
// kept as an opaque item with its original bytes.
//
// The encoder writes what the device writes: integers and lengths in their
// shortest form, definite lengths, and map keys in the order the Map has
// them. It never sorts keys: the device orders them byte by byte
// ("assignments" before "env"), which isn't RFC 8949's deterministic order
// (shorter keys first), so sorting would change the bytes. Decoding a file
// the device wrote and encoding the result gives back the same bytes.
//
// See docs/developer/rample-save-integration.md, "CBOR library".

import type {
  RampleOpaqueItem,
  RampleRawValue,
} from "@romper/shared/rampleSave.js";

/** Limits that keep a damaged card from hanging or exhausting main. */
export interface CborDecodeLimits {
  /** Largest input, in bytes */
  maxBytes: number;
  /** Deepest nesting of arrays, maps and tags */
  maxDepth: number;
}

export const DEFAULT_CBOR_LIMITS: CborDecodeLimits = {
  maxBytes: 64 * 1024,
  maxDepth: 16,
};

/** Input that isn't one well-formed CBOR item Romper can decode. */
export class CborDecodeError extends Error {
  constructor(
    message: string,
    /** Where in the input the problem was found */
    readonly offset: number,
  ) {
    super(`${message} (at byte ${offset})`);
    this.name = "CborDecodeError";
  }
}

const MAJOR_UNSIGNED = 0;
const MAJOR_NEGATIVE = 1;
const MAJOR_BYTES = 2;
const MAJOR_TEXT = 3;
const MAJOR_ARRAY = 4;
const MAJOR_MAP = 5;
const MAJOR_TAG = 6;
const MAJOR_SIMPLE = 7;

const SIMPLE_FALSE = 20;
const SIMPLE_TRUE = 21;
const SIMPLE_NULL = 22;
const INDEFINITE = 31;

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

class Decoder {
  offset = 0;

  constructor(
    private readonly bytes: Uint8Array,
    private readonly maxDepth: number,
  ) {}

  /** The item starting at the current offset */
  item(depth: number): RampleRawValue {
    if (depth > this.maxDepth) {
      throw new CborDecodeError(
        `Items are nested more than ${this.maxDepth} deep`,
        this.offset,
      );
    }
    const start = this.offset;
    const initial = this.byte();
    const major = initial >> 5;
    const info = initial & 0x1f;

    if (major === MAJOR_SIMPLE) return this.simple(start, info);

    if (info === INDEFINITE) {
      throw new CborDecodeError(
        major === MAJOR_UNSIGNED ||
          major === MAJOR_NEGATIVE ||
          major === MAJOR_TAG
          ? "An integer or tag can't have an indefinite length"
          : "Indefinite lengths aren't supported",
        start,
      );
    }
    const argument = this.argument(info, start);

    switch (major) {
      case MAJOR_ARRAY:
        return this.array(argument, depth, start);
      case MAJOR_BYTES:
        this.take(this.count(argument, "bytes", start));
        return this.opaque(start, major);
      case MAJOR_MAP:
        return this.map(argument, depth, start);
      case MAJOR_NEGATIVE:
        return argument < BigInt(Number.MAX_SAFE_INTEGER)
          ? -1 - Number(argument)
          : this.opaque(start, major);
      case MAJOR_TAG:
        // Keep the tag and what it wraps, whole
        this.item(depth + 1);
        return this.opaque(start, major);
      case MAJOR_TEXT:
        return this.text(this.count(argument, "bytes", start), start);
      default: // MAJOR_UNSIGNED
        return argument <= BigInt(Number.MAX_SAFE_INTEGER)
          ? Number(argument)
          : this.opaque(start, major);
    }
  }

  /** The head's argument: the value, length or count after the initial byte */
  private argument(info: number, start: number): bigint {
    if (info < 24) return BigInt(info);
    const widths: Record<number, number> = { 24: 1, 25: 2, 26: 4, 27: 8 };
    const width = widths[info];
    if (width === undefined) {
      throw new CborDecodeError(
        `Additional information ${info} is reserved`,
        start,
      );
    }
    let value = 0n;
    for (const byte of this.take(width)) {
      value = (value << 8n) | BigInt(byte);
    }
    return value;
  }

  private array(
    argument: bigint,
    depth: number,
    start: number,
  ): RampleRawValue[] {
    const length = this.count(argument, "items", start);
    const items: RampleRawValue[] = [];
    for (let i = 0; i < length; i++) items.push(this.item(depth + 1));
    return items;
  }

  private byte(): number {
    return this.take(1)[0];
  }

  /**
   * A length or count as a number, refused when the bytes left can't hold
   * it, so a damaged count can't make the decoder allocate or loop for
   * nothing
   */
  private count(
    argument: bigint,
    what: "bytes" | "entries" | "items",
    start: number,
  ): number {
    const left = this.bytes.length - this.offset;
    // An entry is a key and a value, so at least two bytes
    const minBytes = what === "entries" ? 2n : 1n;
    if (argument * minBytes > BigInt(left)) {
      throw new CborDecodeError(
        `The item declares ${argument} ${what}, but only ${left} bytes are left`,
        start,
      );
    }
    return Number(argument);
  }

  private map(
    argument: bigint,
    depth: number,
    start: number,
  ): Map<string, RampleRawValue> | RampleOpaqueItem {
    const length = this.count(argument, "entries", start);
    const map = new Map<string, RampleRawValue>();
    let textKeys = true;
    for (let i = 0; i < length; i++) {
      const keyOffset = this.offset;
      const key = this.item(depth + 1);
      const value = this.item(depth + 1);
      if (typeof key !== "string") {
        textKeys = false;
      } else if (map.has(key)) {
        throw new CborDecodeError(`The key "${key}" appears twice`, keyOffset);
      } else {
        map.set(key, value);
      }
    }
    return textKeys ? map : this.opaque(start, MAJOR_MAP);
  }

  private opaque(start: number, majorType: number): RampleOpaqueItem {
    return {
      bytes: this.bytes.slice(start, this.offset),
      majorType,
      opaque: true,
    };
  }

  private simple(start: number, info: number): RampleRawValue {
    if (info === SIMPLE_FALSE) return false;
    if (info === SIMPLE_TRUE) return true;
    if (info === SIMPLE_NULL) return null;
    if (info === INDEFINITE) {
      throw new CborDecodeError("A break with no indefinite item", start);
    }
    // Other simple values and floats: 24 takes 1 byte, 25-27 2, 4 or 8
    const widths: Record<number, number> = { 24: 1, 25: 2, 26: 4, 27: 8 };
    if (info >= 28) {
      throw new CborDecodeError(
        `Additional information ${info} is reserved`,
        start,
      );
    }
    this.take(widths[info] ?? 0);
    return this.opaque(start, MAJOR_SIMPLE);
  }

  /** The next `length` bytes, or a truncation error */
  private take(length: number): Uint8Array {
    const end = this.offset + length;
    if (end > this.bytes.length) {
      throw new CborDecodeError(
        "The file ends in the middle of an item",
        this.bytes.length,
      );
    }
    const slice = this.bytes.subarray(this.offset, end);
    this.offset = end;
    return slice;
  }

  private text(length: number, start: number): string {
    try {
      return utf8Decoder.decode(this.take(length));
    } catch (error) {
      if (error instanceof CborDecodeError) throw error;
      throw new CborDecodeError("A text string isn't valid UTF-8", start);
    }
  }
}

/**
 * Decode `bytes`, which must hold exactly one CBOR item: nothing missing,
 * nothing after it. Throws {@link CborDecodeError}, naming the byte offset,
 * for anything else.
 */
export function decodeCbor(
  bytes: Uint8Array,
  limits: CborDecodeLimits = DEFAULT_CBOR_LIMITS,
): RampleRawValue {
  if (bytes.length > limits.maxBytes) {
    throw new CborDecodeError(
      `The file is ${bytes.length} bytes, more than the ${limits.maxBytes} allowed`,
      0,
    );
  }
  if (bytes.length === 0) {
    throw new CborDecodeError("The file is empty", 0);
  }
  const decoder = new Decoder(bytes, limits.maxDepth);
  const value = decoder.item(0);
  if (decoder.offset !== bytes.length) {
    throw new CborDecodeError(
      `${bytes.length - decoder.offset} bytes follow the item`,
      decoder.offset,
    );
  }
  return value;
}

/**
 * Encode `value` as the device would: shortest-form integers and lengths,
 * definite lengths, map keys in the Map's order. Opaque items are written
 * back byte for byte. Throws for a number that isn't a safe integer.
 */
export function encodeCbor(value: RampleRawValue): Uint8Array {
  const chunks: Uint8Array[] = [];
  encodeInto(value, chunks);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** True for an item {@link decodeCbor} kept whole because it's outside the subset. */
export function isOpaqueItem(value: unknown): value is RampleOpaqueItem {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<RampleOpaqueItem>).opaque === true
  );
}

function encodeInto(value: RampleRawValue, chunks: Uint8Array[]): void {
  if (value === false) {
    chunks.push(Uint8Array.of(0xe0 | SIMPLE_FALSE));
  } else if (value === true) {
    chunks.push(Uint8Array.of(0xe0 | SIMPLE_TRUE));
  } else if (value === null) {
    chunks.push(Uint8Array.of(0xe0 | SIMPLE_NULL));
  } else if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`Can't encode ${value}: only safe integers`);
    }
    chunks.push(
      value >= 0
        ? head(MAJOR_UNSIGNED, value)
        : head(MAJOR_NEGATIVE, -1 - value),
    );
  } else if (typeof value === "string") {
    const text = utf8Encoder.encode(value);
    chunks.push(head(MAJOR_TEXT, text.length), text);
  } else if (Array.isArray(value)) {
    chunks.push(head(MAJOR_ARRAY, value.length));
    for (const item of value) encodeInto(item, chunks);
  } else if (value instanceof Map) {
    chunks.push(head(MAJOR_MAP, value.size));
    for (const [key, item] of value) {
      encodeInto(key, chunks);
      encodeInto(item, chunks);
    }
  } else {
    chunks.push(value.bytes);
  }
}

/** A head in its shortest form: the major type and its argument */
function head(major: number, argument: number): Uint8Array {
  const type = major << 5;
  if (argument < 24) return Uint8Array.of(type | argument);
  if (argument < 0x100) return Uint8Array.of(type | 24, argument);
  if (argument < 0x10000) {
    return Uint8Array.of(type | 25, argument >> 8, argument & 0xff);
  }
  if (argument < 0x100000000) {
    const out = new Uint8Array(5);
    out[0] = type | 26;
    new DataView(out.buffer).setUint32(1, argument);
    return out;
  }
  const out = new Uint8Array(9);
  out[0] = type | 27;
  new DataView(out.buffer).setBigUint64(1, BigInt(argument));
  return out;
}
