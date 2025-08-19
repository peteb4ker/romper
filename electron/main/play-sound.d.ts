declare module "play-sound" {
  interface PlaySoundOptions {
    [key: string]: any;
    player?: string;
    players?: string[];
  }
  interface PlaySoundPlayer {
    play(
      file: string,
      options?: PlaySoundOptions,
      callback?: (err?: Error) => void
    ): any;
    play(file: string, callback?: (err?: Error) => void): any;
  }
  function playSound(options?: PlaySoundOptions): PlaySoundPlayer;
  export = playSound;
}
