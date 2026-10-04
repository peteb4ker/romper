import { describe, expect, it, vi } from "vitest";

import { bufferForVoice, mixDownToMono } from "../monoMixdown";

function buffer(channels: number[][]) {
  return {
    getChannelData: (ch: number) => new Float32Array(channels[ch]),
    length: channels[0].length,
    numberOfChannels: channels.length,
    sampleRate: 44100,
  } as unknown as AudioBuffer;
}

function context() {
  return {
    createBuffer: vi.fn((channels: number, length: number, rate: number) => {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length),
      );
      return {
        getChannelData: (ch: number) => data[ch],
        length,
        numberOfChannels: channels,
        sampleRate: rate,
      };
    }),
  } as unknown as BaseAudioContext;
}

describe("[UC-29] a voice's mono mix (#569)", () => {
  it("averages the channels into one, as the write does", () => {
    const mono = mixDownToMono(
      context(),
      buffer([
        [1, 0.5, 0, -1],
        [0, 0.5, 1, -1],
      ]),
    );

    expect(mono.numberOfChannels).toBe(1);
    expect(mono.sampleRate).toBe(44100);
    expect(Array.from(mono.getChannelData(0))).toEqual([0.5, 0.5, 0.5, -1]);
  });

  it("averages every channel of a file with more than two", () => {
    const mono = mixDownToMono(
      context(),
      buffer([
        [0.75, 0],
        [0, 0.75],
        [0, 0],
      ]),
    );

    expect(Array.from(mono.getChannelData(0))).toEqual([0.25, 0.25]);
  });

  it("mixes a stereo sample down on a mono voice", () => {
    const ctx = context();
    const stereo = buffer([
      [1, 0],
      [0, 1],
    ]);

    const played = bufferForVoice(ctx, stereo, false);

    expect(played.numberOfChannels).toBe(1);
  });

  it("plays a stereo sample as it is on a linked voice", () => {
    const ctx = context();
    const stereo = buffer([
      [1, 0],
      [0, 1],
    ]);

    expect(bufferForVoice(ctx, stereo, true)).toBe(stereo);
    expect(ctx.createBuffer).not.toHaveBeenCalled();
  });

  it("plays a mono sample as it is on either voice", () => {
    const ctx = context();
    const mono = buffer([[1, 0]]);

    expect(bufferForVoice(ctx, mono, false)).toBe(mono);
    expect(bufferForVoice(ctx, mono, true)).toBe(mono);
    expect(ctx.createBuffer).not.toHaveBeenCalled();
  });
});
