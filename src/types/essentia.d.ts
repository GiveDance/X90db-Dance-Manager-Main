declare module "essentia.js/dist/essentia-wasm.es.js" {
  export const EssentiaWASM: {
    calledRun?: boolean;
    onRuntimeInitialized?: () => void;
  };
}

declare module "essentia.js/dist/essentia.js-core.es.js" {
  interface EssentiaVector {
    delete?: () => void;
  }

  interface RhythmExtractorResult {
    bpm: number;
    confidence: number;
    ticks: EssentiaVector;
  }

  interface EssentiaInstance {
    arrayToVector(values: Float32Array): EssentiaVector;
    vectorToArray(vector: EssentiaVector): ArrayLike<number>;
    RhythmExtractor2013(
      signal: EssentiaVector,
      maxTempo: number,
      method: string,
      minTempo: number,
    ): RhythmExtractorResult;
  }

  const Essentia: new (wasm: unknown) => EssentiaInstance;
  export default Essentia;
}
