// Character data schema and game-rule definitions for the VennRPG character sheet.
// Plain classic script (no ES modules) so the sheet also works when opened
// directly via file:// without a local server. Everything is attached to the
// shared window.VennRPG namespace for src/app.js to consume.
(function () {

const ATTRIBUTES = [
  'Physique', 'Strength', 'Constitution', 'Agility', 'Dexterity', 'Intellect',
  'Intuition', 'Magic', 'Bravery', 'Willpower', 'Charisma', 'Attraction',
];

const ATTRIBUTE_MIN = 2;
const ATTRIBUTE_MAX = 20;

const CLASSES = ['Fighter', 'Thief', 'Mage', 'Priest'];

const CLASS_DOTS_MIN = 0;
const CLASS_DOTS_MAX = 20;
const CLASS_DOTS_ROWS = 2;
const CLASS_DOTS_PER_ROW = 10;

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

// Defy = attribute value * a per-attribute rate: 4% for an attribute that's
// key to the character's Focus class, 2% for every other attribute.
const DEFY_HIGH_PERCENT = 4;
const DEFY_LOW_PERCENT = 2;
const DEFY_KEY_ATTRIBUTES = {
  Fighter: ['Physique', 'Strength', 'Constitution'],
  Thief: ['Agility', 'Dexterity', 'Charisma'],
  Mage: ['Magic', 'Intellect', 'Intuition'],
  Priest: ['Willpower', 'Magic', 'Constitution'],
};

function getDefyPercent(focus, attribute) {
  const keyAttrs = DEFY_KEY_ATTRIBUTES[focus] || [];
  return keyAttrs.includes(attribute) ? DEFY_HIGH_PERCENT : DEFY_LOW_PERCENT;
}

function getDefyValue(focus, attribute, attributeValue) {
  const percent = getDefyPercent(focus, attribute);
  return roundUp(attributeValue * percent);
}

// ---------------------------------------------------------------------------
// Races (data/race.csv). Race grants flat attribute modifiers, a movement
// modifier, a bonus weapon, and multipliers/mods plugged into the Vitals
// formulas below. Modifiers are applied live on top of the character's base
// (rolled) attribute values so switching race never mutates stored data.
// ---------------------------------------------------------------------------

const RACE_ATTRIBUTE_COLUMNS = {
  Physique: 'physique',
  Strength: 'strength',
  Constitution: 'constitution',
  Dexterity: 'dexterity',
  Agility: 'agility',
  Magic: 'magic',
  Willpower: 'willpower',
};

const RACES = {
  Dwarf: {
    mods: { physique: 1, strength: 1, constitution: 1, dexterity: 0, agility: 0, magic: 0, willpower: 1 },
    bonusMeleeWeapon: 'Warhammer',
    bonusRangedWeapon: 'Light Crossbow',
    moveModifier: -10,
    race_pd_mult: 0.2,
    race_md_mult: 0.1,
    race_init_mod: 0,
  },
  Elf: {
    mods: { physique: 0, strength: 0, constitution: 0, dexterity: 1, agility: 1, magic: 1, willpower: 0 },
    bonusMeleeWeapon: 'Sword Willow-leaf',
    bonusRangedWeapon: 'Longbow',
    moveModifier: 0,
    race_pd_mult: -0.2,
    race_md_mult: 0.2,
    race_init_mod: 0,
  },
  Halfling: {
    mods: { physique: -1, strength: -1, constitution: 2, dexterity: 2, agility: 0, magic: 0, willpower: 2 },
    bonusMeleeWeapon: 'Knife',
    bonusRangedWeapon: 'Knife Thrown',
    moveModifier: -15,
    race_pd_mult: -0.1,
    race_md_mult: 0.2,
    race_init_mod: 5,
  },
  Human: {
    mods: { physique: 1, strength: 1, constitution: 0, dexterity: 0, agility: 0, magic: 1, willpower: 1 },
    bonusMeleeWeapon: 'Dagger',
    bonusRangedWeapon: 'Dagger Thrown',
    moveModifier: 0,
    race_pd_mult: 0,
    race_md_mult: 0,
    race_init_mod: 0,
  },
};

const RACE_NAMES = Object.keys(RACES);

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

function getLedgerSpentRank(ledger, itemKey) {
  return CLASSES.reduce((sum, cls) => sum + getLedgerClassSpend(ledger, itemKey, cls), 0);
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

const WEAPON_RANKS_MIN = CLASS_DOTS_MIN;
const WEAPON_RANKS_MAX = CLASS_DOTS_MAX;
const WEAPON_RANKS_ROWS = CLASS_DOTS_ROWS;
const WEAPON_RANKS_PER_ROW = CLASS_DOTS_PER_ROW;

const WEAPON_BASE_RATE = 3;
const WEAPON_BONUS_RATE = 6;

const MELEE_WEAPONS_CSV = `Name,size,attribute,rof,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,focus,race,
Unarmed,fist,,3,0,1,0,0,fighter;thief;priest;mage,human;halfling;dwarf;elf
BrassKnuckles,fist,,3,0,3,0,0,fighter;thief,
Dagger,fist,,2,0,4,0,0,fighter;thief;priest;mage,human;halfling;dwarf;elf
Knife,fist,,3,0,2,0,0,fighter;thief;priest;mage,human;halfling;dwarf;elf
Sword Stabbing,1-hand,,1,0,0,8,0,fighter;thief,
Sword Arming,1-hand,,1,2,6,8,0,fighter;thief,
Sword Long,1-hand,,1,4,4,8,0,fighter;thief;priest,
Sword Willow-leaf,1-hand,,1,4,4,8,0,fighter;thief,Elf
Sword Broad,1-hand,,1,6,6,10,0,fighter;priest,
Sword Great,2-hand,,1,8,8,16,0,fighter,
Sword Foil,1-hand,,2,0,0,4,0,fighter;thief;priest,
Sword Sabre,1-hand,,2,4,0,6,0,fighter;thief;priest,
Sword Katana,1-hand,,2,8,0,8,0,fighter;priest,
Hammer,1-hand,,1,0,4,0,0,fighter;priest,Dwarf
WarHammer,2-hand,,1,0,8,0,0,fighter,Dwarf
SpikeHammer,1-hand,,1,0,4,4,0,fighter;priest,
Nordic/Norman Axe,1-hand,,2,6,6,0,0,fighter;priest,
WarAxe,2-hand,,1,10,10,0,0,fighter,Dwarf
Mace,1-hand,,2,0,6,0,0,fighter;thief;priest,
Morning Star,1-hand,,2,0,8,2,0,fighter;priest,
Flail,1-hand,,1,0,8,4,0,fighter;priest,
Spear Short,1-hand,,2,0,0,8,0,fighter;priest,
Lance(charge),2-hand,,1,0,0,16,0,fighter;priest,
Pike,2-hand,,1,0,0,10,0,fighter;thief,
Lance,2-hand,,1,0,0,8,0,fighter;priest,
Halberd,2-hand,,1,0,0,10,0,fighter;priest,
Quarterstaff,2-hand,,2,0,6,0,0,fighter;thief;priest;mage,
Club,1-hand,,2,0,0,6,0,fighter;thief;priest,
Cudgel,1-hand,,2,0,0,4,0,fighter;thief;priest;mage,
Improvised,1-hand,,2,0,0,4,0,fighter;thief;priest;mage,
Shortsword,1-hand,,0,0,0,0,0,,
Hand axe,1-hand,,0,0,0,0,0,,
Battleaxe,2-hand,,0,0,0,0,0,,
Greataxe,2-hand,,0,0,0,0,0,,
Maul,2-hand,,0,0,0,0,0,,
Rapier,1-hand,,0,0,0,0,0,,
Scimitar,1-hand,,0,0,0,0,0,,
Whip,1-hand,,0,0,0,0,0,,
Man-catcher,2-hand,,0,0,0,0,0,,
Fighting Net,2-hand,,0,0,0,0,0,,
Caltrops (bag),thrown,,0,0,0,0,0,,`;

const RANGED_WEAPONS_CSV = `name,rof,range,attribute,slash_dmg,impact_dmg,pierce_dmg,enery_dmg,focus,race
Blowgun,1,10,Agility,0,0,1,0,Fighter;Thief,
Sling,1,30,Dexterity,0,3,0,0,Fighter;Thief;Priest,halfling
Sling Staff,1,60,Agility,0,6,0,0,Fighter;Priest;Mage,
Short Bow,1,100,Dexterity,0,0,6,0,Fighter;Thief,
Composite Bow,1,100,Dexterity,0,0,8,0,Fighter;Thief,
Longbow,1,120,Dexterity,0,0,8,0,Fighter,elf
Light Crossbow,1,60,Dexterity,0,0,5,0,Fighter;Thief;Priest,
Heavy Crossbow,1,90,Dexterity,0,0,10,0,Fighter,dwarf
Javelin thrown,1,30,Agility,0,0,5,0,Fighter;Thief,
Axe Thrown,1,10,Dexterity,5,3,0,0,Fighter;Thief,
Dagger Thrown,2,10,Dexterity,2,0,4,0,Fighter;Thief,human;halfling;dwarf;elf
Club Thrown,1,10,Dexterity,0,4,0,0,Fighter;Thief;Priest,human;halfling;dwarf
Rock Thrown,1,20,Dexterity,0,1,0,0,Fighter;Thief;Priest;Mage,human;halfling;dwarf;elf
Hand crossbow,0,0,,0,0,0,0,,
Arrows (20),0,0,,0,0,0,0,,
Quarrels (20),0,0,,0,0,0,0,,
Sling bullets (20),0,0,,0,0,0,0,,
Darts (20),0,0,,0,0,0,0,,`;

function parseMeleeWeaponsCsv(csv) {
  return csv.trim().split('\n').slice(1).filter(Boolean).map((line) => {
    const [name, size, attribute, rof, slashRaw, impactRaw, pierceRaw, energyRaw, focusRaw, raceRaw] = line.split(',');
    return {
      name: (name || '').trim(),
      size: (size || '').trim(),
      attribute: parseMultiValue(attribute).map(capitalizeToken),
      rof: Number(rof) || 0,
      slash: Number(slashRaw) || 0,
      impact: Number(impactRaw) || 0,
      pierce: Number(pierceRaw) || 0,
      energy: Number(energyRaw) || 0,
      focus: parseMultiValue(focusRaw).map(capitalizeToken),
      race: parseMultiValue(raceRaw).map(capitalizeToken),
    };
  });
}

function parseRangedWeaponsCsv(csv) {
  return csv.trim().split('\n').slice(1).filter(Boolean).map((line) => {
    const [name, rof, range, attribute, slashRaw, impactRaw, pierceRaw, energyRaw, focusRaw, raceRaw] = line.split(',');
    return {
      name: (name || '').trim(),
      rof: Number(rof) || 0,
      range: Number(range) || 0,
      attribute: parseMultiValue(attribute).map(capitalizeToken),
      slash: Number(slashRaw) || 0,
      impact: Number(impactRaw) || 0,
      pierce: Number(pierceRaw) || 0,
      energy: Number(energyRaw) || 0,
      focus: parseMultiValue(focusRaw).map(capitalizeToken),
      race: parseMultiValue(raceRaw).map(capitalizeToken),
    };
  });
}

const MELEE_WEAPONS = parseMeleeWeaponsCsv(MELEE_WEAPONS_CSV);
const RANGED_WEAPONS = parseRangedWeaponsCsv(RANGED_WEAPONS_CSV);

function getWeaponList(category) {
  return category === 'melee' ? MELEE_WEAPONS : RANGED_WEAPONS;
}

function getWeapon(category, weaponName) {
  return getWeaponList(category).find((w) => w.name === weaponName);
}

// Race's bonus weapon name (data/race.csv) is hand-maintained separately
// from the weapon CSVs and can drift in casing (e.g. "Warhammer" vs the
// weapon list's "WarHammer"), so this look-up is case-insensitive.
function findWeaponByNameLoose(category, weaponName) {
  return getWeaponList(category).find((w) => normalizeWeaponName(w.name) === normalizeWeaponName(weaponName));
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
const FOCUS_WEAPON_COUNTS = {
  Fighter: { melee: 3, ranged: 2 },
  Thief: { melee: 2, ranged: 1 },
  Priest: { melee: 2, ranged: 1 },
  Mage: { melee: 1, ranged: 1 },
};

function getFocusWeaponCapacity(focus, category) {
  const counts = FOCUS_WEAPON_COUNTS[focus] || { melee: 0, ranged: 0 };
  return counts[category] || 0;
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
function rollFocusWeaponsForCategory(category, focus, race) {
  const count = getFocusWeaponCapacity(focus, category);
  if (count <= 0) return [];

  const raceInfo = RACES[race];
  const raceBonusName = raceInfo && (category === 'melee' ? raceInfo.bonusMeleeWeapon : raceInfo.bonusRangedWeapon);
  const raceBonusWeapon = raceBonusName && findWeaponByNameLoose(category, raceBonusName);
  const picks = [];
  if (raceBonusWeapon) {
    picks.push(raceBonusWeapon.name);
  }

  const eligible = getWeaponList(category).filter((w) => isWeaponFocusEligible(w, focus)).map((w) => w.name);
  const remainingPool = eligible.filter((name) => !picks.includes(name));
  picks.push(...pickRandomNames(remainingPool, Math.max(0, count - picks.length)));
  return picks.slice(0, count);
}

function rollFocusWeapons(focus, race) {
  return {
    melee: rollFocusWeaponsForCategory('melee', focus, race),
    ranged: rollFocusWeaponsForCategory('ranged', focus, race),
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
  const weapon = getWeapon(category, weaponName);
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

const SKILL_RANKS_MIN = CLASS_DOTS_MIN;
const SKILL_RANKS_MAX = CLASS_DOTS_MAX;
const SKILL_RANKS_ROWS = CLASS_DOTS_ROWS;
const SKILL_RANKS_PER_ROW = CLASS_DOTS_PER_ROW;

const SKILL_BASE_RATE = 3;
const SKILL_BONUS_RATE = 6;

const SKILLS_CSV = `name,description,attribute,focus,race
Abjuration,Ward people places and objects against harm and magic,Magic,mage;priest,
Acrobatics,Tumble flip and land safely or move through tight spaces,Agility,thief;fighter,halfling
Adaptability,Roll you Defy check each time you Advance; if you roll under add one additional skill,Intellect,,human
Alchemy,Mix mundane reagents into acids salves and reagents,Intellect,mage;priest,
Alertness,Add your inutuition to your Defy check surprise check,Intuition,fighter;thief,
Ancient Languages,Knowledge of dead languages,Intellect,,elf
Ancient Memory,Recall old names places and songs from long life or lore,Intellect,,elf
Animal Handling,Calm train and work with domestic or captured animals,Charisma,,
Animal Husbandry,Care and healing of animals,Intuition,fighter,halfling
Appraisal,Judge the true value of goods gems art and salvage,Intellect,thief;mage,halfling
Arcana,Lore magic and relics,Intellect,mage;priest,
Armor Use,Move fight and endure fatigue in worn armor,Physique;intuition,fighter;priest,
Armorsmithing,Craft and refit protective gear,Strength,fighter,dwarf
Astronomy,Read stars for time direction and omen,Intellect,mage;priest,
Athletics,Run jump climb and perform general feats of physical prowess,Physique,,
Backstab,Strike an unaware or flanked foe for extra precision damage,Dexterity,thief,
Balance,Keep footing on narrow slick or shifting surfaces,Agility,thief,halfling
Beast Lore,Predict animal behavior and know natural weapons,Intellect,,
Blend In,Disappear in a crowd or against ordinary clutter,Intuition,thief,
Brawling,Win messy close fights using improvised dirty tactics,Strength,fighter;thief,dwarf
Brewing,Make ale wine spirits and simple medicinal draughts,Intellect,,
Camouflage,Hide a person or camp using terrain and materials,Intuition,thief;fighter,
Carpentry,Build simple structures furniture shields and hafts,Dexterity;Intellect,,
Cartography,Draw and read usable maps of land cities and dungeons,Intellect,thief;mage;priest,
Charge,After moving gain an attack that addeds your Physique attribute to your attack,Physique,fighter;priest,
Cleave,If you have ROF greater than 2; you may sacrifice 1 attack to add your Strength attribute to your attack,Strength,fighter,
Climb Walls,Scale smooth walls using tools or exceptional technique,Agility,thief,
Climbing,Scale walls cliffs trees and rigging without falling,Strength,,
Cold Endurance,Resist frost exposure and function in winter weather,Constitution,,
Combat Riding,Riding of beasts in cavalry and combat,Agility,fighter,
Comfort Eater,Recover morale and a little stamina from a proper meal,Constitution,,halfling
Concentration,Keep focus while injured distracted or in chaos,Willpower,mage;priest;fighter,
Consecrate,Make ground water or an item holy for a time,Magic,priest,
Cooking,Prepare filling meals from poor or unusual ingredients,Intuition,,
Deception,Lie misdirect and keep a straight face under scrutiny,Charisma,thief;mage,
Demon Lore,Recognize infernal signs pacts and weaknesses,Intellect,priest;mage,
Direction Sense,Keep orientation underground or in featureless terrain,Intuition,,
Disarm,Use 2 ROF to attemtp to Knock or twist a weapon from an opponent's grip,Dexterity,fighter;thief,
Disguise,Alter appearance voice and manner to pass as someone else,Charisma,thief,
Diver,Stamina cost for holding your breath is halved,Constitution,,human;halfling;elf
Divination,Seek hidden knowledge through signs scrying or omen,Intuition,mage;priest,
Divine Sense,Detect consecrated ground spirits and unholy presence,Intuition,priest,
Dragon Lore,Know draconic kinds hoards breath and bargains,Intellect,mage;priest;fighter,
Dungeon Lore,Know typical traps constructs undead nests and ruin layouts,Intellect,fighter;thief;mage,
Elven Accuracy,Aim true with bows and elegant blades,Dexterity,,elf
Enchantment,Influence minds with magical charm or suggestion,Magic,mage,
Engineering,Plan simple machines bridges and field works,Intellect,mage;fighter,
Escape Artist,Slip bonds grapples nets and tight restraints,Dexterity,thief,
Etiquette,Behave correctly among nobles clergy and foreign courts,Charisma,priest;mage;fighter,
Familiar Bond,Maintain and communicate with a bound magical companion,Magic,mage,
Farming,Raise crops tend fields and judge soil and season,Intellect,,
Fast Hands,Complete fiddly work in a fraction of the usual time,Dexterity,thief,
Fearless Presence,Lend your bravery attribute to comrades Bravery Defy checks,Bravery,fighter;priest,
Fire Building,Build a fire from materials,constitution,,
First Aid,Stop bleeding bind wounds and stabilize the dying,Dexterity,fighter;priest,
Fishing,Catch fish with line net spear or trap,Dexterity,fighter,human;halfling;elf
Fletching,Make and repair arrows bolts and bowstrings,Dexterity,fighter;thief,
Folklore,Know local legends superstitions and old wives tales,Intuition,,
Foraging,Find edible plants water and safe camps in the wild,Intuition,,
Forgery,Create or detect false documents seals and signatures,Dexterity,thief,
Funeral Rites,Lay the dead to rest and hinder their rising,Willpower,priest,
Gambling,Play games of chance and spot loaded dice or marked cards,Intuition,thief;fighter,
Giant Lore,Recall the customs strengths and weak points of giants,Intellect,fighter;priest,
Heat Endurance,Work and fight in desert or forge-level heat,Constitution,,
Heraldry and History,Identify arms titles houses and court ranks on sight,Intellect,fighter;priest,
Herbalism,Identify gather and prepare useful or dangerous plants,Intellect,priest;mage;thief,
History,General history,Intellect,,
Hunting,Find stalk and take game in the wild,Intuition,fighter;thief,
Identify Magic,Determine the nature of an enchantment aura or item,Magic,mage,
Identify Miracle,Determine the nature of an enchantment aura or item,Magic,priest,
Insight,Read motive mood and whether someone is hiding something,Intuition,,
Interrogation,Extract answers through pressure patience or fear,Willpower,fighter;thief;priest,
Intimidation,Force compliance through threat presence or violence,Bravery,fighter;thief,
Jack of Trades,Perform common professional tasks adequately without specialty,Intellect,,human
Jewelcraft,Cut set and evaluate gemstones and fine metalwork,Dexterity,thief,dwarf
Law,Know statutes rights contracts and how courts work,Intellect,priest;thief;mage;priest,
Leap,Jump horizontally or vertically farther than most people,Strength,fighter;thief,
Leatherworking,Tan cut and stitch hides into gear and light armor,Dexterity,fighter,human;halfling
Linguistics,Learn and translate additional languages and dialects,Intellect,mage;priest;thief,
Listen,Pick out whispers footfalls and distant activity,Intuition,thief,
Lockpicking,Open locks without the proper key,Dexterity,thief,
Mathematics,Calculate distances loads odds and construction needs,Intellect,mage;priest,
Medicine,Diagnose illness set bones and treat infection over time,Intellect,priest;mage,
Meditation,Recover composure and prepare the mind through stillness,Willpower,priest;mage,
Memory Palace,Store and recall long lists names maps and instructions,Intellect,mage;priest,
Merchant,Haggle price goods and run a stall or caravan trade,Charisma,,
Mining,Dig tunnels assess ore and work safely underground,Constitution,fighter;priest,dwarf
Miracle: Exorcism,Drive possessing spirits from a body or place,Miracle Casting,priest,
Miracle: Animism,Commune with beasts and the living wild,Miracle Casting,priest,
Miracle: Curing,Cleanse poison and disease and lift hexes and curses,Miracle Casting,priest,
Miracle: Healing,Restore physical wounds and stave off death,Miracle Casting,priest,
Miracle: Necromancy,Command or bind or lay to rest the dead,Miracle Casting,priest,
Miracle: Ritual Magic,Work long rites for lasting or large sacred effects,Miracle Casting,priest,
Miracle: Spirit,Speak with or bind or send on ghosts and spirits,Miracle Casting,priest,
Miracle: Warding,Raise protective wards and sacred defenses,Miracle Casting,priest,
Mounted Combat,Fight effectively from horseback or similar mounts,Agility,fighter,
Nature Lore,Understand weather beasts ecosystems and seasonal cycles,Intellect,,
Navigation,Plot courses across the sea,Intellect,,
Nobility,Move among highborn and recall their scandals and claims,Charisma,priest;fighter;mage,
Orienteering,Finding your way in trackless lands,intellect;intuition,fighter,
Perception,Notice hidden details movement sounds and oddities,Intuition,,
Performance,Sing act play an instrument or hold a crowd,Charisma,,
Persuasion,Convince others through reasoned argument and appeal,Charisma,,
Pickpocket,Lift small items from a person without being noticed,Dexterity,thief,
Point Blank Shot,Shoot accurately at very close range,Dexterity,fighter;thief,
Poison Lore,Recognize brew apply and neutralize toxins,Intellect,thief;mage,
Quiet Step,Move almost silently even without special effort,Agility,,halfling
Reading and Writing,Self explanatory,intellect,fighter,
Religious Lore,Know gods rites holy days heresies and temple politics,Intellect,priest;mage,
Riddlecraft,Pose and solve riddles ciphers and word traps,Intellect,mage;thief;priest,
Riding,Control a mount in travel and simple battlefield movement,Agility,,
Riposte,Answer a failed enemy attack with an immediate counter,Agility,fighter;thief,
Rope Use,Tie secure knots bind captives and create climbing lines,Dexterity,,
Runecraft,Carve and awaken traditional dwarven protective runes,Magic,,dwarf
Sailing,Handle small craft rigging weather and river or coastal travel,Agility,fighter;thief,
Scout,Move ahead of a group and report without being caught,Intuition,thief;fighter,
Scribing,Copy texts neatly and prepare ritual or legal documents,Dexterity,mage;priest,
Search,Methodically find concealed objects doors and compartments,Intellect,thief;mage,
Second Breakfast,Ignore the first stretch of hunger or forced march hardship,Constitution,,halfling
Second Wind,Recover a burst of stamina after being driven to the edge,Constitution,,human
Seduction,Win trust desire or favors through charm and allure,Attraction,thief;mage,
Seige Craft,Building and knowledge of seige engines,intellect+strength,fighter,
Sermon,Move a congregation or crowd through sacred speech,Charisma,priest,
Shield Bash,Strike and stagger foes with the face or rim of a shield,Strength,fighter;priest,
Shield Use,Block incoming attacks and control space with a shield,Physique,fighter;priest,
Shield Wall,Lock shields with allies to blunt a frontal assault,Physique,fighter;priest,
Siegecraft,Understand rams ladders towers and how to break walls,Intellect,fighter;priest,
Silent Cast,Shape a simple spell with minimal sound or gesture,Magic,mage;thief,
Sleight of Hand,Palm switch or vanish small objects in plain view,Dexterity,thief;mage,
Sling Heritage,Use slings and thrown stones with unusual force and aim,Dexterity,,halfling
Small Target,Prove harder to hit because of stature and constant motion,Agility,,halfling
Smite,Strike a foe with weapon and sacred force together,Bravery,priest;fighter,
Smithing,Forge repair and temper metal weapons and tools,Strength,fighter;priest,dwarf
Spell Lore,Shape and control learned magical formulas,Magic,mage,
Spell: Protection,Protection from magical forces,Magic Casting,mage,
Spell: Elementalism,Shape fire ice lightning or similar raw elements,Magic Casting,mage,
Spell: Attack,Hurl raw destructive magical force,Magic Casting,mage,
Spell: Illusion,Create false images sounds and sensations,Magic Casting,mage;thief,
Spell: Necromancy,Sense command or draw power from death and undeath,Magic Casting,mage,
Spell: Ritual Magic,Work long complex ceremonies for lasting or large effects,Magic Casting,mage,
Spell: Transmutation,Alter the properties of matter or living form,Magic Casting,mage,
Spirit Lore,Know types of ghosts ancestors and how they linger,Intellect,priest;mage,
Steady Hands,Perform delicate work while under stress or in motion,Dexterity,,
Stealth,Move and hide without being seen or heard,Agility,thief,
Stone Mason,Cutting and building from stone,strength,fighter;priest,dwarf
Stonecunning,Notice unusual stonework slopes masonry and worked tunnels,Intuition,,dwarf
Streetwise,Find contacts fences rumors and safe houses in cities,Intuition,thief;fighter,
Survival,Build shelter start fire and endure wilderness conditions,Constitution,,
Swimming,Move and stay afloat in water including rough currents,Constitution,fighter,human;halfling;elf
Tactics,Read a fight choose positioning and exploit enemy mistakes,Intellect,fighter;priest,
Tracking,Follow footprints scent and disturbed ground to a quarry,Intuition,fighter;thief,
Trapcraft,Disarm reset or build mechanical traps,Dexterity,thief,
Trapfinding,Detect mechanical and simple magical traps before they trigger,Intuition,thief,
Trip,Dump an opponent to the ground during a clash,Agility,fighter;thief,
Tunnel Fighter,Fight without penalty in cramped low corridors,Physique,fighter,dwarf
Unarmed Combat,Fight effectively with fists elbows knees and grapples,Physique,,
Undead Lore,Identify kinds of walking dead and how they are bound,Intellect,priest;mage,
Volley,Double ROF at a -25% Ranged Attack,Agility,fighter;thief,
Ward Lore,Create and recognize protective circles seals and runes,Intellect,mage;priest,
Weapon Maintenance,Clean sharpen oil and repair arms so they do not fail,Dexterity,fighter;thief,
Weapon Repair,Repairing all manner of weapons malfunctions with which you have training,intellect;intuition,fighter,
Weaving,Make cloth rope and simple garments,Dexterity,,
Whirlwind,Attack several adjacent enemies in one spinning effort,Agility,fighter,
Wrestling,Throw pin and control an opponent without weapons,Strength,fighter;priest,`;

function parseSkillsCsv(csv) {
  return csv.trim().split('\n').slice(1).filter(Boolean).map((line) => {
    const [name, description, attribute, focusRaw, raceRaw] = line.split(',');
    return {
      name: (name || '').trim(),
      description: (description || '').trim(),
      attribute: parseMultiValue(attribute).map(capitalizeToken),
      focus: parseMultiValue(focusRaw).map(capitalizeToken),
      race: parseMultiValue(raceRaw).map(capitalizeToken),
    };
  });
}

const SKILLS = parseSkillsCsv(SKILLS_CSV);

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
// from whichever class currently has points to spend (Fighter first as a
// deterministic tie-break), falling back to the character's Focus.
function pickSpendableClass(character) {
  return CLASSES.find((cls) => getClassSkillPointsAvailable(character, cls) > 0) || character.focus;
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
  return Math.min(SKILL_RANKS_MAX, getSkillSpentRank(character, skill) + getSkillAutoMinRank(character, skill));
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
  setSkillRankForClass(character, skill, cls, clamp(targetRank, SKILL_RANKS_MIN, SKILL_RANKS_MAX));
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
Magic Resistance,You roll twice for Defy checks against Magic,0,,dwarf
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
Fey Resistance,You get two Defy checks against Fey Magic,0,,elf;halfling
Florentine,You are able to fight with 2 1-hand weapons without penalty. One must be shorter than the other,0,fighter;thief
Dispel Magic,You are able to spend stamina to negate a spell,0,mage
Identify,You may study magic items to understand what they do for stamina cost per power revealed,5,mage,
Detect Aura,You can tell if an item or location is has a spell on it,5,mage,
Rebuke the Foe,You can use the power of your god to rebuke his foes,5,priest,
Lay Hands,You can heal the sick and injured 1 point per stamina cost,1,priest,
Endurance,You reduce combat stamina cost by 1/2,0,fighter
Formation Fighting,You provide your Melee Defense Shield to the person next to you not yourself,Physique,fighter;priest,
Fortifications,Basic engineering of digging ditches; raising earth ramparts; planting palisades,Strength,fighter,
Armor Use,You remove penalties from wearing medium armor,0,fighter;priest
Armor Expertise,You remove penalties from wearing heavy armor,0,fighter;priest
Phalanx,You can hold a space given the right number of participants with phalanx,5,Fighter,dwarf
Ley Sense,Feel ambient magical currents and places of power,5,mage;priest,
Lucky Break,Roll twice on any Defy check,Intuition,0,,halfling
Sneak Attack,Strike when an enemy leaves an opening or turns away,5,fighter;thief,
Parry,Use a ROF to deflect incoming weapon attacks with your weapon,0,fighter;thief,
Extra Attack,Add +1 ROF to any weapon,2,Fighter;priest;thief
Double Attack,Add +1 ROF to any weapon,2,Fighter;priest
Triple Attack,Add +1 ROF to any weapon,2,Fighter
Point Blank Shot,Shoot in close range,0,Fighter,elf
Poison Resistance,Shrug off many common toxins and bad drink,Constitution,,dwarf
Instant Cover,Cover short distances at a burst of speed,5,fighter;thief,
Steady Hands,Perform delicate work while under stress or in motion,5,thief,halfling,
War Mage,You know the power level of magics on the battlefield,5,Mage,
Area Effect,You may spend some of your ranks to effect a 5x5 area and reduce damage dice,0,mage;priest,
Extra Spell,You select 1 additional spell each level after selecting this ability,0,mage
Blessing of Miracles,You select 1 additional miracle each level after selecting this ability,0,priest`;

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
  // Mage/Priest dot gained AFTER the special is acquired (not retroactive) —
  // record the rank at the moment ownership actually starts.
  if (!owned && isSpecialOwned(character, special)) {
    if (special.name === 'Extra Spell') character.extraSpellBaseRank = character.classDots.Mage || 0;
    else if (special.name === 'Blessing of Miracles') character.extraMiracleBaseRank = character.classDots.Priest || 0;
  }
}

// ---------------------------------------------------------------------------
// Spells (data/spells.csv). A reference grimoire, not point-bought or owned
// individually — every spell becomes visible once a character has spent at
// least 1 rank in Mage (independent of current Focus). The file is proper
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

const SPELLS_CSV = `"id","school","name","cost","Dots Reqd","defy","clock","crutch","full_description"
"A01","Attack","The Coruscating Coffin","1d4","1","none","","","A coffin of white fire clamps shut on one visible creature within 120 feet. Deal Physical damage equal to the result. Extra targets in range split that total. Ordinary cover does not hide anyone you can already see. Only Magical Deflect against Spells: Attack reduces this. Instant."
"A02","Attack","The Thunderous Indictment","1d6","3","none","","","You speak a verdict and the air answers as a hammer. One visible creature within 100 feet takes Physical damage equal to the result. Extra targets split the total. Only Magical Deflect against Spells: Attack reduces this. Instant."
"A03","Attack","Brand of the Waiting Spark","1d6","4","none","","","A dim sigil settles on a visible creature within 60 feet. At the start of their next turn the sigil bursts and deals Physical damage equal to the result. Extra targets split the delayed total. Magical Deflect against Spells: Attack can spend itself against the brand before it opens. Instant once it discharges."
"A04","Attack","Chorus of Splintered Nerves","1d6","4","none","","","False pain sings along the nerves of a visible creature within 40 feet. Deal Mental damage equal to the result. This does not Control them. Extra targets split the total. Only Magical Deflect against Mental damage reduces this. Instant."
"A05","Attack","The Black Radiance","1d8","6","none","","","Darkness that still burns finds a creature you can hear within 60 feet. You need not see them. Deal Physical damage equal to the result. Extra targets split the total. Only Magical Deflect against Spells: Attack reduces this. Instant."
"A06","Attack","Damnation of the Inward Citadel","1d8","7","Willpower, and only if you spent 8 or more dots of Spell skill","","","You unbar the doors inside a visible creature within 60 feet. Deal Mental damage equal to the result. Extra targets split the total. Only Magical Deflect against Mental damage reduces this. If a target's Mental track is 0 or below, they are Controlled for a number of rounds equal to the Mental damage they actually took. They obey non-suicidal physical orders. They will not cast or plan for you. No chant is required."
"A07","Attack","The Particular Pyre","1d10","9","Constitution, and only if you spent 8 or more dots of Spell skill","","","A narrow column of heat finds a visible creature within 80 feet. Deal Physical damage equal to the result. After Magical Deflect against Spells: Attack and any Defy, leftover damage may be moved onto one other visible creature. Instant."
"A08","Attack","The Last Account","1d10","10","Constitution if Physical damage, Willpower if Mental damage — and only if you spent 8 or more dots of Spell skill","","","Choose Physical damage or Mental damage when you cast. One visible creature takes that damage equal to the result. Extra targets split the total. Matching Magical Deflect reduces it (Spells: Attack for Physical damage, Mental damage for Mental). If this drops that track to 0, rest and ordinary medicine cannot restore it. Only magic or miracle can."
"A09","Attack","Decree of Ligneous Dissolution","1d12","12","none","","","Living wood, leaf, and fungus forget they were ever whole. Non-magical plant and fungus in a number of 5-foot cubes equal to the result, within 100 feet, slough to ash. You may instead spend the result as Physical damage against plant creatures in range, split if several. Enchanted plants are untouched. Only Magical Deflect against Spells: Attack reduces damage from this working."
"A10","Attack","The Wind of Final Repose","1d20","18","Constitution, and only if you spent 8 or more dots of Spell skill","","","A soundless bloom of still air, 20-foot radius, point within 200 feet. Living creatures in the radius split Physical damage equal to the result. A creature dropped to 0 Physical damage by this working sleeps until magic or miracle wakes them, or until they take any new Physical damage. Only Magical Deflect against Spells: Attack reduces this."
"P01","Protection","Aegis of Mortal Hide","1d4","1","none","","","Willing creatures, worn gear, a mount, a wagon, or one doorway within 30 feet. Split the result. Each subject gains Physical Deflect against Physical damage from weapons, falls, claws, weather, and ordinary fire. Ablative. Lasts a number of hours equal to dots of Spell skill spent. This does not stop Spells or Miracles. Only magic or miracle ends it early."
"P02","Protection","Pall of Threefold Refraction","1d6","3","none","","","Willing creatures within 30 feet. Split the result. When you cast, choose one: Magical Deflect against Spells: Attack, or Magical Deflect against Spells: Elementalism. Each subject gains that Deflect equal to their share. Full value every matching hit. Lasts a number of rounds equal to dots of Spell skill spent."
"P03","Protection","Veil of the Inner Citadel","1d6","4","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Mental Deflect against Mental damage. Ablative. Lasts a number of hours equal to dots of Spell skill spent. Does not lift Control already in effect. Only magic or miracle ends it early."
"P04","Protection","Bastion of the Named House","1d8","6","none","","","One building you stand in. When you finish, choose one school: Spells: Attack, Spells: Elementalism, Spells: Illusion, or Spells: Necromancy. The building gains Magical Deflect against that school equal to the result. Full value each matching strike. Lasts a number of rounds equal to dots of Spell skill spent."
"P05","Protection","The Closed Eye","1d8","7","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Magical Deflect against Spells: Illusion and against information magic (scrying, Flame Scrying, Elemental Spy, forced questions) equal to their share. Full value. Lasts a number of rounds equal to dots of Spell skill spent."
"P06","Protection","Pall of the Quiet Blood","1d10","9","none","","","Willing creatures within 30 feet. Split the result. When you cast, choose one: Physical Deflect against Physical damage (mundane and Spells: Attack), or Physical Deflect against poison and toxin. Ablative. Lasts a number of hours equal to dots of Spell skill spent. Only magic or miracle ends it early."
"P07","Protection","Veil of the Iron Hour","1d10","10","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Mental Deflect against Mental damage and against Miracles: Spirit that deal Mental damage. Ablative. Lasts a number of hours equal to dots of Spell skill spent. Only magic or miracle ends it early."
"P08","Protection","Aegis of the Deep Lung","1d12","12","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Physical Deflect usable only against drowning, smoke, vacuum, poison, toxin, and inhaled disease. Ablative. Lasts a number of hours equal to dots of Spell skill spent."
"P09","Protection","Wardpact of the March","1d12","13","none","","","A road, bridge, or trail you stand on, up to 10 feet of length per point of the result. Anyone you name who stays on that stretch shares one pool. When you cast, choose Physical Deflect against Physical damage, or Magical Deflect against Spells: Transmutation. Physical Deflect is ablative and lasts hours equal to dots of Spell skill spent. Magical Deflect is full value and lasts rounds equal to dots of Spell skill spent."
"P10","Protection","Bastion of the Closed County","1d20","17","none","","","One building, or a circuit of buildings you can walk in an hour. When you finish, choose the protection: Physical Deflect against Physical damage (ablative, hours equal to dots of Spell skill spent), Magical Deflect against one Spell school you name (full value, rounds equal to dots of Spell skill spent), or Magical Deflect against Miracles: Warding and Miracles: Spirit (full value, rounds equal to dots of Spell skill spent). Split Physical Deflect among structures if you wish. The Living Well or The Vessel That Drinks may hitch only to an ablative Physical Deflect setting."
"E01","Elementalism","Elemental Spy","1d4","1","none","","","You teach a candle-flame, a stone, a cup of water, or a thread of smoke to keep your place. As a main action you may see and hear as if you stood there. Lasts a number of hours equal to the result, or until the focus is destroyed."
"E02","Elementalism","Flame Scrying","1d4","1","none","","","While you stay still, every open flame within 10 feet per point of the result becomes a window. You may look and listen through one at a time. Lasts a number of minutes equal to the result."
"E03","Elementalism","Query of Stone and Tide","1d6","3","none","","","Palm to earth, stone, water, or open air. Ask one question that mass could have witnessed in the last day. The answer is short and without poetry. Enchanted matter keeps silent. Instant."
"E04","Elementalism","Decree of Needed Substance","1d6","4","none","","","You pull a useful measure of one mundane element: one bucket of water, one person-minute of air, one torch-flame, or one 5-foot square of packed earth per point of the result. Water and earth remain. Flame lasts hours equal to dots of Spell skill spent unless fed. Air is spent as it is breathed."
"E05","Elementalism","Elemental Favor","1d6","4","none","","","At the end of the round, a number of 5-foot cubes equal to the result of non-magical earth, stone, water, fire, or air move or reshape as you ask. If the shape would stand without magic, it remains as ordinary matter. If not, it holds until magic or miracle takes it off."
"E06","Elementalism","The Unpaid Messenger","1d8","6","none","","","A small elemental — a walking coal, a wet shape, a dust-thing, a breath — does one concrete job it can finish in a number of minutes equal to the result. Carry a letter. Hold a door. Quench a hearth. It will not fight. Then it is gone."
"E07","Elementalism","Pact of Stone and Sea","1d8","7","none","","","Willing visible creatures; split if several. Each ignores mundane harm from one named element (earth, fire, water, or wind), including drowning, burial, or ordinary burning. This is not Deflect. Spells and Miracles still harm them. Lasts a number of minutes equal to the result."
"E08","Elementalism","The Burrower Below","1d10","9","none","","","The ground remembers a hallway. Open a tunnel a number of feet equal to the result through natural earth or stone, or one-fifth of that through worked stone. You choose the path. The hole remains as ordinary earthwork."
"E09","Elementalism","Elemental Vallation","1d12","12","none","","","A wall a number of feet long equal to the result, 10 feet high, within 80 feet. Earth must be dug; a man-sized hole needs 10 + dots of Spell skill spent damage from tools. Fire, water, or air: a creature forcing the line takes Physical damage equal to the result, split if several cross together. Only Magical Deflect against Spells: Elementalism stops that crossing damage. The wall lasts a number of rounds equal to dots of Spell skill spent."
"E10","Elementalism","Like the Stones","1d12","13","none","","","You need not breathe for a number of rounds equal to the result. Choose one: Stone — Physical Deflect against Physical damage equal to the result, ablative, lasting hours equal to the result. Water — pass any gap a mouse could use for a number of rounds equal to dots of Spell skill spent. Air — fly at walking speed for that many rounds. Fire — creatures in reach take 1 mundane Physical damage at the start of your turn for that many rounds; Physical Deflect can stop that, Magical Deflect cannot."
"T01","Transmutation","Velocitous Imbuement of the Unburdened Step","1d4","1","none","","","Willing creatures you touch or that stand within 30 feet. Their ground speed doubles. They may run on walls or beams if they finish on stable footing. Lasts a number of rounds equal to the result. Extra targets split the result for duration."
"T02","Transmutation","The Excellent Transpicuous Transformation","1d6","3","none","","","Willing creatures within 30 feet, and the gear they wear, turn glass-clear. Blows against them take -4, or your table's equivalent. A charge, a hard fall, or a gestured spell ends it for that person. Lasts a number of minutes equal to the result, split if several."
"T03","Transmutation","Like the Borrowed Hide","1d6","4","none","","","Willing creatures within 30 feet. Each gains one: breath of a fish, grip of a beetle, eyes of a cat, or Physical Deflect against Physical damage equal to their share of the result (ablative, hours equal to dots of Spell skill spent). Breath, grip, or eye last a number of minutes equal to the result."
"T04","Transmutation","Conjunction of the Inexorable Step","1d8","6","none","","","You and willing creatures within 30 feet appear at a visible, safe, solid point within a number of feet equal to 10 times the result. Extra bodies split the distance. Instant."
"T05","Transmutation","The Long Unpacking of the Form","1d8","7","none","","","Willing targets become mundane animals no larger than themselves. Gear folds inward. Speech or a killing blow ends it for that person. Lasts a number of minutes equal to the result, split if several."
"T06","Transmutation","Wardpact of Harmless Steel","1d10","9","none","","","Weapons within 60 feet, a number equal to dots of Spell skill spent, refuse to injure. Claws and teeth ignore this. Lasts until magic or miracle takes it off."
"T07","Transmutation","The Jade Palanquin, Lesser","1d10","10","none","","","A floating seat of pale stone. Assign the result as people (1 each) or pounds (100 each). Walking speed. Lasts a number of hours equal to dots of Spell skill spent, or until someone strikes the seat in anger."
"T08","Transmutation","Conjunction of the Second Pace","1d12","12","none","","","As Conjunction of the Inexorable Step, then at once a second translation using half the remaining result as feet times 10. Instant."
"T09","Transmutation","Calculation of the Evoked Beast","1d20","16","none","","","Minimum 4 dots of Spell skill spent. The result is the allotment. Split it equally across Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction, Hide, Instinct, Base Damage, Movement, and the beast's Stamina. Drop remainder. One beast. A new cast dismisses the old. Lasts until slain, dismissed, or dawn."
"T10","Transmutation","The Excellent Exchange of Mass","1d12","13","none","","","Swap two willing visible creatures within 10 feet per point of the result, or one willing creature and one unattended object of like bulk. Extra pairs split the range. Instant."
"N01","Necromancy","Query the Skull","1d4","1","none","","","Touch a corpse dead no more than a number of days equal to the result. It answers a number of short literal questions equal to dots of Spell skill spent. The same corpse will not do this twice."
"N02","Necromancy","Terrible Liveliness","1d6","3","none","","","Undead already loyal to you, a number up to your dots of Spell skill, wear the faces they had in life. Lasts until you drop a mask, or until magic or miracle strips it."
"N03","Necromancy","Smite the Dead","1d6","4","none","","","A pale shock at a point within 80 feet, 20-foot radius. Split Physical damage equal to the result among undead only. Living creatures are untouched. Only Magical Deflect against Spells: Necromancy reduces this."
"N04","Necromancy","Command the Hollow","1d8","6","Willpower, and only if you spent 8 or more dots of Spell skill","","","Mental damage equal to the result, undead only, 80 feet, split if several. Only Magical Deflect against Mental damage or Magical Deflect against Spells: Necromancy reduces this. An undead whose Mental track hits 0 is bound as if you raised it. Raised dead: every 5 points of result in a raising adds +1 to every rating on that husk, or buys one special (fearless, silent tread, tireless grip, semblance of life, armored bones). They last until you raise a new batch, unless you pay 1 stamina per old husk you keep."
"N05","Necromancy","The Borrowed Pulse","1d6","4","none","","","A willing living donor you touch loses Physical equal to the result. A living or undead recipient you touch gains the same, up to their cap. You may be the donor. No unwilling targets. Extra donors or recipients split the result. Instant."
"N06","Necromancy","Evocation of the Grave-Born Host","1d8","7","none","","","Touch intact corpses. Every 5 points of result adds +1 to every rating on that husk, or buys one special (fearless, silent tread, tireless grip, semblance of life, armored bones). Several corpses split those steps. They last until you raise a new batch, unless you pay 1 stamina per old husk you keep."
"N07","Necromancy","Final Death","1d10","9","Constitution, once, and only after the first failed attempt to heal them","","","Visible living creatures, up to a number equal to dots of Spell skill spent. They cannot recover Physical by rest or ordinary medicine. Only magic or miracle restores them, or a successful Defy after that first failed healing. If they never try to heal, the ban lasts a number of rounds equal to dots of Spell skill spent."
"N08","Necromancy","Festering Curse","1d10","10","Constitution — only if the target's relevant scores sit in a higher band than yours","","","Visible living creatures, up to a number equal to dots of Spell skill spent. Food is ash. Water does not slake. Pleasures go numb. They take -2 on social work. No damage. Lasts until magic or miracle takes it off, or until you lift it."
"N09","Necromancy","Compel Flesh","1d12","12","Physique, at the start of each of their turns","","","Up to a number of living or embodied undead equal to dots of Spell skill spent, each within 100 feet. The body obeys non-suicidal physical orders. The mind is free. A successful Defy ends it for that body, and they take mundane Physical damage equal to your dots of Spell skill; Physical Deflect against Physical damage can reduce that, Magical Deflect cannot. If not thrown off, lasts a number of rounds equal to dots of Spell skill spent."
"N10","Necromancy","Forgetting the Grave","1d12","13","none","","","Willing creatures, up to a number equal to dots of Spell skill spent, do not die for 1 + dots of Spell skill spent rounds. When it ends, postponed collapse arrives unless The Borrowed Pulse has paid it."
"I01","Illusion","Phantasmal Mimesis","1d4","1","none","","","A number of 5-foot cubes equal to the result, within 60 feet, fill with sight, sound, and smell. They may sit together or apart. The image behaves as you intend while you can see it. Lasts a number of rounds equal to dots of Spell skill spent. A person with hard reason to doubt may spend an action studying; then they know it is false. This does not deal damage."
"I02","Illusion","Damnation of the Sense","1d6","3","Intuition, and only if you spent 8 or more dots of Spell skill","","","Visible creatures, up to a number equal to dots of Spell skill spent. One sense each — sight, hearing, or touch — is lied to or blanked for a number of rounds equal to your dots of Spell skill. If they Defy, it lasts only until the end of their next turn. This does not deal damage."
"I03","Illusion","The Excellent Crowd of No One","1d6","4","none","","","Willing creatures within 30 feet, up to a number equal to dots of Spell skill spent, are easy to miss by eye and ear. Touch, careful search, a sprint, or an attack ends it for that person. Lasts a number of minutes equal to the result. This does not deal damage."
"I04","Illusion","The Inexorable Imputation","1d8","6","Intellect — only if the sentence is dangerous to believe","","","One short sentence. Hearers within 40 feet treat it as true unless it is impossible. Exempt a number of hearers up to your dots of Spell skill. Lasts until magic or miracle clears it. This does not deal damage."
"I05","Illusion","Casting Forth the False Room","1d8","7","none","","","The space you stand in, up to 5 feet per point of the result on a side, looks and sounds like a different place of the same size. Lasts a number of minutes equal to dots of Spell skill spent. Anyone who tests a surface with real force sees through it. This does not deal damage."
"I06","Illusion","Phantasmal Watchman","1d8","7","none","","","False figures, a number up to dots of Spell skill spent, each walking a path within 60 feet. They cannot injure. Lasts a number of hours equal to the result, split among the figures if you wish. This does not deal damage."
"I07","Illusion","The Long Lie of the Face","1d10","9","none","","","Willing creatures, up to a number equal to dots of Spell skill spent, wear other human faces and voices. Lasts a number of hours equal to the result, split if several, or until that person draws blood. This does not deal damage."
"I08","Illusion","The Inexorable Hour","1d12","12","Intellect, and only if you spent 8 or more dots of Spell skill","","","Hearers within 40 feet believe one hour of false memory you state in a sentence or two. Impossible hours fail. Lasts until magic or miracle clears it. This does not deal damage."
"I09","Illusion","Palace That Is Not","1d12","13","Intuition — only if they shove a wall or floor with full force","","","A false interior over real space, up to 5 feet per point of the result on a side. Sight, sound, smell, heat, texture. None of it can injure. A painted fire does not burn. If they put their weight into a surface and Defy, they understand the palace is hollow. Lasts a number of hours equal to dots of Spell skill spent."
"I10","Illusion","The Long Masque of the City","1d20","18","none","","","A false street, court, or quarter up to 10 feet per point of the result on a side. Same rules as Palace That Is Not. Lasts a number of hours equal to dots of Spell skill spent. Only magic or miracle ends it early."
"R01","Ritual Magic","The Seal of Amber","1d6","3","none","10 minutes, or one night if you name more than one body","A volunteer loses 4 Physical, or apprentices pay 10 stamina each.","Willing or helpless bodies, up to your dots of Spell skill. Stasis: no aging, no breath, ordinary weapons do not bite, light enough to carry. Lasts a number of hours equal to the result, split among bodies if you wish. Pay stamina across the clock. Roll when the clock finishes. If the clock breaks, a Magic check returns half of your stamina."
"R02","Ritual Magic","The Amber Archive","1d6","4","none","8 hours","The original you will lose, and one of: 2 Physical of your blood, an apprentice's 15 stamina, or an old library.","A crystal copy ordinary fire, damp, and time will not eat. Lasts a number of years equal to the result. Pay stamina across the clock. Roll when the clock finishes. If the clock breaks, a Magic check returns half of your stamina."
"R03","Ritual Magic","Decree Upon the Weather","1d8","6","none","3 hours, or 8 hours if you want days instead of hours","Open sky, and a choir paying stamina or Physical bled from willing donors (8 Physical for the short clock, 15 for the long).","One weather — rain, clear, frost, or still air — radius 50 feet per point of the result (100 feet per point on the long clock). Lasts a number of hours equal to dots of Spell skill spent, or a number of days equal to your dots of Spell skill on the long clock. Only magic or miracle clears it early. No aimed bolt."
"R04","Ritual Magic","Vallation of the Closed Horizon","1d8","7","none","1 hour, or dusk to dusk for a moon-long wall","Three payers into the working, or an ox, or an old stone circle. The long clock also needs a standing stone raised that night and a living well.","Circuit 10 feet per point of the result (20 feet per point on the long clock), 12 feet high. When you finish, choose ablative Physical Deflect against Physical damage (hours equal to dots of Spell skill spent) or Magical Deflect against Spells: Attack and Spells: Elementalism (full value, rounds equal to dots of Spell skill spent). Earth must be dug. Fire, water, or air: crossing deals Physical damage equal to the result, split among those who cross together; only Magical Deflect against Spells: Elementalism stops that. If you chose an ablative pool, each discharge also eats the pool. The Living Well or The Vessel That Drinks may hitch to an ablative pool. Short clock ends at dawn if anything remains. Long clock ends at the next full moon if anything remains. Only magic or miracle ends it earlier."
"R05","Ritual Magic","Rite of the Fed Servitor","1d8","7","none","4 hours","A corpse, and two apprentices paying stamina.","One or more undead. Every 5 points of result adds +1 to every rating on that husk, or buys one special (fearless, silent tread, tireless grip, semblance of life, armored bones). Lasts until the next new moon if fed 5 stamina each dusk (a hitched Living Well or Vessel That Drinks may pay). Otherwise until you raise a new batch."
"R06","Ritual Magic","Calculation of the High Servitor","1d20","16","none","6 hours","Beast or condemned body as clay, and four apprentices paying in, or a rare reagent.","Minimum 6 dots of Spell skill spent. One beast. Split the result equally across Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction, Hide, Instinct, Base Damage, Movement, and the beast's Stamina. Drop remainder. Feed 5 stamina at dusk or it lasts only until the new moon."
"R07","Ritual Magic","Extirpate Arcana","1d10","9","Magic — only if the target working's caster has dots of Spell skill in a higher band than yours","10 minutes","Salt, iron, or running water on the site.","End one lasting magical effect you can see or touch, including workings that last until magic or miracle. The result must at least match the original working's result, or the original dots of Spell skill spent times 4 if that result is unknown."
"R08","Ritual Magic","The Closed Sanctum","1d10","10","none","3 hours","Four walls and a roof, and two people paying stamina.","One room or small house. Split the result between ablative Physical Deflect against Physical damage (hours equal to dots of Spell skill spent) and Magical Deflect against Spells: Illusion and information magic (full value, rounds equal to dots of Spell skill spent). The Living Well or The Vessel That Drinks may hitch to the Physical Deflect pool only."
"R09","Ritual Magic","Casting Forth the Far Voice","1d12","12","none","1 hour","A token the listener has touched.","Speak to one known living creature within a number of miles equal to the result. They hear you for a number of minutes equal to dots of Spell skill spent. You do not see them."
"R10","Ritual Magic","Conjunction of the Standing Gate","1d20","18","none","dusk to dusk","Two prepared doorways, a living well, and 20 Physical from willing donors total, or a dozen laborers paying 5 each.","Two marked doorways open onto each other. Anyone may pass. Give the result to the gate as ablative Physical Deflect against Physical damage from smash (hours equal to dots of Spell skill spent) or as Magical Deflect against Spells: Transmutation (full value, rounds equal to dots of Spell skill spent). Lasts until that defense is gone, or until magic or miracle closes the gate. The Living Well or The Vessel That Drinks may hitch to an ablative setting."
"R11","Ritual Magic","The Living Well","1d8","6","none. Unwilling targets do not opt out.","10 minutes","A bowl, pit, or marked stone, and at least one willing living creature (you may be that creature).","Name living creatures you can see or touch, up to one per dot of Spell skill. Willing and unwilling both bind when the clock ends. Unwilling creatures get no Defy and cannot refuse. A willing creature names a stamina stake, up to what they have. An unwilling creature's stake is their current stamina in full. Hitch the well to one standing working that uses an ablative pool. Magical Deflect cannot drink a well. When the hitch is struck: drain bound stamina first; a body at 0 stamina stays bound and further drain is Physical damage (Physical Deflect against Physical damage can reduce it, Magical Deflect cannot); then the hitch's own pool; then the hitch ends. Unwilling cannot leave. The well ends when any willing participant leaves or dies, when the hitch ends, when magic or miracle breaks this working, or when a body is bound to a new well. If the last willing participant dies to the well's own Physical damage, the well ends and unwilling survivors are free. Failed clock: a Magic check returns half the stamina you spent. No one is bound."
"R12","Ritual Magic","The Vessel That Drinks","1d12","13","none. Unwilling targets do not opt out.","dusk to dusk","One finished object that will hold the working — bowl, ring, stone, blade, door-iron, or the like — and at least one willing living creature bound at the close (you may be that creature).","The object becomes a drinking vessel. It does nothing until you hitch it to an ablative pool. Magical Deflect cannot drink from this item. When the clock ends, name living creatures you can see or touch, up to one per dot of Spell skill, including the required willing body. They bind to the item. Unwilling creatures get no Defy and cannot refuse. A willing creature names how much stamina the item may take. An unwilling creature's stake is their current stamina in full. While hitched, blows drain stamina from the bound, then Physical damage on bodies at 0 stamina (Physical Deflect against Physical damage can reduce that), then the hitch pool, then the hitch ends. The item remains. Hitch it again as a main action if a willing creature is still bound to it. Distance does not free anyone. Unwilling cannot leave. This item-working ends when any willing participant bound to the item leaves or dies. Magic or miracle, or destroying the object, frees everyone. The result is the hold: the most stamina-and-then-Physical damage it can pull in a single blow. Demand above the hold goes to the hitch pool. The object stays a vessel until magic, miracle, or destruction. Bindings last only while a willing participant remains bound. Failed clock: a Magic check returns half the stamina you spent. The object is ordinary. No one is bound."`;

const SPELLS = parseCsvWithHeader(SPELLS_CSV).map((r) => ({
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
// Mage rank grants exactly one learnable-spell slot. Every spell is visible
// once 1+ ranks are in Mage, regardless of current Focus, but only as many
// can be *known* at once as Mage ranks allow.
function hasSpellAccess(character) {
  return (character.classDots.Mage || 0) >= 1;
}

// If the character owns the "Extra Spell" special, every Mage dot gained
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
  return getSpellSlotCountForRank(character, character.classDots.Mage || 0);
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
// Miracles (data/miracle.csv). Same rules as Spells above, but for Priest:
// a reference grimoire, visible once 1+ ranks are in Priest, with a free
// learned/not-learned toggle per entry (no point cost).
// ---------------------------------------------------------------------------

const MIRACLE_CSV = `"id","school","name","cost","Dots Reqd","defy","clock","crutch","full_description"
"PN01","Necromancy","Last Office of the Dead","1d4","1","none","","","Touch a corpse. Decay pauses. Vermin leave the cloth. The body cannot be raised by any working cheaper than 1d8 until this office ends. Lasts a number of days equal to the result. Only magic or miracle ends it early."
"PN02","Necromancy","Query the Consecrated Skull","1d4","1","none","","","Touch a corpse dead no more than a number of days equal to the result that has received some rite of rest, even a hurried one. It answers a number of short literal questions equal to dots of Miracle skill spent. Once per corpse. Answers tend toward what the dead believed at the end."
"PN03","Necromancy","Smite the Unquiet","1d6","3","none","","","A pale shock at a point within 80 feet, 20-foot radius. Split Physical damage equal to the result among undead only. Living creatures are untouched. Only Magical Deflect against Miracles: Necromancy or Spells: Necromancy reduces this."
"PN04","Necromancy","Still the Walking Corpse","1d6","4","none","","","One visible undead within 60 feet takes Physical damage equal to the result. Extra targets split the total. Only Magical Deflect against Miracles: Necromancy reduces this."
"PN05","Necromancy","The Peaceful Mask","1d8","6","none","","","Undead already bound to you or lying at rest, a number up to your dots of Miracle skill, appear as they did in honest sleep or ordinary life. Lasts until you drop a mask, or until magic or miracle strips it."
"PN06","Necromancy","Evocation of the Ancestor Host","1d8","7","none","","","Touch intact corpses you name as kin, parish dead, or sworn dead. Every 5 points of result adds +1 to every rating on that husk, or buys one special (fearless, silent tread, tireless grip, semblance of life, armored bones). Several corpses split those steps. They obey the priest. They last until you raise a new batch, unless you pay 1 stamina per old husk you keep."
"PN07","Necromancy","The Hallowed Grave","1d10","9","none","","","Consecrate one grave, pyre-place, or tomb you can touch. Workings to raise from it fail unless their result beats this result. Lasts until magic or miracle breaks the hallow."
"PN08","Necromancy","Final Peace","1d10","10","Constitution — only if the target undead's maker has dots of Spell skill or Miracle skill in a higher band than yours","","","Visible undead, up to a number equal to dots of Miracle skill spent. They cannot recover Physical by rest or ordinary mending. Only magic or miracle restores them. If this drops one to 0 Physical, it will not rise again unless a working of 1d12 or greater is used."
"PN09","Necromancy","Compel the Unquiet Bones","1d12","12","Physique, at the start of each of their turns","","","Up to a number of embodied undead equal to dots of Miracle skill spent, each within 100 feet. The body obeys non-suicidal physical orders. The mind, if any, is free. A successful Defy ends it for that body, and they take mundane Physical damage equal to your dots of Miracle skill; Physical Deflect against Physical damage can reduce that, Magical Deflect cannot. If not thrown off, lasts a number of rounds equal to dots of Miracle skill spent."
"PN10","Necromancy","The Last Trump","1d20","18","Bravery, and only if you spent 8 or more dots of Miracle skill","","","A 20-foot radius, point within 100 feet. Undead in the radius split Physical damage equal to the result. Any dropped to 0 Physical by this working fall still and cannot be raised except by a 1d20 magic or miracle. Living in the radius are untouched. Only Magical Deflect against Miracles: Necromancy reduces this."
"PR01","Ritual Magic","Vigil of Amber Rest","1d6","3","none","10 minutes, or one night if you name more than one body","A candle that burns the whole clock, and a willing watcher (you may be that watcher).","Willing or helpless bodies, up to your dots of Miracle skill. Sacred stasis: no aging, no breath, ordinary weapons do not bite, light enough to carry. Lasts a number of hours equal to the result, split among bodies if you wish. Pay stamina across the clock. Roll when the clock finishes. If the clock breaks, a Magic check returns half of your stamina."
"PR02","Ritual Magic","The Reliquary","1d6","4","none","8 hours","A relic, bone, cloth, or written prayer you will seal, and one of: 2 Physical of your blood, a congregation's 15 stamina, or a place that has held worship for a generation.","Seal the offering in crystal or iron that ordinary fire, damp, and time will not eat. Lasts a number of years equal to the result."
"PR03","Ritual Magic","Weather of the Parish","1d8","6","none","3 hours, or 8 hours if you want days instead of hours","Open sky over consecrated or claimed ground, and a choir paying stamina or 8 Physical from willing donors (15 for the long clock).","One weather — rain, clear, frost, or still air — radius 50 feet per point of the result (100 feet per point on the long clock). Lasts a number of hours equal to dots of Miracle skill spent, or a number of days equal to your dots of Miracle skill on the long clock. Only magic or miracle clears it early. No aimed bolt."
"PR04","Ritual Magic","Consecration of the Closed Horizon","1d8","7","none","1 hour, or dusk to dusk for a moon-long bound","Three worshippers paying stamina, or an offering animal, or old holy ground. The long clock also needs a standing stone or altar raised that night.","Circuit 10 feet per point of the result (20 feet per point on the long clock), 12 feet high. Choose ablative Physical Deflect against Physical damage (hours equal to dots of Miracle skill spent) or Magical Deflect against Spells: Attack and Miracles: Necromancy (full value, rounds equal to dots of Miracle skill spent). Crossing a bright line deals Physical damage equal to the result, split among those who cross together; only Magical Deflect against Miracles: Warding stops that. Ablative pools may hitch The Offered Well or The Vessel of Offered Life. Short clock ends at dawn if anything remains. Long clock ends at the next full moon if anything remains. Only magic or miracle ends it earlier."
"PR05","Ritual Magic","Rite of the Temple Servitor","1d8","7","none","4 hours","A corpse given last office, and two worshippers paying stamina.","One or more sacred dead using +1 to all ratings per 5 points of result, or one special (fearless, silent tread, tireless grip, semblance of life, armored bones). Lasts until the next new moon if fed 5 stamina each dusk. Otherwise until you raise a new batch."
"PR06","Ritual Magic","High Working of the Guardian Beast","1d20","16","none","6 hours","A living beast as clay, and four worshippers paying in, or a rare relic.","Minimum 6 dots of Miracle skill spent. One guardian beast. Split the result equally across Physique, Strength, Constitution, Agility, Dexterity, Intellect, Intuition, Magic, Bravery, Willpower, Charisma, Attraction, Hide, Instinct, Base Damage, Movement, and the beast's Stamina. Drop remainder. Feed 5 stamina at dusk or it lasts only until the new moon."
"PR07","Ritual Magic","Extirpate the Unholy","1d10","9","Magic — only if the target working's caster has dots of Spell skill or Miracle skill in a higher band than yours","10 minutes","Salt, iron, running water, or holy oil on the site.","End one lasting magical or unholy effect you can see or touch, including workings that last until magic or miracle. The result must at least match the original working's result, or the original dots spent times 4 if that result is unknown."
"PR08","Ritual Magic","The Hallowed Sanctum","1d10","10","none","3 hours","Four walls and a roof, and two worshippers paying stamina.","One room or small house. Split the result between ablative Physical Deflect against Physical damage (hours equal to dots of Miracle skill spent) and Magical Deflect against Miracles: Spirit and information magic (full value, rounds equal to dots of Miracle skill spent). The Offered Well or The Vessel of Offered Life may hitch to the Physical Deflect pool only."
"PR09","Ritual Magic","Far Prayer","1d12","12","none","1 hour","A token the listener has touched, or their true name spoken on consecrated ground.","Speak to one known living creature within a number of miles equal to the result. They hear you for a number of minutes equal to dots of Miracle skill spent. You do not see them."
"PR10","Ritual Magic","The Standing Threshold","1d20","18","none","dusk to dusk","Two prepared doorways on consecrated ground, an offered well, and 20 Physical from willing donors total or a dozen laborers paying 5 each.","Two marked doorways open onto each other. Anyone you permit may pass. Give the result to the gate as ablative Physical Deflect against Physical damage (hours equal to dots of Miracle skill spent) or Magical Deflect against Spells: Transmutation (full value, rounds equal to dots of Miracle skill spent). Lasts until that defense is gone, or until magic or miracle closes the gate."
"PR11","Ritual Magic","The Offered Well","1d8","6","none","10 minutes","A bowl, font, pit, or marked stone, and at least one willing living creature (you may be that creature).","Name living creatures you can see or touch, up to one per dot of Miracle skill. Each must speak assent during the clock. Silence, fear, or a nod under a blade is not assent. There are no unwilling targets. A volunteer names how much stamina the well may take. They may also permit Physical damage after stamina is gone. If they refuse that, the well skips them. Hitch to one standing working that uses an ablative pool. Magical Deflect cannot drink this well. Drain stamina first, then Physical damage only from those who permitted life (Physical Deflect against Physical damage can reduce it), then the hitch pool, then the hitch ends. When any volunteer leaves or dies, the whole well ends. Magic or miracle also breaks it. Failed clock: a Magic check returns half the stamina you spent. No one is bound."
"PR12","Ritual Magic","The Vessel of Offered Life","1d12","13","none","dusk to dusk","One finished object — bowl, cup, ring, relic-bone, door-iron — and at least one willing living creature bound at the close (you may be that creature).","The object becomes a vessel of offered life. It does nothing until you hitch it to an ablative pool. Magical Deflect cannot drink from it. Bind living creatures you can see or touch, up to one per dot of Miracle skill. Each must speak assent. They bind to the item. A volunteer names a stamina stake and may permit Physical damage after stamina is gone. Drain stamina, then permitted Physical damage (Physical Deflect against Physical damage can reduce it), then the hitch pool. The result is the hold per blow. Demand above the hold goes to the hitch pool. Ends when any volunteer bound to the item leaves or dies. The object stays a vessel until magic, miracle, or destruction. Bindings last only while a volunteer remains bound. Failed clock: a Magic check returns half the stamina you spent. The object is ordinary. No one is bound."
"PH01","Healing","Balm of the Open Hand","1d4","1","none","","","Touch a living creature. Restore Physical equal to the result, up to their usual cap. Extra living targets split the result. This is true healing, not a transfer. Instant."
"PH02","Healing","Litany of the Walking Wound","1d4","1","none","","","Willing living creatures within 30 feet. Split the result as restored Physical, up to each cap. Instant."
"PH03","Healing","The Closed Cut","1d6","3","none","","","Touch a living creature. Restore Physical equal to the result and stop ordinary bleeding. Extra targets split the result. Instant."
"PH04","Healing","Mercy of the Second Pulse","1d6","4","none","","","A living creature within 30 feet who is at 0 Physical and not yet past the point of death is restored Physical equal to the result, up to their cap. Extra such creatures split the result. Instant."
"PH05","Healing","Anointing of Steady Flesh","1d8","6","none","","","Willing living creatures within 30 feet. Split the result. Each gains restored Physical equal to their share now, and the same amount again after a number of rounds equal to dots of Miracle skill spent, if they are still living."
"PH06","Healing","The Long Convalescence","1d8","7","none","","","Willing living creatures you touch, up to a number equal to dots of Miracle skill spent. Restore Physical equal to the result, split among them. Then each recovers 1 Physical at dawn each day for a number of days equal to dots of Miracle skill spent. Only magic or miracle ends the daily recovery early."
"PH07","Healing","Mass of Open Hands","1d10","9","none","","","Living creatures within 30 feet, up to a number equal to dots of Miracle skill spent. Split restored Physical equal to the result. Instant."
"PH08","Healing","The Unmaking of Mortal Ruin","1d10","10","none","","","Touch a living creature. Restore Physical equal to the result and mend one mundane maiming: a broken bone set true, a ruined eye's pain quieted, a severed finger's bleeding closed. It does not regrow a lost limb. Instant."
"PH09","Healing","Forgetting the Threshold","1d12","12","none","","","Willing living creatures, up to a number equal to dots of Miracle skill spent, do not die for 1 + dots of Miracle skill spent rounds. When it ends, postponed collapse arrives unless healing has already paid it. This is a hold, not a restore."
"PH10","Healing","The Great Restoration","1d20","19","none","","","Touch a living creature. Restore Physical equal to the result, up to their cap. If they were missing a mundane limb, eye, or organ lost within a number of days equal to dots of Miracle skill spent, it returns whole. Older losses are not restored. Instant."
"PC01","Curing","Water of Simple Fevers","1d4","1","none","","","Touch a living creature. End one ordinary fever, flux, or mild infection whose hold is no stronger than the result. Extra targets split the result as the strength you spend on each. Instant."
"PC02","Curing","Cast Out the Venom","1d6","3","none","","","Touch a living creature. End mundane poison or toxin whose strength is no greater than the result. Extra targets split the result. Instant."
"PC03","Curing","The Clean Lung","1d6","4","none","","","Willing living creatures within 30 feet. Split the result. Each is cleared of smoke, drowning-water, or mundane inhaled poison up to their share. Instant."
"PC04","Curing","Unbind the Worm","1d8","6","none","","","Touch a living creature. End one mundane disease or malady. If the disease is magical, the result must at least match the working that laid it, or dots of Miracle skill spent times 4 if that result is unknown. Instant."
"PC05","Curing","Sight and Hearing Returned","1d8","7","none","","","Touch a living creature. End mundane blindness, deafness, or numbness caused by injury, illness, or a working whose result this roll matches or beats. Instant."
"PC06","Curing","The Quieted Mind","1d10","9","Willpower — only if the madness was laid by a caster whose dots of Spell skill or Miracle skill are in a higher band than yours","","","Touch a living creature. End mundane terror, panic, or a magical mental working whose result this matches or beats. Does not lift Control that is still inside its listed rounds. Instant."
"PC07","Curing","Lift the Petty Curse","1d10","10","none","","","Touch a creature or object. End one lasting curse, blight, or malady whose result this matches or beats, or dots of Miracle skill spent times 4 if unknown. Instant."
"PC08","Curing","The Scouring of Plague","1d12","12","none","","","Living creatures within 30 feet, up to a number equal to dots of Miracle skill spent. End one named mundane plague, disease, or infection in each. Magical plague requires the result to match or beat the laying working. Instant."
"PC09","Curing","Break the Lasting Hex","1d12","13","Magic — only if the hex-layer's dots of Spell skill or Miracle skill are in a higher band than yours","","","One visible creature or object within 30 feet. End a lasting magical hex, geas, or blight, including those that last until magic or miracle. The result must match or beat the original result. Instant."
"PC10","Curing","Miracle of the Whole Flesh","1d20","19","none","","","Touch a living creature. End all mundane poison, toxin, disease, malady, blindness, deafness, and fever on them, and one magical curse whose result this matches or beats. Instant."
"PW01","Warding","Circle of the Humble Threshold","1d4","1","none","","","Willing creatures, objects, mounts, wagons, or one doorway within 30 feet. Split the result. Each subject gains Physical Deflect against Physical damage from weapons, falls, claws, weather, and ordinary fire. Ablative. Lasts a number of hours equal to dots of Miracle skill spent. Does not stop Spells or Miracles. Only magic or miracle ends it early."
"PW02","Warding","Litany Against the Blade","1d6","3","none","","","Willing creatures within 30 feet. Split the result. When you cast, choose Magical Deflect against Spells: Attack or Magical Deflect against Miracles: Necromancy. Each subject gains that Deflect equal to their share. Full value. Lasts a number of rounds equal to dots of Miracle skill spent."
"PW03","Warding","Veil of the Quiet Heart","1d6","4","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Mental Deflect against Mental damage. Ablative. Lasts a number of hours equal to dots of Miracle skill spent. Does not lift Control already in effect. Only magic or miracle ends it early."
"PW04","Warding","Ward of the Named House","1d8","6","none","","","One building you stand in. Choose one: Magical Deflect against Spells: Elementalism, Magical Deflect against Spells: Illusion, or Magical Deflect against Miracles: Spirit. The building gains that Deflect equal to the result. Full value. Lasts a number of rounds equal to dots of Miracle skill spent."
"PW05","Warding","The Closed Grave-Line","1d8","7","none","","","A line or circle 5 feet per point of the result. Undead that try to cross take Physical damage equal to the result, split if several cross together. Only Magical Deflect against Miracles: Warding stops that. The line lasts a number of rounds equal to dots of Miracle skill spent."
"PW06","Warding","Pall of Sacred Blood","1d10","9","none","","","Willing creatures within 30 feet. Split the result. When you cast, choose Physical Deflect against Physical damage (mundane and Spells: Attack) or Physical Deflect against poison, toxin, and disease. Ablative. Lasts hours equal to dots of Miracle skill spent. Only magic or miracle ends it early."
"PW07","Warding","The Spirit-Bar","1d10","10","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Magical Deflect against Miracles: Spirit, possession, and information magic equal to their share. Full value. Lasts a number of rounds equal to dots of Miracle skill spent."
"PW08","Warding","Sanctuary of the Deep Breath","1d12","12","none","","","Willing creatures within 30 feet. Split the result. Each subject gains Physical Deflect usable only against drowning, smoke, vacuum, poison, toxin, and inhaled malady. Ablative. Lasts hours equal to dots of Miracle skill spent."
"PW09","Warding","Wardpact of the Holy March","1d12","13","none","","","A road, bridge, or trail you stand on, up to 10 feet of length per point of the result. Anyone you name who stays on that stretch shares one pool. Choose Physical Deflect against Physical damage (ablative, hours equal to dots of Miracle skill spent) or Magical Deflect against Spells: Transmutation (full value, rounds equal to dots of Miracle skill spent)."
"PW10","Warding","Consecration of the Parish","1d20","17","none","","","One building, or a circuit of buildings you can walk in an hour. Choose Physical Deflect against Physical damage (ablative, hours equal to dots of Miracle skill spent), Magical Deflect against one Spell school you name (full value, rounds equal to dots of Miracle skill spent), or Magical Deflect against Miracles: Spirit and Miracles: Necromancy (full value, rounds equal to dots of Miracle skill spent). The Offered Well or The Vessel of Offered Life may hitch to an ablative setting."
"PS01","Spirit","Whisper to the Near Shade","1d4","1","none","","","Speak to one visible spirit, ghost, or unbound dead within 30 feet. You understand each other for a number of minutes equal to the result. It is not forced to answer truly."
"PS02","Spirit","The Kindled Lamp","1d4","1","none","","","You see spirits, unbound dead, and riding things within 10 feet per point of the result as pale lamps. Lasts a number of minutes equal to dots of Miracle skill spent."
"PS03","Spirit","Query of the Unburied","1d6","3","none","","","Ask one short question of a spirit you can see. It answers literally if it knows. Enchanted or bound spirits may refuse unless the result is 8 or more."
"PS04","Spirit","Dismissal of the Petty Haunt","1d6","4","none","","","One visible minor haunt, residual ghost, or place-echo within 60 feet is sent on. If its strength is greater than the result, it is only driven 10 feet and silenced for a number of rounds equal to dots of Miracle skill spent."
"PS05","Spirit","The Anchored Soul","1d8","6","none","","","Willing living creatures within 30 feet, up to a number equal to dots of Miracle skill spent. Each cannot be ridden or pulled from the body by Miracles: Spirit or Spells: Necromancy whose result is less than this result. Lasts hours equal to dots of Miracle skill spent. Only magic or miracle ends it early."
"PS06","Spirit","Exorcism of the Riding Thing","1d8","7","Willpower — only if the rider's maker or the rider itself has dots of Spell skill or Miracle skill in a higher band than yours","","","One visible living creature within 30 feet. A spirit or dead thing riding them is expelled if this result matches or beats the working that seated it, or dots of Miracle skill spent times 4 if unknown. The host takes no damage from the expulsion."
"PS07","Spirit","Communion of the Ancestor","1d10","9","none","","","Name a dead person whose name you know. If any shade of them can hear, they speak with you for a number of minutes equal to dots of Miracle skill spent. They are literal and limited to what they knew. Once per named dead per dawn."
"PS08","Spirit","The Iron Name","1d10","10","Willpower, and only if you spent 8 or more dots of Miracle skill","","","One visible spirit within 60 feet. Mental damage equal to the result. Only Magical Deflect against Mental damage or Magical Deflect against Miracles: Spirit reduces this. If its Mental track hits 0, it is bound to you for a number of rounds equal to the Mental damage it took, and obeys non-suicidal commands."
"PS09","Spirit","Sending of the Lost","1d12","12","none","","","One willing spirit or unbound dead you can see is sent to rest. It will not haunt that place again unless called by a working of 1d12 or greater. Instant."
"PS10","Spirit","The Great Unhousing","1d20","18","Willpower, and only if you spent 8 or more dots of Miracle skill","","","A 20-foot radius, point within 80 feet. Spirits and riding things in the radius split Mental damage equal to the result. Any dropped to 0 Mental are expelled and cannot re-enter a body in that radius until magic or miracle permits. Living hosts take no Physical damage from this."
"PA01","Animism","Speech of Fur and Feather","1d4","1","none","","","You speak with mundane beasts within 30 feet. They answer as beasts answer: want, fear, scent, path. Lasts a number of minutes equal to the result."
"PA02","Animism","The Watching Beast","1d4","1","none","","","One mundane beast you touch will watch a place or person and try to warn you by cry or return. Lasts a number of hours equal to the result, or until the beast is badly hurt."
"PA03","Animism","Call of the Small Host","1d6","3","none","","","Mundane small beasts — birds, rats, insects in a swarm-mass — in a 20-foot radius within 60 feet do one simple task: scatter, gather, harry, or leave. Lasts a number of rounds equal to dots of Miracle skill spent."
"PA04","Animism","Blessing of the Field","1d6","4","none","","","A plot of earth 5 feet on a side per point of the result. Crops, grass, or orchard in it grow as if given a good week, or a blight or malady of result less than this is lifted. Instant for the blessing; the growth is ordinary after."
"PA05","Animism","Pact of Tooth and Root","1d8","6","none","","","Willing visible creatures, split if several. Each ignores mundane harm from one named natural source: thorn, cold water, ordinary beast-bite, or exposure. This is not Deflect. Spells and Miracles still harm them. Lasts a number of minutes equal to the result."
"PA06","Animism","The River Asked","1d8","7","none","","","Touch a river, spring, or standing water. Ask one question it could have witnessed in the last day, or bid it do one small act: rise a foot, still a ford, or yield a bucket per point of the result. Enchanted water does not obey."
"PA07","Animism","Skin of the Cousin","1d10","9","none","","","A willing living creature becomes one mundane animal no larger than themselves. Gear melds. Speech or a killing blow ends it. Lasts a number of minutes equal to the result, split if several willing targets."
"PA08","Animism","The Green Road","1d10","10","none","","","You and willing creatures within 30 feet move through undergrowth, shallow water, and broken ground at full speed. Lasts a number of hours equal to dots of Miracle skill spent. You may name a number of extra bodies up to dots of Miracle skill spent."
"PA09","Animism","Totem of the Standing Kin","1d12","12","none","","","Mark a carved post, tree, or stone you touch. Mundane beasts of one named kind within 10 feet per point of the result treat it as home and will not hunt those you name while they stay within that reach. Lasts until magic or miracle takes it off, or until the mark is destroyed."
"PA10","Animism","The Land Made Answer","1d20","17","none","","","Natural earth, stone, root, and water in a number of 5-foot cubes equal to the result, within 100 feet, move or reshape as you ask at the end of the round. If the shape would stand without miracle, it remains as ordinary land. If not, it holds until magic or miracle takes it off. This will not work on forged metal or enchanted ground."`;

const MIRACLES = parseCsvWithHeader(MIRACLE_CSV).map((r) => ({
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
// Priest rank grants exactly one learnable-miracle slot. Every miracle is
// visible once 1+ ranks are in Priest, regardless of current Focus, but only
// as many can be *known* at once as Priest ranks allow.
function hasMiracleAccess(character) {
  return (character.classDots.Priest || 0) >= 1;
}

// Same bonus mechanic as getSpellSlotCountForRank above, but for the
// "Blessing of Miracles" special and Priest dots.
function getMiracleSlotCountForRank(character, rank) {
  const blessing = SPECIALS.find((s) => s.name === 'Blessing of Miracles');
  if (blessing && isSpecialOwned(character, blessing)) {
    const baseRank = character.extraMiracleBaseRank || 0;
    return rank + Math.max(0, rank - baseRank);
  }
  return rank;
}

function getMiracleSlotCount(character) {
  return getMiracleSlotCountForRank(character, character.classDots.Priest || 0);
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

const EQUIPMENT_CSV = `"Item","Type","Description","weight(lbs)","cost(GT)"
"Dagger","weapons","Short blade for close work and throwing.","1","2"
"Knife","weapons","Camp and kitchen knife, poor as a weapon.","0.5","0.5"
"Shortsword","weapons","One-handed blade for tight halls.","3","8"
"Sword Arming","weapons","Standard one-handed knight's sword.","4","15"
"Sword Long","weapons","Hand-and-a-half blade.","5","25"
"Sword Great","weapons","Two-handed cutting sword.","8","40"
"Hand axe","weapons","One-handed axe; also splits kindling.","3","5"
"Battleaxe","weapons","Heavy one- or two-handed war axe.","6","12"
"Greataxe","weapons","Two-handed executioner's axe.","10","25"
"Mace","weapons","Flanged crushing head.","5","8"
"WarHammer","weapons","Pick and face for mail and plate.","5","12"
"Maul","weapons","Two-handed hammer.","12","15"
"Spear Short","weapons","Thrusting shaft, 6–7 feet.","6","4"
"Pike","weapons","Long formation spear, awkward indoors.","12","8"
"Halberd","weapons","Axe-blade, hook, and point on a pole.","12","15"
"Quarterstaff","weapons","Hardwood staff.","4","0.2"
"Club","weapons","Simple bludgeon.","3","0.1"
"Morning Star","weapons","Spiked striking head.","6","12"
"Flail","weapons","Hinged striking head; ignores some shields in close.","6","10"
"Rapier","weapons","Thrusting civilian blade.","2","20"
"Scimitar","weapons","Curved slashing blade.","3","18"
"Hand crossbow","weapons","One-handed light crossbow.","3","30"
"Light Crossbow","weapons","Standard spanned bow.","6","20"
"Heavy Crossbow","weapons","Slow, hard-hitting spanned bow.","12","40"
"Short Bow","weapons","Hunting bow.","2","12"
"Longbow","weapons","War bow; needs room to draw.","3","30"
"Sling","weapons","Leather pouch and cords.","0.2","0.1"
"Javelin thrown","weapons","Light throwing spear.","2","1"
"Axe Thrown","weapons","Balanced hatchet.","2","3"
"Arrows (20)","weapons","Sheaf for bows.","2","1"
"Quarrels (20)","weapons","Bolts for crossbows.","2","1.5"
"Sling bullets (20)","weapons","Lead or baked clay.","2","0.2"
"Blowgun","weapons","Tube and darts sold separate.","1","4"
"Darts (20)","weapons","Blowgun or throwing darts.","1","1"
"Whip","weapons","Long lash.","2","2"
"Man-catcher","weapons","Forked capture pole.","8","12"
"Fighting Net","weapons","Entangling net.","6","5"
"Caltrops (bag)","weapons","Enough to cover 5 feet.","2","1"
"BrassKnuckles","weapons","Metal knuckledusters worn over the fist.","0.5","2"
"Cudgel","weapons","Stout wooden club, quick and dirty.","2","0.5"
"Sword Stabbing","weapons","Narrow blade built for the thrust.","2","15"
"Sword Willow-leaf","weapons","Elven sword with a tapered leaf-shaped blade.","3","22"
"Sword Broad","weapons","Wide double-edged blade for heavy cuts.","5","22"
"Sword Foil","weapons","Light thrusting blade for quick, precise strikes.","2","18"
"Sword Sabre","weapons","Curved cavalry blade, quick in the cut.","3","20"
"Sword Katana","weapons","Curved single-edged blade, prized for its keen edge.","3","35"
"Hammer","weapons","One-handed dwarven war hammer.","4","10"
"SpikeHammer","weapons","Hammer fitted with a piercing spike.","5","14"
"Nordic/Norman Axe","weapons","One-handed axe favored by northern raiders.","4","12"
"WarAxe","weapons","Heavy two-handed dwarven battle axe.","8","20"
"Lance","weapons","Long cavalry lance for mounted combat.","10","18"
"Lance(charge)","weapons","Long cavalry lance, deadliest at a charge.","10","20"
"Sling Staff","weapons","Staff-sling for hurling stones with greater force.","3","8"
"Composite Bow","weapons","Layered bow with extra draw power.","2","40"
"Dagger Thrown","weapons","Balanced dagger meant for throwing.","1","2"
"Club Thrown","weapons","Weighted club balanced for throwing.","2","2"
"Rock Thrown","weapons","Fist-sized stone, good for throwing.","1","0.05"
"Padded jack","armor","Quilted cloth armor.","8","5"
"Leather jerkin","armor","Boiled or layered leather.","10","10"
"Studded leather","armor","Leather with metal rivets.","15","25"
"Hide armor","armor","Thick hides and pelts.","20","12"
"Mail shirt","armor","Torso mail.","25","60"
"Mail hauberk","armor","Mail to the knee, with sleeves.","40","100"
"Scale shirt","armor","Overlapping metal scales.","30","80"
"Breastplate","armor","Solid chest and back.","20","200"
"Half plate","armor","Breast, greaves, and vambraces.","40","350"
"Full plate","armor","Complete articulated harness.","55","750"
"Helmet, cap","armor","Simple steel cap.","3","8"
"Helmet, open","armor","Nasal or kettle helm.","5","15"
"Helmet, closed","armor","Visored helm.","8","40"
"Shield, buckler","armor","Small fist shield.","3","5"
"Shield, round","armor","Common wooden shield with boss.","6","8"
"Shield, kite","armor","Tall cavalry or foot shield.","10","12"
"Shield, tower","armor","Full-height pavise.","18","20"
"Barding, leather","armor","Horse leather armor.","40","40"
"Barding, mail","armor","Horse mail.","70","200"
"Barding, plate","armor","Horse plate.","90","500"
"Backpack","general","Leather pack, about 40 lb capacity.","2","2"
"Sack","general","Burlap or canvas bag.","0.5","0.1"
"Belt pouch","general","Small pouch for coin and flint.","0.2","0.3"
"Waterskin (1 gal)","general","Filled skin; weight is full.","8","1"
"Wineskin (1 gal)","general","As waterskin, for drink.","8","1"
"Flask, metal","general","Pint flask.","1","2"
"Vial, glass","general","Small stopper vial.","0.1","1"
"Crowbar","general","Iron bar for prying.","5","2"
"Hammer","general","Camp and nail hammer.","2","1"
"Sledge","general","Heavy driving hammer.","10","3"
"Pick, miner's","general","Breaking stone and packed earth.","8","4"
"Shovel","general","Digging spade.","6","2"
"Hand saw","general","Wood saw.","2","2"
"Woodcutter's axe","general","Felling axe, not balanced for war.","6","3"
"Block and tackle","general","Rope pulley for heavy lifts.","5","8"
"Chain (10 ft)","general","Iron links.","10","8"
"Rope, hemp (50 ft)","general","Common rope.","10","1"
"Rope, silk (50 ft)","general","Lighter, stronger line.","5","10"
"Grappling hook","general","Three-prong hook.","4","2"
"Pitons (10)","general","Iron spikes for climbing.","5","2"
"Manacles","general","Wrist irons and short chain.","2","8"
"Lock, simple","general","Cheap padlock.","0.5","8"
"Lock, good","general","Better wards.","1","20"
"Lock, fine","general","Hard to pick.","1","50"
"Thieves' tools","general","Picks, shims, small saw, files.","1","25"
"Artisan tools (set)","general","One trade: smith, carpenter, tailor, etc.","8","20"
"Healer's kit","general","Bandages, needle, salves for 10 uses.","3","8"
"Herbalism pouch","general","Pouches and small knife for gathering.","2","5"
"Alchemist's kit","general","Vials, burner, glassware.","8","40"
"Writing kit","general","Ink, quills, wax, small knife.","2","8"
"Parchment (sheet)","general","One sheet.","0.05","0.2"
"Book, blank","general","Bound empty book.","3","20"
"Book, printed or copied","general","Common treatise.","3","30"
"Lantern, hooded","general","Shuttered oil lantern.","2","8"
"Lantern, bullseye","general","Directed beam.","3","12"
"Torch","general","Resin torch, about 1 hour.","1","0.05"
"Lamp, clay","general","Simple oil lamp.","1","0.3"
"Oil flask","general","1 pint lamp oil, about 6 hours.","1","0.1"
"Candles (10)","general","Tallow candles.","1","0.1"
"Tinderbox","general","Flint, steel, and tinder.","0.5","0.5"
"Bedroll","general","Blanket and ground cloth.","5","1"
"Blanket, winter","general","Heavy wool.","4","2"
"Tent, one-man","general","Oilcloth shelter.","10","8"
"Tent, four-man","general","Larger camp tent.","30","25"
"Mess kit","general","Cup, plate, and spoon.","1","0.8"
"Cookpot","general","Iron pot.","8","3"
"Rations, poor (1 day)","general","Hard bread and dried beans.","1","0.1"
"Rations, trail (1 day)","general","Dried meat, hardtack, dried fruit.","2","0.5"
"Rations, fine (1 day)","general","Cheese, sausage, decent bread.","2","1.5"
"Feed, horse (1 day)","general","Grain and hay portion.","10","0.1"
"Ale, pint","general","Common tap ale.","1","0.05"
"Wine, cheap bottle","general","Rough table wine.","2","0.2"
"Wine, good bottle","general","Decent vintage.","2","2"
"Spirits, flask","general","Strong drink.","1","1"
"Lodging, common (night)","general","Shared room or pallet.","0","0.3"
"Lodging, private (night)","general","Own room at an inn.","0","1"
"Lodging, fine (night)","general","Good inn, bath and meal.","0","5"
"Meal, poor","general","Stew and bread.","0","0.05"
"Meal, common","general","Meat, bread, ale.","0","0.2"
"Meal, fine","general","Roast and wine.","0","1"
"Clothes, poor","general","Worn shirt, hose, wrap.","3","0.5"
"Clothes, common","general","Shirt, breeches, cloak, shoes.","4","2"
"Clothes, travel","general","Boots, cloak, sturdy coat.","6","5"
"Clothes, fine","general","Dyed cloth and trim.","4","20"
"Clothes, noble court","general","Silk or velvet display.","5","80"
"Cloak, wool","general","Weather cloak.","3","2"
"Cloak, winter","general","Fur-lined.","6","8"
"Boots, common","general","Leather boots.","2","2"
"Boots, riding","general","Tall boots.","3","5"
"Gloves","general","Work or riding gloves.","0.3","1"
"Belt","general","Leather belt.","0.3","0.3"
"Holy symbol, wood","general","Carved token.","0.2","1"
"Holy symbol, silver","general","Worked silver.","0.3","15"
"Spell component pouch","general","Small pouches and vials.","2","5"
"Focus, wooden wand","general","Simple magical focus.","0.5","8"
"Focus, crystal","general","Cut crystal focus.","0.5","40"
"Mirror, steel","general","Polished plate.","0.5","5"
"Mirror, silvered","general","True glass mirror.","1","20"
"Spyglass","general","Short brass scope.","1","80"
"Hourglass","general","Minute or hour glass.","1","15"
"Scale, merchant","general","Balance and weights.","3","8"
"Abacus","general","Counting frame.","2","2"
"Musical instrument, common","general","Flute, drum, or cheap lute.","2","8"
"Musical instrument, fine","general","Well-made lute or harp.","5","40"
"Signal whistle","general","Piercing whistle.","0.1","0.2"
"Hunting horn","general","Carrying horn.","2","5"
"Fishing tackle","general","Line, hooks, corks.","2","1"
"Net, fishing","general","Weighted net.","8","3"
"Soap","general","Bar of soap.","0.5","0.1"
"Perfume, vial","general","Scented oil.","0.2","5"
"Sealing wax","general","Stick of wax.","0.2","0.5"
"Signet ring","general","Personal seal.","0.1","5"
"Map, local","general","County or city map.","0.1","8"
"Map, regional","general","Realm map, uneven quality.","0.1","20"
"Compass","general","Magnetic needle.","0.3","25"
"Saddle, riding","general","Common riding saddle.","20","15"
"Saddle, war","general","High-cantle war saddle.","30","40"
"Saddlebags","general","Pair of bags.","8","4"
"Bit and bridle","general","Horse tack.","2","2"
"Donkey","general","Pack beast.","0","12"
"Mule","general","Sturdy pack and riding beast.","0","20"
"Riding horse","general","Common hack.","0","75"
"Draft horse","general","Wagon horse.","0","50"
"Warhorse","general","Trained destrier.","0","400"
"Pony","general","Small mount.","0","30"
"Cart","general","Two-wheel cart.","200","15"
"Wagon","general","Four-wheel wagon.","400","40"
"Carriage","general","Passenger coach.","600","200"
"Rowboat","general","Small boat.","120","50"
"Keelboat","general","River boat.","0","750"
"Sailing ship, small","general","Coast trader.","0","3000"
"Chest, wooden","general","Lockable chest.","25","5"
"Chest, iron-bound","general","Strong chest.","50","20"
"Barrel","general","Cask, empty.","30","2"
"Crate","general","Nail-built box.","15","1"
"Ladder (10 ft)","general","Wooden ladder.","20","1"
"Pole (10 ft)","general","Ash pole.","8","0.1"
"Ink (vial)","general","Black ink.","0.1","8"
"Chalk (10)","general","Marking sticks.","0.2","0.1"
"Paint, pot","general","Small pigment pot.","1","2"
"Spy-glass case","general","Leather tube.","0.5","2"
"Tent stake set","general","Wood or iron stakes.","3","0.3"
"Whetstone","general","Sharpening stone.","1","0.2"
"Needle and thread","general","Repair kit.","0.1","0.2"
"Winter blanket roll","general","Bedroll plus extra wool.","9","3"
"Rain cloak, oiled","general","Waxed canvas cloak.","4","4"
"Snowshoes","general","Pair.","4","5"
"Skis","general","Pair and pole.","12","8"
"Torch, storm","general","Pitch torch that takes weather better.","1.5","0.2"
"Holy water (flask)","general","Blessed water.","1","15"
"Acid (vial)","general","Strong acid.","1","10"
"Antitoxin (vial)","general","Mundane anti-venom.","0.2","20"
"Healing draught","general","Common stimulant tonic, not a miracle.","0.3","15"
"Poison, simple (vial)","general","Restricted in most towns.","0.2","50"
"Banner","general","House or company cloth.","3","8"
"Tent, pavilion","general","Lord's camp tent.","80","120"
"Portable altar","general","Small traveling shrine.","8","25"
"Scabbard","general","Fitted sheath.","1","2"
"Weapon oil","general","Protective oil.","0.3","0.5"
"Armor repair kit","general","Rings, leather, rivets.","4","8"`;

const EQUIPMENT = parseCsvWithHeader(EQUIPMENT_CSV).map((r) => ({
  name: r.Item,
  type: r.Type,
  description: r.Description,
  weight: parseFloat(r['weight(lbs)']) || 0,
  cost: parseFloat(r['cost(GT)']) || 0,
}));

// Category tabs, in first-appearance order (weapons, armor, general).
const EQUIPMENT_TYPES = [...new Set(EQUIPMENT.map((e) => e.type))];

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
  return EQUIPMENT
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
  return EQUIPMENT.reduce((sum, item) => sum + item.cost * getEquipmentQuantity(character, item), 0);
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


// Coinage (data/coinage.txt): 1 Golden Royal = 5 Gold Dragons = 50 Gold
// Talons; 1 Gold Talon = 1 Silver Fang = 10 Silver Chips = 100 Coppers.
// Equipment costs are listed in Gold Talons (GT), so every coin's value below
// is expressed relative to that.
const COINAGE = [
  { id: 'gr', name: 'Golden Royal', valueInGT: 50 },
  { id: 'gd', name: 'Gold Dragon', valueInGT: 10 },
  { id: 'gt', name: 'Gold Talon', valueInGT: 1 },
  { id: 'sf', name: 'Silver Fang', valueInGT: 1 },
  { id: 'sc', name: 'Silver Chip', valueInGT: 0.1 },
  { id: 'cp', name: 'Copper', valueInGT: 0.01 },
];

function getWealthInGT(character) {
  return COINAGE.reduce((sum, coin) => sum + (Number(character.coinage[coin.id]) || 0) * coin.valueInGT, 0);
}

// Wallet value in copper (the smallest unit — 1 cp = 1) so purchases can be
// deducted/refunded as whole coins without floating-point drift.
function getWalletCopper(character) {
  return COINAGE.reduce((sum, coin) => sum + (Number(character.coinage[coin.id]) || 0) * coin.valueInGT * 100, 0);
}

// Rebuilds the wallet from a total-copper value as a canonical largest-
// denomination-first breakdown, merging the Gold Talon/Silver Fang tie into
// Gold Talon — this is what actually "makes change" (breaking or combining
// coins) whenever a purchase or refund changes the wallet's total value.
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
// cost that exceeds total wealth just empties the wallet.
function spendFromCoinage(character, costGT) {
  setWalletFromCopper(character, getWalletCopper(character) - Math.round(costGT * 100));
}

// Adds valueGT worth of value back to the wallet (e.g. un-buying an item).
function refundToCoinage(character, valueGT) {
  setWalletFromCopper(character, getWalletCopper(character) + Math.round(valueGT * 100));
}

// Weapon skills and (non-Spell/Miracle) Skills spend from two SEPARATE
// per-class pools now, not one shared pool. A Mage/Priest "Spell: X" or
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
  return CLASSES.some((cls) => getClassWeaponPointsAvailable(character, cls) > 0
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

const COMBAT_CLASS_FOCUS_BONUS = {
  Fighter: 25,
  Priest: 20,
  Thief: 15,
  Mage: 10,
};

function getMeleeBaseAttack(c) {
  return roundUp(
    COMBAT_CLASS_FOCUS_BONUS[c.focus]
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

// Armored Defense: Base Defense (read-only) + a player-entered Armor Value.
function getArmoredDefenseTotal(character) {
  return roundUp(getBaseDefense(character) + (Number(character.armorValue) || 0));
}

// Casting: class_focus_bonus (per Focus, one table for Magic and one for
// Miracles) + the average of 4 effective attributes.
const CLASS_MAGIC_FOCUS_BONUS = { Fighter: 0, Thief: 5, Priest: 5, Mage: 15 };
const CLASS_MIRACLE_FOCUS_BONUS = { Fighter: 0, Thief: 0, Mage: 5, Priest: 15 };

function getMagicCasting(c) {
  return roundUp(CLASS_MAGIC_FOCUS_BONUS[c.focus] + getAverageEffectiveAttribute(c, ['Magic', 'Intellect', 'Willpower', 'Dexterity']));
}

function getMiracleCasting(c) {
  return roundUp(CLASS_MIRACLE_FOCUS_BONUS[c.focus] + getAverageEffectiveAttribute(c, ['Magic', 'Willpower', 'Intuition', 'Agility']));
}

const CASTING_STAT_GROUP = {
  stats: [
    {
      id: 'magicCasting',
      name: 'Magic Casting',
      formulaText: 'class_magic_focus_bonus + avg(Magic, Intellect, Willpower, Dexterity)',
      formula: getMagicCasting,
    },
    {
      id: 'miracleCasting',
      name: 'Miracle Casting',
      formulaText: 'class_miracle_focus_bonus + avg(Magic, Willpower, Intuition, Agility)',
      formula: getMiracleCasting,
    },
  ],
};

// ---------------------------------------------------------------------------
// Vitals (data/vitals.csv). Every field is Base + Magic + Misc = Total; Base
// is computed and read-only, Magic/Misc are free player-entered numbers.
// ---------------------------------------------------------------------------

const VITALS_FOCUS_MOD_PD = { Fighter: 1, Priest: 0.9, Thief: 0.8, Mage: 0.7 };
const VITALS_FOCUS_MOD_MD = { Fighter: 0.7, Priest: 0.9, Thief: 0.9, Mage: 1.1 };

// Total dots invested across all four classes, regardless of which one is
// currently the Focus. Only the *_mod tables above vary with Focus.
function getTotalClassDots(character) {
  return CLASSES.reduce((sum, cls) => sum + character.classDots[cls], 0);
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
      const focusMod = VITALS_FOCUS_MOD_PD[c.focus];
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
      const focusMod = VITALS_FOCUS_MOD_MD[c.focus];
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
    formulaText: '(Agility + Intellect + Intuition + Bravery) / 4 + (5 * Thief ranks) + (3 * Fighter ranks) + race_init_mod',
    formula: (c) => {
      const race = RACES[c.race];
      const sum = getEffectiveAttribute(c, 'Agility') + getEffectiveAttribute(c, 'Intellect')
        + getEffectiveAttribute(c, 'Intuition') + getEffectiveAttribute(c, 'Bravery');
      return roundUp((sum / 4) + (5 * c.classDots.Thief) + (3 * c.classDots.Fighter) + race.race_init_mod);
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
// a fixed number (not attribute-derived); Armor and Misc are free player-
// entered numbers, same Base + Armor + Misc = Total shape as the stats above.
const STAMINA_COST_ITEMS = [
  { id: 'combatFist', name: 'Combat Fist', base: 2 },
  { id: 'combat1Hand', name: 'Combat 1-hand', base: 4 },
  { id: 'combat2Hand', name: 'Combat 2-hand', base: 8 },
  { id: 'ranged', name: 'Ranged', base: 5 },
];

function getStaminaCostTotal(character, item) {
  const state = character.vitals.staminaCost[item.id];
  return roundUp(item.base + (Number(state.armor) || 0) + (Number(state.misc) || 0));
}

function rollAttribute() {
  const d10 = () => 1 + Math.floor(Math.random() * 10);
  return d10() + d10();
}

function createDefaultCharacter() {
  const attributes = {};
  ATTRIBUTES.forEach((attr) => { attributes[attr] = rollAttribute(); });

  const classDots = {};
  CLASSES.forEach((cls) => { classDots[cls] = 0; });

  const skillSpend = {};
  SKILLS.forEach((s) => { skillSpend[s.name] = {}; });

  const weaponSpend = { melee: {}, ranged: {} };
  MELEE_WEAPONS.forEach((w) => { weaponSpend.melee[w.name] = {}; });
  RANGED_WEAPONS.forEach((w) => { weaponSpend.ranged[w.name] = {}; });

  const specialSpend = {};
  SPECIALS.forEach((s) => { specialSpend[s.name] = {}; });

  const spellsLearned = {};
  SPELLS.forEach((s) => { spellsLearned[s.id] = false; });

  const miraclesLearned = {};
  MIRACLES.forEach((m) => { miraclesLearned[m.id] = false; });

  const staminaCost = {};
  STAMINA_COST_ITEMS.forEach((item) => { staminaCost[item.id] = { armor: 0, misc: 0 }; });

  const coinage = {};
  COINAGE.forEach((c) => { coinage[c.id] = 0; });

  return {
    name: '',
    focus: 'Fighter',
    race: 'Human',
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
    focusWeapons: rollFocusWeapons('Fighter', 'Human'),
    armorValue: 0,
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

window.VennRPG = {
  ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX,
  CLASSES, CLASS_DOTS_MIN, CLASS_DOTS_MAX, CLASS_DOTS_ROWS, CLASS_DOTS_PER_ROW,
  DEFY_KEY_ATTRIBUTES, getDefyPercent, getDefyValue,
  RACES, RACE_NAMES, getRaceAttributeMod, getEffectiveAttribute, getAverageEffectiveAttribute,
  MELEE_WEAPONS, RANGED_WEAPONS,
  WEAPON_RANKS_MIN, WEAPON_RANKS_MAX, WEAPON_RANKS_ROWS, WEAPON_RANKS_PER_ROW,
  FOCUS_WEAPON_COUNTS, getFocusWeaponCapacity, isWeaponFocusEligible,
  rollFocusWeapons, addFocusWeapon, removeFocusWeapon,
  isWeaponEligibleForClass, weaponMatchesCharacter, getWeaponRate, getWeaponAutoMinRank,
  getWeaponClassSpend, getWeaponSpentRank, getWeaponEffectiveRank, getWeaponTarget, toggleWeaponRankForClass,
  SKILLS, SKILL_RANKS_MIN, SKILL_RANKS_MAX, SKILL_RANKS_ROWS, SKILL_RANKS_PER_ROW,
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
  COMBAT_STAT_GROUP, getMeleeBaseAttack, getRangedBaseAttack, getBaseDefense, getArmoredDefenseTotal,
  CASTING_STAT_GROUP, getMagicCasting, getMiracleCasting, VITALS_STATS,
  STAMINA_COST_ITEMS, getStaminaCostTotal,
  EQUIPMENT, EQUIPMENT_TYPES, getEquipmentQuantity, getEquipmentOwnedEntries,
  isEquipmentEquipped, isEquipmentCarried, setEquipmentEquipped, setEquipmentCarried,
  getWornEquipmentEntries, getCarriedEquipmentWeightTotal,
  getWornWeapons,
  addEquipmentItem, removeEquipmentItem, getEquipmentSpentGT,
  COINAGE, getWealthInGT, spendFromCoinage, refundToCoinage,
  rollAttribute, createDefaultCharacter, clamp, roundUp,
};

})();
