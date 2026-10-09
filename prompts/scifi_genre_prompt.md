# Grok Prompt: VennRPG — SciFi Genre Data

Paste everything below this line into Grok.

---

You are generating tabletop RPG data for **VennRPG**, a percentile skill-resolution system (roll d100 ≤ target). I need three CSV files for the **SciFi** genre: an advanced/speculative setting, Tech Level 8, no magic (advanced technology fills the role magic plays in Fantasy, but it is still technology, not magic).

Generate exactly three CSVs, each starting with the header row given verbatim, followed by data rows only (no blank lines, no extra commentary before/after each CSV block).

## 1. `scifi_skills.csv`

Header (verbatim):
```
name,description,attribute,focus,race
```

Columns:
- `name` — Skill name, Title Case, no commas.
- `description` — one sentence, no commas (VennRPG's parser for this file does not support quoted fields — never use a literal comma anywhere in `description`).
- `attribute` — the Attribute(s) this Skill's Target rolls against (one of: Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction). Multiple values separated by `;`.
- `focus` — which Focus class(es) get this Skill at the better 6% rate: `fighter`, `outlaw`, `wiz`, `priest`, separated by `;` if more than one, lowercase. Leave **blank** for a General skill open to everyone.
- `race` — leave blank unless the skill should be race-restricted (it normally should be blank for SciFi content).

Hard constraint: **do not** generate any `Spell:` or `Miracle:` skill, and never use `Magic Casting` or `Miracle Casting` as an `attribute` value — SciFi has no magic. Advanced-tech Skills (hacking, xenobiology, zero-g operations, etc.) should use a normal physical/mental Attribute like Intellect or Dexterity, never Magic.

Theme: starship systems/piloting, zero-g operations, xenobiology/xenoarchaeology, cybernetics maintenance, hacking/AI wrangling, void survival, advanced forensics, energy-weapon maintenance. Aim for 40–60 rows.

Style example (reshaped from VennRPG's existing Fantasy data — match this density and tone, not the fantasy content itself):
```
Engineering,Plan simple machines bridges and field works,Intellect,wiz;fighter,
Appraisal,Judge the true value of goods gems art and salvage,Intellect,outlaw;wiz,
```

## 2. `scifi_melee.csv`

Header (verbatim):
```
Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Columns: `Name` (Title Case); `size` (one of `fist`, `1-hand`, `2-hand`, `thrown`); `attribute` (blank, or an Attribute name — leave blank unless there's a specific reason); `rof` (integer rate of fire, usually 1–3); `slash_dmg`/`impact_dmg`/`pierce_dmg`/`enery_dmg` (integer damage by type — a vibro-blade or energy weapon should carry real `enery_dmg`, not 0); `TL` — **always `8`** for every row in this file; `focus`/`race` as above (`;`-delimited, lowercase).

Theme: vibro-blades, power gauntlets, monomolecular edges, stun batons with an energy component. Aim for 10–15 rows.

Style example:
```
Sword Long,1-hand,,1,4,4,8,0,8,fighter;outlaw;priest,
Sword Sabre,1-hand,,2,4,0,6,0,8,fighter;outlaw;priest,
```
(Reshape the *structure* only — rename to sci-fi equivalents like "Vibro-Blade", "Monoblade", etc., and give energy-bladed weapons nonzero `enery_dmg`.)

## 3. `scifi_ranged.csv`

Header (verbatim):
```
name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Same column conventions as melee above, plus `range` (integer meters — sci-fi ranged weapons should generally out-range Modern firearms). `TL` is **always `8`**. This is the file for blasters, rail weapons, plasma weapons, and other energy/kinetic sci-fi ordnance — `enery_dmg` should be the dominant damage type for most entries.

Theme: blaster pistols/rifles, railguns, plasma casters, pulse weapons. Aim for 15–25 rows.

Style example:
```
Composite Bow,1,100,Dexterity,0,0,8,0,8,Fighter;Outlaw,
Light Crossbow,1,60,Dexterity,0,0,5,0,8,Fighter;Outlaw;Priest,
```
(Reshape structurally into sci-fi energy/kinetic weapons — e.g. a blaster pistol, a rail rifle — keeping `rof` in a similar range but pushing `range` and `enery_dmg` higher to reflect TL8 technology.)

---

Output all three CSVs as separate fenced code blocks, each clearly labeled with its filename.
