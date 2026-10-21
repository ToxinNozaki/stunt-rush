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
- **7 cars** across 3 categories — Sport, Supercar, Muscle, and Drift — each
  with genuinely different handling (mass, engine force, grip, and steering
  angle all feed the physics directly, not just flavor text):
  | Car | Category | Notes |
  | --- | --- | --- |
  | Raptor GT | Sport | Balanced all-rounder, easiest to learn |
  | Viper RS | Supercar | Blistering and twitchy |
  | Bulldog SS | Muscle | Torque for days, procedural body |
  | Wraith Drift | Drift | Low grip, tuned for slides, procedural body |
  | Hyperion X | Supercar | Fastest, least forgiving |
  | "89" Challenger | Muscle | Real scanned 3D model, real recorded Hellcat engine audio |
  | Samara GT | Drift | Real scanned 3D model (VAZ 2108 Lada), cheap and tail-happy |
- Real vehicle physics (cannon-es `RaycastVehicle`: suspension, slip,
  handbrake oversteer tuned to power-slide rather than stall when throttle
  and handbrake are held together) plus GTA5-style air control to right the
  car before landing
- Engine audio is procedurally synthesized (Web Audio API, no sample files,
  nothing to license) for most cars; the Challenger opts into real recorded
  engine samples (idle/accelerating loops crossfaded by actual road speed,
  not just throttle input, so it never sounds maxed-out at low speed) —
  everything else (wind, tire screech, horn, impact thump) stays procedural
  either way
- Graphics presets (Low/Medium/High/Ultra) plus manual sliders for shadows,
  bloom, draw distance, and pixel ratio, all saved locally
- A hand-drawn gauge-cluster speedometer, minimap, and stunt tracker
- A rigged lowpoly driver seated in every car (`src/driver.js`, `FBXLoader`),
  posed by hand from its bind pose into a driving stance (no "steering"
  animation clip shipped with the asset), with the forearms rotating live
  off the car's current steer ratio each frame

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
  which looks reasonable on the cars tested (Raptor GT, Challenger) but may
  need per-car tuning on others, especially the lower/wider supercars. The
  original rig asset (a `.c4d` Cinema 4D file) was unusable — this driver is
  a different, separately-sourced lowpoly rigged character (`.fbx`,
  `vendor/three/jsm/loaders/FBXLoader.js`), with no animation clips bundled,
  so the driving pose is hand-posed from its bind pose via quaternion deltas
  on the shoulder/elbow bones (see `UPPER_ARM_SWING` / `FOREARM_BEND` in
  `src/driver.js`) rather than blended from a real "steering" animation.
- McLaren Senna (118MB scan) and Ferrari Testarossa (7MB scan) assets are on
  hand but not yet integrated — same cleanup pipeline as the Challenger,
  just not done yet.
