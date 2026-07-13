# Stack-a-Mon

A mobile-friendly Pokémon ladder puzzle. Stack 10 Pokémon by National Pokédex number — lowest at the bottom, highest at the top — before time runs out.

## Play

Open `index.html` locally in a browser.

## Rules (short)

- Mode 1: fill slots in 60s (3 skips), then 20s rearrange
- Mode 2: ladder auto-fills with 10 random Pokémon, then 60s to reorder with 2 replaces
- Drag, tap-swap, or up/down arrows while rearranging; lock in early or when time runs out
- Correct slot: 100 · Shiny: +50 (gold) · Correct shiny: 300 ((100 + 50) × 2)
- Longest correct streak: 10% at 2, +5% per extra (perfect 10 = 100%), applied after time bonus
- Time bonus: seconds left when the ladder was filled (Mode 1) or when you lock in (Mode 2); requires at least one correct slot
- Each placed Pokémon has a 1/4096 shiny chance (revealed at the end)

## Assets

Pixel sprites (regular + shiny) live in `assets/sprites/` from [PokeAPI sprites](https://github.com/PokeAPI/sprites).
