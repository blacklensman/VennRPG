# Grok Prompt: VennRPG — Apocalyptic Genre Data

Paste everything below this line into Grok.

---

You are generating tabletop RPG data for **VennRPG**, a percentile skill-resolution system (roll d100 ≤ target). I need three CSV files for the **Apocalyptic** genre: a post-collapse setting, Tech Level 5 baseline (scavenged pre-collapse Modern-era gear), with the setting's narrative theme being that higher-TL (8+) materials and technology once existed but are now lost, rare, or scavenged remnants — not standard-issue. No magic.

Generate exactly three CSVs, each starting with the header row given verbatim, followed by data rows only (no blank lines, no extra commentary before/after each CSV block).

## 1. `apocalyptic_skills.csv`

Header (verbatim):
```
name,description,attribute,focus,race
```

Columns:
- `name` — Skill name, Title Case, no commas.
- `description` — one sentence, no commas (VennRPG's parser for this file does not support quoted fields — never use a literal comma anywhere in `description`).
- `attribute` — the Attribute(s) this Skill's Target rolls against (one of: Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction). Multiple values separated by `;`.
- `focus` — which Focus class(es) get this Skill at the better 6% rate: `fighter`, `outlaw`, `wiz`, `priest`, separated by `;` if more than one, lowercase. Leave **blank** for a General skill open to everyone.
- `race` — leave blank unless the skill should be race-restricted (it normally should be blank for Apocalyptic content).

Hard constraint: **do not** generate any `Spell:` or `Miracle:` skill, and never use `Magic Casting` or `Miracle Casting` as an `attribute` value — Apocalyptic has no magic.

Theme: scavenging/salvage, radiation/contamination survival, jury-rigged repair, water/food foraging, pre-collapse tech identification and reverse-engineering, makeshift medicine, wasteland navigation, settlement/barter diplomacy. Aim for 40–60 rows.

Style example (reshaped from VennRPG's existing Fantasy data — match this density and tone, not the fantasy content itself):
```
Herbalism,Identify gather and prepare useful or dangerous plants,Intellect,priest;wiz;outlaw,
Engineering,Plan simple machines bridges and field works,Intellect,wiz;fighter,
```

## 2. `apocalyptic_melee.csv`

Header (verbatim):
```
Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Columns: `Name` (Title Case); `size` (one of `fist`, `1-hand`, `2-hand`, `thrown`); `attribute` (blank, or an Attribute name — leave blank unless there's a specific reason); `rof` (integer rate of fire, usually 1–3); `slash_dmg`/`impact_dmg`/`pierce_dmg`/`enery_dmg` (integer damage by type, 0 for unused types); `TL` — **`5` for ordinary scavenged/improvised weapons** (most rows), and **`8` only** for the rare pre-collapse high-tech remnant weapon (at most 1–2 rows in this file, flagged as such in the `Name` or implied by context); `focus`/`race` as above (`;`-delimited, lowercase).

Theme: improvised/scavenged melee — sharpened rebar, machetes, pipe wrenches, barbed-wire bats — with at most one or two rare pre-collapse TL8 remnant weapons (e.g. a monoblade fragment salvaged from a ruin). Aim for 10–15 rows.

Style example:
```
Mace,1-hand,,2,0,6,0,0,5,fighter;outlaw;priest,
Quarterstaff,2-hand,,2,0,6,0,0,5,fighter;outlaw;priest;wiz,
```
(Reshape the *structure* only — rename to apocalyptic equivalents like "Rebar Spike", "Pipe Wrench", with one rare TL8 remnant item such as a "Salvaged Vibro-Edge".)

## 3. `apocalyptic_ranged.csv`

Header (verbatim):
```
name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Same column conventions as melee above, plus `range` (integer meters). `TL` follows the same split: **`5` for most rows** (scavenged pre-collapse firearms, jury-rigged crossbows/slings), **`8` for at most 1–2 rare rows** representing a scavenged high-tech remnant weapon (running on scavenged power cells, narratively rare/unreliable).

Theme: scavenged hunting rifles and pistols, jury-rigged crossbows, pipe guns, with one or two rare high-tech remnant weapons. Aim for 15–20 rows.

Style example:
```
Short Bow,1,100,Dexterity,0,0,6,0,5,Fighter;Outlaw,
Light Crossbow,1,60,Dexterity,0,0,5,0,5,Fighter;Outlaw;Priest,
```
(Reshape structurally — e.g. a scavenged hunting rifle, a pipe-gun pistol, plus one rare TL8 remnant like a "Salvaged Pulse Carbine" — keeping the TL8 entries clearly the exception, not the rule.)

---

Output all three CSVs as separate fenced code blocks, each clearly labeled with its filename.
