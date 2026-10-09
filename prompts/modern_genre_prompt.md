# Grok Prompt: VennRPG — Modern Genre Data

Paste everything below this line into Grok.

---

You are generating tabletop RPG data for **VennRPG**, a percentile skill-resolution system (roll d100 ≤ target). I need three CSV files for the **Modern** genre: present-day setting, Tech Level 5, no magic.

Generate exactly three CSVs, each starting with the header row given verbatim, followed by data rows only (no blank lines, no extra commentary before/after each CSV block).

## 1. `modern_skills.csv`

Header (verbatim):
```
name,description,attribute,focus,race
```

Columns:
- `name` — Skill name, Title Case, no commas.
- `description` — one sentence, no commas (VennRPG's parser for this file does not support quoted fields — never use a literal comma anywhere in `description`).
- `attribute` — the Attribute(s) this Skill's Target rolls against (one of: Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction). Multiple values separated by `;`.
- `focus` — which Focus class(es) get this Skill at the better 6% rate: `fighter`, `outlaw`, `wiz`, `priest`, separated by `;` if more than one, lowercase. Leave **blank** for a General skill open to everyone.
- `race` — leave blank unless the skill should be race-restricted (it normally should be blank for Modern content).

Hard constraint: **do not** generate any `Spell:` or `Miracle:` skill, and never use `Magic Casting` or `Miracle Casting` as an `attribute` value — Modern has no magic.

Theme: investigation, driving/piloting, firearms maintenance, hacking/computers, forensics, tradecraft, first aid, urban survival. Aim for 40–60 rows.

Style example (reshaped from VennRPG's existing Fantasy data — match this density and tone, not the fantasy content itself):
```
Acrobatics,Tumble flip and land safely or move through tight spaces,Agility,outlaw;fighter,halfling
Adaptability,Roll you Defy check each time you Advance; if you roll under add one additional skill,Intellect,,
```

## 2. `modern_melee.csv`

Header (verbatim):
```
Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Columns: `Name` (Title Case); `size` (one of `fist`, `1-hand`, `2-hand`, `thrown`); `attribute` (blank, or an Attribute name — leave blank unless there's a specific reason); `rof` (integer rate of fire, usually 1–3); `slash_dmg`/`impact_dmg`/`pierce_dmg`/`enery_dmg` (integer damage by type — most melee weapons are impact or pierce, 0 for unused types); `TL` — **always `5`** for every row in this file; `focus`/`race` as above (`;`-delimited, lowercase).

Theme: batons, knives, improvised/tactical melee (tomahawks, collapsible batons, trench tools). Aim for 10–15 rows.

Style example:
```
Dagger,fist,,2,0,4,0,0,5,fighter;outlaw;priest;wiz,
Sword Stabbing,1-hand,,1,0,0,8,0,5,fighter;outlaw,
```
(Reshape the *structure* only — rename to modern equivalents like "Combat Knife", "Tactical Tomahawk", etc.)

## 3. `modern_ranged.csv`

Header (verbatim):
```
name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Same column conventions as melee above, plus `range` (integer, feet or meters — be consistent, use meters). `TL` is **always `5`**. This is the file for Modern firearms (pistols, rifles, shotguns) as well as non-firearm ranged items (thrown, bows if thematically present).

Theme: service pistols, carbines, shotguns, submachine guns — civilian and law-enforcement/military variants. Aim for 15–25 rows.

Style example:
```
Short Bow,1,100,Dexterity,0,0,6,0,5,Fighter;Outlaw,
Light Crossbow,1,60,Dexterity,0,0,5,0,5,Fighter;Outlaw;Priest,
```
(Reshape structurally into modern firearms — e.g. a 9mm pistol, a 5.56mm carbine — keeping `rof`/damage numbers in the same rough scale as these examples.)

---

Output all three CSVs as separate fenced code blocks, each clearly labeled with its filename.
