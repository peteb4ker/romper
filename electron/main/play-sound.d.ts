declare module "play-sound" {
  interface PlaySoundOptions {
    player?: string;
    players?: string[];
    [key: string]: any;
  }
  interface PlaySoundPlayer {
    play(
      file: string,
      options?: PlaySoundOptions,
      callback?: (err?: Error) => void,
    ): any;
    play(file: string, callback?: (err?: Error) => void): any;
  }
  function playSound(options?: PlaySoundOptions): PlaySoundPlayer;
  export = playSound;
}
