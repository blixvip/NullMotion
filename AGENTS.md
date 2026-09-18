# Null

This is an independent public UI starter. Keep its history, configuration, and data separate from the original Null Motion project.

- Use Node.js 22+; `npm start`, `npm run check`, and `npm test` are the project commands.
- Browser requests must use this project's origin. Never hardcode another local companion or copy personal databases, credentials, renders, or provider settings.
- Preserve the inherited interface. Verify UI changes in a real browser at narrow and wide widths.
- Generation, rendering, and Premiere are unconnected. Keep UI status honest until those services exist.
- The launch preview (`demo.html`: full reference on top, super-simple black-and-white HyperFrames drafts per section from `drafts.mjs`, a playhead across equal-size draft cards, frame-accurate MP4 export) is the homepage; the launch editor lives at `/editor`. Reference media is explicitly imported for the local promotion demo and stays in ignored `.local-media/` and `public/references/` directories. Do not publish it automatically.
- The only published references are the three in `showcase/` (Infinite, SaaS launch sequence, Motion study 08), chosen by the owner and built by `npm run showcase`. The server falls back to `showcase/` when the local library is absent. Never add another reference to `showcase/` or Git without the owner's explicit choice.
- Imported segments are non-destructive time ranges. Preserve the original source videos. The preview is browser composition, not AI generation.
- Preserve bundled third-party notices. Do not introduce a project license without the owner's decision.
