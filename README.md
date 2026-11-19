# 3D ASCII Christmas Tree

An editable 3D ASCII Christmas scene built with Three.js. Every visible tree, star, gift, trunk and root element is rendered from an ASCII glyph atlas. Snow, the golden spiral ribbon and the blessing stay in the page so the project remains easy to remix.

## Edit

Open `src/main.js`. The main controls are in the `CONFIG` object and the `PALETTE` object near the top.

Useful settings:

- `treeHeight`: height of the conical tree body.
- `treeRadius`: base radius of the tree.
- `treeTiers`: number of rotating layers.
- `spiralTurns`: number of turns in the golden light ribbon.
- `PALETTE`: tree, gold, gift and snow colors.

The blessing copy is in `index.html`.

## Run

The quickest option is to double-click `index.html`. The page uses a classic
Three.js build so it runs directly from disk without a local server.

For a local HTTP preview:

```powershell
node server.mjs
```

Then open `http://127.0.0.1:4173`.

Add `?record=1` to hide the download control for screen capture.

To record a fresh MP4 from the live scene:

```powershell
npm install
node scripts/record.mjs
```

The record script uses Playwright's browser video capture, then converts the
capture with FFmpeg. Set `FFMPEG_PATH` if `ffmpeg` is not on `PATH`.

## GitHub Pages

The site is fully static and can be published from the repository root with
GitHub Pages. The bundled `three.module.min.js` and `three.core.min.js` keep
the animation running without a CDN.

## Output

- `ascii-christmas-tree.mp4`: 20 second portrait video.
- `index.html`: editable web version.
