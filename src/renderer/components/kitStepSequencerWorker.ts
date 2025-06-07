// kitStepSequencerWorker.ts
// Web Worker for step sequencer timing and step events

let isPlaying = false;
let currentStep = 0;
let numSteps = 16;
let interval: number | null = null;
let stepDuration = 125; // ms

self.onmessage = function (e) {
  const { type, payload } = e.data;
  if (type === "START") {
    isPlaying = true;
    numSteps = payload.numSteps || 16;
    stepDuration = payload.stepDuration || 125;
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      if (!isPlaying) return;
      currentStep = (currentStep + 1) % numSteps;
      self.postMessage({ type: "STEP", payload: { currentStep } });
    }, stepDuration);
  } else if (type === "STOP") {
    isPlaying = false;
    if (interval) clearInterval(interval);
    interval = null;
    currentStep = 0;
    self.postMessage({ type: "STEP", payload: { currentStep } });
  } else if (type === "SET_STEP") {
    currentStep = payload.currentStep;
  }
};
