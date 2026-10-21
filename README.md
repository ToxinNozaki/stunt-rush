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
  | "89" Challenger | Muscle | Real scanned model, real recorded Hellcat engine audio |
  | Samara GT | Drift | Real scanned model (VAZ 2108 Lada), cheap and tail-happy |
  More real-model cars (McLaren Senna, Ferrari Testarossa, a Mustang) are
  queued up — see Known limitations.
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
- A rigged lowpoly driver seated in every car (`src/driver.js`, `FBXLoader`),
  hand-posed from its standing bind pose into a seated driving stance
  (shoulders/elbows swung forward, hips/knees bent so the legs don't clip
  straight through the floor — there's no seated pose or animation clip
  shipped with the asset), with the forearms rotating live off the car's
  current steer ratio each frame

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
   rendering bare primer.

## Known limitations

- Single-player only — there's no backend, by design, so this can live on
  GitHub Pages for free, forever, with nothing to keep running.
- Scattered desert boulders in Red Canyon are decorative and have no
  collision.
- **The driver's seat position is an approximation.** There's no real
  interior/seat reference per car — `seatDriver` in `src/driver.js` places
  it from a generic offset based on each car's chassis dims (`def.dims`),
  verified on Challenger and Samara GT but not tuned per-car beyond that.
  The original rig asset (a `.c4d` Cinema 4D file) was unusable — this
  driver is a different, separately-sourced lowpoly rigged character
  (`.fbx`, `vendor/three/jsm/loaders/FBXLoader.js`), with no animation clips
  bundled, so the whole driving pose (arms, hips, knees) is hand-posed from
  its standing bind pose via quaternion deltas (see the `*_SWING` / `*_BEND`
  constants in `src/driver.js`) rather than blended from a real pose/clip.
- McLaren Senna (118MB scan) and Ferrari Testarossa (7MB scan) assets are on
  hand but not yet integrated. A Mustang OBJ (111MB, ~750k verts) was also
  just added — note its `.mtl` file is missing from that asset, so it has no
  material/color data at all; that needs sorting out before it goes through
  the same cleanup pipeline as the Challenger.
- Ground/building materials across all 3 maps are still flat procedural
  colors — real PBR texture sets (asphalt, concrete, brick, etc.) were
  provided early on but haven't been wired in yet.
