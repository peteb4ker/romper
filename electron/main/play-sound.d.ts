declare module "play-sound" {
  interface PlaySoundOptions {
    [key: string]: unknown;
    player?: string;
    players?: string[];
  }
  interface PlaySoundPlayer {
    play(
      file: string,
      options?: PlaySoundOptions,
      callback?: (err?: Error) => void,
    ): unknown;
    play(file: string, callback?: (err?: Error) => void): unknown;
  }
  function playSound(options?: PlaySoundOptions): PlaySoundPlayer;
  export = playSound;
}
