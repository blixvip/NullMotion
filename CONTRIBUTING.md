# Contributing to Null Motion

Thanks for helping! Questions and ideas are welcome in the **[Discord](https://discord.gg/zEB4VjmfSb)**, and bugs go in [GitHub issues](https://github.com/blixvip/NullMotion/issues/new/choose).

## Setup

You need **Node.js 22+**. There are no dependencies, so there's no `npm install` step.

```sh
git clone https://github.com/<you>/NullMotion.git
cd NullMotion
npm run dev        # http://127.0.0.1:4343, restarts on change
```

Use **Chrome or Edge** to test MP4 export. FFmpeg/ffprobe and Python 3 are only needed for the import, section, and showcase scripts (see the README).

## Before you open a pull request

```sh
npm test           # node --test
npm run check      # syntax-checks every UI file and blocks hardcoded local companion URLs
```

- Keep changes small and focused. One fix or feature per pull request.
- Check UI changes in a real browser at narrow and wide widths, and add a screenshot or GIF.
- Don't add runtime dependencies, API keys, or calls to other origins. The browser only talks to this project's own server.
- Don't commit reference footage. Imported media lives in the ignored `.local-media/` and `public/references/` folders, and `showcase/` holds only the three published references.
- Keep UI status honest: generation, rendering, and Premiere are not connected in this repo.
- Keep the bundled third-party notices in `THIRD_PARTY_NOTICES.md`.

## Where things live

- `public/demo.*`: the preview page and MP4 exporter (the homepage)
- `public/drafts.mjs`: the HyperFrames draft engine. New beat kinds go here.
- `server.js`, `media.js`: static server, byte-range streaming, audio extraction
- `scripts/`: import, section planning, showcase, waveforms, checks
- `test/`: Node test runner tests

Made something with it? Show it off in the [Discord](https://discord.gg/zEB4VjmfSb).
