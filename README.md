# Null

A fresh public project using Null Motion's existing interface: a dark motion workspace, template gallery, prompt composer, reference and script pages, and render library layout.

This first version is a **UI starter**. Template previews, navigation, local draft controls, and template selection work. AI generation, video rendering, template management, themes, and Premiere integration are not connected. Those actions return an explicit “not connected” message; no fake jobs or generated results are shown.

## Run locally

Install Node.js 22 or newer, then:

```sh
npm start
```

Open <http://127.0.0.1:4343>. There are no runtime packages to install and no credentials to configure.

The optional `PORT` environment variable changes the port. `HOST` defaults to `127.0.0.1`; set it to your hosting environment's required bind address when deploying. This repository does not provision a hosted service.

## Develop

```sh
npm run dev
npm run check
npm test
```

- `public/`: the inherited UI, styles, template previews, and artwork.
- `data/template-catalog.json`: the bundled template definitions.
- `server.js`: a standalone static server with read-only UI data routes.
- `test/`: checks for previews, empty state data, disabled backend actions, and file isolation.

The browser calls this project's own origin. It does not connect to the original Null Motion companion. Build new authenticated backend routes before enabling generation or shared data storage.

## Project boundary

This project starts with fresh Git history. It contains no personal render history, database, provider configuration, local credentials, or Premiere extension. Drafts and UI preferences use this project's browser origin.

The original UI is retained to provide a starting point; inherited provider names, timing labels, and pipeline diagrams describe the future integration surface, not implemented service guarantees. External AI tools require their own accounts and may need to open in a separate tab.

## Third-party notices

The bundled GSAP file retains its copyright and license header; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Brand artwork belongs to its respective owners. No project-wide open-source license has been selected.
