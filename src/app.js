(function () {

const {
  ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX,
  CLASSES, CLASS_DOTS_MIN, CLASS_DOTS_MAX, CLASS_DOTS_ROWS, CLASS_DOTS_PER_ROW,
  getDefyPercent, getDefyValue, DEFY_KEY_ATTRIBUTES,
  RACE_NAMES, getRaceAttributeMod, getEffectiveAttribute,
  MELEE_WEAPONS, RANGED_WEAPONS,
  WEAPON_RANKS_MIN, WEAPON_RANKS_MAX, WEAPON_RANKS_ROWS, WEAPON_RANKS_PER_ROW,
  getFocusWeaponCapacity, isWeaponFocusEligible, rollFocusWeapons, addFocusWeapon, removeFocusWeapon,
  isWeaponEligibleForClass, weaponMatchesCharacter, getWeaponRate,
  getWeaponClassSpend, getWeaponSpentRank, getWeaponEffectiveRank, getWeaponTarget, toggleWeaponRankForClass,
  SKILLS, SKILL_RANKS_MIN, SKILL_RANKS_MAX, SKILL_RANKS_ROWS, SKILL_RANKS_PER_ROW,
  isSkillEligibleForClass, isSkillGeneral, isSkillForRace, pickSpendableClass,
  skillMatchesCharacter, getSkillRate, getSkillAutoMinRank,
  getSkillClassSpend, getSkillSpentRank, getSkillEffectiveRank, getSkillTarget, toggleSkillRankForClass,
  SPECIALS, isSpecialEligible, isSpecialOwned, toggleSpecialForClass,
  getSpecialTierCount, getSpecialsOwnedCount, canAcquireSpecial,
  SPELLS, SPELL_SCHOOLS, hasSpellAccess, isSpellLearned, toggleSpellLearned,
  getSpellSlotCount, getSpellSlotCountForRank, getSpellsLearnedCount, canLearnSpell,
  MIRACLES, MIRACLE_SCHOOLS, hasMiracleAccess, isMiracleLearned, toggleMiracleLearned,
  getMiracleSlotCount, getMiracleSlotCountForRank, getMiraclesLearnedCount, canLearnMiracle,
  getClassPointsUsed, getClassPointsAvailable, getClassPointsTotal, getClassRankMultiplier,
  COMBAT_STAT_GROUP, getBaseDefense, getArmoredDefenseTotal, CASTING_STAT_GROUP, VITALS_STATS,
  STAMINA_COST_ITEMS, getStaminaCostTotal,
  EQUIPMENT, EQUIPMENT_TYPES, getEquipmentQuantity, getEquipmentOwnedEntries,
  addEquipmentItem, removeEquipmentItem, getEquipmentSpentGT,
  COINAGE, getWealthInGT, getEquipmentRemainingGT,
  rollAttribute, createDefaultCharacter, clamp, roundUp,
} = window.VennRPG;

// Persisted to the browser (not a file) so a page reload restores the exact
// character in progress — including rolled attributes — instead of rolling
// a fresh one. Attributes only re-roll from an explicit action: the Roll All
// button, a single attribute's reroll die, or true first load (no saved
// character yet).
const STORAGE_KEY = 'vennrpg.character';

function loadStoredCharacter() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function saveCharacterToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
  } catch (err) {
    // Storage unavailable (private browsing, quota, etc.) — nothing to do.
  }
}

let character = createDefaultCharacter();
const storedCharacter = loadStoredCharacter();
if (storedCharacter) {
  character = normalizeLoadedCharacter(storedCharacter);
}
let activeSkillsTab = character.focus;
let activeWeaponsTab = character.focus;
let activeEquipmentTab = EQUIPMENT_TYPES[0];

const el = {
  charName: document.getElementById('charName'),
  raceSelect: document.getElementById('raceSelect'),
  focusSelect: document.getElementById('focusSelect'),
  rollAllBtn: document.getElementById('rollAllBtn'),
  attributesList: document.getElementById('attributesList'),
  combatStatsList: document.getElementById('combatStatsList'),
  classesList: document.getElementById('classesList'),
  vitalsHeight: document.getElementById('vitalsHeight'),
  vitalsWeight: document.getElementById('vitalsWeight'),
  vitalsList: document.getElementById('vitalsList'),
  weaponsBody: document.getElementById('weaponsBody'),
  weaponsCollapseToggle: document.getElementById('weaponsCollapseToggle'),
  buyWeaponsBtn: document.getElementById('buyWeaponsBtn'),
  ownedMeleeWeaponsBody: document.getElementById('ownedMeleeWeaponsBody'),
  ownedRangedWeaponsBody: document.getElementById('ownedRangedWeaponsBody'),
  weaponsModal: document.getElementById('weaponsModal'),
  weaponsModalClose: document.getElementById('weaponsModalClose'),
  weaponsTabs: document.getElementById('weaponsTabs'),
  weaponsSummary: document.getElementById('weaponsSummary'),
  weaponsFocusSummary: document.getElementById('weaponsFocusSummary'),
  meleeWeaponsBody: document.getElementById('meleeWeaponsBody'),
  rangedWeaponsBody: document.getElementById('rangedWeaponsBody'),
  skillsPanel: document.querySelector('.skills-panel'),
  skillsBody: document.getElementById('skillsBody'),
  skillsCollapseToggle: document.getElementById('skillsCollapseToggle'),
  skillsTabs: document.getElementById('skillsTabs'),
  skillsSummary: document.getElementById('skillsSummary'),
  skillsList: document.getElementById('skillsList'),
  specialsBody: document.getElementById('specialsBody'),
  specialsCollapseToggle: document.getElementById('specialsCollapseToggle'),
  buySpecialsBtn: document.getElementById('buySpecialsBtn'),
  specialsOwnedList: document.getElementById('specialsOwnedList'),
  specialsModal: document.getElementById('specialsModal'),
  specialsModalClose: document.getElementById('specialsModalClose'),
  specialsSummary: document.getElementById('specialsSummary'),
  specialsTierSummary: document.getElementById('specialsTierSummary'),
  specialsList: document.getElementById('specialsList'),
  spellsPanel: document.getElementById('spellsPanel'),
  spellsBody: document.getElementById('spellsBody'),
  spellsCollapseToggle: document.getElementById('spellsCollapseToggle'),
  spellsSummary: document.getElementById('spellsSummary'),
  spellsList: document.getElementById('spellsList'),
  miraclesPanel: document.getElementById('miraclesPanel'),
  miraclesBody: document.getElementById('miraclesBody'),
  miraclesCollapseToggle: document.getElementById('miraclesCollapseToggle'),
  miraclesSummary: document.getElementById('miraclesSummary'),
  miraclesList: document.getElementById('miraclesList'),
  newCharacterBtn: document.getElementById('newCharacterBtn'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  loadInput: document.getElementById('loadInput'),
  coinageList: document.getElementById('coinageList'),
  equipmentBody: document.getElementById('equipmentBody'),
  equipmentCollapseToggle: document.getElementById('equipmentCollapseToggle'),
  buyEquipmentBtn: document.getElementById('buyEquipmentBtn'),
  equipmentSummary: document.getElementById('equipmentSummary'),
  equipmentOwnedList: document.getElementById('equipmentOwnedList'),
  equipmentModal: document.getElementById('equipmentModal'),
  equipmentModalClose: document.getElementById('equipmentModalClose'),
  equipmentWealthSummary: document.getElementById('equipmentWealthSummary'),
  equipmentTabs: document.getElementById('equipmentTabs'),
  equipmentModalList: document.getElementById('equipmentModalList'),
};

function renderRaceOptions() {
  el.raceSelect.innerHTML = '';
  RACE_NAMES.forEach((race) => {
    const opt = document.createElement('option');
    opt.value = race;
    opt.textContent = race;
    el.raceSelect.appendChild(opt);
  });
  el.raceSelect.value = character.race;
}

function renderFocusOptions() {
  el.focusSelect.innerHTML = '';
  CLASSES.forEach((cls) => {
    const opt = document.createElement('option');
    opt.value = cls;
    opt.textContent = cls;
    el.focusSelect.appendChild(opt);
  });
  el.focusSelect.value = character.focus;
}

function renderAttributes() {
  el.attributesList.innerHTML = '';
  ATTRIBUTES.forEach((attr) => {
    const row = document.createElement('div');
    row.className = 'attribute-row';

    const label = document.createElement('span');
    label.className = 'attr-name';
    label.textContent = attr;

    const raceMod = getRaceAttributeMod(character.race, attr);
    const effectiveValue = getEffectiveAttribute(character, attr);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = ATTRIBUTE_MIN;
    input.max = ATTRIBUTE_MAX;
    input.value = effectiveValue;
    input.addEventListener('change', () => {
      const desiredEffective = clamp(parseInt(input.value, 10) || ATTRIBUTE_MIN, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
      character.attributes[attr] = desiredEffective - raceMod;
      renderAttributes();
      refreshDerived();
    });

    const rerollBtn = document.createElement('button');
    rerollBtn.type = 'button';
    rerollBtn.className = 'reroll-btn';
    rerollBtn.textContent = '🎲';
    rerollBtn.title = `Reroll ${attr} (2d10)`;
    rerollBtn.addEventListener('click', () => {
      character.attributes[attr] = rollAttribute();
      renderAttributes();
      refreshDerived();
    });

    const inputWrap = document.createElement('span');
    inputWrap.className = 'attr-input-wrap';
    inputWrap.appendChild(input);
    if (raceMod !== 0) {
      const modMark = document.createElement('span');
      modMark.className = 'attr-mod-mark';
      modMark.textContent = '*';
      modMark.title = `${raceMod > 0 ? '+' : ''}${raceMod} from ${character.race} race`;
      inputWrap.appendChild(modMark);
    }

    const defyPercent = getDefyPercent(character.focus, attr);
    const defy = document.createElement('span');
    defy.className = 'attr-defy';
    defy.textContent = `${getDefyValue(character.focus, attr, effectiveValue)}`;
    defy.title = `Defy = ${effectiveValue} * ${defyPercent}%`;

    row.appendChild(label);
    row.appendChild(inputWrap);
    row.appendChild(defy);
    row.appendChild(rerollBtn);
    el.attributesList.appendChild(row);
  });
}

function appendDerivedRow(container, stat) {
  const row = document.createElement('div');
  row.className = 'derived-row';

  const label = document.createElement('span');
  label.className = 'derived-name';
  label.textContent = stat.name;
  label.title = stat.formulaText;

  const value = document.createElement('span');
  value.className = 'derived-value';
  value.textContent = stat.formula(character);

  row.appendChild(label);
  row.appendChild(value);
  container.appendChild(row);
}

function renderCombatStats() {
  el.combatStatsList.innerHTML = '';
  COMBAT_STAT_GROUP.stats.forEach((stat) => appendDerivedRow(el.combatStatsList, stat));

  // Armored Defense: Base Defense (read-only) + editable Armor Value = Total.
  const armoredRow = document.createElement('div');
  armoredRow.className = 'derived-row armored-defense-row';
  armoredRow.title = 'Base Defense + Armor Value';

  const armoredLabel = document.createElement('span');
  armoredLabel.className = 'derived-name';
  armoredLabel.textContent = 'Armored Defense';

  const armoredCalc = document.createElement('span');
  armoredCalc.className = 'armored-defense-calc';

  const baseField = document.createElement('span');
  baseField.className = 'vitals-base';
  baseField.textContent = `${getBaseDefense(character)}`;

  const armorInput = document.createElement('input');
  armorInput.type = 'number';
  armorInput.className = 'vitals-input';
  armorInput.value = character.armorValue;
  armorInput.title = 'Armor Value';
  armorInput.addEventListener('change', () => {
    character.armorValue = parseInt(armorInput.value, 10) || 0;
    renderCombatStats();
  });

  const armoredTotal = document.createElement('span');
  armoredTotal.className = 'derived-value';
  armoredTotal.textContent = `${getArmoredDefenseTotal(character)}`;

  armoredCalc.appendChild(baseField);
  armoredCalc.appendChild(document.createTextNode('+'));
  armoredCalc.appendChild(armorInput);
  armoredCalc.appendChild(document.createTextNode('='));
  armoredCalc.appendChild(armoredTotal);

  armoredRow.appendChild(armoredLabel);
  armoredRow.appendChild(armoredCalc);
  el.combatStatsList.appendChild(armoredRow);

  const spacer = document.createElement('div');
  spacer.className = 'combat-stats-spacer';
  el.combatStatsList.appendChild(spacer);

  CASTING_STAT_GROUP.stats.forEach((stat) => appendDerivedRow(el.combatStatsList, stat));
}

// Trims float noise (e.g. 12.000000000000002 from repeated 0.1/0.01 coin
// additions) without padding whole numbers with trailing zeros.
function formatGT(n) {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Coinage is a simple player-managed wallet — free-entry amounts, not tied
// to any point economy — that funds Equipment purchases below.
function renderCoinage() {
  el.coinageList.innerHTML = '';

  const goldColumn = document.createElement('div');
  goldColumn.className = 'coinage-column';
  const otherColumn = document.createElement('div');
  otherColumn.className = 'coinage-column';

  COINAGE.forEach((coin) => {
    const row = document.createElement('div');
    row.className = 'coinage-row';

    const label = document.createElement('span');
    label.className = 'coinage-label';
    label.textContent = `${coin.name} (${coin.id})`;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'coinage-input';
    input.min = '0';
    input.value = character.coinage[coin.id];
    input.addEventListener('change', () => {
      character.coinage[coin.id] = Math.max(0, parseFloat(input.value) || 0);
      renderEquipmentPanel();
      if (el.equipmentModal.open) renderEquipmentModal();
    });

    row.appendChild(label);
    row.appendChild(input);
    (coin.name.startsWith('Gold') ? goldColumn : otherColumn).appendChild(row);
  });

  el.coinageList.appendChild(goldColumn);
  el.coinageList.appendChild(otherColumn);
}

// Main-page Equipment panel: just the "Buy Equipment" button plus whatever
// has actually been purchased — the shop itself lives in the popup below.
function renderEquipmentPanel() {
  const wealth = getWealthInGT(character);
  const spent = getEquipmentSpentGT(character);
  const remaining = wealth - spent;
  el.equipmentSummary.textContent = `Wealth: ${formatGT(wealth)} GT — Spent: ${formatGT(spent)} GT — Remaining: ${formatGT(remaining)} GT`;

  el.equipmentOwnedList.innerHTML = '';
  const entries = getEquipmentOwnedEntries(character);
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'equipment-empty';
    empty.textContent = 'No equipment purchased yet.';
    el.equipmentOwnedList.appendChild(empty);
    return;
  }
  entries.forEach(({ item, quantity }) => {
    const row = document.createElement('div');
    row.className = 'equipment-owned-row';

    const name = document.createElement('span');
    name.className = 'equipment-owned-name';
    name.textContent = item.name;

    const qty = document.createElement('span');
    qty.className = 'equipment-owned-qty';
    qty.textContent = `x${quantity}`;

    const cost = document.createElement('span');
    cost.className = 'equipment-owned-cost';
    cost.textContent = `${formatGT(item.cost * quantity)} GT`;

    row.appendChild(name);
    row.appendChild(qty);
    row.appendChild(cost);
    el.equipmentOwnedList.appendChild(row);
  });
}

// The purchase popup: tabs by fantasy_eq.csv category, a running wealth/
// spent/remaining total (spend draws from the same coinage as the main
// page), and a +/- stepper per item.
function renderEquipmentModal() {
  const wealth = getWealthInGT(character);
  const spent = getEquipmentSpentGT(character);
  const remaining = wealth - spent;
  el.equipmentWealthSummary.innerHTML = '';
  el.equipmentWealthSummary.appendChild(document.createTextNode(`Wealth: ${formatGT(wealth)} GT — Spent: ${formatGT(spent)} GT — Remaining: `));
  const remainingSpan = document.createElement('span');
  if (remaining < 0) remainingSpan.className = 'equipment-remaining-negative';
  remainingSpan.textContent = `${formatGT(remaining)} GT`;
  el.equipmentWealthSummary.appendChild(remainingSpan);

  el.equipmentTabs.innerHTML = '';
  EQUIPMENT_TYPES.forEach((type) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'skills-tab' + (type === activeEquipmentTab ? ' active' : '');
    tab.textContent = capitalize(type);
    tab.addEventListener('click', () => {
      activeEquipmentTab = type;
      renderEquipmentModal();
    });
    el.equipmentTabs.appendChild(tab);
  });

  el.equipmentModalList.innerHTML = '';
  EQUIPMENT.filter((item) => item.type === activeEquipmentTab).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'equipment-item-row';

    const textWrap = document.createElement('div');
    textWrap.className = 'equipment-item-text';

    const nameRow = document.createElement('div');
    nameRow.className = 'equipment-item-name-row';
    const name = document.createElement('span');
    name.className = 'equipment-item-name';
    name.textContent = item.name;
    const cost = document.createElement('span');
    cost.className = 'equipment-item-cost';
    cost.textContent = `${formatGT(item.cost)} GT`;
    const weight = document.createElement('span');
    weight.className = 'equipment-item-weight';
    weight.textContent = `${item.weight} lb`;
    nameRow.appendChild(name);
    nameRow.appendChild(cost);
    nameRow.appendChild(weight);
    textWrap.appendChild(nameRow);

    const description = document.createElement('div');
    description.className = 'equipment-item-description';
    description.textContent = item.description;
    textWrap.appendChild(description);

    const stepper = document.createElement('div');
    stepper.className = 'equipment-qty-stepper';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.textContent = '−';
    const quantity = getEquipmentQuantity(character, item);
    minusBtn.disabled = quantity <= 0;
    minusBtn.addEventListener('click', () => {
      removeEquipmentItem(character, item);
      renderEquipmentModal();
      renderEquipmentPanel();
    });

    const qtyValue = document.createElement('span');
    qtyValue.className = 'equipment-qty-value';
    qtyValue.textContent = String(quantity);

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      addEquipmentItem(character, item);
      renderEquipmentModal();
      renderEquipmentPanel();
    });

    stepper.appendChild(minusBtn);
    stepper.appendChild(qtyValue);
    stepper.appendChild(plusBtn);

    row.appendChild(textWrap);
    row.appendChild(stepper);
    el.equipmentModalList.appendChild(row);
  });
}

// Everything that depends on attributes/focus/race (but not class dots or
// spent points) needs to be recomputed together.
function refreshDerived() {
  renderCombatStats();
  renderSkills();
  renderWeapons();
  renderSpecials();
  renderVitals();
}

// Class dots and spent points feed each other (spending locks class dots,
// changing class dots changes available points), so all panels that touch
// the shared point pool are re-rendered together.
function refreshPointsPanels() {
  renderClasses();
  renderSkills();
  renderWeapons();
  renderSpecials();
  renderSpells();
  renderMiracles();
}

// Generic tab bar: `tabNames` are the buttons shown, `getActive`/`setActive`
// read and write whichever tab-state variable this bar controls, and
// `onSelect` re-renders whatever needs to reflect the new selection.
function renderTabBar(container, tabNames, getActive, setActive, onSelect) {
  container.innerHTML = '';
  tabNames.forEach((name) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'skills-tab' + (name === getActive() ? ' active' : '');
    tab.textContent = name;
    tab.addEventListener('click', () => {
      setActive(name);
      onSelect();
    });
    container.appendChild(tab);
  });
}

// Points summary line for a resolved spending class (which may differ from
// the displayed tab for General/Race, since those aren't a single class).
function renderPointsSummary(container, cls, note) {
  const used = getClassPointsUsed(character, cls);
  const total = getClassPointsTotal(character, cls);
  const available = getClassPointsAvailable(character, cls);
  const lead = note ? `${note} (spending ${cls} points)` : `${cls} points`;
  container.textContent = `${lead} — Available: ${available}   Used: ${used} / ${total}`;
}

// One rank dot: below the auto-granted floor it's always locked; above the
// current rank it locks once the active tab's class has no points left;
// within the filled range but funded by another class it locks too (only
// that class can refund its own spend).
function createRankDotButton(dotIndex, ctx) {
  const { effectiveRank, autoMin, otherSpend, available, autoTitle, noPointsTitle, otherClassTitle, buyTitle, onToggle } = ctx;
  const dotBtn = document.createElement('button');
  dotBtn.type = 'button';
  dotBtn.className = 'dot' + (effectiveRank >= dotIndex ? ' filled' : '');
  const autoLocked = dotIndex <= autoMin;
  const buyLocked = !autoLocked && (
    (dotIndex > effectiveRank && available <= 0)
    || (dotIndex <= effectiveRank && dotIndex <= autoMin + otherSpend)
  );
  dotBtn.disabled = autoLocked || buyLocked;
  dotBtn.title = autoLocked ? autoTitle
    : buyLocked ? (dotIndex > effectiveRank ? noPointsTitle : otherClassTitle)
    : buyTitle(dotIndex);
  dotBtn.addEventListener('click', () => onToggle(dotIndex));
  return dotBtn;
}

// Shared rank-dot grid (2 rows of 10) used for Skills (and, for ranks 2+,
// Weapon skills — rank 1 on a weapon has its own render path, see
// renderWeaponRankDots, since it can be a free Focus-drawn slot).
function renderRankDots(parent, opts) {
  const { rows, perRow, spentTotal, ownSpend } = opts;
  const otherSpend = spentTotal - ownSpend;
  for (let r = 0; r < rows; r += 1) {
    const grid = document.createElement('div');
    grid.className = 'dots-grid';
    for (let c = 0; c < perRow; c += 1) {
      const dotIndex = r * perRow + c + 1;
      grid.appendChild(createRankDotButton(dotIndex, { ...opts, otherSpend }));
    }
    parent.appendChild(grid);
  }
}

function renderSkillBox(container, skill, spendClass) {
  const box = document.createElement('div');
  box.className = 'skill-box';

  const header = document.createElement('div');
  header.className = 'skill-box-header';

  const nameWrap = document.createElement('span');
  nameWrap.className = 'skill-name-wrap';

  const name = document.createElement('span');
  name.className = 'skill-name';
  name.textContent = skill.name;
  name.title = skill.description;
  nameWrap.appendChild(name);

  if (skill.attribute.length > 0) {
    const attr = document.createElement('span');
    attr.className = 'item-attribute';
    attr.textContent = skill.attribute.join(' / ');
    nameWrap.appendChild(attr);
  }

  const target = document.createElement('span');
  target.className = 'skill-target';
  target.textContent = `${getSkillTarget(character, skill)}%`;
  target.title = skillMatchesCharacter(character, skill)
    ? `Attribute + (${getSkillRate(character, skill)}% * rank) — Focus/Race bonus applied`
    : `Attribute + (${getSkillRate(character, skill)}% * rank)`;

  header.appendChild(nameWrap);
  header.appendChild(target);
  box.appendChild(header);

  renderRankDots(box, {
    rows: SKILL_RANKS_ROWS,
    perRow: SKILL_RANKS_PER_ROW,
    effectiveRank: getSkillEffectiveRank(character, skill),
    autoMin: getSkillAutoMinRank(character, skill),
    spentTotal: getSkillSpentRank(character, skill),
    ownSpend: getSkillClassSpend(character, skill, spendClass),
    available: getClassPointsAvailable(character, spendClass),
    autoTitle: `Automatic (${character.race} race or ${character.focus} Focus bonus)`,
    noPointsTitle: `No ${spendClass} points available`,
    otherClassTitle: `Funded by another class — switch to that class's tab to refund`,
    buyTitle: (dotIndex) => `Set ${skill.name} to rank ${dotIndex} (spends a ${spendClass} point)`,
    onToggle: (dotIndex) => {
      toggleSkillRankForClass(character, skill, spendClass, dotIndex);
      refreshPointsPanels();
    },
  });

  container.appendChild(box);
}

const SKILLS_EXTRA_TABS = ['General', 'Race'];
const SKILLS_TAB_NAMES = CLASSES.concat(SKILLS_EXTRA_TABS);

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

function renderSkills() {
  renderTabBar(
    el.skillsTabs,
    SKILLS_TAB_NAMES,
    () => activeSkillsTab,
    (name) => { activeSkillsTab = name; },
    renderSkills
  );

  el.skillsList.innerHTML = '';
  el.skillsList.classList.remove('skills-list-vertical');

  if (CLASSES.includes(activeSkillsTab)) {
    renderPointsSummary(el.skillsSummary, activeSkillsTab);
    const eligible = SKILLS.filter((skill) => isSkillEligibleForClass(character, skill, activeSkillsTab)).sort(byName);
    eligible.forEach((skill) => renderSkillBox(el.skillsList, skill, activeSkillsTab));
    return;
  }

  const spendClass = pickSpendableClass(character);
  if (activeSkillsTab === 'General') {
    renderPointsSummary(el.skillsSummary, spendClass, 'General skills');
    SKILLS.filter(isSkillGeneral).sort(byName).forEach((skill) => renderSkillBox(el.skillsList, skill, spendClass));
    return;
  }

  // Race tab: a vertical list of skills tied to the character's current race.
  renderPointsSummary(el.skillsSummary, spendClass, `Race skills (${character.race})`);
  el.skillsList.classList.add('skills-list-vertical');
  SKILLS.filter((skill) => isSkillForRace(skill, character.race)).sort(byName).forEach((skill) => renderSkillBox(el.skillsList, skill, spendClass));
}

function formatWeaponMeta(weapon, category) {
  return category === 'ranged' ? `Range ${weapon.range}` : weapon.size;
}

// Rank 1 on a weapon is special: it's either one of the character's Focus
// starting-weapon slots (free, and user-swappable — click to remove it, or
// click an eligible unselected weapon's rank 1 to claim an open slot) or a
// normally-purchased rank like any other. Ranks 2+ always use the standard
// point-buy dot.
function renderWeaponRankDots(parent, weapon, category) {
  const isDrawn = character.focusWeapons[category].includes(weapon.name);
  const hasRoom = character.focusWeapons[category].length < getFocusWeaponCapacity(character.focus, category);
  const spentTotal = getWeaponSpentRank(character, category, weapon.name);
  const canClaimSlot = !isDrawn && hasRoom && spentTotal === 0 && isWeaponFocusEligible(weapon, character.focus);

  const autoMin = isDrawn ? 1 : 0;
  const effectiveRank = Math.max(spentTotal, autoMin);
  const ownSpend = getWeaponClassSpend(character, category, weapon.name, activeWeaponsTab);
  const ctx = {
    effectiveRank,
    autoMin,
    otherSpend: spentTotal - ownSpend,
    available: getClassPointsAvailable(character, activeWeaponsTab),
    noPointsTitle: `No ${activeWeaponsTab} points available`,
    otherClassTitle: `Funded by another class — switch to that class's tab to refund`,
    buyTitle: (dotIndex) => `Set ${weapon.name} to rank ${dotIndex} (spends a ${activeWeaponsTab} point)`,
    onToggle: (dotIndex) => {
      toggleWeaponRankForClass(character, category, weapon.name, activeWeaponsTab, dotIndex);
      refreshPointsPanels();
    },
  };

  for (let r = 0; r < WEAPON_RANKS_ROWS; r += 1) {
    const grid = document.createElement('div');
    grid.className = 'dots-grid';
    for (let c = 0; c < WEAPON_RANKS_PER_ROW; c += 1) {
      const dotIndex = r * WEAPON_RANKS_PER_ROW + c + 1;
      let dotBtn;
      if (dotIndex === 1 && isDrawn) {
        dotBtn = document.createElement('button');
        dotBtn.type = 'button';
        dotBtn.className = 'dot filled';
        dotBtn.title = `One of your ${character.focus} starting weapons — click to remove`;
        dotBtn.addEventListener('click', () => {
          removeFocusWeapon(character, category, weapon.name);
          refreshPointsPanels();
        });
      } else if (dotIndex === 1 && canClaimSlot) {
        dotBtn = document.createElement('button');
        dotBtn.type = 'button';
        dotBtn.className = 'dot';
        dotBtn.title = `Make ${weapon.name} one of your ${character.focus} starting weapons`;
        dotBtn.addEventListener('click', () => {
          addFocusWeapon(character, category, weapon.name);
          refreshPointsPanels();
        });
      } else {
        dotBtn = createRankDotButton(dotIndex, ctx);
      }
      grid.appendChild(dotBtn);
    }
    parent.appendChild(grid);
  }
}

// Read-only version of renderWeaponRankDots for the main-page owned-weapons
// table — just shows filled dots up to the current rank, nothing clickable
// (all buying happens in the Buy Weapon Skills popup).
function renderWeaponRankDotsReadOnly(parent, weapon, category) {
  const effectiveRank = getWeaponEffectiveRank(character, category, weapon.name);
  for (let r = 0; r < WEAPON_RANKS_ROWS; r += 1) {
    const grid = document.createElement('div');
    grid.className = 'dots-grid';
    for (let c = 0; c < WEAPON_RANKS_PER_ROW; c += 1) {
      const dotIndex = r * WEAPON_RANKS_PER_ROW + c + 1;
      const dot = document.createElement('span');
      dot.className = 'dot dot-static' + (dotIndex <= effectiveRank ? ' filled' : '');
      grid.appendChild(dot);
    }
    parent.appendChild(grid);
  }
}

function buildWeaponRow(weapon, category, interactive) {
  const row = document.createElement('tr');

  const nameCell = document.createElement('td');
  nameCell.className = 'weapon-name-cell';
  const nameLabel = document.createElement('div');
  nameLabel.className = 'weapon-name';
  nameLabel.title = formatWeaponMeta(weapon, category);
  const nameText = document.createElement('span');
  nameText.textContent = weapon.name;
  nameLabel.appendChild(nameText);
  if (weapon.attribute.length > 0) {
    const attr = document.createElement('span');
    attr.className = 'item-attribute';
    attr.textContent = weapon.attribute.join(' / ');
    nameLabel.appendChild(attr);
  }
  nameCell.appendChild(nameLabel);

  if (interactive) renderWeaponRankDots(nameCell, weapon, category);
  else renderWeaponRankDotsReadOnly(nameCell, weapon, category);

  const rofCell = document.createElement('td');
  rofCell.textContent = weapon.rof;

  const targetCell = document.createElement('td');
  targetCell.className = 'weapon-target';
  targetCell.textContent = getWeaponTarget(character, category, weapon.name);
  targetCell.title = weaponMatchesCharacter(character, category, weapon.name)
    ? `Base Attack + (${getWeaponRate(character, category, weapon.name)} * rank) — Focus starting weapon`
    : `Base Attack + (${getWeaponRate(character, category, weapon.name)} * rank)`;

  const bCell = document.createElement('td');
  bCell.textContent = weapon.blunt;
  const sCell = document.createElement('td');
  sCell.textContent = weapon.slash;
  const pCell = document.createElement('td');
  pCell.textContent = weapon.pierce;
  const eCell = document.createElement('td');
  eCell.textContent = weapon.energy;

  row.appendChild(nameCell);
  row.appendChild(rofCell);
  row.appendChild(targetCell);
  row.appendChild(bCell);
  row.appendChild(sCell);
  row.appendChild(pCell);
  row.appendChild(eCell);
  return row;
}

function renderWeaponsTable(tbody, weapons, category) {
  tbody.innerHTML = '';
  const eligible = weapons.filter((weapon) => isWeaponEligibleForClass(character, category, weapon.name, activeWeaponsTab)).sort(byName);
  eligible.forEach((weapon) => tbody.appendChild(buildWeaponRow(weapon, category, true)));
}

// Main-page Weapons panel: only weapons with at least 1 rank (purchased or a
// drawn Focus starting weapon) — the full shop lives in the popup above.
function renderOwnedWeaponsTable(tbody, weapons, category) {
  tbody.innerHTML = '';
  const owned = weapons.filter((weapon) => getWeaponEffectiveRank(character, category, weapon.name) >= 1).sort(byName);
  owned.forEach((weapon) => tbody.appendChild(buildWeaponRow(weapon, category, false)));
}

function renderOwnedWeapons() {
  renderOwnedWeaponsTable(el.ownedMeleeWeaponsBody, MELEE_WEAPONS, 'melee');
  renderOwnedWeaponsTable(el.ownedRangedWeaponsBody, RANGED_WEAPONS, 'ranged');
}

function renderWeapons() {
  renderTabBar(
    el.weaponsTabs,
    CLASSES,
    () => activeWeaponsTab,
    (name) => { activeWeaponsTab = name; },
    renderWeapons
  );
  renderPointsSummary(el.weaponsSummary, activeWeaponsTab);

  const meleeCapacity = getFocusWeaponCapacity(character.focus, 'melee');
  const rangedCapacity = getFocusWeaponCapacity(character.focus, 'ranged');
  el.weaponsFocusSummary.textContent = `${character.focus} starting weapons — `
    + `Melee: ${character.focusWeapons.melee.length}/${meleeCapacity} selected, `
    + `Ranged: ${character.focusWeapons.ranged.length}/${rangedCapacity} selected`;

  renderWeaponsTable(el.meleeWeaponsBody, MELEE_WEAPONS, 'melee');
  renderWeaponsTable(el.rangedWeaponsBody, RANGED_WEAPONS, 'ranged');
  renderOwnedWeapons();
}

// Specials require the character's current Focus or Race to be listed —
// there's no tab bar here, since access isn't browsable by class the way
// Skills/Weapons are: it's strictly "do you currently qualify or not."
function renderSpecials() {
  const spendClass = pickSpendableClass(character);
  renderPointsSummary(el.specialsSummary, spendClass, 'Specials');

  const tierCount = getSpecialTierCount(character);
  const ownedCount = getSpecialsOwnedCount(character);
  el.specialsTierSummary.textContent = `Special slots — Owned: ${ownedCount} / ${tierCount} `
    + `(unlocked at total class ranks 1, 3, 6, 9, 12, 15, 18...)`;

  el.specialsList.innerHTML = '';
  const eligible = SPECIALS.filter((special) => isSpecialEligible(character, special)).sort(byName);
  eligible.forEach((special) => {
    const box = document.createElement('div');
    box.className = 'special-box';

    const owned = isSpecialOwned(character, special);
    const available = getClassPointsAvailable(character, spendClass);
    const canAcquire = canAcquireSpecial(character);

    const dotBtn = document.createElement('button');
    dotBtn.type = 'button';
    dotBtn.className = 'dot special-dot' + (owned ? ' filled' : '');
    dotBtn.disabled = !owned && (available <= 0 || !canAcquire);
    dotBtn.title = owned
      ? `Give up ${special.name} (refunds a ${spendClass} point)`
      : !canAcquire
        ? `No special slots available (${ownedCount}/${tierCount} used — unlocks another at the next tier)`
        : available > 0
          ? `Acquire ${special.name} (spends a ${spendClass} point)`
          : `No ${spendClass} points available`;
    dotBtn.addEventListener('click', () => {
      toggleSpecialForClass(character, special, spendClass);
      refreshPointsPanels();
    });

    const textWrap = document.createElement('div');
    textWrap.className = 'special-text';
    const nameRow = document.createElement('div');
    nameRow.className = 'special-name-row';
    const name = document.createElement('span');
    name.className = 'special-name';
    name.textContent = special.name;
    nameRow.appendChild(name);
    if (special.staminaCost > 0) {
      const cost = document.createElement('span');
      cost.className = 'item-attribute';
      cost.textContent = `${special.staminaCost} stamina/use`;
      nameRow.appendChild(cost);
    }
    const description = document.createElement('div');
    description.className = 'special-description';
    description.textContent = special.description;
    textWrap.appendChild(nameRow);
    textWrap.appendChild(description);

    box.appendChild(dotBtn);
    box.appendChild(textWrap);
    el.specialsList.appendChild(box);
  });

  renderOwnedSpecials();
}

// Main-page Specials panel: only what's actually been acquired (read-only —
// all buying happens in the Buy Specials popup above). A special stays
// listed here even if a later Focus/Race change makes it ineligible to
// re-acquire, since it was already bought and paid for.
function renderOwnedSpecials() {
  el.specialsOwnedList.innerHTML = '';
  const owned = SPECIALS.filter((special) => isSpecialOwned(character, special)).sort(byName);
  if (owned.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'equipment-empty';
    empty.textContent = 'No specials acquired yet.';
    el.specialsOwnedList.appendChild(empty);
    return;
  }
  owned.forEach((special) => {
    const box = document.createElement('div');
    box.className = 'special-box';

    const dot = document.createElement('span');
    dot.className = 'dot special-dot dot-static filled';

    const textWrap = document.createElement('div');
    textWrap.className = 'special-text';
    const nameRow = document.createElement('div');
    nameRow.className = 'special-name-row';
    const name = document.createElement('span');
    name.className = 'special-name';
    name.textContent = special.name;
    nameRow.appendChild(name);
    if (special.staminaCost > 0) {
      const cost = document.createElement('span');
      cost.className = 'item-attribute';
      cost.textContent = `${special.staminaCost} stamina/use`;
      nameRow.appendChild(cost);
    }
    const description = document.createElement('div');
    description.className = 'special-description';
    description.textContent = special.description;
    textWrap.appendChild(nameRow);
    textWrap.appendChild(description);

    box.appendChild(dot);
    box.appendChild(textWrap);
    el.specialsOwnedList.appendChild(box);
  });
}

// Shared by Spells (Mage) and Miracles (Priest): a reference grimoire, not
// purchased from the shared point pool — each class rank instead grants one
// learnable-entry slot (see getSlotCount/getLearnedCount/canLearn). The
// whole panel hides until `hasAccess(character)` is true.
function renderGrimoire(opts) {
  const {
    panelEl, summaryEl, listEl, entries, schools, className,
    hasAccess, isLearned, toggleLearned, getSlotCount, getLearnedCount, canLearn, rerender,
  } = opts;

  panelEl.hidden = !hasAccess(character);
  summaryEl.textContent = '';
  listEl.innerHTML = '';
  if (panelEl.hidden) return;

  const slots = getSlotCount(character);
  const learnedCount = getLearnedCount(character);
  const bonusSpecialName = className === 'Spell' ? 'Extra Spell' : 'Blessing of Miracles';
  const rankLabel = className === 'Spell' ? 'Mage' : 'Priest';
  const bonusSpecial = SPECIALS.find((s) => s.name === bonusSpecialName);
  const hasBonus = bonusSpecial && isSpecialOwned(character, bonusSpecial);
  const slotsNote = hasBonus ? `1+ per ${rankLabel} rank, +1 more per rank after ${bonusSpecialName}` : `1 per ${rankLabel} rank`;
  summaryEl.textContent = `${className} slots — Known: ${learnedCount} / ${slots} (${slotsNote})`;

  schools.forEach((school) => {
    const title = document.createElement('h3');
    title.className = 'spell-school-title';
    title.textContent = school;
    listEl.appendChild(title);

    entries.filter((entry) => entry.school === school).sort(byName).forEach((entry) => {
      const box = document.createElement('div');
      box.className = 'spell-box';

      const learned = isLearned(character, entry);
      const canAcquire = canLearn(character);
      const dotBtn = document.createElement('button');
      dotBtn.type = 'button';
      dotBtn.className = 'dot spell-dot' + (learned ? ' filled' : '');
      dotBtn.disabled = !learned && !canAcquire;
      dotBtn.title = learned
        ? `Forget ${entry.name}`
        : canAcquire
          ? `Learn ${entry.name} (uses 1 of ${slots} ${className.toLowerCase()} slots)`
          : `No ${className.toLowerCase()} slots available (${learnedCount}/${slots} known)`;
      dotBtn.addEventListener('click', () => {
        toggleLearned(character, entry);
        rerender();
        renderClasses();
      });

      const textWrap = document.createElement('div');
      textWrap.className = 'spell-text';

      const nameRow = document.createElement('div');
      nameRow.className = 'spell-name-row';
      const name = document.createElement('span');
      name.className = 'spell-name';
      name.textContent = entry.name;
      const cost = document.createElement('span');
      cost.className = 'spell-cost';
      cost.textContent = entry.cost;
      nameRow.appendChild(name);
      nameRow.appendChild(cost);
      textWrap.appendChild(nameRow);

      const metaParts = [];
      if (entry.defy) metaParts.push(`Defy: ${entry.defy}`);
      if (entry.clock) metaParts.push(`Clock: ${entry.clock}`);
      if (entry.crutch) metaParts.push(`Crutch: ${entry.crutch}`);
      if (metaParts.length > 0) {
        const meta = document.createElement('div');
        meta.className = 'spell-meta';
        metaParts.forEach((part) => {
          const span = document.createElement('span');
          span.textContent = part;
          meta.appendChild(span);
        });
        textWrap.appendChild(meta);
      }

      const description = document.createElement('div');
      description.className = 'spell-description';
      description.textContent = entry.description;
      textWrap.appendChild(description);

      box.appendChild(dotBtn);
      box.appendChild(textWrap);
      listEl.appendChild(box);
    });
  });
}

function renderSpells() {
  renderGrimoire({
    panelEl: el.spellsPanel,
    summaryEl: el.spellsSummary,
    listEl: el.spellsList,
    entries: SPELLS,
    schools: SPELL_SCHOOLS,
    className: 'Spell',
    hasAccess: hasSpellAccess,
    isLearned: isSpellLearned,
    toggleLearned: toggleSpellLearned,
    getSlotCount: getSpellSlotCount,
    getLearnedCount: getSpellsLearnedCount,
    canLearn: canLearnSpell,
    rerender: renderSpells,
  });
}

function renderMiracles() {
  renderGrimoire({
    panelEl: el.miraclesPanel,
    summaryEl: el.miraclesSummary,
    listEl: el.miraclesList,
    entries: MIRACLES,
    schools: MIRACLE_SCHOOLS,
    className: 'Miracle',
    hasAccess: hasMiracleAccess,
    isLearned: isMiracleLearned,
    toggleLearned: toggleMiracleLearned,
    getSlotCount: getMiracleSlotCount,
    getLearnedCount: getMiraclesLearnedCount,
    canLearn: canLearnMiracle,
    rerender: renderMiracles,
  });
}

function buildVitalsRow(stat) {
  const state = character.vitals[stat.id];
  const base = stat.formula(character);
  const total = roundUp(base + (Number(state.magic) || 0) + (Number(state.misc) || 0));

  const row = document.createElement('div');
  row.className = 'vitals-row';
  row.title = stat.formulaText;

  const label = document.createElement('span');
  label.className = 'vitals-label';
  label.textContent = stat.name;

  const baseField = document.createElement('span');
  baseField.className = 'vitals-base';
  baseField.textContent = `Base ${base}`;

  const magicInput = document.createElement('input');
  magicInput.type = 'number';
  magicInput.className = 'vitals-input';
  magicInput.value = state.magic;
  magicInput.title = 'Magic';
  magicInput.addEventListener('change', () => {
    state.magic = parseInt(magicInput.value, 10) || 0;
    renderVitals();
  });

  const miscInput = document.createElement('input');
  miscInput.type = 'number';
  miscInput.className = 'vitals-input';
  miscInput.value = state.misc;
  miscInput.title = 'Misc.';
  miscInput.addEventListener('change', () => {
    state.misc = parseInt(miscInput.value, 10) || 0;
    renderVitals();
  });

  const totalField = document.createElement('span');
  totalField.className = 'vitals-total';
  totalField.textContent = `= ${total}`;

  row.appendChild(label);
  row.appendChild(baseField);
  row.appendChild(document.createTextNode('+'));
  row.appendChild(magicInput);
  row.appendChild(document.createTextNode('+'));
  row.appendChild(miscInput);
  row.appendChild(totalField);
  return row;
}

function buildStaminaCostRow(item) {
  const state = character.vitals.staminaCost[item.id];
  const total = getStaminaCostTotal(character, item);

  const row = document.createElement('div');
  row.className = 'vitals-row vitals-row-sub';

  const label = document.createElement('span');
  label.className = 'vitals-label';
  label.textContent = item.name;

  const baseField = document.createElement('span');
  baseField.className = 'vitals-base';
  baseField.textContent = `${item.base}`;

  const armorInput = document.createElement('input');
  armorInput.type = 'number';
  armorInput.className = 'vitals-input';
  armorInput.value = state.armor;
  armorInput.title = 'Armor';
  armorInput.addEventListener('change', () => {
    state.armor = parseInt(armorInput.value, 10) || 0;
    renderVitals();
  });

  const miscInput = document.createElement('input');
  miscInput.type = 'number';
  miscInput.className = 'vitals-input';
  miscInput.value = state.misc;
  miscInput.title = 'Misc.';
  miscInput.addEventListener('change', () => {
    state.misc = parseInt(miscInput.value, 10) || 0;
    renderVitals();
  });

  const totalField = document.createElement('span');
  totalField.className = 'vitals-total';
  totalField.textContent = `= ${total}`;

  row.appendChild(label);
  row.appendChild(baseField);
  row.appendChild(document.createTextNode('+'));
  row.appendChild(armorInput);
  row.appendChild(document.createTextNode('+'));
  row.appendChild(miscInput);
  row.appendChild(totalField);
  return row;
}

// Column 1: Physical Damage, Mental Damage, Movement, Initiative.
// Column 2: Stamina, then the Stamina Cost sub-list right under it. Two
// independent flex columns (not one grid) so Stamina Cost's extra height
// doesn't stretch column 1's row spacing.
function renderVitals() {
  el.vitalsHeight.value = character.vitals.height;
  el.vitalsWeight.value = character.vitals.weight;

  el.vitalsList.innerHTML = '';

  const col1 = document.createElement('div');
  col1.className = 'vitals-column';
  const col2 = document.createElement('div');
  col2.className = 'vitals-column';

  VITALS_STATS.forEach((stat) => {
    const column = stat.id === 'stamina' ? col2 : col1;
    column.appendChild(buildVitalsRow(stat));
  });

  const costHeader = document.createElement('div');
  costHeader.className = 'vitals-subheader';
  costHeader.textContent = 'Stamina Cost';
  col2.appendChild(costHeader);

  STAMINA_COST_ITEMS.forEach((item) => {
    col2.appendChild(buildStaminaCostRow(item));
  });

  el.vitalsList.appendChild(col1);
  el.vitalsList.appendChild(col2);
}

function orderedClasses() {
  const rest = CLASSES.filter((c) => c !== character.focus).sort((a, b) => a.localeCompare(b));
  return [character.focus, ...rest];
}

function renderClasses() {
  el.classesList.innerHTML = '';
  orderedClasses().forEach((cls) => {
    const box = document.createElement('div');
    box.className = 'class-box' + (cls === character.focus ? ' is-focus' : '');

    const header = document.createElement('div');
    header.className = 'class-box-header';

    const nameWrap = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'class-name';
    name.textContent = cls;
    nameWrap.appendChild(name);
    if (cls === character.focus) {
      const badge = document.createElement('span');
      badge.className = 'focus-badge';
      badge.textContent = 'Focus';
      badge.style.marginLeft = '8px';
      nameWrap.appendChild(badge);
    }

    const dotsValue = document.createElement('span');
    dotsValue.className = 'dots-value';
    dotsValue.textContent = `${character.classDots[cls]} / ${CLASS_DOTS_MAX}`;

    header.appendChild(nameWrap);
    header.appendChild(dotsValue);
    box.appendChild(header);

    const pointsUsed = getClassPointsUsed(character, cls);
    const rankMultiplier = getClassRankMultiplier(character);
    const minRanksForSpend = Math.ceil(pointsUsed / rankMultiplier);
    // Mage/Priest ranks each hold Spell/Miracle slots — normally 1:1, but
    // "Extra Spell"/"Blessing of Miracles" add bonus slots for ranks gained
    // after acquiring them, so slot count isn't linear with rank. Simulate
    // the slot count at the candidate target rank rather than a fixed floor.
    const grimoireLearnedCount = cls === 'Mage' ? getSpellsLearnedCount(character)
      : cls === 'Priest' ? getMiraclesLearnedCount(character)
      : 0;
    const getGrimoireSlotsForRank = cls === 'Mage' ? (r) => getSpellSlotCountForRank(character, r)
      : cls === 'Priest' ? (r) => getMiracleSlotCountForRank(character, r)
      : () => Infinity;
    for (let row = 0; row < CLASS_DOTS_ROWS; row += 1) {
      const grid = document.createElement('div');
      grid.className = 'dots-grid';
      for (let col = 0; col < CLASS_DOTS_PER_ROW; col += 1) {
        const dotIndex = row * CLASS_DOTS_PER_ROW + col + 1; // 1-based level this dot represents
        const dotBtn = document.createElement('button');
        dotBtn.type = 'button';
        const current = character.classDots[cls];
        dotBtn.className = 'dot' + (current >= dotIndex ? ' filled' : '');
        const isDecrement = dotIndex <= current;
        const targetValue = current === dotIndex ? dotIndex - 1 : dotIndex;
        const breaksSpend = isDecrement && targetValue < minRanksForSpend;
        const breaksGrimoire = isDecrement && getGrimoireSlotsForRank(targetValue) < grimoireLearnedCount;
        const locked = breaksSpend || breaksGrimoire;
        dotBtn.disabled = locked;
        dotBtn.title = locked
          ? (breaksSpend
            ? `Can't reduce ${cls} below ${minRanksForSpend} rank${minRanksForSpend === 1 ? '' : 's'} while ${pointsUsed} point${pointsUsed === 1 ? ' is' : 's are'} spent`
            : `Can't reduce ${cls} to ${targetValue} rank${targetValue === 1 ? '' : 's'} while ${grimoireLearnedCount} ${cls === 'Mage' ? 'spell' : 'miracle'}${grimoireLearnedCount === 1 ? ' is' : 's are'} known`)
          : `Set ${cls} to ${dotIndex}`;
        dotBtn.addEventListener('click', () => {
          character.classDots[cls] = clamp(targetValue, CLASS_DOTS_MIN, CLASS_DOTS_MAX);
          const grew = targetValue > current;
          if (grew) {
            activeSkillsTab = cls;
            activeWeaponsTab = cls;
          }
          refreshPointsPanels();
          if (grew) {
            const scrollTarget = cls === 'Mage' ? el.spellsPanel : cls === 'Priest' ? el.miraclesPanel : el.skillsPanel;
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
        grid.appendChild(dotBtn);
      }
      box.appendChild(grid);
    }

    const defyLine = document.createElement('div');
    defyLine.className = 'class-defy-line';
    defyLine.textContent = `Defy: ${(DEFY_KEY_ATTRIBUTES[cls] || []).join(', ')}`;
    box.appendChild(defyLine);

    el.classesList.appendChild(box);
  });
  renderVitals();
}

function renderAll() {
  el.charName.value = character.name;
  renderRaceOptions();
  renderFocusOptions();
  renderAttributes();
  renderClasses();
  renderCombatStats();
  renderCoinage();
  renderEquipmentPanel();
  renderSkills();
  renderWeapons();
  renderSpecials();
  renderSpells();
  renderMiracles();
  renderVitals();
}

function setupCollapsible(toggleBtn, bodyEl) {
  toggleBtn.addEventListener('click', () => {
    const collapsed = !bodyEl.hidden;
    bodyEl.hidden = collapsed;
    toggleBtn.classList.toggle('collapsed', collapsed);
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  });
}

setupCollapsible(el.weaponsCollapseToggle, el.weaponsBody);
setupCollapsible(el.skillsCollapseToggle, el.skillsBody);
setupCollapsible(el.specialsCollapseToggle, el.specialsBody);
setupCollapsible(el.spellsCollapseToggle, el.spellsBody);
setupCollapsible(el.miraclesCollapseToggle, el.miraclesBody);
setupCollapsible(el.equipmentCollapseToggle, el.equipmentBody);

el.buyEquipmentBtn.addEventListener('click', () => {
  renderEquipmentModal();
  el.equipmentModal.showModal();
});

el.equipmentModalClose.addEventListener('click', () => {
  el.equipmentModal.close();
});

el.buyWeaponsBtn.addEventListener('click', () => {
  renderWeapons();
  el.weaponsModal.showModal();
});

el.weaponsModalClose.addEventListener('click', () => {
  el.weaponsModal.close();
});

el.buySpecialsBtn.addEventListener('click', () => {
  renderSpecials();
  el.specialsModal.showModal();
});

el.specialsModalClose.addEventListener('click', () => {
  el.specialsModal.close();
});

el.charName.addEventListener('change', () => {
  character.name = el.charName.value;
});

el.raceSelect.addEventListener('change', () => {
  character.race = el.raceSelect.value;
  renderAttributes();
  refreshDerived();
});

el.focusSelect.addEventListener('change', () => {
  character.focus = el.focusSelect.value;
  character.focusWeapons = rollFocusWeapons(character.focus, character.race);
  renderAttributes();
  renderClasses();
  refreshDerived();
});

el.rollAllBtn.addEventListener('click', () => {
  ATTRIBUTES.forEach((attr) => { character.attributes[attr] = rollAttribute(); });
  renderAttributes();
  refreshDerived();
});

el.vitalsHeight.addEventListener('change', () => {
  character.vitals.height = el.vitalsHeight.value;
});

el.vitalsWeight.addEventListener('change', () => {
  character.vitals.weight = el.vitalsWeight.value;
});

el.newCharacterBtn.addEventListener('click', () => {
  if (!confirm('Start a new character? This discards all unsaved changes.')) return;
  character = createDefaultCharacter();
  activeSkillsTab = character.focus;
  activeWeaponsTab = character.focus;
  renderAll();
});

el.saveBtn.addEventListener('click', () => {
  const data = JSON.stringify(character, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (character.name || 'character').trim().replace(/[^a-z0-9-_]+/gi, '_');
  a.href = url;
  a.download = `${safeName || 'character'}.vennrpg.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

el.loadBtn.addEventListener('click', () => {
  el.loadInput.value = '';
  el.loadInput.click();
});

el.loadInput.addEventListener('change', () => {
  const file = el.loadInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loaded = JSON.parse(reader.result);
      character = normalizeLoadedCharacter(loaded);
      activeSkillsTab = character.focus;
      activeWeaponsTab = character.focus;
      renderAll();
    } catch (err) {
      alert('Could not load character file: ' + err.message);
    }
  };
  reader.readAsText(file);
});

function normalizeLedgerSpend(loadedLedger, itemKey, classDots, min, max) {
  const result = {};
  const loadedSpend = loadedLedger && loadedLedger[itemKey];
  CLASSES.forEach((cls) => {
    const v = loadedSpend && loadedSpend[cls];
    if (Number.isFinite(v)) {
      result[cls] = clamp(v, min, Math.min(max, classDots[cls]));
    }
  });
  return result;
}

function normalizeLoadedCharacter(loaded) {
  const base = createDefaultCharacter();
  const result = {
    name: typeof loaded.name === 'string' ? loaded.name : '',
    race: RACE_NAMES.includes(loaded.race) ? loaded.race : base.race,
    focus: CLASSES.includes(loaded.focus) ? loaded.focus : base.focus,
    attributes: { ...base.attributes },
    classDots: { ...base.classDots },
  };

  ATTRIBUTES.forEach((attr) => {
    const v = loaded.attributes && loaded.attributes[attr];
    if (Number.isFinite(v)) {
      result.attributes[attr] = clamp(v, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
    }
  });

  CLASSES.forEach((cls) => {
    const v = loaded.classDots && loaded.classDots[cls];
    if (Number.isFinite(v)) {
      result.classDots[cls] = clamp(v, CLASS_DOTS_MIN, CLASS_DOTS_MAX);
    }
  });

  result.skillSpend = {};
  SKILLS.forEach((s) => {
    result.skillSpend[s.name] = normalizeLedgerSpend(loaded.skillSpend, s.name, result.classDots, SKILL_RANKS_MIN, SKILL_RANKS_MAX);
  });

  result.specialSpend = {};
  SPECIALS.forEach((s) => {
    result.specialSpend[s.name] = normalizeLedgerSpend(loaded.specialSpend, s.name, result.classDots, 0, 1);
  });

  // Rank at which "Extra Spell"/"Blessing of Miracles" was acquired, needed
  // by getSpellSlotCount/getMiracleSlotCount below — must be set before
  // computing slot counts.
  result.extraSpellBaseRank = Number.isFinite(loaded.extraSpellBaseRank)
    ? clamp(loaded.extraSpellBaseRank, CLASS_DOTS_MIN, CLASS_DOTS_MAX) : 0;
  result.extraMiracleBaseRank = Number.isFinite(loaded.extraMiracleBaseRank)
    ? clamp(loaded.extraMiracleBaseRank, CLASS_DOTS_MIN, CLASS_DOTS_MAX) : 0;

  // Clamp to the current Mage/Priest slot count (same philosophy as
  // normalizeLedgerSpend above) in case ranks were reduced since this was
  // saved — slot count accounts for the "Extra Spell"/"Blessing of Miracles"
  // bonus, not just raw rank.
  result.spellsLearned = {};
  let spellSlotsLeft = getSpellSlotCount(result);
  SPELLS.forEach((s) => {
    const wasLearned = !!(loaded.spellsLearned && loaded.spellsLearned[s.id]);
    const keep = wasLearned && spellSlotsLeft > 0;
    if (keep) spellSlotsLeft -= 1;
    result.spellsLearned[s.id] = keep;
  });

  result.miraclesLearned = {};
  let miracleSlotsLeft = getMiracleSlotCount(result);
  MIRACLES.forEach((m) => {
    const wasLearned = !!(loaded.miraclesLearned && loaded.miraclesLearned[m.id]);
    const keep = wasLearned && miracleSlotsLeft > 0;
    if (keep) miracleSlotsLeft -= 1;
    result.miraclesLearned[m.id] = keep;
  });

  result.weaponSpend = { melee: {}, ranged: {} };
  MELEE_WEAPONS.forEach((w) => {
    result.weaponSpend.melee[w.name] = normalizeLedgerSpend(loaded.weaponSpend && loaded.weaponSpend.melee, w.name, result.classDots, WEAPON_RANKS_MIN, WEAPON_RANKS_MAX);
  });
  RANGED_WEAPONS.forEach((w) => {
    result.weaponSpend.ranged[w.name] = normalizeLedgerSpend(loaded.weaponSpend && loaded.weaponSpend.ranged, w.name, result.classDots, WEAPON_RANKS_MIN, WEAPON_RANKS_MAX);
  });

  const meleeNames = new Set(MELEE_WEAPONS.map((w) => w.name));
  const rangedNames = new Set(RANGED_WEAPONS.map((w) => w.name));
  const loadedFocusWeapons = loaded.focusWeapons;
  if (loadedFocusWeapons && Array.isArray(loadedFocusWeapons.melee) && Array.isArray(loadedFocusWeapons.ranged)) {
    const uniqueValid = (names, validSet, capacity) => [...new Set(names.filter((name) => validSet.has(name)))].slice(0, capacity);
    result.focusWeapons = {
      melee: uniqueValid(loadedFocusWeapons.melee, meleeNames, getFocusWeaponCapacity(result.focus, 'melee')),
      ranged: uniqueValid(loadedFocusWeapons.ranged, rangedNames, getFocusWeaponCapacity(result.focus, 'ranged')),
    };
  } else {
    result.focusWeapons = rollFocusWeapons(result.focus, result.race);
  }

  result.armorValue = Number.isFinite(loaded.armorValue) ? loaded.armorValue : base.armorValue;

  result.coinage = { ...base.coinage };
  COINAGE.forEach((coin) => {
    const v = loaded.coinage && loaded.coinage[coin.id];
    if (Number.isFinite(v)) result.coinage[coin.id] = Math.max(0, v);
  });

  result.equipmentOwned = {};
  const equipmentByName = new Map(EQUIPMENT.map((item) => [item.name, item]));
  if (loaded.equipmentOwned && typeof loaded.equipmentOwned === 'object') {
    Object.keys(loaded.equipmentOwned).forEach((name) => {
      const v = loaded.equipmentOwned[name];
      if (equipmentByName.has(name) && Number.isFinite(v) && v > 0) {
        result.equipmentOwned[name] = Math.floor(v);
      }
    });
  }

  result.vitals = { ...base.vitals };
  if (typeof (loaded.vitals && loaded.vitals.height) === 'string') result.vitals.height = loaded.vitals.height;
  if (typeof (loaded.vitals && loaded.vitals.weight) === 'string') result.vitals.weight = loaded.vitals.weight;
  VITALS_STATS.forEach((stat) => {
    const stored = loaded.vitals && loaded.vitals[stat.id];
    result.vitals[stat.id] = {
      magic: Number.isFinite(stored && stored.magic) ? stored.magic : 0,
      misc: Number.isFinite(stored && stored.misc) ? stored.misc : 0,
    };
  });

  result.vitals.staminaCost = {};
  STAMINA_COST_ITEMS.forEach((item) => {
    const stored = loaded.vitals && loaded.vitals.staminaCost && loaded.vitals.staminaCost[item.id];
    result.vitals.staminaCost[item.id] = {
      armor: Number.isFinite(stored && stored.armor) ? stored.armor : 0,
      misc: Number.isFinite(stored && stored.misc) ? stored.misc : 0,
    };
  });

  return result;
}

// Persist whenever the page is about to go away (reload, navigate, close),
// so the in-progress character — not a fresh roll — comes back next time.
window.addEventListener('pagehide', saveCharacterToStorage);
window.addEventListener('beforeunload', saveCharacterToStorage);

renderAll();

})();
