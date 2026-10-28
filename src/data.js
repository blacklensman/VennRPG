// Character data schema and game-rule definitions for the VennRPG character sheet.
// Plain classic script (no ES modules) so the sheet also works when opened
// directly via file:// without a local server. Everything is attached to the
// shared window.VennRPG namespace for src/app.js to consume.
(function () {

const ATTRIBUTES = [
  'Physique', 'Strength', 'Constitution', 'Agility', 'Dexterity', 'Intellect',
  'Intuition', 'Mysticism', 'Bravery', 'Willpower', 'Charisma', 'Attraction',
];

const ATTRIBUTE_MIN = 2;
const ATTRIBUTE_MAX = 20;

const CLASSES = ['Martial', 'Covert', 'Adept', 'Shepherd'];

const CLASS_DOTS_MIN = 0;
const CLASS_DOTS_ROWS = 2;
const CLASS_DOTS_PER_ROW = 20;
const CLASS_DOTS_MAX = CLASS_DOTS_ROWS * CLASS_DOTS_PER_ROW;

// The math rule from data/ui.txt: every derived/computed number is rounded up.
function roundUp(value) {
  return Math.ceil(value);
}

// Delimiter for multi-value CSV columns (a skill's/weapon's Focus or Race
// list) since a comma is already the CSV field separator.
const MULTI_VALUE_DELIMITER = ';';

function parseMultiValue(raw) {
  if (!raw) return [];
  return raw.split(MULTI_VALUE_DELIMITER).map((s) => s.trim()).filter(Boolean);
}

function capitalizeToken(s) {
  return s.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Expertise (data/{genre}_expertise.csv) — every value an Expertise
// (Martial/Covert/Adept/Shepherd) controls, in one place, genre-specific
// like Skills/Equipment/Armor/Race. parseCsvWithHeader is defined later in
// this file but hoisted (function declaration), so it's safely callable up
// here. getExpertiseEntry(genre, focus) is the one lookup every derived
// stat below uses instead of its own flat per-class object, so editing a
// genre's expertise.csv is the only place those values need to change.
// ---------------------------------------------------------------------------

function parseExpertiseCsv(csv) {
  return parseCsvWithHeader(csv).map((r) => ({
    name: r.name,
    defyAttributes: parseMultiValue(r.defy_attributes).map(capitalizeToken),
    focusMeleeWeapons: Number(r.focus_melee_weapons) || 0,
    focusRangedWeapons: Number(r.focus_ranged_weapons) || 0,
    combatFocusBonus: Number(r.combat_focus_bonus) || 0,
    magicFocusBonus: Number(r.magic_focus_bonus) || 0,
    miracleFocusBonus: Number(r.miracle_focus_bonus) || 0,
    vitalsPdMod: Number(r.vitals_pd_mod) || 0,
    vitalsMdMod: Number(r.vitals_md_mod) || 0,
  }));
}

const FANTASY_EXPERTISE_CSV = `name,defy_attributes,focus_melee_weapons,focus_ranged_weapons,combat_focus_bonus,magic_focus_bonus,miracle_focus_bonus,vitals_pd_mod,vitals_md_mod
Martial,Physique;Strength;Constitution;Bravery,3,2,25,0,0,1,0.7
Covert,Agility;Dexterity;Charisma;Intuition,2,1,15,5,0,0.8,0.9
Adept,Mysticism;Intellect;Intuition;Willpower,1,1,10,15,5,0.7,1.1
Shepherd,Willpower;Mysticism;Constitution;Charisma,2,1,20,5,15,0.9,0.9`;

// Every non-Fantasy genre starts as an identical copy of Fantasy's table —
// a starting point to customize per genre, same as Equipment/Armor.
const MODERN_EXPERTISE_CSV = FANTASY_EXPERTISE_CSV;
const DYSTOPIAN_EXPERTISE_CSV = FANTASY_EXPERTISE_CSV;
const SCIFI_EXPERTISE_CSV = FANTASY_EXPERTISE_CSV;
const APOCALYPTIC_EXPERTISE_CSV = FANTASY_EXPERTISE_CSV;
// Morrow Project has since diverged from the Fantasy copy (renamed its 4
// classes to Soldier/Scout/Science/Contact via vg-tools) — this embedded
// fallback is synced to match data/morrow_project_expertise.csv as of this
// edit; publishing a Game Set from vg-tools is what keeps this from going
// stale again without a manual resync like this one.
const MORROW_PROJECT_EXPERTISE_CSV = `name,defy_attributes,focus_melee_weapons,focus_ranged_weapons,combat_focus_bonus,magic_focus_bonus,miracle_focus_bonus,vitals_pd_mod,vitals_md_mod
Soldier,Strength;Constitution;Agility;Bravery,3,3,25,0,0,1.2,0.8
Scout,Agility;Dexterity;Intuition;Bravery;Charisma,2,1,20,5,0,1.4,1
Science,Dexterity;Intellect;Intuition;Bravery;Willpower,1,1,15,0,5,0.8,1.4
Contact,Constitution;Intellect;Intuition;Bravery;Charisma,2,1,15,0,0,1,1`;

const FANTASY_EXPERTISE = parseExpertiseCsv(FANTASY_EXPERTISE_CSV);
const MODERN_EXPERTISE = parseExpertiseCsv(MODERN_EXPERTISE_CSV);
const DYSTOPIAN_EXPERTISE = parseExpertiseCsv(DYSTOPIAN_EXPERTISE_CSV);
const SCIFI_EXPERTISE = parseExpertiseCsv(SCIFI_EXPERTISE_CSV);
const APOCALYPTIC_EXPERTISE = parseExpertiseCsv(APOCALYPTIC_EXPERTISE_CSV);
const MORROW_PROJECT_EXPERTISE = parseExpertiseCsv(MORROW_PROJECT_EXPERTISE_CSV);

const GENRE_EXPERTISE = {
  Fantasy: FANTASY_EXPERTISE,
  Modern: MODERN_EXPERTISE,
  Dystopian: DYSTOPIAN_EXPERTISE,
  SciFi: SCIFI_EXPERTISE,
  Apocalyptic: APOCALYPTIC_EXPERTISE,
  'morrow_project': MORROW_PROJECT_EXPERTISE,
};

function getActiveExpertise(genre) {
  return GENRE_EXPERTISE[genre] || FANTASY_EXPERTISE;
}

// The Focus/Class names a genre actually offers — e.g. Morrow Project's own
// Expertise can rename the standard 4 (Martial/Covert/Adept/Shepherd) to
// whatever it wants (Soldier/Scout/Science/Contact, say). CLASSES is only
// the fallback for a genre with no Expertise data at all.
function getActiveClasses(genre) {
  const names = getActiveExpertise(genre).map((e) => e.name);
  return names.length ? names : CLASSES;
}

function getExpertiseEntry(genre, focus) {
  return getActiveExpertise(genre).find((e) => e.name === focus)
    || FANTASY_EXPERTISE.find((e) => e.name === focus)
    || { defyAttributes: [], focusMeleeWeapons: 0, focusRangedWeapons: 0, combatFocusBonus: 0, magicFocusBonus: 0, miracleFocusBonus: 0, vitalsPdMod: 0, vitalsMdMod: 0 };
}

// Defy = attribute value * a per-attribute rate: 4% for an attribute that's
// key to the character's Focus class (in their current genre), 2% for
// every other attribute.
const DEFY_HIGH_PERCENT = 4;
const DEFY_LOW_PERCENT = 2;

function getDefyPercent(character, attribute) {
  const keyAttrs = getExpertiseEntry(character.genre, character.focus).defyAttributes;
  return keyAttrs.includes(attribute) ? DEFY_HIGH_PERCENT : DEFY_LOW_PERCENT;
}

function getDefyValue(character, attribute, attributeValue) {
  const percent = getDefyPercent(character, attribute);
  return roundUp(attributeValue * percent);
}

// ---------------------------------------------------------------------------
// Races (data/{genre}_race.csv). Race grants flat attribute modifiers, a
// movement modifier, a bonus weapon, and multipliers/mods plugged into the
// Vitals formulas below. Modifiers are applied live on top of the
// character's base (rolled) attribute values so switching race never
// mutates stored data. Each genre has its own race file — Fantasy has the
// full race list, every other genre currently has Human only — selected via
// getRaceNamesForGenre(). Race names are unique across genres (Human's stats
// are identical everywhere), so a single flat RACES map still works for
// stat lookups regardless of which genre a character is in.
// ---------------------------------------------------------------------------

const RACE_ATTRIBUTE_COLUMNS = {
  Physique: 'physique',
  Strength: 'strength',
  Constitution: 'constitution',
  Dexterity: 'dexterity',
  Agility: 'agility',
  Mysticism: 'mysticism',
  Willpower: 'willpower',
};

const RACE_CSV_HEADER = 'name,physique,strength,constitution,dexterity,agility,mysticism,willpower,bonus melee weapons,bonus ranged weapons,move_modifier,race_pd_mult,race_md_mult,race_init_mod';

function parseRaceCsv(csv) {
  const lines = csv.trim().split('\n');
  const header = lines[0].split(',').map((s) => s.trim());
  const races = {};
  lines.slice(1).forEach((line) => {
    if (!line.trim()) return;
    const fields = line.split(',').map((s) => s.trim());
    const row = {};
    header.forEach((col, i) => { row[col] = fields[i]; });
    races[capitalizeToken(row.name)] = {
      mods: {
        physique: Number(row.physique) || 0,
        strength: Number(row.strength) || 0,
        constitution: Number(row.constitution) || 0,
        dexterity: Number(row.dexterity) || 0,
        agility: Number(row.agility) || 0,
        mysticism: Number(row.mysticism) || 0,
        willpower: Number(row.willpower) || 0,
      },
      bonusMeleeWeapon: row['bonus melee weapons'] || '',
      bonusRangedWeapon: row['bonus ranged weapons'] || '',
      moveModifier: Number(row.move_modifier) || 0,
      race_pd_mult: Number(row.race_pd_mult) || 0,
      race_md_mult: Number(row.race_md_mult) || 0,
      race_init_mod: Number(row.race_init_mod) || 0,
    };
  });
  return races;
}

const FANTASY_RACE_CSV = `${RACE_CSV_HEADER}
Dwarf,1,1,1,0,0,0,1,Warhammer,Light Crossbow,-10,.2,.1,0
Elf,0,0,0,1,1,1,0,Sword Willow-leaf, Longbow,0,-.2,.2,0
Halfling,-1,-1,2,2,0,0,2,Knife,Knife Thrown,-15,-.1,.2,5
Human,1,1,0,0,0,1,1,Dagger,Dagger Thrown,0,0,0,0`;

// Every non-Fantasy genre currently has Human only (same stats as Fantasy's
// Human row) — see data/{genre}_race.csv.
const MODERN_RACE_CSV = `${RACE_CSV_HEADER}
Human,1,1,0,0,0,1,1,Dagger,Dagger Thrown,0,0,0,0`;
const DYSTOPIAN_RACE_CSV = `${RACE_CSV_HEADER}
Human,1,1,0,0,0,1,1,Dagger,Dagger Thrown,0,0,0,0`;
const SCIFI_RACE_CSV = `${RACE_CSV_HEADER}
Human,1,1,0,0,0,1,1,Dagger,Dagger Thrown,0,0,0,0`;
const APOCALYPTIC_RACE_CSV = `${RACE_CSV_HEADER}
Human,1,1,0,0,0,1,1,Dagger,Dagger Thrown,0,0,0,0`;
const MORROW_PROJECT_RACE_CSV = MODERN_RACE_CSV;

const FANTASY_RACES = parseRaceCsv(FANTASY_RACE_CSV);
const MODERN_RACES = parseRaceCsv(MODERN_RACE_CSV);
const DYSTOPIAN_RACES = parseRaceCsv(DYSTOPIAN_RACE_CSV);
const SCIFI_RACES = parseRaceCsv(SCIFI_RACE_CSV);
const APOCALYPTIC_RACES = parseRaceCsv(APOCALYPTIC_RACE_CSV);
const MORROW_PROJECT_RACES = parseRaceCsv(MORROW_PROJECT_RACE_CSV);

const RACES_BY_GENRE = {
  Fantasy: FANTASY_RACES,
  Modern: MODERN_RACES,
  Dystopian: DYSTOPIAN_RACES,
  SciFi: SCIFI_RACES,
  Apocalyptic: APOCALYPTIC_RACES,
  'morrow_project': MORROW_PROJECT_RACES,
};

const RACES = Object.assign({}, FANTASY_RACES, MODERN_RACES, DYSTOPIAN_RACES, SCIFI_RACES, APOCALYPTIC_RACES, MORROW_PROJECT_RACES);
const RACE_NAMES = Object.keys(RACES);

function getRaceNamesForGenre(genre) {
  return Object.keys(RACES_BY_GENRE[genre] || FANTASY_RACES);
}

function getRaceAttributeMod(raceName, attribute) {
  const race = RACES[raceName];
  const column = RACE_ATTRIBUTE_COLUMNS[attribute];
  if (!race || !column) return 0;
  return race.mods[column] || 0;
}

// The live, race-adjusted value of an attribute. All formulas below read
// attributes through this helper rather than character.attributes directly.
function getEffectiveAttribute(character, attribute) {
  return character.attributes[attribute] + getRaceAttributeMod(character.race, attribute);
}

// Resolves one entry from a skill's/weapon's Attribute list. Most entries
// name a base Attribute, but "Magic Casting" or "Miracle Casting" (case-
// insensitive) instead use that calculated combat stat's value.
function resolveAttributeValue(character, attribute) {
  const normalized = (attribute || '').trim().toLowerCase();
  if (normalized === 'magic casting') return getMagicCasting(character);
  if (normalized === 'miracle casting') return getMiracleCasting(character);
  return getEffectiveAttribute(character, attribute);
}

// A skill or weapon may list several attributes (MULTI_VALUE_DELIMITER-
// separated in the CSV); the value used in formulas is their average,
// counting duplicates (e.g. "Strength;Strength;Agility" weighs Strength 2x).
function getAverageEffectiveAttribute(character, attributes) {
  if (!attributes || attributes.length === 0) return 0;
  const sum = attributes.reduce((total, attr) => total + resolveAttributeValue(character, attr), 0);
  return sum / attributes.length;
}

function normalizeWeaponName(name) {
  return (name || '').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Shared point-buy ledger. Both Skills and Weapon skills spend from the same
// per-class pool (1 point per class dot), tracked as ledger[itemKey][cls].
// A ledger is character.skillSpend (flat, keyed by skill name) or
// character.weaponSpend.melee / .ranged (keyed by weapon name).
// ---------------------------------------------------------------------------

function getLedgerClassSpend(ledger, itemKey, cls) {
  const byItem = ledger[itemKey];
  return (byItem && byItem[cls]) || 0;
}

function setLedgerClassSpend(ledger, itemKey, cls, value) {
  if (!ledger[itemKey]) ledger[itemKey] = {};
  ledger[itemKey][cls] = Math.max(0, value);
}

// Sums every class's spend on this item, whichever class names actually
// have ledger entries — not just the fixed CLASSES list, since a genre can
// rename its classes (see getActiveClasses()) and a switch never deletes an
// old class's existing spend.
function getLedgerSpentRank(ledger, itemKey) {
  const byItem = ledger[itemKey];
  if (!byItem) return 0;
  return Object.values(byItem).reduce((sum, v) => sum + (v || 0), 0);
}

// Click-to-set-rank for one item, spent from a specific class's pool. Mirrors
// the class-dot jump/step-down click pattern, but every increase is capped by
// that class's available points and every decrease only refunds what that
// class itself contributed (can't refund another class's spend).
function setLedgerRankForClass(ledger, itemKey, cls, targetRank, available) {
  const spentTotal = getLedgerSpentRank(ledger, itemKey);
  const ownSpend = getLedgerClassSpend(ledger, itemKey, cls);
  if (targetRank > spentTotal) {
    const cost = Math.min(targetRank - spentTotal, available);
    if (cost <= 0) return;
    setLedgerClassSpend(ledger, itemKey, cls, ownSpend + cost);
  } else if (targetRank < spentTotal) {
    const refund = Math.min(spentTotal - targetRank, ownSpend);
    if (refund <= 0) return;
    setLedgerClassSpend(ledger, itemKey, cls, ownSpend - refund);
  }
}

// ---------------------------------------------------------------------------
// Weapons (data/melee_weapons.csv, data/ranged_weapons.csv). Each weapon is a
// skill bought with ranks (0-20, 2 rows of 10) from the shared class point
// pool below. `focus` is a list of Classes, MULTI_VALUE_DELIMITER-separated
// in the CSV; empty by default until populated with real weapon/class ties.
// ---------------------------------------------------------------------------

// Independent of CLASS_DOTS_* on purpose — weapon ranks keep their own 2
// rows of 10 (0-20) even though Expertise/Class dots expanded to 2 rows of
// 20 (0-40); they used to share the same constants only because the
// numbers happened to match.
const WEAPON_RANKS_MIN = 0;
const WEAPON_RANKS_MAX = 20;
const WEAPON_RANKS_ROWS = 2;
const WEAPON_RANKS_PER_ROW = 10;

const WEAPON_BASE_RATE = 3;
const WEAPON_BONUS_RATE = 6;

const MELEE_WEAPONS_CSV = `Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
Unarmed,fist,,3,0,1,0,0,3,martial;covert;shepherd;adept,human;halfling;dwarf;elf
BrassKnuckles,fist,,3,0,3,0,0,3,martial;covert,
Dagger,fist,,2,0,4,0,0,3,martial;covert;shepherd;adept,human;halfling;dwarf;elf
Knife,fist,,3,0,2,0,0,3,martial;covert;shepherd;adept,human;halfling;dwarf;elf
Sword Stabbing,1-hand,,1,0,0,8,0,3,martial;covert,
Sword Arming,1-hand,,1,2,6,8,0,3,martial;covert,
Sword Long,1-hand,,1,4,4,8,0,3,martial;covert;shepherd,
Sword Willow-leaf,1-hand,,1,4,4,8,0,3,martial;covert,Elf
Sword Broad,1-hand,,1,6,6,10,0,3,martial;shepherd,
Sword Great,2-hand,,1,8,8,16,0,3,martial,
Sword Foil,1-hand,,2,0,0,4,0,3,martial;covert;shepherd,
Sword Sabre,1-hand,,2,4,0,6,0,3,martial;covert;shepherd,
Sword Katana,1-hand,,2,8,0,8,0,3,martial;shepherd,
Hammer,1-hand,,1,0,4,0,0,3,martial;shepherd,Dwarf
WarHammer,2-hand,,1,0,8,0,0,3,martial,Dwarf
SpikeHammer,1-hand,,1,0,4,4,0,3,martial;shepherd,
Nordic/Norman Axe,1-hand,,2,6,6,0,0,3,martial;shepherd,
WarAxe,2-hand,,1,10,10,0,0,3,martial,Dwarf
Mace,1-hand,,2,0,6,0,0,3,martial;covert;shepherd,
Morning Star,1-hand,,2,0,8,2,0,3,martial;shepherd,
Flail,1-hand,,1,0,8,4,0,3,martial;shepherd,
Spear Short,1-hand,,2,0,0,8,0,3,martial;shepherd,
Lance(charge),2-hand,,1,0,0,16,0,3,martial;shepherd,
Pike,2-hand,,1,0,0,10,0,3,martial;covert,
Lance,2-hand,,1,0,0,8,0,3,martial;shepherd,
Halberd,2-hand,,1,0,0,10,0,3,martial;shepherd,
Quarterstaff,2-hand,,2,0,6,0,0,3,martial;covert;shepherd;adept,
Club,1-hand,,2,0,0,6,0,3,martial;covert;shepherd,
Cudgel,1-hand,,2,0,0,4,0,3,martial;covert;shepherd;adept,
Improvised,1-hand,,2,0,0,4,0,3,martial;covert;shepherd;adept,
Shortsword,1-hand,,0,0,0,0,0,3,,
Hand axe,1-hand,,0,0,0,0,0,3,,
Battleaxe,2-hand,,0,0,0,0,0,3,,
Greataxe,2-hand,,0,0,0,0,0,3,,
Maul,2-hand,,0,0,0,0,0,3,,
Rapier,1-hand,,0,0,0,0,0,3,,
Scimitar,1-hand,,0,0,0,0,0,3,,
Whip,1-hand,,0,0,0,0,0,3,,
Man-catcher,2-hand,,0,0,0,0,0,3,,
Fighting Net,2-hand,,0,0,0,0,0,3,,
Caltrops (bag),thrown,,0,0,0,0,0,3,,`;

const RANGED_WEAPONS_CSV = `name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race
Blowgun,1,10,Agility,0,0,1,0,3,martial;covert,
Sling,1,30,Dexterity,0,3,0,0,3,martial;covert;shepherd,halfling
Sling Staff,1,60,Agility,0,6,0,0,3,martial;shepherd;adept,
Short Bow,1,100,Dexterity,0,0,6,0,3,martial;covert,
Composite Bow,1,100,Dexterity,0,0,8,0,3,martial;covert,
Longbow,1,120,Dexterity,0,0,8,0,3,martial,elf
Light Crossbow,1,60,Dexterity,0,0,5,0,3,martial;covert;shepherd,
Heavy Crossbow,1,90,Dexterity,0,0,10,0,3,martial,dwarf
Javelin thrown,1,30,Agility,0,0,5,0,3,martial;covert,
Axe Thrown,1,10,Dexterity,5,3,0,0,3,martial;covert,
Dagger Thrown,2,10,Dexterity,2,0,4,0,3,martial;covert,human;halfling;dwarf;elf
Club Thrown,1,10,Dexterity,0,4,0,0,3,martial;covert;shepherd,human;halfling;dwarf
Rock Thrown,1,20,Dexterity,0,1,0,0,3,martial;covert;shepherd;adept,human;halfling;dwarf;elf
Hand crossbow,0,0,,0,0,0,0,3,,
Arrows (20),0,0,,0,0,0,0,3,,
Quarrels (20),0,0,,0,0,0,0,3,,
Sling bullets (20),0,0,,0,0,0,0,3,,
Darts (20),0,0,,0,0,0,0,3,,`;

function parseMeleeWeaponsCsv(csv) {
  return csv.trim().split('\n').slice(1).filter(Boolean).map((line) => {
    const [name, size, attribute, rof, slashRaw, impactRaw, pierceRaw, energyRaw, tlRaw, focusRaw, raceRaw] = line.split(',');
    return {
      name: (name || '').trim(),
      size: (size || '').trim(),
      attribute: parseMultiValue(attribute).map(capitalizeToken),
      rof: Number(rof) || 0,
      slash: Number(slashRaw) || 0,
      impact: Number(impactRaw) || 0,
      pierce: Number(pierceRaw) || 0,
      energy: Number(energyRaw) || 0,
      tl: Number(tlRaw) || 0,
      focus: parseMultiValue(focusRaw).map(capitalizeToken),
      race: parseMultiValue(raceRaw).map(capitalizeToken),
    };
  });
}

function parseRangedWeaponsCsv(csv) {
  return csv.trim().split('\n').slice(1).filter(Boolean).map((line) => {
    const [name, rof, range, attribute, slashRaw, impactRaw, pierceRaw, energyRaw, tlRaw, focusRaw, raceRaw] = line.split(',');
    return {
      name: (name || '').trim(),
      rof: Number(rof) || 0,
      range: Number(range) || 0,
      attribute: parseMultiValue(attribute).map(capitalizeToken),
      slash: Number(slashRaw) || 0,
      impact: Number(impactRaw) || 0,
      pierce: Number(pierceRaw) || 0,
      energy: Number(energyRaw) || 0,
      tl: Number(tlRaw) || 0,
      focus: parseMultiValue(focusRaw).map(capitalizeToken),
      race: parseMultiValue(raceRaw).map(capitalizeToken),
    };
  });
}

const MELEE_WEAPONS = parseMeleeWeaponsCsv(MELEE_WEAPONS_CSV);
const RANGED_WEAPONS = parseRangedWeaponsCsv(RANGED_WEAPONS_CSV);

// Genre weapon scaffolds (data/{genre}_melee.csv, data/{genre}_ranged.csv) —
// empty for now, same column shape as MELEE_WEAPONS_CSV/RANGED_WEAPONS_CSV
// (TL column included). Populate later via the Grok prompts in prompts/.
const MODERN_MELEE_CSV = `Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;
const DYSTOPIAN_MELEE_CSV = `Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;
const SCIFI_MELEE_CSV = `Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;
const APOCALYPTIC_MELEE_CSV = `Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;

const MODERN_RANGED_CSV = `name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;
const DYSTOPIAN_RANGED_CSV = `name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;
const SCIFI_RANGED_CSV = `name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;
const APOCALYPTIC_RANGED_CSV = `name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,TL,focus,race`;

const MODERN_MELEE = parseMeleeWeaponsCsv(MODERN_MELEE_CSV);
const DYSTOPIAN_MELEE = parseMeleeWeaponsCsv(DYSTOPIAN_MELEE_CSV);
const SCIFI_MELEE = parseMeleeWeaponsCsv(SCIFI_MELEE_CSV);
const APOCALYPTIC_MELEE = parseMeleeWeaponsCsv(APOCALYPTIC_MELEE_CSV);

const MODERN_RANGED = parseRangedWeaponsCsv(MODERN_RANGED_CSV);
const DYSTOPIAN_RANGED = parseRangedWeaponsCsv(DYSTOPIAN_RANGED_CSV);
const SCIFI_RANGED = parseRangedWeaponsCsv(SCIFI_RANGED_CSV);
const APOCALYPTIC_RANGED = parseRangedWeaponsCsv(APOCALYPTIC_RANGED_CSV);

// Morrow Project's own melee/ranged files (vg-tools-edited) are currently
// just a copy of Fantasy's weapon list with minor race-tag trims, so it
// contributes no new weapons beyond the shared baseline — same as Fantasy
// itself.
const GENRE_MELEE_WEAPONS = {
  Fantasy: [], Modern: MODERN_MELEE, Dystopian: DYSTOPIAN_MELEE, SciFi: SCIFI_MELEE, Apocalyptic: APOCALYPTIC_MELEE,
  'morrow_project': [],
};
const GENRE_RANGED_WEAPONS = {
  Fantasy: [], Modern: MODERN_RANGED, Dystopian: DYSTOPIAN_RANGED, SciFi: SCIFI_RANGED, Apocalyptic: APOCALYPTIC_RANGED,
  'morrow_project': [],
};

// Mirrors getActiveSkills(): baseline MELEE_WEAPONS/RANGED_WEAPONS plus
// whatever the active genre's own scaffold contributes (empty until
// populated). Fantasy contributes nothing extra here since its weapons
// already live in the baseline melee_weapons.csv/ranged_weapons.csv.
function getActiveMeleeWeapons(genre) {
  return MELEE_WEAPONS.concat(GENRE_MELEE_WEAPONS[genre] || []);
}
function getActiveRangedWeapons(genre) {
  return RANGED_WEAPONS.concat(GENRE_RANGED_WEAPONS[genre] || []);
}

// Every weapon across every genre — same rationale as ALL_SKILLS, used only
// to pre-seed a fresh character's weaponSpend ledger.
const ALL_MELEE_WEAPONS = MELEE_WEAPONS.concat(MODERN_MELEE, DYSTOPIAN_MELEE, SCIFI_MELEE, APOCALYPTIC_MELEE);
const ALL_RANGED_WEAPONS = RANGED_WEAPONS.concat(MODERN_RANGED, DYSTOPIAN_RANGED, SCIFI_RANGED, APOCALYPTIC_RANGED);

function getWeaponList(genre, category) {
  return category === 'melee' ? getActiveMeleeWeapons(genre) : getActiveRangedWeapons(genre);
}

function getWeapon(genre, category, weaponName) {
  return getWeaponList(genre, category).find((w) => w.name === weaponName);
}

// Race's bonus weapon name (data/race.csv) is hand-maintained separately
// from the weapon CSVs and can drift in casing (e.g. "Warhammer" vs the
// weapon list's "WarHammer"), so this look-up is case-insensitive.
function findWeaponByNameLoose(genre, category, weaponName) {
  return getWeaponList(genre, category).find((w) => normalizeWeaponName(w.name) === normalizeWeaponName(weaponName));
}

// True if the character's race bonus weapon (data/race.csv) is this weapon.
function weaponMatchesRace(character, category, weaponName) {
  const race = RACES[character.race];
  if (!race) return false;
  const bonus = category === 'melee' ? race.bonusMeleeWeapon : race.bonusRangedWeapon;
  return normalizeWeaponName(bonus) === normalizeWeaponName(weaponName);
}

// How many starting weapons each Focus randomly draws from its eligible
// (focus-matching) weapon pool when that Focus is chosen.
function getFocusWeaponCapacity(genre, focus, category) {
  const entry = getExpertiseEntry(genre, focus);
  return category === 'melee' ? entry.focusMeleeWeapons : entry.focusRangedWeapons;
}

function isWeaponFocusEligible(weapon, focus) {
  return weapon.focus.includes(focus);
}

function pickRandomNames(names, count) {
  const pool = names.slice();
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

// Randomly draws this Focus's starting weapons from the weapons whose Focus
// column includes it. If the race has a bonus weapon in this category and
// it exists, it always takes one of the slots; the rest are random. Called
// whenever a character's Focus is (re-)chosen.
function rollFocusWeaponsForCategory(genre, category, focus, race) {
  const count = getFocusWeaponCapacity(genre, focus, category);
  if (count <= 0) return [];

  const raceInfo = RACES[race];
  const raceBonusName = raceInfo && (category === 'melee' ? raceInfo.bonusMeleeWeapon : raceInfo.bonusRangedWeapon);
  const raceBonusWeapon = raceBonusName && findWeaponByNameLoose(genre, category, raceBonusName);
  const picks = [];
  if (raceBonusWeapon) {
    picks.push(raceBonusWeapon.name);
  }

  const eligible = getWeaponList(genre, category).filter((w) => isWeaponFocusEligible(w, focus)).map((w) => w.name);
  const remainingPool = eligible.filter((name) => !picks.includes(name));
  picks.push(...pickRandomNames(remainingPool, Math.max(0, count - picks.length)));
  return picks.slice(0, count);
}

function rollFocusWeapons(genre, focus, race) {
  return {
    melee: rollFocusWeaponsForCategory(genre, 'melee', focus, race),
    ranged: rollFocusWeaponsForCategory(genre, 'ranged', focus, race),
  };
}

function addFocusWeapon(character, category, weaponName) {
  const list = character.focusWeapons[category];
  if (!list.includes(weaponName)) list.push(weaponName);
}

function removeFocusWeapon(character, category, weaponName) {
  const list = character.focusWeapons[category];
  const idx = list.indexOf(weaponName);
  if (idx !== -1) list.splice(idx, 1);
}

// True if this weapon is one of the character's drawn Focus starting weapons
// (which is how a race's bonus weapon takes effect too — see
// rollFocusWeaponsForCategory — so no separate race check is needed here).
function weaponMatchesCharacter(character, category, weaponName) {
  const drawn = character.focusWeapons && character.focusWeapons[category];
  return !!drawn && drawn.includes(weaponName);
}

// A weapon with no Focus listed is open to every class's point pool, and a
// weapon matching the character's race bonus is spendable from every tab too.
function isWeaponEligibleForClass(character, category, weaponName, cls) {
  const weapon = getWeapon(character.genre, category, weaponName);
  if (!weapon) return false;
  return weapon.focus.length === 0 || weapon.focus.includes(cls) || weaponMatchesRace(character, category, weaponName);
}

function getWeaponRate(character, category, weaponName) {
  return weaponMatchesCharacter(character, category, weaponName) ? WEAPON_BONUS_RATE : WEAPON_BASE_RATE;
}

// A weapon's first rank is auto-granted (and locked) when Focus or race matches.
function getWeaponAutoMinRank(character, category, weaponName) {
  return weaponMatchesCharacter(character, category, weaponName) ? 1 : 0;
}

function getWeaponClassSpend(character, category, weaponName, cls) {
  return getLedgerClassSpend(character.weaponSpend[category], weaponName, cls);
}

function getWeaponSpentRank(character, category, weaponName) {
  return getLedgerSpentRank(character.weaponSpend[category], weaponName);
}

// Additive, not max: the free auto-min rank sits "under" whatever's been
// paid for, so every paid rank (ledger step) always adds exactly 1 to the
// effective rank — see setWeaponRankForClass below, which converts a target
// effective rank into ledger terms by subtracting this same autoMin.
function getWeaponEffectiveRank(character, category, weaponName) {
  return Math.min(WEAPON_RANKS_MAX, getWeaponSpentRank(character, category, weaponName) + getWeaponAutoMinRank(character, category, weaponName));
}

function getWeaponTarget(character, category, weaponName) {
  const base = category === 'melee' ? getMeleeBaseAttack(character) : getRangedBaseAttack(character);
  const rank = getWeaponEffectiveRank(character, category, weaponName);
  return roundUp(base + rank * getWeaponRate(character, category, weaponName));
}

// targetRank is a target EFFECTIVE rank (what the dot grid shows); the
// ledger only needs to cover the portion above the free auto-min rank, so
// every dot — including the first paid one right after a free rank — costs
// exactly 1 point.
function setWeaponRankForClass(character, category, weaponName, cls, targetRank) {
  const autoMin = getWeaponAutoMinRank(character, category, weaponName);
  const ledgerTarget = Math.max(0, targetRank - autoMin);
  setLedgerRankForClass(character.weaponSpend[category], weaponName, cls, ledgerTarget, getClassWeaponPointsAvailable(character, cls));
}

function toggleWeaponRankForClass(character, category, weaponName, cls, dotIndex) {
  const effective = getWeaponEffectiveRank(character, category, weaponName);
  const targetRank = effective === dotIndex ? dotIndex - 1 : dotIndex;
  setWeaponRankForClass(character, category, weaponName, cls, clamp(targetRank, WEAPON_RANKS_MIN, WEAPON_RANKS_MAX));
}

// ---------------------------------------------------------------------------
// Skills (data/skills.csv). Each skill has a Name, Description, an Attribute
// it's rolled against, and a list of Classes ("focus") and Races ("race")
// that get a bonus rate — both list columns are MULTI_VALUE_DELIMITER-
// separated in the CSV. Ranks work like class dots: 0-20, 2 rows of 10.
//
// Skill (and weapon) ranks are bought with points earned from class dots:
// each class dot grants that class one point, shared between Skills and
// Weapon skills. An item is only spendable from a class's pool if the class
// is listed in its Focus column, or the Focus column is empty (open to every
// class). character.skillSpend tracks, per skill, how many ranks each
// class's pool paid for; a skill's total rank is the sum across classes.
// This is independent of the Focus/Race bonus *rate* below, which always
// checks the character's actual chosen Focus/Race.
// ---------------------------------------------------------------------------

// Independent of CLASS_DOTS_* on purpose — see the identical note on
// WEAPON_RANKS_* above.
const SKILL_RANKS_MIN = 0;
const SKILL_RANKS_MAX = 20;
const SKILL_RANKS_ROWS = 2;
const SKILL_RANKS_PER_ROW = 10;

const SKILL_BASE_RATE = 3;
const SKILL_BONUS_RATE = 6;

const SKILLS_CSV = `name,description,attribute,min_tl,focus,race
Athletics,Climb; jump; swim; run; lift; parkour,Strength;Agility;Physique,1,,
Perception,Notice details; spot danger; search; situational awareness,Intuition,1,,
Survival,Wilderness living; foraging; tracking; shelter,Intuition;Constitution,1,,
Riding / Animal Handling,Mounts; beasts of burden; basic animal care,Agility;Intuition,1,,
Language,Per language; ranks for fluency,Intellect,1,Adept;Shepherd,
Trade / Profession,Merchant; farmer; artisan; laborer; administrator,,1,,
Craft (basic),Common practical crafts,Dexterity;Intellect,1,,
Endurance,2x Stamina recovery chances,Constitution;Physique,1,,
Pilot (water),Sailing or other small ship piloting,Intellect;Intuition,2,,
Gambling,Odds; games of chance,Intellect;Charisma,1,,
Driving (basic),Everyday vehicles,Dexterity;Agility,4,,
Computer Use (basic),Everyday devices and software,Intellect;Dexterity,5,,
First Aid,Basic emergency care,Dexterity;Willpower,1,,
Navigation (basic),Land; maps; digital at TL5+,Intellect;Intuition,1,,
Armor Use,1/2 Armor Stamina cost,Strength;Constitution,2,martial,
Tactics,Small-unit tactics; positioning; ambushes; battlefield reading,Intellect;Intuition,1,martial,
Intimidation,Threats; presence; breaking morale (also Covert),Strength;Bravery;Charisma,1,martial;covert,
Heavy Weapons,Crew-served weapons; vehicle weapons; explosives,Strength;Dexterity,4,martial,
Driving (Advanced),High-performance or combat driving,Dexterity;Agility,4,martial,
Piloting (Atmospheric),Aircraft and helicopters,Dexterity;Intellect,5,martial,
Shield Use,Blocking and fighting with shields,Strength;Agility,1,martial,
Unarmed Combat,Holds; throws; pins; joint locks,Strength;Agility,1,martial,
Mounted Combat,Fighting effectively from horseback or mounts,Agility;Strength,1,martial,
Demolitions,Explosives handling; placement; and disarming,Intellect;Dexterity,4,martial,
Camouflage,Concealing positions; vehicles; or personnel,Intellect;Agility,3,martial,
Interrogation (field),Rapid field questioning under stress,Willpower;Strength,1,martial,
Stealth,Hiding; silent movement; urban and wilderness,Agility;Dexterity,1,covert,
Sleight of Hand,Pickpocket; palming; stage magic,Dexterity,1,covert,
Lockpicking / Security,Mechanical TL1+; electronic/cyber TL5+,Dexterity;Intellect,1,covert,
Deception,Lies; misdirection; social engineering,Intellect;Charisma;Attraction,1,covert,
Streetwise,Urban underworld; contacts; local knowledge,Intuition;Charisma,1,covert,
Surveillance,Shadowing; observation; tech-enhanced TL5+,Intuition;Dexterity,1,covert,
Forgery,Documents; digital TL5+,Dexterity;Intellect,2,covert,
Acrobatics,Balance; tumbling; evasion; parkour,Agility;Dexterity,1,covert,
Disguise,Appearance alteration; impersonation,Charisma;Dexterity,1,covert,
Interrogation,Questioning; extracting information,Intellect;Willpower;Charisma,1,covert,
Escape Artist,Ability to free themselves or complex escape planning,Dexterity;Agility,1,covert,
Shadowing,Following without detection,Agility;Intuition,1,covert,
Poisons,Preparation and delivery of toxins,Intellect;Dexterity,2,Covert;Shepherd,
Cryptography,Codes; ciphers; digital TL5+,Intellect;Intuition,3,Adept;Covert,
Fast Talk,Rapid persuasion under pressure,Charisma;Intellect,1,covert,
Lore / History,General knowledge; legends; local history,Intellect,1,Adept;Shepherd,
Research,Libraries; investigation; databases TL5+,Intellect;Intuition,1,adept,
Craft (advanced),Specialized high-quality crafting,Dexterity;Intellect,1,,
Engineering,Design and construction; specializations by field/TL,Intellect;Intuition,3,adept,
Occult / Arcane Lore,Fantasy or mystic settings,Intellect;Mysticism;Intuition,1,Adept;Shepherd,
Science,Physics; chemistry; biology (specializations),Intellect,4,adept,
Electronics,Circuits; devices; sensors,Intellect;Dexterity,5,adept,
Computer (Advanced),Operation; programming; systems,Intellect;Intuition,5,adept,
Hacking / Cybersecurity,Intrusion and systems exploitation,Intellect;Intuition,5,Adept;Covert,
Repair / Mechanics,Fixing tools; vehicles; gear,Dexterity;Intellect,1,Adept;Martial,
Navigation,Land/sea; orienteering 4+; space at TL7+,Intellect;Intuition,1,Adept;Martial,
Chemistry,Practical and theoretical,Intellect,4,adept,
Medicine (advanced),Surgery; diagnosis; treatment,Intellect;Dexterity,4,adept,
Alchemy,Transmutation and magical substances (fantasy),Intellect;Mysticism,3,adept,
Artifice,Creating magical or technological devices,Intellect;Dexterity,3,adept,
Persuasion,Bargaining; convincing; influence,Charisma;Attraction,1,shepherd,
Diplomacy,Negotiation; formal dealings; etiquette,Intellect;Charisma;Attraction,1,shepherd,
Leadership,Command; morale; inspiring others,Charisma;Bravery;Willpower,1,Martial;Shepherd,
Reading People,Reading people; detecting lies,Intuition;Charisma,1,Covert;Shepherd,
Performance,Oratory; acting; music; entertainment,Charisma;Attraction;Dexterity,1,shepherd,
Medicine (basic),Basic to advanced care,Intellect;Dexterity;Intuition,1,Adept;Shepherd,
Pharmacology,Drugs; poisons; herbs,Intellect,3,Adept;Shepherd,
Attraction / Seduction,Physical and social allure,Attraction;Charisma,1,shepherd,
Teaching / Instruction,Passing on skills or knowledge,Intellect;Charisma,1,shepherd,
Speaking,Public speaking; Sermons; inspiring crowds,Charisma;Willpower,1,shepherd,
Meditation,Focus; recovery; spiritual discipline,Willpower;Intuition,1,Adept;Shepherd,`;

// Header-driven rather than positional — a hand-edited file (not written by
// vg-tools, which always emits its own fixed column order) can list
// min_tl/attribute in either order, or spell the attribute column singular
// or plural, and this still reads it correctly instead of silently
// swapping the two (exactly the kind of mismatch that bit
// data/morrow_project_skills.csv).
function parseSkillsCsv(csv) {
  const lines = csv.trim().split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const fields = line.split(',');
    const row = {};
    header.forEach((key, idx) => { row[key] = (fields[idx] || '').trim(); });
    return {
      name: row.name || '',
      description: row.description || '',
      attribute: parseMultiValue(row.attribute || row.attributes).map(capitalizeToken),
      minTl: Number(row.min_tl) || 0,
      focus: parseMultiValue(row.focus).map(capitalizeToken),
      race: parseMultiValue(row.race).map(capitalizeToken),
    };
  });
}

const SKILLS = parseSkillsCsv(SKILLS_CSV);

// Fantasy-only genre skills (data/fantasy_skills.csv) — the Spell:/Miracle:
// casting skills, extracted out of the magic-free baseline SKILLS above so
// non-Fantasy genres never see them unless Magic is enabled. See GENRE_SKILLS
// below and getActiveSkills().
const FANTASY_SKILLS_CSV = `name,description,attribute,min_tl,focus,race
Spell: Necromancy,Raising; controlling; or communicating with the dead,Mysticism;Intellect;Willpower,3,adept,
Spell: Protection,Wards; shields; barriers; and defensive magic,Mysticism;Willpower,3,adept,
Spell: Attack,Offensive spells; blasts; and direct damage magic,Mysticism;Intellect,3,adept,
Spell: Summoning,Calling creatures; spirits; or entities,Mysticism;Willpower;Intellect,3,adept,
Spell: Ritualistic Magic,Complex; time-consuming; high-power rituals,Mysticism;Intellect;Willpower,3,adept,
Miracle: Necromancy,Communicating with or laying the dead to rest (divine framing),Mysticism;Willpower;Intuition,3,shepherd,
Miracle: Protection,Blessings; wards; shields; and protective miracles,Mysticism;Willpower,3,shepherd,
Miracle: Attack,Smiting; holy fire; or divine offensive power,Mysticism;Willpower;Bravery,3,shepherd,
Miracle: Summoning,Calling divine servants; spirits; or allies,Mysticism;Willpower;Charisma,3,shepherd,
Miracle: Ritualistic Magic,Ceremonies; blessings; consecrations; and high rituals,Mysticism;Willpower;Intellect,3,shepherd,`;

const FANTASY_SKILLS = parseSkillsCsv(FANTASY_SKILLS_CSV);

// ---------------------------------------------------------------------------
// Genres (data/{genre}_skills.csv, data/{genre}_melee.csv, data/{genre}_ranged.csv)
// — Modern/Dystopian/SciFi/Apocalyptic start as empty scaffolds (see Phase 1
// of the genre plan); Fantasy's genre-specific skills are FANTASY_SKILLS
// above. A genre's skill list is SKILLS (the magic-free baseline) plus
// whatever that genre contributes — see getActiveSkills().
// ---------------------------------------------------------------------------

// The 5 genre catalogs the app actually has Skills/Equipment/Race CSVs for.
// There's no independent Genre selector any more — the Tech Level dropdown
// is the only control; its selected tier's genre label(s) resolve to one of
// these 5 via GENRE_LABEL_MAP below.
const GENRES = ['Fantasy', 'Modern', 'Dystopian', 'SciFi', 'Apocalyptic', 'morrow_project'];

// ---------------------------------------------------------------------------
// Tech Level tiers (data/tech_levels.csv): `TL,genre,magic,psychic,mutant,
// cyber` rows, one genre per row — a TL number can repeat across several
// rows (e.g. TL 1 and TL 2 both list "primitive"; TL 6 has a separate row
// each for Morrow Project, Information Age, Dystopian, and Apocalyptic),
// each becoming its own Tech Level dropdown option (see
// getAvailableTechLevels()/renderTechLevelOptions() in app.js — the
// option's value is the row's index, not its TL number, since TL alone
// isn't unique). None of these raw labels are guaranteed to match one of
// the 6 real catalogs above by spelling or case, so GENRE_LABEL_MAP
// resolves each one (case-insensitively) to whichever catalog is the
// closest tech-era fit — see resolveCatalogGenre(). The last 4 columns
// (on/off) are that row's default for the Magic/Psychic/Mutant/Cyber
// toggles — see onGenreResolved() in app.js, which re-applies them on every
// Tech Level change until the player explicitly overrides a given toggle.
// ---------------------------------------------------------------------------

const TECH_LEVELS_SRC = `TL,genre,magic,psychic,mutant,cyber
1,primitive,off,off,off,off
2,primitive,off,off,off,off
3,fantasy,on,off,off,off
4,Modern,off,off,off,off
5,Computer Age,off,off,off,off
6,Morrow Project,off,on,on,off
6,Information Age,off,off,off,off
6,Dystopian,off,off,off,off
6,Apocalyptic,off,on,on,off
7,AI,off,off,off,off
7,Interplanetary,off,off,off,off
8,Interstellar,off,off,off,off
9,Intergalactic,off,off,off,off`;

function parseTechLevels(src) {
  const lines = src.trim().split('\n');
  // "on"/"off" is the convention in data/tech_levels.csv; "yes"/"no"/"true"
  // also read as on/true for leniency against hand edits.
  const toBool = (v) => ['on', 'yes', 'true'].includes((v || '').trim().toLowerCase());
  return lines.slice(1).filter((line) => line.trim()).map((line) => {
    const parts = line.split(',');
    const tl = Number((parts[0] || '').trim());
    const genreLabels = (parts[1] || '').trim().split(';').map((s) => s.trim()).filter(Boolean);
    return {
      tl,
      genreLabels,
      magic: toBool(parts[2]),
      psychic: toBool(parts[3]),
      mutant: toBool(parts[4]),
      cyber: toBool(parts[5]),
    };
  });
}

// This embedded copy is what every other data file in this app does too
// (keeps the page fully usable via plain file://, with no server and no
// fetch). TECH_LEVELS is kept as a mutable array on purpose, though — on
// page load, app.js tries to re-fetch data/tech_levels.csv fresh (works
// only when served over http(s); fails silently and harmlessly under
// file://) and replaces this array's CONTENTS in place via
// TECH_LEVELS.length = 0; TECH_LEVELS.push(...), so every reference held
// here in data.js updates automatically without needing a new binding.
const TECH_LEVELS = parseTechLevels(TECH_LEVELS_SRC);

const GENRE_LABEL_MAP = {
  primitive: 'Fantasy',
  fantasy: 'Fantasy',
  modern: 'Modern',
  'computer age': 'Modern',
  ai: 'Dystopian',
  dystopian: 'Dystopian',
  apocalyptic: 'Apocalyptic',
  interplanetary: 'SciFi',
  interstellar: 'SciFi',
  intergalactic: 'SciFi',
  'morrow project': 'morrow_project',
};

// Nearest-tech-era fallback to Fantasy for any label somehow not in the map.
function resolveCatalogGenre(genreLabel) {
  return GENRE_LABEL_MAP[String(genreLabel || '').toLowerCase()] || 'Fantasy';
}

function getDefaultTechLevel() {
  const fantasyTier = TECH_LEVELS.find((t) => t.genreLabels.some((g) => g.toLowerCase() === 'fantasy'));
  return fantasyTier ? fantasyTier.tl : 3;
}

// A genre only shows up in the Tech Level dropdown once it actually has its
// own expertise.csv (Expertise is the one file every build fundamentally
// needs — no Expertise data means no character is buildable in that
// genre). A tier qualifies if at least one of its genre labels resolves to
// a genre with real expertise data.
function genreHasExpertise(genre) {
  const list = GENRE_EXPERTISE[genre];
  return Array.isArray(list) && list.length > 0;
}

function getAvailableTechLevels() {
  return TECH_LEVELS.filter((tier) => tier.genreLabels.some((label) => genreHasExpertise(resolveCatalogGenre(label))));
}

// ---------------------------------------------------------------------------
// Psychic Powers (data/psychic.csv) — an OPTIONAL system the Venn Guide
// turns on or off per table via the Psychic toggle (character.psychicEnabled,
// next to Magic). When on, these fold into the Skills list exactly like any
// other Expertise skill — same focus=Adept skill-dot pool as regular Skills,
// same auto-granted first rank when Focus matches — EXCEPT each power's
// buyable dots are capped by its own `dots` column (a plain number, or an
// "X-Y" range whose upper bound is the cap) rather than the shared 20-dot
// grid every other skill uses; see maxRank below, getActiveSkills(), and
// toggleSkillRankForClass()'s cap. Appendix P in the printed Handbook has
// the full rules text (optional-by-VG, buy-a-dot-up-to-Dots, each dot
// expands the effect toward the description's maximum).
// ---------------------------------------------------------------------------

const PSYCHIC_POWERS_CSV = `name,description,min_tl,attributes,focus,race,power,dots
Life Sense,"Detect living beings through mental auras; determine nature, number, direction, and approximate distance",6,Mysticism,adept,,Telepathy,1
Empathic Contact,Project a one-word emotional message or sense a subject's mood,6,Mysticism,adept,,Telepathy,1
Mind Shield,Maintain a natural barrier against unwanted telepathic probing or interference,6,Mysticism,adept,,Telepathy,1
Suggestion,Project false emotional states or impress emotions to influence responses,6,Mysticism,adept,,Telepathy,1
Mind Touch,Establish surface mind-link for conversation or limited surface thought reading,6,Mysticism,adept,,Telepathy,2
TruthTell,Detect lies by analyzing aura of belief in statements,6,Mysticism,adept,,Telepathy,2
Mental Attack,Escalate telepathic efforts against resistance to force effects through mental pressure,6,Mysticism,adept,,Telepathy,2
Stun,"Mental attack that stuns a target like a stun pistol, ignoring personal armor",6,Mysticism,adept,,Telepathy,2
Telepathy,Communicate mind-to-mind with sentient beings over distance,6,Mysticism,adept,,Telepathy,1-10
Illusion,Create a believable mental illusion around an object or motionless creature,6,Mysticism,adept,,Telepathy,3
MindProbe,Deep mental attack to extract truthful answers to specific questions,6,Mysticism,adept,,Telepathy,4
Coma,Mental attack that induces prolonged coma with possible amnesia,6,Mysticism,adept,,Telepathy,4
PainBlast,Savage mental attack inflicting intense pain and stamina/physical damage,6,Mysticism,adept,,Telepathy,4
Presence,"Enhance personal aura for leadership, charisma, and influence effects",6,Mysticism,adept,,Telepathy,5
Psychic Force,Tap the Force via PK Crystal for temporary or permanent stamina boosts,6,Mysticism,adept,,Telepathy,5
Locate,Pinpoint the position of mental auras or sources of psionic power within range,6,Mysticism,adept,,Telepathy,5
Communicate,Long-range telepathic projection over vast distances with PK Crystal,6,Mysticism,adept,,Telepathy,5
DeathBolt,Mental attack delivering significant damage,6,Mysticism,adept,,Telepathy,6
Delusion,Implant a lasting false belief structure that influences decisions,6,Mysticism,adept,,Telepathy,6
Control,"Dominate the will of an animal, creating loyalty or temporary control",6,Mysticism,adept,,Telepathy,6
StarSpeak,Interstellar telepathic communication over light-years,6,Mysticism,adept,,Telepathy,7
Dominate,Dominate the will of a sentient being to compel actions,6,Mysticism,adept,,Telepathy,7
Transfer Personality,Transfer personality to another body,6,Mysticism,adept,,Telepathy,7
SaneMind,Telepathically operate on a mind to remove suggestions or aberrations,6,Mysticism,adept,,Telepathy,8
MindSlay,Devastating mental attack dealing massive damage or slaying non-psionics,6,Mysticism,adept,,Telepathy,8
Suggestion II,Deep subconscious compulsion triggered later by a key word or phrase,6,Mysticism,adept,,Telepathy,8
Elemental Force,Tap deep psyche for a blast of mental force against multiple targets,6,Mysticism,adept,,Telepathy,9
Great Command,Overwhelming psychic aura granting initiative and influence,6,Mysticism,adept,,Telepathy,9
Living Matrix,Oneness with the Force granting mental combat advantages,6,Mysticism,adept,,Telepathy,10
Mass Movement,Move objects of increasing mass over short distances,6,Mysticism,adept,,Telekinesis,1-10
Manipulation,Manipulate small objects as if using fingers,6,Mysticism,adept,,Telekinesis,1
Sound,Vibrate air or materials to create sounds,6,Mysticism,adept,,Telekinesis,1
SoftSpeak,Whisper a short message into a subject's ear,6,Mysticism,adept,,Telekinesis,2
Telek Blow,Hurl a small object with the force of a mace,6,Mysticism,adept,,Telekinesis,2
Telek Bullet,Accelerate a small object to strike like a firearm round,6,Mysticism,adept,,Telekinesis,3
Telek Shield,Erect a kinetic defense screen against solid missiles,6,Mysticism,adept,,Telekinesis,3
Levitate,Levitate self or limited mass,6,Mysticism,adept,,Telekinesis,3
Stress,Perceive or create stress points to enhance penetration or break bonds,6,Mysticism,adept,,Telekinesis,4
Flight,Fly using telekinetic power,6,Mysticism,adept,,Telekinesis,4
Grenade,Cause a small object to explode like a grenade,6,Mysticism,adept,,Telekinesis,4
Pyro PSI,Generate flame effects or start fires,6,Mysticism,adept,,Telekinesis,5
Cryo PSI,Reduce kinetic energy to freeze or cool matter,6,Mysticism,adept,,Telekinesis,5
Morass,Turn solid footing into a soft morass that slows movement,6,Mysticism,adept,,Telekinesis,6
Energize,Recharge portable power cells by touch,6,Mysticism,adept,,Telekinesis,7
MagnetoScreen,Erect a force screen that turns aside projectiles,6,Mysticism,adept,,Telekinesis,8
NegaField,Disrupt electronic circuitry in an area,6,Mysticism,adept,,Telekinesis,8
RadShield,Erect a personal field that deflects radiation,6,Mysticism,adept,,Telekinesis,8
BattleScreen,Erect a personal forcefield battlescreen,6,Mysticism,adept,,Telekinesis,9
Power,Channel energy to supply starship power requirements,6,Mysticism,adept,,Telekinesis,9
ManeuverDrive,Augment a spacecraft's maneuver drive,6,Mysticism,adept,,Telekinesis,9
FTL Drive,Augment a starship's FTL rating,6,Mysticism,adept,,Telekinesis,10
Teleportation,Instantaneously travel to a known location within range,6,Mysticism,adept,,Teleportation,2-10
Dematerialize,Phase through solid matter,6,Mysticism,adept,,Teleportation,6
Living Matrix,Oneness with the Force granting mental advantages,6,Mysticism,adept,,Teleportation,10
Sense Danger,Heightened awareness of potential danger,6,Mysticism,adept,,Clairvoyance,1
Locate Danger,Determine direction and position of a sensed danger,6,Mysticism,adept,,Clairvoyance,1
FarSee,Sense characteristics of a distant location,6,Mysticism,adept,,Clairvoyance,2
Detect PSI,Sense the presence of active psionic forces,6,Mysticism,adept,,Clairvoyance,2
Sense Poison,Detect poisonous substances nearby,6,Mysticism,adept,,Clairvoyance,2
TruthTell,Detect lies by analyzing belief,6,Mysticism,adept,,Clairvoyance,3
Storytell,Learn facts about an object by handling it,6,Mysticism,adept,,Clairvoyance,3
Clairaudience,Overhear spoken words at a distance,6,Mysticism,adept,,Clairvoyance,3
Mind Shield,Mental barrier against probing,6,Mysticism,adept,,Clairvoyance,3
TrueSight,See through illusions to perceive true nature,6,Mysticism,adept,,Clairvoyance,4
PathFind,Receive a mental picture of the correct route,6,Mysticism,adept,,Clairvoyance,4
Precognition,Receive a foreshadowing vision of the future,6,Mysticism,adept,,Clairvoyance,5
Perception,See without normal vision or with enhanced range,6,Mysticism,adept,,Clairvoyance,5-10
Psychic Force,Tap the Force for stamina boosts,6,Mysticism,adept,,Clairvoyance,6
Living Matrix,Oneness with the Force,6,Mysticism,adept,,Clairvoyance,10
Mind Shield,Always maintain a rigid mind shield,6,Mysticism,adept,,Telergy,2-10
Strength,Psycho-physical conditioning that boosts Strength,6,Mysticism,adept,,Telergy,2-10
Constitution,Psycho-physical conditioning that boosts Constitution,6,Mysticism,adept,,Telergy,2-10
Agility,Psycho-physical conditioning that boosts Agility,6,Mysticism,adept,,Telergy,2-10
Dexterity,Psycho-physical conditioning that boosts Dexterity,6,Mysticism,adept,,Telergy,2-10
Intelligence,Mental development that boosts Intelligence,6,Mysticism,adept,,Telergy,2-10
Intuition,Mental development that boosts Intuition,6,Mysticism,adept,,Telergy,2-10
Leadership,Development that boosts Leadership,6,Mysticism,adept,,Telergy,2-10
Bravery,Development that boosts Bravery,6,Mysticism,adept,,Telergy,2-10
Empathy,Development that boosts Empathy,6,Mysticism,adept,,Telergy,2-10
Awareness,Overall competence granting Force access,6,Mysticism,adept,,Telergy,2-10
Living Matrix,Oneness with the Force,6,Mysticism,adept,,Telergy,10
Self Heal,Heal personal damage daily using the Force,6,Mysticism,adept,,Concord,5
Heal,Heal damage to another by touch,6,Mysticism,adept,,Concord,5
PainStop,Block personal pain or bestow the effect,6,Mysticism,adept,,Concord,5
Mental Attack,Deliver telepathic attacks equal to development level,6,Mysticism,adept,,Concord,5
PainTouch,Deliver a pain attack by touch,6,Mysticism,adept,,Concord,5
SensoryBlock,Temporarily remove one sense from a target,6,Mysticism,adept,,Concord,5
DeathTouch,Deliver a lethal attack by touch,6,Mysticism,adept,,Concord,6
Self Cure,"Cure personal disease, poison, or drug effects",6,Mysticism,adept,,Concord,6
Cure,Aid another against potentially fatal disease,6,Mysticism,adept,,Concord,6
Regenerate Self,Regrow lost limbs or organs,6,Mysticism,adept,,Concord,9
Revivify,Attempt to revive the recently dead,6,Mysticism,adept,,Concord,9`;

function parsePsychicPowersCsv(csv) {
  return parseCsvWithHeader(csv).map((r) => {
    const dotsRaw = (r.dots || '').trim();
    const rangeMatch = dotsRaw.match(/^(\d+)\s*-\s*(\d+)$/);
    const maxRank = rangeMatch ? Number(rangeMatch[2]) : (Number(dotsRaw) || 1);
    return {
      name: r.name,
      description: r.description,
      attribute: parseMultiValue(r.attributes).map(capitalizeToken),
      minTl: Number(r.min_tl) || 0,
      focus: parseMultiValue(r.focus).map(capitalizeToken),
      race: parseMultiValue(r.race).map(capitalizeToken),
      power: r.power,
      dots: dotsRaw,
      maxRank,
    };
  });
}

const PSYCHIC_POWERS = parsePsychicPowersCsv(PSYCHIC_POWERS_CSV);

const MODERN_SKILLS_CSV = `name,description,attribute,focus,race`;
const DYSTOPIAN_SKILLS_CSV = `name,description,attribute,focus,race`;
const SCIFI_SKILLS_CSV = `name,description,attribute,focus,race`;
const APOCALYPTIC_SKILLS_CSV = `name,description,attribute,focus,race`;

// Morrow Project's own skill file (data/morrow_project_skills.csv, edited
// via vg-tools) has been rewritten by the Venn Guide since this was first
// embedded — this copy is kept in sync with that file as of this edit;
// publishing a Game Set from vg-tools is what keeps it from going stale
// again without a manual resync like this one. Its focus values match the
// genre's own renamed Expertise classes (soldier/scout/science/contact,
// not martial/covert/adept/shepherd).
const MORROW_PROJECT_SKILLS_CSV = `name,description,min_tl,attributes,focus,race
Accounting,Track resources; debts; and simple ledgers,1,Intellect,,
Art,Create art in a chosen medium (painting; music; sculpture; etc.),1,Dexterity;Charisma,,
Astronomy,Use stars for navigation; timing; and basic observation,3,Intellect,,
Bargain,Negotiate trades; prices; and deals,1,Charisma;Intellect,,
Boat/Row,Operate small boats; canoes; kayaks; and rafts,1,Dexterity;Agility,,
Climb,Scale walls; ruins; cliffs; and natural obstacles,1,Strength;Agility,,
Craft,Perform a practical craft (specify field),1,Dexterity;Intellect,,
Dodge,Avoid attacks and sudden dangers,1,Agility;Dexterity,,
Drive Auto,Operate cars; light trucks; and similar vehicles,4,Dexterity;Agility,,
Drive Truck,Operate heavy trucks and commercial vehicles,4,Dexterity;Agility;Strength,,
Fast Talk,Rapid persuasion or misdirection under pressure,1,Charisma;Intellect,,
First Aid,Provide emergency care and stabilize injuries,1,Dexterity;Willpower,,
Hide,Conceal yourself from observation,1,Agility;Intuition,,
History,Knowledge of past events; local history; and pre-collapse records,1,Intellect,,
Jump,Leap gaps; obstacles; or from heights,1,Strength;Agility,,
Listen,Hear distant; faint; or concealed sounds,1,Intuition,,
Own Language,Speak; read; and write your native language fluently,1,Intellect,,
Other Language,Speak and understand a language other than your own,1,Intellect,,
Persuade,Convince others through reason; charm; or argument,1,Charisma;Intellect,,
Ride,Handle horses or other mounts,1,Agility;Intuition,,
Sneak,Move without being noticed,1,Agility;Dexterity,,
Spot Hidden,Notice concealed objects; people; or traps,1,Intuition,,
Swim,Swim and stay afloat in open water,1,Strength;Constitution,,
Throw,Throw objects accurately for distance or effect,1,Dexterity;Agility,,
Tracking,Follow people or animals by signs and trails,1,Intuition;Agility,Scout,
Woodworking,Carpentry; carving; and working with wood,1,Dexterity;Intellect,,
Masonry,Work with stone; brick; and concrete,1,Strength;Intellect,,
Metalworking,Basic smithing and metal repair,1,Strength;Dexterity,,
Ski,Move efficiently on snow or ice,1,Agility;Dexterity,,
Sail,Operate sail-powered vessels,1,Dexterity;Intellect,,
Military Science,Knowledge of military organization; logistics; and doctrine,1,Intellect,soldier,
Demolitions,Handle; place; and disarm explosives,3,Intellect;Dexterity,soldier;science,
Operate Heavy Machinery,Run generators; construction equipment; or industrial machines,3,Dexterity;Intellect,soldier;science,
Parachute,Perform parachute jumps and land safely,4,Agility;Constitution,soldier;scout,
Conceal,Hide objects; caches; or people from search,1,Agility;Intuition,scout;soldier,
Cryptography,Create and break codes and ciphers,4,Intellect;Intuition,scout;science,
Disguise,Alter appearance and mannerisms to avoid recognition,1,Charisma;Dexterity,scout,
Forgery,Create or alter documents; records; and credentials,1,Dexterity;Intellect,scout;science,
Lockpicking,Open locks and simple mechanical security devices,3,Dexterity;Intellect,scout,
Tradecraft,Espionage techniques; dead drops; and scout operations,1,Intellect;Agility,scout,
Hypnosis,Induce trance states for questioning or therapy,3,Willpower;Charisma,scout;contact,
Anthropology,Understand cultures; customs; and social structures,4,Intellect;Intuition,science;contact,
Archaeology,Recover and interpret pre-collapse artifacts and sites,4,Intellect;Intuition,science,
Biology,Knowledge of living organisms and ecosystems,4,Intellect,science,
Botany,Identify plants and their uses for food; medicine; or materials,4,Intellect;Intuition,science;contact,
Cartography,Create and read maps of terrain and settlements,3,Intellect;Dexterity,science;soldier,
Chemistry,Practical chemistry for purification; analysis; or simple synthesis,3,Intellect,science,
Computer Use,Operate surviving computers and digital systems,5,Intellect;Dexterity,science,
Electrical Repair,Repair electrical systems; wiring; and simple circuits,4,Dexterity;Intellect,science,
Electronics,Work with electronic devices and circuits,5,Intellect;Dexterity,science,
Fieldcraft,Advanced outdoor living; concealment; and movement,1,Intuition;Agility,science;soldier;scout,
Forensics,Analyze physical evidence and causes of injury or death,3,Intellect;Intuition,science;scout,
Geology,Understand terrain; soil; minerals; and geological hazards,4,Intellect,science,
Library Use,Locate and extract information from books; archives; or records,4,Intellect;Intuition,science;contact,
Mathematics,Apply mathematics to practical and technical problems,1,Intellect,science,
Mechanical Repair,Restore engines; generators; tools; and mechanical devices,3,Dexterity;Intellect,science;soldier,
Medicine,Diagnose and treat injuries and illness beyond first aid,1,Intellect;Dexterity,science;contact,
Navigation (Land),Overland navigation using landmarks; sun; and stars,1,Intellect;Intuition,science;soldier;scout,
Navigation (Sea/Air),Navigation for boats or aircraft,4,Intellect;Intuition,science;soldier,
Occult,Knowledge of mystical; fringe; or unexplained beliefs,1,Intellect;Intuition,science;contact,
Pharmacy,Knowledge of drugs; medicines; and their effects,1,Intellect,science;contact,
Photography,Capture and process images with available equipment,4,Dexterity;Intuition,science;scout,
Physics,Apply principles of physics to practical problems,3,Intellect,science,
Pilot; Propeller,Fly fixed-wing aircraft,5,Dexterity;Intellect,science;soldier,
Pilot; Helicopter,Fly helicopters and rotary-wing aircraft,5,Dexterity;Intellect,science;soldier,
Psychology,Understand human behavior; motives; and mental states,1,Intellect;Intuition,science;contact;scout,
Signals,Operate radios and basic communication equipment,4,Intellect;Dexterity,science;soldier;scout,
Surgery,Perform invasive medical procedures,3,Intellect;Dexterity,science,
Zoology,Knowledge of animals and their behavior,1,Intellect;Intuition,science,
Teach,Instruct others in skills or knowledge,1,Intellect;Charisma,contact;science,
Law,Understand formal laws; contracts; or informal community rules,3,Intellect,contact,
Drive Military,Drive heavy equipment like APC; troop carriers and tanks,,,,
Mechanical Repair; Heavy,Heavy or large engine and mechanical reapir,,,,
Pilot; Jet,Piloting of jet aircraft,6,,Science,`;

const MODERN_SKILLS = parseSkillsCsv(MODERN_SKILLS_CSV);
const DYSTOPIAN_SKILLS = parseSkillsCsv(DYSTOPIAN_SKILLS_CSV);
const SCIFI_SKILLS = parseSkillsCsv(SCIFI_SKILLS_CSV);
const APOCALYPTIC_SKILLS = parseSkillsCsv(APOCALYPTIC_SKILLS_CSV);
const MORROW_PROJECT_SKILLS = parseSkillsCsv(MORROW_PROJECT_SKILLS_CSV);

// Fantasy contributes nothing extra here: its non-magic skills already live
// in the shared baseline SKILLS, and its magic skills (FANTASY_SKILLS) are
// gated separately by magicEnabled below — NOT by genre — so Magic can be
// "bent" onto any genre independent of which one is selected.
const GENRE_SKILLS = {
  Fantasy: [],
  Modern: MODERN_SKILLS,
  Dystopian: DYSTOPIAN_SKILLS,
  SciFi: SCIFI_SKILLS,
  Apocalyptic: APOCALYPTIC_SKILLS,
  'morrow_project': MORROW_PROJECT_SKILLS,
};

// The Skills panel's actual list: every baseline (magic-free) Skill, plus the
// active genre's own additions, plus FANTASY_SKILLS (the Spell:/Miracle:
// casting skills) whenever Magic is enabled, plus PSYCHIC_POWERS whenever
// Psychic is enabled — neither gated by genre, so either can be "bent" onto
// any genre independent of which one is selected.
function getActiveSkills(genre, magicEnabled, psychicEnabled) {
  return SKILLS.concat(GENRE_SKILLS[genre] || [])
    .concat(magicEnabled ? FANTASY_SKILLS : [])
    .concat(psychicEnabled ? PSYCHIC_POWERS : []);
}

// Every Skill across every genre, regardless of which is currently active —
// used only to pre-seed a fresh character's skillSpend ledger so switching
// genre (or toggling Magic/Psychic) later never loses track of a skill's
// spend because its ledger entry didn't exist yet.
const ALL_SKILLS = SKILLS.concat(FANTASY_SKILLS, MODERN_SKILLS, DYSTOPIAN_SKILLS, SCIFI_SKILLS, APOCALYPTIC_SKILLS, MORROW_PROJECT_SKILLS, PSYCHIC_POWERS);

// A skill with any Race listed only ever appears in the Race tab (never a
// class tab or General), and a class tab only shows skills explicitly
// focused to that class — a skill with neither Focus nor Race is General-only.
function isSkillEligibleForClass(character, skill, cls) {
  return skill.race.length === 0 && skill.focus.includes(cls);
}

// General tab: skills with no Focus and no Race at all.
function isSkillGeneral(skill) {
  return skill.focus.length === 0 && skill.race.length === 0;
}

// Race tab: any skill listing at least one race, shown when that race is
// the character's current race. Race-tied skills never appear elsewhere.
function isSkillForRace(skill, raceName) {
  return skill.race.includes(raceName);
}

// General/Race skills aren't tied to one class, so a purchase on them draws
// from whichever class currently has points to spend (Martial first as a
// deterministic tie-break), falling back to the character's Focus.
function pickSpendableClass(character) {
  return getActiveClasses(character.genre).find((cls) => getClassSkillPointsAvailable(character, cls) > 0) || character.focus;
}

// True if the character's Focus or Race matches the skill's bonus lists.
function skillMatchesCharacter(character, skill) {
  return skill.focus.includes(character.focus) || skill.race.includes(character.race);
}

function getSkillRate(character, skill) {
  return skillMatchesCharacter(character, skill) ? SKILL_BONUS_RATE : SKILL_BASE_RATE;
}

// A skill's first rank is auto-granted (and locked) when Focus or Race matches.
function getSkillAutoMinRank(character, skill) {
  return skillMatchesCharacter(character, skill) ? 1 : 0;
}

function getSkillClassSpend(character, skill, cls) {
  return getLedgerClassSpend(character.skillSpend, skill.name, cls);
}

function getSkillSpentRank(character, skill) {
  return getLedgerSpentRank(character.skillSpend, skill.name);
}

// Additive, not max: see the comment on getWeaponEffectiveRank — the free
// auto-min rank sits "under" whatever's been paid for, so every paid rank
// (ledger step) always adds exactly 1 to the effective rank.
function getSkillEffectiveRank(character, skill) {
  return Math.min(skill.maxRank || SKILL_RANKS_MAX, getSkillSpentRank(character, skill) + getSkillAutoMinRank(character, skill));
}

function getSkillTarget(character, skill) {
  const rank = getSkillEffectiveRank(character, skill);
  return roundUp(getAverageEffectiveAttribute(character, skill.attribute) + rank * getSkillRate(character, skill));
}

// targetRank is a target EFFECTIVE rank; see setWeaponRankForClass for why
// the ledger target subtracts the free auto-min rank first.
function setSkillRankForClass(character, skill, cls, targetRank) {
  const autoMin = getSkillAutoMinRank(character, skill);
  const ledgerTarget = Math.max(0, targetRank - autoMin);
  setLedgerRankForClass(character.skillSpend, skill.name, cls, ledgerTarget, getSkillPointsAvailable(character, skill, cls));
}

function toggleSkillRankForClass(character, skill, cls, dotIndex) {
  const effective = getSkillEffectiveRank(character, skill);
  const targetRank = effective === dotIndex ? dotIndex - 1 : dotIndex;
  // A Psychic Power caps its own buyable dots below the shared 20-dot grid
  // (skill.maxRank, from its `dots` column) — every other skill is
  // uncapped beyond the grid itself.
  setSkillRankForClass(character, skill, cls, clamp(targetRank, SKILL_RANKS_MIN, skill.maxRank || SKILL_RANKS_MAX));
}

// ---------------------------------------------------------------------------
// Specials (data/special.csv). A binary (0 or 1) ability a character only
// has access to when their current Focus or Race matches — unlike Skills,
// there's no General/Race-tab fallback: a Special with neither listed would
// never be accessible to anyone, so both columns are expected to be used.
// The CSV isn't strictly well-formed (a "stamina cost" column sometimes
// holds stray text, and a couple of rows have extra/missing trailing
// commas), so parsing trusts the LAST two fields as focus/race rather than
// fixed positions when a row has more than the expected 5 fields.
// ---------------------------------------------------------------------------

const SPECIAL_CSV = `name,description,stamina cost,focus,race
Stone Kenning,You can commune with stone to know depth; direction; sloping; or traps,5,,dwarf
Magic Resistance,You roll twice for Defy checks against Mysticism,0,,dwarf
Dark Sight,You can activate your vision to see in the dark,0,,dwarf
Stone Shaper,You can shape 1 cubic foot of stone by singing to it.,5,,dwarf
Ore Delver,You can sense and follow ore lines,0,,dwarf
Light Bringer,You can radiate the light of the One to drive back evil,10,,elf
Star Sight,You can see at night using only starlight,0,,elf
Magic Kenning,You can recognize general facts about magic,5,,elf
Tree Whisperer,You understand the speech of trees when they choose to speak,0,,elf
Animal Empathy,You can feel and exert your feelings over a single natural creatures,5,,elf
Nature Stride,You move through difficult terrain without being effected,0,,elf;halfling
Indomitable Will,You can resist any magical effect even if you fail your Defy check for as long as you pay the stamina cost,10,,halfling
Fey Resistance,You get two Defy checks against Fey Mysticism,0,,elf;halfling
Florentine,You are able to fight with 2 1-hand weapons without penalty. One must be shorter than the other,0,martial;covert
Dispel Magic,You are able to spend stamina to negate a spell,0,adept
Identify,You may study magic items to understand what they do for stamina cost per power revealed,5,adept,
Detect Aura,You can tell if an item or location is has a spell on it,5,adept,
Rebuke the Foe,You can use the power of your god to rebuke his foes,5,shepherd,
Lay Hands,You can heal the sick and injured 1 point per stamina cost,1,shepherd,
Endurance,You reduce combat stamina cost by 1/2,0,martial
Formation Fighting,You provide your Melee Defense Shield to the person next to you not yourself,Physique,martial;shepherd,
Fortifications,Basic engineering of digging ditches; raising earth ramparts; planting palisades,Strength,martial,
Armor Use,You remove penalties from wearing medium armor,0,martial;shepherd
Armor Expertise,You remove penalties from wearing heavy armor,0,martial;shepherd
Phalanx,You can hold a space given the right number of participants with phalanx,5,martial,dwarf
Ley Sense,Feel ambient magical currents and places of power,5,adept;shepherd,
Lucky Break,Roll twice on any Defy check,Intuition,0,,halfling
Sneak Attack,Strike when an enemy leaves an opening or turns away,5,martial;covert,
Parry,Use a ROF to deflect incoming weapon attacks with your weapon,0,martial;covert,
Extra Attack,Add +1 ROF to any weapon,2,martial;shepherd;covert
Double Attack,Add +1 ROF to any weapon,2,martial;shepherd
Triple Attack,Add +1 ROF to any weapon,2,martial
Point Blank Shot,Shoot in close range,0,martial,elf
Poison Resistance,Shrug off many common toxins and bad drink,Constitution,,dwarf
Instant Cover,Cover short distances at a burst of speed,5,martial;covert,
Steady Hands,Perform delicate work while under stress or in motion,5,covert,halfling,
War Mage,You know the power level of magics on the battlefield,5,adept,
Area Effect,You may spend some of your ranks to effect a 5x5 area and reduce damage dice,0,adept;shepherd,
Extra Spell,You select 1 additional spell each level after selecting this ability,0,adept
Blessing of Miracles,You select 1 additional miracle each level after selecting this ability,0,shepherd`;

function parseSpecialFields(fields) {
  if (fields.length > 5 && fields[fields.length - 1] === '') {
    fields = fields.slice(0, -1);
  }
  if (fields.length > 5) {
    return {
      costRaw: fields[fields.length - 3],
      focusRaw: fields[fields.length - 2],
      raceRaw: fields[fields.length - 1],
    };
  }
  return { costRaw: fields[2], focusRaw: fields[3], raceRaw: fields[4] };
}

function parseSpecialCsv(csv) {
  return csv.trim().split('\n').slice(1).filter(Boolean).map((line) => {
    const fields = line.split(',');
    const { costRaw, focusRaw, raceRaw } = parseSpecialFields(fields);
    return {
      name: (fields[0] || '').trim(),
      description: (fields[1] || '').trim(),
      staminaCost: Number(costRaw) || 0,
      focus: parseMultiValue(focusRaw).map(capitalizeToken),
      race: parseMultiValue(raceRaw).map(capitalizeToken),
    };
  });
}

const SPECIALS = parseSpecialCsv(SPECIAL_CSV);

// A Special requires the character's current Focus or Race to be listed —
// there's no open-to-everyone case the way an empty-Focus Skill has.
function isSpecialEligible(character, special) {
  return special.focus.includes(character.focus) || special.race.includes(character.race);
}

function getSpecialClassSpend(character, special, cls) {
  return getLedgerClassSpend(character.specialSpend, special.name, cls);
}

function getSpecialSpentRank(character, special) {
  return getLedgerSpentRank(character.specialSpend, special.name);
}

function isSpecialOwned(character, special) {
  return getSpecialSpentRank(character, special) >= 1;
}

// Specials tier progression: total ranks invested across all four classes
// unlock a Special "slot" at levels 1, 3, 6, 9, 12, 15, 18... (one at level
// 1, then one more every 3 levels). A character can never own more Specials
// than slots unlocked, regardless of how many shared points they have.
function getSpecialTierCount(character) {
  const totalRanks = getTotalClassDots(character);
  return totalRanks <= 0 ? 0 : 1 + Math.floor(totalRanks / 3);
}

function getSpecialsOwnedCount(character) {
  return SPECIALS.reduce((sum, special) => sum + (isSpecialOwned(character, special) ? 1 : 0), 0);
}

function canAcquireSpecial(character) {
  return getSpecialsOwnedCount(character) < getSpecialTierCount(character);
}

// Specials cost exactly 1 point (own it or don't) from a specific class's
// pool; toggling "on" spends 1 (only if a tier slot is free), toggling
// "off" always refunds it to that class.
function toggleSpecialForClass(character, special, cls) {
  const owned = isSpecialOwned(character, special);
  if (!owned && !canAcquireSpecial(character)) return;
  const target = owned ? 0 : 1;
  setLedgerRankForClass(character.specialSpend, special.name, cls, target, getClassSkillPointsAvailable(character, cls));
  // "Extra Spell"/"Blessing of Miracles" grant +1 grimoire slot for every
  // Adept/Shepherd dot gained AFTER the special is acquired (not retroactive) —
  // record the rank at the moment ownership actually starts.
  if (!owned && isSpecialOwned(character, special)) {
    if (special.name === 'Extra Spell') character.extraSpellBaseRank = character.classDots.Adept || 0;
    else if (special.name === 'Blessing of Miracles') character.extraMiracleBaseRank = character.classDots.Shepherd || 0;
  }
}

// ---------------------------------------------------------------------------
// Spells (data/spells.csv). A reference grimoire, not point-bought or owned
// individually — every spell becomes visible once a character has spent at
// least 1 rank in Adept (independent of current Focus). The file is proper
// quoted CSV (fields may contain commas), so it needs a real parser rather
// than the naive split(',') the other data files use.
// ---------------------------------------------------------------------------

function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function parseCsvWithHeader(csv) {
  const rows = parseCsvRows(csv);
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((key, idx) => { obj[key] = (r[idx] || '').trim(); });
    return obj;
  });
}

const FANTASY_SPELLS_CSV = `"id","school","name","cost","Dots Reqd","defy","clock","crutch","full_description"
"A01","Attack","The Coruscating Coffin","1d4","1","none","","","A coffin of white fire clamps shut on one visible creature within 120 feet. Deal Physical damage equal to the result. Extra targets in range split that total. Ordinary cover does not hide anyone you can already see. Only Magical Deflect against Spells: Attack reduces this. You may instead deal Mental damage; only Magical Deflect against Mental damage reduces that form. Instant."
"A02","Attack","The Thunderous Indictment","1d6","3","none","","","You speak a verdict and the air answers as a hammer. One visible creature within 100 feet takes Physical damage equal to the result. Extra targets split the total. Only Magical Deflect against Spells: Attack reduces this. You may instead deal Mental damage; only Magical Deflect against Mental damage reduces that form. Instant."
"A03","Attack","Brand of the Waiting Spark","1d6","4","none","","","A dim sigil settles on a visible creature within 60 feet. At the start of their next turn the sigil bursts and deals Physical damage equal to the result. Extra targets split the delayed total. Magical Deflect against Spells: Attack can spend itself against the brand before it opens. You may instead deal Mental damage. Instant once it discharges."
"A04","Attack","Chorus of Splintered Nerves","1d6","4","none","","","False pain sings along the nerves of a visible creature within 40 feet. Deal Mental damage equal to the result. This does not Control them. Extra targets split the total. Only Magical Deflect against Mental damage reduces this. Instant."
"A05","Attack","The Black Radiance","1d8","6","none","","","Darkness that still burns finds a creature you can hear within 60 feet. You need not see them. Deal Physical damage equal to the result. Extra targets split the total. Only Magical Deflect against Spells: Attack reduces this. You may instead deal Mental damage. Instant."
"A06","Attack","Damnation of the Inward Citadel","1d8","7","Willpower, and only if you spent 8 or more dots of Spell skill","","","You unbar the doors inside a visible creature within 60 feet. Deal Mental damage equal to the result. Extra targets split the total. Only Magical Deflect against Mental damage reduces this. If a target's Mental track is 0 or below, they are Controlled for a number of rounds equal to the Mental damage they actually took. They obey non-suicidal physical orders. They will not cast or plan for you. No chant is required."
"A07","Attack","The Particular Pyre","1d10","9","Constitution, and only if you spent 8 or more dots of Spell skill","","","A narrow column of heat finds a visible creature within 80 feet. Deal Physical damage equal to the result. After Magical Deflect against Spells: Attack and any Defy, leftover damage may be moved onto one other visible creature. You may instead deal Mental damage. Instant."
"A08","Attack","The Last Account","1d10","10","Constitution if Physical damage, Willpower if Mental damage — and only if you spent 8 or more dots of Spell skill","","","Choose Physical damage or Mental damage when you cast. One visible creature takes that damage equal to the result. Extra targets split the total. Matching Magical Deflect reduces it: Spells: Attack for Physical damage, or Mental damage for Mental damage. If this drops that track to 0, rest and ordinary medicine cannot restore it. Only magic or miracle can."
"A09","Attack","Decree of Ligneous Dissolution","1d12","12","none","","","Living wood, leaf, and fungus forget they were ever whole. Non-magical plant and fungus in a number of 5-foot cubes equal to the result, within 100 feet, slough to ash. You may instead spend the result as Physical damage against plant creatures in range, split if several. Enchanted plants are untouched. Only Magical Deflect against Spells: Attack reduces damage from this working."
"A10","Attack","The Wind of Final Repose","1d20","18","Constitution, and only if you spent 8 or more dots of Spell skill","","","A soundless bloom of still air opens in a 20-foot radius at a point within 200 feet. Living creatures in the radius split Physical damage equal to the result. A creature dropped to 0 Physical by this working sleeps until magic or miracle wakes them, or until they take any new Physical damage. Only Magical Deflect against Spells: Attack reduces this. You may instead deal Mental damage."
"A11","Attack","The Quiet Needle","1d4","1","none","","","A hair of light finds one visible creature within 40 feet. Deal Physical damage equal to the result. Extra targets split that total. Only Magical Deflect against Spells: Attack reduces this. You may instead deal Mental damage; only Magical Deflect against Mental damage reduces that form. Instant."
"A12","Attack","Ash on the Tongue","1d6","3","none","","","A visible creature within 60 feet tastes funeral ash. Deal Mental damage equal to the result. Extra targets split that total. This does not Control them. Only Magical Deflect against Mental damage reduces this. Instant."
"A13","Attack","The Hearth-Spite","1d6","4","none","","","A coal-bright spark strikes one visible creature within 80 feet. Deal Physical damage equal to the result. Extra targets split that total. Only Magical Deflect against Spells: Attack or Magical Deflect against Spells: Elementalism reduces this. You may instead deal Mental damage. Instant."
"P01","Protection","Aegis of Mortal Hide","1d4","1","none","","","Willing creatures, worn gear, a mount, a wagon, or one doorway within 30 feet. Split the result. Each subject gains Physical Deflect against Physical damage from weapons, falls, claws, weather, and ordinary fire. Ablative. Lasts a number of hours equal to dots of Spell skill spent. This does not stop Spells or Miracles, and it does not restore a lost track. You may instead grant Mental Deflect against Mental damage and mental maladies. Only magic or miracle ends it early."
"P02","Protection","Pall of Threefold Refraction","1d6","3","none","","","Willing creatures within 30 feet. Split the result. When you cast, choose Magical Deflect against Spells: Attack or Magical Deflect against Spells: Elementalism. Each subject gains that Deflect equal to their share. Full value on every matching hit. Lasts a number of rounds equal to dots of Spell skill spent."
"P03","Protection","Veil of the Inner Citadel","1d6","4","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Mental Deflect against Mental damage and mental maladies. Ablative. Lasts a number of hours equal to dots of Spell skill spent. This does not lift Control already in effect, and it does not restore a lost track. Only magic or miracle ends it early."
"P04","Protection","Bastion of the Named House","1d8","6","none","","","One building you stand in. When you finish, choose one school: Spells: Attack, Spells: Elementalism, Spells: Illusion, or Spells: Necromancy. The building gains Magical Deflect against that school equal to the result. Full value on each matching strike. Lasts a number of rounds equal to dots of Spell skill spent."
"P05","Protection","The Closed Eye","1d8","7","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Magical Deflect against Spells: Illusion and against information magic, including scrying, Flame Scrying, Elemental Spy, and forced questions, equal to their share. Full value. Lasts a number of rounds equal to dots of Spell skill spent."
"P06","Protection","Pall of the Quiet Blood","1d10","9","none","","","Willing creatures within 30 feet. Split the result. When you cast, choose Physical Deflect against Physical damage, both mundane and Spells: Attack, or Physical Deflect against poison and toxin. Ablative. Lasts a number of hours equal to dots of Spell skill spent. You may instead grant Mental Deflect against Mental damage and mental maladies. This does not cure a disease already seated. Only magic or miracle ends it early."
"P07","Protection","Veil of the Iron Hour","1d10","10","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Mental Deflect against Mental damage, mental maladies, and Miracles: Spirit that deal Mental damage. Ablative. Lasts a number of hours equal to dots of Spell skill spent. Only magic or miracle ends it early."
"P08","Protection","Aegis of the Deep Lung","1d12","12","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Physical Deflect usable only against drowning, smoke, vacuum, poison, toxin, and inhaled disease. Ablative. Lasts a number of hours equal to dots of Spell skill spent. This does not cure a disease already seated. You may instead grant Mental Deflect against mental maladies."
"P09","Protection","Wardpact of the March","1d12","13","none","","","A road, bridge, or trail you stand on, up to 10 feet of length per point of the result. Anyone you name who stays on that stretch shares one pool. When you cast, choose Physical Deflect against Physical damage, or Magical Deflect against Spells: Transmutation. Physical Deflect is ablative and lasts a number of hours equal to dots of Spell skill spent. Magical Deflect is full value and lasts a number of rounds equal to dots of Spell skill spent. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies instead."
"P10","Protection","Bastion of the Closed County","1d20","17","none","","","One building, or a circuit of buildings you can walk in an hour. When you finish, choose the protection: Physical Deflect against Physical damage, ablative, for a number of hours equal to dots of Spell skill spent; Magical Deflect against one Spell school you name, full value, for a number of rounds equal to dots of Spell skill spent; or Magical Deflect against Miracles: Warding and Miracles: Spirit, full value, for that many rounds. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies. Split a Deflect pool among the structures if you wish. The Living Well or The Vessel That Drinks may hitch only to an ablative pool."
"P11","Protection","The Thin Mantle","1d4","1","none","","","One willing creature you touch gains Physical Deflect equal to the result against Physical damage from weapons and falls. Ablative. Lasts a number of hours equal to dots of Spell skill spent. You may instead grant Mental Deflect against Mental damage and mental maladies. This does not restore a lost track."
"P12","Protection","Salt Against the Crawl","1d6","3","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Physical Deflect against poison, toxin, and mundane disease equal to their share. Ablative. Lasts a number of hours equal to dots of Spell skill spent. This does not cure a disease already seated. You may instead grant Mental Deflect against mental maladies."
"P13","Protection","Glass Against the Lie","1d8","6","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Magical Deflect against Spells: Illusion equal to their share. Full value on every matching working. Lasts a number of rounds equal to dots of Spell skill spent."
"E01","Elementalism","Elemental Spy","1d4","1","none","","","You teach a candle-flame, a stone, a cup of water, or a thread of smoke to keep your place. As a main action you may see and hear as if you stood there. Lasts a number of hours equal to the result, or until the focus is destroyed."
"E02","Elementalism","Flame Scrying","1d4","1","none","","","While you stay still, every open flame within 10 feet per point of the result becomes a window. You may look and listen through one flame at a time. Lasts a number of minutes equal to the result."
"E03","Elementalism","Query of Stone and Tide","1d6","3","none","","","Set your palm to earth, stone, water, or open air. Ask one question that mass could have witnessed in the last day. The answer is short and without poetry. Enchanted matter keeps silent. Instant."
"E04","Elementalism","Decree of Needed Substance","1d6","4","none","","","You pull a useful measure of one mundane element: one bucket of water, one person-minute of air, one torch-flame, or one 5-foot square of packed earth per point of the result. Water and earth remain. Flame lasts a number of hours equal to dots of Spell skill spent unless it is fed. Air is spent as it is breathed."
"E05","Elementalism","Elemental Favor","1d6","4","none","","","At the end of the round, a number of 5-foot cubes equal to the result, made of non-magical earth, stone, water, fire, or air, move or reshape as you ask. If the new shape would stand without magic, it remains as ordinary matter. If it would not, it holds until magic or miracle takes it off."
"E06","Elementalism","The Unpaid Messenger","1d8","6","none","","","A small elemental, whether a walking coal, a wet shape, a dust-thing, or a breath, does one concrete job it can finish in a number of minutes equal to the result. It may carry a letter, hold a door, or quench a hearth. It will not fight. Then it is gone."
"E07","Elementalism","Pact of Stone and Sea","1d8","7","none","","","Willing visible creatures share this working; split the duration if several are named. Each ignores mundane harm from one named element, earth, fire, water, or wind, including drowning, burial, or ordinary burning. This is not Deflect. Spells and Miracles still harm them. Lasts a number of minutes equal to the result."
"E08","Elementalism","The Burrower Below","1d10","9","none","","","The ground remembers a hallway. Open a tunnel a number of feet equal to the result through natural earth or stone, or one-fifth of that length through worked stone. You choose the path. The hole remains as ordinary earthwork."
"E09","Elementalism","Elemental Vallation","1d12","12","none","","","Raise a wall a number of feet long equal to the result, 10 feet high, within 80 feet. An earth wall must be dug; a man-sized hole needs 10 plus dots of Spell skill spent in damage from tools. A creature forcing a fire, water, or air wall takes Physical damage equal to the result, split if several cross together. Only Magical Deflect against Spells: Elementalism stops that crossing damage. You may instead deal Mental damage. The wall lasts a number of rounds equal to dots of Spell skill spent."
"E10","Elementalism","Like the Stones","1d12","13","none","","","You need not breathe for a number of rounds equal to the result. Choose one form. Stone grants Physical Deflect against Physical damage equal to the result, ablative, lasting a number of hours equal to the result; you may set this as Mental Deflect against Mental damage and mental maladies instead. Water lets you pass any gap a mouse could use for a number of rounds equal to dots of Spell skill spent. Air lets you fly at walking speed for that many rounds. Fire deals 1 mundane Physical damage to creatures in reach at the start of your turn for that many rounds; Physical Deflect can stop that, and Magical Deflect cannot."
"E11","Elementalism","The Honest Wick","1d4","1","none","","","A torch, lamp, or small hearth you touch burns clean for a number of hours equal to the result without new fuel. Wind may still put it out. This does not deal damage."
"E12","Elementalism","Where the Water Sleeps","1d4","1","none","","","You know the direction of the nearest natural water within a number of feet equal to 50 times the result. You do not learn its depth or its purity."
"E13","Elementalism","The Patient Ember","1d6","4","none","","","Non-magical fire in a number of 5-foot squares equal to the result, within 40 feet, sinks to coals for a number of minutes equal to dots of Spell skill spent. It does not spread during that time. Enchanted fire is untouched."
"T01","Transmutation","Velocitous Imbuement of the Unburdened Step","1d4","1","none","","","Willing creatures you touch, or that stand within 30 feet, double their ground speed. They may run on walls or beams if they finish on stable footing. Lasts a number of rounds equal to the result. Extra targets split the result for duration."
"T02","Transmutation","The Excellent Transpicuous Transformation","1d6","3","none","","","Willing creatures within 30 feet, and the gear they wear, turn glass-clear. Blows against them take a penalty of 4, or your table's equivalent. A charge, a hard fall, or a gestured spell ends it for that person. Lasts a number of minutes equal to the result, split if several are named."
"T03","Transmutation","Like the Borrowed Hide","1d6","4","none","","","Willing creatures within 30 feet each gain one gift: the breath of a fish, the grip of a beetle, the eyes of a cat, or Physical Deflect against Physical damage equal to their share of the result. That Deflect is ablative and lasts a number of hours equal to dots of Spell skill spent. You may set it as Mental Deflect against Mental damage and mental maladies. Breath, grip, and eye last a number of minutes equal to the result. This does not restore a lost track."
"T04","Transmutation","Conjunction of the Inexorable Step","1d8","6","none","","","You and willing creatures within 30 feet appear at a visible, safe, solid point within a number of feet equal to 10 times the result. Extra bodies split the distance. Instant."
"T05","Transmutation","The Long Unpacking of the Form","1d8","7","none","","","Willing targets become mundane animals no larger than themselves. Gear folds inward. Speech or a killing blow ends the change for that person. Lasts a number of minutes equal to the result, split if several are named."
"T06","Transmutation","Wardpact of Harmless Steel","1d10","9","none","","","A number of weapons within 60 feet equal to dots of Spell skill spent refuse to injure. Claws and teeth ignore this. Lasts until magic or miracle takes it off."
"T07","Transmutation","The Jade Palanquin, Lesser","1d10","10","none","","","A floating seat of pale stone appears. Assign the result as people, counting 1 each, or as pounds, counting 100 each. It moves at walking speed. Lasts a number of hours equal to dots of Spell skill spent, or until someone strikes the seat in anger."
"T08","Transmutation","Conjunction of the Second Pace","1d12","12","none","","","This works as Conjunction of the Inexorable Step, and then makes a second translation at once, using half the remaining result as feet times 10. Instant."
"T09","Transmutation","Calculation of the Evoked Beast","1d20","16","none","","","You must spend at least 4 dots of Spell skill. The result is the allotment. Split it equally across Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction, Hide, Instinct, Base Damage, Movement, and the beast's Stamina. Drop the remainder. One beast appears. A new cast dismisses the old beast. It lasts until it is slain, dismissed, or dawn."
"T10","Transmutation","The Excellent Exchange of Mass","1d12","13","none","","","Swap two willing visible creatures within 10 feet per point of the result, or swap one willing creature and one unattended object of like bulk. Extra pairs split the range. Instant."
"T11","Transmutation","The Mended Strap","1d4","1","none","","","One mundane object you touch, no larger than a door, has a break, tear, or loose joint made whole. This does not restore a magic item, a corpse, or living flesh. Instant."
"T12","Transmutation","Light as Chaff","1d6","3","none","","","One willing creature you touch, and the gear they wear, weigh half as much for a number of minutes equal to the result. They are not harder to hit. Extra willing targets split the duration."
"T13","Transmutation","The Closed Mouth of Steel","1d8","6","none","","","One weapon within 30 feet cannot draw blood for a number of rounds equal to dots of Spell skill spent. Claws and teeth ignore this. You may name extra weapons up to dots of Spell skill spent; they share that duration."
"N01","Necromancy","Query the Skull","1d4","1","none","","","Touch a corpse dead no more than a number of days equal to the result. It answers a number of short, literal questions equal to dots of Spell skill spent. The same corpse will not do this twice."
"N02","Necromancy","Terrible Liveliness","1d6","3","none","","","Undead already loyal to you, a number up to your dots of Spell skill, wear the faces they had in life. The mask lasts until you drop it, or until magic or miracle strips it."
"N03","Necromancy","Smite the Dead","1d6","4","none","","","A pale shock strikes a point within 80 feet and fills a 20-foot radius. Split Physical damage equal to the result among undead only. Living creatures are untouched. Only Magical Deflect against Spells: Necromancy reduces this. You may instead deal Mental damage."
"N04","Necromancy","Command the Hollow","1d8","6","Willpower, and only if you spent 8 or more dots of Spell skill","","","Deal Mental damage equal to the result to undead only, within 80 feet, and split it if several are named. Only Magical Deflect against Mental damage, or Magical Deflect against Spells: Necromancy, reduces this. An undead whose Mental track hits 0 is bound as if you had raised it. On a raising, every 5 points of the result add +1 to every rating on that husk, or buy one special: fearless, silent tread, tireless grip, semblance of life, or armored bones. They last until you raise a new batch, unless you pay 1 stamina for each old husk you keep."
"N05","Necromancy","The Borrowed Pulse","1d6","4","none","","","A willing living donor you touch loses Physical equal to the result. A living or undead recipient you touch gains the same amount, up to their cap. You may be the donor. There are no unwilling targets. Extra donors or recipients split the result. This is a transfer, not a restoration. You may instead move Mental. Instant."
"N06","Necromancy","Evocation of the Grave-Born Host","1d8","7","none","","","Touch intact corpses. Every 5 points of the result add +1 to every rating on that husk, or buy one special: fearless, silent tread, tireless grip, semblance of life, or armored bones. Several corpses split those steps. They last until you raise a new batch, unless you pay 1 stamina for each old husk you keep."
"N07","Necromancy","Final Death","1d10","9","Constitution, once, and only after the first failed attempt to heal them","","","Name visible living creatures, up to a number equal to dots of Spell skill spent. They cannot recover Physical by rest or ordinary medicine. Only magic or miracle restores them, or a successful Defy after that first failed healing. If they never try to heal, the ban lasts a number of rounds equal to dots of Spell skill spent. You may instead bar recovery of Mental."
"N08","Necromancy","Festering Curse","1d10","10","Constitution — only if the target's relevant scores sit in a higher band than yours","","","Name visible living creatures, up to a number equal to dots of Spell skill spent. Food is ash. Water does not slake. Pleasures go numb. They take a penalty of 2 on social work. This deals no damage. You may instead lay the same curse as a mental malady. It lasts until magic or miracle takes it off, or until you lift it."
"N09","Necromancy","Compel Flesh","1d12","12","Physique, at the start of each of their turns","","","Name living creatures or embodied undead, up to a number equal to dots of Spell skill spent, each within 100 feet. The body obeys non-suicidal physical orders. The mind is free. A successful Defy ends it for that body, and they take mundane Physical damage equal to your dots of Spell skill. Physical Deflect against Physical damage can reduce that damage. Magical Deflect cannot. If the working is not thrown off, it lasts a number of rounds equal to dots of Spell skill spent."
"N10","Necromancy","Forgetting the Grave","1d12","13","none","","","Willing creatures, up to a number equal to dots of Spell skill spent, do not die for 1 plus dots of Spell skill spent rounds. When the working ends, the postponed collapse arrives unless The Borrowed Pulse has already paid it. This is a hold, not a restoration."
"N11","Necromancy","The Grave-Sense","1d4","1","none","","","You know the direction of the nearest human corpse within a number of feet equal to 20 times the result. You do not learn its name or how it died."
"N12","Necromancy","Dust on the Lid","1d6","4","none","","","One corpse you touch will not rise, and will not answer another working, for a number of hours equal to the result. A later working whose result beats this result may still take it."
"N13","Necromancy","The Short Lease","1d8","7","none","","","Touch one intact corpse. It rises with +1 to every rating for every 5 points of the result, and it obeys simple orders. It falls still after a number of rounds equal to dots of Spell skill spent. It does not count as a kept host."
"I01","Illusion","Phantasmal Mimesis","1d4","1","none","","","Fill a number of 5-foot cubes equal to the result, within 60 feet, with sight, sound, and smell. The cubes may sit together or apart. The image behaves as you intend while you can see it. Lasts a number of rounds equal to dots of Spell skill spent. A person with a hard reason to doubt may spend an action studying it, and then they know it is false. This does not deal damage."
"I02","Illusion","Damnation of the Sense","1d6","3","Intuition, and only if you spent 8 or more dots of Spell skill","","","Name visible creatures, up to a number equal to dots of Spell skill spent. One sense on each creature, sight, hearing, or touch, is lied to or blanked for a number of rounds equal to your dots of Spell skill. If they Defy, the lie lasts only until the end of their next turn. This does not deal damage."
"I03","Illusion","The Excellent Crowd of No One","1d6","4","none","","","Willing creatures within 30 feet, up to a number equal to dots of Spell skill spent, are easy to miss by eye and ear. Touch, a careful search, a sprint, or an attack ends it for that person. Lasts a number of minutes equal to the result. This does not deal damage."
"I04","Illusion","The Inexorable Imputation","1d8","6","Intellect — only if the sentence is dangerous to believe","","","Speak one short sentence. Hearers within 40 feet treat it as true unless it is impossible. You may exempt a number of hearers up to your dots of Spell skill. The belief lasts until magic or miracle clears it. This does not deal damage."
"I05","Illusion","Casting Forth the False Room","1d8","7","none","","","The space you stand in, up to 5 feet per point of the result on a side, looks and sounds like a different place of the same size. Lasts a number of minutes equal to dots of Spell skill spent. Anyone who tests a surface with real force sees through it. This does not deal damage."
"I06","Illusion","Phantasmal Watchman","1d8","7","none","","","False figures, a number up to dots of Spell skill spent, each walk a path within 60 feet. They cannot injure anyone. Lasts a number of hours equal to the result, split among the figures if you wish. This does not deal damage."
"I07","Illusion","The Long Lie of the Face","1d10","9","none","","","Willing creatures, up to a number equal to dots of Spell skill spent, wear other human faces and voices. Lasts a number of hours equal to the result, split if several are named, or until that person draws blood. This does not deal damage."
"I08","Illusion","The Inexorable Hour","1d12","12","Intellect, and only if you spent 8 or more dots of Spell skill","","","Hearers within 40 feet believe one hour of false memory that you state in a sentence or two. An impossible hour fails. The memory lasts until magic or miracle clears it. This does not deal damage."
"I09","Illusion","Palace That Is Not","1d12","13","Intuition — only if they shove a wall or floor with full force","","","Lay a false interior over real space, up to 5 feet per point of the result on a side. It has sight, sound, smell, heat, and texture. None of it can injure. A painted fire does not burn. If someone puts their weight into a surface and Defies, they understand that the palace is hollow. Lasts a number of hours equal to dots of Spell skill spent."
"I10","Illusion","The Long Masque of the City","1d20","18","none","","","Lay a false street, court, or quarter over real ground, up to 10 feet per point of the result on a side. It follows the same rules as Palace That Is Not. Lasts a number of hours equal to dots of Spell skill spent. Only magic or miracle ends it early."
"I11","Illusion","The Footstep That Was Not","1d4","1","none","","","For a number of rounds equal to dots of Spell skill spent, your steps make no sound. A person who watches you walk still sees you. This does not deal damage."
"I12","Illusion","Borrowed Shade","1d6","3","none","","","You, or one willing creature you touch, are easy to miss in dim light for a number of minutes equal to the result. Bright light, a shout, or an attack ends it. This does not deal damage."
"I13","Illusion","The Unspent Coin","1d8","6","none","","","One object you touch, no larger than a chest, looks like another mundane object of similar size for a number of hours equal to dots of Spell skill spent. A person who handles it with intent learns the truth. This does not deal damage."
"R01","Ritual Magic","The Seal of Amber","1d6","3","none","10 minutes, or one night if you name more than one body","A volunteer loses 4 Physical, or apprentices pay 10 stamina each.","Name willing or helpless bodies, up to your dots of Spell skill. They enter stasis: they do not age, they do not breathe, ordinary weapons do not bite, and they are light enough to carry. Lasts a number of hours equal to the result, split among the bodies if you wish. Pay stamina across the clock. Roll when the clock finishes. If the clock breaks, a Magic check returns half of your stamina. This is a hold, not a restoration."
"R02","Ritual Magic","The Amber Archive","1d6","4","none","8 hours","The original you will lose, and one of: 2 Physical of your blood, an apprentice's 15 stamina, or an old library.","The rite makes a crystal copy that ordinary fire, damp, and time will not eat. It lasts a number of years equal to the result. Pay stamina across the clock. Roll when the clock finishes. If the clock breaks, a Magic check returns half of your stamina."
"R03","Ritual Magic","Decree Upon the Weather","1d8","6","none","3 hours, or 8 hours if you want days instead of hours","Open sky, and a choir paying stamina or Physical bled from willing donors (8 Physical for the short clock, 15 for the long).","Set one weather, rain, clear sky, frost, or still air, in a radius of 50 feet per point of the result, or 100 feet per point on the long clock. It lasts a number of hours equal to dots of Spell skill spent, or a number of days equal to your dots of Spell skill on the long clock. Only magic or miracle clears it early. You cannot aim a bolt with this rite."
"R04","Ritual Magic","Vallation of the Closed Horizon","1d8","7","none","1 hour, or dusk to dusk for a moon-long wall","Three payers into the working, or an ox, or an old stone circle. The long clock also needs a standing stone raised that night and a living well.","Raise a circuit 10 feet long per point of the result, or 20 feet per point on the long clock, and 12 feet high. When you finish, choose ablative Physical Deflect against Physical damage, lasting a number of hours equal to dots of Spell skill spent, or Magical Deflect against Spells: Attack and Spells: Elementalism, full value, lasting a number of rounds equal to dots of Spell skill spent. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies. An earth line must be dug. A creature crossing fire, water, or air takes Physical damage equal to the result, split among those who cross together. Only Magical Deflect against Spells: Elementalism stops that damage. If you chose an ablative pool, each discharge also eats the pool. The Living Well or The Vessel That Drinks may hitch to an ablative pool. The short clock ends at dawn if anything remains. The long clock ends at the next full moon if anything remains. Only magic or miracle ends it earlier."
"R05","Ritual Magic","Rite of the Fed Servitor","1d8","7","none","4 hours","A corpse, and two apprentices paying stamina.","Raise one or more undead. Every 5 points of the result add +1 to every rating on that husk, or buy one special: fearless, silent tread, tireless grip, semblance of life, or armored bones. They last until the next new moon if fed 5 stamina each dusk. A hitched Living Well or Vessel That Drinks may pay that feed. Otherwise they last until you raise a new batch."
"R06","Ritual Magic","Calculation of the High Servitor","1d20","16","none","6 hours","A beast or condemned body as clay, and four apprentices paying in, or a rare reagent.","You must spend at least 6 dots of Spell skill. One beast is made. Split the result equally across Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction, Hide, Instinct, Base Damage, Movement, and the beast's Stamina. Drop the remainder. Feed it 5 stamina at dusk, or it lasts only until the new moon."
"R07","Ritual Magic","Extirpate Arcana","1d10","9","Magic — only if the target working's caster has dots of Spell skill in a higher band than yours","10 minutes","Salt, iron, or running water on the site.","End one lasting magical effect you can see or touch, including a working that lasts until magic or miracle. The result must at least match the original working's result, or the original dots of Spell skill spent times 4 if that result is unknown."
"R08","Ritual Magic","The Closed Sanctum","1d10","10","none","3 hours","Four walls and a roof, and two people paying stamina.","Ward one room or small house. Split the result between ablative Physical Deflect against Physical damage, lasting a number of hours equal to dots of Spell skill spent, and Magical Deflect against Spells: Illusion and information magic, full value, lasting a number of rounds equal to dots of Spell skill spent. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies. The Living Well or The Vessel That Drinks may hitch to the Physical Deflect pool only."
"R09","Ritual Magic","Casting Forth the Far Voice","1d12","12","none","1 hour","A token the listener has touched.","Speak to one known living creature within a number of miles equal to the result. They hear you for a number of minutes equal to dots of Spell skill spent. You do not see them."
"R10","Ritual Magic","Conjunction of the Standing Gate","1d20","18","none","dusk to dusk","Two prepared doorways, a living well, and 20 Physical from willing donors in total, or a dozen laborers paying 5 each.","Two marked doorways open onto each other. Anyone may pass. Give the result to the gate as ablative Physical Deflect against Physical damage from a smash, lasting a number of hours equal to dots of Spell skill spent, or as Magical Deflect against Spells: Transmutation, full value, lasting a number of rounds equal to dots of Spell skill spent. The gate lasts until that defense is gone, or until magic or miracle closes it. The Living Well or The Vessel That Drinks may hitch to an ablative setting."
"R11","Ritual Magic","The Living Well","1d8","6","none. Unwilling targets do not opt out.","10 minutes","A bowl, pit, or marked stone, and at least one willing living creature. You may be that creature.","Name living creatures you can see or touch, up to one per dot of Spell skill. Willing and unwilling creatures both bind when the clock ends. An unwilling creature gets no Defy and cannot refuse. A willing creature names a stamina stake, up to what they have. An unwilling creature's stake is their current stamina in full. Hitch the well to one standing working that uses an ablative pool. Magical Deflect cannot drink a well. When the hitch is struck, drain bound stamina first. A body at 0 stamina stays bound, and further drain is Physical damage. Physical Deflect against Physical damage can reduce that damage. Magical Deflect cannot. Then the hitch's own pool is eaten, and then the hitch ends. An unwilling creature cannot leave. The well ends when any willing participant leaves or dies, when the hitch ends, when magic or miracle breaks this working, or when a body is bound to a new well. If the last willing participant dies to the well's own Physical damage, the well ends and the unwilling survivors are free. If the clock breaks, a Magic check returns half of the stamina you spent. No one is bound."
"R12","Ritual Magic","The Vessel That Drinks","1d12","13","none. Unwilling targets do not opt out.","dusk to dusk","One finished object that will hold the working, such as a bowl, ring, stone, blade, or door-iron, and at least one willing living creature bound at the close. You may be that creature.","The object becomes a drinking vessel. It does nothing until you hitch it to an ablative pool. Magical Deflect cannot drink from this item. When the clock ends, name living creatures you can see or touch, up to one per dot of Spell skill, including the required willing body. They bind to the item. An unwilling creature gets no Defy and cannot refuse. A willing creature names how much stamina the item may take. An unwilling creature's stake is their current stamina in full. While the vessel is hitched, a blow drains stamina from the bound, then Physical damage from bodies at 0 stamina. Physical Deflect against Physical damage can reduce that damage. Then the hitch pool is eaten, and then the hitch ends. The item remains. You may hitch it again as a main action if a willing creature is still bound to it. Distance does not free anyone. An unwilling creature cannot leave. This item-working ends when any willing participant bound to the item leaves or dies. Magic, miracle, or destruction of the object frees everyone. The result is the hold: the most stamina, and then Physical damage, the item can pull in a single blow. Demand above the hold goes to the hitch pool. The object stays a vessel until magic, miracle, or destruction. Bindings last only while a willing participant remains bound. If the clock breaks, a Magic check returns half of the stamina you spent. The object is ordinary, and no one is bound."
"R13","Ritual Magic","The Night-Seal","1d4","1","none","10 minutes","A marked door and a pinch of salt.","One door, hatch, or gate you touch will not open for anyone but you and a number of people you name equal to dots of Spell skill spent. It lasts a number of hours equal to the result. A working whose result beats this result may still force it. Pay stamina across the clock. If the clock breaks, a Magic check returns half of your stamina."`;

const SPELLS = parseCsvWithHeader(FANTASY_SPELLS_CSV).map((r) => ({
  id: r.id,
  school: r.school,
  name: r.name,
  cost: r.cost,
  dotsRequired: Number(r['Dots Reqd']) || 0,
  defy: r.defy === 'none' ? '' : r.defy,
  clock: r.clock,
  crutch: r.crutch,
  description: r.full_description,
}));

const SPELL_SCHOOLS = [...new Set(SPELLS.map((s) => s.school))].sort();

// Spells aren't purchased with the shared class-point pool — instead every
// Adept rank grants exactly one learnable-spell slot. Every spell is visible
// once 1+ ranks are in Adept, regardless of current Focus, but only as many
// can be *known* at once as Adept ranks allow. Magic itself is gated by the
// character's independent magicEnabled toggle, not by genre — a player can
// "genre-bend" magic onto any setting, or turn it off even in Fantasy.
function hasSpellAccess(character) {
  return character.magicEnabled && (character.classDots.Adept || 0) >= 1;
}

// If the character owns the "Extra Spell" special, every Adept dot gained
// after acquiring it grants an extra bonus slot on top of its normal one
// (dots held before acquiring it don't retroactively grant the bonus).
function getSpellSlotCountForRank(character, rank) {
  const extraSpell = SPECIALS.find((s) => s.name === 'Extra Spell');
  if (extraSpell && isSpecialOwned(character, extraSpell)) {
    const baseRank = character.extraSpellBaseRank || 0;
    return rank + Math.max(0, rank - baseRank);
  }
  return rank;
}

function getSpellSlotCount(character) {
  return getSpellSlotCountForRank(character, character.classDots.Adept || 0);
}

function getSpellsLearnedCount(character) {
  return SPELLS.reduce((sum, spell) => sum + (isSpellLearned(character, spell) ? 1 : 0), 0);
}

// A Spell/Miracle entry's school maps directly to a "Spell: X"/"Miracle: X"
// Skill of the same name — its effective rank (free auto-min + paid ranks,
// same as any other Skill) must meet the entry's dotsRequired before it can
// be learned. Entries with no matching Skill, or no requirement, are never
// blocked by this check.
function meetsCastingDotsRequirement(character, entry, prefix) {
  if (!entry.dotsRequired) return true;
  const skill = SKILLS.find((s) => s.name === `${prefix}: ${entry.school}`);
  if (!skill) return true;
  return getSkillEffectiveRank(character, skill) >= entry.dotsRequired;
}

function canLearnSpell(character, spell) {
  return meetsCastingDotsRequirement(character, spell, 'Spell')
    && getSpellsLearnedCount(character) < getSpellSlotCount(character);
}

function isSpellLearned(character, spell) {
  return !!character.spellsLearned[spell.id];
}

// Learning a spell is free (no shared-pool point cost, unlike Skills/
// Weapons/Specials) but capped by getSpellSlotCount — forgetting a spell
// always frees its slot back up.
function toggleSpellLearned(character, spell) {
  const learned = isSpellLearned(character, spell);
  if (!learned && !canLearnSpell(character, spell)) return;
  character.spellsLearned[spell.id] = !learned;
}

// ---------------------------------------------------------------------------
// Miracles (data/miracle.csv). Same rules as Spells above, but for Shepherd:
// a reference grimoire, visible once 1+ ranks are in Shepherd, with a free
// learned/not-learned toggle per entry (no point cost).
// ---------------------------------------------------------------------------

const FANTASY_MIRACLE_CSV = `"id","school","name","cost","Dots Reqd","defy","clock","crutch","full_description"
"PN01","Necromancy","Last Office of the Dead","1d4","1","none","","","Touch a corpse. Decay pauses, and vermin leave the cloth. The body cannot be raised by any working cheaper than 1d8 until this office ends. It lasts a number of days equal to the result. Only magic or miracle ends it early."
"PN02","Necromancy","Query the Consecrated Skull","1d4","1","none","","","Touch a corpse dead no more than a number of days equal to the result, if it has received some rite of rest, even a hurried one. It answers a number of short, literal questions equal to dots of Miracle skill spent. The same corpse will not do this twice. The answers tend toward what the dead believed at the end."
"PN03","Necromancy","Smite the Unquiet","1d6","3","none","","","A pale shock strikes a point within 80 feet and fills a 20-foot radius. Split Physical damage equal to the result among undead only. Living creatures are untouched. Only Magical Deflect against Miracles: Necromancy, or against Spells: Necromancy, reduces this. You may instead deal Mental damage."
"PN04","Necromancy","Still the Walking Corpse","1d6","4","none","","","One visible undead within 60 feet takes Physical damage equal to the result. Extra targets split the total. Only Magical Deflect against Miracles: Necromancy reduces this. You may instead deal Mental damage."
"PN05","Necromancy","The Peaceful Mask","1d8","6","none","","","Undead already bound to you, or lying at rest, a number up to your dots of Miracle skill, appear as they did in honest sleep or in ordinary life. The mask lasts until you drop it, or until magic or miracle strips it."
"PN06","Necromancy","Evocation of the Ancestor Host","1d8","7","none","","","Touch intact corpses you name as kin, parish dead, or sworn dead. Every 5 points of the result add +1 to every rating on that husk, or buy one special: fearless, silent tread, tireless grip, semblance of life, or armored bones. Several corpses split those steps. They obey the priest. They last until you raise a new batch, unless you pay 1 stamina for each old husk you keep."
"PN07","Necromancy","The Hallowed Grave","1d10","9","none","","","Consecrate one grave, pyre-place, or tomb you can touch. A working that tries to raise from it fails unless its result beats this result. The hallow lasts until magic or miracle breaks it."
"PN08","Necromancy","Final Peace","1d10","10","Constitution — only if the target undead's maker has dots of Spell skill or Miracle skill in a higher band than yours","","","Name visible undead, up to a number equal to dots of Miracle skill spent. They cannot recover Physical by rest or ordinary mending. Only magic or miracle restores them. If this drops one to 0 Physical, it will not rise again unless a working of 1d12 or greater is used. You may instead bar recovery of Mental."
"PN09","Necromancy","Compel the Unquiet Bones","1d12","12","Physique, at the start of each of their turns","","","Name embodied undead, up to a number equal to dots of Miracle skill spent, each within 100 feet. The body obeys non-suicidal physical orders. The mind, if any, is free. A successful Defy ends the working for that body, and they take mundane Physical damage equal to your dots of Miracle skill. Physical Deflect against Physical damage can reduce that damage. Magical Deflect cannot. If the working is not thrown off, it lasts a number of rounds equal to dots of Miracle skill spent."
"PN10","Necromancy","The Last Trump","1d20","18","Bravery, and only if you spent 8 or more dots of Miracle skill","","","Sound a call in a 20-foot radius at a point within 100 feet. Undead in the radius split Physical damage equal to the result. Any undead dropped to 0 Physical by this working fall still, and they cannot be raised except by a 1d20 magic or miracle. Living creatures in the radius are untouched. Only Magical Deflect against Miracles: Necromancy reduces this. You may instead deal Mental damage."
"PN11","Necromancy","Hush the New Grave","1d4","1","none","","","One corpse you touch will not rise for a number of days equal to the result. A later working whose result beats this result may still take it."
"PN12","Necromancy","Name the Sleeper","1d6","3","none","","","Touch a corpse dead no more than a number of days equal to the result. You learn the name it answered to in life, if it had one, and the rough manner of its death. You do not learn its secrets."
"PN13","Necromancy","The Parish Watch","1d8","6","none","","","One visible undead within 40 feet takes Physical damage equal to the result. Extra undead split that total. Living creatures are untouched. Only Magical Deflect against Miracles: Necromancy reduces this. You may instead deal Mental damage; only Magical Deflect against Mental damage reduces that form."
"PR01","Ritual Magic","Vigil of Amber Rest","1d6","3","none","10 minutes, or one night if you name more than one body","A candle that burns the whole clock, and a willing watcher. You may be that watcher.","Name willing or helpless bodies, up to your dots of Miracle skill. They enter sacred stasis: they do not age, they do not breathe, ordinary weapons do not bite, and they are light enough to carry. Lasts a number of hours equal to the result, split among the bodies if you wish. You may instead hold a mental malady still for those hours. Pay stamina across the clock. Roll when the clock finishes. If the clock breaks, a Magic check returns half of your stamina."
"PR02","Ritual Magic","The Reliquary","1d6","4","none","8 hours","A relic, bone, cloth, or written prayer you will seal, and one of: 2 Physical of your blood, a congregation's 15 stamina, or a place that has held worship for a generation.","Seal the offering in crystal or iron that ordinary fire, damp, and time will not eat. It lasts a number of years equal to the result. Pay stamina across the clock. If the clock breaks, a Magic check returns half of your stamina."
"PR03","Ritual Magic","Weather of the Parish","1d8","6","none","3 hours, or 8 hours if you want days instead of hours","Open sky over consecrated or claimed ground, and a choir paying stamina, or 8 Physical from willing donors, 15 on the long clock.","Set one weather, rain, clear sky, frost, or still air, in a radius of 50 feet per point of the result, or 100 feet per point on the long clock. It lasts a number of hours equal to dots of Miracle skill spent, or a number of days equal to your dots of Miracle skill on the long clock. Only magic or miracle clears it early. You cannot aim a bolt with this rite."
"PR04","Ritual Magic","Consecration of the Closed Horizon","1d8","7","none","1 hour, or dusk to dusk for a moon-long bound","Three worshippers paying stamina, or an offering animal, or old holy ground. The long clock also needs a standing stone or altar raised that night.","Raise a circuit 10 feet long per point of the result, or 20 feet per point on the long clock, and 12 feet high. Choose ablative Physical Deflect against Physical damage, lasting a number of hours equal to dots of Miracle skill spent, or Magical Deflect against Spells: Attack and Miracles: Necromancy, full value, lasting a number of rounds equal to dots of Miracle skill spent. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies. A creature crossing the bright line takes Physical damage equal to the result, split among those who cross together. Only Magical Deflect against Miracles: Warding stops that damage. An ablative pool may hitch The Offered Well or The Vessel of Offered Life. The short clock ends at dawn if anything remains. The long clock ends at the next full moon if anything remains. Only magic or miracle ends it earlier."
"PR05","Ritual Magic","Rite of the Temple Servitor","1d8","7","none","4 hours","A corpse given last office, and two worshippers paying stamina.","Raise one or more sacred dead. Every 5 points of the result add +1 to all ratings, or buy one special: fearless, silent tread, tireless grip, semblance of life, or armored bones. They last until the next new moon if fed 5 stamina each dusk. Otherwise they last until you raise a new batch."
"PR06","Ritual Magic","High Working of the Guardian Beast","1d20","16","none","6 hours","A living beast as clay, and four worshippers paying in, or a rare relic.","You must spend at least 6 dots of Miracle skill. One guardian beast is made. Split the result equally across Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction, Hide, Instinct, Base Damage, Movement, and the beast's Stamina. Drop the remainder. Feed it 5 stamina at dusk, or it lasts only until the new moon."
"PR07","Ritual Magic","Extirpate the Unholy","1d10","9","Magic — only if the target working's caster has dots of Spell skill or Miracle skill in a higher band than yours","10 minutes","Salt, iron, running water, or holy oil on the site.","End one lasting magical or unholy effect you can see or touch, including a working that lasts until magic or miracle. The result must at least match the original working's result, or the original dots spent times 4 if that result is unknown."
"PR08","Ritual Magic","The Hallowed Sanctum","1d10","10","none","3 hours","Four walls and a roof, and two worshippers paying stamina.","Ward one room or small house. Split the result between ablative Physical Deflect against Physical damage, lasting a number of hours equal to dots of Miracle skill spent, and Magical Deflect against Miracles: Spirit and information magic, full value, lasting a number of rounds equal to dots of Miracle skill spent. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies. The Offered Well or The Vessel of Offered Life may hitch to the Physical Deflect pool only."
"PR09","Ritual Magic","Far Prayer","1d12","12","none","1 hour","A token the listener has touched, or their true name spoken on consecrated ground.","Speak to one known living creature within a number of miles equal to the result. They hear you for a number of minutes equal to dots of Miracle skill spent. You do not see them."
"PR10","Ritual Magic","The Standing Threshold","1d20","18","none","dusk to dusk","Two prepared doorways on consecrated ground, an offered well, and 20 Physical from willing donors in total, or a dozen laborers paying 5 each.","Two marked doorways open onto each other. Anyone you permit may pass. Give the result to the gate as ablative Physical Deflect against Physical damage, lasting a number of hours equal to dots of Miracle skill spent, or as Magical Deflect against Spells: Transmutation, full value, lasting a number of rounds equal to dots of Miracle skill spent. The gate lasts until that defense is gone, or until magic or miracle closes it. The Offered Well or The Vessel of Offered Life may hitch to an ablative setting."
"PR11","Ritual Magic","The Offered Well","1d8","6","none","10 minutes","A bowl, font, pit, or marked stone, and at least one willing living creature. You may be that creature.","Name living creatures you can see or touch, up to one per dot of Miracle skill. Each must speak assent during the clock. Silence, fear, or a nod under a blade is not assent. There are no unwilling targets. A volunteer names how much stamina the well may take. They may also permit Physical damage after their stamina is gone. If they refuse that, the well skips them. Hitch the well to one standing working that uses an ablative pool. Magical Deflect cannot drink this well. Drain stamina first, then Physical damage only from those who permitted life. Physical Deflect against Physical damage can reduce that damage. Then the hitch pool is eaten, and then the hitch ends. You may take the Physical drain as Mental damage if the volunteer agreed to a mental malady instead. When any volunteer leaves or dies, the whole well ends. Magic or miracle also breaks it. If the clock breaks, a Magic check returns half of the stamina you spent. No one is bound."
"PR12","Ritual Magic","The Vessel of Offered Life","1d12","13","none","dusk to dusk","One finished object, such as a bowl, cup, ring, relic-bone, or door-iron, and at least one willing living creature bound at the close. You may be that creature.","The object becomes a vessel of offered life. It does nothing until you hitch it to an ablative pool. Magical Deflect cannot drink from it. Bind living creatures you can see or touch, up to one per dot of Miracle skill. Each must speak assent. They bind to the item. A volunteer names a stamina stake and may permit Physical damage, or Mental damage from a mental malady, after stamina is gone. Drain stamina, then permitted damage. Physical Deflect against Physical damage can reduce Physical damage. The result is the hold per blow. Demand above the hold goes to the hitch pool. The working ends when any volunteer bound to the item leaves or dies. The object stays a vessel until magic, miracle, or destruction. Bindings last only while a volunteer remains bound. If the clock breaks, a Magic check returns half of the stamina you spent. The object is ordinary, and no one is bound."
"PR13","Ritual Magic","The Short Vigil","1d4","1","none","10 minutes","A candle and a willing watcher.","One willing or helpless body enters light stasis for a number of hours equal to the result. They do not age, and ordinary weapons do not bite. You may instead hold a mental malady still for those hours. The malady returns when the vigil ends unless a curing miracle has cleared it. Pay stamina across the clock. If the clock breaks, a Magic check returns half of your stamina."
"PR14","Ritual Magic","Bread of the Morning","1d6","4","none","1 hour","A loaf, a bowl of water, and one worshipper paying stamina.","The meal feeds a number of people equal to the result as a full day's rations. Anyone who eats it restores Physical equal to dots of Miracle skill spent, up to their cap. You may instead restore Mental against exhaustion and mental maladies. This is not regrowth. Pay stamina across the clock. If the clock breaks, a Magic check returns half of your stamina."
"PH01","Healing","Balm of the Open Hand","1d4","1","none","","","Touch a living creature. Restore Physical equal to the result, up to their usual cap. You may instead ease a mental malady and restore Mental equal to the result. Extra targets split the result. Instant."
"PH02","Healing","Litany of the Walking Wound","1d4","1","none","","","Willing living creatures within 30 feet split the result as restored Physical, up to each cap. You may instead restore Mental against exhaustion and mental maladies. Instant."
"PH03","Healing","The Closed Cut","1d6","3","none","","","Touch a living creature. Restore Physical equal to the result and stop ordinary bleeding. Extra targets split the result. You may instead close a mental wound and restore Mental. Instant."
"PH04","Healing","Mercy of the Second Pulse","1d6","4","none","","","A living creature within 30 feet who is at 0 Physical, and not yet past the point of death, is restored Physical equal to the result, up to their cap. Extra such creatures split the result. You may instead restore Mental on a creature at 0 Mental. Instant."
"PH05","Healing","Anointing of Steady Flesh","1d8","6","none","","","Willing living creatures within 30 feet split the result. Each regains Physical equal to their share now, and the same amount again after a number of rounds equal to dots of Miracle skill spent, if they are still living. You may instead restore Mental against mental maladies."
"PH06","Healing","The Long Convalescence","1d8","7","none","","","Touch willing living creatures, up to a number equal to dots of Miracle skill spent. Restore Physical equal to the result, split among them. Then each recovers 1 Physical at dawn each day for a number of days equal to dots of Miracle skill spent. You may instead restore Mental. Only magic or miracle ends the daily recovery early."
"PH07","Healing","Mass of Open Hands","1d10","9","none","","","Living creatures within 30 feet, up to a number equal to dots of Miracle skill spent, split restored Physical equal to the result. You may instead restore Mental against mental maladies. Instant."
"PH08","Healing","The Unmaking of Mortal Ruin","1d10","10","none","","","Touch a living creature. Restore Physical equal to the result, and mend one mundane maiming: a broken bone set true, a ruined eye's pain quieted, or a severed finger's bleeding closed. This does not regrow a lost limb. You may instead mend one lasting mental malady and restore Mental. Instant."
"PH09","Healing","Forgetting the Threshold","1d12","12","none","","","Willing living creatures, up to a number equal to dots of Miracle skill spent, do not die for 1 plus dots of Miracle skill spent rounds. When the working ends, the postponed collapse arrives unless healing has already paid it. You may instead hold a mind at 0 Mental for the same time. This is a hold, not a restoration."
"PH10","Healing","The Great Restoration","1d20","19","none","","","Touch a living creature. Restore Physical equal to the result, up to their cap. If they were missing a mundane limb, eye, or organ lost within a number of days equal to dots of Miracle skill spent, it returns whole. Older losses are not restored. You may instead restore Mental and clear one mental malady of no greater strength than the result. Instant."
"PH11","Healing","The Steady Hand","1d4","1","none","","","Touch a living creature. Restore Physical equal to the result, up to their usual cap. You may instead ease a mental malady and restore Mental equal to the result. Extra targets split the result. Instant."
"PH12","Healing","Bread and Broth","1d6","3","none","","","Willing living creatures within 30 feet, up to a number equal to dots of Miracle skill spent, split restored Physical equal to the result. You may instead restore Mental against exhaustion and mental maladies. Instant."
"PH13","Healing","The Quiet Bed","1d8","7","none","","","One willing living creature you touch sleeps without pain for a number of hours equal to the result, and wakes with Physical restored equal to dots of Miracle skill spent. You may instead restore Mental. This is not regrowth."
"PC01","Curing","Water of Simple Fevers","1d4","1","none","","","Touch a living creature. End one ordinary fever, flux, or mild infection whose hold is no stronger than the result. You may instead ease one mild mental malady of the same strength. Extra targets split the result as the strength you spend on each. Instant."
"PC02","Curing","Cast Out the Venom","1d6","3","none","","","Touch a living creature. End mundane poison or toxin whose strength is no greater than the result. Extra targets split the result. You may instead clear a mental malady of the same strength. Instant."
"PC03","Curing","The Clean Lung","1d6","4","none","","","Willing living creatures within 30 feet split the result. Each is cleared of smoke, drowning-water, or mundane inhaled poison up to their share. You may instead clear an inhaled fright or mental malady of the same strength. Instant."
"PC04","Curing","Unbind the Worm","1d8","6","none","","","Touch a living creature. End one mundane disease or malady. If the disease is magical, the result must at least match the working that laid it, or dots of Miracle skill spent times 4 if that result is unknown. You may instead end one mental malady on the same terms. Instant."
"PC05","Curing","Sight and Hearing Returned","1d8","7","none","","","Touch a living creature. End mundane blindness, deafness, or numbness caused by injury, illness, or a working whose result this roll matches or beats. You may instead restore a sense lost to a mental malady. Instant."
"PC06","Curing","The Quieted Mind","1d10","9","Willpower — only if the madness was laid by a caster whose dots of Spell skill or Miracle skill are in a higher band than yours","","","Touch a living creature. End mundane terror, panic, or a magical mental working whose result this matches or beats. This does not lift Control that is still inside its listed rounds. Instant."
"PC07","Curing","Lift the Petty Curse","1d10","10","none","","","Touch a creature or object. End one lasting curse, blight, or malady whose result this matches or beats, or dots of Miracle skill spent times 4 if that result is unknown. You may instead lift a mental malady on the same terms. Instant."
"PC08","Curing","The Scouring of Plague","1d12","12","none","","","Living creatures within 30 feet, up to a number equal to dots of Miracle skill spent, each lose one named mundane plague, disease, or infection. Magical plague requires the result to match or beat the laying working. You may instead scour one mental malady from each. Instant."
"PC09","Curing","Break the Lasting Hex","1d12","13","Magic — only if the hex-layer's dots of Spell skill or Miracle skill are in a higher band than yours","","","One visible creature or object within 30 feet loses a lasting magical hex, geas, or blight, including one that lasts until magic or miracle. The result must match or beat the original result. You may instead break a lasting mental hex. Instant."
"PC10","Curing","Miracle of the Whole Flesh","1d20","19","none","","","Touch a living creature. End all mundane poison, toxin, disease, malady, blindness, deafness, and fever on them, and end one magical curse whose result this matches or beats. You may also clear one mental malady of no greater strength than the result. Instant."
"PC11","Curing","Cool the Brow","1d4","1","none","","","Touch a living creature. End one ordinary fever or mild malady whose hold is no stronger than the result. You may instead ease one mild mental malady of the same strength. Instant."
"PC12","Curing","The Cup That Clears","1d6","4","none","","","Touch a living creature. End mundane poison or toxin whose strength is no greater than the result. Extra targets split the result. You may instead clear a mental malady of the same strength. Instant."
"PC13","Curing","Parish Against the Cough","1d8","6","none","","","Living creatures within 30 feet, up to a number equal to dots of Miracle skill spent, each lose one mundane disease or malady whose hold is no stronger than the result, split among them. You may instead clear mental maladies of the same strength. Instant."
"PW01","Warding","Circle of the Humble Threshold","1d4","1","none","","","Willing creatures, objects, mounts, wagons, or one doorway within 30 feet split the result. Each subject gains Physical Deflect against Physical damage from weapons, falls, claws, weather, and ordinary fire. Ablative. Lasts a number of hours equal to dots of Miracle skill spent. This does not stop Spells or Miracles. You may instead grant Mental Deflect against Mental damage and mental maladies. Only magic or miracle ends it early."
"PW02","Warding","Litany Against the Blade","1d6","3","none","","","Willing creatures within 30 feet split the result. When you cast, choose Magical Deflect against Spells: Attack or Magical Deflect against Miracles: Necromancy. Each subject gains that Deflect equal to their share. Full value. Lasts a number of rounds equal to dots of Miracle skill spent."
"PW03","Warding","Veil of the Quiet Heart","1d6","4","none","","","Willing creatures within 30 feet split the result. Each subject gains Mental Deflect against Mental damage and mental maladies. Ablative. Lasts a number of hours equal to dots of Miracle skill spent. This does not lift Control already in effect. Only magic or miracle ends it early."
"PW04","Warding","Ward of the Named House","1d8","6","none","","","One building you stand in receives one choice: Magical Deflect against Spells: Elementalism, Magical Deflect against Spells: Illusion, or Magical Deflect against Miracles: Spirit. The building gains that Deflect equal to the result. Full value. Lasts a number of rounds equal to dots of Miracle skill spent."
"PW05","Warding","The Closed Grave-Line","1d8","7","none","","","Draw a line or circle 5 feet long per point of the result. Undead that try to cross take Physical damage equal to the result, split if several cross together. Only Magical Deflect against Miracles: Warding stops that damage. You may instead deal Mental damage. The line lasts a number of rounds equal to dots of Miracle skill spent."
"PW06","Warding","Pall of Sacred Blood","1d10","9","none","","","Willing creatures within 30 feet split the result. When you cast, choose Physical Deflect against Physical damage, both mundane and from Spells: Attack, or Physical Deflect against poison, toxin, and disease. Ablative. Lasts a number of hours equal to dots of Miracle skill spent. You may instead grant Mental Deflect against Mental damage and mental maladies. Only magic or miracle ends it early."
"PW07","Warding","The Spirit-Bar","1d10","10","none","","","Willing creatures within 30 feet split the result. Each subject gains Magical Deflect against Miracles: Spirit, possession, and information magic equal to their share. Full value. Lasts a number of rounds equal to dots of Miracle skill spent."
"PW08","Warding","Sanctuary of the Deep Breath","1d12","12","none","","","Willing creatures within 30 feet split the result. Each subject gains Physical Deflect usable only against drowning, smoke, vacuum, poison, toxin, and inhaled malady. Ablative. Lasts a number of hours equal to dots of Miracle skill spent. You may instead grant Mental Deflect against mental maladies."
"PW09","Warding","Wardpact of the Holy March","1d12","13","none","","","A road, bridge, or trail you stand on, up to 10 feet of length per point of the result, holds one shared pool for anyone you name who stays on that stretch. Choose Physical Deflect against Physical damage, ablative, lasting a number of hours equal to dots of Miracle skill spent, or Magical Deflect against Spells: Transmutation, full value, lasting a number of rounds equal to dots of Miracle skill spent. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies."
"PW10","Warding","Consecration of the Parish","1d20","17","none","","","Ward one building, or a circuit of buildings you can walk in an hour. Choose Physical Deflect against Physical damage, ablative, lasting a number of hours equal to dots of Miracle skill spent; Magical Deflect against one Spell school you name, full value, lasting a number of rounds equal to dots of Miracle skill spent; or Magical Deflect against Miracles: Spirit and Miracles: Necromancy, full value, for that many rounds. You may set Physical Deflect as Mental Deflect against Mental damage and mental maladies. The Offered Well or The Vessel of Offered Life may hitch to an ablative setting."
"PW11","Warding","The Door's Prayer","1d4","1","none","","","One doorway you touch holds Physical Deflect equal to the result. The first creature each round that forces the door spends the blow against that Deflect. Ablative. Lasts a number of hours equal to dots of Miracle skill spent. You may instead set Mental Deflect against Mental damage and mental maladies."
"PW12","Warding","Ash Against Night-Fear","1d6","3","none","","","Willing creatures within 30 feet split the result. Each subject gains Mental Deflect against Mental damage and mental maladies equal to their share. Ablative. Lasts a number of hours equal to dots of Miracle skill spent."
"PW13","Warding","Oil Against the Hex","1d8","6","none","","","Willing creatures within 30 feet split the result. When you cast, choose Magical Deflect against Spells: Necromancy or Magical Deflect against Miracles: Spirit. Full value. Lasts a number of rounds equal to dots of Miracle skill spent."
"PS01","Spirit","Whisper to the Near Shade","1d4","1","none","","","Speak to one visible spirit, ghost, or unbound dead within 30 feet. You understand each other for a number of minutes equal to the result. The spirit is not forced to answer truly."
"PS02","Spirit","The Kindled Lamp","1d4","1","none","","","You see spirits, unbound dead, and riding things within 10 feet per point of the result, and they appear as pale lamps. Lasts a number of minutes equal to dots of Miracle skill spent."
"PS03","Spirit","Query of the Unburied","1d6","3","none","","","Ask one short question of a spirit you can see. It answers literally if it knows the answer. An enchanted or bound spirit may refuse unless the result is 8 or more."
"PS04","Spirit","Dismissal of the Petty Haunt","1d6","4","none","","","One visible minor haunt, residual ghost, or place-echo within 60 feet is sent on. If its strength is greater than the result, it is only driven 10 feet off and silenced for a number of rounds equal to dots of Miracle skill spent."
"PS05","Spirit","The Anchored Soul","1d8","6","none","","","Willing living creatures within 30 feet, up to a number equal to dots of Miracle skill spent, cannot be ridden or pulled from the body by Miracles: Spirit or Spells: Necromancy whose result is less than this result. Lasts a number of hours equal to dots of Miracle skill spent. You may instead grant Mental Deflect against Mental damage and mental maladies, ablative, for the same hours. Only magic or miracle ends it early."
"PS06","Spirit","Exorcism of the Riding Thing","1d8","7","Willpower — only if the rider's maker, or the rider itself, has dots of Spell skill or Miracle skill in a higher band than yours","","","One visible living creature within 30 feet loses a spirit or dead thing that is riding them, if this result matches or beats the working that seated it, or dots of Miracle skill spent times 4 if that result is unknown. The host takes no damage from the expulsion."
"PS07","Spirit","Communion of the Ancestor","1d10","9","none","","","Name a dead person whose name you know. If any shade of them can hear, they speak with you for a number of minutes equal to dots of Miracle skill spent. They are literal, and they are limited to what they knew. You may do this once per named dead between dawns."
"PS08","Spirit","The Iron Name","1d10","10","Willpower, and only if you spent 8 or more dots of Miracle skill","","","One visible spirit within 60 feet takes Mental damage equal to the result. Only Magical Deflect against Mental damage, or Magical Deflect against Miracles: Spirit, reduces this. If its Mental track hits 0, it is bound to you for a number of rounds equal to the Mental damage it took, and it obeys non-suicidal commands."
"PS09","Spirit","Sending of the Lost","1d12","12","none","","","One willing spirit or unbound dead you can see is sent to rest. It will not haunt that place again unless it is called by a working of 1d12 or greater. Instant."
"PS10","Spirit","The Great Unhousing","1d20","18","Willpower, and only if you spent 8 or more dots of Miracle skill","","","Spirits and riding things in a 20-foot radius, at a point within 80 feet, split Mental damage equal to the result. Any dropped to 0 Mental are expelled, and they cannot re-enter a body in that radius until magic or miracle permits it. Living hosts take no Physical damage from this."
"PS11","Spirit","The Soft Word","1d4","1","none","","","One visible minor haunt within 30 feet is quiet for a number of minutes equal to the result. It does not answer, strike, or follow. A stronger spirit ignores this."
"PS12","Spirit","Lamp for the Lost","1d6","4","none","","","You see unbound dead within 10 feet per point of the result. Lasts a number of minutes equal to dots of Miracle skill spent. You do not command them."
"PS13","Spirit","Stay in the Body","1d8","7","none","","","One willing living creature you touch cannot be ridden by a spirit whose result is less than this result. Lasts a number of hours equal to dots of Miracle skill spent. You may instead grant Mental Deflect against Mental damage equal to the result, ablative, for the same hours."
"PA01","Animism","Speech of Fur and Feather","1d4","1","none","","","You speak with mundane beasts within 30 feet. They answer as beasts answer: want, fear, scent, and path. Lasts a number of minutes equal to the result."
"PA02","Animism","The Watching Beast","1d4","1","none","","","One mundane beast you touch will watch a place or a person and try to warn you by a cry or by returning. Lasts a number of hours equal to the result, or until the beast is badly hurt."
"PA03","Animism","Call of the Small Host","1d6","3","none","","","Mundane small beasts, such as birds, rats, or insects in a swarm, in a 20-foot radius within 60 feet, do one simple task: scatter, gather, harry, or leave. Lasts a number of rounds equal to dots of Miracle skill spent."
"PA04","Animism","Blessing of the Field","1d6","4","none","","","Bless a plot of earth 5 feet on a side per point of the result. Crops, grass, or orchard in it grow as if they had been given a good week, or a blight or malady whose result is less than this is lifted. The blessing is instant. The growth after that is ordinary. You may instead lift a mental malaise from the people who work that plot, if its strength is less than the result."
"PA05","Animism","Pact of Tooth and Root","1d8","6","none","","","Willing visible creatures share this working; split the duration if several are named. Each ignores mundane harm from one named natural source: thorn, cold water, ordinary beast-bite, or exposure. This is not Deflect. Spells and Miracles still harm them. Lasts a number of minutes equal to the result. You may instead shield them from a mental malady born of fear of that source, for the same minutes."
"PA06","Animism","The River Asked","1d8","7","none","","","Touch a river, a spring, or standing water. Ask one question it could have witnessed in the last day, or bid it do one small act: rise a foot, still a ford, or yield a bucket per point of the result. Enchanted water does not obey."
"PA07","Animism","Skin of the Cousin","1d10","9","none","","","A willing living creature becomes one mundane animal no larger than themselves. Gear melds into the shape. Speech or a killing blow ends the change. Lasts a number of minutes equal to the result, split if several willing targets are named."
"PA08","Animism","The Green Road","1d10","10","none","","","You and willing creatures within 30 feet move through undergrowth, shallow water, and broken ground at full speed. Lasts a number of hours equal to dots of Miracle skill spent. You may name a number of extra bodies up to dots of Miracle skill spent."
"PA09","Animism","Totem of the Standing Kin","1d12","12","none","","","Mark a carved post, a tree, or a stone you touch. Mundane beasts of one named kind, within 10 feet per point of the result, treat the mark as home and will not hunt those you name while they stay within that reach. The mark lasts until magic or miracle takes it off, or until it is destroyed."
"PA10","Animism","The Land Made Answer","1d20","17","none","","","Natural earth, stone, root, and water, in a number of 5-foot cubes equal to the result and within 100 feet, move or reshape as you ask at the end of the round. If the shape would stand without a miracle, it remains as ordinary land. If it would not, it holds until magic or miracle takes it off. This will not work on forged metal or on enchanted ground."
"PA11","Animism","The Known Path","1d4","1","none","","","You learn the safest footpath to a landmark you can name, if that landmark lies within a number of miles equal to the result. You do not learn what waits on the path."
"PA12","Animism","Kindness to the Herd","1d6","3","none","","","Mundane beasts within 30 feet, a number up to dots of Miracle skill spent, will not panic at you or at your companions for a number of minutes equal to the result. A blow ends the calm for that beast."
"PA13","Animism","Rain on the Row","1d8","6","none","","","A garden, a field-strip, or a trough within 40 feet receives clean water enough for a number of people equal to the result to drink once. The water is ordinary after it falls. This does not heal."`;

const MIRACLES = parseCsvWithHeader(FANTASY_MIRACLE_CSV).map((r) => ({
  id: r.id,
  school: r.school,
  name: r.name,
  cost: r.cost,
  dotsRequired: Number(r['Dots Reqd']) || 0,
  defy: r.defy === 'none' ? '' : r.defy,
  clock: r.clock,
  crutch: r.crutch,
  description: r.full_description,
}));

const MIRACLE_SCHOOLS = [...new Set(MIRACLES.map((s) => s.school))].sort();

// Miracles aren't purchased with the shared class-point pool — instead every
// Shepherd rank grants exactly one learnable-miracle slot. Every miracle is
// visible once 1+ ranks are in Shepherd, regardless of current Focus, but only
// as many can be *known* at once as Shepherd ranks allow. Gated by the same
// magicEnabled toggle as Spells — see hasSpellAccess.
function hasMiracleAccess(character) {
  return character.magicEnabled && (character.classDots.Shepherd || 0) >= 1;
}

// Same bonus mechanic as getSpellSlotCountForRank above, but for the
// "Blessing of Miracles" special and Shepherd dots.
function getMiracleSlotCountForRank(character, rank) {
  const blessing = SPECIALS.find((s) => s.name === 'Blessing of Miracles');
  if (blessing && isSpecialOwned(character, blessing)) {
    const baseRank = character.extraMiracleBaseRank || 0;
    return rank + Math.max(0, rank - baseRank);
  }
  return rank;
}

function getMiracleSlotCount(character) {
  return getMiracleSlotCountForRank(character, character.classDots.Shepherd || 0);
}

function getMiraclesLearnedCount(character) {
  return MIRACLES.reduce((sum, miracle) => sum + (isMiracleLearned(character, miracle) ? 1 : 0), 0);
}

function canLearnMiracle(character, miracle) {
  return meetsCastingDotsRequirement(character, miracle, 'Miracle')
    && getMiraclesLearnedCount(character) < getMiracleSlotCount(character);
}

function isMiracleLearned(character, miracle) {
  return !!character.miraclesLearned[miracle.id];
}

// Learning a miracle is free (no shared-pool point cost) but capped by
// getMiracleSlotCount — forgetting one always frees its slot back up.
function toggleMiracleLearned(character, miracle) {
  const learned = isMiracleLearned(character, miracle);
  if (!learned && !canLearnMiracle(character, miracle)) return;
  character.miraclesLearned[miracle.id] = !learned;
}

// ---------------------------------------------------------------------------
// Equipment (data/fantasy_eq.csv) and Coinage (data/coinage.txt). A simple
// shop: any item can be bought in any quantity, tracked separately from the
// shared class-point economy and funded by the character's own coin purses.
// ---------------------------------------------------------------------------

const EQUIPMENT_CSV = `"Item","Type","Description","weight(lbs)","cost(GT)","TL"
"Dagger","weapons","Short blade for close work and throwing.","1","2",""
"Knife","weapons","Camp and kitchen knife, poor as a weapon.","0.5","0.5",""
"Shortsword","weapons","One-handed blade for tight halls.","3","8",""
"Sword Arming","weapons","Standard one-handed knight's sword.","4","15",""
"Sword Long","weapons","Hand-and-a-half blade.","5","25",""
"Sword Great","weapons","Two-handed cutting sword.","8","40",""
"Hand axe","weapons","One-handed axe; also splits kindling.","3","5",""
"Battleaxe","weapons","Heavy one- or two-handed war axe.","6","12",""
"Greataxe","weapons","Two-handed executioner's axe.","10","25",""
"Mace","weapons","Flanged crushing head.","5","8",""
"WarHammer","weapons","Pick and face for mail and plate.","5","12",""
"Maul","weapons","Two-handed hammer.","12","15",""
"Spear Short","weapons","Thrusting shaft, 6–7 feet.","6","4",""
"Pike","weapons","Long formation spear, awkward indoors.","12","8",""
"Halberd","weapons","Axe-blade, hook, and point on a pole.","12","15",""
"Quarterstaff","weapons","Hardwood staff.","4","0.2",""
"Club","weapons","Simple bludgeon.","3","0.1",""
"Morning Star","weapons","Spiked striking head.","6","12",""
"Flail","weapons","Hinged striking head; ignores some shields in close.","6","10",""
"Rapier","weapons","Thrusting civilian blade.","2","20",""
"Scimitar","weapons","Curved slashing blade.","3","18",""
"Hand crossbow","weapons","One-handed light crossbow.","3","30",""
"Light Crossbow","weapons","Standard spanned bow.","6","20",""
"Heavy Crossbow","weapons","Slow, hard-hitting spanned bow.","12","40",""
"Short Bow","weapons","Hunting bow.","2","12",""
"Longbow","weapons","War bow; needs room to draw.","3","30",""
"Sling","weapons","Leather pouch and cords.","0.2","0.1",""
"Javelin thrown","weapons","Light throwing spear.","2","1",""
"Axe Thrown","weapons","Balanced hatchet.","2","3",""
"Arrows (20)","weapons","Sheaf for bows.","2","1",""
"Quarrels (20)","weapons","Bolts for crossbows.","2","1.5",""
"Sling bullets (20)","weapons","Lead or baked clay.","2","0.2",""
"Blowgun","weapons","Tube and darts sold separate.","1","4",""
"Darts (20)","weapons","Blowgun or throwing darts.","1","1",""
"Whip","weapons","Long lash.","2","2",""
"Man-catcher","weapons","Forked capture pole.","8","12",""
"Fighting Net","weapons","Entangling net.","6","5",""
"Caltrops (bag)","weapons","Enough to cover 5 feet.","2","1",""
"BrassKnuckles","weapons","Metal knuckledusters worn over the fist.","0.5","2",""
"Cudgel","weapons","Stout wooden club, quick and dirty.","2","0.5",""
"Sword Stabbing","weapons","Narrow blade built for the thrust.","2","15",""
"Sword Willow-leaf","weapons","Elven sword with a tapered leaf-shaped blade.","3","22",""
"Sword Broad","weapons","Wide double-edged blade for heavy cuts.","5","22",""
"Sword Foil","weapons","Light thrusting blade for quick, precise strikes.","2","18",""
"Sword Sabre","weapons","Curved cavalry blade, quick in the cut.","3","20",""
"Sword Katana","weapons","Curved single-edged blade, prized for its keen edge.","3","35",""
"Hammer","weapons","One-handed dwarven war hammer.","4","10",""
"SpikeHammer","weapons","Hammer fitted with a piercing spike.","5","14",""
"Nordic/Norman Axe","weapons","One-handed axe favored by northern raiders.","4","12",""
"WarAxe","weapons","Heavy two-handed dwarven battle axe.","8","20",""
"Lance","weapons","Long cavalry lance for mounted combat.","10","18",""
"Lance(charge)","weapons","Long cavalry lance, deadliest at a charge.","10","20",""
"Sling Staff","weapons","Staff-sling for hurling stones with greater force.","3","8",""
"Composite Bow","weapons","Layered bow with extra draw power.","2","40",""
"Dagger Thrown","weapons","Balanced dagger meant for throwing.","1","2",""
"Club Thrown","weapons","Weighted club balanced for throwing.","2","2",""
"Rock Thrown","weapons","Fist-sized stone, good for throwing.","1","0.05",""
"Padded jack","armor","Quilted cloth armor.","8","5","3"
"Leather jerkin","armor","Boiled or layered leather.","10","10","3"
"Studded leather","armor","Leather with metal rivets.","15","25","3"
"Hide armor","armor","Thick hides and pelts.","20","12","3"
"Mail shirt","armor","Torso mail.","25","60","3"
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","100","3"
"Scale shirt","armor","Overlapping metal scales.","30","80","3"
"Breastplate","armor","Solid chest and back.","20","200","3"
"Half plate","armor","Breast, greaves, and vambraces.","40","350","3"
"Full plate","armor","Complete articulated harness.","55","750","3"
"Helmet, cap","armor","Simple steel cap.","3","8","3"
"Helmet, open","armor","Nasal or kettle helm.","5","15","3"
"Helmet, closed","armor","Visored helm.","8","40","3"
"Shield, buckler","armor","Small fist shield.","3","5","3"
"Shield, round","armor","Common wooden shield with boss.","6","8","3"
"Shield, kite","armor","Tall cavalry or foot shield.","10","12","3"
"Shield, tower","armor","Full-height pavise.","18","20","3"
"Barding, leather","armor","Horse leather armor.","40","40","3"
"Barding, mail","armor","Horse mail.","70","200","3"
"Barding, plate","armor","Horse plate.","90","500","3"
"Backpack","general","Leather pack, about 40 lb capacity.","2","2",""
"Sack","general","Burlap or canvas bag.","0.5","0.1",""
"Belt pouch","general","Small pouch for coin and flint.","0.2","0.3",""
"Waterskin (1 gal)","general","Filled skin; weight is full.","8","1",""
"Wineskin (1 gal)","general","As waterskin, for drink.","8","1",""
"Flask, metal","general","Pint flask.","1","2",""
"Vial, glass","general","Small stopper vial.","0.1","1",""
"Crowbar","general","Iron bar for prying.","5","2",""
"Hammer","general","Camp and nail hammer.","2","1",""
"Sledge","general","Heavy driving hammer.","10","3",""
"Pick, miner's","general","Breaking stone and packed earth.","8","4",""
"Shovel","general","Digging spade.","6","2",""
"Hand saw","general","Wood saw.","2","2",""
"Woodcutter's axe","general","Felling axe, not balanced for war.","6","3",""
"Block and tackle","general","Rope pulley for heavy lifts.","5","8",""
"Chain (10 ft)","general","Iron links.","10","8",""
"Rope, hemp (50 ft)","general","Common rope.","10","1",""
"Rope, silk (50 ft)","general","Lighter, stronger line.","5","10",""
"Grappling hook","general","Three-prong hook.","4","2",""
"Pitons (10)","general","Iron spikes for climbing.","5","2",""
"Manacles","general","Wrist irons and short chain.","2","8",""
"Lock, simple","general","Cheap padlock.","0.5","8",""
"Lock, good","general","Better wards.","1","20",""
"Lock, fine","general","Hard to pick.","1","50",""
"Thieves' tools","general","Picks, shims, small saw, files.","1","25",""
"Artisan tools (set)","general","One trade: smith, carpenter, tailor, etc.","8","20",""
"Healer's kit","general","Bandages, needle, salves for 10 uses.","3","8",""
"Herbalism pouch","general","Pouches and small knife for gathering.","2","5",""
"Alchemist's kit","general","Vials, burner, glassware.","8","40",""
"Writing kit","general","Ink, quills, wax, small knife.","2","8",""
"Parchment (sheet)","general","One sheet.","0.05","0.2",""
"Book, blank","general","Bound empty book.","3","20",""
"Book, printed or copied","general","Common treatise.","3","30",""
"Lantern, hooded","general","Shuttered oil lantern.","2","8",""
"Lantern, bullseye","general","Directed beam.","3","12",""
"Torch","general","Resin torch, about 1 hour.","1","0.05",""
"Lamp, clay","general","Simple oil lamp.","1","0.3",""
"Oil flask","general","1 pint lamp oil, about 6 hours.","1","0.1",""
"Candles (10)","general","Tallow candles.","1","0.1",""
"Tinderbox","general","Flint, steel, and tinder.","0.5","0.5",""
"Bedroll","general","Blanket and ground cloth.","5","1",""
"Blanket, winter","general","Heavy wool.","4","2",""
"Tent, one-man","general","Oilcloth shelter.","10","8",""
"Tent, four-man","general","Larger camp tent.","30","25",""
"Mess kit","general","Cup, plate, and spoon.","1","0.8",""
"Cookpot","general","Iron pot.","8","3",""
"Rations, poor (1 day)","general","Hard bread and dried beans.","1","0.1",""
"Rations, trail (1 day)","general","Dried meat, hardtack, dried fruit.","2","0.5",""
"Rations, fine (1 day)","general","Cheese, sausage, decent bread.","2","1.5",""
"Feed, horse (1 day)","general","Grain and hay portion.","10","0.1",""
"Ale, pint","general","Common tap ale.","1","0.05",""
"Wine, cheap bottle","general","Rough table wine.","2","0.2",""
"Wine, good bottle","general","Decent vintage.","2","2",""
"Spirits, flask","general","Strong drink.","1","1",""
"Lodging, common (night)","general","Shared room or pallet.","0","0.3",""
"Lodging, private (night)","general","Own room at an inn.","0","1",""
"Lodging, fine (night)","general","Good inn, bath and meal.","0","5",""
"Meal, poor","general","Stew and bread.","0","0.05",""
"Meal, common","general","Meat, bread, ale.","0","0.2",""
"Meal, fine","general","Roast and wine.","0","1",""
"Clothes, poor","general","Worn shirt, hose, wrap.","3","0.5",""
"Clothes, common","general","Shirt, breeches, cloak, shoes.","4","2",""
"Clothes, travel","general","Boots, cloak, sturdy coat.","6","5",""
"Clothes, fine","general","Dyed cloth and trim.","4","20",""
"Clothes, noble court","general","Silk or velvet display.","5","80",""
"Cloak, wool","general","Weather cloak.","3","2",""
"Cloak, winter","general","Fur-lined.","6","8",""
"Boots, common","general","Leather boots.","2","2",""
"Boots, riding","general","Tall boots.","3","5",""
"Gloves","general","Work or riding gloves.","0.3","1",""
"Belt","general","Leather belt.","0.3","0.3",""
"Holy symbol, wood","general","Carved token.","0.2","1",""
"Holy symbol, silver","general","Worked silver.","0.3","15",""
"Spell component pouch","general","Small pouches and vials.","2","5",""
"Focus, wooden wand","general","Simple magical focus.","0.5","8",""
"Focus, crystal","general","Cut crystal focus.","0.5","40",""
"Mirror, steel","general","Polished plate.","0.5","5",""
"Mirror, silvered","general","True glass mirror.","1","20",""
"Spyglass","general","Short brass scope.","1","80",""
"Hourglass","general","Minute or hour glass.","1","15",""
"Scale, merchant","general","Balance and weights.","3","8",""
"Abacus","general","Counting frame.","2","2",""
"Musical instrument, common","general","Flute, drum, or cheap lute.","2","8",""
"Musical instrument, fine","general","Well-made lute or harp.","5","40",""
"Signal whistle","general","Piercing whistle.","0.1","0.2",""
"Hunting horn","general","Carrying horn.","2","5",""
"Fishing tackle","general","Line, hooks, corks.","2","1",""
"Net, fishing","general","Weighted net.","8","3",""
"Soap","general","Bar of soap.","0.5","0.1",""
"Perfume, vial","general","Scented oil.","0.2","5",""
"Sealing wax","general","Stick of wax.","0.2","0.5",""
"Signet ring","general","Personal seal.","0.1","5",""
"Map, local","general","County or city map.","0.1","8",""
"Map, regional","general","Realm map, uneven quality.","0.1","20",""
"Compass","general","Magnetic needle.","0.3","25",""
"Saddle, riding","general","Common riding saddle.","20","15",""
"Saddle, war","general","High-cantle war saddle.","30","40",""
"Saddlebags","general","Pair of bags.","8","4",""
"Bit and bridle","general","Horse tack.","2","2",""
"Donkey","general","Pack beast.","0","12",""
"Mule","general","Sturdy pack and riding beast.","0","20",""
"Riding horse","general","Common hack.","0","75",""
"Draft horse","general","Wagon horse.","0","50",""
"Warhorse","general","Trained destrier.","0","400",""
"Pony","general","Small mount.","0","30",""
"Cart","general","Two-wheel cart.","200","15",""
"Wagon","general","Four-wheel wagon.","400","40",""
"Carriage","general","Passenger coach.","600","200",""
"Rowboat","general","Small boat.","120","50",""
"Keelboat","general","River boat.","0","750",""
"Sailing ship, small","general","Coast trader.","0","3000",""
"Chest, wooden","general","Lockable chest.","25","5",""
"Chest, iron-bound","general","Strong chest.","50","20",""
"Barrel","general","Cask, empty.","30","2",""
"Crate","general","Nail-built box.","15","1",""
"Ladder (10 ft)","general","Wooden ladder.","20","1",""
"Pole (10 ft)","general","Ash pole.","8","0.1",""
"Ink (vial)","general","Black ink.","0.1","8",""
"Chalk (10)","general","Marking sticks.","0.2","0.1",""
"Paint, pot","general","Small pigment pot.","1","2",""
"Spy-glass case","general","Leather tube.","0.5","2",""
"Tent stake set","general","Wood or iron stakes.","3","0.3",""
"Whetstone","general","Sharpening stone.","1","0.2",""
"Needle and thread","general","Repair kit.","0.1","0.2",""
"Winter blanket roll","general","Bedroll plus extra wool.","9","3",""
"Rain cloak, oiled","general","Waxed canvas cloak.","4","4",""
"Snowshoes","general","Pair.","4","5",""
"Skis","general","Pair and pole.","12","8",""
"Torch, storm","general","Pitch torch that takes weather better.","1.5","0.2",""
"Holy water (flask)","general","Blessed water.","1","15",""
"Acid (vial)","general","Strong acid.","1","10",""
"Antitoxin (vial)","general","Mundane anti-venom.","0.2","20",""
"Healing draught","general","Common stimulant tonic, not a miracle.","0.3","15",""
"Poison, simple (vial)","general","Restricted in most towns.","0.2","50",""
"Banner","general","House or company cloth.","3","8",""
"Tent, pavilion","general","Lord's camp tent.","80","120",""
"Portable altar","general","Small traveling shrine.","8","25",""
"Scabbard","general","Fitted sheath.","1","2",""
"Weapon oil","general","Protective oil.","0.3","0.5",""
"Armor repair kit","general","Rings, leather, rivets.","4","8",""`;

const MODERN_EQ_CSV = `"Item","Type","Description","weight(lbs)","cost($)","TL"
"Dagger","weapons","Short blade for close work and throwing.","1","40",""
"Knife","weapons","Camp and kitchen knife, poor as a weapon.","0.5","10",""
"Shortsword","weapons","One-handed blade for tight halls.","3","160",""
"Sword Arming","weapons","Standard one-handed knight's sword.","4","300",""
"Sword Long","weapons","Hand-and-a-half blade.","5","500",""
"Sword Great","weapons","Two-handed cutting sword.","8","800",""
"Hand axe","weapons","One-handed axe; also splits kindling.","3","100",""
"Battleaxe","weapons","Heavy one- or two-handed war axe.","6","240",""
"Greataxe","weapons","Two-handed executioner's axe.","10","500",""
"Mace","weapons","Flanged crushing head.","5","160",""
"WarHammer","weapons","Pick and face for mail and plate.","5","240",""
"Maul","weapons","Two-handed hammer.","12","300",""
"Spear Short","weapons","Thrusting shaft, 6–7 feet.","6","80",""
"Pike","weapons","Long formation spear, awkward indoors.","12","160",""
"Halberd","weapons","Axe-blade, hook, and point on a pole.","12","300",""
"Quarterstaff","weapons","Hardwood staff.","4","4",""
"Club","weapons","Simple bludgeon.","3","2",""
"Morning Star","weapons","Spiked striking head.","6","240",""
"Flail","weapons","Hinged striking head; ignores some shields in close.","6","200",""
"Rapier","weapons","Thrusting civilian blade.","2","400",""
"Scimitar","weapons","Curved slashing blade.","3","360",""
"Hand crossbow","weapons","One-handed light crossbow.","3","600",""
"Light Crossbow","weapons","Standard spanned bow.","6","400",""
"Heavy Crossbow","weapons","Slow, hard-hitting spanned bow.","12","800",""
"Short Bow","weapons","Hunting bow.","2","240",""
"Longbow","weapons","War bow; needs room to draw.","3","600",""
"Sling","weapons","Leather pouch and cords.","0.2","2",""
"Javelin thrown","weapons","Light throwing spear.","2","20",""
"Axe Thrown","weapons","Balanced hatchet.","2","60",""
"Arrows (20)","weapons","Sheaf for bows.","2","20",""
"Quarrels (20)","weapons","Bolts for crossbows.","2","30",""
"Sling bullets (20)","weapons","Lead or baked clay.","2","4",""
"Blowgun","weapons","Tube and darts sold separate.","1","80",""
"Darts (20)","weapons","Blowgun or throwing darts.","1","20",""
"Whip","weapons","Long lash.","2","40",""
"Man-catcher","weapons","Forked capture pole.","8","240",""
"Fighting Net","weapons","Entangling net.","6","100",""
"Caltrops (bag)","weapons","Enough to cover 5 feet.","2","20",""
"BrassKnuckles","weapons","Metal knuckledusters worn over the fist.","0.5","40",""
"Cudgel","weapons","Stout wooden club, quick and dirty.","2","10",""
"Sword Stabbing","weapons","Narrow blade built for the thrust.","2","300",""
"Sword Willow-leaf","weapons","Elven sword with a tapered leaf-shaped blade.","3","440",""
"Sword Broad","weapons","Wide double-edged blade for heavy cuts.","5","440",""
"Sword Foil","weapons","Light thrusting blade for quick, precise strikes.","2","360",""
"Sword Sabre","weapons","Curved cavalry blade, quick in the cut.","3","400",""
"Sword Katana","weapons","Curved single-edged blade, prized for its keen edge.","3","700",""
"Hammer","weapons","One-handed dwarven war hammer.","4","200",""
"SpikeHammer","weapons","Hammer fitted with a piercing spike.","5","280",""
"Nordic/Norman Axe","weapons","One-handed axe favored by northern raiders.","4","240",""
"WarAxe","weapons","Heavy two-handed dwarven battle axe.","8","400",""
"Lance","weapons","Long cavalry lance for mounted combat.","10","360",""
"Lance(charge)","weapons","Long cavalry lance, deadliest at a charge.","10","400",""
"Sling Staff","weapons","Staff-sling for hurling stones with greater force.","3","160",""
"Composite Bow","weapons","Layered bow with extra draw power.","2","800",""
"Dagger Thrown","weapons","Balanced dagger meant for throwing.","1","40",""
"Club Thrown","weapons","Weighted club balanced for throwing.","2","40",""
"Rock Thrown","weapons","Fist-sized stone, good for throwing.","1","1",""
"Padded jack","armor","Quilted cloth armor.","8","100","3"
"Leather jerkin","armor","Boiled or layered leather.","10","200","3"
"Studded leather","armor","Leather with metal rivets.","15","500","3"
"Hide armor","armor","Thick hides and pelts.","20","240","3"
"Mail shirt","armor","Torso mail.","25","1200","3"
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","2000","3"
"Scale shirt","armor","Overlapping metal scales.","30","1600","3"
"Breastplate","armor","Solid chest and back.","20","4000","3"
"Half plate","armor","Breast, greaves, and vambraces.","40","7000","3"
"Full plate","armor","Complete articulated harness.","55","15000","3"
"Helmet, cap","armor","Simple steel cap.","3","160","3"
"Helmet, open","armor","Nasal or kettle helm.","5","300","3"
"Helmet, closed","armor","Visored helm.","8","800","3"
"Shield, buckler","armor","Small fist shield.","3","100","3"
"Shield, round","armor","Common wooden shield with boss.","6","160","3"
"Shield, kite","armor","Tall cavalry or foot shield.","10","240","3"
"Shield, tower","armor","Full-height pavise.","18","400","3"
"Barding, leather","armor","Horse leather armor.","40","800","3"
"Barding, mail","armor","Horse mail.","70","4000","3"
"Barding, plate","armor","Horse plate.","90","10000","3"
"Backpack","general","Leather pack, about 40 lb capacity.","2","40",""
"Sack","general","Burlap or canvas bag.","0.5","2",""
"Belt pouch","general","Small pouch for coin and flint.","0.2","6",""
"Waterskin (1 gal)","general","Filled skin; weight is full.","8","20",""
"Wineskin (1 gal)","general","As waterskin, for drink.","8","20",""
"Flask, metal","general","Pint flask.","1","40",""
"Vial, glass","general","Small stopper vial.","0.1","20",""
"Crowbar","general","Iron bar for prying.","5","40",""
"Hammer","general","Camp and nail hammer.","2","20",""
"Sledge","general","Heavy driving hammer.","10","60",""
"Pick, miner's","general","Breaking stone and packed earth.","8","80",""
"Shovel","general","Digging spade.","6","40",""
"Hand saw","general","Wood saw.","2","40",""
"Woodcutter's axe","general","Felling axe, not balanced for war.","6","60",""
"Block and tackle","general","Rope pulley for heavy lifts.","5","160",""
"Chain (10 ft)","general","Iron links.","10","160",""
"Rope, hemp (50 ft)","general","Common rope.","10","20",""
"Rope, silk (50 ft)","general","Lighter, stronger line.","5","200",""
"Grappling hook","general","Three-prong hook.","4","40",""
"Pitons (10)","general","Iron spikes for climbing.","5","40",""
"Manacles","general","Wrist irons and short chain.","2","160",""
"Lock, simple","general","Cheap padlock.","0.5","160",""
"Lock, good","general","Better wards.","1","400",""
"Lock, fine","general","Hard to pick.","1","1000",""
"Thieves' tools","general","Picks, shims, small saw, files.","1","500",""
"Artisan tools (set)","general","One trade: smith, carpenter, tailor, etc.","8","400",""
"Healer's kit","general","Bandages, needle, salves for 10 uses.","3","160",""
"Herbalism pouch","general","Pouches and small knife for gathering.","2","100",""
"Alchemist's kit","general","Vials, burner, glassware.","8","800",""
"Writing kit","general","Ink, quills, wax, small knife.","2","160",""
"Parchment (sheet)","general","One sheet.","0.05","4",""
"Book, blank","general","Bound empty book.","3","400",""
"Book, printed or copied","general","Common treatise.","3","600",""
"Lantern, hooded","general","Shuttered oil lantern.","2","160",""
"Lantern, bullseye","general","Directed beam.","3","240",""
"Torch","general","Resin torch, about 1 hour.","1","1",""
"Lamp, clay","general","Simple oil lamp.","1","6",""
"Oil flask","general","1 pint lamp oil, about 6 hours.","1","2",""
"Candles (10)","general","Tallow candles.","1","2",""
"Tinderbox","general","Flint, steel, and tinder.","0.5","10",""
"Bedroll","general","Blanket and ground cloth.","5","20",""
"Blanket, winter","general","Heavy wool.","4","40",""
"Tent, one-man","general","Oilcloth shelter.","10","160",""
"Tent, four-man","general","Larger camp tent.","30","500",""
"Mess kit","general","Cup, plate, and spoon.","1","16",""
"Cookpot","general","Iron pot.","8","60",""
"Rations, poor (1 day)","general","Hard bread and dried beans.","1","2",""
"Rations, trail (1 day)","general","Dried meat, hardtack, dried fruit.","2","10",""
"Rations, fine (1 day)","general","Cheese, sausage, decent bread.","2","30",""
"Feed, horse (1 day)","general","Grain and hay portion.","10","2",""
"Ale, pint","general","Common tap ale.","1","1",""
"Wine, cheap bottle","general","Rough table wine.","2","4",""
"Wine, good bottle","general","Decent vintage.","2","40",""
"Spirits, flask","general","Strong drink.","1","20",""
"Lodging, common (night)","general","Shared room or pallet.","0","6",""
"Lodging, private (night)","general","Own room at an inn.","0","20",""
"Lodging, fine (night)","general","Good inn, bath and meal.","0","100",""
"Meal, poor","general","Stew and bread.","0","1",""
"Meal, common","general","Meat, bread, ale.","0","4",""
"Meal, fine","general","Roast and wine.","0","20",""
"Clothes, poor","general","Worn shirt, hose, wrap.","3","10",""
"Clothes, common","general","Shirt, breeches, cloak, shoes.","4","40",""
"Clothes, travel","general","Boots, cloak, sturdy coat.","6","100",""
"Clothes, fine","general","Dyed cloth and trim.","4","400",""
"Clothes, noble court","general","Silk or velvet display.","5","1600",""
"Cloak, wool","general","Weather cloak.","3","40",""
"Cloak, winter","general","Fur-lined.","6","160",""
"Boots, common","general","Leather boots.","2","40",""
"Boots, riding","general","Tall boots.","3","100",""
"Gloves","general","Work or riding gloves.","0.3","20",""
"Belt","general","Leather belt.","0.3","6",""
"Holy symbol, wood","general","Carved token.","0.2","20",""
"Holy symbol, silver","general","Worked silver.","0.3","300",""
"Spell component pouch","general","Small pouches and vials.","2","100",""
"Focus, wooden wand","general","Simple magical focus.","0.5","160",""
"Focus, crystal","general","Cut crystal focus.","0.5","800",""
"Mirror, steel","general","Polished plate.","0.5","100",""
"Mirror, silvered","general","True glass mirror.","1","400",""
"Spyglass","general","Short brass scope.","1","1600",""
"Hourglass","general","Minute or hour glass.","1","300",""
"Scale, merchant","general","Balance and weights.","3","160",""
"Abacus","general","Counting frame.","2","40",""
"Musical instrument, common","general","Flute, drum, or cheap lute.","2","160",""
"Musical instrument, fine","general","Well-made lute or harp.","5","800",""
"Signal whistle","general","Piercing whistle.","0.1","4",""
"Hunting horn","general","Carrying horn.","2","100",""
"Fishing tackle","general","Line, hooks, corks.","2","20",""
"Net, fishing","general","Weighted net.","8","60",""
"Soap","general","Bar of soap.","0.5","2",""
"Perfume, vial","general","Scented oil.","0.2","100",""
"Sealing wax","general","Stick of wax.","0.2","10",""
"Signet ring","general","Personal seal.","0.1","100",""
"Map, local","general","County or city map.","0.1","160",""
"Map, regional","general","Realm map, uneven quality.","0.1","400",""
"Compass","general","Magnetic needle.","0.3","500",""
"Saddle, riding","general","Common riding saddle.","20","300",""
"Saddle, war","general","High-cantle war saddle.","30","800",""
"Saddlebags","general","Pair of bags.","8","80",""
"Bit and bridle","general","Horse tack.","2","40",""
"Donkey","general","Pack beast.","0","240",""
"Mule","general","Sturdy pack and riding beast.","0","400",""
"Riding horse","general","Common hack.","0","1500",""
"Draft horse","general","Wagon horse.","0","1000",""
"Warhorse","general","Trained destrier.","0","8000",""
"Pony","general","Small mount.","0","600",""
"Cart","general","Two-wheel cart.","200","300",""
"Wagon","general","Four-wheel wagon.","400","800",""
"Carriage","general","Passenger coach.","600","4000",""
"Rowboat","general","Small boat.","120","1000",""
"Keelboat","general","River boat.","0","15000",""
"Sailing ship, small","general","Coast trader.","0","60000",""
"Chest, wooden","general","Lockable chest.","25","100",""
"Chest, iron-bound","general","Strong chest.","50","400",""
"Barrel","general","Cask, empty.","30","40",""
"Crate","general","Nail-built box.","15","20",""
"Ladder (10 ft)","general","Wooden ladder.","20","20",""
"Pole (10 ft)","general","Ash pole.","8","2",""
"Ink (vial)","general","Black ink.","0.1","160",""
"Chalk (10)","general","Marking sticks.","0.2","2",""
"Paint, pot","general","Small pigment pot.","1","40",""
"Spy-glass case","general","Leather tube.","0.5","40",""
"Tent stake set","general","Wood or iron stakes.","3","6",""
"Whetstone","general","Sharpening stone.","1","4",""
"Needle and thread","general","Repair kit.","0.1","4",""
"Winter blanket roll","general","Bedroll plus extra wool.","9","60",""
"Rain cloak, oiled","general","Waxed canvas cloak.","4","80",""
"Snowshoes","general","Pair.","4","100",""
"Skis","general","Pair and pole.","12","160",""
"Torch, storm","general","Pitch torch that takes weather better.","1.5","4",""
"Holy water (flask)","general","Blessed water.","1","300",""
"Acid (vial)","general","Strong acid.","1","200",""
"Antitoxin (vial)","general","Mundane anti-venom.","0.2","400",""
"Healing draught","general","Common stimulant tonic, not a miracle.","0.3","300",""
"Poison, simple (vial)","general","Restricted in most towns.","0.2","1000",""
"Banner","general","House or company cloth.","3","160",""
"Tent, pavilion","general","Lord's camp tent.","80","2400",""
"Portable altar","general","Small traveling shrine.","8","500",""
"Scabbard","general","Fitted sheath.","1","40",""
"Weapon oil","general","Protective oil.","0.3","10",""
"Armor repair kit","general","Rings, leather, rivets.","4","160",""`;

const DYSTOPIAN_EQ_CSV = `"Item","Type","Description","weight(lbs)","cost($)","TL"
"Dagger","weapons","Short blade for close work and throwing.","1","40",""
"Knife","weapons","Camp and kitchen knife, poor as a weapon.","0.5","10",""
"Shortsword","weapons","One-handed blade for tight halls.","3","160",""
"Sword Arming","weapons","Standard one-handed knight's sword.","4","300",""
"Sword Long","weapons","Hand-and-a-half blade.","5","500",""
"Sword Great","weapons","Two-handed cutting sword.","8","800",""
"Hand axe","weapons","One-handed axe; also splits kindling.","3","100",""
"Battleaxe","weapons","Heavy one- or two-handed war axe.","6","240",""
"Greataxe","weapons","Two-handed executioner's axe.","10","500",""
"Mace","weapons","Flanged crushing head.","5","160",""
"WarHammer","weapons","Pick and face for mail and plate.","5","240",""
"Maul","weapons","Two-handed hammer.","12","300",""
"Spear Short","weapons","Thrusting shaft, 6–7 feet.","6","80",""
"Pike","weapons","Long formation spear, awkward indoors.","12","160",""
"Halberd","weapons","Axe-blade, hook, and point on a pole.","12","300",""
"Quarterstaff","weapons","Hardwood staff.","4","4",""
"Club","weapons","Simple bludgeon.","3","2",""
"Morning Star","weapons","Spiked striking head.","6","240",""
"Flail","weapons","Hinged striking head; ignores some shields in close.","6","200",""
"Rapier","weapons","Thrusting civilian blade.","2","400",""
"Scimitar","weapons","Curved slashing blade.","3","360",""
"Hand crossbow","weapons","One-handed light crossbow.","3","600",""
"Light Crossbow","weapons","Standard spanned bow.","6","400",""
"Heavy Crossbow","weapons","Slow, hard-hitting spanned bow.","12","800",""
"Short Bow","weapons","Hunting bow.","2","240",""
"Longbow","weapons","War bow; needs room to draw.","3","600",""
"Sling","weapons","Leather pouch and cords.","0.2","2",""
"Javelin thrown","weapons","Light throwing spear.","2","20",""
"Axe Thrown","weapons","Balanced hatchet.","2","60",""
"Arrows (20)","weapons","Sheaf for bows.","2","20",""
"Quarrels (20)","weapons","Bolts for crossbows.","2","30",""
"Sling bullets (20)","weapons","Lead or baked clay.","2","4",""
"Blowgun","weapons","Tube and darts sold separate.","1","80",""
"Darts (20)","weapons","Blowgun or throwing darts.","1","20",""
"Whip","weapons","Long lash.","2","40",""
"Man-catcher","weapons","Forked capture pole.","8","240",""
"Fighting Net","weapons","Entangling net.","6","100",""
"Caltrops (bag)","weapons","Enough to cover 5 feet.","2","20",""
"BrassKnuckles","weapons","Metal knuckledusters worn over the fist.","0.5","40",""
"Cudgel","weapons","Stout wooden club, quick and dirty.","2","10",""
"Sword Stabbing","weapons","Narrow blade built for the thrust.","2","300",""
"Sword Willow-leaf","weapons","Elven sword with a tapered leaf-shaped blade.","3","440",""
"Sword Broad","weapons","Wide double-edged blade for heavy cuts.","5","440",""
"Sword Foil","weapons","Light thrusting blade for quick, precise strikes.","2","360",""
"Sword Sabre","weapons","Curved cavalry blade, quick in the cut.","3","400",""
"Sword Katana","weapons","Curved single-edged blade, prized for its keen edge.","3","700",""
"Hammer","weapons","One-handed dwarven war hammer.","4","200",""
"SpikeHammer","weapons","Hammer fitted with a piercing spike.","5","280",""
"Nordic/Norman Axe","weapons","One-handed axe favored by northern raiders.","4","240",""
"WarAxe","weapons","Heavy two-handed dwarven battle axe.","8","400",""
"Lance","weapons","Long cavalry lance for mounted combat.","10","360",""
"Lance(charge)","weapons","Long cavalry lance, deadliest at a charge.","10","400",""
"Sling Staff","weapons","Staff-sling for hurling stones with greater force.","3","160",""
"Composite Bow","weapons","Layered bow with extra draw power.","2","800",""
"Dagger Thrown","weapons","Balanced dagger meant for throwing.","1","40",""
"Club Thrown","weapons","Weighted club balanced for throwing.","2","40",""
"Rock Thrown","weapons","Fist-sized stone, good for throwing.","1","1",""
"Padded jack","armor","Quilted cloth armor.","8","100","3"
"Leather jerkin","armor","Boiled or layered leather.","10","200","3"
"Studded leather","armor","Leather with metal rivets.","15","500","3"
"Hide armor","armor","Thick hides and pelts.","20","240","3"
"Mail shirt","armor","Torso mail.","25","1200","3"
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","2000","3"
"Scale shirt","armor","Overlapping metal scales.","30","1600","3"
"Breastplate","armor","Solid chest and back.","20","4000","3"
"Half plate","armor","Breast, greaves, and vambraces.","40","7000","3"
"Full plate","armor","Complete articulated harness.","55","15000","3"
"Helmet, cap","armor","Simple steel cap.","3","160","3"
"Helmet, open","armor","Nasal or kettle helm.","5","300","3"
"Helmet, closed","armor","Visored helm.","8","800","3"
"Shield, buckler","armor","Small fist shield.","3","100","3"
"Shield, round","armor","Common wooden shield with boss.","6","160","3"
"Shield, kite","armor","Tall cavalry or foot shield.","10","240","3"
"Shield, tower","armor","Full-height pavise.","18","400","3"
"Barding, leather","armor","Horse leather armor.","40","800","3"
"Barding, mail","armor","Horse mail.","70","4000","3"
"Barding, plate","armor","Horse plate.","90","10000","3"
"Backpack","general","Leather pack, about 40 lb capacity.","2","40",""
"Sack","general","Burlap or canvas bag.","0.5","2",""
"Belt pouch","general","Small pouch for coin and flint.","0.2","6",""
"Waterskin (1 gal)","general","Filled skin; weight is full.","8","20",""
"Wineskin (1 gal)","general","As waterskin, for drink.","8","20",""
"Flask, metal","general","Pint flask.","1","40",""
"Vial, glass","general","Small stopper vial.","0.1","20",""
"Crowbar","general","Iron bar for prying.","5","40",""
"Hammer","general","Camp and nail hammer.","2","20",""
"Sledge","general","Heavy driving hammer.","10","60",""
"Pick, miner's","general","Breaking stone and packed earth.","8","80",""
"Shovel","general","Digging spade.","6","40",""
"Hand saw","general","Wood saw.","2","40",""
"Woodcutter's axe","general","Felling axe, not balanced for war.","6","60",""
"Block and tackle","general","Rope pulley for heavy lifts.","5","160",""
"Chain (10 ft)","general","Iron links.","10","160",""
"Rope, hemp (50 ft)","general","Common rope.","10","20",""
"Rope, silk (50 ft)","general","Lighter, stronger line.","5","200",""
"Grappling hook","general","Three-prong hook.","4","40",""
"Pitons (10)","general","Iron spikes for climbing.","5","40",""
"Manacles","general","Wrist irons and short chain.","2","160",""
"Lock, simple","general","Cheap padlock.","0.5","160",""
"Lock, good","general","Better wards.","1","400",""
"Lock, fine","general","Hard to pick.","1","1000",""
"Thieves' tools","general","Picks, shims, small saw, files.","1","500",""
"Artisan tools (set)","general","One trade: smith, carpenter, tailor, etc.","8","400",""
"Healer's kit","general","Bandages, needle, salves for 10 uses.","3","160",""
"Herbalism pouch","general","Pouches and small knife for gathering.","2","100",""
"Alchemist's kit","general","Vials, burner, glassware.","8","800",""
"Writing kit","general","Ink, quills, wax, small knife.","2","160",""
"Parchment (sheet)","general","One sheet.","0.05","4",""
"Book, blank","general","Bound empty book.","3","400",""
"Book, printed or copied","general","Common treatise.","3","600",""
"Lantern, hooded","general","Shuttered oil lantern.","2","160",""
"Lantern, bullseye","general","Directed beam.","3","240",""
"Torch","general","Resin torch, about 1 hour.","1","1",""
"Lamp, clay","general","Simple oil lamp.","1","6",""
"Oil flask","general","1 pint lamp oil, about 6 hours.","1","2",""
"Candles (10)","general","Tallow candles.","1","2",""
"Tinderbox","general","Flint, steel, and tinder.","0.5","10",""
"Bedroll","general","Blanket and ground cloth.","5","20",""
"Blanket, winter","general","Heavy wool.","4","40",""
"Tent, one-man","general","Oilcloth shelter.","10","160",""
"Tent, four-man","general","Larger camp tent.","30","500",""
"Mess kit","general","Cup, plate, and spoon.","1","16",""
"Cookpot","general","Iron pot.","8","60",""
"Rations, poor (1 day)","general","Hard bread and dried beans.","1","2",""
"Rations, trail (1 day)","general","Dried meat, hardtack, dried fruit.","2","10",""
"Rations, fine (1 day)","general","Cheese, sausage, decent bread.","2","30",""
"Feed, horse (1 day)","general","Grain and hay portion.","10","2",""
"Ale, pint","general","Common tap ale.","1","1",""
"Wine, cheap bottle","general","Rough table wine.","2","4",""
"Wine, good bottle","general","Decent vintage.","2","40",""
"Spirits, flask","general","Strong drink.","1","20",""
"Lodging, common (night)","general","Shared room or pallet.","0","6",""
"Lodging, private (night)","general","Own room at an inn.","0","20",""
"Lodging, fine (night)","general","Good inn, bath and meal.","0","100",""
"Meal, poor","general","Stew and bread.","0","1",""
"Meal, common","general","Meat, bread, ale.","0","4",""
"Meal, fine","general","Roast and wine.","0","20",""
"Clothes, poor","general","Worn shirt, hose, wrap.","3","10",""
"Clothes, common","general","Shirt, breeches, cloak, shoes.","4","40",""
"Clothes, travel","general","Boots, cloak, sturdy coat.","6","100",""
"Clothes, fine","general","Dyed cloth and trim.","4","400",""
"Clothes, noble court","general","Silk or velvet display.","5","1600",""
"Cloak, wool","general","Weather cloak.","3","40",""
"Cloak, winter","general","Fur-lined.","6","160",""
"Boots, common","general","Leather boots.","2","40",""
"Boots, riding","general","Tall boots.","3","100",""
"Gloves","general","Work or riding gloves.","0.3","20",""
"Belt","general","Leather belt.","0.3","6",""
"Holy symbol, wood","general","Carved token.","0.2","20",""
"Holy symbol, silver","general","Worked silver.","0.3","300",""
"Spell component pouch","general","Small pouches and vials.","2","100",""
"Focus, wooden wand","general","Simple magical focus.","0.5","160",""
"Focus, crystal","general","Cut crystal focus.","0.5","800",""
"Mirror, steel","general","Polished plate.","0.5","100",""
"Mirror, silvered","general","True glass mirror.","1","400",""
"Spyglass","general","Short brass scope.","1","1600",""
"Hourglass","general","Minute or hour glass.","1","300",""
"Scale, merchant","general","Balance and weights.","3","160",""
"Abacus","general","Counting frame.","2","40",""
"Musical instrument, common","general","Flute, drum, or cheap lute.","2","160",""
"Musical instrument, fine","general","Well-made lute or harp.","5","800",""
"Signal whistle","general","Piercing whistle.","0.1","4",""
"Hunting horn","general","Carrying horn.","2","100",""
"Fishing tackle","general","Line, hooks, corks.","2","20",""
"Net, fishing","general","Weighted net.","8","60",""
"Soap","general","Bar of soap.","0.5","2",""
"Perfume, vial","general","Scented oil.","0.2","100",""
"Sealing wax","general","Stick of wax.","0.2","10",""
"Signet ring","general","Personal seal.","0.1","100",""
"Map, local","general","County or city map.","0.1","160",""
"Map, regional","general","Realm map, uneven quality.","0.1","400",""
"Compass","general","Magnetic needle.","0.3","500",""
"Saddle, riding","general","Common riding saddle.","20","300",""
"Saddle, war","general","High-cantle war saddle.","30","800",""
"Saddlebags","general","Pair of bags.","8","80",""
"Bit and bridle","general","Horse tack.","2","40",""
"Donkey","general","Pack beast.","0","240",""
"Mule","general","Sturdy pack and riding beast.","0","400",""
"Riding horse","general","Common hack.","0","1500",""
"Draft horse","general","Wagon horse.","0","1000",""
"Warhorse","general","Trained destrier.","0","8000",""
"Pony","general","Small mount.","0","600",""
"Cart","general","Two-wheel cart.","200","300",""
"Wagon","general","Four-wheel wagon.","400","800",""
"Carriage","general","Passenger coach.","600","4000",""
"Rowboat","general","Small boat.","120","1000",""
"Keelboat","general","River boat.","0","15000",""
"Sailing ship, small","general","Coast trader.","0","60000",""
"Chest, wooden","general","Lockable chest.","25","100",""
"Chest, iron-bound","general","Strong chest.","50","400",""
"Barrel","general","Cask, empty.","30","40",""
"Crate","general","Nail-built box.","15","20",""
"Ladder (10 ft)","general","Wooden ladder.","20","20",""
"Pole (10 ft)","general","Ash pole.","8","2",""
"Ink (vial)","general","Black ink.","0.1","160",""
"Chalk (10)","general","Marking sticks.","0.2","2",""
"Paint, pot","general","Small pigment pot.","1","40",""
"Spy-glass case","general","Leather tube.","0.5","40",""
"Tent stake set","general","Wood or iron stakes.","3","6",""
"Whetstone","general","Sharpening stone.","1","4",""
"Needle and thread","general","Repair kit.","0.1","4",""
"Winter blanket roll","general","Bedroll plus extra wool.","9","60",""
"Rain cloak, oiled","general","Waxed canvas cloak.","4","80",""
"Snowshoes","general","Pair.","4","100",""
"Skis","general","Pair and pole.","12","160",""
"Torch, storm","general","Pitch torch that takes weather better.","1.5","4",""
"Holy water (flask)","general","Blessed water.","1","300",""
"Acid (vial)","general","Strong acid.","1","200",""
"Antitoxin (vial)","general","Mundane anti-venom.","0.2","400",""
"Healing draught","general","Common stimulant tonic, not a miracle.","0.3","300",""
"Poison, simple (vial)","general","Restricted in most towns.","0.2","1000",""
"Banner","general","House or company cloth.","3","160",""
"Tent, pavilion","general","Lord's camp tent.","80","2400",""
"Portable altar","general","Small traveling shrine.","8","500",""
"Scabbard","general","Fitted sheath.","1","40",""
"Weapon oil","general","Protective oil.","0.3","10",""
"Armor repair kit","general","Rings, leather, rivets.","4","160",""`;

const SCIFI_EQ_CSV = `"Item","Type","Description","weight(lbs)","cost($)","TL"
"Dagger","weapons","Short blade for close work and throwing.","1","40",""
"Knife","weapons","Camp and kitchen knife, poor as a weapon.","0.5","10",""
"Shortsword","weapons","One-handed blade for tight halls.","3","160",""
"Sword Arming","weapons","Standard one-handed knight's sword.","4","300",""
"Sword Long","weapons","Hand-and-a-half blade.","5","500",""
"Sword Great","weapons","Two-handed cutting sword.","8","800",""
"Hand axe","weapons","One-handed axe; also splits kindling.","3","100",""
"Battleaxe","weapons","Heavy one- or two-handed war axe.","6","240",""
"Greataxe","weapons","Two-handed executioner's axe.","10","500",""
"Mace","weapons","Flanged crushing head.","5","160",""
"WarHammer","weapons","Pick and face for mail and plate.","5","240",""
"Maul","weapons","Two-handed hammer.","12","300",""
"Spear Short","weapons","Thrusting shaft, 6–7 feet.","6","80",""
"Pike","weapons","Long formation spear, awkward indoors.","12","160",""
"Halberd","weapons","Axe-blade, hook, and point on a pole.","12","300",""
"Quarterstaff","weapons","Hardwood staff.","4","4",""
"Club","weapons","Simple bludgeon.","3","2",""
"Morning Star","weapons","Spiked striking head.","6","240",""
"Flail","weapons","Hinged striking head; ignores some shields in close.","6","200",""
"Rapier","weapons","Thrusting civilian blade.","2","400",""
"Scimitar","weapons","Curved slashing blade.","3","360",""
"Hand crossbow","weapons","One-handed light crossbow.","3","600",""
"Light Crossbow","weapons","Standard spanned bow.","6","400",""
"Heavy Crossbow","weapons","Slow, hard-hitting spanned bow.","12","800",""
"Short Bow","weapons","Hunting bow.","2","240",""
"Longbow","weapons","War bow; needs room to draw.","3","600",""
"Sling","weapons","Leather pouch and cords.","0.2","2",""
"Javelin thrown","weapons","Light throwing spear.","2","20",""
"Axe Thrown","weapons","Balanced hatchet.","2","60",""
"Arrows (20)","weapons","Sheaf for bows.","2","20",""
"Quarrels (20)","weapons","Bolts for crossbows.","2","30",""
"Sling bullets (20)","weapons","Lead or baked clay.","2","4",""
"Blowgun","weapons","Tube and darts sold separate.","1","80",""
"Darts (20)","weapons","Blowgun or throwing darts.","1","20",""
"Whip","weapons","Long lash.","2","40",""
"Man-catcher","weapons","Forked capture pole.","8","240",""
"Fighting Net","weapons","Entangling net.","6","100",""
"Caltrops (bag)","weapons","Enough to cover 5 feet.","2","20",""
"BrassKnuckles","weapons","Metal knuckledusters worn over the fist.","0.5","40",""
"Cudgel","weapons","Stout wooden club, quick and dirty.","2","10",""
"Sword Stabbing","weapons","Narrow blade built for the thrust.","2","300",""
"Sword Willow-leaf","weapons","Elven sword with a tapered leaf-shaped blade.","3","440",""
"Sword Broad","weapons","Wide double-edged blade for heavy cuts.","5","440",""
"Sword Foil","weapons","Light thrusting blade for quick, precise strikes.","2","360",""
"Sword Sabre","weapons","Curved cavalry blade, quick in the cut.","3","400",""
"Sword Katana","weapons","Curved single-edged blade, prized for its keen edge.","3","700",""
"Hammer","weapons","One-handed dwarven war hammer.","4","200",""
"SpikeHammer","weapons","Hammer fitted with a piercing spike.","5","280",""
"Nordic/Norman Axe","weapons","One-handed axe favored by northern raiders.","4","240",""
"WarAxe","weapons","Heavy two-handed dwarven battle axe.","8","400",""
"Lance","weapons","Long cavalry lance for mounted combat.","10","360",""
"Lance(charge)","weapons","Long cavalry lance, deadliest at a charge.","10","400",""
"Sling Staff","weapons","Staff-sling for hurling stones with greater force.","3","160",""
"Composite Bow","weapons","Layered bow with extra draw power.","2","800",""
"Dagger Thrown","weapons","Balanced dagger meant for throwing.","1","40",""
"Club Thrown","weapons","Weighted club balanced for throwing.","2","40",""
"Rock Thrown","weapons","Fist-sized stone, good for throwing.","1","1",""
"Padded jack","armor","Quilted cloth armor.","8","100","3"
"Leather jerkin","armor","Boiled or layered leather.","10","200","3"
"Studded leather","armor","Leather with metal rivets.","15","500","3"
"Hide armor","armor","Thick hides and pelts.","20","240","3"
"Mail shirt","armor","Torso mail.","25","1200","3"
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","2000","3"
"Scale shirt","armor","Overlapping metal scales.","30","1600","3"
"Breastplate","armor","Solid chest and back.","20","4000","3"
"Half plate","armor","Breast, greaves, and vambraces.","40","7000","3"
"Full plate","armor","Complete articulated harness.","55","15000","3"
"Helmet, cap","armor","Simple steel cap.","3","160","3"
"Helmet, open","armor","Nasal or kettle helm.","5","300","3"
"Helmet, closed","armor","Visored helm.","8","800","3"
"Shield, buckler","armor","Small fist shield.","3","100","3"
"Shield, round","armor","Common wooden shield with boss.","6","160","3"
"Shield, kite","armor","Tall cavalry or foot shield.","10","240","3"
"Shield, tower","armor","Full-height pavise.","18","400","3"
"Barding, leather","armor","Horse leather armor.","40","800","3"
"Barding, mail","armor","Horse mail.","70","4000","3"
"Barding, plate","armor","Horse plate.","90","10000","3"
"Backpack","general","Leather pack, about 40 lb capacity.","2","40",""
"Sack","general","Burlap or canvas bag.","0.5","2",""
"Belt pouch","general","Small pouch for coin and flint.","0.2","6",""
"Waterskin (1 gal)","general","Filled skin; weight is full.","8","20",""
"Wineskin (1 gal)","general","As waterskin, for drink.","8","20",""
"Flask, metal","general","Pint flask.","1","40",""
"Vial, glass","general","Small stopper vial.","0.1","20",""
"Crowbar","general","Iron bar for prying.","5","40",""
"Hammer","general","Camp and nail hammer.","2","20",""
"Sledge","general","Heavy driving hammer.","10","60",""
"Pick, miner's","general","Breaking stone and packed earth.","8","80",""
"Shovel","general","Digging spade.","6","40",""
"Hand saw","general","Wood saw.","2","40",""
"Woodcutter's axe","general","Felling axe, not balanced for war.","6","60",""
"Block and tackle","general","Rope pulley for heavy lifts.","5","160",""
"Chain (10 ft)","general","Iron links.","10","160",""
"Rope, hemp (50 ft)","general","Common rope.","10","20",""
"Rope, silk (50 ft)","general","Lighter, stronger line.","5","200",""
"Grappling hook","general","Three-prong hook.","4","40",""
"Pitons (10)","general","Iron spikes for climbing.","5","40",""
"Manacles","general","Wrist irons and short chain.","2","160",""
"Lock, simple","general","Cheap padlock.","0.5","160",""
"Lock, good","general","Better wards.","1","400",""
"Lock, fine","general","Hard to pick.","1","1000",""
"Thieves' tools","general","Picks, shims, small saw, files.","1","500",""
"Artisan tools (set)","general","One trade: smith, carpenter, tailor, etc.","8","400",""
"Healer's kit","general","Bandages, needle, salves for 10 uses.","3","160",""
"Herbalism pouch","general","Pouches and small knife for gathering.","2","100",""
"Alchemist's kit","general","Vials, burner, glassware.","8","800",""
"Writing kit","general","Ink, quills, wax, small knife.","2","160",""
"Parchment (sheet)","general","One sheet.","0.05","4",""
"Book, blank","general","Bound empty book.","3","400",""
"Book, printed or copied","general","Common treatise.","3","600",""
"Lantern, hooded","general","Shuttered oil lantern.","2","160",""
"Lantern, bullseye","general","Directed beam.","3","240",""
"Torch","general","Resin torch, about 1 hour.","1","1",""
"Lamp, clay","general","Simple oil lamp.","1","6",""
"Oil flask","general","1 pint lamp oil, about 6 hours.","1","2",""
"Candles (10)","general","Tallow candles.","1","2",""
"Tinderbox","general","Flint, steel, and tinder.","0.5","10",""
"Bedroll","general","Blanket and ground cloth.","5","20",""
"Blanket, winter","general","Heavy wool.","4","40",""
"Tent, one-man","general","Oilcloth shelter.","10","160",""
"Tent, four-man","general","Larger camp tent.","30","500",""
"Mess kit","general","Cup, plate, and spoon.","1","16",""
"Cookpot","general","Iron pot.","8","60",""
"Rations, poor (1 day)","general","Hard bread and dried beans.","1","2",""
"Rations, trail (1 day)","general","Dried meat, hardtack, dried fruit.","2","10",""
"Rations, fine (1 day)","general","Cheese, sausage, decent bread.","2","30",""
"Feed, horse (1 day)","general","Grain and hay portion.","10","2",""
"Ale, pint","general","Common tap ale.","1","1",""
"Wine, cheap bottle","general","Rough table wine.","2","4",""
"Wine, good bottle","general","Decent vintage.","2","40",""
"Spirits, flask","general","Strong drink.","1","20",""
"Lodging, common (night)","general","Shared room or pallet.","0","6",""
"Lodging, private (night)","general","Own room at an inn.","0","20",""
"Lodging, fine (night)","general","Good inn, bath and meal.","0","100",""
"Meal, poor","general","Stew and bread.","0","1",""
"Meal, common","general","Meat, bread, ale.","0","4",""
"Meal, fine","general","Roast and wine.","0","20",""
"Clothes, poor","general","Worn shirt, hose, wrap.","3","10",""
"Clothes, common","general","Shirt, breeches, cloak, shoes.","4","40",""
"Clothes, travel","general","Boots, cloak, sturdy coat.","6","100",""
"Clothes, fine","general","Dyed cloth and trim.","4","400",""
"Clothes, noble court","general","Silk or velvet display.","5","1600",""
"Cloak, wool","general","Weather cloak.","3","40",""
"Cloak, winter","general","Fur-lined.","6","160",""
"Boots, common","general","Leather boots.","2","40",""
"Boots, riding","general","Tall boots.","3","100",""
"Gloves","general","Work or riding gloves.","0.3","20",""
"Belt","general","Leather belt.","0.3","6",""
"Holy symbol, wood","general","Carved token.","0.2","20",""
"Holy symbol, silver","general","Worked silver.","0.3","300",""
"Spell component pouch","general","Small pouches and vials.","2","100",""
"Focus, wooden wand","general","Simple magical focus.","0.5","160",""
"Focus, crystal","general","Cut crystal focus.","0.5","800",""
"Mirror, steel","general","Polished plate.","0.5","100",""
"Mirror, silvered","general","True glass mirror.","1","400",""
"Spyglass","general","Short brass scope.","1","1600",""
"Hourglass","general","Minute or hour glass.","1","300",""
"Scale, merchant","general","Balance and weights.","3","160",""
"Abacus","general","Counting frame.","2","40",""
"Musical instrument, common","general","Flute, drum, or cheap lute.","2","160",""
"Musical instrument, fine","general","Well-made lute or harp.","5","800",""
"Signal whistle","general","Piercing whistle.","0.1","4",""
"Hunting horn","general","Carrying horn.","2","100",""
"Fishing tackle","general","Line, hooks, corks.","2","20",""
"Net, fishing","general","Weighted net.","8","60",""
"Soap","general","Bar of soap.","0.5","2",""
"Perfume, vial","general","Scented oil.","0.2","100",""
"Sealing wax","general","Stick of wax.","0.2","10",""
"Signet ring","general","Personal seal.","0.1","100",""
"Map, local","general","County or city map.","0.1","160",""
"Map, regional","general","Realm map, uneven quality.","0.1","400",""
"Compass","general","Magnetic needle.","0.3","500",""
"Saddle, riding","general","Common riding saddle.","20","300",""
"Saddle, war","general","High-cantle war saddle.","30","800",""
"Saddlebags","general","Pair of bags.","8","80",""
"Bit and bridle","general","Horse tack.","2","40",""
"Donkey","general","Pack beast.","0","240",""
"Mule","general","Sturdy pack and riding beast.","0","400",""
"Riding horse","general","Common hack.","0","1500",""
"Draft horse","general","Wagon horse.","0","1000",""
"Warhorse","general","Trained destrier.","0","8000",""
"Pony","general","Small mount.","0","600",""
"Cart","general","Two-wheel cart.","200","300",""
"Wagon","general","Four-wheel wagon.","400","800",""
"Carriage","general","Passenger coach.","600","4000",""
"Rowboat","general","Small boat.","120","1000",""
"Keelboat","general","River boat.","0","15000",""
"Sailing ship, small","general","Coast trader.","0","60000",""
"Chest, wooden","general","Lockable chest.","25","100",""
"Chest, iron-bound","general","Strong chest.","50","400",""
"Barrel","general","Cask, empty.","30","40",""
"Crate","general","Nail-built box.","15","20",""
"Ladder (10 ft)","general","Wooden ladder.","20","20",""
"Pole (10 ft)","general","Ash pole.","8","2",""
"Ink (vial)","general","Black ink.","0.1","160",""
"Chalk (10)","general","Marking sticks.","0.2","2",""
"Paint, pot","general","Small pigment pot.","1","40",""
"Spy-glass case","general","Leather tube.","0.5","40",""
"Tent stake set","general","Wood or iron stakes.","3","6",""
"Whetstone","general","Sharpening stone.","1","4",""
"Needle and thread","general","Repair kit.","0.1","4",""
"Winter blanket roll","general","Bedroll plus extra wool.","9","60",""
"Rain cloak, oiled","general","Waxed canvas cloak.","4","80",""
"Snowshoes","general","Pair.","4","100",""
"Skis","general","Pair and pole.","12","160",""
"Torch, storm","general","Pitch torch that takes weather better.","1.5","4",""
"Holy water (flask)","general","Blessed water.","1","300",""
"Acid (vial)","general","Strong acid.","1","200",""
"Antitoxin (vial)","general","Mundane anti-venom.","0.2","400",""
"Healing draught","general","Common stimulant tonic, not a miracle.","0.3","300",""
"Poison, simple (vial)","general","Restricted in most towns.","0.2","1000",""
"Banner","general","House or company cloth.","3","160",""
"Tent, pavilion","general","Lord's camp tent.","80","2400",""
"Portable altar","general","Small traveling shrine.","8","500",""
"Scabbard","general","Fitted sheath.","1","40",""
"Weapon oil","general","Protective oil.","0.3","10",""
"Armor repair kit","general","Rings, leather, rivets.","4","160",""`;

const APOCALYPTIC_EQ_CSV = `"Item","Type","Description","weight(lbs)","cost($)","TL"
"Dagger","weapons","Short blade for close work and throwing.","1","40",""
"Knife","weapons","Camp and kitchen knife, poor as a weapon.","0.5","10",""
"Shortsword","weapons","One-handed blade for tight halls.","3","160",""
"Sword Arming","weapons","Standard one-handed knight's sword.","4","300",""
"Sword Long","weapons","Hand-and-a-half blade.","5","500",""
"Sword Great","weapons","Two-handed cutting sword.","8","800",""
"Hand axe","weapons","One-handed axe; also splits kindling.","3","100",""
"Battleaxe","weapons","Heavy one- or two-handed war axe.","6","240",""
"Greataxe","weapons","Two-handed executioner's axe.","10","500",""
"Mace","weapons","Flanged crushing head.","5","160",""
"WarHammer","weapons","Pick and face for mail and plate.","5","240",""
"Maul","weapons","Two-handed hammer.","12","300",""
"Spear Short","weapons","Thrusting shaft, 6–7 feet.","6","80",""
"Pike","weapons","Long formation spear, awkward indoors.","12","160",""
"Halberd","weapons","Axe-blade, hook, and point on a pole.","12","300",""
"Quarterstaff","weapons","Hardwood staff.","4","4",""
"Club","weapons","Simple bludgeon.","3","2",""
"Morning Star","weapons","Spiked striking head.","6","240",""
"Flail","weapons","Hinged striking head; ignores some shields in close.","6","200",""
"Rapier","weapons","Thrusting civilian blade.","2","400",""
"Scimitar","weapons","Curved slashing blade.","3","360",""
"Hand crossbow","weapons","One-handed light crossbow.","3","600",""
"Light Crossbow","weapons","Standard spanned bow.","6","400",""
"Heavy Crossbow","weapons","Slow, hard-hitting spanned bow.","12","800",""
"Short Bow","weapons","Hunting bow.","2","240",""
"Longbow","weapons","War bow; needs room to draw.","3","600",""
"Sling","weapons","Leather pouch and cords.","0.2","2",""
"Javelin thrown","weapons","Light throwing spear.","2","20",""
"Axe Thrown","weapons","Balanced hatchet.","2","60",""
"Arrows (20)","weapons","Sheaf for bows.","2","20",""
"Quarrels (20)","weapons","Bolts for crossbows.","2","30",""
"Sling bullets (20)","weapons","Lead or baked clay.","2","4",""
"Blowgun","weapons","Tube and darts sold separate.","1","80",""
"Darts (20)","weapons","Blowgun or throwing darts.","1","20",""
"Whip","weapons","Long lash.","2","40",""
"Man-catcher","weapons","Forked capture pole.","8","240",""
"Fighting Net","weapons","Entangling net.","6","100",""
"Caltrops (bag)","weapons","Enough to cover 5 feet.","2","20",""
"BrassKnuckles","weapons","Metal knuckledusters worn over the fist.","0.5","40",""
"Cudgel","weapons","Stout wooden club, quick and dirty.","2","10",""
"Sword Stabbing","weapons","Narrow blade built for the thrust.","2","300",""
"Sword Willow-leaf","weapons","Elven sword with a tapered leaf-shaped blade.","3","440",""
"Sword Broad","weapons","Wide double-edged blade for heavy cuts.","5","440",""
"Sword Foil","weapons","Light thrusting blade for quick, precise strikes.","2","360",""
"Sword Sabre","weapons","Curved cavalry blade, quick in the cut.","3","400",""
"Sword Katana","weapons","Curved single-edged blade, prized for its keen edge.","3","700",""
"Hammer","weapons","One-handed dwarven war hammer.","4","200",""
"SpikeHammer","weapons","Hammer fitted with a piercing spike.","5","280",""
"Nordic/Norman Axe","weapons","One-handed axe favored by northern raiders.","4","240",""
"WarAxe","weapons","Heavy two-handed dwarven battle axe.","8","400",""
"Lance","weapons","Long cavalry lance for mounted combat.","10","360",""
"Lance(charge)","weapons","Long cavalry lance, deadliest at a charge.","10","400",""
"Sling Staff","weapons","Staff-sling for hurling stones with greater force.","3","160",""
"Composite Bow","weapons","Layered bow with extra draw power.","2","800",""
"Dagger Thrown","weapons","Balanced dagger meant for throwing.","1","40",""
"Club Thrown","weapons","Weighted club balanced for throwing.","2","40",""
"Rock Thrown","weapons","Fist-sized stone, good for throwing.","1","1",""
"Padded jack","armor","Quilted cloth armor.","8","100","3"
"Leather jerkin","armor","Boiled or layered leather.","10","200","3"
"Studded leather","armor","Leather with metal rivets.","15","500","3"
"Hide armor","armor","Thick hides and pelts.","20","240","3"
"Mail shirt","armor","Torso mail.","25","1200","3"
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","2000","3"
"Scale shirt","armor","Overlapping metal scales.","30","1600","3"
"Breastplate","armor","Solid chest and back.","20","4000","3"
"Half plate","armor","Breast, greaves, and vambraces.","40","7000","3"
"Full plate","armor","Complete articulated harness.","55","15000","3"
"Helmet, cap","armor","Simple steel cap.","3","160","3"
"Helmet, open","armor","Nasal or kettle helm.","5","300","3"
"Helmet, closed","armor","Visored helm.","8","800","3"
"Shield, buckler","armor","Small fist shield.","3","100","3"
"Shield, round","armor","Common wooden shield with boss.","6","160","3"
"Shield, kite","armor","Tall cavalry or foot shield.","10","240","3"
"Shield, tower","armor","Full-height pavise.","18","400","3"
"Barding, leather","armor","Horse leather armor.","40","800","3"
"Barding, mail","armor","Horse mail.","70","4000","3"
"Barding, plate","armor","Horse plate.","90","10000","3"
"Backpack","general","Leather pack, about 40 lb capacity.","2","40",""
"Sack","general","Burlap or canvas bag.","0.5","2",""
"Belt pouch","general","Small pouch for coin and flint.","0.2","6",""
"Waterskin (1 gal)","general","Filled skin; weight is full.","8","20",""
"Wineskin (1 gal)","general","As waterskin, for drink.","8","20",""
"Flask, metal","general","Pint flask.","1","40",""
"Vial, glass","general","Small stopper vial.","0.1","20",""
"Crowbar","general","Iron bar for prying.","5","40",""
"Hammer","general","Camp and nail hammer.","2","20",""
"Sledge","general","Heavy driving hammer.","10","60",""
"Pick, miner's","general","Breaking stone and packed earth.","8","80",""
"Shovel","general","Digging spade.","6","40",""
"Hand saw","general","Wood saw.","2","40",""
"Woodcutter's axe","general","Felling axe, not balanced for war.","6","60",""
"Block and tackle","general","Rope pulley for heavy lifts.","5","160",""
"Chain (10 ft)","general","Iron links.","10","160",""
"Rope, hemp (50 ft)","general","Common rope.","10","20",""
"Rope, silk (50 ft)","general","Lighter, stronger line.","5","200",""
"Grappling hook","general","Three-prong hook.","4","40",""
"Pitons (10)","general","Iron spikes for climbing.","5","40",""
"Manacles","general","Wrist irons and short chain.","2","160",""
"Lock, simple","general","Cheap padlock.","0.5","160",""
"Lock, good","general","Better wards.","1","400",""
"Lock, fine","general","Hard to pick.","1","1000",""
"Thieves' tools","general","Picks, shims, small saw, files.","1","500",""
"Artisan tools (set)","general","One trade: smith, carpenter, tailor, etc.","8","400",""
"Healer's kit","general","Bandages, needle, salves for 10 uses.","3","160",""
"Herbalism pouch","general","Pouches and small knife for gathering.","2","100",""
"Alchemist's kit","general","Vials, burner, glassware.","8","800",""
"Writing kit","general","Ink, quills, wax, small knife.","2","160",""
"Parchment (sheet)","general","One sheet.","0.05","4",""
"Book, blank","general","Bound empty book.","3","400",""
"Book, printed or copied","general","Common treatise.","3","600",""
"Lantern, hooded","general","Shuttered oil lantern.","2","160",""
"Lantern, bullseye","general","Directed beam.","3","240",""
"Torch","general","Resin torch, about 1 hour.","1","1",""
"Lamp, clay","general","Simple oil lamp.","1","6",""
"Oil flask","general","1 pint lamp oil, about 6 hours.","1","2",""
"Candles (10)","general","Tallow candles.","1","2",""
"Tinderbox","general","Flint, steel, and tinder.","0.5","10",""
"Bedroll","general","Blanket and ground cloth.","5","20",""
"Blanket, winter","general","Heavy wool.","4","40",""
"Tent, one-man","general","Oilcloth shelter.","10","160",""
"Tent, four-man","general","Larger camp tent.","30","500",""
"Mess kit","general","Cup, plate, and spoon.","1","16",""
"Cookpot","general","Iron pot.","8","60",""
"Rations, poor (1 day)","general","Hard bread and dried beans.","1","2",""
"Rations, trail (1 day)","general","Dried meat, hardtack, dried fruit.","2","10",""
"Rations, fine (1 day)","general","Cheese, sausage, decent bread.","2","30",""
"Feed, horse (1 day)","general","Grain and hay portion.","10","2",""
"Ale, pint","general","Common tap ale.","1","1",""
"Wine, cheap bottle","general","Rough table wine.","2","4",""
"Wine, good bottle","general","Decent vintage.","2","40",""
"Spirits, flask","general","Strong drink.","1","20",""
"Lodging, common (night)","general","Shared room or pallet.","0","6",""
"Lodging, private (night)","general","Own room at an inn.","0","20",""
"Lodging, fine (night)","general","Good inn, bath and meal.","0","100",""
"Meal, poor","general","Stew and bread.","0","1",""
"Meal, common","general","Meat, bread, ale.","0","4",""
"Meal, fine","general","Roast and wine.","0","20",""
"Clothes, poor","general","Worn shirt, hose, wrap.","3","10",""
"Clothes, common","general","Shirt, breeches, cloak, shoes.","4","40",""
"Clothes, travel","general","Boots, cloak, sturdy coat.","6","100",""
"Clothes, fine","general","Dyed cloth and trim.","4","400",""
"Clothes, noble court","general","Silk or velvet display.","5","1600",""
"Cloak, wool","general","Weather cloak.","3","40",""
"Cloak, winter","general","Fur-lined.","6","160",""
"Boots, common","general","Leather boots.","2","40",""
"Boots, riding","general","Tall boots.","3","100",""
"Gloves","general","Work or riding gloves.","0.3","20",""
"Belt","general","Leather belt.","0.3","6",""
"Holy symbol, wood","general","Carved token.","0.2","20",""
"Holy symbol, silver","general","Worked silver.","0.3","300",""
"Spell component pouch","general","Small pouches and vials.","2","100",""
"Focus, wooden wand","general","Simple magical focus.","0.5","160",""
"Focus, crystal","general","Cut crystal focus.","0.5","800",""
"Mirror, steel","general","Polished plate.","0.5","100",""
"Mirror, silvered","general","True glass mirror.","1","400",""
"Spyglass","general","Short brass scope.","1","1600",""
"Hourglass","general","Minute or hour glass.","1","300",""
"Scale, merchant","general","Balance and weights.","3","160",""
"Abacus","general","Counting frame.","2","40",""
"Musical instrument, common","general","Flute, drum, or cheap lute.","2","160",""
"Musical instrument, fine","general","Well-made lute or harp.","5","800",""
"Signal whistle","general","Piercing whistle.","0.1","4",""
"Hunting horn","general","Carrying horn.","2","100",""
"Fishing tackle","general","Line, hooks, corks.","2","20",""
"Net, fishing","general","Weighted net.","8","60",""
"Soap","general","Bar of soap.","0.5","2",""
"Perfume, vial","general","Scented oil.","0.2","100",""
"Sealing wax","general","Stick of wax.","0.2","10",""
"Signet ring","general","Personal seal.","0.1","100",""
"Map, local","general","County or city map.","0.1","160",""
"Map, regional","general","Realm map, uneven quality.","0.1","400",""
"Compass","general","Magnetic needle.","0.3","500",""
"Saddle, riding","general","Common riding saddle.","20","300",""
"Saddle, war","general","High-cantle war saddle.","30","800",""
"Saddlebags","general","Pair of bags.","8","80",""
"Bit and bridle","general","Horse tack.","2","40",""
"Donkey","general","Pack beast.","0","240",""
"Mule","general","Sturdy pack and riding beast.","0","400",""
"Riding horse","general","Common hack.","0","1500",""
"Draft horse","general","Wagon horse.","0","1000",""
"Warhorse","general","Trained destrier.","0","8000",""
"Pony","general","Small mount.","0","600",""
"Cart","general","Two-wheel cart.","200","300",""
"Wagon","general","Four-wheel wagon.","400","800",""
"Carriage","general","Passenger coach.","600","4000",""
"Rowboat","general","Small boat.","120","1000",""
"Keelboat","general","River boat.","0","15000",""
"Sailing ship, small","general","Coast trader.","0","60000",""
"Chest, wooden","general","Lockable chest.","25","100",""
"Chest, iron-bound","general","Strong chest.","50","400",""
"Barrel","general","Cask, empty.","30","40",""
"Crate","general","Nail-built box.","15","20",""
"Ladder (10 ft)","general","Wooden ladder.","20","20",""
"Pole (10 ft)","general","Ash pole.","8","2",""
"Ink (vial)","general","Black ink.","0.1","160",""
"Chalk (10)","general","Marking sticks.","0.2","2",""
"Paint, pot","general","Small pigment pot.","1","40",""
"Spy-glass case","general","Leather tube.","0.5","40",""
"Tent stake set","general","Wood or iron stakes.","3","6",""
"Whetstone","general","Sharpening stone.","1","4",""
"Needle and thread","general","Repair kit.","0.1","4",""
"Winter blanket roll","general","Bedroll plus extra wool.","9","60",""
"Rain cloak, oiled","general","Waxed canvas cloak.","4","80",""
"Snowshoes","general","Pair.","4","100",""
"Skis","general","Pair and pole.","12","160",""
"Torch, storm","general","Pitch torch that takes weather better.","1.5","4",""
"Holy water (flask)","general","Blessed water.","1","300",""
"Acid (vial)","general","Strong acid.","1","200",""
"Antitoxin (vial)","general","Mundane anti-venom.","0.2","400",""
"Healing draught","general","Common stimulant tonic, not a miracle.","0.3","300",""
"Poison, simple (vial)","general","Restricted in most towns.","0.2","1000",""
"Banner","general","House or company cloth.","3","160",""
"Tent, pavilion","general","Lord's camp tent.","80","2400",""
"Portable altar","general","Small traveling shrine.","8","500",""
"Scabbard","general","Fitted sheath.","1","40",""
"Weapon oil","general","Protective oil.","0.3","10",""
"Armor repair kit","general","Rings, leather, rivets.","4","160",""`;
// Equipment is genre-specific (data/{genre}_eq.csv) — each file lists its
// own cost column, in whichever unit matches that genre's usual Tech Level:
// Fantasy's cost(GT) column, or cost($) for the TL > 3 genres (Modern,
// Dystopian, SciFi, Apocalyptic), authored directly in dollars rather than
// derived — a future edit to a genre's $ prices changes its real purchasing
// power too, not just the display. parseEquipmentCsv() detects which
// column is present and keeps both `cost` (GT) and `modernCost` ($, always
// cost x20) populated either way, so the rest of the app can read whichever
// one the active Tech Level calls for.
function parseEquipmentCsv(csv) {
  const rows = parseCsvWithHeader(csv);
  const costKey = Object.keys(rows[0] || {}).find((k) => k.startsWith('cost('));
  const isDollars = costKey === 'cost($)';
  return rows.map((r) => {
    const raw = parseFloat(r[costKey]) || 0;
    const cost = isDollars ? raw / 20 : raw;
    return {
      name: r.Item,
      type: r.Type,
      description: r.Description,
      weight: parseFloat(r['weight(lbs)']) || 0,
      cost,
      modernCost: cost * 20,
      tl: r.TL ? Number(r.TL) : null,
    };
  });
}

// Morrow Project's equipment file (data/morrow_project_eq.csv) is a
// byte-identical copy of Modern's at genre-creation time — reuse it directly
// rather than re-embedding the same ~217 rows twice.
const MORROW_PROJECT_EQ_CSV = MODERN_EQ_CSV;

const EQUIPMENT = parseEquipmentCsv(EQUIPMENT_CSV);
const MODERN_EQUIPMENT = parseEquipmentCsv(MODERN_EQ_CSV);
const DYSTOPIAN_EQUIPMENT = parseEquipmentCsv(DYSTOPIAN_EQ_CSV);
const SCIFI_EQUIPMENT = parseEquipmentCsv(SCIFI_EQ_CSV);
const APOCALYPTIC_EQUIPMENT = parseEquipmentCsv(APOCALYPTIC_EQ_CSV);
const MORROW_PROJECT_EQUIPMENT = parseEquipmentCsv(MORROW_PROJECT_EQ_CSV);

const GENRE_EQUIPMENT = {
  Fantasy: EQUIPMENT,
  Modern: MODERN_EQUIPMENT,
  Dystopian: DYSTOPIAN_EQUIPMENT,
  SciFi: SCIFI_EQUIPMENT,
  Apocalyptic: APOCALYPTIC_EQUIPMENT,
  'morrow_project': MORROW_PROJECT_EQUIPMENT,
};

function getActiveEquipment(genre) {
  return GENRE_EQUIPMENT[genre] || EQUIPMENT;
}

// ---------------------------------------------------------------------------
// Armor detail (data/{genre}_armor.csv) — a SEPARATE, richer catalog from
// Equipment's own 'armor'-type rows (which stay purchase-only: name, cost,
// weight, TL — same as before). This file is where an armor item's actual
// protection values and stamina cost live; the Equipped panel looks a
// purchased armor item up by name in here, exactly how the Equipped
// Weapons tables already resolve a bought weapon against
// MELEE_WEAPONS/RANGED_WEAPONS for its damage stats — Equipment decides
// what you can buy, this decides what it does once worn.
// ---------------------------------------------------------------------------

const FANTASY_ARMOR_CSV = `name,type,description,weight,cost,TL,staminaCost,impact,pierce,slash,energy,ballistic,material
"Padded jack","armor","Quilted cloth armor.","8","5","3",1,2,1,3,0,3,flexible
"Leather jerkin","armor","Boiled or layered leather.","10","10","3",1,2,2,3,0,3,flexible
"Studded leather","armor","Leather with metal rivets.","15","25","3",2,3,2,4,0,3,flexible
"Hide armor","armor","Thick hides and pelts.","20","12","3",2,3,2,3,0,3,flexible
"Mail shirt","armor","Torso mail.","25","60","3",3,3,4,5,0,3,flexible
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","100","3",4,4,5,6,0,3,flexible
"Scale shirt","armor","Overlapping metal scales.","30","80","3",3,4,4,5,0,3,Plate
"Breastplate","armor","Solid chest and back.","20","200","3",2,5,5,6,0,3,Plate
"Half plate","armor","Breast, greaves, and vambraces.","40","350","3",4,6,6,7,0,3,Plate
"Full plate","armor","Complete articulated harness.","55","750","3",6,7,7,8,0,3,Plate
"Helmet, cap","armor","Simple steel cap.","3","8","3",1,3,3,4,0,3,Plate
"Helmet, open","armor","Nasal or kettle helm.","5","15","3",1,4,4,5,0,3,Plate
"Helmet, closed","armor","Visored helm.","8","40","3",1,5,5,6,0,3,Plate
"Shield, buckler","armor","Small fist shield.","3","5","3",1,2,2,2,0,3,flexible
"Shield, round","armor","Common wooden shield with boss.","6","8","3",1,3,2,3,0,3,flexible
"Shield, kite","armor","Tall cavalry or foot shield.","10","12","3",1,4,3,4,0,3,flexible
"Shield, tower","armor","Full-height pavise.","18","20","3",2,5,4,5,0,3,flexible
"Barding, leather","armor","Horse leather armor.","40","40","3",4,2,2,3,0,3,flexible
"Barding, mail","armor","Horse mail.","70","200","3",7,4,5,6,0,3,flexible
"Barding, plate","armor","Horse plate.","90","500","3",9,7,7,8,0,3,Plate
"Armor repair kit","general","Rings, leather, rivets.","4","8","",1,0,0,0,0,,flexible`;

const MODERN_ARMOR_CSV = `name,type,description,weight,cost,TL,staminaCost,impact,pierce,slash,energy,ballistic,material
"Padded jack","armor","Quilted cloth armor.","8","5","3",1,2,1,3,0,3,flexible
"Leather jerkin","armor","Boiled or layered leather.","10","10","3",1,2,2,3,0,3,flexible
"Studded leather","armor","Leather with metal rivets.","15","25","3",2,3,2,4,0,3,flexible
"Hide armor","armor","Thick hides and pelts.","20","12","3",2,3,2,3,0,3,flexible
"Mail shirt","armor","Torso mail.","25","60","3",3,3,4,5,0,3,flexible
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","100","3",4,4,5,6,0,3,flexible
"Scale shirt","armor","Overlapping metal scales.","30","80","3",3,4,4,5,0,3,Plate
"Breastplate","armor","Solid chest and back.","20","200","3",2,5,5,6,0,3,Plate
"Half plate","armor","Breast, greaves, and vambraces.","40","350","3",4,6,6,7,0,3,Plate
"Full plate","armor","Complete articulated harness.","55","750","3",6,7,7,8,0,3,Plate
"Helmet, cap","armor","Simple steel cap.","3","8","3",1,3,3,4,0,3,Plate
"Helmet, open","armor","Nasal or kettle helm.","5","15","3",1,4,4,5,0,3,Plate
"Helmet, closed","armor","Visored helm.","8","40","3",1,5,5,6,0,3,Plate
"Shield, buckler","armor","Small fist shield.","3","5","3",1,2,2,2,0,3,flexible
"Shield, round","armor","Common wooden shield with boss.","6","8","3",1,3,2,3,0,3,flexible
"Shield, kite","armor","Tall cavalry or foot shield.","10","12","3",1,4,3,4,0,3,flexible
"Shield, tower","armor","Full-height pavise.","18","20","3",2,5,4,5,0,3,flexible
"Barding, leather","armor","Horse leather armor.","40","40","3",4,2,2,3,0,3,flexible
"Barding, mail","armor","Horse mail.","70","200","3",7,4,5,6,0,3,flexible
"Barding, plate","armor","Horse plate.","90","500","3",9,7,7,8,0,3,Plate
"Armor repair kit","general","Rings, leather, rivets.","4","8","",1,0,0,0,0,,flexible`;

const DYSTOPIAN_ARMOR_CSV = `name,type,description,weight,cost,TL,staminaCost,impact,pierce,slash,energy,ballistic,material
"Padded jack","armor","Quilted cloth armor.","8","5","3",1,2,1,3,0,3,flexible
"Leather jerkin","armor","Boiled or layered leather.","10","10","3",1,2,2,3,0,3,flexible
"Studded leather","armor","Leather with metal rivets.","15","25","3",2,3,2,4,0,3,flexible
"Hide armor","armor","Thick hides and pelts.","20","12","3",2,3,2,3,0,3,flexible
"Mail shirt","armor","Torso mail.","25","60","3",3,3,4,5,0,3,flexible
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","100","3",4,4,5,6,0,3,flexible
"Scale shirt","armor","Overlapping metal scales.","30","80","3",3,4,4,5,0,3,Plate
"Breastplate","armor","Solid chest and back.","20","200","3",2,5,5,6,0,3,Plate
"Half plate","armor","Breast, greaves, and vambraces.","40","350","3",4,6,6,7,0,3,Plate
"Full plate","armor","Complete articulated harness.","55","750","3",6,7,7,8,0,3,Plate
"Helmet, cap","armor","Simple steel cap.","3","8","3",1,3,3,4,0,3,Plate
"Helmet, open","armor","Nasal or kettle helm.","5","15","3",1,4,4,5,0,3,Plate
"Helmet, closed","armor","Visored helm.","8","40","3",1,5,5,6,0,3,Plate
"Shield, buckler","armor","Small fist shield.","3","5","3",1,2,2,2,0,3,flexible
"Shield, round","armor","Common wooden shield with boss.","6","8","3",1,3,2,3,0,3,flexible
"Shield, kite","armor","Tall cavalry or foot shield.","10","12","3",1,4,3,4,0,3,flexible
"Shield, tower","armor","Full-height pavise.","18","20","3",2,5,4,5,0,3,flexible
"Barding, leather","armor","Horse leather armor.","40","40","3",4,2,2,3,0,3,flexible
"Barding, mail","armor","Horse mail.","70","200","3",7,4,5,6,0,3,flexible
"Barding, plate","armor","Horse plate.","90","500","3",9,7,7,8,0,3,Plate
"Armor repair kit","general","Rings, leather, rivets.","4","8","",1,0,0,0,0,,flexible`;

const SCIFI_ARMOR_CSV = `name,type,description,weight,cost,TL,staminaCost,impact,pierce,slash,energy,ballistic,material
"Padded jack","armor","Quilted cloth armor.","8","5","3",1,2,1,3,0,3,flexible
"Leather jerkin","armor","Boiled or layered leather.","10","10","3",1,2,2,3,0,3,flexible
"Studded leather","armor","Leather with metal rivets.","15","25","3",2,3,2,4,0,3,flexible
"Hide armor","armor","Thick hides and pelts.","20","12","3",2,3,2,3,0,3,flexible
"Mail shirt","armor","Torso mail.","25","60","3",3,3,4,5,0,3,flexible
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","100","3",4,4,5,6,0,3,flexible
"Scale shirt","armor","Overlapping metal scales.","30","80","3",3,4,4,5,0,3,Plate
"Breastplate","armor","Solid chest and back.","20","200","3",2,5,5,6,0,3,Plate
"Half plate","armor","Breast, greaves, and vambraces.","40","350","3",4,6,6,7,0,3,Plate
"Full plate","armor","Complete articulated harness.","55","750","3",6,7,7,8,0,3,Plate
"Helmet, cap","armor","Simple steel cap.","3","8","3",1,3,3,4,0,3,Plate
"Helmet, open","armor","Nasal or kettle helm.","5","15","3",1,4,4,5,0,3,Plate
"Helmet, closed","armor","Visored helm.","8","40","3",1,5,5,6,0,3,Plate
"Shield, buckler","armor","Small fist shield.","3","5","3",1,2,2,2,0,3,flexible
"Shield, round","armor","Common wooden shield with boss.","6","8","3",1,3,2,3,0,3,flexible
"Shield, kite","armor","Tall cavalry or foot shield.","10","12","3",1,4,3,4,0,3,flexible
"Shield, tower","armor","Full-height pavise.","18","20","3",2,5,4,5,0,3,flexible
"Barding, leather","armor","Horse leather armor.","40","40","3",4,2,2,3,0,3,flexible
"Barding, mail","armor","Horse mail.","70","200","3",7,4,5,6,0,3,flexible
"Barding, plate","armor","Horse plate.","90","500","3",9,7,7,8,0,3,Plate
"Armor repair kit","general","Rings, leather, rivets.","4","8","",1,0,0,0,0,,flexible`;

const APOCALYPTIC_ARMOR_CSV = `name,type,description,weight,cost,TL,staminaCost,impact,pierce,slash,energy,ballistic,material
"Padded jack","armor","Quilted cloth armor.","8","5","3",1,2,1,3,0,3,flexible
"Leather jerkin","armor","Boiled or layered leather.","10","10","3",1,2,2,3,0,3,flexible
"Studded leather","armor","Leather with metal rivets.","15","25","3",2,3,2,4,0,3,flexible
"Hide armor","armor","Thick hides and pelts.","20","12","3",2,3,2,3,0,3,flexible
"Mail shirt","armor","Torso mail.","25","60","3",3,3,4,5,0,3,flexible
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","100","3",4,4,5,6,0,3,flexible
"Scale shirt","armor","Overlapping metal scales.","30","80","3",3,4,4,5,0,3,Plate
"Breastplate","armor","Solid chest and back.","20","200","3",2,5,5,6,0,3,Plate
"Half plate","armor","Breast, greaves, and vambraces.","40","350","3",4,6,6,7,0,3,Plate
"Full plate","armor","Complete articulated harness.","55","750","3",6,7,7,8,0,3,Plate
"Helmet, cap","armor","Simple steel cap.","3","8","3",1,3,3,4,0,3,Plate
"Helmet, open","armor","Nasal or kettle helm.","5","15","3",1,4,4,5,0,3,Plate
"Helmet, closed","armor","Visored helm.","8","40","3",1,5,5,6,0,3,Plate
"Shield, buckler","armor","Small fist shield.","3","5","3",1,2,2,2,0,3,flexible
"Shield, round","armor","Common wooden shield with boss.","6","8","3",1,3,2,3,0,3,flexible
"Shield, kite","armor","Tall cavalry or foot shield.","10","12","3",1,4,3,4,0,3,flexible
"Shield, tower","armor","Full-height pavise.","18","20","3",2,5,4,5,0,3,flexible
"Barding, leather","armor","Horse leather armor.","40","40","3",4,2,2,3,0,3,flexible
"Barding, mail","armor","Horse mail.","70","200","3",7,4,5,6,0,3,flexible
"Barding, plate","armor","Horse plate.","90","500","3",9,7,7,8,0,3,Plate
"Armor repair kit","general","Rings, leather, rivets.","4","8","",1,0,0,0,0,,flexible`;

function parseArmorCsv(csv) {
  return parseCsvWithHeader(csv).map((r) => ({
    name: r.name,
    type: r.type,
    description: r.description,
    weight: parseFloat(r.weight) || 0,
    cost: parseFloat(r.cost) || 0,
    tl: r.TL ? Number(r.TL) : null,
    staminaCost: Number(r.staminaCost) || 0,
    impact: Number(r.impact) || 0,
    pierce: Number(r.pierce) || 0,
    slash: Number(r.slash) || 0,
    energy: Number(r.energy) || 0,
    ballistic: Number(r.ballistic) || 0,
    material: r.material,
  }));
}

// Morrow Project's armor file is a byte-identical copy of Modern's.
const MORROW_PROJECT_ARMOR_CSV = MODERN_ARMOR_CSV;

const FANTASY_ARMOR = parseArmorCsv(FANTASY_ARMOR_CSV);
const MODERN_ARMOR = parseArmorCsv(MODERN_ARMOR_CSV);
const DYSTOPIAN_ARMOR = parseArmorCsv(DYSTOPIAN_ARMOR_CSV);
const SCIFI_ARMOR = parseArmorCsv(SCIFI_ARMOR_CSV);
const APOCALYPTIC_ARMOR = parseArmorCsv(APOCALYPTIC_ARMOR_CSV);
const MORROW_PROJECT_ARMOR = parseArmorCsv(MORROW_PROJECT_ARMOR_CSV);

const GENRE_ARMOR = {
  Fantasy: FANTASY_ARMOR,
  Modern: MODERN_ARMOR,
  Dystopian: DYSTOPIAN_ARMOR,
  SciFi: SCIFI_ARMOR,
  Apocalyptic: APOCALYPTIC_ARMOR,
  'morrow_project': MORROW_PROJECT_ARMOR,
};

function getActiveArmor(genre) {
  return GENRE_ARMOR[genre] || FANTASY_ARMOR;
}

// Category tabs, in first-appearance order (weapons, armor, general).
const EQUIPMENT_TYPES = [...new Set(EQUIPMENT.map((e) => e.type))];

// ---------------------------------------------------------------------------
// Small Arms, Small Arms Modifications, and Military Vehicles (data/small_arms.csv,
// data/small_arms_mods.csv, data/military_vehicles.csv) — modern/military
// reference tables for a future genre expansion. Parsed and exported, but
// NOT wired into any live UI panel or purchase flow yet (see Appendix A/V
// in the printed Handbook for the reference tables themselves).
// ---------------------------------------------------------------------------

const SMALL_ARMS_CSV = `Maker,Type,Designation,Calibre,MVel(FPS),ETransfer,Range Inc(M),Fire Mode,Mag,TL,Cost($),Class
Glock,pistol,17,9x19mm,1230,9,50,semi-auto,17,5,600,C
Glock,pistol,19,9x19mm,1180,8,50,semi-auto,15,5,550,C
Glock,pistol,18,9x19mm,1150,8,40,semi-auto/auto,17,5,45000,R
Glock,pistol,21,.45 ACP,830,8,40,semi-auto,13,5,650,C
Glock,pistol,22,.40 S&W,1150,9,50,semi-auto,15,5,600,C
Glock,pistol,20,10mm Auto,1250,10,50,semi-auto,15,5,700,C
Glock,pistol,43X,9x19mm,1100,8,40,semi-auto,10,5,500,C
SIG Sauer,pistol,P320,9x19mm,1198,9,50,semi-auto,17,5,550,C
SIG Sauer,pistol,P226,9x19mm,1200,9,50,semi-auto,15,5,1000,C
SIG Sauer,pistol,P365,9x19mm,1120,8,40,semi-auto,10,5,500,C
SIG Sauer,pistol,M17,9x19mm,1198,9,50,semi-auto,17,5,600,C
Beretta,pistol,92FS,9x19mm,1280,9,50,semi-auto,15,5,750,C
Beretta,pistol,M9,9x19mm,1250,9,50,semi-auto,15,5,800,C
Beretta,pistol,93R,9x19mm,1250,9,50,semi-auto/burst,15,5,50000,R
FN,pistol,Five-seveN,5.7x28mm,2130,10,50,semi-auto,20,5,1200,C
FN,pistol,FNX-45,.45 ACP,900,8,40,semi-auto,15,5,800,C
Heckler & Koch,pistol,USP,9x19mm,1150,8,50,semi-auto,15,5,900,C
Heckler & Koch,pistol,VP9,9x19mm,1180,8,50,semi-auto,17,5,700,C
Heckler & Koch,pistol,Mk 23,.45 ACP,890,8,50,semi-auto,12,5,2000,C
Colt,pistol,M1911A1,.45 ACP,830,8,40,semi-auto,7,5,900,C
Colt,revolver,Python,.357 Magnum,1450,10,60,single/double-action,6,5,1500,C
Smith & Wesson,pistol,M&P9,9x19mm,1180,8,50,semi-auto,17,5,550,C
Smith & Wesson,revolver,Model 29,.44 Magnum,1400,12,70,single/double-action,6,5,1200,C
Smith & Wesson,revolver,Model 686,.357 Magnum,1450,10,60,single/double-action,6,5,900,C
Ruger,pistol,Mark IV,.22 LR,1200,5,40,semi-auto,10,5,450,C
Walther,pistol,PDP,9x19mm,1160,8,50,semi-auto,18,5,600,C
CZ,pistol,75,9x19mm,1180,8,50,semi-auto,16,5,700,C
CZ,pistol,Scorpion EVO 3,9x19mm,1200,9,75,semi-auto/auto,30,5,900,C
Browning,pistol,Hi-Power,9x19mm,1150,8,50,semi-auto,13,5,800,C
Heckler & Koch,SMG,MP5A3,9x19mm,1312,9,100,semi-auto/burst/auto,30,5,40000,R
Heckler & Koch,SMG,MP5SD,9x19mm subsonic,935,7,50,semi-auto/burst/auto,30,5,45000,R
Heckler & Koch,SMG,UMP45,.45 ACP,850,8,80,semi-auto/burst/auto,25,5,25000,R
Heckler & Koch,PDW,MP7A1,4.6x30mm,2395,9,150,semi-auto/auto,40,5,35000,R
FN,PDW,P90,5.7x28mm,2345,11,150,semi-auto/auto,50,5,30000,R
IWI,SMG,Uzi,9x19mm,1310,9,100,semi-auto/auto,32,5,20000,R
IWI,SMG,Mini-Uzi,9x19mm,1230,9,80,semi-auto/auto,20,5,18000,R
Colt,SMG,9mm SMG,9x19mm,1300,9,100,semi-auto/auto,32,5,15000,R
B&T,SMG,APC9,9x19mm,1312,9,100,semi-auto/auto,30,5,2500,C
KRISS,SMG,Vector,.45 ACP,850,8,80,semi-auto/auto,25,5,1500,C
Steyr,SMG,TMP / SPP,9x19mm,1280,9,80,semi-auto/auto,30,5,20000,R
Colt,carbine,M4A1,5.56x45mm,2900,13,300,semi-auto/auto,30,5,1200,C
Colt,carbine,M4,5.56x45mm,2900,13,300,semi-auto/burst,30,5,1100,C
Colt / FN,rifle,M16A4,5.56x45mm,3110,14,400,semi-auto/burst,30,5,1500,C
Colt / FN,rifle,M16A1,5.56x45mm,3250,15,400,semi-auto/auto,30,5,2000,C
FN,rifle,SCAR-L,5.56x45mm,2900,13,300,semi-auto/auto,30,5,2500,C
FN,battle rifle,SCAR-H,7.62x51mm,2620,16,400,semi-auto/auto,20,5,3000,C
Heckler & Koch,rifle,HK416,5.56x45mm,2900,13,300,semi-auto/auto,30,5,2500,C
Heckler & Koch,battle rifle,G3A3,7.62x51mm,2625,16,400,semi-auto/auto,20,5,1500,C
Heckler & Koch,battle rifle,HK417,7.62x51mm,2620,16,400,semi-auto/auto,20,5,3500,C
Heckler & Koch,rifle,G36,5.56x45mm,3018,14,400,semi-auto/auto,30,5,2000,C
SIG Sauer,rifle,MCX,5.56x45mm,2800,13,300,semi-auto/auto,30,5,1800,C
SIG Sauer,rifle,MCX,.300 AAC Blackout,2200,14,200,semi-auto/auto,30,5,2000,C
SIG Sauer,rifle,M7,6.8x51mm,3000,17,400,semi-auto/auto,20,5,3000,C
Daniel Defense,rifle,DDM4,5.56x45mm,2900,13,300,semi-auto,30,5,1500,C
IWI,rifle,Tavor X95,5.56x45mm,2900,13,300,semi-auto/auto,30,5,1800,C
IWI,rifle,Galil ACE,7.62x39mm,2350,15,300,semi-auto/auto,30,5,1200,C
Kalashnikov Concern,rifle,AKM,7.62x39mm,2330,14,300,semi-auto/auto,30,5,900,C
Kalashnikov Concern,rifle,AK-74,5.45x39mm,2950,13,300,semi-auto/auto,30,5,1000,C
Kalashnikov Concern,rifle,AK-12,5.45x39mm,2950,13,300,semi-auto/burst/auto,30,5,1500,C
Springfield Armory,rifle,M1A,7.62x51mm,2700,17,400,semi-auto,20,5,1800,C
FN,rifle,FAL,7.62x51mm,2700,17,400,semi-auto/auto,20,5,1500,C
Armalite,rifle,AR-10,7.62x51mm,2680,17,400,semi-auto,20,5,1600,C
Remington,rifle,M24,7.62x51mm,2640,16,500,bolt,5,5,2500,C
Accuracy International,sniper rifle,AX / L115A3,.338 Lapua,3000,20,800,bolt,5,5,6000,C
Sako,sniper rifle,TRG-42,.338 Lapua,2980,20,800,bolt,5,5,5000,C
Barrett,anti-materiel,M82A1,.50 BMG,2800,29,1000,semi-auto,10,5,9000,C
Barrett,anti-materiel,M107,.50 BMG,2800,29,1000,semi-auto,10,5,10000,C
McMillan,anti-materiel,TAC-50,.50 BMG,2800,29,1200,bolt,5,5,8000,C
Desert Tech,rifle,SRS,.338 Lapua,2900,20,700,bolt,5,5,4500,C
Knight's Armament,rifle,SR-25,7.62x51mm,2600,16,500,semi-auto,20,5,3500,C
Heckler & Koch,rifle,PSG1,7.62x51mm,2650,16,500,semi-auto,5,5,10000,C
load,rifle,6.5 Creedmoor,6.5 Creedmoor,2700,14,600,bolt or semi-auto,5,5,1200,C
load,rifle,.30-06 Springfield,.30-06,2800,17,500,bolt,5,5,800,C
FN,LMG,M249 SAW,5.56x45mm,3000,13,400,auto,belt,5,18000,M
FN,LMG,M249S,5.56x45mm,3000,13,400,semi-auto,belt,5,3000,C
IWI,LMG,Negev,5.56x45mm,3000,13,400,semi-auto/auto,belt,5,15000,M
FN,GPMG,M240B,7.62x51mm,2800,17,600,auto,belt,5,25000,M
Heckler & Koch,GPMG,MG5,7.62x51mm,2700,17,600,auto,belt,5,20000,M
Rheinmetall,GPMG,MG3,7.62x51mm,2690,17,600,auto,belt,5,15000,M
Kalashnikov Concern,GPMG,PKM,7.62x54mmR,2700,17,500,auto,belt,5,10000,M
Kalashnikov Concern,LMG,RPK,7.62x39mm,2400,15,300,semi-auto/auto,40,5,2000,R
Browning,HMG,M2HB,.50 BMG,2910,30,1200,auto,belt,5,20000,M
KBP,HMG,NSV,12.7x108mm,2780,28,1200,auto,belt,5,15000,M
KBP,HMG,Kord,12.7x108mm,2780,28,1200,auto,belt,5,15000,M
Remington,shotgun,870,12 gauge slug,1600,23,75,pump,4,5,500,C
Remington,shotgun,870,12 gauge 00 buck,1200,8,30,pump,4,5,500,C
Mossberg,shotgun,500,12 gauge slug,1600,23,75,pump,5,5,450,C
Mossberg,shotgun,590,12 gauge 00 buck,1200,8,30,pump,5,5,550,C
Benelli,shotgun,M4,12 gauge slug,1600,23,75,semi-auto,5,5,2100,C
Benelli,shotgun,M2,12 gauge slug,1600,23,75,semi-auto,5,5,1500,C
Benelli,shotgun,M3,12 gauge slug,1600,23,75,pump/semi-auto,5,5,1600,C
Beretta,shotgun,1301 Tactical,12 gauge slug,1600,23,75,semi-auto,5,5,1600,C
Beretta,shotgun,A300 Ultima Patrol,12 gauge slug,1550,23,75,semi-auto,5,5,900,C
Mossberg,shotgun,930 / 940,12 gauge slug,1550,23,75,semi-auto,5,5,800,C
Remington,shotgun,1100 / Versa Max,12 gauge slug,1550,23,75,semi-auto,5,5,900,C
FN,shotgun,SLP,12 gauge slug,1600,23,75,semi-auto,5,5,1200,C
Panzer Arms,shotgun,BP-12,12 gauge slug,1500,22,50,semi-auto,5,5,600,C
Saiga,shotgun,Saiga-12,12 gauge slug,1500,22,50,semi-auto,5,5,800,C
MPS,shotgun,AA-12,12 gauge slug,1500,22,75,semi-auto/auto,8,5,5000,R
UTAS,shotgun,UTS-15,12 gauge slug,1500,22,50,pump,15,5,900,C
Kel-Tec,shotgun,KSG,12 gauge slug,1500,22,50,pump,14,5,800,C
Winchester,shotgun,SX4,12 gauge slug,1550,23,75,semi-auto,4,5,900,C`;

const SMALL_ARMS_MODS_CSV = `Kind,Condition,Chance,ET or armor,Other,TL
Hit,Routine help / braced / ideal light,+10,,,5
Hit,Darkness / smoke / target moving,-10,,,5
Hit,Partial cover (about 1/4 hidden),-10,,,5
Hit,Off-hand or injured gun arm,-20,,,5
Hit,Prone target or 1/2 cover,-20,,,5
Hit,Heavy cover (only a gap visible),-30,,,5
Hit,Near-total cover,-40,,,5
Hit,Beyond 1x effective range,-10,-1 E,,5
Hit,Beyond 2x effective range,-20,-2 E,,5
Hit,Each further multiple of effective range,-10,-1 E,,5
Hit,"Short burst, 3-5 rounds",-10,,,5
Hit,"Long burst, about 10 rounds",-20,,,5
Hit,Each extra target the burst is walked across,-10,,,5
Hit,"Bipod or vehicle mount, single shot",+10,,,5
Hit,"Bipod or mount, short burst",cancels the -10,,,5
Hit,"Bipod or mount, long burst",penalty is -10 instead of -20,,,5
Hit,Suppressed shot in a confined space,-10,,,5
Hit,Tracer follow-up or burst after the first round,ignores the first -10 of darkness or range,,,5
Ammo,Ball,,E against BAC,"Flexible stop deals half E as blunt",5
Ammo,Armor-piercing,,test E against half BAC,"Penetrating damage is half the excess, minimum 1 if it beat halved armor. No blunt on a stop",5
Ammo,Hollow point,,test E against double BAC,"Double the excess if it penetrates. Flexible stop deals full E as blunt. Plate stop deals none",5
Ammo,Incendiary,,resolve as ball,"Penetrating damage of 1 or more ignites fuel, cloth, or other combustibles",5
Ammo,Tracer,,,No damage change. Hit effect is in the hit rows,5
Ammo,Subsonic,,E halved round down,"Effective range cut to 1/4. On 96-99 a self-loader does not cycle",5
Device,Proper suppressor,,,"Beyond 10 m, -20 to hear or locate on a single shot or short burst, -10 on a long burst. No flash. Fumble jams the gun",5
Device,Suppressor plus subsonic,,,"As both. Past 50 m the shot is not heard as gunfire unless the listener is already alert",5
Device,Suppressor plus ball,,,"Locate penalty applies, but the sonic crack can still be heard at the target",5
Device,Improvised suppressor,,,"Same noise penalty. Jam on a fumble or on 96-99. Long burst checks 91-99 even on a hit",5
Device,"Proper can, long burst",,,"Jam check on 96-99 even on a hit",5
Rule,Shred,,added to E before the ammunition test,"Arm or leg costs 3 Shred. Head costs 6. Torso is free",5`;

const MILITARY_VEHICLES_CSV = `Maker,Type,Designation,Country,Crew,Armor Front(BAC),Armor Side(BAC),Primary Weapon,Calibre,ETransfer,EType,Range Inc(M),Fire Mode,TL
AM General,utility,HMMWV M998,USA,2-4,2,1,pintle M2HB,.50 BMG,30,ballistic,1200,auto,5
AM General,up-armored utility,M1151,USA,4,10,6,pintle M2HB,.50 BMG,30,ballistic,1200,auto,5
Oshkosh,MRAP,M-ATV,USA,4-5,16,12,CROWS M2HB,.50 BMG,30,ballistic,1200,auto,5
Force Protection,MRAP,Cougar,USA,2-10,18,14,pintle M2HB or Mk 19,.50 BMG,30,ballistic,1200,auto,5
Navistar,MRAP,MaxxPro,USA,2-10,18,14,pintle M2HB,.50 BMG,30,ballistic,1200,auto,5
Cadillac Gage,armored car,V-150 Commando,USA,3-12,16,16,turret M2HB,.50 BMG,30,ballistic,1200,auto,5
Textron,armored car,M1117 ASV,USA,3-4,20,16,Mk 19 and M2HB,40mm,60,explosive,400,auto,5
FMC,APC,M113A3,USA,2+11,23,18,pintle M2HB,.50 BMG,30,ballistic,1200,auto,5
GDLS,ICV,Stryker M1126,USA,2+9,28,20,Protector M2HB,.50 BMG,30,ballistic,1200,auto,5
GDLS,ICV,Stryker M1296 Dragoon,USA,2+9,28,20,Mk 44 Bushmaster,30x173mm,90,ballistic,1500,semi-auto/auto,5
GDLS,assault gun,M1128 Stryker MGS,USA,3,28,20,M68A2,105mm,450,kinetic,1200,single,5
BAE,IFV,M2A3 Bradley,USA,3+6,36,24,M242 Bushmaster,25x137mm,70,ballistic,1500,semi-auto/auto,5
BAE,IFV missile,M2A3 Bradley,USA,3+6,36,24,BGM-71 TOW,152mm,870,shaped-charge,3750,single,5
BAE,light tank,M10 Booker,USA,4,32,22,XM35,105mm,500,kinetic,1500,single,5
GDLS,tank,M1A2 Abrams,USA,4,60,40,M256,120mm,1100,kinetic,2000,single,5
BAE,AAV,AAV-7,USA,3+21,16,12,Mk 19 and M2HB,40mm,60,explosive,400,auto,5
Ural,utility,UAZ-469,Russia,2-4,1,1,pintle PKM,7.62x54mmR,17,ballistic,500,auto,5
GAZ,utility,Tigr,Russia,2-8,8,6,pintle Kord,12.7x108mm,28,ballistic,1200,auto,5
GAZ,APC,BTR-60,Russia,2+14,14,10,KPVT,14.5x114mm,40,ballistic,800,auto,5
GAZ,APC,BTR-80,Russia,3+7,18,14,KPVT,14.5x114mm,40,ballistic,800,auto,5
GAZ,APC,BTR-82A,Russia,3+7,20,16,2A72,30x165mm,75,ballistic,1200,semi-auto/auto,5
Kurganmash,IFV,BMP-1,Russia,3+8,18,14,2A28 Grom,73mm,200,explosive,800,single,5
Kurganmash,IFV,BMP-2,Russia,3+7,22,16,2A42,30x165mm,80,ballistic,1500,semi-auto/auto,5
Kurganmash,IFV missile,BMP-2,Russia,3+7,22,16,9M113 Konkurs,135mm,600,shaped-charge,2000,single,5
Kurganmash,IFV,BMP-3,Russia,3+7,26,18,2A70 and 2A72,100mm,350,explosive,1000,single,5
Uralvagonzavod,tank,T-55,Russia,4,28,18,D-10,100mm,350,kinetic,1000,single,5
Uralvagonzavod,tank,T-62,Russia,4,32,20,U-5TS,115mm,450,kinetic,1200,single,5
Uralvagonzavod,tank,T-72B,Russia,3,45,28,2A46,125mm,900,kinetic,1800,single,5
Uralvagonzavod,tank,T-80U,Russia,3,48,30,2A46M,125mm,950,kinetic,1800,single,5
Uralvagonzavod,tank,T-90M,Russia,3,50,32,2A46M-5,125mm,1000,kinetic,2000,single,5
Uralvagonzavod,tank,T-14 Armata,Russia,3,58,36,2A82,125mm,1100,kinetic,2000,single,5
KBP,APC,BTR-D,Russia,3+10,14,10,pintle PKM,7.62x54mmR,17,ballistic,500,auto,5
Norinco,APC,Type 63,China,2+13,16,12,pintle Type 54,12.7x108mm,28,ballistic,800,auto,5
Norinco,IFV,ZBD-04,China,3+7,28,20,100mm and 30mm,100mm,350,explosive,1000,single,5
Norinco,IFV,ZBL-08,China,3+7,26,18,30mm autocannon,30x165mm,80,ballistic,1500,semi-auto/auto,5
Norinco,tank,Type 59,China,4,28,18,100mm,100mm,350,kinetic,1000,single,5
Norinco,tank,Type 96,China,3,42,26,125mm,125mm,850,kinetic,1800,single,5
Norinco,tank,Type 99,China,3,50,32,ZPT-98,125mm,1000,kinetic,2000,single,5
Norinco,light tank,Type 15,China,3,30,20,105mm,105mm,500,kinetic,1500,single,5
BAE,APC,FV432,UK,2+10,22,16,pintle L7 GPMG,7.62x51mm,17,ballistic,600,auto,5
BAE,IFV,Warrior,UK,3+7,32,22,L21A1 RARDEN,30mm,70,ballistic,1000,semi-auto,5
GDLS,recon,FV107 Scimitar,UK,3,24,16,L21 RARDEN,30mm,70,ballistic,1000,semi-auto,5
BAE,tank,Challenger 2,UK,4,58,38,L30A1,120mm,1000,kinetic,2000,single,5
BAE,tank,Challenger 3,UK,4,60,40,Rh120 L55,120mm,1100,kinetic,2000,single,5
Supacat,utility,Jackal,UK,3,4,2,pintle HMG or GMG,.50 BMG,30,ballistic,1200,auto,5
Nexter,APC,VAB,France,2+10,18,14,pintle 12.7mm,12.7x99mm,28,ballistic,800,auto,5
Nexter,IFV,VBCI,France,3+8,30,22,DRagar 25mm,25x137mm,70,ballistic,1500,semi-auto/auto,5
Nexter,recon,AMX-10 RC,France,4,26,18,105mm,105mm,450,kinetic,1200,single,5
Nexter,recon,EBRC Jaguar,France,3,28,20,CT40,40mm CTA,100,ballistic,1500,semi-auto,5
Nexter,tank,Leclerc,France,3,55,36,CN120-26,120mm,1100,kinetic,2000,single,5
Rheinmetall,IFV,Marder 1A3,Germany,3+6,32,22,Rh202,20x139mm,57,ballistic,2000,semi-auto/auto,5
Rheinmetall,IFV,Puma,Germany,3+6,40,28,MK 30-2,30x173mm,90,ballistic,1500,semi-auto/auto,5
Rheinmetall,APC,Boxer,Germany,3+8,30,22,FLW 200 or Lance,12.7mm or 30mm,28,ballistic,800,auto,5
Krauss-Maffei,tank,Leopard 1,Germany,4,30,20,L7A3,105mm,450,kinetic,1500,single,5
Krauss-Maffei,tank,Leopard 2A6,Germany,4,55,36,L55,120mm,1100,kinetic,2000,single,5
IVECO,APC,VBM Freccia,Italy,3+8,28,20,Oerlikon KBA,25x137mm,70,ballistic,1500,semi-auto/auto,5
OTO Melara,tank,Ariete,Italy,4,48,32,Oto 120,120mm,1000,kinetic,2000,single,5
IVECO,MRAP,LMV Lince,Italy,4-5,12,8,pintle 12.7mm,12.7x99mm,28,ballistic,800,auto,5
Santa Barbara,IFV,Pizarro,Spain,3+7,32,22,M242,25x137mm,70,ballistic,1500,semi-auto/auto,5
Santa Barbara,tank,Leopard 2E,Spain,4,55,36,L55,120mm,1100,kinetic,2000,single,5
Patria,APC,AMV,Finland,3+8,28,20,turret 30mm or 12.7mm,30x173mm,90,ballistic,1500,semi-auto/auto,5
BAE Hägglunds,IFV,CV90,Sweden,3+7,36,24,40mm Bofors,40x365mm,110,ballistic,1500,semi-auto/auto,5
BAE Hägglunds,tank,Strv 122,Sweden,4,55,36,L55,120mm,1100,kinetic,2000,single,5
MOWAG,APC,Piranha III,Switzerland,3+8,26,18,turret 12.7mm or 25mm,25x137mm,70,ballistic,1500,semi-auto/auto,5
MOWAG,APC,Piranha V,Switzerland,3+8,30,22,turret 30mm,30x173mm,90,ballistic,1500,semi-auto/auto,5
Steyr,APC,Pandur,Austria,2+10,22,16,turret 12.7mm,12.7x99mm,28,ballistic,800,auto,5
Hyundai Rotem,IFV,K21,South Korea,3+9,36,24,K40,40mm,110,ballistic,1500,semi-auto/auto,5
Hyundai Rotem,tank,K2 Black Panther,South Korea,3,55,36,CN08,120mm,1100,kinetic,2000,single,5
Mitsubishi,IFV,Type 89,Japan,3+7,28,20,Oerlikon KDE,35x228mm,100,ballistic,1500,semi-auto/auto,5
Mitsubishi,tank,Type 10,Japan,3,50,32,120mm,120mm,1050,kinetic,2000,single,5
Mitsubishi,tank,Type 90,Japan,3,48,30,120mm,120mm,1000,kinetic,2000,single,5
IMI,APC,M113 Zelda,Israel,2+8,24,18,pintle MAG or 0.50,7.62x51mm,17,ballistic,600,auto,5
IMI,IFV,Namer,Israel,3+9,50,36,Samson 30mm or 0.50,30mm,90,ballistic,1500,semi-auto/auto,5
IMI,tank,Merkava 4,Israel,4,58,40,MG253,120mm,1100,kinetic,2000,single,5
Denel,IFV,Ratel 20,South Africa,3+8,18,14,GI-2,20x139mm,57,ballistic,1200,semi-auto/auto,5
Denel,IFV,Badger,South Africa,3+8,30,22,30mm,30x173mm,90,ballistic,1500,semi-auto/auto,5
Denel,tank,Olifant Mk 2,South Africa,4,36,24,GT-7,105mm,450,kinetic,1200,single,5
FNSS,IFV,ACV-15,Turkey,3+8,26,18,25mm,25x137mm,70,ballistic,1500,semi-auto/auto,5
Otokar,tank,Altay,Turkey,4,50,32,MKE 120,120mm,1050,kinetic,2000,single,5
Bumar,IFV,Rosomak,Poland,3+8,28,20,Mk 44,30x173mm,90,ballistic,1500,semi-auto/auto,5
Bumar,tank,PT-91 Twardy,Poland,3,40,26,2A46,125mm,850,kinetic,1800,single,5
UVZ,IFV,BMP-1 copy,India,3+8,18,14,2A28,73mm,200,explosive,800,single,5
DRDO,tank,Arjun Mk 1,India,4,48,30,120mm,120mm,1000,kinetic,1800,single,5
DIO,tank,Zulfiqar,Iran,3,36,24,125mm,125mm,800,kinetic,1500,single,5
DIO,APC,Rakhsh,Iran,2+8,16,12,DShK,12.7x108mm,26,ballistic,800,auto,5
ADI,IFV,ASLAV,Australia,3+6,24,16,M242,25x137mm,70,ballistic,1500,semi-auto/auto,5
Thales,APC,Bushmaster,Australia,1+9,16,12,pintle 12.7mm,12.7x99mm,28,ballistic,800,auto,5
AV Canada,LAV,LAV 6.0,Canada,3+7,28,20,25mm or 30mm,25x137mm,70,ballistic,1500,semi-auto/auto,5
Malyshev,tank,T-64,Ukraine,3,40,26,2A46,125mm,850,kinetic,1800,single,5
Kharkiv,APC,BTR-4,Ukraine,3+7,22,16,30mm,30x165mm,80,ballistic,1500,semi-auto/auto,5
Yugoimport,APC,Lazar 3,Serbia,3+9,24,18,30mm,30x165mm,80,ballistic,1500,semi-auto/auto,5
Yugoimport,tank,M-84,Serbia,3,42,26,2A46,125mm,850,kinetic,1800,single,5`;

const SMALL_ARMS = parseCsvWithHeader(SMALL_ARMS_CSV).map((r) => ({
  maker: r.Maker,
  type: r.Type,
  designation: r.Designation,
  calibre: r.Calibre,
  muzzleVelocity: r['MVel(FPS)'],
  energyTransfer: r.ETransfer,
  rangeInc: r['Range Inc(M)'],
  fireMode: r['Fire Mode'],
  mag: r.Mag ? Number(r.Mag) : null,
  tl: r.TL ? Number(r.TL) : null,
  cost: parseFloat(r['Cost($)']) || 0,
  // Legal-availability tier (Common/Restricted/Military), not the
  // character Expertise class (Martial/Covert/Adept/Shepherd) — kept
  // under a distinct name to avoid confusion with that unrelated concept.
  weaponClass: r.Class,
}));

const SMALL_ARMS_MODS = parseCsvWithHeader(SMALL_ARMS_MODS_CSV).map((r) => ({
  kind: r.Kind,
  condition: r.Condition,
  chance: r.Chance,
  etOrArmor: r['ET or armor'],
  other: r.Other,
  tl: r.TL ? Number(r.TL) : null,
}));

const MILITARY_VEHICLES = parseCsvWithHeader(MILITARY_VEHICLES_CSV).map((r) => ({
  maker: r.Maker,
  type: r.Type,
  designation: r.Designation,
  country: r.Country,
  crew: r.Crew,
  armorFront: r['Armor Front(BAC)'],
  armorSide: r['Armor Side(BAC)'],
  primaryWeapon: r['Primary Weapon'],
  calibre: r.Calibre,
  energyTransfer: r.ETransfer,
  energyType: r.EType,
  rangeInc: r['Range Inc(M)'],
  fireMode: r['Fire Mode'],
  tl: r.TL ? Number(r.TL) : null,
}));


// Each owned item is { quantity, equipped, carried } — Equipped and Carried
// are independent player-set flags (checked in the Purchase popup) that
// together decide what shows up in the Equipped panel and counts toward
// carried weight. An item owned but neither equipped nor carried is left
// behind (e.g. at home/storage) and doesn't count toward either.
function getEquipmentEntry(character, item) {
  return character.equipmentOwned[item.name] || null;
}

function getEquipmentQuantity(character, item) {
  const entry = getEquipmentEntry(character, item);
  return entry ? entry.quantity : 0;
}

function isEquipmentEquipped(character, item) {
  const entry = getEquipmentEntry(character, item);
  return !!(entry && entry.equipped);
}

function isEquipmentCarried(character, item) {
  const entry = getEquipmentEntry(character, item);
  return !!(entry && entry.carried);
}

function setEquipmentEquipped(character, item, value) {
  const entry = character.equipmentOwned[item.name];
  if (entry) entry.equipped = value;
}

function setEquipmentCarried(character, item, value) {
  const entry = character.equipmentOwned[item.name];
  if (entry) entry.carried = value;
}

function getEquipmentOwnedEntries(character) {
  return getActiveEquipment(character.genre)
    .filter((item) => getEquipmentQuantity(character, item) > 0)
    .map((item) => {
      const entry = character.equipmentOwned[item.name];
      return { item, quantity: entry.quantity, equipped: !!entry.equipped, carried: !!entry.carried };
    })
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

// Owned entries that are actually Equipped or Carried, optionally narrowed
// to one EQUIPMENT type (weapons/armor/general) — the shared filter behind
// the Equipped panel's armor and general tables (and the weight total).
function getWornEquipmentEntries(character, type) {
  return getEquipmentOwnedEntries(character)
    .filter(({ equipped, carried }) => equipped || carried)
    .filter(({ item }) => !type || item.type === type);
}

function addEquipmentItem(character, item) {
  const entry = character.equipmentOwned[item.name];
  if (entry) entry.quantity += 1;
  else character.equipmentOwned[item.name] = { quantity: 1, equipped: false, carried: false };
}

function removeEquipmentItem(character, item) {
  const entry = character.equipmentOwned[item.name];
  if (!entry) return;
  if (entry.quantity > 1) entry.quantity -= 1;
  else delete character.equipmentOwned[item.name];
}

function getEquipmentSpentGT(character) {
  return getActiveEquipment(character.genre).reduce((sum, item) => sum + item.cost * getEquipmentQuantity(character, item), 0);
}

// Total weight of everything actually Equipped or Carried — items merely
// owned (left behind) don't add to it.
function getCarriedEquipmentWeightTotal(character) {
  return getWornEquipmentEntries(character).reduce((sum, { item, quantity }) => sum + item.weight * quantity, 0);
}

// Carried/Equipped weapons-category purchases, resolved to their matching
// MELEE_WEAPONS/RANGED_WEAPONS skill entry (every shop weapon name is kept
// in sync with the skill CSVs, so this lookup is a direct name match) — this
// is what feeds the Equipped panel's weapon tables, reusing the exact same
// rank/Target machinery as the Buy Weapon Skills popup.
function getWornWeapons(character, category) {
  const skillList = category === 'melee' ? MELEE_WEAPONS : RANGED_WEAPONS;
  const bySkillName = new Map(skillList.map((w) => [w.name, w]));
  return getWornEquipmentEntries(character, 'weapons')
    .map(({ item }) => bySkillName.get(item.name))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}


// Wealth (data/coinage.txt). Two denomination sets, switched by Tech Level:
// TL <= 3 (Fantasy-era) uses the 6-coin set — 1 Golden Royal = 5 Gold
// Dragons = 50 Gold Talons; 1 Gold Talon = 1 Silver Fang = 10 Silver Chips =
// 100 Coppers. TL > 3 uses a simpler 3-field set — Dollars, Credit, and
// Other are all the same fungible currency (1 unit = 1 Gold Talon, so
// existing Equipment GT costs need no conversion), equally good for a
// purchase. Every coin's value is expressed relative to a Gold Talon (GT),
// the unit Equipment costs are listed in.
const FANTASY_COINAGE = [
  { id: 'gr', name: 'Golden Royal', valueInGT: 50 },
  { id: 'gd', name: 'Gold Dragon', valueInGT: 10 },
  { id: 'gt', name: 'Gold Talon', valueInGT: 1 },
  { id: 'sf', name: 'Silver Fang', valueInGT: 1 },
  { id: 'sc', name: 'Silver Chip', valueInGT: 0.1 },
  { id: 'cp', name: 'Copper', valueInGT: 0.01 },
];

// Dollars, Credit, and Other are all the same currency — fully fungible,
// equally good for a purchase — so all three carry the same purchasing
// power (1 unit = 1 Gold Talon, same as Dollars alone used to).
const MODERN_COINAGE = [
  { id: 'dollars', name: 'Dollars', valueInGT: 1 },
  { id: 'credit', name: 'Credit', valueInGT: 1 },
  { id: 'other', name: 'Other', valueInGT: 1 },
];

// Every coin id that might ever appear on a character, regardless of which
// set is currently active — used to zero-init a fresh wallet and to restore
// a loaded save (so switching Tech Level later never drops a value the
// player already entered in the other set).
const COINAGE = [...FANTASY_COINAGE, ...MODERN_COINAGE];

function getActiveCoinage(character) {
  return character.techLevel > 3 ? MODERN_COINAGE : FANTASY_COINAGE;
}

// Every Focus starts with the same wallet — 100 Gold Talons (or, for a
// Tech Level > 3 character, the Dollar-equivalent) — as 100 individual
// coins, not broken into larger denominations.
const STARTING_GOLD_TALONS = 100;

function getWealthInGT(character) {
  return getActiveCoinage(character).reduce((sum, coin) => sum + (Number(character.coinage[coin.id]) || 0) * coin.valueInGT, 0);
}

// Wallet value in copper (the smallest fantasy unit — 1 cp = 1, so 1 GT =
// 100) so Fantasy purchases can be deducted/refunded without
// floating-point drift.
function getWalletCopper(character) {
  return FANTASY_COINAGE.reduce((sum, coin) => sum + (Number(character.coinage[coin.id]) || 0) * coin.valueInGT * 100, 0);
}

// Rebuilds the Fantasy wallet (TL <= 3) from a total-copper value as a
// canonical largest-denomination-first breakdown — this is what actually
// "makes change" (breaking or combining coins) whenever a purchase or
// refund changes the wallet's total value. Silver Fang ties Gold Talon's
// value and is excluded from the breakdown (left at whatever the player set
// it to by hand) so that tie never creates an ambiguous split.
function setWalletFromCopper(character, totalCopper) {
  let remaining = Math.max(0, Math.round(totalCopper));
  character.coinage.gr = Math.floor(remaining / 5000); remaining -= character.coinage.gr * 5000;
  character.coinage.gd = Math.floor(remaining / 1000); remaining -= character.coinage.gd * 1000;
  character.coinage.gt = Math.floor(remaining / 100); remaining -= character.coinage.gt * 100;
  character.coinage.sf = 0;
  character.coinage.sc = Math.floor(remaining / 10); remaining -= character.coinage.sc * 10;
  character.coinage.cp = remaining;
}

// Deducts costGT worth of value from the wallet — never goes negative; a
// cost that exceeds total wealth just empties the wallet. For TL > 3,
// Dollars/Credit/Other are fully fungible, so a purchase just draws from
// whichever of the three has money, in that order, rather than "making
// change" across denominations the way Fantasy coins do.
function spendFromCoinage(character, costGT) {
  if (character.techLevel > 3) {
    let remaining = Math.max(0, costGT);
    MODERN_COINAGE.forEach((coin) => {
      if (remaining <= 0) return;
      const have = Number(character.coinage[coin.id]) || 0;
      const take = Math.min(have, remaining);
      character.coinage[coin.id] = have - take;
      remaining -= take;
    });
    return;
  }
  setWalletFromCopper(character, getWalletCopper(character) - Math.round(costGT * 100));
}

// Adds valueGT worth of value back to the wallet (e.g. un-buying an item).
// For TL > 3 the refund always lands in Dollars (as good as Credit or
// Other, since they're fungible — Dollars is just the conventional default).
function refundToCoinage(character, valueGT) {
  if (character.techLevel > 3) {
    character.coinage.dollars = (Number(character.coinage.dollars) || 0) + Math.max(0, valueGT);
    return;
  }
  setWalletFromCopper(character, getWalletCopper(character) + Math.round(valueGT * 100));
}

// Weapon skills and (non-Spell/Miracle) Skills spend from two SEPARATE
// per-class pools now, not one shared pool. A Adept/Shepherd "Spell: X" or
// "Miracle: X" Skill entry counts as a Weapon skill for this split (it still
// lives in the SKILLS array and the skillSpend ledger — only which pool
// pays for it changes).
function isWeaponSkillEntry(skill) {
  return /^Spell:|^Miracle:/.test(skill.name);
}

// Each class rank earns 1 Weapon skill dot, and 1 Skill dot (2 if Human) —
// every rank, including the first, on the same terms.
function getClassRankMultiplier(character) {
  return character.race === 'Human' ? 2 : 1;
}

function getClassWeaponPointsUsed(character, cls) {
  const spellSkillUsed = SKILLS.filter(isWeaponSkillEntry)
    .reduce((sum, skill) => sum + getSkillClassSpend(character, skill, cls), 0);
  const meleeUsed = MELEE_WEAPONS.reduce((sum, w) => sum + getWeaponClassSpend(character, 'melee', w.name, cls), 0);
  const rangedUsed = RANGED_WEAPONS.reduce((sum, w) => sum + getWeaponClassSpend(character, 'ranged', w.name, cls), 0);
  return spellSkillUsed + meleeUsed + rangedUsed;
}

// Specials draw from the Skill pool (they're neither a Weapon nor a
// Spell/Miracle Skill) — still capped by tier count above regardless of
// points available, same as before.
function getClassSkillPointsUsed(character, cls) {
  const skillUsed = SKILLS.filter((s) => !isWeaponSkillEntry(s))
    .reduce((sum, skill) => sum + getSkillClassSpend(character, skill, cls), 0);
  const specialUsed = SPECIALS.reduce((sum, special) => sum + getSpecialClassSpend(character, special, cls), 0);
  return skillUsed + specialUsed;
}

function getClassWeaponPointsTotal(character, cls) {
  return character.classDots[cls];
}

function getClassSkillPointsTotal(character, cls) {
  return character.classDots[cls] * getClassRankMultiplier(character);
}

function getClassWeaponPointsAvailable(character, cls) {
  return getClassWeaponPointsTotal(character, cls) - getClassWeaponPointsUsed(character, cls);
}

function getClassSkillPointsAvailable(character, cls) {
  return getClassSkillPointsTotal(character, cls) - getClassSkillPointsUsed(character, cls);
}

// The pool a given Skill spends from — Spell:/Miracle: entries pull from
// the Weapon pool, everything else from the Skill pool.
function getSkillPointsAvailable(character, skill, cls) {
  return isWeaponSkillEntry(skill)
    ? getClassWeaponPointsAvailable(character, cls)
    : getClassSkillPointsAvailable(character, cls);
}

// True while ANY class still has an unspent Weapon or Skill dot anywhere —
// gates buying another class dot in ANY class (see toggleClassDot) until
// every dot already granted has been spent.
function hasUnspentClassDots(character) {
  return Object.keys(character.classDots).some((cls) => getClassWeaponPointsAvailable(character, cls) > 0
    || getClassSkillPointsAvailable(character, cls) > 0);
}

// A class dot can only ever be bought one rank at a time — never jump
// multiple ranks in one click — because the Weapon dot and Skill dot(s)
// granted by each rank must be fully spent (in ANY class) before the next
// rank, anywhere, becomes available at all. Decrementing (refunding) still
// allows a multi-rank jump, but never below the rank needed to cover what's
// already been spent from either of this class's two pools.
function setClassDotsForClass(character, cls, targetRank) {
  const current = character.classDots[cls];
  const clampedTarget = clamp(targetRank, CLASS_DOTS_MIN, CLASS_DOTS_MAX);
  if (clampedTarget > current) {
    if (hasUnspentClassDots(character)) return;
    character.classDots[cls] = Math.min(clampedTarget, current + 1);
    return;
  }
  if (clampedTarget < current) {
    const weaponUsed = getClassWeaponPointsUsed(character, cls);
    const skillUsed = getClassSkillPointsUsed(character, cls);
    const multiplier = getClassRankMultiplier(character);
    const minDots = Math.max(weaponUsed, Math.ceil(skillUsed / multiplier));
    character.classDots[cls] = Math.max(clampedTarget, minDots);
  }
}

// ---------------------------------------------------------------------------
// Combat. Shown just under Attributes: always computed live from
// attributes/focus/race. Also used as the "Target" base for Weapon skills.
// ---------------------------------------------------------------------------

function getMeleeBaseAttack(c) {
  return roundUp(
    getExpertiseEntry(c.genre, c.focus).combatFocusBonus
    + (getEffectiveAttribute(c, 'Strength') + getEffectiveAttribute(c, 'Agility')
      + getEffectiveAttribute(c, 'Intellect') + getEffectiveAttribute(c, 'Intuition')) / 4
  );
}

function getRangedBaseAttack(c) {
  return roundUp(
    10 + (getEffectiveAttribute(c, 'Agility') + getEffectiveAttribute(c, 'Dexterity')
      + getEffectiveAttribute(c, 'Intellect') + getEffectiveAttribute(c, 'Intuition')) / 4
  );
}

function getBaseDefense(c) {
  return roundUp(
    (getEffectiveAttribute(c, 'Agility') + getEffectiveAttribute(c, 'Dexterity')
      + getEffectiveAttribute(c, 'Intuition')) / 3
  );
}

const COMBAT_STAT_GROUP = {
  title: 'Combat',
  stats: [
    {
      id: 'meleeBaseAttack',
      name: 'Melee Base Attack',
      formulaText: 'class_focus_bonus + (Strength + Agility + Intellect + Intuition) / 4',
      formula: getMeleeBaseAttack,
    },
    {
      id: 'rangedBaseAttack',
      name: 'Ranged Base Attack',
      formulaText: '10 + (Agility + Dexterity + Intellect + Intuition) / 4',
      formula: getRangedBaseAttack,
    },
    {
      id: 'baseDefense',
      name: 'Base Defense',
      formulaText: '(Agility + Dexterity + Intuition) / 3',
      formula: getBaseDefense,
    },
  ],
};

// Casting: class_focus_bonus (per Focus, per genre) + the average of 4
// effective attributes.
function getMagicCasting(c) {
  return roundUp(getExpertiseEntry(c.genre, c.focus).magicFocusBonus + getAverageEffectiveAttribute(c, ['Mysticism', 'Intellect', 'Willpower', 'Dexterity']));
}

function getMiracleCasting(c) {
  return roundUp(getExpertiseEntry(c.genre, c.focus).miracleFocusBonus + getAverageEffectiveAttribute(c, ['Mysticism', 'Willpower', 'Intuition', 'Agility']));
}

// Not gated by Magic (unlike the other two) — Psychic Powers are their own
// optional system with its own Psychic on/off toggle (see
// character.psychicEnabled, Appendix P).
function getPsychicAbility(c) {
  return roundUp(getEffectiveAttribute(c, 'Willpower') + getAverageEffectiveAttribute(c, ['Willpower', 'Intellect', 'Intuition']));
}

const CASTING_STAT_GROUP = {
  stats: [
    {
      id: 'magicCasting',
      name: 'Magic Casting',
      formulaText: 'class_magic_focus_bonus + avg(Mysticism, Intellect, Willpower, Dexterity)',
      formula: getMagicCasting,
      // Only meaningful when Magic is enabled — see renderCombatStats().
      requiresMagic: true,
    },
    {
      id: 'miracleCasting',
      name: 'Miracle Casting',
      formulaText: 'class_miracle_focus_bonus + avg(Mysticism, Willpower, Intuition, Agility)',
      formula: getMiracleCasting,
      requiresMagic: true,
    },
    {
      id: 'psychicAbility',
      name: 'Psychic Ability',
      formulaText: 'Willpower + avg(Willpower, Intellect, Intuition)',
      formula: getPsychicAbility,
    },
  ],
};

// ---------------------------------------------------------------------------
// Vitals (data/vitals.csv). Every field is Base + Magic + Misc = Total; Base
// is computed and read-only, Magic/Misc are free player-entered numbers.
// ---------------------------------------------------------------------------


// Total dots invested across all four classes, regardless of which one is
// currently the Focus. Only the *_mod tables above vary with Focus.
function getTotalClassDots(character) {
  return Object.values(character.classDots).reduce((sum, v) => sum + (v || 0), 0);
}

const VITALS_STATS = [
  {
    id: 'physicalDamage',
    name: 'Physical Damage',
    formulaText: '(Physique + Strength + Constitution) / 2 * (focus_mod + race_pd_mult) * total class ranks',
    formula: (c) => {
      const race = RACES[c.race];
      const sum = getEffectiveAttribute(c, 'Physique') + getEffectiveAttribute(c, 'Strength')
        + getEffectiveAttribute(c, 'Constitution');
      const focusMod = getExpertiseEntry(c.genre, c.focus).vitalsPdMod;
      const dots = getTotalClassDots(c);
      return roundUp((sum / 2) * (focusMod + race.race_pd_mult) * dots);
    },
  },
  {
    id: 'mentalDamage',
    name: 'Mental Damage',
    formulaText: '(Intellect + Willpower + Constitution) / 2 * (focus_mod + race_md_mult) * total class ranks',
    formula: (c) => {
      const race = RACES[c.race];
      const sum = getEffectiveAttribute(c, 'Intellect') + getEffectiveAttribute(c, 'Willpower')
        + getEffectiveAttribute(c, 'Constitution');
      const focusMod = getExpertiseEntry(c.genre, c.focus).vitalsMdMod;
      const dots = getTotalClassDots(c);
      return roundUp((sum / 2) * (focusMod + race.race_md_mult) * dots);
    },
  },
  {
    id: 'movement',
    name: 'Movement',
    formulaText: 'Strength + Agility + Constitution + race move modifier',
    formula: (c) => {
      const race = RACES[c.race];
      return roundUp(getEffectiveAttribute(c, 'Strength') + getEffectiveAttribute(c, 'Agility')
        + getEffectiveAttribute(c, 'Constitution') + race.moveModifier);
    },
  },
  {
    id: 'initiative',
    name: 'Initiative',
    formulaText: '(Agility + Intellect + Intuition + Bravery) / 4 + (5 * Covert ranks) + (3 * Martial ranks) + race_init_mod',
    formula: (c) => {
      const race = RACES[c.race];
      const sum = getEffectiveAttribute(c, 'Agility') + getEffectiveAttribute(c, 'Intellect')
        + getEffectiveAttribute(c, 'Intuition') + getEffectiveAttribute(c, 'Bravery');
      return roundUp((sum / 4) + (5 * c.classDots.Covert) + (3 * c.classDots.Martial) + race.race_init_mod);
    },
  },
  {
    id: 'staminaRecovery',
    name: 'Stamina Recovery',
    formulaText: '(Constitution + Willpower) / 2',
    formula: (c) => roundUp(
      (getEffectiveAttribute(c, 'Constitution') + getEffectiveAttribute(c, 'Willpower')) / 2
    ),
  },
  {
    id: 'stamina',
    name: 'Stamina',
    formulaText: 'Strength + (2 * Constitution) + (2 * Willpower) + total_class_ranks * (1/2 * Constitution)',
    formula: (c) => roundUp(
      getEffectiveAttribute(c, 'Strength') + (2 * getEffectiveAttribute(c, 'Constitution'))
        + (2 * getEffectiveAttribute(c, 'Willpower'))
        + (getTotalClassDots(c) * (0.5 * getEffectiveAttribute(c, 'Constitution')))
    ),
  },
];

// Stamina Cost: a small sub-list nested under Stamina. Each entry's Base is
// a fixed number (not attribute-derived); Armor is derived (every currently
// Equipped armor/shield's own staminaCost, summed — see
// getEquippedArmorStaminaCost) and the same across all 4 rows, since
// wearing heavy armor costs stamina to fight in regardless of how you're
// attacking; Misc is still a free player-entered number. Base + Armor +
// Misc = Total, same shape as the stats above.
const STAMINA_COST_ITEMS = [
  { id: 'combatFist', name: 'Combat Fist', base: 2 },
  { id: 'combat1Hand', name: 'Combat 1-hand', base: 4 },
  { id: 'combat2Hand', name: 'Combat 2-hand', base: 8 },
  { id: 'ranged', name: 'Ranged', base: 5 },
];

// Sums staminaCost across every armor/shield item the character actually
// has Equipped right now (Carried-but-not-worn doesn't count — only what
// you're wearing costs stamina to fight in). Looks each owned 'armor'-type
// item up by name in the active genre's armor catalog, same as the
// Equipped panel's Armor table.
function getEquippedArmorStaminaCost(character) {
  const armorCatalog = getActiveArmor(character.genre);
  return getEquipmentOwnedEntries(character)
    .filter(({ item, equipped }) => equipped && item.type === 'armor')
    .reduce((sum, { item, quantity }) => {
      const detail = armorCatalog.find((a) => a.name === item.name);
      return sum + (detail ? detail.staminaCost : 0) * quantity;
    }, 0);
}

function getStaminaCostTotal(character, item) {
  const state = character.vitals.staminaCost[item.id];
  return roundUp(item.base + getEquippedArmorStaminaCost(character) + (Number(state.misc) || 0));
}

function rollAttribute() {
  const d10 = () => 1 + Math.floor(Math.random() * 10);
  return d10() + d10();
}

function createDefaultCharacter() {
  const defaultTechLevel = getDefaultTechLevel();
  const defaultTier = TECH_LEVELS.find((t) => t.tl === defaultTechLevel);
  const defaultGenreLabel = defaultTier ? defaultTier.genreLabels[0] : 'fantasy';
  const defaultGenre = resolveCatalogGenre(defaultGenreLabel);
  const defaultClasses = getActiveClasses(defaultGenre);

  const attributes = {};
  ATTRIBUTES.forEach((attr) => { attributes[attr] = rollAttribute(); });

  const classDots = {};
  defaultClasses.forEach((cls) => { classDots[cls] = 0; });

  const skillSpend = {};
  ALL_SKILLS.forEach((s) => { skillSpend[s.name] = {}; });

  const weaponSpend = { melee: {}, ranged: {} };
  ALL_MELEE_WEAPONS.forEach((w) => { weaponSpend.melee[w.name] = {}; });
  ALL_RANGED_WEAPONS.forEach((w) => { weaponSpend.ranged[w.name] = {}; });

  const specialSpend = {};
  SPECIALS.forEach((s) => { specialSpend[s.name] = {}; });

  const spellsLearned = {};
  SPELLS.forEach((s) => { spellsLearned[s.id] = false; });

  const miraclesLearned = {};
  MIRACLES.forEach((m) => { miraclesLearned[m.id] = false; });

  const staminaCost = {};
  STAMINA_COST_ITEMS.forEach((item) => { staminaCost[item.id] = { misc: 0 }; });

  const coinage = {};
  COINAGE.forEach((c) => { coinage[c.id] = 0; });
  coinage.gt = STARTING_GOLD_TALONS;
  coinage.dollars = STARTING_GOLD_TALONS;

  return {
    name: '',
    focus: defaultClasses[0],
    race: 'Human',
    // There's no independent Genre control any more — Genre is always
    // derived from the Tech Level selector. genreLabel is the raw label
    // from that tier's data/tech_levels.csv row; genre is that label
    // resolved to one of the 5 real catalogs via resolveCatalogGenre().
    // genreLabel is its own persisted field (not just derivable by
    // reversing resolveCatalogGenre()) because a tier with multiple labels
    // (e.g. TL 6) needs to remember which one the player actually picked.
    genreLabel: defaultGenreLabel,
    genre: defaultGenre,
    techLevel: defaultTechLevel,
    // Magic/Psychic/Mutant/Cyber all default from the selected Tech Level's
    // own tech_levels.csv row (see parseTechLevels) rather than a hardcoded
    // value — each stays pinned to that row's on/off until the player
    // explicitly touches its radio buttons (…Explicit below), after which
    // switching Tech Level never overwrites their choice, so any of the 4
    // can be "bent" onto any setting. …Explicit must be a persisted
    // character field (not transient app state) so a save/reload doesn't
    // look like an implicit "explicit choice" was made.
    magicEnabled: defaultTier ? defaultTier.magic : true,
    magicEnabledExplicit: false,
    psychicEnabled: defaultTier ? defaultTier.psychic : false,
    psychicEnabledExplicit: false,
    mutantEnabled: defaultTier ? defaultTier.mutant : false,
    mutantEnabledExplicit: false,
    cyberEnabled: defaultTier ? defaultTier.cyber : false,
    cyberEnabledExplicit: false,
    attributes,
    classDots,
    skillSpend,
    weaponSpend,
    specialSpend,
    spellsLearned,
    miraclesLearned,
    extraSpellBaseRank: 0,
    extraMiracleBaseRank: 0,
    coinage,
    equipmentOwned: {},
    focusWeapons: rollFocusWeapons(defaultGenre, defaultClasses[0], 'Human'),
    vitals: {
      height: '',
      weight: '',
      stamina: { magic: 0, misc: 0 },
      physicalDamage: { magic: 0, misc: 0 },
      mentalDamage: { magic: 0, misc: 0 },
      initiative: { magic: 0, misc: 0 },
      staminaRecovery: { magic: 0, misc: 0 },
      movement: { magic: 0, misc: 0 },
      staminaCost: staminaCost,
    },
  };
}

// ---------------------------------------------------------------------------
// Game Set consumption (data/gameset.json, published from vg-tools)
//
// vg-tools is the source of authority for every genre's content — this is
// how that reaches the live character builder. vg-tools' "Publish Game
// Set" button bundles its entire current in-memory state (every file it
// knows about, across every genre, plus tech_levels.csv and the current
// list of known genres) into one JSON file. app.js fetches it once at
// startup (works only over http(s); fails silently and harmlessly under
// file://, same as the older tech_levels.csv-only fetch it supersedes) and
// hands it to applyGameSet() below, which re-derives every base and
// dependent constant in this file from it — including genres this file has
// never heard of before, so a brand-new genre vg-tools creates needs no
// code change here to become usable, only a publish.
//
// Every base constant below is mutated in place (array .length=0+push, or
// object key delete+assign) rather than reassigned, since many of them
// (e.g. GENRE_ARMOR.Fantasy / FANTASY_ARMOR) are the SAME object by
// reference on purpose — reassigning one would silently desync the other.
// ---------------------------------------------------------------------------

function replaceArrayContents(target, items) {
  target.length = 0;
  items.forEach((item) => target.push(item));
}

function replaceObjectContents(target, source) {
  Object.keys(target).forEach((key) => { delete target[key]; });
  Object.assign(target, source);
}

// "Morrow Project" (tech_levels.csv's display label) -> "morrow_project"
// (the catalog/filename key) — mirrors how vg-tools derives a genre's own
// identity from its lowercase, underscore-joined file prefix.
function genreFilePrefix(genre) {
  return String(genre).toLowerCase().replace(/\s+/g, '_');
}

function applyGameSet(gameSet) {
  if (!gameSet || typeof gameSet !== 'object') return;
  const files = gameSet.files || {};
  const genres = Array.isArray(gameSet.knownGenres) && gameSet.knownGenres.length ? gameSet.knownGenres : GENRES;

  genres.forEach((genre) => {
    if (!GENRES.includes(genre)) GENRES.push(genre);
    const lowerLabel = genre.toLowerCase().replace(/_/g, ' ');
    if (!(lowerLabel in GENRE_LABEL_MAP)) GENRE_LABEL_MAP[lowerLabel] = genre;
    if (!(genre in GENRE_EXPERTISE)) GENRE_EXPERTISE[genre] = [];
    if (!(genre in GENRE_SKILLS)) GENRE_SKILLS[genre] = [];
    if (!(genre in GENRE_MELEE_WEAPONS)) GENRE_MELEE_WEAPONS[genre] = [];
    if (!(genre in GENRE_RANGED_WEAPONS)) GENRE_RANGED_WEAPONS[genre] = [];
    if (!(genre in GENRE_EQUIPMENT)) GENRE_EQUIPMENT[genre] = [];
    if (!(genre in GENRE_ARMOR)) GENRE_ARMOR[genre] = [];
    if (!(genre in RACES_BY_GENRE)) RACES_BY_GENRE[genre] = {};

    const prefix = genreFilePrefix(genre);

    const expertiseText = files[`${prefix}_expertise.csv`];
    if (expertiseText != null) replaceArrayContents(GENRE_EXPERTISE[genre], parseExpertiseCsv(expertiseText));

    // Fantasy's Skills/Melee/Ranged baseline files aren't genre-prefixed
    // (fantasy_skills.csv is the Spell:/Miracle: add-on, not the baseline;
    // melee_weapons.csv/ranged_weapons.csv ARE the shared baseline every
    // genre gets for free) — every other genre follows the generic
    // {genre}_X.csv pattern and lands in its own GENRE_X[genre] slot.
    if (genre === 'Fantasy') {
      const fantasySkillsText = files['fantasy_skills.csv'];
      if (fantasySkillsText != null) replaceArrayContents(FANTASY_SKILLS, parseSkillsCsv(fantasySkillsText));
      const meleeText = files['melee_weapons.csv'];
      if (meleeText != null) replaceArrayContents(MELEE_WEAPONS, parseMeleeWeaponsCsv(meleeText));
      const rangedText = files['ranged_weapons.csv'];
      if (rangedText != null) replaceArrayContents(RANGED_WEAPONS, parseRangedWeaponsCsv(rangedText));
    } else {
      const skillsText = files[`${prefix}_skills.csv`];
      if (skillsText != null) replaceArrayContents(GENRE_SKILLS[genre], parseSkillsCsv(skillsText));
      const meleeText = files[`${prefix}_melee.csv`];
      if (meleeText != null) replaceArrayContents(GENRE_MELEE_WEAPONS[genre], parseMeleeWeaponsCsv(meleeText));
      const rangedText = files[`${prefix}_ranged.csv`];
      if (rangedText != null) replaceArrayContents(GENRE_RANGED_WEAPONS[genre], parseRangedWeaponsCsv(rangedText));
    }

    const eqText = files[`${prefix}_eq.csv`];
    if (eqText != null) replaceArrayContents(GENRE_EQUIPMENT[genre], parseEquipmentCsv(eqText));

    const armorText = files[`${prefix}_armor.csv`];
    if (armorText != null) replaceArrayContents(GENRE_ARMOR[genre], parseArmorCsv(armorText));

    const raceText = files[`${prefix}_race.csv`];
    if (raceText != null) replaceObjectContents(RACES_BY_GENRE[genre], parseRaceCsv(raceText));
  });

  // Global (not genre-split) content — same files the live app already
  // reads from today, just refreshed from vg-tools' published copy instead
  // of a hand-maintained embedded default.
  if (files['special.csv'] != null) replaceArrayContents(SPECIALS, parseSpecialCsv(files['special.csv']));
  if (files['small_arms.csv'] != null) {
    replaceArrayContents(SMALL_ARMS, parseCsvWithHeader(files['small_arms.csv']).map((r) => ({
      maker: r.Maker,
      type: r.Type,
      designation: r.Designation,
      calibre: r.Calibre,
      muzzleVelocity: r['MVel(FPS)'],
      energyTransfer: r.ETransfer,
      rangeInc: r['Range Inc(M)'],
      fireMode: r['Fire Mode'],
      mag: r.Mag ? Number(r.Mag) : null,
      tl: r.TL ? Number(r.TL) : null,
      cost: parseFloat(r['Cost($)']) || 0,
      weaponClass: r.Class,
    })));
  }
  if (files['fantasy_spells.csv'] != null) {
    replaceArrayContents(SPELLS, parseCsvWithHeader(files['fantasy_spells.csv']).map((r) => ({
      id: r.id, school: r.school, name: r.name, cost: r.cost,
      dotsRequired: Number(r['Dots Reqd']) || 0,
      defy: r.defy === 'none' ? '' : r.defy,
      clock: r.clock, crutch: r.crutch, description: r.full_description,
    })));
  }
  if (files['fantasy_miracles.csv'] != null) {
    replaceArrayContents(MIRACLES, parseCsvWithHeader(files['fantasy_miracles.csv']).map((r) => ({
      id: r.id, school: r.school, name: r.name, cost: r.cost,
      dotsRequired: Number(r['Dots Reqd']) || 0,
      defy: r.defy === 'none' ? '' : r.defy,
      clock: r.clock, crutch: r.crutch, description: r.full_description,
    })));
  }
  // Each Psychic tier file is cumulative (TL9+ already contains TL6-8's
  // content) — use the highest tier actually published rather than
  // concatenating all four, which would just duplicate every lower tier's
  // rows.
  const psychicText = files['psychic_tl9.csv'] || files['psychic_tl8.csv'] || files['psychic_tl7.csv'] || files['psychic_tl6.csv'];
  if (psychicText != null) replaceArrayContents(PSYCHIC_POWERS, parsePsychicPowersCsv(psychicText));

  if (gameSet.techLevels) {
    const freshTiers = parseTechLevels(gameSet.techLevels);
    if (freshTiers.length) replaceArrayContents(TECH_LEVELS, freshTiers);
  }

  // Recompute every value derived from the above, in dependency order.
  replaceObjectContents(RACES, Object.assign({}, ...genres.map((g) => RACES_BY_GENRE[g] || {})));
  replaceArrayContents(RACE_NAMES, Object.keys(RACES));
  const nonFantasyGenres = genres.filter((g) => g !== 'Fantasy');
  replaceArrayContents(ALL_MELEE_WEAPONS, MELEE_WEAPONS.concat(...nonFantasyGenres.map((g) => GENRE_MELEE_WEAPONS[g] || [])));
  replaceArrayContents(ALL_RANGED_WEAPONS, RANGED_WEAPONS.concat(...nonFantasyGenres.map((g) => GENRE_RANGED_WEAPONS[g] || [])));
  replaceArrayContents(ALL_SKILLS, SKILLS.concat(FANTASY_SKILLS, ...nonFantasyGenres.map((g) => GENRE_SKILLS[g] || []), PSYCHIC_POWERS));
  replaceArrayContents(SPELL_SCHOOLS, [...new Set(SPELLS.map((s) => s.school))].sort());
  replaceArrayContents(MIRACLE_SCHOOLS, [...new Set(MIRACLES.map((s) => s.school))].sort());
  replaceArrayContents(EQUIPMENT_TYPES, [...new Set(EQUIPMENT.map((e) => e.type))]);
}

window.VennRPG = {
  ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX,
  CLASSES, getActiveClasses, CLASS_DOTS_MIN, CLASS_DOTS_MAX, CLASS_DOTS_ROWS, CLASS_DOTS_PER_ROW,
  GENRE_EXPERTISE, getActiveExpertise, getExpertiseEntry, getDefyPercent, getDefyValue,
  GENRES, TECH_LEVELS, parseTechLevels, getAvailableTechLevels, getDefaultTechLevel, resolveCatalogGenre, applyGameSet,
  RACES, RACE_NAMES, getRaceNamesForGenre, getRaceAttributeMod, getEffectiveAttribute, getAverageEffectiveAttribute,
  MELEE_WEAPONS, RANGED_WEAPONS, getActiveMeleeWeapons, getActiveRangedWeapons, ALL_MELEE_WEAPONS, ALL_RANGED_WEAPONS,
  WEAPON_RANKS_MIN, WEAPON_RANKS_MAX, WEAPON_RANKS_ROWS, WEAPON_RANKS_PER_ROW,
  getFocusWeaponCapacity, isWeaponFocusEligible,
  rollFocusWeapons, addFocusWeapon, removeFocusWeapon,
  isWeaponEligibleForClass, weaponMatchesCharacter, getWeaponRate, getWeaponAutoMinRank,
  getWeaponClassSpend, getWeaponSpentRank, getWeaponEffectiveRank, getWeaponTarget, toggleWeaponRankForClass,
  SKILLS, PSYCHIC_POWERS, SKILL_RANKS_MIN, SKILL_RANKS_MAX, SKILL_RANKS_ROWS, SKILL_RANKS_PER_ROW,
  FANTASY_SKILLS, getActiveSkills, ALL_SKILLS,
  isSkillEligibleForClass, isSkillGeneral, isSkillForRace, pickSpendableClass,
  skillMatchesCharacter, getSkillRate, getSkillAutoMinRank,
  getSkillClassSpend, getSkillSpentRank, getSkillEffectiveRank, getSkillTarget, toggleSkillRankForClass,
  SPECIALS, isSpecialEligible, getSpecialClassSpend, getSpecialSpentRank, isSpecialOwned, toggleSpecialForClass,
  getSpecialTierCount, getSpecialsOwnedCount, canAcquireSpecial,
  SPELLS, SPELL_SCHOOLS, hasSpellAccess, isSpellLearned, toggleSpellLearned,
  getSpellSlotCount, getSpellSlotCountForRank, getSpellsLearnedCount, canLearnSpell,
  meetsCastingDotsRequirement,
  MIRACLES, MIRACLE_SCHOOLS, hasMiracleAccess, isMiracleLearned, toggleMiracleLearned,
  getMiracleSlotCount, getMiracleSlotCountForRank, getMiraclesLearnedCount, canLearnMiracle,
  getClassRankMultiplier, isWeaponSkillEntry,
  getClassWeaponPointsUsed, getClassSkillPointsUsed,
  getClassWeaponPointsTotal, getClassSkillPointsTotal,
  getClassWeaponPointsAvailable, getClassSkillPointsAvailable,
  getSkillPointsAvailable, hasUnspentClassDots, setClassDotsForClass,
  MULTI_VALUE_DELIMITER, parseMultiValue,
  COMBAT_STAT_GROUP, getMeleeBaseAttack, getRangedBaseAttack, getBaseDefense,
  CASTING_STAT_GROUP, getMagicCasting, getMiracleCasting, getPsychicAbility, VITALS_STATS,
  STAMINA_COST_ITEMS, getStaminaCostTotal, getEquippedArmorStaminaCost,
  EQUIPMENT, EQUIPMENT_TYPES, GENRE_EQUIPMENT, getActiveEquipment, getEquipmentQuantity, getEquipmentOwnedEntries,
  GENRE_ARMOR, getActiveArmor,
  SMALL_ARMS, SMALL_ARMS_MODS, MILITARY_VEHICLES,
  isEquipmentEquipped, isEquipmentCarried, setEquipmentEquipped, setEquipmentCarried,
  getWornEquipmentEntries, getCarriedEquipmentWeightTotal,
  getWornWeapons,
  addEquipmentItem, removeEquipmentItem, getEquipmentSpentGT,
  COINAGE, FANTASY_COINAGE, MODERN_COINAGE, getActiveCoinage, getWealthInGT, spendFromCoinage, refundToCoinage,
  rollAttribute, createDefaultCharacter, clamp, roundUp,
};

})();
