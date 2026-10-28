# Grok Prompt: VennRPG — Dystopian Genre Data

Paste everything below this line into Grok.

---

You are generating tabletop RPG data for **VennRPG**, a percentile skill-resolution system (roll d100 ≤ target). I need three CSV files for the **Dystopian** genre: an oppressive, state-controlled near-future setting, Tech Level 4 (slightly behind Modern's TL5 — technology is stagnant/restricted, not advanced), no magic.

Generate exactly three CSVs, each starting with the header row given verbatim, followed by data rows only (no blank lines, no extra commentary before/after each CSV block).

## 1. `dystopian_skills.csv`

Header (verbatim):
```
name,description,attribute,min_tl,focus,race
```

Columns:
- `name` — Skill name, Title Case, no commas.
- `description` — one sentence, no commas (VennRPG's parser for this file does not support quoted fields — never use a literal comma anywhere in `description`).
- `attribute` — the Attribute(s) this Skill's Target rolls against (one of: Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Mysticism, Bravery, Willpower, Charisma, Attraction). Multiple values separated by `;`.
- `min_tl` — integer, the lowest Tech Level this Skill is normally available at (use this genre's Tech Level as the default; lower only for Skills that would plausibly predate it).
- `focus` — which Focus class(es) get this Skill at the better 6% rate: `martial`, `covert`, `adept`, `shepherd`, separated by `;` if more than one, lowercase. Leave **blank** for a General skill open to everyone.
- `race` — leave blank unless the skill should be race-restricted (it normally should be blank for Dystopian content).

Hard constraint: **do not** generate any `Spell:` or `Miracle:` skill, and never use `Magic Casting` or `Miracle Casting` as an `attribute` value — Dystopian has no magic.

Theme: surveillance evasion, black-market trading, propaganda/counter-propaganda, forgery of state documents, smuggling, informant networks, rationed-resource scavenging, crowd control (for state-aligned characters) or crowd survival (for resisters). Aim for 40–60 rows.

Style example (reshaped from VennRPG's existing Fantasy data — match this density and tone, not the fantasy content itself):
```
Forgery,Create or detect false documents seals and signatures,Dexterity,1,covert,
Disguise,Alter appearance voice and manner to pass as someone else,Charisma,1,covert,
```

## 2. `dystopian_melee.csv`

Header (verbatim):
```
Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Columns: `Name` (Title Case); `size` (one of `fist`, `1-hand`, `2-hand`, `thrown`); `attribute` (blank, or an Attribute name — leave blank unless there's a specific reason); `rof` (integer rate of fire, usually 1–3); `slash_dmg`/`impact_dmg`/`pierce_dmg`/`enery_dmg` (integer damage by type, 0 for unused types); `TL` — **always `4`** for every row in this file; `focus`/`race` as above (`;`-delimited, lowercase).

Theme: riot batons and shields (state-issue), improvised resistance weapons (pipes, sharpened tools), restricted/black-market blades. Aim for 10–15 rows.

Style example:
```
Club,1-hand,,2,0,0,6,0,4,martial;covert;shepherd,
Mace,1-hand,,2,0,6,0,0,4,martial;covert;shepherd,
```
(Reshape the *structure* only — rename to dystopian equivalents like "Riot Baton", "Pipe Wrench", etc.)

## 3. `dystopian_ranged.csv`

Header (verbatim):
```
name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
```

Same column conventions as melee above, plus `range` (integer meters). `TL` is **always `4`**. Civilian firearm access is restricted in this setting — favor state-issue sidearms/crowd-control weapons and crude/improvised ranged weapons for everyone else over advanced military hardware.

Theme: state-issue sidearms, tasers/stun batons, tear gas launchers, improvised crossbows/slings for resistance characters. Aim for 12–20 rows.

Style example:
```
Sling,1,30,Dexterity,0,3,0,0,4,Martial;Covert;Shepherd,
Light Crossbow,1,60,Dexterity,0,0,5,0,4,Martial;Covert;Shepherd,
```
(Reshape structurally — e.g. a state-issue stun baton launcher, an improvised pipe crossbow — keeping `rof`/damage numbers in the same rough scale as these examples.)

---

Output all three CSVs as separate fenced code blocks, each clearly labeled with its filename.
