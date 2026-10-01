import { describe, expect, it, vi } from "vitest";

import { claimVoice, soundingCount } from "../voiceChoke";

describe("voiceChoke", () => {
  it("stops the voice's other sounds when one starts, at its start time", () => {
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = claimVoice(11, first);

    claimVoice(11, second, 1234);

    expect(first).toHaveBeenCalledWith(1234);
    expect(second).not.toHaveBeenCalled();
    expect(soundingCount(11)).toBe(1);
    releaseFirst(); // releasing a choked sound is harmless
    expect(soundingCount(11)).toBe(1);
  });

  it("leaves other voices alone", () => {
    const onVoice12 = vi.fn();
    claimVoice(12, onVoice12);

    claimVoice(13, vi.fn());

    expect(onVoice12).not.toHaveBeenCalled();
  });

  it("forgets a sound once released", () => {
    const ended = vi.fn();
    const release = claimVoice(14, ended);
    release();

    claimVoice(14, vi.fn());

    expect(ended).not.toHaveBeenCalled();
  });
});
