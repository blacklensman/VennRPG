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
  isEquipmentEquipped, isEquipmentCarried, setEquipmentEquipped, setEquipmentCarried,
  getWornEquipmentEntries, getCarriedEquipmentWeightTotal,
  getWornWeapons,
  addEquipmentItem, removeEquipmentItem, getEquipmentSpentGT,
  COINAGE, getWealthInGT, spendFromCoinage, refundToCoinage,
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
  equippedBody: document.getElementById('equippedBody'),
  equippedCollapseToggle: document.getElementById('equippedCollapseToggle'),
  equippedWeightSummary: document.getElementById('equippedWeightSummary'),
  equippedMeleeWeaponsBody: document.getElementById('equippedMeleeWeaponsBody'),
  equippedRangedWeaponsBody: document.getElementById('equippedRangedWeaponsBody'),
  equippedArmorBody: document.getElementById('equippedArmorBody'),
  equippedGeneralBody: document.getElementById('equippedGeneralBody'),
  pdfBtn: document.getElementById('pdfBtn'),
  printSheet: document.getElementById('printSheet'),
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

function conditionLabel(equipped, carried) {
  if (equipped && carried) return 'Equipped, Carried';
  if (equipped) return 'Equipped';
  if (carried) return 'Carried';
  return '—';
}

function formatWeight(n) {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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
  const inventoryValue = getEquipmentSpentGT(character);
  el.equipmentSummary.textContent = `Wealth: ${formatGT(wealth)} GT — Inventory value: ${formatGT(inventoryValue)} GT`;

  el.equipmentOwnedList.innerHTML = '';
  const entries = getEquipmentOwnedEntries(character);
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'equipment-empty';
    empty.textContent = 'No equipment purchased yet.';
    el.equipmentOwnedList.appendChild(empty);
    return;
  }
  entries.forEach(({ item, quantity, equipped, carried }) => {
    const row = document.createElement('div');
    row.className = 'equipment-owned-row';

    const name = document.createElement('span');
    name.className = 'equipment-owned-name';
    name.textContent = item.name;

    const qty = document.createElement('span');
    qty.className = 'equipment-owned-qty';
    qty.textContent = `x${quantity}`;

    const condition = document.createElement('span');
    condition.className = 'equipment-owned-condition';
    condition.textContent = conditionLabel(equipped, carried);

    const cost = document.createElement('span');
    cost.className = 'equipment-owned-cost';
    cost.textContent = `${formatGT(item.cost * quantity)} GT`;

    row.appendChild(name);
    row.appendChild(qty);
    row.appendChild(condition);
    row.appendChild(cost);
    el.equipmentOwnedList.appendChild(row);
  });
}

// The purchase popup: tabs by fantasy_eq.csv category, a running wealth/
// running inventory value (spending/refunding actually deducts/adds coins
// on the main page's Coinage section), and a +/- stepper per item.
function renderEquipmentModal() {
  const wealth = getWealthInGT(character);
  const inventoryValue = getEquipmentSpentGT(character);
  el.equipmentWealthSummary.textContent = `Wealth: ${formatGT(wealth)} GT — Inventory value: ${formatGT(inventoryValue)} GT`;

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
      refundToCoinage(character, item.cost);
      renderCoinage();
      renderEquipmentModal();
      renderEquipmentPanel();
      renderEquippedPanel();
    });

    const qtyValue = document.createElement('span');
    qtyValue.className = 'equipment-qty-value';
    qtyValue.textContent = String(quantity);

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      addEquipmentItem(character, item);
      spendFromCoinage(character, item.cost);
      renderCoinage();
      renderEquipmentModal();
      renderEquipmentPanel();
      renderEquippedPanel();
    });

    stepper.appendChild(minusBtn);
    stepper.appendChild(qtyValue);
    stepper.appendChild(plusBtn);

    // Equipped/Carried are independent flags — neither implies the other —
    // and only mean anything once at least 1 is owned.
    const flags = document.createElement('div');
    flags.className = 'equipment-condition-flags';

    const equippedLabel = document.createElement('label');
    const equippedCheckbox = document.createElement('input');
    equippedCheckbox.type = 'checkbox';
    equippedCheckbox.disabled = quantity <= 0;
    equippedCheckbox.checked = isEquipmentEquipped(character, item);
    equippedCheckbox.addEventListener('change', () => {
      setEquipmentEquipped(character, item, equippedCheckbox.checked);
      renderEquipmentPanel();
      renderEquippedPanel();
    });
    equippedLabel.appendChild(equippedCheckbox);
    equippedLabel.appendChild(document.createTextNode('Equipped'));

    const carriedLabel = document.createElement('label');
    const carriedCheckbox = document.createElement('input');
    carriedCheckbox.type = 'checkbox';
    carriedCheckbox.disabled = quantity <= 0;
    carriedCheckbox.checked = isEquipmentCarried(character, item);
    carriedCheckbox.addEventListener('change', () => {
      setEquipmentCarried(character, item, carriedCheckbox.checked);
      renderEquipmentPanel();
      renderEquippedPanel();
    });
    carriedLabel.appendChild(carriedCheckbox);
    carriedLabel.appendChild(document.createTextNode('Carried'));

    flags.appendChild(equippedLabel);
    flags.appendChild(carriedLabel);

    row.appendChild(textWrap);
    row.appendChild(stepper);
    row.appendChild(flags);
    el.equipmentModalList.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Equipped panel: only what's actually Equipped or Carried (checkboxes live
// in the Purchase popup) — melee/ranged tables are sourced from the matching
// MELEE_WEAPONS/RANGED_WEAPONS skill entry (every shop weapon name is kept
// in sync with those CSVs), reusing the same rank/Target formula as the Buy
// Weapon Skills popup. Armor and Other Equipment read straight off the
// purchased items.
// ---------------------------------------------------------------------------

function buildEquippedWeaponRow(weapon, category) {
  const row = document.createElement('tr');
  const equipmentItem = EQUIPMENT.find((e) => e.type === 'weapons' && e.name === weapon.name);

  const nameCell = document.createElement('td');
  nameCell.className = 'weapon-name-cell';
  nameCell.textContent = weapon.name;

  const secondCell = document.createElement('td');
  secondCell.textContent = category === 'melee' ? weapon.size : weapon.range;

  const attrCell = document.createElement('td');
  attrCell.textContent = weapon.attribute.join(' / ');

  const rofCell = document.createElement('td');
  rofCell.textContent = weapon.rof;

  const targetCell = document.createElement('td');
  targetCell.className = 'weapon-target';
  targetCell.textContent = getWeaponTarget(character, category, weapon.name);
  targetCell.title = `Base Attack + (${getWeaponRate(character, category, weapon.name)} * rank)`;

  const bCell = document.createElement('td');
  bCell.textContent = weapon.blunt;
  const sCell = document.createElement('td');
  sCell.textContent = weapon.slash;
  const pCell = document.createElement('td');
  pCell.textContent = weapon.pierce;
  const eCell = document.createElement('td');
  eCell.textContent = weapon.energy;

  const conditionCell = document.createElement('td');
  conditionCell.className = 'equipped-condition-cell';
  conditionCell.textContent = equipmentItem
    ? conditionLabel(isEquipmentEquipped(character, equipmentItem), isEquipmentCarried(character, equipmentItem))
    : '—';

  row.appendChild(nameCell);
  row.appendChild(secondCell);
  row.appendChild(attrCell);
  row.appendChild(rofCell);
  row.appendChild(targetCell);
  row.appendChild(bCell);
  row.appendChild(sCell);
  row.appendChild(pCell);
  row.appendChild(eCell);
  row.appendChild(conditionCell);
  return row;
}

function renderEquippedWeaponsTable(tbody, category) {
  tbody.innerHTML = '';
  const weapons = getWornWeapons(character, category);

  if (weapons.length === 0) {
    const row = document.createElement('tr');
    row.className = 'equipped-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 10;
    cell.textContent = `No ${category} weapons equipped or carried.`;
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  weapons.forEach((weapon) => tbody.appendChild(buildEquippedWeaponRow(weapon, category)));
}

function renderEquippedArmorTable() {
  el.equippedArmorBody.innerHTML = '';
  const entries = getWornEquipmentEntries(character, 'armor');
  if (entries.length === 0) {
    const row = document.createElement('tr');
    row.className = 'equipped-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'No armor equipped or carried.';
    row.appendChild(cell);
    el.equippedArmorBody.appendChild(row);
    return;
  }
  entries.forEach(({ item, quantity, equipped, carried }) => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = item.name;
    const descCell = document.createElement('td');
    descCell.textContent = item.description;
    const qtyCell = document.createElement('td');
    qtyCell.textContent = String(quantity);
    const weightCell = document.createElement('td');
    weightCell.textContent = `${formatWeight(item.weight * quantity)} lb`;
    const costCell = document.createElement('td');
    costCell.textContent = `${formatGT(item.cost * quantity)} GT`;
    const conditionCell = document.createElement('td');
    conditionCell.className = 'equipped-condition-cell';
    conditionCell.textContent = conditionLabel(equipped, carried);

    row.appendChild(nameCell);
    row.appendChild(descCell);
    row.appendChild(qtyCell);
    row.appendChild(weightCell);
    row.appendChild(costCell);
    row.appendChild(conditionCell);
    el.equippedArmorBody.appendChild(row);
  });
}

function renderEquippedGeneralTable() {
  el.equippedGeneralBody.innerHTML = '';
  const entries = getWornEquipmentEntries(character, 'general');
  if (entries.length === 0) {
    const row = document.createElement('tr');
    row.className = 'equipped-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No other equipment carried.';
    row.appendChild(cell);
    el.equippedGeneralBody.appendChild(row);
    return;
  }
  entries.forEach(({ item, quantity }) => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = item.name;
    const qtyCell = document.createElement('td');
    qtyCell.textContent = String(quantity);
    const weightCell = document.createElement('td');
    weightCell.textContent = `${formatWeight(item.weight * quantity)} lb`;
    const costCell = document.createElement('td');
    costCell.textContent = `${formatGT(item.cost * quantity)} GT`;

    row.appendChild(nameCell);
    row.appendChild(qtyCell);
    row.appendChild(weightCell);
    row.appendChild(costCell);
    el.equippedGeneralBody.appendChild(row);
  });
}

function renderEquippedPanel() {
  const totalWeight = getCarriedEquipmentWeightTotal(character);
  el.equippedWeightSummary.textContent = `Total equipment weight (Equipped + Carried): ${formatWeight(totalWeight)} lb`;

  renderEquippedWeaponsTable(el.equippedMeleeWeaponsBody, 'melee');
  renderEquippedWeaponsTable(el.equippedRangedWeaponsBody, 'ranged');
  renderEquippedArmorTable();
  renderEquippedGeneralTable();
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
  const effectiveRank = getWeaponEffectiveRank(character, category, weapon.name);
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
  renderEquippedPanel();
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
setupCollapsible(el.equippedCollapseToggle, el.equippedBody);

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
      if (!equipmentByName.has(name)) return;
      const raw = loaded.equipmentOwned[name];
      // Older saves stored a plain quantity number; current saves store
      // { quantity, equipped, carried } — accept either.
      const quantity = Number.isFinite(raw) ? raw : Number(raw && raw.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      result.equipmentOwned[name] = {
        quantity: Math.floor(quantity),
        equipped: !!(raw && raw.equipped),
        carried: !!(raw && raw.carried),
      };
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

// ---------------------------------------------------------------------------
// PDF export: builds a print-only sheet (hidden on screen, shown only when
// the browser's print dialog opens — see src/print.css) that mirrors the
// blank character-sheet PDF template for this character's current Focus,
// filled in with live data, then calls window.print(). Save the print
// dialog's output as PDF to get a filled sheet — there's no server-side or
// bundled PDF library, this app stays file://-only and dependency-free.
// ---------------------------------------------------------------------------

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PRINT_COMBAT_CLASS_FOCUS_BONUS = { Fighter: 25, Priest: 20, Thief: 15, Mage: 10 };
const PRINT_CLASS_MAGIC_FOCUS_BONUS = { Fighter: 0, Thief: 5, Priest: 5, Mage: 15 };
const PRINT_CLASS_MIRACLE_FOCUS_BONUS = { Fighter: 0, Thief: 0, Mage: 5, Priest: 15 };
const PRINT_VITALS_FOCUS_MOD_PD = { Fighter: 1, Priest: 0.9, Thief: 0.8, Mage: 0.7 };
const PRINT_VITALS_FOCUS_MOD_MD = { Fighter: 0.7, Priest: 0.9, Thief: 0.9, Mage: 1.1 };

// class_*_focus_bonus tokens in COMBAT_STAT_GROUP/CASTING_STAT_GROUP's
// formulaText, swapped for this character's actual Focus bonus.
function printWithFocusBonus(formula, focus) {
  return formula
    .replace(/class_magic_focus_bonus/g, String(PRINT_CLASS_MAGIC_FOCUS_BONUS[focus]))
    .replace(/class_miracle_focus_bonus/g, String(PRINT_CLASS_MIRACLE_FOCUS_BONUS[focus]))
    .replace(/class_focus_bonus/g, String(PRINT_COMBAT_CLASS_FOCUS_BONUS[focus]));
}

function printDotsRow(n, filled) {
  let dots = '';
  for (let i = 1; i <= n; i += 1) {
    dots += `<i class="dot${i <= filled ? ' filled' : ''}"></i>`;
  }
  return `<span class="dotsrow">${dots}</span>`;
}

function printAttributesBlock() {
  const keySet = new Set(DEFY_KEY_ATTRIBUTES[character.focus]);
  const half = Math.ceil(ATTRIBUTES.length / 2);
  const cols = [ATTRIBUTES.slice(0, half), ATTRIBUTES.slice(half)];
  const col = (attrs) => `<table class="compact attrtable"><tr><th>Attribute</th><th>Value</th><th>Defy</th></tr>
${attrs.map((a) => {
    const value = getEffectiveAttribute(character, a);
    const defy = getDefyValue(character.focus, a, value);
    const rate = keySet.has(a) ? '&times;4%' : '&times;2%';
    return `<tr><td>${escHtml(a)}</td><td><b>${value}</b></td><td class="defycell"><span class="defy-value">${defy}</span><span class="defy-formula">${rate}</span></td></tr>`;
  }).join('')}
</table>`;
  return `<div class="section-title">Attributes</div>
<div class="two-col">${col(cols[0])}${col(cols[1])}</div>`;
}

const PRINT_CLASSBOX_DOTS_PER_ROW = 20;

function printClassesBlock() {
  const boxes = CLASSES.map((cls) => {
    const rank = character.classDots[cls];
    const row1 = Math.min(rank, PRINT_CLASSBOX_DOTS_PER_ROW);
    const row2 = Math.max(0, rank - PRINT_CLASSBOX_DOTS_PER_ROW);
    return `
<div class="classbox${cls === character.focus ? ' classbox-focus' : ''}">
  <div class="classbox-name">${escHtml(cls)} <span class="rank-value">(${rank}/${CLASS_DOTS_MAX})</span></div>
  <div class="dotgrid">${printDotsRow(PRINT_CLASSBOX_DOTS_PER_ROW, row1)}${printDotsRow(PRINT_CLASSBOX_DOTS_PER_ROW, row2)}</div>
  <div class="classbox-defy">Defy: ${DEFY_KEY_ATTRIBUTES[cls].map((a) => a.slice(0, 3)).join('/')}</div>
</div>`;
  }).join('');
  return `<div class="section-title">Focus</div>
<div class="classes-row">${boxes}</div>`;
}

const PRINT_VITALS_BASE_FORMULAS = {
  physicalDamage: (pd) => `(Phy+Str+Con)/2 &times; (${pd}+race_pd) &times; tot_rk`,
  mentalDamage: (pd, md) => `(Intl+Wil+Con)/2 &times; (${md}+race_md) &times; tot_rk`,
  movement: () => 'Str+Agi+Con+race_mv',
  initiative: () => '(Agi+Intl+Intu+Brv)/4 + 5&times;Thf_rk + 3&times;Ftr_rk + race_init',
  staminaRecovery: () => '(Con+Wil)/2',
  stamina: () => 'Str + 2&times;Con + 2&times;Wil + tot_rk&times;(Con/2)',
};

function printVitalsBlock() {
  const pdMod = PRINT_VITALS_FOCUS_MOD_PD[character.focus];
  const mdMod = PRINT_VITALS_FOCUS_MOD_MD[character.focus];
  const rows = VITALS_STATS.map((s) => {
    const state = character.vitals[s.id];
    const base = s.formula(character);
    const magic = Number(state.magic) || 0;
    const misc = Number(state.misc) || 0;
    const total = roundUp(base + magic + misc);
    const formula = PRINT_VITALS_BASE_FORMULAS[s.id](pdMod, mdMod);
    return `<tr><td><div class="stat-name">${escHtml(s.name)}</div><div class="stat-formula">${formula}</div></td><td>${base}</td><td>${magic}</td><td>${misc}</td><td class="totalcell">${total}</td></tr>`;
  }).join('');
  return `<table class="compact vitalstable"><tr><th>Vital</th><th>Base</th><th>Magic</th><th>Misc</th><th>Total</th></tr>${rows}</table>`;
}

function printDerivedBlock() {
  const items = [
    ...COMBAT_STAT_GROUP.stats.map((s) => ({ name: s.name, formula: s.formulaText, value: s.formula(character) })),
    { name: 'Armored Defense', formula: 'Base Defense + Armor Value', value: getArmoredDefenseTotal(character) },
    ...CASTING_STAT_GROUP.stats.map((s) => ({ name: s.name, formula: s.formulaText, value: s.formula(character) })),
  ];
  const rows = items.map((it) => `<tr><td><div class="stat-name">${escHtml(it.name)}</div><div class="stat-formula">${escHtml(printWithFocusBonus(it.formula, character.focus))}</div></td><td>${it.value}</td></tr>`).join('');
  return `<table class="compact derivedtable"><tr><th>Derived</th><th>Target</th></tr>${rows}</table>`;
}

function printStaminaCostBlock() {
  const cells = STAMINA_COST_ITEMS.map((item) => {
    const state = character.vitals.staminaCost[item.id];
    const total = getStaminaCostTotal(character, item);
    return `
<td class="stcell">
  <div class="stcell-name">${escHtml(item.name)}</div>
  <div class="stcell-formula">${item.base} + <b>${Number(state.armor) || 0}</b> + <b>${Number(state.misc) || 0}</b> = <b>${total}</b></div>
</td>`;
  }).join('');
  return `<table class="compact"><tr>${cells}</tr></table>`;
}

function printEquippedWeaponsTable() {
  const rows = [
    ...getWornWeapons(character, 'melee').map((w) => ({ w, category: 'melee' })),
    ...getWornWeapons(character, 'ranged').map((w) => ({ w, category: 'ranged' })),
  ];
  const cols = ['Weapon', 'M/R', 'Size/Range', 'ROF', 'Target', 'B', 'S', 'P', 'E', 'Cond.'];
  if (rows.length === 0) {
    return `<table class="compact datatable"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr><tr><td class="ps-empty" colspan="${cols.length}">No weapons equipped or carried.</td></tr></table>`;
  }
  const body = rows.map(({ w, category }) => {
    const equipmentItem = EQUIPMENT.find((e) => e.type === 'weapons' && e.name === w.name);
    const cond = equipmentItem ? conditionLabel(isEquipmentEquipped(character, equipmentItem), isEquipmentCarried(character, equipmentItem)) : '—';
    const target = getWeaponTarget(character, category, w.name);
    return `<tr><td>${escHtml(w.name)}</td><td>${category === 'melee' ? 'M' : 'R'}</td><td>${escHtml(category === 'melee' ? w.size : w.range)}</td><td>${w.rof}</td><td><b>${target}</b></td><td>${w.blunt}</td><td>${w.slash}</td><td>${w.pierce}</td><td>${w.energy}</td><td>${escHtml(cond)}</td></tr>`;
  }).join('');
  return `<table class="compact datatable"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${body}</table>`;
}

function printArmorTable() {
  const entries = getWornEquipmentEntries(character, 'armor');
  const cols = ['Armor', 'Weight', 'Cost', 'S', 'B', 'P', 'E', 'Cond.'];
  if (entries.length === 0) {
    return `<table class="compact datatable armortable"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr><tr><td class="ps-empty" colspan="${cols.length}">No armor equipped or carried.</td></tr></table>`;
  }
  const body = entries.map(({ item, quantity, equipped, carried }) => `<tr><td>${escHtml(item.name)}</td><td>${formatWeight(item.weight * quantity)} lb</td><td>${formatGT(item.cost * quantity)} GT</td><td></td><td></td><td></td><td></td><td>${escHtml(conditionLabel(equipped, carried))}</td></tr>`).join('');
  return `<table class="compact datatable armortable"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${body}</table>`;
}

function printGeneralEquipmentTable() {
  const entries = getWornEquipmentEntries(character, 'general');
  const cols = ['Item', 'Qty', 'Weight', 'Cost'];
  if (entries.length === 0) {
    return `<table class="compact datatable"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr><tr><td class="ps-empty" colspan="${cols.length}">No other equipment carried.</td></tr></table>`;
  }
  const body = entries.map(({ item, quantity }) => `<tr><td>${escHtml(item.name)}</td><td>${quantity}</td><td>${formatWeight(item.weight * quantity)} lb</td><td>${formatGT(item.cost * quantity)} GT</td></tr>`).join('');
  return `<table class="compact datatable"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${body}</table>`;
}

function printPage1() {
  const title = `VennRPG Character Sheet &mdash; ${escHtml(character.focus)}`;
  return `<div class="sheetpage">
  <div class="ps-header">
    <div class="ps-title">${title}</div>
    <div class="ps-fields">
      <span class="ps-field wide">Character Name <span class="ps-field-value">${escHtml(character.name || 'Unnamed')}</span></span>
      <span class="ps-field">Race <span class="ps-field-value">${escHtml(character.race)}</span></span>
      <span class="ps-field">Focus <span class="ps-field-value">${escHtml(character.focus)}</span></span>
    </div>
  </div>

  ${printAttributesBlock()}
  ${printClassesBlock()}

  <div class="two-col">
    <div><div class="section-title">Vitals <span class="hint">(Base + Magic + Misc = Total)</span></div>${printVitalsBlock()}</div>
    <div><div class="section-title">Combat &amp; Casting</div>${printDerivedBlock()}</div>
  </div>

  <div class="section-title">Stamina Cost <span class="hint">(Base + Armor + Misc = Total)</span></div>
  ${printStaminaCostBlock()}

  <div class="section-title">Equipped Weapons</div>
  ${printEquippedWeaponsTable()}

  <div class="section-title">Armor</div>
  ${printArmorTable()}

  <div class="section-title">General Equipment</div>
  ${printGeneralEquipmentTable()}
</div>`;
}

// This Focus's own Specials, plus any owned outside it (race-gated ones, or
// left over from a Focus change) so nothing owned goes unlisted.
function printSpecialsForSheet() {
  const specials = SPECIALS.filter((s) => s.focus.includes(character.focus) || isSpecialOwned(character, s));
  return [...specials].sort((a, b) => a.name.localeCompare(b.name));
}

// This Focus's own Skills, plus every General Skill (always available).
function printSkillsForSheet() {
  const skills = SKILLS.filter((s) => isSkillEligibleForClass(character, s, character.focus) || isSkillGeneral(s));
  return [...skills].sort((a, b) => a.name.localeCompare(b.name));
}

function printSpecialsGrid() {
  const items = printSpecialsForSheet().map((s) => {
    const owned = isSpecialOwned(character, s);
    return `<div class="special-entry"><i class="dot${owned ? ' filled' : ''}"></i><span>${escHtml(s.name)}</span></div>`;
  }).join('');
  return `<div class="section-title">Specials</div>
<div class="specials-columns">${items}</div>`;
}

function printSkillsColumns() {
  const items = printSkillsForSheet().map((s) => {
    const rank = getSkillEffectiveRank(character, s);
    const target = getSkillTarget(character, s);
    return `
<div class="skill-entry">
  <div class="skill-name">${escHtml(s.name)} <span class="skill-attr">${escHtml(s.attribute.join('/'))}</span></div>
  <div class="skill-row">Rank: <b>${rank}</b> Tgt: <b>${target}</b></div>
</div>`;
  }).join('');
  return `<div class="section-title">Skills <span class="hint">Target = roundUp(avg(Attribute) + rank &times; 6%)</span></div>
<div class="skills-columns">${items}</div>`;
}

// Skills actually bought outside this Focus (and not General) — real
// entries only, since there's no fixed list the way the Focus/General set has.
function printNonFocusSkillsBlock() {
  const focusSet = new Set(printSkillsForSheet());
  const owned = SKILLS.filter((s) => !focusSet.has(s) && getSkillEffectiveRank(character, s) > 0);
  const body = owned.length === 0
    ? '<div class="ps-empty-note">None — no Skills purchased outside this Focus.</div>'
    : `<div class="skills-columns">${[...owned].sort((a, b) => a.name.localeCompare(b.name)).map((s) => {
      const rank = getSkillEffectiveRank(character, s);
      const target = getSkillTarget(character, s);
      return `
<div class="skill-entry">
  <div class="skill-name">${escHtml(s.name)} <span class="skill-attr">${escHtml(s.attribute.join('/'))}</span></div>
  <div class="skill-row">Rank: <b>${rank}</b> Tgt: <b>${target}</b></div>
</div>`;
    }).join('')}</div>`;
  return `<div class="section-title">Non-Focus Skills <span class="hint">Target = roundUp(avg(Attribute) + rank &times; 3%)</span></div>
${body}`;
}

function printPage2() {
  return `<div class="sheetpage">
${printSpecialsGrid()}
${printSkillsColumns()}
${printNonFocusSkillsBlock()}
</div>`;
}

// Fighter/Thief have no Spell/Miracle access by default, so their printed
// sheets skip these pages entirely (matching the blank PDF templates).
function printGrimoireChecklist(title, entries, schools, isLearned) {
  const bySchool = schools.map((school) => {
    const items = entries.filter((e) => e.school === school).sort((a, b) => a.name.localeCompare(b.name));
    const rows = items.map((e) => {
      const learned = isLearned(e);
      return `<div class="grimoire-entry${learned ? ' learned' : ''}"><i class="dot${learned ? ' filled' : ''}"></i><span class="grimoire-name">${escHtml(e.name)}</span><span class="grimoire-cost">${escHtml(e.cost)}</span></div>`;
    }).join('');
    return `<div class="grimoire-school"><div class="grimoire-school-title">${escHtml(school)}</div>${rows}</div>`;
  }).join('');
  return `<div class="sheetpage">
<div class="section-title">${escHtml(title)}</div>
<div class="grimoire-columns">${bySchool}</div>
</div>`;
}

function buildPrintSheetHtml() {
  const includeGrimoires = character.focus === 'Mage' || character.focus === 'Priest';
  const page3 = includeGrimoires ? printGrimoireChecklist('Miracles', MIRACLES, MIRACLE_SCHOOLS, (m) => isMiracleLearned(character, m)) : '';
  const page4 = includeGrimoires ? printGrimoireChecklist('Spells', SPELLS, SPELL_SCHOOLS, (s) => isSpellLearned(character, s)) : '';
  return `${printPage1()}${printPage2()}${page3}${page4}`;
}

el.pdfBtn.addEventListener('click', () => {
  el.printSheet.innerHTML = buildPrintSheetHtml();
  window.print();
});

// Persist whenever the page is about to go away (reload, navigate, close),
// so the in-progress character — not a fresh roll — comes back next time.
window.addEventListener('pagehide', saveCharacterToStorage);
window.addEventListener('beforeunload', saveCharacterToStorage);

renderAll();

})();
