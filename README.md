<p align="center">
  <img src="docs/logo.png" width="96" alt="Null logo">
</p>

<h1 align="center">Null Motion</h1>

<p align="center">
  <b>See how a finished motion-graphics ad was built — draft by draft, frame by frame.<br>
  Final film on top. Rough HyperFrames drafts underneath. Export the breakdown as one MP4.</b>
</p>

<p align="center">
  <a href="https://discord.gg/grokbot"><img src="https://img.shields.io/badge/Join%20the%20Discord-questions%2C%20help%2C%20show%20your%20renders-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join the Discord: questions, help, show your renders"></a>
</p>

<p align="center">
  <a href="https://github.com/blixvip/NullMotion/stargazers"><img src="https://img.shields.io/github/stars/blixvip/NullMotion?style=flat-square&color=ff5a1f" alt="GitHub stars"></a>
  <a href="https://github.com/blixvip/NullMotion/releases"><img src="https://img.shields.io/github/v/release/blixvip/NullMotion?style=flat-square&color=111" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/license-MIT-111?style=flat-square" alt="MIT License">
  <a href="https://github.com/blixvip/NullMotion/contribute"><img src="https://img.shields.io/github/issues/blixvip/NullMotion/good%20first%20issue?style=flat-square&color=ff5a1f&label=good%20first%20issues" alt="Good first issues"></a>
  <img src="https://img.shields.io/badge/node-22%2B-111?style=flat-square" alt="Node 22+">
  <img src="https://img.shields.io/badge/dependencies-none-111?style=flat-square" alt="No runtime dependencies">
  <img src="https://img.shields.io/badge/export-MP4%20%C2%B7%20WebCodecs-ff5a1f?style=flat-square" alt="MP4 export with WebCodecs">
</p>

<p align="center">
  <sub>If this helps you study or pitch motion work, a <a href="https://github.com/blixvip/NullMotion">⭐</a> makes it easier for others to find.</sub>
</p>

<p align="center">
  <img src="docs/demo-infinite.webp" width="820" alt="The Infinite ad playing on top, its black-and-white drafts underneath, in sync">
</p>

<p align="center">
  <sub>Top: the finished ad. Bottom: one plain black-and-white HyperFrames draft per section. The playhead and the orange outline follow the film frame for frame.</sub>
</p>

<p align="center">
  🛠 <b>Built in the open</b> —
  <a href="https://github.com/blixvip/NullMotion/graphs/contributors"><img src="https://img.shields.io/github/contributors/blixvip/NullMotion?style=flat-square&color=111&label=contributors" alt="Contributors" align="absmiddle"></a>
  <a href="https://github.com/blixvip/NullMotion/contribute"><img src="https://img.shields.io/github/issues/blixvip/NullMotion/good%20first%20issue?style=flat-square&color=ff5a1f&label=good%20first%20issues" alt="Good first issues" align="absmiddle"></a>
  · we review PRs within 24h → <a href="https://github.com/blixvip/NullMotion/issues/13"><b>start here</b></a>
</p>

## Quick start

```sh
git clone https://github.com/blixvip/NullMotion.git && cd NullMotion
npm start                # Node 22+, nothing to install
```

Then open **<http://127.0.0.1:4343>**, pick a reference, and press **Download → Whole preview** (Chrome or Edge) to get the MP4.

No `npm install`, no API keys, no account. Three references ship with the repo, so it works on the first run.

> **Not the same as Null Studio.** This repo is the free, local launch-film preview. Pause cuts, captions, and YouTube, Twitch, and Kick clips are **Null Studio**, a separate hosted product at [nullmotion.com](https://www.nullmotion.com/). They are not in this code.

<p align="center">
  <a href="#what-it-does">What it does</a> ·
  <a href="#showcase">Showcase</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#bring-your-own-references">Bring your own references</a> ·
  <a href="#faq-and-troubleshooting">FAQ</a> ·
  <a href="#project-layout">Project layout</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#community">Community</a>
</p>

---

## What it does

Motion-graphics ads look effortless, but every one starts as a rough plan: which idea goes in which section, and when each move lands. Null Motion puts that plan and the finished film side by side, so you can study how a great ad is built, pitch a concept, or export the whole breakdown as one video.

- **The final film on top.** The full ad, full width, playing on a loop.
- **Its drafts underneath.** Each section (Hook, Reveal, App, End card…) has a plain HyperFrames scene: black and white, Arial type, flat shapes, one simple move. It shows the idea before the polish.
- **Everything in sync.** A playhead runs across the drafts. The draft for the section on screen follows the film frame for frame and gets an orange outline. The others keep looping their own part.
- **One-click export.** **Download → Whole preview** renders the film and its drafts frame by frame into a 1920-wide, 24 Mbps MP4 with the film's audio.

<p align="center">
  <img src="docs/screenshot.jpg" width="820" alt="The Null Motion page: film, drafts, and the video library">
</p>

## Showcase

The repo ships three references with their drafts, ready to play:

| | Reference | Length | Drafts |
|---|---|---|---|
| <img src="showcase/references/69614b10fa87-0.jpg" width="150"> | **Infinite · Global payments** | 0:30 | 7 |
| <img src="showcase/references/227b019e7968-0.jpg" width="150"> | **SaaS · Launch sequence** | 1:02 | 8 |
| <img src="showcase/references/5db95a3a7c73-0.jpg" width="150"> | **Motion study 08** | 0:03 | 3 |

<p align="center">
  <img src="docs/demo-motion-study-08.webp" width="620" alt="Motion study 08 above its drafts">
</p>

These clips come from other creators and are used as examples. They are not claims of commissioned work.

### 🎬 Show what you made

Exported a breakdown or built drafts for your own ad? Post it in the **[Discord](https://discord.gg/grokbot)**. We'd love to see it.

## How it works

1. **Sections.** `scripts/plan-sections.mjs` splits each reference into 3–8 sections at real scene changes (FFmpeg scene detection) and keeps every cut. Two-beat drafts switch at the exact moment the film cuts.
2. **Drafts.** `public/drafts.mjs` is a small HyperFrames engine: each draft is a 640×360 HTML scene on a paused GSAP timeline. A section is described by one or two *beats* (`text`, `logo`, `phone`, `window`, `input`, `chat`, `cards`, `list`, `chart`, `cloud`…), written to match the real frame's layout, text and timing.
3. **Playback.** The page drives every draft's timeline from the film's clock. The active section follows the film, and the others loop.
4. **Export.** A hidden copy of the film plays at half speed. `requestVideoFrameCallback` captures every decoded frame, the drafts are drawn at that frame's exact time, and WebCodecs encodes it at 24 Mbps with the frame's own timestamp. The audio is copied from the reference, and [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) writes the MP4. Nothing is recorded in real time, so no frames are dropped.

### Requirements

| | Needed for |
|---|---|
| **Node.js 22+** | Running the local server (`npm start`). No dependencies to install. |
| **Chrome or Edge** | MP4 export (WebCodecs + `requestVideoFrameCallback`). Playback works in any modern browser. |
| **FFmpeg / ffprobe** (optional) | Importing your own references, planning sections, rebuilding the showcase, and extracting audio for imported references. |
| **Python 3** (optional) | `scripts/import-motionclone.py`. |

## Bring your own references

With Python, FFmpeg and ffprobe installed:

```sh
python scripts/import-motionclone.py --source /path/to/MotionClone
node scripts/plan-sections.mjs      # sections + scene cuts + contact sheets
```

Imported media stays local in `.local-media/` and `public/references/` (both ignored by Git) and takes precedence over the showcase. Describe each section's beats in `public/references/drafts.json`. Undescribed sections get placeholder drafts. `npm run showcase` rebuilds `showcase/` from the local library.

See **[docs/drafts.md](docs/drafts.md)** for the `drafts.json` file shape, how beat timing works, and one example per beat kind.

The importer creates non-destructive segments, extracts thumbnails, and hard-links the source videos when they are on the same drive as this repo (otherwise it copies them). Original files are only read. The server streams byte ranges, so seeking never reads a whole video into memory.

## FAQ and troubleshooting

**How do I move through the film frame by frame?**
Pause the film, then press `,` to step back one frame or `.` to step forward (1/30 second). Use `Home` to jump to the start and `End` to jump to the end. The left and right arrow keys still jump between sections.

**The Download button says "Needs Chrome or Edge".**
Export uses WebCodecs and `requestVideoFrameCallback`. Use a current Chrome or Edge. Firefox and Safari can play the preview but can't export.

**How long does an export take?**
The film is rendered at half speed so no frame is skipped, so expect it to take at least twice the film's length (a minute or more for the 30-second Infinite ad). Keep the tab in front while it renders, because browsers slow down video in background tabs.

**My export has no sound.**
The showcase ships its audio. For your own imported references the server extracts the audio with FFmpeg on first export, so FFmpeg must be on your `PATH`.

**The import failed with "Invalid cross-device link" (EXDEV).**
Older versions only hard-linked videos, which only works on one drive. Pull the latest `main`: the importer now copies the video when a link isn't possible. A copy uses extra disk space, so keep MotionClone on the same drive as this repo if space is tight.

**"No data/ folder in …" when importing.**
`--source` must point at the MotionClone project folder (the one that contains `data/`), not at a single video.

**Port 4343 is already in use, or I want to open it from another device.**
Set `PORT` and/or `HOST`, for example `PORT=5000 npm start` or `HOST=0.0.0.0 npm start` (default `127.0.0.1:4343`).

**The template gallery or editor says "generation not connected".**
That's intentional. Generation, rendering services, and Premiere are not connected in this repo, and the server answers those calls with `501 NOT_CONNECTED`. The drafts are authored, not AI-generated.

**Can I make vertical clips, cut pauses, or add captions with this?**
No. Those are features of Null Studio at [nullmotion.com](https://www.nullmotion.com/), a separate hosted product.

Stuck on something else? Ask in the **[Discord](https://discord.gg/grokbot)** or [open an issue](https://github.com/blixvip/NullMotion/issues/new/choose).

## Project layout

```
public/demo.html · demo.mjs · demo.css   the preview page and exporter
public/drafts.mjs                        HyperFrames draft engine (beat kinds)
public/scraps.mjs                        hand-built drafts for the Interface reference
public/editor.*                          the earlier launch editor, at /editor
showcase/                                the three published references
scripts/                                 import, sections, showcase, waveforms, checks
server.js · media.js                     static server, media streaming, audio extraction
test/                                    server, media and editor tests
```

```sh
npm run dev     # restart on change
npm run check   # UI file checks
npm test        # node --test
```

## Notes

- The browser only calls this project's own origin.
- The earlier launch editor (reference timeline, trimming, brand overlay) is at `/editor`, and the original Null Motion template gallery is at `/index.html`.
- Bundled GSAP and mp4-muxer keep their licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Brand artwork and reference footage belong to their respective owners and are not covered by the project license.

## Contributing

**We're looking for contributors.** Null Motion is small, has zero dependencies, and runs with `npm start`, so you can make your first change in minutes.

- 🟢 **Start here:** [good first issues](https://github.com/blixvip/NullMotion/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22): small, scoped, with the files to look at.
- 🙋 **Bigger pieces:** [help wanted](https://github.com/blixvip/NullMotion/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22): new draft beat kinds, export options, cross-platform testing.
- 💡 **Ideas and questions:** [Discussions](https://github.com/blixvip/NullMotion/discussions) or the [Discord](https://discord.gg/grokbot).

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/blixvip/NullMotion?quickstart=1)

One click gives you a ready environment (Node 22, FFmpeg, Python 3) with the tests already run. Then `npm run dev` and open the forwarded port 4343.

Comment on an issue to claim it, and we review pull requests within 24 hours. Setup and checks are in [CONTRIBUTING.md](CONTRIBUTING.md). Every contributor is credited in the release notes.

<!-- discord-incentive:start -->
### 💬 Why join the Discord first

**[discord.gg/grokbot](https://discord.gg/grokbot)** is the one server for every blixvip repo, and it gets you more than a chat window:

- 🟢 **Claim an issue and it is yours.** Say which one in `#contributors` and it is assigned to you, so two people never build the same thing twice.
- 🏷️ **A contributor role** on the server the moment your first pull request is merged.
- 🗺️ **A say in what gets built.** The roadmap is argued out there before it turns into issues.
- 🙋 **A human to ask.** Stuck on setup, or unsure whether an idea is even wanted? Faster than waiting on an issue thread.
<!-- discord-incentive:end -->

## Contributors

Thank you to the outside contributors who have already sent fixes and features to Null Motion: [@Aaqibhafeezkhan](https://github.com/Aaqibhafeezkhan), [@Goldloli](https://github.com/Goldloli), [@hippi345](https://github.com/hippi345), [@jay23606](https://github.com/jay23606) and [@Rheosta561](https://github.com/Rheosta561). Want to be next? See [CONTRIBUTING.md](CONTRIBUTING.md) and the [good first issues](https://github.com/blixvip/NullMotion/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

<a href="https://github.com/blixvip/NullMotion/graphs/contributors"><img src="https://contrib.rocks/image?repo=blixvip/NullMotion" alt="Contributors" /></a>

<!-- more-from-blixvip:start -->
## More from blixvip

| Project | What it does |
| --- | --- |
| **[GenMotion](https://github.com/blixvip/GenMotion)** | Type an idea, get a finished motion-graphics video. Top Western + Chinese image models, your own API keys. |
| **[MotionClone](https://github.com/blixvip/MotionClone)** | Rebuild any reference video as an editable HyperFrames project and compare it against the original. |
| **[html-anime](https://github.com/blixvip/html-anime)** | Turn a scene prompt into a shot sheet, then have a coding agent draw the film in HTML. No video model. |
| **[easyedit](https://github.com/blixvip/easyedit)** | Type a movie name, get a fan edit: captioned speech cut, then a montage cut to the beat. |
| **[stick](https://github.com/blixvip/stick)** | Free, open-source stick figure animation software for Windows, Linux and the web. |
| **[thumbnail-studio](https://github.com/blixvip/thumbnail-studio)** | A minimal Windows workspace for YouTube thumbnails: ChatGPT beside your references. |
| **[blixtrade](https://github.com/blixvip/blixtrade)** | Open-source core of BLIX, the AI memecoin terminal for Solana, with a public API and MCP server. |

<sub>If one of these helped you, a ⭐ helps other people find it. Follow [@waselyyy](https://x.com/waselyyy) for new drops.</sub>
<!-- more-from-blixvip:end -->

## License

[MIT](LICENSE). Bundled GSAP and mp4-muxer keep their own licenses (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). Reference footage and third-party brand marks belong to their owners.

## Community

**Want to send a PR? Join the [blix open source Discord](https://discord.gg/grokbot) first.** It's the one server for everyone contributing to any blixvip repo: questions, ideas, PR discussion, help, and release news.

<p align="center">
  <a href="https://discord.gg/grokbot"><img src="https://img.shields.io/badge/Join%20the%20Discord-questions%2C%20help%2C%20show%20your%20renders-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join the Discord: questions, help, show your renders"></a>
</p>

💬 Questions, help, feedback, release news, and your renders all go in the **[Discord](https://discord.gg/grokbot)**. If Null Motion helped you, a ⭐ helps other people find it.
