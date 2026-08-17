# Rhythm Analysis Baseline

- Treat the current `src/lib/beatDetection.ts`, `src/lib/beatDetection.legacy.ts`, and `src/lib/audioOnset.ts` implementation as the approved rhythm-analysis baseline.
- Do not modify the analysis chain, fallback behavior, beat data, BPM, offset, onset detection, or parser persistence without an explicit user request to change the parser.
- Learning, Performing, stage templates, countdowns, timelines, and visual effects may only consume rhythm-analysis output. They must not rewrite or reinterpret the parsed rhythm data.
- The approved analyzer priority is desktop madmom, browser Essentia, then the legacy Web Audio fallback.
