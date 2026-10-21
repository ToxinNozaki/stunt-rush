# Stunt Rush

An open-world stunt driving game for the browser — loops, launch ramps, drift
roads, and full air control while you're off the ground. No install, no
plugins, nothing to download. Just open the link and drive.

Play it: `https://toxinnozaki.github.io/stunt-rush/`

## Controls

| Action | Default key |
| --- | --- |
| Throttle | `W` or `Up Arrow` |
| Brake / Reverse | `S` or `Down Arrow` |
| Steer | `A` / `D` or `Left` / `Right` Arrow |
| Handbrake | `Space` |
| Air control (pitch/roll while airborne) | same throttle/brake/steer keys |
| Change camera | `C` |
| Respawn car | `R` |
| Horn | `H` |
| Pause | `Esc` |

All controls are rebindable from Settings → Controls, and the defaults use
only letters, arrows, and space — no numpad or function-key dependence, so
they work the same on a Chromebook as on a full keyboard.

## What's in it

- **3 maps** — Stunt Park (loops and launch ramps), Neon City (open-world
  rooftop gap jumps), Red Canyon (desert drift roads and dune jumps)
- **2 cars, both real scanned 3D models** — the procedural low-poly cars are
  shelved for now (`buildProceduralCarVisual` in `src/cars.js` still works,
  just unused by the roster) while the focus is on real-model quality:
  | Car | Category | Notes |
  | --- | --- | --- |
  | Hellcat Challenger | Muscle | Real scanned model, real recorded Hellcat engine audio |
  | Samara GT | Drift | Real scanned model (VAZ 2108 Lada), cheap and tail-happy |
  Every wheel also uses a real scanned tire tread mesh (`assets/models/wheel/`)
  paired with a procedural chrome rim, instead of a plain cylinder.
  More real-model cars (McLaren Senna, Ferrari Testarossa, a Mustang) are
  queued up — see Known limitations.
- Each car's select-screen card shows a baked studio-angle icon instead of a
  flat color swatch (`assets/icons/`, see "Baking a car icon" below) — bake
  one for every new car added to the roster.
- Real vehicle physics (cannon-es `RaycastVehicle`: suspension, slip,
  handbrake oversteer tuned to power-slide rather than stall when throttle
  and handbrake are held together) plus GTA5-style air control to right the
  car before landing
- Engine audio is real recorded samples by default now — a 4-stage RPM
  ladder (idle/low/med/high, crossfaded by actual road speed so it never
  sounds maxed-out at low speed) plus startup/shutdown one-shots
  (`DEFAULT_ENGINE_SOUND_SET` in `src/audio.js`); the Challenger overrides it
  with its own 2-stage Hellcat recordings. A fully procedural synth engine
  (zero sample files) still exists as a fallback path, just unused by
  default. Wind, tire screech, horn, and impact thump stay procedural either
  way.
- Graphics presets (Low/Medium/High/Ultra) plus manual sliders for shadows,
  bloom, draw distance, and pixel ratio, all saved locally
- A hand-drawn gauge-cluster speedometer, minimap, and stunt tracker
- `window.__sceneDump()` — a standing dev tool (always available in the
  console, see `src/main.js`) that lists every mesh/group currently in the
  scene with its world position. Run it during any manual test pass to catch
  leftover geometry a cleanup bug left behind (e.g. the orphaned wheels bug
  below) instead of having to spot it by eye in a screenshot.

## Tech

Plain HTML/CSS/JS — Three.js for rendering, cannon-es for physics, both
vendored locally under `vendor/` (no CDN dependency, no build step). Open
`index.html` through any static file server and it runs.

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

### Adding a real 3D model car

The Challenger and Samara GT are real scanned meshes, not procedural
geometry, loaded with `OBJLoader`/`MTLLoader` (vendored under
`vendor/three/jsm/loaders/`). Source scans are typically far too heavy to
ship as-is (the Challenger scan was 1.7M triangles / 154MB before cleanup) —
the working pattern, scripted with `pymeshlab`, is:

1. Decimate with quadric edge collapse to a web-safe triangle budget
   (tens of thousands of tris, not millions).
2. Find the scan's own 4 wheel sub-meshes by bounding-box analysis (they're
   usually the only groups with a circular cross-section at the 4 corners)
   and strip them out by their material — the game's own animated wheel
   rig (`buildWheels` in `src/cars.js`) replaces them so they actually spin
   and steer, instead of shipping dead static wheel geometry.
3. Work out the scan's own local axis convention (length/width/height aren't
   consistently X/Y/Z between different artists' exports) and set a
   `modelBasis` on the car entry in `src/cars.js` — three orthonormal unit
   vectors that are a **proper rotation** (determinant +1) mapping the
   scan's axes onto the game's (X=width, Y=height, Z=forward). A naive
   single-axis swap is usually a reflection (determinant -1) and will mirror
   or inside-out the mesh — negate one more axis to fix it.
4. If the scan's paint panels lost their texture reference and fell back to
   flat gray, set `paintTint` on the car entry — `classifyScanMaterial` in
   `src/cars.js` will tint unsaturated mid-gray materials with it instead of
   rendering bare primer. If instead the decimated materials come out with
   genuinely distinguishable colors (some scans do, depending on how the
   source `.mtl` was authored), `paintTint` isn't needed at all —
   `classifyScanMaterial`'s saturation/brightness heuristic handles it.
5. Not every scan needs the wheel-stripping step — if the source scene
   already has the wheels as separate named objects from the body (check
   with `grep "^o "` on the `.obj`), just extract the body object directly
   and skip straight to decimation.
6. Watch for `modelBasis` and the length-axis assumption together: the scale
   calculation picks whichever raw axis `modelBasis` maps to the game's
   forward (Z) axis — it does NOT assume the scan's own local X is always
   length. A model exported from a proper Blender/FBX scene (not a raw scan)
   may already be standard Y-up/Z-forward, in which case `modelBasis` is
   just the identity and no remapping happens at all.
7. pymeshlab's OBJ exporter can throw `MemoryError('bad allocation')` on
   some meshes for no obvious reason (hit this on the Mustang asset, a
   111MB/750k-vert source with ~20 materials). If it does, PLY and DAE
   export both work as a fallback — but they drop per-face material
   grouping entirely, so that escape hatch only helps if you don't need the
   named materials. No fix found yet; that asset is on hold until there's a
   working path.

### Baking a car icon

Every car needs a baked select-screen icon in `assets/icons/<id>.png`,
referenced by the `icon` field on its `CARS` entry — do this for every new
car. There's no in-repo script for it (it was done once, ad hoc, in a
browser console session): load the car with `buildCarVisual`, light it with
3 directional lights plus an ambient fill (flat procedural materials need a
lot of light to read clearly — roughly 6x the intensity that looks right in
the actual game scene), frame it at a 3/4 angle from a `Box3` computed over
the body *and* wheels, render to an off-screen canvas at 512×512, and save
the `canvas.toDataURL('image/png')` output as a PNG.

## Known limitations

- Single-player only for now. LAN play is planned (not built yet): someone
  hosting a party runs a small local signaling server, the game gets a "LAN"
  menu tab to point at that host's local IP and see a live room list, and
  actual gameplay runs peer-to-peer over WebRTC — no public server, no
  hosting cost, matches the "no backend to maintain" philosophy for the base
  game. A real internet-wide public server list is explicitly out of scope —
  that needs always-on hosting, which contradicts why this runs on GitHub
  Pages in the first place.
- Scattered desert boulders in Red Canyon are decorative and have no
  collision.
- **No driver model in the cars right now.** An earlier attempt seated a
  lowpoly rigged character (`src/driver.js`, unused but kept), but getting a
  standing-rig character into a convincing seated silhouette (no seated pose
  or animation clip shipped with the asset — the legs needed hand-posed hip/
  knee bends, and even then the head sat at an inconsistent height across
  different cars' rooflines) wasn't worth the result. Removed rather than
  ship something that looks broken.
- McLaren Senna (118MB scan) and Ferrari Testarossa (7MB scan) assets are on
  hand but not yet integrated. A Mustang OBJ (111MB, ~750k verts, no `.mtl`)
  is also on hand — decimation works, but pymeshlab's OBJ exporter throws a
  `MemoryError` on this one specifically (see the pymeshlab notes above);
  shelved until that's sorted out.
- Ground/building materials across all 3 maps are still flat procedural
  colors — real PBR texture sets (asphalt, concrete, brick, etc.) were
  provided early on but haven't been wired in yet.
