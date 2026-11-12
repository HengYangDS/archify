# Visual evidence for tt-a1i/archify#1314

The reproduction from tt-a1i/archify#1312 (`page.archify.md`), rendered on the
base and on the PR head, then screenshotted in both themes.

| Page        | Source revision                            | SHA-256 of the page |
| ----------- | ------------------------------------------ | ------------------- |
| `base.html` | `0851616e3c7bb56206a5b8c8431e53696f0c8e4d` | `ab3aff2f…b99a467`  |
| `head.html` | `6cd59fd86ca12b3ef9571b7e0ee6db7d721f3014` | `2d43a1d4…0d6f5dd4` |

Each page was built from that revision's `archify/` tree, exported with
`git archive`, with official Node 22.23.3 and the input beside the output:

```sh
node archify/bin/archify.mjs finalize explainer page.archify.md base.html --json --quality standard --writing off --out-dir work-base
```

The same steps on the base and on `f4e39816`, the previous head, reproduce
byte for byte the pages behind the screenshots the PR described earlier.

Screenshots: `shoot-marks.mjs` with playwright-core 1.65.0 and Chrome for
Testing 156.0.8078.4 (headless shell), viewport 1440 × 900, device scale
factor 1.5, `prefers-color-scheme` light or dark, the `#p-path` panel after the
page loads and settles. Each PNG has a JSON record beside it with the page hash,
the conditions, the browser version and the image hash.

- `base-light.png`, `base-dark.png`: no outline on any node, and the list shows
  `checkout`, `cache`, `queue`.
- `head-light.png`, `head-dark.png`: Checkout outlined in the caution colour,
  Order cache in the good colour, Legacy queue dashed in the bad colour and
  faded. The list shows "Checkout", "Order cache", "Legacy queue".
