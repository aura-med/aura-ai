# Team headshots

Drop the three files here, named exactly:

| File | Person |
| --- | --- |
| `diogo-simoes.jpg` | Diogo Simões — Chief Medical Officer |
| `alexandre-cardoso.jpg` | Alexandre Cardoso — Chief Rehabilitation Officer |
| `tiago-pimentel.jpg` | Tiago Pimentel — Chief Technology Officer |

Nothing else needs changing. The filenames are already referenced in `build.mjs`,
and each card renders the photo over an initials monogram that only shows while the
file is missing — so the section works before and after these land.

## Specs

- **Square, 1:1.** The card crops to a square with `object-fit: cover`, so a
  non-square image is cropped, not letterboxed.
- **800 × 800 px.** The photo renders about 310 px wide on desktop; 800 covers
  retina with room to spare.
- **JPEG.** The extension is part of the filename above. Sending PNGs is fine —
  it is a one-line change in `build.mjs`, just say so.
- **Under ~200 KB each.** These load on every visit to the landing page.
- **Flat, light background — the same one on all three.** Use `#F5F7FD` or
  `#EEF1F8` to match the section. Consistency across the set is what makes three
  portraits read as one clinical team; the competitor's page fails specifically
  because each person was shot against their own background.
- **Head high in the frame.** The crop anchors to the top
  (`object-position: center top`), so headroom is safe but a subject sitting low
  in the frame gets their chin cut off.

## Checking them

```bash
cd landing_page
node build.mjs
python3 -m http.server 8777
```

Then open `http://localhost:8777/#team`. If a photo does not appear, the filename
does not match the table above — the monogram falling back is the tell.
