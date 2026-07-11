# Stack-a-Mon

A mobile-friendly Pokémon ladder puzzle. Stack 10 Pokémon by National Pokédex number — lowest at the bottom, highest at the top — before time runs out.

## Play

Open `index.html` locally in a browser.

## Rules (short)

- Fill all 10 ladder slots within 60 seconds (3 skips)
- After filling, 15 seconds to rearrange, then lock in
- Correct slot: 100 · Shiny: +50 (gold) · Correct shiny: 300 ((100 + 50) × 2)
- Longest correct streak: 10% at 2, +5% per extra (perfect 10 = 100%), applied after time bonus
- Time bonus: seconds left when the ladder was filled
- Each placed Pokémon has a 1/4096 shiny chance (revealed at the end)

## Assets

Pixel sprites (regular + shiny) live in `assets/sprites/` from [PokeAPI sprites](https://github.com/PokeAPI/sprites).
