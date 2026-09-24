// Character data schema and game-rule definitions for the VennRPG character sheet.
// Plain classic script (no ES modules) so the sheet also works when opened
// directly via file:// without a local server. Everything is attached to the
// shared window.VennRPG namespace for src/app.js to consume.
(function () {

const ATTRIBUTES = [
  'Physique', 'Strength', 'Constitution', 'Agility', 'Dexterity', 'Intelligence',
  'Intuition', 'Magic', 'Bravery', 'Willpower', 'Charisma', 'Attraction',
];

const ATTRIBUTE_MIN = 2;
const ATTRIBUTE_MAX = 20;

const CLASSES = ['Fighter', 'Thief', 'Mage', 'Priest'];

const CLASS_DOTS_MIN = 0;
const CLASS_DOTS_MAX = 20;
const CLASS_DOTS_ROWS = 2;
const CLASS_DOTS_PER_ROW = 10;

// Defy = attribute value * a per-attribute rate: 4% for an attribute that's
// key to the character's Focus class, 2% for every other attribute.
const DEFY_HIGH_PERCENT = 4;
const DEFY_LOW_PERCENT = 2;
const DEFY_KEY_ATTRIBUTES = {
  Fighter: ['Physique', 'Strength', 'Constitution'],
  Thief: ['Agility', 'Dexterity', 'Charisma'],
  Mage: ['Magic', 'Intelligence', 'Intuition'],
  Priest: ['Willpower', 'Magic', 'Constitution'],
};

function getDefyPercent(focus, attribute) {
  const keyAttrs = DEFY_KEY_ATTRIBUTES[focus] || [];
  return keyAttrs.includes(attribute) ? DEFY_HIGH_PERCENT : DEFY_LOW_PERCENT;
}

function getDefyValue(focus, attribute, attributeValue) {
  const percent = getDefyPercent(focus, attribute);
  return attributeValue * percent;
}

// Each purchased class dot is assigned to either 'attack' or 'defend' (or
// left null/unassigned). classAssignments[cls] is an array whose length is
// kept in sync with classDots[cls]; index i's value is the assignment for
// that class's i-th dot.
function syncClassAssignments(character, cls) {
  const total = character.classDots[cls];
  const current = character.classAssignments[cls] || [];
  const next = [];
  for (let i = 0; i < total; i += 1) {
    next.push(current[i] || null);
  }
  character.classAssignments[cls] = next;
}

function getClassAssignedCount(character, cls) {
  return (character.classAssignments[cls] || []).filter((a) => a === 'attack' || a === 'defend').length;
}

function getClassAttackDots(character, cls) {
  return (character.classAssignments[cls] || []).filter((a) => a === 'attack').length;
}

function getClassDefendDots(character, cls) {
  return (character.classAssignments[cls] || []).filter((a) => a === 'defend').length;
}

// Derived stat groups: shown under Attributes, always computed live (no
// manual equipment/miscellaneous modifiers, unlike the Targets table below).
const DERIVED_STAT_GROUPS = [
  {
    title: 'Melee',
    stats: [
      {
        id: 'fightAttack',
        name: 'Attack',
        formulaText: '35 + (5 * Fighter attack dots) + (2 * Mage attack dots) + (3 * Thief attack dots) + (3 * Priest attack dots) + (2 * Strength)',
        formula: (c) => 35
          + (5 * getClassAttackDots(c, 'Fighter'))
          + (2 * getClassAttackDots(c, 'Mage'))
          + (3 * getClassAttackDots(c, 'Thief'))
          + (3 * getClassAttackDots(c, 'Priest'))
          + (2 * c.attributes.Strength),
      },
      {
        id: 'fightDefend',
        name: 'Defend',
        formulaText: '25 + (5 * Fighter defend dots) + (2 * Mage defend dots) + (3 * Thief defend dots) + (3 * Priest defend dots) + (2 * Agility)',
        formula: (c) => 25
          + (5 * getClassDefendDots(c, 'Fighter'))
          + (2 * getClassDefendDots(c, 'Mage'))
          + (3 * getClassDefendDots(c, 'Thief'))
          + (3 * getClassDefendDots(c, 'Priest'))
          + (2 * c.attributes.Agility),
      },
    ],
  },
  {
    title: 'Ranged',
    stats: [
      {
        id: 'rangedAttack',
        name: 'Attack',
        formulaText: '35 + (5 * Fighter attack dots) + (2 * Mage attack dots) + (3 * Thief attack dots) + (3 * Priest attack dots) + (2 * Agility)',
        formula: (c) => 35
          + (5 * getClassAttackDots(c, 'Fighter'))
          + (2 * getClassAttackDots(c, 'Mage'))
          + (3 * getClassAttackDots(c, 'Thief'))
          + (3 * getClassAttackDots(c, 'Priest'))
          + (2 * c.attributes.Agility),
      },
      {
        id: 'rangedDefend',
        name: 'Defend',
        formulaText: '25 + (5 * Fighter defend dots) + (2 * Mage defend dots) + (3 * Thief defend dots) + (3 * Priest defend dots) + (2 * Strength)',
        formula: (c) => 25
          + (5 * getClassDefendDots(c, 'Fighter'))
          + (2 * getClassDefendDots(c, 'Mage'))
          + (3 * getClassDefendDots(c, 'Thief'))
          + (3 * getClassDefendDots(c, 'Priest'))
          + (2 * c.attributes.Strength),
      },
    ],
  },
];

// Each target's total = formula(character) + equipment + miscellaneous.
// `formula` receives the live character object so it always reflects current
// attributes and class dots.
const TARGETS = [
  {
    id: 'fighterSpecial',
    class: 'Fighter',
    name: 'Fighter: Special',
    formulaText: '15 + (5 * Fighter dots) + (2 * Strength)',
    formula: (c) => 15 + (5 * c.classDots.Fighter) + (2 * c.attributes.Strength),
  },
  {
    id: 'fighterStrategy',
    class: 'Fighter',
    name: 'Fighter: Strategy',
    formulaText: '25 + (5 * Fighter dots) + (2 * Intelligence)',
    formula: (c) => 25 + (5 * c.classDots.Fighter) + (2 * c.attributes.Intelligence),
  },
  {
    id: 'fighterTactics',
    class: 'Fighter',
    name: 'Fighter: Tactics',
    formulaText: '35 + (5 * Fighter dots) + (2 * Intuition)',
    formula: (c) => 35 + (5 * c.classDots.Fighter) + (2 * c.attributes.Intuition),
  },
  {
    id: 'thiefStealth',
    class: 'Thief',
    name: 'Thief: Stealth',
    formulaText: '35 + (5 * Thief dots) + (2 * Agility)',
    formula: (c) => 35 + (5 * c.classDots.Thief) + (2 * c.attributes.Agility),
  },
  {
    id: 'thiefExploit',
    class: 'Thief',
    name: 'Thief: Exploit',
    formulaText: '25 + (5 * Thief dots) + (2 * Dexterity)',
    formula: (c) => 25 + (5 * c.classDots.Thief) + (2 * c.attributes.Dexterity),
  },
  {
    id: 'thiefSpecial',
    class: 'Thief',
    name: 'Thief: Special',
    formulaText: '15 + (5 * Thief dots) + (2 * Agility)',
    formula: (c) => 15 + (5 * c.classDots.Thief) + (2 * c.attributes.Agility),
  },
  {
    id: 'mageManifest',
    class: 'Mage',
    name: 'Mage: Manifest',
    formulaText: '35 + (5 * Mage dots) + (2 * Magic)',
    formula: (c) => 35 + (5 * c.classDots.Mage) + (2 * c.attributes.Magic),
  },
  {
    id: 'mageDestroy',
    class: 'Mage',
    name: 'Mage: Destroy',
    formulaText: '25 + (5 * Mage dots) + (2 * Intelligence)',
    formula: (c) => 25 + (5 * c.classDots.Mage) + (2 * c.attributes.Intelligence),
  },
  {
    id: 'mageSpecial',
    class: 'Mage',
    name: 'Mage: Special',
    formulaText: '15 + (5 * Mage dots) + (2 * Intelligence)',
    formula: (c) => 15 + (5 * c.classDots.Mage) + (2 * c.attributes.Intelligence),
  },
  {
    id: 'priestChannel',
    class: 'Priest',
    name: 'Priest: Channel',
    formulaText: '35 + (5 * Priest dots) + (2 * Willpower)',
    formula: (c) => 35 + (5 * c.classDots.Priest) + (2 * c.attributes.Willpower),
  },
  {
    id: 'priestSubtlety',
    class: 'Priest',
    name: 'Priest: Subtlety',
    formulaText: '25 + (5 * Priest dots) + (2 * Attraction)',
    formula: (c) => 25 + (5 * c.classDots.Priest) + (2 * c.attributes.Attraction),
  },
  {
    id: 'priestSpecial',
    class: 'Priest',
    name: 'Priest: Special',
    formulaText: '15 + (5 * Priest dots) + (2 * Willpower)',
    formula: (c) => 15 + (5 * c.classDots.Priest) + (2 * c.attributes.Willpower),
  },
];

function rollAttribute() {
  const d10 = () => 1 + Math.floor(Math.random() * 10);
  return d10() + d10();
}

function createDefaultCharacter() {
  const attributes = {};
  ATTRIBUTES.forEach((attr) => { attributes[attr] = rollAttribute(); });

  const classDots = {};
  const classAssignments = {};
  CLASSES.forEach((cls) => { classDots[cls] = 0; classAssignments[cls] = []; });

  const targets = {};
  TARGETS.forEach((t) => { targets[t.id] = { equipment: 0, miscellaneous: 0 }; });

  return {
    name: '',
    focus: 'Fighter',
    attributes,
    classDots,
    classAssignments,
    targets,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

window.VennRPG = {
  ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX,
  CLASSES, CLASS_DOTS_MIN, CLASS_DOTS_MAX, CLASS_DOTS_ROWS, CLASS_DOTS_PER_ROW,
  DEFY_KEY_ATTRIBUTES, getDefyPercent, getDefyValue,
  syncClassAssignments, getClassAssignedCount, getClassAttackDots, getClassDefendDots,
  DERIVED_STAT_GROUPS, TARGETS, rollAttribute, createDefaultCharacter, clamp,
};

})();
