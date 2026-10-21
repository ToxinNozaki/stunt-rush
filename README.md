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
- **6 cars** with genuinely different handling — mass, engine force, grip,
  and steering angle all feed the physics directly
- Real vehicle physics (cannon-es `RaycastVehicle`: suspension, slip,
  handbrake oversteer) plus GTA5-style air control to right the car before
  landing
- Procedurally synthesized engine/tire/wind audio via the Web Audio API —
  no sample files, so there's nothing to license and the repo stays tiny
- Graphics presets (Low/Medium/High/Ultra) plus manual sliders for shadows,
  bloom, draw distance, and pixel ratio, all saved locally
- A hand-drawn gauge-cluster speedometer, minimap, and stunt tracker

## Tech

Plain HTML/CSS/JS — Three.js for rendering, cannon-es for physics, both
vendored locally under `vendor/` (no CDN dependency, no build step). Open
`index.html` through any static file server and it runs.

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Known limitations

- Single-player only — there's no backend, by design, so this can live on
  GitHub Pages for free, forever, with nothing to keep running.
- Scattered desert boulders in Red Canyon are decorative and have no
  collision.
