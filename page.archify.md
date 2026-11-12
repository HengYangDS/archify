# What changed in the checkout path? {#guide}

The checkout service now reads a cache before the order store, and the legacy queue is gone.

- [Checkout reads the cache first](block:p-path)

@answer scope="Synthetic example for a structural change preview"
@meta locale=en

## What changed in the checkout path? {#p-path}

Checkout reads the new cache before the order store; the legacy queue no longer receives orders.

@architecture id=path title="Checkout path" changes=checkout:modified,cache:added,queue:removed
| web | Web app | frontend |
| checkout | Checkout | backend |
| cache | Order cache | database |
| store | Order store | database |
| queue | Legacy queue | messagebus |
| web > checkout | Places order |
| checkout > cache | Reads first |
| checkout > store | Writes order |
| checkout > queue | Old hand-off |
