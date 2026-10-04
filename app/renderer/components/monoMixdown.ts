/**
 * What a voice plays, as the write puts it on the card (#569). Stereo is a
 * voice setting, not a sample property: a voice in a stereo pair plays a
 * sample as it is, and a mono voice gets a sample with more than one
 * channel mixed down to one, the way the write does (`convertToMono` in
 * `electron/main/formatConverter.ts`: the average of the channels). The
 * file's channel count only says whether there is anything to mix.
 */
export function bufferForVoice(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  stereo: boolean,
): AudioBuffer {
  if (stereo || buffer.numberOfChannels < 2) return buffer;
  return mixDownToMono(ctx, buffer);
}

/** One channel holding the average of the buffer's channels */
export function mixDownToMono(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
): AudioBuffer {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, ch) =>
    buffer.getChannelData(ch),
  );
  const mono = ctx.createBuffer(1, buffer.length, buffer.sampleRate);
  const out = mono.getChannelData(0);
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (const data of channels) sum += data[i];
    out[i] = sum / channels.length;
  }
  return mono;
}
