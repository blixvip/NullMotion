# Contributing to Null Motion

> 💬 **Before you open a PR, join the [blix open source Discord](https://discord.gg/grokbot).** It's the home for contributors across every blixvip repo: ask questions, run ideas by us, and talk through your PR.

Thanks for helping! Questions and ideas are welcome in the **[Discord](https://discord.gg/grokbot)**, and bugs go in [GitHub issues](https://github.com/blixvip/NullMotion/issues/new/choose).

## Your first PR in 10 minutes

1. **Get the code.** Fork the repo, then either [open it in Codespaces](https://codespaces.new/blixvip/NullMotion?quickstart=1) (Node 22, FFmpeg and Python 3 are set up for you) or clone your fork:
   ```sh
   git clone https://github.com/<you>/NullMotion.git && cd NullMotion
   ```
2. **Install.** Nothing to install: you only need Node.js 22+. No `npm install`.
3. **Run the checks.** Both must pass, before and after your change:
   ```sh
   npm test && npm run check
   ```
4. **Pick an issue.** Grab a [good first issue](https://github.com/blixvip/NullMotion/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and comment to claim it. Each one lists the files to touch.
5. **Make the change** on a branch (`git checkout -b fix-123`), and use `npm run dev` (http://127.0.0.1:4343) to see it in the browser.
6. **Open the PR** against `main` with `Fixes #123` in the description. CI runs the same two checks, and we review within 24 hours.

## Finding something to work on

- [Good first issues](https://github.com/blixvip/NullMotion/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are small and list the files to touch.
- [Help wanted](https://github.com/blixvip/NullMotion/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) issues are bigger.
- Comment on the issue to claim it so two people don't build the same thing. If you go quiet for a week, it opens up again.
- Have your own idea? Open a [Discussion](https://github.com/blixvip/NullMotion/discussions) first for anything larger than a bug fix.

By contributing, you agree your work is released under the project's [MIT License](LICENSE).

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

Made something with it? Show it off in the [Discord](https://discord.gg/grokbot).
