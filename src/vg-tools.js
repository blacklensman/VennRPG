(function () {

// =============================================================================
// Constants
// =============================================================================

const BASE_ATTRIBUTES = [
  'Physique', 'Strength', 'Constitution', 'Agility', 'Dexterity', 'Intellect',
  'Intuition', 'Mysticism', 'Bravery', 'Willpower', 'Charisma', 'Attraction',
];
const BASE_CLASSES = ['Martial', 'Covert', 'Adept', 'Shepherd'];
const BASE_RACES = ['Human', 'Elf', 'Dwarf', 'Halfling'];
const GENRES = ['Fantasy', 'Modern', 'Dystopian', 'SciFi', 'Apocalyptic'];
// Grows when the VG creates a New Genre (see createNewGenre()) — every
// "all genres" loop below uses this instead of the fixed GENRES constant
// so a newly-created genre is picked up everywhere automatically.
let knownGenres = [...GENRES];
const MULTI_VALUE_DELIMITER = ';';

// mode: 'naive' = unquoted comma-split (matches src/data.js's naive parsers —
//   a literal comma in any field would corrupt the file, so the editor warns
//   and strips commas on save for these). 'quoted' = full quoted-CSV (matches
//   src/data.js's parseCsvWithHeader — safe for any field content).
const TABS = [
  {
    // Every value an Expertise (Martial/Covert/Adept/Shepherd) controls,
    // genre-specific like everything else. A row's `name` IS the
    // Expertise, not a reference to one (same pattern as the Races tab).
    id: 'expertise', label: 'Expertise', nameField: 'name', genreFileSuffix: 'expertise',
    columns: ['name', 'defy_attributes', 'focus_melee_weapons', 'focus_ranged_weapons', 'combat_focus_bonus', 'magic_focus_bonus', 'miracle_focus_bonus', 'vitals_pd_mod', 'vitals_md_mod'],
    multi: { defy_attributes: 'attribute' },
    mode: 'naive',
    filesByGenre: {
      Fantasy: ['fantasy_expertise.csv'],
      Modern: ['modern_expertise.csv'],
      Dystopian: ['dystopian_expertise.csv'],
      SciFi: ['scifi_expertise.csv'],
      Apocalyptic: ['apocalyptic_expertise.csv'],
    },
    newEntryFile: { Fantasy: 'fantasy_expertise.csv', Modern: 'modern_expertise.csv', Dystopian: 'dystopian_expertise.csv', SciFi: 'scifi_expertise.csv', Apocalyptic: 'apocalyptic_expertise.csv' },
  },
  {
    id: 'skills', label: 'Skills', nameField: 'name', genreFileSuffix: 'skills',
    columns: ['name', 'description', 'attribute', 'min_tl', 'focus', 'race'],
    multi: { attribute: 'attribute', focus: 'class', race: 'race' },
    mode: 'naive',
    filesByGenre: {
      Fantasy: ['fantasy_skills.csv'],
      Modern: ['modern_skills.csv'],
      Dystopian: ['dystopian_skills.csv'],
      SciFi: ['scifi_skills.csv'],
      Apocalyptic: ['apocalyptic_skills.csv'],
    },
    newEntryFile: { Fantasy: 'fantasy_skills.csv', Modern: 'modern_skills.csv', Dystopian: 'dystopian_skills.csv', SciFi: 'scifi_skills.csv', Apocalyptic: 'apocalyptic_skills.csv' },
  },
  {
    id: 'specials', label: 'Special Abilities', nameField: 'name', genreFileSuffix: 'special',
    columns: ['name', 'description', 'stamina cost', 'focus', 'race'],
    multi: { focus: 'class', race: 'race' },
    mode: 'naive',
    filesByGenre: {
      Fantasy: ['special.csv'],
      Modern: ['modern_special.csv'],
      Dystopian: ['dystopian_special.csv'],
      SciFi: ['scifi_special.csv'],
      Apocalyptic: ['apocalyptic_special.csv'],
    },
    newEntryFile: { Fantasy: 'special.csv', Modern: 'modern_special.csv', Dystopian: 'dystopian_special.csv', SciFi: 'scifi_special.csv', Apocalyptic: 'apocalyptic_special.csv' },
  },
  {
    id: 'melee', label: 'Melee Weapons', nameField: 'Name', genreFileSuffix: 'melee',
    columns: ['Name', 'size', 'attribute', 'rof', 'slash_dmg', 'impact_dmg', 'pierce_dmg', 'enery_dmg', 'TL', 'focus', 'race'],
    multi: { attribute: 'attribute', focus: 'class', race: 'race' },
    mode: 'naive',
    filesByGenre: {
      Fantasy: ['melee_weapons.csv'],
      Modern: ['modern_melee.csv'],
      Dystopian: ['dystopian_melee.csv'],
      SciFi: ['scifi_melee.csv'],
      Apocalyptic: ['apocalyptic_melee.csv'],
    },
    newEntryFile: { Fantasy: 'melee_weapons.csv', Modern: 'modern_melee.csv', Dystopian: 'dystopian_melee.csv', SciFi: 'scifi_melee.csv', Apocalyptic: 'apocalyptic_melee.csv' },
  },
  {
    id: 'ranged', label: 'Ranged Weapons', nameField: 'name', genreFileSuffix: 'ranged',
    columns: ['name', 'rof', 'range', 'attribute', 'slash_dmg', 'impact_dmg', 'pierce_dmg', 'enery_dmg', 'TL', 'focus', 'race'],
    multi: { attribute: 'attribute', focus: 'class', race: 'race' },
    mode: 'naive',
    filesByGenre: {
      Fantasy: ['ranged_weapons.csv'],
      Modern: ['modern_ranged.csv'],
      Dystopian: ['dystopian_ranged.csv'],
      SciFi: ['scifi_ranged.csv'],
      Apocalyptic: ['apocalyptic_ranged.csv'],
    },
    newEntryFile: { Fantasy: 'ranged_weapons.csv', Modern: 'modern_ranged.csv', Dystopian: 'dystopian_ranged.csv', SciFi: 'scifi_ranged.csv', Apocalyptic: 'apocalyptic_ranged.csv' },
  },
  {
    id: 'firearms', label: 'Firearms', nameField: 'Designation', genreFileSuffix: 'firearms',
    columns: ['Maker', 'Type', 'Designation', 'Calibre', 'MVel(FPS)', 'ETransfer', 'Range Inc(M)', 'Fire Mode', 'TL'],
    // Modern's file (small_arms.csv) has 2 extra columns the other 4 genre
    // firearms files don't have yet.
    columnsByGenre: {
      Modern: ['Maker', 'Type', 'Designation', 'Calibre', 'MVel(FPS)', 'ETransfer', 'Range Inc(M)', 'Fire Mode', 'Mag', 'TL', 'Cost($)', 'Class'],
    },
    multi: {},
    mode: 'quoted',
    filesByGenre: {
      Fantasy: ['fantasy_firearms.csv'],
      Modern: ['small_arms.csv'],
      Dystopian: ['dystopian_firearms.csv'],
      SciFi: ['scifi_firearms.csv'],
      Apocalyptic: ['apocalyptic_firearms.csv'],
    },
    newEntryFile: { Fantasy: 'fantasy_firearms.csv', Modern: 'small_arms.csv', Dystopian: 'dystopian_firearms.csv', SciFi: 'scifi_firearms.csv', Apocalyptic: 'apocalyptic_firearms.csv' },
  },
  {
    // General/weapons/armor shop catalog — each genre has its own file.
    // Fantasy's cost column is cost(GT); every other genre (TL > 3) is
    // authored directly in cost($) — columnsByGenre swaps the header for
    // those 4 genres since it's the one column whose name differs.
    id: 'equipment', label: 'Equipment', nameField: 'Item', genreFileSuffix: 'eq',
    columns: ['Item', 'Type', 'Description', 'weight(lbs)', 'cost(GT)', 'TL'],
    columnsByGenre: {
      Modern: ['Item', 'Type', 'Description', 'weight(lbs)', 'cost($)', 'TL'],
      Dystopian: ['Item', 'Type', 'Description', 'weight(lbs)', 'cost($)', 'TL'],
      SciFi: ['Item', 'Type', 'Description', 'weight(lbs)', 'cost($)', 'TL'],
      Apocalyptic: ['Item', 'Type', 'Description', 'weight(lbs)', 'cost($)', 'TL'],
    },
    multi: {},
    mode: 'quoted',
    filesByGenre: {
      Fantasy: ['fantasy_eq.csv'],
      Modern: ['modern_eq.csv'],
      Dystopian: ['dystopian_eq.csv'],
      SciFi: ['scifi_eq.csv'],
      Apocalyptic: ['apocalyptic_eq.csv'],
    },
    newEntryFile: { Fantasy: 'fantasy_eq.csv', Modern: 'modern_eq.csv', Dystopian: 'dystopian_eq.csv', SciFi: 'scifi_eq.csv', Apocalyptic: 'apocalyptic_eq.csv' },
  },
  {
    // Armor detail — a separate, richer catalog from the Equipment tab's
    // own 'armor'-type rows (which stay purchase-only: name/cost/weight/TL).
    // This is where an armor item's real protection values and stamina
    // cost live; the Equipped panel looks a bought armor item up by name
    // in here.
    id: 'armor', label: 'Armor', nameField: 'name', genreFileSuffix: 'armor',
    columns: ['name', 'type', 'description', 'weight', 'cost', 'TL', 'staminaCost', 'impact', 'pierce', 'slash', 'energy', 'ballistic', 'material'],
    multi: {},
    mode: 'quoted',
    filesByGenre: {
      Fantasy: ['fantasy_armor.csv'],
      Modern: ['modern_armor.csv'],
      Dystopian: ['dystopian_armor.csv'],
      SciFi: ['scifi_armor.csv'],
      Apocalyptic: ['apocalyptic_armor.csv'],
    },
    newEntryFile: { Fantasy: 'fantasy_armor.csv', Modern: 'modern_armor.csv', Dystopian: 'dystopian_armor.csv', SciFi: 'scifi_armor.csv', Apocalyptic: 'apocalyptic_armor.csv' },
  },
  {
    // Playable races — each genre has its own race file. Fantasy has the
    // full race list; every other genre currently has Human only. No
    // multiselect columns here: a row's `name` IS the race, not a reference
    // to one (see recomputeDynamicOptions(), which seeds the race-reference
    // multiselects on other tabs from these rows).
    id: 'races', label: 'Races', nameField: 'name', genreFileSuffix: 'race',
    columns: ['name', 'physique', 'strength', 'constitution', 'dexterity', 'agility', 'mysticism', 'willpower', 'bonus melee weapons', 'bonus ranged weapons', 'move_modifier', 'race_pd_mult', 'race_md_mult', 'race_init_mod'],
    multi: {},
    mode: 'naive',
    filesByGenre: {
      Fantasy: ['fantasy_race.csv'],
      Modern: ['modern_race.csv'],
      Dystopian: ['dystopian_race.csv'],
      SciFi: ['scifi_race.csv'],
      Apocalyptic: ['apocalyptic_race.csv'],
    },
    newEntryFile: { Fantasy: 'fantasy_race.csv', Modern: 'modern_race.csv', Dystopian: 'dystopian_race.csv', SciFi: 'scifi_race.csv', Apocalyptic: 'apocalyptic_race.csv' },
  },
  {
    // Psychic skills — a single shared list (not genre-split like the
    // other tabs): `sections` overrides the default GENRES row so this tab
    // renders one "Psychic" section instead of 5 genre sections.
    id: 'psychic', label: 'Psychic', nameField: 'name',
    columns: ['name', 'description', 'power', 'dots', 'min_tl', 'attributes', 'focus', 'race'],
    multi: { attributes: 'attribute', focus: 'class', race: 'race' },
    // power is the psychic school (Telepathy/Telekinesis/Clairvoyance/
    // Telergy/Concord/Teleportation) — group the list by that first, then
    // alphabetically within each school.
    sortField: 'power',
    mode: 'quoted',
    // One panel per Tech Level tier rather than per genre — each tier's
    // file is cumulative (every ability unlocked at a lower tier is also
    // present at every higher one): TL6 = dots <= 3, TL7 = dots <= 5,
    // TL8 = dots <= 7, TL9+ = everything (including dots >= 8).
    sections: ['TL6', 'TL7', 'TL8', 'TL9+'],
    filesByGenre: {
      TL6: ['psychic_tl6.csv'],
      TL7: ['psychic_tl7.csv'],
      TL8: ['psychic_tl8.csv'],
      'TL9+': ['psychic_tl9.csv'],
    },
    newEntryFile: { TL6: 'psychic_tl6.csv', TL7: 'psychic_tl7.csv', TL8: 'psychic_tl8.csv', 'TL9+': 'psychic_tl9.csv' },
    // Hidden whenever the header's Psychic toggle is Off for the selected
    // genre — see vgToggles/renderTabs().
    gatedBy: 'psychic',
  },
  {
    // Magic isn't genre-split in the live app either — Spells/Miracles are
    // one shared list any genre can "bend" Magic onto via its own toggle
    // (character.magicEnabled in app.js), so this tab edits those two flat
    // files directly rather than per-genre copies.
    id: 'magic', label: 'Magic', nameField: 'name',
    columns: ['id', 'school', 'name', 'cost', 'Dots Reqd', 'defy', 'clock', 'crutch', 'full_description'],
    multi: {},
    sortField: 'school',
    mode: 'quoted',
    sections: ['Spells', 'Miracles'],
    filesByGenre: {
      Spells: ['fantasy_spells.csv'],
      Miracles: ['fantasy_miracles.csv'],
    },
    newEntryFile: { Spells: 'fantasy_spells.csv', Miracles: 'fantasy_miracles.csv' },
    gatedBy: 'magic',
  },
  {
    // Not genre-split (same reasoning as Magic/Psychic above) — a single
    // shared list gated purely by the Cyber toggle, with data/cyber.csv
    // starting as an empty scaffold for the VG to fill in.
    id: 'cyber', label: 'Cyber', nameField: 'name',
    columns: ['name', 'description', 'attribute', 'min_tl', 'focus', 'race'],
    multi: { attribute: 'attribute', focus: 'class', race: 'race' },
    mode: 'quoted',
    sections: ['Cyber'],
    filesByGenre: { Cyber: ['cyber.csv'] },
    newEntryFile: { Cyber: 'cyber.csv' },
    gatedBy: 'cyber',
  },
  {
    // Same pattern as Cyber — data/mutant.csv starts empty.
    id: 'mutant', label: 'Mutant', nameField: 'name',
    columns: ['name', 'description', 'attribute', 'min_tl', 'focus', 'race'],
    multi: { attribute: 'attribute', focus: 'class', race: 'race' },
    mode: 'quoted',
    sections: ['Mutant'],
    filesByGenre: { Mutant: ['mutant.csv'] },
    newEntryFile: { Mutant: 'mutant.csv' },
    gatedBy: 'mutant',
  },
];

// =============================================================================
// CSV parsing / serializing
// =============================================================================

// Quote-aware reader — safe for both 'naive' and 'quoted' mode files (naive
// files just never happen to contain quotes/commas in practice; reading them
// with the quote-aware parser is harmless either way).
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

// Mirrors src/data.js's parseSpecialFields exactly: a handful of existing
// special.csv rows have a stray extra field (a data-entry error from before
// this tool existed, e.g. "Lucky Break,...,Intuition,0,,halfling" — 6 fields
// for a 5-column file). The live app recovers by trusting the *last 3*
// fields as cost/focus/race and discarding whatever's left over in the
// middle; this tool must read those rows the same way the live app does, or
// its "race" column would silently come out empty/wrong for them.
function specialRowToObject(header, fields) {
  let f = fields;
  if (f.length > 5 && f[f.length - 1] === '') f = f.slice(0, -1);
  let costRaw;
  let focusRaw;
  let raceRaw;
  if (f.length > 5) {
    costRaw = f[f.length - 3];
    focusRaw = f[f.length - 2];
    raceRaw = f[f.length - 1];
  } else {
    costRaw = f[2];
    focusRaw = f[3];
    raceRaw = f[4];
  }
  const obj = {};
  header.forEach((key) => { obj[key] = ''; });
  obj.name = (f[0] || '').trim();
  obj.description = (f[1] || '').trim();
  obj['stamina cost'] = (costRaw || '').trim();
  obj.focus = (focusRaw || '').trim();
  obj.race = (raceRaw || '').trim();
  return obj;
}

function parseCsvToObjects(text, tabId) {
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { header: [], objects: [] };
  const header = rows[0].map((h) => h.trim());
  const objects = rows.slice(1).map((r) => {
    if (tabId === 'specials') return specialRowToObject(header, r);
    const obj = {};
    header.forEach((key, idx) => { obj[key] = (r[idx] || '').trim(); });
    return obj;
  });
  return { header, objects };
}

// A hand-edited file can spell a column either way (e.g. "attribute" vs
// "attributes" — Skills/Cyber/Mutant's own tab config expects the singular,
// but a file can easily be written with the plural instead, as
// data/morrow_project_skills.csv was) — rendering reads/writes strictly by
// the tab's own `columns` names, so a mismatched spelling makes real data
// silently invisible in the editor even though it loaded fine. Rename the
// loaded header/objects to whichever spelling this tab actually expects, so
// the data shows up regardless of which the file's author used.
const HEADER_ALIAS_PAIRS = [['attribute', 'attributes']];

function normalizeHeaderAliases(tab, header, objects) {
  if (!tab) return;
  HEADER_ALIAS_PAIRS.forEach(([a, b]) => {
    const wantsA = tab.columns.includes(a) && !tab.columns.includes(b);
    const wantsB = tab.columns.includes(b) && !tab.columns.includes(a);
    const [want, have] = wantsA ? [a, b] : wantsB ? [b, a] : [null, null];
    if (!want) return;
    const idx = header.indexOf(have);
    if (idx === -1 || header.includes(want)) return;
    header[idx] = want;
    objects.forEach((obj) => {
      if (have in obj) { obj[want] = obj[have]; delete obj[have]; }
    });
  });
}

function csvField(value, mode) {
  const v = value == null ? '' : String(value);
  if (mode === 'naive') {
    // Naive files (src/data.js's line.split(',') parsers) can't survive a
    // literal comma — strip any that sneak in rather than corrupt the file.
    return v.replace(/,/g, ';');
  }
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function objectsToCsv(header, objects, mode) {
  const lines = [header.join(',')];
  objects.forEach((obj) => {
    lines.push(header.map((key) => csvField(obj[key], mode)).join(','));
  });
  return lines.join('\n') + '\n';
}

function splitMulti(raw) {
  if (!raw) return [];
  return String(raw).split(MULTI_VALUE_DELIMITER).map((s) => s.trim()).filter(Boolean);
}

function joinMulti(values) {
  return (values || []).join(MULTI_VALUE_DELIMITER);
}

function titleCase(s) {
  return String(s || '').trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Most tabs use the same column set for every genre. Equipment is the
// exception — Fantasy's file has a `cost(GT)` column, every other genre's
// has `cost($)` — so `columnsByGenre` lets a tab override `columns` per
// genre when one exists; every other tab just falls through to `columns`.
function getColumnsFor(tab, genre) {
  return (tab.columnsByGenre && tab.columnsByGenre[genre]) || tab.columns;
}

// =============================================================================
// State
// =============================================================================

// state.files: { [filename]: { header: string[], objects: object[], mode } }
const state = {
  files: {},
  loaded: false,
  collapsedSections: new Set(),
  // key `${tab.id}::${genre}` -> { column, dir } — set by clicking a column
  // header (see renderTable); absent means "use the tab's default sort"
  // (rowsForGenre's name/sortField logic). Lets the VG sort any section by
  // TL (or anything else) to review content tier-by-tier.
  columnSort: {},
};
// Focus/Class options, like races, vary by genre — each genre's own
// Expertise tab (<genre>_expertise.csv) is the sole source of truth for
// which Focus names exist there, same as the Races tab is for race names.
// A genre whose Expertise file renames or adds a class (e.g. a custom
// genre renaming "Adept" to something else) sees that reflected everywhere
// else's Focus column for that genre, with no separate/stray list to drift
// out of sync — see recomputeDynamicOptions() and getDynamicClassesForGenre().
let dynamicClassesByGenre = {};
// Races, unlike classes, vary by genre (see the Races tab) — scoped per
// genre key rather than one global set. A race added from a non-genre
// section (the Psychic tab's single "Psychic" section) goes into
// extraDynamicRaces instead, since it isn't scoped to any one genre.
let dynamicRacesByGenre = {};
let extraDynamicRaces = new Set();
let activeTabId = TABS[0].id;
// The header's Genre selector. Only affects tabs that don't set their own
// `sections` override (i.e. are genre-split) — a tab with a custom
// `sections` list (Psychic's TL tiers) ignores this and always shows all
// of its own sections.
let selectedGenre = GENRES[0];

// data/tech_levels.csv — flat (TL,genre,magic,psychic,mutant,cyber rows),
// not genre-split, so not part of the TABS/filesByGenre system at all.
// Loaded as a special case in the folder-load handler, both so New Genre
// creation (createNewGenre()) can append a row to it, and so the header's
// Magic/Cyber/Mutant/Psychic toggles (see vgToggles below) have a per-genre
// default to read and a place to write a VG's changes back to. null until
// loaded.
let techLevelsFile = null;

// Mirrors data/src/data.js's GENRE_LABEL_MAP — vg-tools doesn't share code
// with the live app (no module system, see top of file), so this is kept in
// sync by hand. Used only as a FALLBACK in techLevelRowsForGenre() below,
// for a catalog with no tech_levels.csv row literally named after it (only
// SciFi today — it's reached purely via its era labels Interplanetary/
// Interstellar/Intergalactic, each a distinct row). Every other catalog
// matches its own row directly by name, so this never needs consulting for
// them, and "primitive"/"Computer Age"/"AI"/"Information Age" (not
// catalogs vg-tools edits at all) never get a chance to alias into one.
const VG_GENRE_LABEL_MAP = {
  interplanetary: 'SciFi',
  interstellar: 'SciFi',
  intergalactic: 'SciFi',
};

function resolveVgCatalogGenre(label) {
  return VG_GENRE_LABEL_MAP[String(label || '').toLowerCase()] || null;
}

// Case/whitespace/underscore-insensitive compare — a genre discovered from
// filenames (e.g. "morrow_project") and its tech_levels.csv label (e.g.
// "Morrow Project") need to match despite differing only in that.
function normalizeGenreKey(s) {
  return String(s || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
}

function parseTechLevelsCsv(text) {
  return text.trim().split('\n').filter((line) => line.trim()).slice(1).map((line) => {
    const parts = line.split(',');
    return {
      tl: (parts[0] || '').trim(),
      genre: (parts[1] || '').trim(),
      magic: (parts[2] || 'off').trim(),
      psychic: (parts[3] || 'off').trim(),
      mutant: (parts[4] || 'off').trim(),
      cyber: (parts[5] || 'off').trim(),
    };
  });
}

function techLevelsCsvText(rows) {
  return ['TL,genre,magic,psychic,mutant,cyber', ...rows.map((r) => `${r.tl},${r.genre},${r.magic},${r.psychic},${r.mutant},${r.cyber}`)].join('\n') + '\n';
}

// Header toggles: reflect the currently selected genre's tech_levels.csv
// defaults (see refreshVgToggles()) and can be edited directly by the VG —
// doing so writes straight back into techLevelsFile (see
// setToggleForGenre()) ready for the "Save tech_levels.csv" button.
let vgToggles = { magic: false, psychic: false, mutant: false, cyber: false };

// "on"/"off" is the convention in data/tech_levels.csv; "yes"/"no"/"true"
// also read as on/true for leniency against hand edits.
function toggleIsOn(v) {
  return ['on', 'yes', 'true'].includes((v || '').trim().toLowerCase());
}

// A genre can be covered by several raw tech_levels.csv rows (e.g. both
// "Dystopian" and "AI" resolve to the Dystopian catalog) — all of them
// should agree, so reads take the first and writes apply to every one.
function techLevelRowsForGenre(genre) {
  if (!techLevelsFile) return [];
  const needle = normalizeGenreKey(genre);
  const exact = techLevelsFile.rows.filter((r) => normalizeGenreKey(r.genre) === needle);
  if (exact.length) return exact;
  // No row is literally named this genre — fall back to the era-label
  // mapping (today, only SciFi needs this).
  return techLevelsFile.rows.filter((r) => resolveVgCatalogGenre(r.genre) === genre);
}

function getToggleDefaultsForGenre(genre) {
  const row = techLevelRowsForGenre(genre)[0];
  return {
    magic: row ? toggleIsOn(row.magic) : false,
    psychic: row ? toggleIsOn(row.psychic) : false,
    mutant: row ? toggleIsOn(row.mutant) : false,
    cyber: row ? toggleIsOn(row.cyber) : false,
  };
}

function setToggleForGenre(genre, key, value) {
  const rows = techLevelRowsForGenre(genre);
  if (!rows.length) return;
  const strVal = value ? 'on' : 'off';
  let changed = false;
  rows.forEach((r) => {
    if (r[key] !== strVal) { r[key] = strVal; changed = true; }
  });
  if (changed) techLevelsFile.dirty = true;
}

function renderVgToggleInputs() {
  el.vgMagicOn.checked = vgToggles.magic;
  el.vgMagicOff.checked = !vgToggles.magic;
  el.vgCyberOn.checked = vgToggles.cyber;
  el.vgCyberOff.checked = !vgToggles.cyber;
  el.vgMutantOn.checked = vgToggles.mutant;
  el.vgMutantOff.checked = !vgToggles.mutant;
  el.vgPsychicOn.checked = vgToggles.psychic;
  el.vgPsychicOff.checked = !vgToggles.psychic;
}

// Re-reads the selected genre's Magic/Psychic/Mutant/Cyber defaults from
// techLevelsFile and re-renders both the toggle inputs and the tab bar
// (gated tabs show/hide based on the result) — call after loading the
// folder, switching genre, or creating a new genre.
function refreshVgToggles() {
  vgToggles = getToggleDefaultsForGenre(selectedGenre);
  renderVgToggleInputs();
  renderAll();
}

// Set once the VG grants write access via "Enable direct save to data/…"
// (window.showDirectoryPicker, File System Access API). While set, Save
// writes straight into this directory instead of triggering downloads —
// see writeFileDirect() and saveFile() below. Support for this API varies
// by browser/context, so every write attempt is wrapped in a try/catch
// that falls back to the download behavior on any failure.
let writableDirHandle = null;

function getDynamicRacesForGenre(genre) {
  if (dynamicRacesByGenre[genre]) return [...new Set([...dynamicRacesByGenre[genre], ...extraDynamicRaces])];
  // Not a real genre key (e.g. the Psychic tab's single section) — races
  // there aren't genre-scoped, so offer the union of every known race.
  const all = new Set(extraDynamicRaces);
  Object.values(dynamicRacesByGenre).forEach((set) => set.forEach((v) => all.add(v)));
  return all.size ? [...all] : [...BASE_RACES];
}

function getDynamicClassesForGenre(genre) {
  if (dynamicClassesByGenre[genre]) return [...dynamicClassesByGenre[genre]];
  // Not a real genre key (Psychic/Cyber/Mutant's sections aren't genres) —
  // these cross-genre systems aren't tied to one genre's Expertise list, so
  // offer the union of every genre's classes instead.
  const all = new Set();
  Object.values(dynamicClassesByGenre).forEach((set) => set.forEach((v) => all.add(v)));
  return all.size ? [...all] : [...BASE_CLASSES];
}

function addDynamicRace(genre, value) {
  if (dynamicRacesByGenre[genre]) { dynamicRacesByGenre[genre].add(value); return; }
  extraDynamicRaces.add(value);
}

function allFilenames() {
  const set = new Set();
  TABS.forEach((tab) => {
    (tab.sections || knownGenres).forEach((genre) => {
      (tab.filesByGenre[genre] || []).forEach((f) => set.add(f));
    });
  });
  return [...set];
}

function ensureFileEntry(filename, mode) {
  if (!state.files[filename]) {
    const header = inferHeaderForFile(filename);
    state.files[filename] = { header, objects: [], mode };
  }
  return state.files[filename];
}

function inferHeaderForFile(filename) {
  for (const tab of TABS) {
    for (const genre of (tab.sections || knownGenres)) {
      if ((tab.filesByGenre[genre] || []).includes(filename)) return [...getColumnsFor(tab, genre)];
    }
  }
  return [];
}

function recomputeDynamicOptions() {
  dynamicClassesByGenre = {};
  dynamicRacesByGenre = {};
  extraDynamicRaces = new Set();
  knownGenres.forEach((g) => { dynamicClassesByGenre[g] = new Set(); dynamicRacesByGenre[g] = new Set(); });

  // The Expertise tab's rows define a genre's Focus/Class names by `name`
  // (not by a `focus` column) — the sole, genre-scoped source of truth: a
  // genre's Focus options everywhere else come only from its own
  // <genre>_expertise.csv, same as Races tab rows are the sole source for
  // that genre's race options. Renaming/adding a row there is reflected
  // immediately, with no separate stray-value list to drift out of sync.
  const expertiseTab = TABS.find((t) => t.id === 'expertise');
  if (expertiseTab) {
    (expertiseTab.sections || knownGenres).forEach((genre) => {
      (expertiseTab.filesByGenre[genre] || []).forEach((fname) => {
        const entry = state.files[fname];
        if (!entry) return;
        entry.objects.forEach((obj) => {
          if (obj.name && dynamicClassesByGenre[genre]) dynamicClassesByGenre[genre].add(titleCase(obj.name));
        });
      });
    });
  }
  knownGenres.forEach((g) => {
    if (!dynamicClassesByGenre[g].size) BASE_CLASSES.forEach((c) => dynamicClassesByGenre[g].add(c));
  });

  // The Races tab's rows define races by name (not by a `race` column) —
  // this is the primary, genre-scoped source of truth: a race added on that
  // tab for a given genre becomes selectable only within that genre.
  const racesTab = TABS.find((t) => t.id === 'races');
  if (racesTab) {
    (racesTab.sections || knownGenres).forEach((genre) => {
      (racesTab.filesByGenre[genre] || []).forEach((fname) => {
        const entry = state.files[fname];
        if (!entry) return;
        entry.objects.forEach((obj) => {
          if (obj.name) addDynamicRace(genre, titleCase(obj.name));
        });
      });
    });
  }

  // Union in any race values already used in that same genre's own data
  // files (keeps odd/legacy race values visible even if the race file
  // doesn't (yet) define them).
  TABS.forEach((tab) => {
    (tab.sections || knownGenres).forEach((genre) => {
      (tab.filesByGenre[genre] || []).forEach((fname) => {
        const entry = state.files[fname];
        if (!entry) return;
        entry.objects.forEach((obj) => {
          splitMulti(obj.race).forEach((v) => addDynamicRace(genre, titleCase(v)));
        });
      });
    });
  });

  // Safety floor: Human is the one race guaranteed in every genre, so an
  // otherwise-empty genre (e.g. its race file hasn't loaded) still offers it.
  knownGenres.forEach((g) => {
    if (!dynamicRacesByGenre[g].size) dynamicRacesByGenre[g].add('Human');
  });
}

// =============================================================================
// Loading
// =============================================================================

const el = {
  loadFolderBtn: document.getElementById('loadFolderBtn'),
  enableDirectSaveBtn: document.getElementById('enableDirectSaveBtn'),
  loadStatus: document.getElementById('loadStatus'),
  vgGenreSelect: document.getElementById('vgGenreSelect'),
  vgNewGenreForm: document.getElementById('vgNewGenreForm'),
  vgSaveTechLevelsBtn: document.getElementById('vgSaveTechLevelsBtn'),
  vgSaveAllBtn: document.getElementById('vgSaveAllBtn'),
  vgPublishBtn: document.getElementById('vgPublishBtn'),
  vgTabs: document.getElementById('vgTabs'),
  vgTabPanels: document.getElementById('vgTabPanels'),
  vgMagicOn: document.getElementById('vgMagicEnabledOn'),
  vgMagicOff: document.getElementById('vgMagicEnabledOff'),
  vgCyberOn: document.getElementById('vgCyberEnabledOn'),
  vgCyberOff: document.getElementById('vgCyberEnabledOff'),
  vgMutantOn: document.getElementById('vgMutantEnabledOn'),
  vgMutantOff: document.getElementById('vgMutantEnabledOff'),
  vgPsychicOn: document.getElementById('vgPsychicEnabledOn'),
  vgPsychicOff: document.getElementById('vgPsychicEnabledOff'),
};

const NEW_GENRE_OPTION_VALUE = '__new_genre__';

function renderGenreSelectOptions() {
  el.vgGenreSelect.innerHTML = '';
  knownGenres.forEach((genre) => {
    const opt = document.createElement('option');
    opt.value = genre;
    opt.textContent = genre;
    el.vgGenreSelect.appendChild(opt);
  });
  const newOpt = document.createElement('option');
  newOpt.value = NEW_GENRE_OPTION_VALUE;
  newOpt.textContent = '+ New Genre…';
  el.vgGenreSelect.appendChild(newOpt);
  el.vgGenreSelect.value = selectedGenre;
}
renderGenreSelectOptions();

el.vgGenreSelect.addEventListener('change', () => {
  if (el.vgGenreSelect.value === NEW_GENRE_OPTION_VALUE) {
    el.vgGenreSelect.value = selectedGenre; // never let "+ New Genre…" itself stick as the selection
    openNewGenreForm();
    return;
  }
  selectedGenre = el.vgGenreSelect.value;
  refreshVgToggles(); // also renders tabs/panels
});

// Header Magic/Cyber/Mutant/Psychic toggles — editing one here writes
// straight into techLevelsFile for the selected genre (every raw
// tech_levels.csv row that resolves to it), ready for "Save
// tech_levels.csv"; see setToggleForGenre().
function onVgToggleChange(key, checked) {
  vgToggles[key] = checked;
  setToggleForGenre(selectedGenre, key, checked);
  updateSaveTechLevelsButton();
  renderAll();
}
el.vgMagicOn.addEventListener('change', () => onVgToggleChange('magic', el.vgMagicOn.checked));
el.vgMagicOff.addEventListener('change', () => onVgToggleChange('magic', el.vgMagicOn.checked));
el.vgCyberOn.addEventListener('change', () => onVgToggleChange('cyber', el.vgCyberOn.checked));
el.vgCyberOff.addEventListener('change', () => onVgToggleChange('cyber', el.vgCyberOn.checked));
el.vgMutantOn.addEventListener('change', () => onVgToggleChange('mutant', el.vgMutantOn.checked));
el.vgMutantOff.addEventListener('change', () => onVgToggleChange('mutant', el.vgMutantOn.checked));
el.vgPsychicOn.addEventListener('change', () => onVgToggleChange('psychic', el.vgPsychicOn.checked));
el.vgPsychicOff.addEventListener('change', () => onVgToggleChange('psychic', el.vgPsychicOn.checked));

// =============================================================================
// New Genre creation
// =============================================================================

// Letters/digits only, no spaces — hyphen and underscore are the only
// punctuation allowed (the label becomes a lowercase filename prefix, e.g.
// "Post_Apoc" -> post_apoc_skills.csv, so it has to be filename-safe).
const NEW_GENRE_LABEL_PATTERN = /^[A-Za-z0-9_-]+$/;

function updateSaveTechLevelsButton() {
  el.vgSaveTechLevelsBtn.hidden = !techLevelsFile;
  el.vgSaveTechLevelsBtn.textContent = 'Save tech_levels.csv' + (techLevelsFile && techLevelsFile.dirty ? ' ●' : '');
}

async function saveTechLevels() {
  if (!techLevelsFile) return;
  const text = techLevelsCsvText(techLevelsFile.rows);
  if (techLevelsFile.originalText != null) {
    await writeFileOrDownload(backupFilename('tech_levels.csv', 1), techLevelsFile.originalText);
    await writeFileOrDownload(backupFilename('tech_levels.csv', 2), techLevelsFile.originalText);
  }
  await writeFileOrDownload('tech_levels.csv', text);
  techLevelsFile.dirty = false;
  updateSaveTechLevelsButton();
}
el.vgSaveTechLevelsBtn.addEventListener('click', saveTechLevels);

function openNewGenreForm() {
  const form = el.vgNewGenreForm;
  form.innerHTML = '';
  form.hidden = false;

  const title = document.createElement('div');
  title.className = 'vg-new-genre-title';
  title.textContent = 'Create a new Genre';
  form.appendChild(title);

  const row1 = document.createElement('div');
  row1.className = 'vg-new-genre-row';

  const labelField = document.createElement('label');
  labelField.textContent = 'Label';
  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'e.g. Cyberpunk, post_apoc';
  labelField.appendChild(labelInput);

  const tlField = document.createElement('label');
  tlField.textContent = 'Tech Level';
  const tlInput = document.createElement('input');
  tlInput.type = 'number';
  tlInput.min = '1';
  tlInput.step = '1';
  tlField.appendChild(tlInput);

  row1.appendChild(labelField);
  row1.appendChild(tlField);
  form.appendChild(row1);

  const row2 = document.createElement('div');
  row2.className = 'vg-new-genre-row';

  const copyYesLabel = document.createElement('label');
  const copyYesRadio = document.createElement('input');
  copyYesRadio.type = 'radio';
  copyYesRadio.name = 'vgNewGenreCopy';
  copyYesRadio.value = 'yes';
  copyYesRadio.checked = true;
  copyYesLabel.appendChild(copyYesRadio);
  copyYesLabel.appendChild(document.createTextNode(' Copy files from an existing genre'));

  const copyNoLabel = document.createElement('label');
  const copyNoRadio = document.createElement('input');
  copyNoRadio.type = 'radio';
  copyNoRadio.name = 'vgNewGenreCopy';
  copyNoRadio.value = 'no';
  copyNoLabel.appendChild(copyNoRadio);
  copyNoLabel.appendChild(document.createTextNode(' Start empty (header-only files)'));

  row2.appendChild(copyYesLabel);
  row2.appendChild(copyNoLabel);
  form.appendChild(row2);

  const copyFromSelect = document.createElement('select');
  knownGenres.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    copyFromSelect.appendChild(opt);
  });
  const copyFromWrap = document.createElement('label');
  copyFromWrap.className = 'vg-new-genre-copyfrom';
  copyFromWrap.appendChild(document.createTextNode('Copy from: '));
  copyFromWrap.appendChild(copyFromSelect);
  form.appendChild(copyFromWrap);

  copyYesRadio.addEventListener('change', () => { copyFromWrap.hidden = !copyYesRadio.checked; });
  copyNoRadio.addEventListener('change', () => { copyFromWrap.hidden = copyNoRadio.checked; });

  const errorLine = document.createElement('div');
  errorLine.className = 'vg-new-genre-error';
  errorLine.hidden = true;
  form.appendChild(errorLine);

  const actions = document.createElement('div');
  actions.className = 'vg-new-genre-actions';
  const createBtn = document.createElement('button');
  createBtn.type = 'button';
  createBtn.textContent = 'Create Genre';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'secondary';
  cancelBtn.textContent = 'Cancel';
  actions.appendChild(createBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(actions);

  cancelBtn.addEventListener('click', () => closeNewGenreForm());

  createBtn.addEventListener('click', () => {
    const label = labelInput.value.trim();
    const tlRaw = tlInput.value.trim();
    const showError = (msg) => { errorLine.textContent = msg; errorLine.hidden = false; };

    if (!label) return showError('Enter a label for the new genre.');
    if (!NEW_GENRE_LABEL_PATTERN.test(label)) {
      return showError('Label must be letters and numbers only (hyphen - and underscore _ are OK) — no spaces or other punctuation.');
    }
    if (knownGenres.some((g) => g.toLowerCase() === label.toLowerCase())) {
      return showError(`"${label}" already exists as a genre.`);
    }
    const tl = Number(tlRaw);
    if (!tlRaw || !Number.isInteger(tl) || tl <= 0) {
      return showError('Tech Level must be a whole positive number.');
    }

    const copyFrom = copyYesRadio.checked ? copyFromSelect.value : null;
    createNewGenre(label, tl, copyFrom);
    closeNewGenreForm();
  });

  labelInput.focus();
}

function closeNewGenreForm() {
  el.vgNewGenreForm.hidden = true;
  el.vgNewGenreForm.innerHTML = '';
}

// Creates every genre-split tab's file for a brand-new genre (copied from
// an existing genre's loaded data, or empty/header-only) and adds a row to
// tech_levels.csv for it. None of this touches disk — it populates
// in-memory state exactly the way loading a folder would, so the VG
// reviews/edits the result normally and publishes it with the usual Save
// buttons (plus the new "Save tech_levels.csv" button for the TL row).
function createNewGenre(label, tl, copyFromGenre) {
  knownGenres.push(label);

  if (!techLevelsFile) techLevelsFile = { rows: [], originalText: null };
  // One row per genre, even when its TL number is already used by another
  // genre (same as "primitive" already spanning TL 1 and TL 2) — the live
  // app's Tech Level dropdown shows every row as its own option regardless.
  // A copied genre inherits the source's Magic/Psychic/Mutant/Cyber
  // defaults; starting empty defaults all 4 off.
  const sourceDefaults = copyFromGenre ? getToggleDefaultsForGenre(copyFromGenre) : null;
  const toOnOff = (v) => (v ? 'on' : 'off');
  techLevelsFile.rows.push({
    tl: String(tl),
    genre: label,
    magic: toOnOff(sourceDefaults && sourceDefaults.magic),
    psychic: toOnOff(sourceDefaults && sourceDefaults.psychic),
    mutant: toOnOff(sourceDefaults && sourceDefaults.mutant),
    cyber: toOnOff(sourceDefaults && sourceDefaults.cyber),
  });
  techLevelsFile.dirty = true;

  TABS.forEach((tab) => {
    if (!tab.genreFileSuffix) return; // not genre-split (e.g. Psychic's TL tiers)
    const targetFile = `${label.toLowerCase()}_${tab.genreFileSuffix}.csv`;
    tab.filesByGenre[label] = [targetFile];
    tab.newEntryFile[label] = targetFile;

    const sourceFile = copyFromGenre && (tab.filesByGenre[copyFromGenre] || [])[0];
    const sourceEntry = sourceFile && state.files[sourceFile];

    if (tab.id === 'equipment') {
      tab.columnsByGenre = tab.columnsByGenre || {};
      // Copying inherits the source genre's cost-column shape; otherwise
      // the new genre's own Tech Level decides it — same GT-at-TL<=3,
      // $-above-that rule used everywhere else in this app.
      tab.columnsByGenre[label] = sourceEntry
        ? [...getColumnsFor(tab, copyFromGenre)]
        : (tl > 3
          ? ['Item', 'Type', 'Description', 'weight(lbs)', 'cost($)', 'TL']
          : ['Item', 'Type', 'Description', 'weight(lbs)', 'cost(GT)', 'TL']);
    }

    if (sourceEntry) {
      state.files[targetFile] = {
        header: [...sourceEntry.header],
        objects: sourceEntry.objects.map((obj) => ({ ...obj })),
        mode: tab.mode,
        // No originalText — this file never existed before, so Save()
        // skips backups for it (nothing to back up), same as any other
        // brand-new file.
        dirty: true, // real copied content, not yet written anywhere
      };
      return;
    }

    state.files[targetFile] = { header: [...getColumnsFor(tab, label)], objects: [], mode: tab.mode };
  });

  selectedGenre = label;
  renderGenreSelectOptions();
  recomputeDynamicOptions();
  updateSaveTechLevelsButton();
  refreshVgToggles(); // also renders tabs/panels
  el.loadStatus.textContent = `Created genre "${label}" (TL ${tl}). Review its files, then use each section's own Save button to publish them — and click "Save tech_levels.csv" above to publish the new Tech Level row.`;
  el.loadStatus.className = 'vg-load-status vg-ok';
}

const folderInput = document.createElement('input');
folderInput.type = 'file';
folderInput.webkitdirectory = true;
folderInput.multiple = true;
folderInput.hidden = true;
document.body.appendChild(folderInput);

el.loadFolderBtn.addEventListener('click', () => folderInput.click());

el.enableDirectSaveBtn.addEventListener('click', async () => {
  if (typeof window.showDirectoryPicker !== 'function') {
    el.loadStatus.textContent = 'This browser doesn’t support direct folder writes — Save will keep using downloads instead.';
    el.loadStatus.className = 'vg-load-status vg-warn';
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    writableDirHandle = handle;
    el.loadStatus.textContent = `Direct save enabled for "${handle.name}" — Save buttons now write there directly (backups included), no download needed.`;
    el.loadStatus.className = 'vg-load-status vg-ok';
  } catch (err) {
    // User cancelled the picker, or the browser/context refused (e.g. the
    // write-capable File System Access API can be blocked on some origins
    // even when the function exists) — keep using downloads, no harm done.
    writableDirHandle = null;
    if (err && err.name !== 'AbortError') {
      el.loadStatus.textContent = `Couldn't enable direct save (${err && err.message ? err.message : err}) — Save will use downloads instead.`;
      el.loadStatus.className = 'vg-load-status vg-warn';
    }
  }
});

const BASE_GENRE_PREFIXES = new Set(GENRES.map((g) => g.toLowerCase()));

// A genre created via createNewGenre() only lives in knownGenres for the
// current page session — reloading vg-tools.html forgets it even though its
// files are still sitting in data/ (see createNewGenre()'s file-writing).
// Every genre, base or custom, has its own {prefix}_expertise.csv, so that
// filename is the one reliable signal to re-discover it from the folder the
// VG just picked. The discovered label is just the lowercase file prefix
// (e.g. "morrow_project") rather than an attempt to recover the VG's
// originally-typed casing, which the filename alone can't tell us.
function discoverGenresFromFiles(files) {
  const discovered = [];
  const seenPrefixes = new Set();
  files.forEach((f) => {
    const m = f.name.match(/^(.+)_expertise\.csv$/i);
    if (!m) return;
    const prefix = m[1].toLowerCase();
    if (seenPrefixes.has(prefix)) return;
    seenPrefixes.add(prefix);
    if (BASE_GENRE_PREFIXES.has(prefix)) return;
    if (knownGenres.some((g) => g.toLowerCase() === prefix)) return;
    discovered.push(prefix);
  });

  discovered.forEach((label) => {
    knownGenres.push(label);
    TABS.forEach((tab) => {
      if (!tab.genreFileSuffix) return; // not genre-split (e.g. Psychic's TL tiers)
      const targetFile = `${label}_${tab.genreFileSuffix}.csv`;
      tab.filesByGenre[label] = [targetFile];
      tab.newEntryFile[label] = targetFile;
    });
  });
  return discovered;
}

// Equipment's cost column name (GT vs $) and Firearms' extra Modern-only
// columns (Mag/Cost($)/Class) can't be guessed for a freshly-discovered
// genre the way createNewGenre() guesses Equipment's from TL — but once a
// tab's file has actually loaded below, its real header settles the
// question with no guessing needed, for either tab.
function reconcileDiscoveredColumns(discoveredGenres) {
  if (!discoveredGenres.length) return;
  ['equipment', 'firearms'].forEach((tabId) => {
    const tab = TABS.find((t) => t.id === tabId);
    if (!tab) return;
    discoveredGenres.forEach((label) => {
      const fname = (tab.filesByGenre[label] || [])[0];
      const entry = fname && state.files[fname];
      if (entry && entry.header && entry.header.length) {
        tab.columnsByGenre = tab.columnsByGenre || {};
        tab.columnsByGenre[label] = [...entry.header];
      }
    });
  });
}

folderInput.addEventListener('change', async () => {
  const files = [...folderInput.files];
  if (files.length === 0) return;
  const discoveredGenres = discoverGenresFromFiles(files);
  const wanted = new Set(allFilenames());
  const matches = files.filter((f) => wanted.has(f.name));

  const modeByFile = {};
  const tabIdByFile = {};
  TABS.forEach((tab) => {
    (tab.sections || knownGenres).forEach((genre) => {
      (tab.filesByGenre[genre] || []).forEach((fname) => { modeByFile[fname] = tab.mode; tabIdByFile[fname] = tab.id; });
    });
  });

  let loadedCount = 0;
  for (const file of matches) {
    const text = await file.text();
    const { header, objects } = parseCsvToObjects(text, tabIdByFile[file.name]);
    const finalHeader = header.length ? header : inferHeaderForFile(file.name);
    normalizeHeaderAliases(TABS.find((t) => t.id === tabIdByFile[file.name]), finalHeader, objects);
    // originalText is the file exactly as read from disk this session,
    // before any edits — saveFile() backs this up (not the live in-memory
    // edits) whenever the user saves, so the pre-session version is never
    // lost even across multiple saves in one sitting.
    state.files[file.name] = { header: finalHeader, objects, mode: modeByFile[file.name] || 'naive', originalText: text };
    loadedCount += 1;
  }
  // Any expected file not found on disk (e.g. a brand-new scaffold not yet
  // created) still gets an empty in-memory entry so its section renders.
  wanted.forEach((fname) => { if (!state.files[fname]) ensureFileEntry(fname, modeByFile[fname] || 'naive'); });

  // tech_levels.csv isn't part of any tab's filesByGenre (it's flat, not
  // genre-split) — loaded as a special case purely so New Genre creation
  // (see createNewGenre()) can add a row to it and offer it for saving.
  const techLevelsFileObj = files.find((f) => f.name === 'tech_levels.csv');
  if (techLevelsFileObj) {
    const text = await techLevelsFileObj.text();
    techLevelsFile = { rows: parseTechLevelsCsv(text), originalText: text };
  }
  updateSaveTechLevelsButton();
  reconcileDiscoveredColumns(discoveredGenres);

  state.loaded = true;
  recomputeDynamicOptions();
  renderGenreSelectOptions();
  const discoveredNote = discoveredGenres.length
    ? ` Rediscovered genre(s) from a previous session: ${discoveredGenres.join(', ')}.`
    : '';
  el.loadStatus.textContent = `Loaded ${loadedCount} of ${wanted.size} known CSV files from the selected folder.${discoveredNote}`;
  el.loadStatus.className = 'vg-load-status ' + (loadedCount === wanted.size ? 'vg-ok' : 'vg-warn');
  refreshVgToggles(); // also renders tabs/panels
});

// =============================================================================
// Rendering
// =============================================================================

// A tab with `gatedBy` (Magic/Psychic/Mutant/Cyber) only shows while that
// system's header toggle is On for the currently selected genre.
function isTabVisible(tab) {
  return !tab.gatedBy || vgToggles[tab.gatedBy];
}

function visibleTabs() {
  return TABS.filter(isTabVisible);
}

function renderTabs() {
  el.vgTabs.innerHTML = '';
  visibleTabs().forEach((tab) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vg-tab-btn' + (tab.id === activeTabId ? ' active' : '');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => { activeTabId = tab.id; renderAll(); });
    el.vgTabs.appendChild(btn);
  });
}

function renderAll() {
  // Cheap (pure in-memory scan, no I/O) relative to the DOM rebuild below,
  // so re-derive every time rather than only on folder-load/createNewGenre —
  // otherwise a rename/add/delete on the Expertise or Races tab wouldn't
  // show up in any other tab's Focus/Race options until a full reload.
  recomputeDynamicOptions();
  const visible = visibleTabs();
  // The active tab's toggle may have just been switched Off — fall back to
  // the first still-visible tab rather than rendering nothing.
  if (!visible.some((t) => t.id === activeTabId)) {
    activeTabId = visible.length ? visible[0].id : null;
  }
  renderTabs();
  el.vgTabPanels.innerHTML = '';
  visible.forEach((tab) => {
    const panel = document.createElement('div');
    panel.className = 'vg-tabpanel' + (tab.id === activeTabId ? ' active' : '');
    panel.id = `panel-${tab.id}`;
    (tab.sections || [selectedGenre]).forEach((genre) => panel.appendChild(renderGenreSection(tab, genre)));
    el.vgTabPanels.appendChild(panel);
  });
}

// Numeric-aware compare for columns like TL/min_tl/cost/dots — "10" must
// sort after "9", not before it as a plain string compare would. A range
// value ("2-10") compares by its lower bound. Falls back to a plain string
// compare for genuinely non-numeric columns (name, description, ...).
function compareColumnValues(a, b) {
  const an = parseFloat(a);
  const bn = parseFloat(b);
  const aIsNum = String(a || '').trim() !== '' && !Number.isNaN(an);
  const bIsNum = String(b || '').trim() !== '' && !Number.isNaN(bn);
  if (aIsNum && bIsNum) return an - bn;
  return String(a || '').localeCompare(String(b || ''));
}

function rowsForGenre(tab, genre) {
  const files = tab.filesByGenre[genre] || [];
  const rows = [];
  files.forEach((fname) => {
    const entry = ensureFileEntry(fname, tab.mode);
    entry.objects.forEach((obj) => rows.push({ file: fname, obj }));
  });

  // A column header click (see renderTable) overrides the tab's default
  // sort — e.g. sorting by TL/min_tl to review content tier-by-tier.
  const override = state.columnSort[`${tab.id}::${genre}`];
  if (override) {
    const { column, dir } = override;
    rows.sort((a, b) => {
      const cmp = compareColumnValues(a.obj[column], b.obj[column]) * dir;
      if (cmp !== 0) return cmp;
      return String(a.obj[tab.nameField] || '').localeCompare(String(b.obj[tab.nameField] || ''));
    });
    return rows;
  }

  // Otherwise, most tabs sort by name; a tab can set sortField to group by
  // something else first (the Psychic tab groups by `power` — its school —
  // then by name within each power).
  const primary = tab.sortField;
  rows.sort((a, b) => {
    if (primary) {
      const cmp = String(a.obj[primary] || '').localeCompare(String(b.obj[primary] || ''));
      if (cmp !== 0) return cmp;
    }
    return String(a.obj[tab.nameField] || '').localeCompare(String(b.obj[tab.nameField] || ''));
  });
  return rows;
}

function renderGenreSection(tab, genre) {
  const sectionKey = `${tab.id}::${genre}`;
  const section = document.createElement('details');
  section.className = 'vg-genre-section';
  section.open = !state.collapsedSections.has(sectionKey);
  section.addEventListener('toggle', () => {
    if (section.open) state.collapsedSections.delete(sectionKey);
    else state.collapsedSections.add(sectionKey);
  });

  const files = tab.filesByGenre[genre] || [];
  const rows = rowsForGenre(tab, genre);

  const summary = document.createElement('summary');
  summary.className = 'vg-genre-section-header';
  const h3 = document.createElement('h3');
  h3.textContent = genre;
  files.forEach((f) => {
    const tag = document.createElement('span');
    tag.className = 'vg-file-tag';
    tag.textContent = f;
    h3.appendChild(tag);
  });
  summary.appendChild(h3);
  section.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'vg-genre-section-body';

  const actions = document.createElement('div');
  actions.className = 'vg-genre-actions';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'secondary vg-add-row-btn';
  addBtn.textContent = `+ Add ${tab.label.replace(/s$/, '')}`;
  addBtn.disabled = !state.loaded;
  addBtn.addEventListener('click', () => {
    const fname = tab.newEntryFile[genre];
    const entry = ensureFileEntry(fname, tab.mode);
    const blank = {};
    getColumnsFor(tab, genre).forEach((col) => { blank[col] = ''; });
    blank.__new = true;
    entry.objects.push(blank);
    entry.dirty = true;
    renderAll();
  });
  actions.appendChild(addBtn);
  files.forEach((fname) => {
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.dataset.saveFile = fname;
    const isDirty = state.files[fname] && state.files[fname].dirty;
    saveBtn.textContent = `Save ${fname}` + (isDirty ? ' ●' : '');
    saveBtn.addEventListener('click', () => saveFile(fname, tab.mode));
    actions.appendChild(saveBtn);
  });
  body.appendChild(actions);

  const countEl = document.createElement('div');
  countEl.className = 'vg-row-count';
  countEl.textContent = `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`;
  body.appendChild(countEl);

  if (!state.loaded) {
    const note = document.createElement('div');
    note.className = 'vg-empty-note';
    note.textContent = 'Load the data/ folder above to see and edit entries.';
    body.appendChild(note);
  } else {
    const tableWrap = document.createElement('div');
    tableWrap.className = 'vg-table-wrap';
    tableWrap.appendChild(renderTable(tab, genre, rows));
    body.appendChild(tableWrap);
  }

  section.appendChild(body);
  return section;
}

function renderTable(tab, genre, rows) {
  const table = document.createElement('table');
  table.className = 'vg-table';

  const columns = getColumnsFor(tab, genre);
  const sectionKey = `${tab.id}::${genre}`;
  const activeSort = state.columnSort[sectionKey];
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.className = 'vg-sortable-col';
    th.title = `Sort by ${col}`;
    const isActive = activeSort && activeSort.column === col;
    th.textContent = col + (isActive ? (activeSort.dir === 1 ? ' ▲' : ' ▼') : '');
    th.addEventListener('click', () => {
      if (isActive) {
        if (activeSort.dir === 1) {
          state.columnSort[sectionKey] = { column: col, dir: -1 };
        } else {
          delete state.columnSort[sectionKey];
        }
      } else {
        state.columnSort[sectionKey] = { column: col, dir: 1 };
      }
      renderAll();
    });
    headRow.appendChild(th);
  });
  headRow.appendChild(document.createElement('th'));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = columns.length + 1;
    td.className = 'vg-empty-note';
    td.textContent = 'No entries yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  rows.forEach(({ file, obj }) => {
    tbody.appendChild(renderRow(tab, genre, file, obj));
  });
  table.appendChild(tbody);
  return table;
}

function renderRow(tab, genre, file, obj) {
  const tr = document.createElement('tr');
  if (obj.__new) tr.className = 'vg-row-new';
  else if (obj.__dirty) tr.className = 'vg-row-dirty';
  const entry = state.files[file];

  getColumnsFor(tab, genre).forEach((col) => {
    const td = document.createElement('td');
    const multiKind = tab.multi[col];
    const isDescription = col.toLowerCase() === 'description';
    if (multiKind) {
      td.appendChild(renderMultiSelectCell(obj, col, multiKind, () => markDirty(tr, obj, entry, file), genre));
    } else if (isDescription) {
      const textarea = document.createElement('textarea');
      textarea.className = 'vg-cell-input vg-wide vg-description-input';
      textarea.rows = 4;
      textarea.value = obj[col] || '';
      textarea.addEventListener('input', () => { obj[col] = textarea.value; markDirty(tr, obj, entry, file); });
      td.appendChild(textarea);
    } else {
      const input = document.createElement('input');
      input.className = 'vg-cell-input' + (col === tab.nameField ? ' vg-wide' : '');
      if (['rof', 'range', 'slash_dmg', 'impact_dmg', 'pierce_dmg', 'enery_dmg', 'TL', 'min_tl', 'stamina cost',
        'physique', 'strength', 'constitution', 'dexterity', 'agility', 'mysticism', 'willpower',
        'move_modifier', 'race_pd_mult', 'race_md_mult', 'race_init_mod', 'weight(lbs)', 'cost(GT)', 'cost($)',
        'Cost($)', 'Class', 'Mag', 'dots',
        'weight', 'cost', 'staminaCost', 'impact', 'pierce', 'slash', 'energy', 'ballistic', 'material',
        'focus_melee_weapons', 'focus_ranged_weapons', 'combat_focus_bonus', 'magic_focus_bonus', 'miracle_focus_bonus', 'vitals_pd_mod', 'vitals_md_mod'].includes(col)) {
        input.className += ' vg-narrow';
      }
      input.value = obj[col] || '';
      input.addEventListener('input', () => { obj[col] = input.value; markDirty(tr, obj, entry, file); });
      td.appendChild(input);
    }
    tr.appendChild(td);
  });

  const actionTd = document.createElement('td');
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'vg-delete-btn';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => {
    const idx = entry.objects.indexOf(obj);
    if (idx !== -1) entry.objects.splice(idx, 1);
    entry.dirty = true;
    renderAll();
  });
  actionTd.appendChild(delBtn);
  tr.appendChild(actionTd);

  return tr;
}

// Updates a file's own "Save <file>" button label in place (its " ●"
// marker) without a full renderAll() — a plain cell edit doesn't re-render
// (that would blow away input focus mid-keystroke), so the marker needs a
// targeted DOM update instead.
function refreshSaveButtonMarker(file) {
  const btn = document.querySelector(`[data-save-file="${file}"]`);
  if (!btn) return;
  const isDirty = state.files[file] && state.files[file].dirty;
  btn.textContent = `Save ${file}` + (isDirty ? ' ●' : '');
}

// entry (state.files[file]) gets a file-level `dirty` flag alongside each
// row's own __new/__dirty — that's what "Save All" (see saveAll()) scans
// for to know which files actually need writing, instead of re-saving
// everything every time.
function markDirty(tr, obj, entry, file) {
  if (entry) entry.dirty = true;
  if (!obj.__new) {
    obj.__dirty = true;
    tr.className = 'vg-row-dirty';
  }
  if (file) refreshSaveButtonMarker(file);
}

function renderMultiSelectCell(obj, col, kind, onChange, genre) {
  const wrap = document.createElement('div');
  wrap.className = 'vg-multiselect';

  const options = kind === 'attribute' ? BASE_ATTRIBUTES
    : kind === 'class' ? getDynamicClassesForGenre(genre).sort()
    : getDynamicRacesForGenre(genre).sort();

  const select = document.createElement('select');
  select.multiple = true;
  select.size = Math.min(5, Math.max(3, options.length));
  const selected = new Set(splitMulti(obj[col]).map((v) => v.toLowerCase()));
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    if (selected.has(opt.toLowerCase())) o.selected = true;
    select.appendChild(o);
  });
  select.addEventListener('change', () => {
    const picked = [...select.selectedOptions].map((o) => o.value);
    obj[col] = joinMulti(picked);
    onChange();
  });
  wrap.appendChild(select);

  // Only race grows dynamically from here — attribute is a fixed 12-value
  // enum, and class now comes solely from the genre's own Expertise tab
  // (see getDynamicClassesForGenre()), so adding one means adding a row
  // there (where "+Add Expertise" already exists), not an ad-hoc value
  // from an unrelated tab that Expertise would never pick up.
  if (kind === 'race') {
    const addRow = document.createElement('div');
    addRow.className = 'vg-multiselect-add';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `New ${kind}…`;
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => {
      const val = titleCase(input.value);
      if (!val) return;
      addDynamicRace(genre, val);
      const current = splitMulti(obj[col]);
      if (!current.some((v) => v.toLowerCase() === val.toLowerCase())) current.push(val);
      obj[col] = joinMulti(current);
      input.value = '';
      onChange();
      renderAll();
    });
    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);
  }

  return wrap;
}

// =============================================================================
// Saving
// =============================================================================

// Bit-by-bit CRC-32 (no precomputed table — these files are small and this
// only runs on a "Save All" click, so the extra per-byte cost is a non-issue).
function crc32(bytes) {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

// Minimal hand-rolled ZIP writer (store method — no compression, just
// packaging) — kept dependency-free like every other file in this project,
// so "Save All" works offline over file:// same as everything else.
// `entries` is [{ name, text }]; names may include "/" to nest into
// folders. Returns a Blob the caller downloads.
function buildZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(({ name, text }) => {
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(text);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0, true); // flags
    local.setUint16(8, 0, true); // compression: store
    local.setUint16(10, 0, true); // mod time
    local.setUint16(12, 0x21, true); // mod date (1980-01-01 — ZIP epoch minimum)
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true); // compressed size
    local.setUint32(22, size, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra field length
    localParts.push(new Uint8Array(local.buffer), nameBytes, dataBytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true); // version needed
    central.setUint16(8, 0, true); // flags
    central.setUint16(10, 0, true); // compression
    central.setUint16(12, 0, true); // mod time
    central.setUint16(14, 0x21, true); // mod date
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true); // extra length
    central.setUint16(32, 0, true); // comment length
    central.setUint16(34, 0, true); // disk number start
    central.setUint16(36, 0, true); // internal attrs
    central.setUint32(38, 0, true); // external attrs
    central.setUint32(42, offset, true); // local header offset
    centralParts.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  });

  const centralDirOffset = offset;
  const centralDirSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true); // disk number
  end.setUint16(6, 0, true); // disk with central dir start
  end.setUint16(8, entries.length, true); // entries on this disk
  end.setUint16(10, entries.length, true); // total entries
  end.setUint32(12, centralDirSize, true);
  end.setUint32(16, centralDirOffset, true);
  end.setUint16(20, 0, true); // comment length

  return new Blob([...localParts, ...centralParts, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

function triggerZipDownload(filename, entries) {
  const blob = buildZipBlob(entries);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function triggerDownload(filename, text) {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Writes directly into the directory the VG granted via "Enable direct
// save to data/…" (writableDirHandle). Throws on any failure (handle
// missing/revoked, permission denied, browser doesn't actually honor the
// write despite exposing the API, etc.) — callers catch that and fall back
// to triggerDownload, so a direct-write failure never loses the save.
async function writeFileDirect(filename, text) {
  if (!writableDirHandle) throw new Error('no writable directory handle');
  const fileHandle = await writableDirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

// Writes a file via direct disk access if available, otherwise falls back
// to a browser download. Returns true if written directly, false if it
// fell back to a download.
async function writeFileOrDownload(filename, text) {
  if (writableDirHandle) {
    try {
      await writeFileDirect(filename, text);
      return true;
    } catch (err) {
      writableDirHandle = null; // stop retrying a handle that no longer works
      el.loadStatus.textContent = `Direct save stopped working (${err && err.message ? err.message : err}) — falling back to downloads. Click "Enable direct save to data/…" again to retry.`;
      el.loadStatus.className = 'vg-load-status vg-warn';
    }
  }
  triggerDownload(filename, text);
  return false;
}

// filename.csv -> filename.bak<n>.csv (or filename.bak<n> if there's no
// extension) — used for the 2 backup copies saveFile() writes/downloads below.
function backupFilename(filename, n) {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? `${filename}.bak${n}` : `${filename.slice(0, dot)}.bak${n}${filename.slice(dot)}`;
}

// Every Save writes (or, without direct-save enabled, downloads) up to 3
// files, in order: 2 backups of the file exactly as it was read from disk
// this session (entry.originalText — never the live in-memory edits, so
// the pre-session version survives any number of saves in one sitting),
// then the actual overwrite. With direct save enabled, all 3 land straight
// in the granted directory; otherwise move the 3 downloads into place by
// hand (backups into your backup directory, the last into data/). A
// brand-new file (no originalText — nothing on disk yet to back up) skips
// straight to the overwrite.
function csvTextForEntry(entry) {
  const header = entry.header;
  const cleanObjects = entry.objects.map((obj) => {
    const copy = {};
    header.forEach((key) => { copy[key] = obj[key] || ''; });
    return copy;
  });
  return objectsToCsv(header, cleanObjects, entry.mode);
}

async function saveFile(filename, mode) {
  const entry = ensureFileEntry(filename, mode);
  const text = csvTextForEntry(entry);

  if (entry.originalText != null) {
    await writeFileOrDownload(backupFilename(filename, 1), entry.originalText);
    await writeFileOrDownload(backupFilename(filename, 2), entry.originalText);
  }
  await writeFileOrDownload(filename, text);

  entry.objects.forEach((obj) => { delete obj.__new; delete obj.__dirty; });
  entry.dirty = false;
  renderAll();
}

function getDirtyFilenames() {
  return Object.keys(state.files).filter((fname) => state.files[fname].dirty);
}

// "Save All": writes (or downloads) every changed file across every genre
// and tab in one click, instead of hunting down each section's own Save
// button. With direct-save enabled it just loops saveFile()/
// saveTechLevels() — no reason to do anything fancier, each write already
// lands straight on disk. Without it, saving N dirty files individually
// would mean up to 3N separate downloads to sort by hand, so instead every
// changed file (plus its 2 backups) is bundled into one zip — see
// buildZipBlob() — with a data/ folder to drop into the project and a
// backups/ folder for the rest.
async function saveAll() {
  const dirtyFilenames = getDirtyFilenames();
  const techDirty = !!(techLevelsFile && techLevelsFile.dirty);
  const totalCount = dirtyFilenames.length + (techDirty ? 1 : 0);

  if (!totalCount) {
    el.loadStatus.textContent = 'Save All: nothing to save — no unsaved changes.';
    el.loadStatus.className = 'vg-load-status vg-ok';
    return;
  }

  if (writableDirHandle) {
    for (const fname of dirtyFilenames) {
      const entry = state.files[fname];
      await saveFile(fname, entry.mode);
    }
    if (techDirty) await saveTechLevels();
    el.loadStatus.textContent = `Save All: wrote ${totalCount} file(s) directly to "${writableDirHandle.name}".`;
    el.loadStatus.className = 'vg-load-status vg-ok';
    return;
  }

  const zipEntries = [];
  dirtyFilenames.forEach((fname) => {
    const entry = state.files[fname];
    const text = csvTextForEntry(entry);
    if (entry.originalText != null) {
      zipEntries.push({ name: `backups/${backupFilename(fname, 1)}`, text: entry.originalText });
      zipEntries.push({ name: `backups/${backupFilename(fname, 2)}`, text: entry.originalText });
    }
    zipEntries.push({ name: `data/${fname}`, text });
  });
  if (techDirty) {
    const text = techLevelsCsvText(techLevelsFile.rows);
    if (techLevelsFile.originalText != null) {
      zipEntries.push({ name: `backups/${backupFilename('tech_levels.csv', 1)}`, text: techLevelsFile.originalText });
      zipEntries.push({ name: `backups/${backupFilename('tech_levels.csv', 2)}`, text: techLevelsFile.originalText });
    }
    zipEntries.push({ name: 'data/tech_levels.csv', text });
  }

  triggerZipDownload('vg-tools-save-all.zip', zipEntries);

  dirtyFilenames.forEach((fname) => {
    const entry = state.files[fname];
    entry.objects.forEach((obj) => { delete obj.__new; delete obj.__dirty; });
    entry.dirty = false;
  });
  if (techDirty) techLevelsFile.dirty = false;
  updateSaveTechLevelsButton();

  el.loadStatus.textContent = `Save All: downloaded vg-tools-save-all.zip with ${totalCount} changed file(s) (plus backups) — unzip it, then copy its data/ contents into your project's data/ folder, and backups/ into your backup directory.`;
  el.loadStatus.className = 'vg-load-status vg-ok';
  renderAll();
}

el.vgSaveAllBtn.addEventListener('click', saveAll);

// =============================================================================
// Publishing (vg-tools as the source of authority for the character builder)
// =============================================================================

// A complete, self-contained snapshot of everything vg-tools currently
// knows — every loaded file's CURRENT text (not just dirty ones; a publish
// has to stand on its own), tech_levels.csv, and the current genre list (so
// a genre created this session, or rediscovered from disk, reaches the
// character builder with no code change there — see applyGameSet() in
// src/data.js, the consumer side of this). Deliberately independent of
// Save/Save All: publishing is "this is now what players load," not "I
// saved my work" — a VG can save without publishing (not ready for players
// yet) or publish without having saved every CSV to disk yet.
function buildGameSet() {
  const files = {};
  allFilenames().forEach((fname) => {
    const entry = state.files[fname];
    if (entry) files[fname] = csvTextForEntry(entry);
  });
  return {
    publishedAt: new Date().toISOString(),
    knownGenres: [...knownGenres],
    files,
    techLevels: techLevelsFile ? techLevelsCsvText(techLevelsFile.rows) : null,
  };
}

async function publishGameSet() {
  if (!state.loaded) {
    el.loadStatus.textContent = 'Publish Game Set: load the data/ folder first.';
    el.loadStatus.className = 'vg-load-status vg-warn';
    return;
  }
  const gameSet = buildGameSet();
  const text = JSON.stringify(gameSet, null, 2);
  const wroteDirect = await writeFileOrDownload('gameset.json', text);
  const fileCount = Object.keys(gameSet.files).length;
  el.loadStatus.textContent = wroteDirect
    ? `Publish Game Set: wrote gameset.json (${fileCount} files, ${gameSet.knownGenres.length} genres) directly to "${writableDirHandle.name}". Character builders loading over http(s) now see this.`
    : `Publish Game Set: downloaded gameset.json (${fileCount} files, ${gameSet.knownGenres.length} genres) — move it into data/ so the character builder can fetch it.`;
  el.loadStatus.className = 'vg-load-status vg-ok';
}

el.vgPublishBtn.addEventListener('click', publishGameSet);

// =============================================================================
// Init
// =============================================================================

renderAll();

})();
