(function () {

const {
  ATTRIBUTES, ATTRIBUTE_MIN, ATTRIBUTE_MAX,
  CLASSES, CLASS_DOTS_MIN, CLASS_DOTS_MAX, CLASS_DOTS_ROWS, CLASS_DOTS_PER_ROW,
  getDefyPercent, getDefyValue,
  syncClassAssignments, getClassAssignedCount,
  DERIVED_STAT_GROUPS, TARGETS, rollAttribute, createDefaultCharacter, clamp,
} = window.VennRPG;

let character = createDefaultCharacter();

const el = {
  charName: document.getElementById('charName'),
  focusSelect: document.getElementById('focusSelect'),
  rollAllBtn: document.getElementById('rollAllBtn'),
  attributesList: document.getElementById('attributesList'),
  derivedStatsList: document.getElementById('derivedStatsList'),
  classesList: document.getElementById('classesList'),
  targetsBody: document.getElementById('targetsBody'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  loadInput: document.getElementById('loadInput'),
};

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

    const input = document.createElement('input');
    input.type = 'number';
    input.min = ATTRIBUTE_MIN;
    input.max = ATTRIBUTE_MAX;
    input.value = character.attributes[attr];
    input.addEventListener('change', () => {
      const value = clamp(parseInt(input.value, 10) || ATTRIBUTE_MIN, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
      character.attributes[attr] = value;
      input.value = value;
      renderAttributes();
      renderTargets();
    });

    const rerollBtn = document.createElement('button');
    rerollBtn.type = 'button';
    rerollBtn.className = 'reroll-btn';
    rerollBtn.textContent = '🎲';
    rerollBtn.title = `Reroll ${attr} (2d10)`;
    rerollBtn.addEventListener('click', () => {
      character.attributes[attr] = rollAttribute();
      renderAttributes();
      renderTargets();
    });

    const defyPercent = getDefyPercent(character.focus, attr);
    const defy = document.createElement('span');
    defy.className = 'attr-defy';
    defy.textContent = `${getDefyValue(character.focus, attr, character.attributes[attr])}`;
    defy.title = `Defy = ${character.attributes[attr]} * ${defyPercent}%`;

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(defy);
    row.appendChild(rerollBtn);
    el.attributesList.appendChild(row);
  });
  renderDerivedStats();
}

function renderDerivedStats() {
  el.derivedStatsList.innerHTML = '';
  DERIVED_STAT_GROUPS.forEach((group) => {
    const title = document.createElement('h3');
    title.className = 'derived-stats-title';
    title.textContent = group.title;
    el.derivedStatsList.appendChild(title);

    group.stats.forEach((stat) => {
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
      el.derivedStatsList.appendChild(row);
    });
  });
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

    for (let row = 0; row < CLASS_DOTS_ROWS; row += 1) {
      const grid = document.createElement('div');
      grid.className = 'dots-grid';
      for (let col = 0; col < CLASS_DOTS_PER_ROW; col += 1) {
        const dotIndex = row * CLASS_DOTS_PER_ROW + col + 1; // 1-based level this dot represents
        const dotBtn = document.createElement('button');
        dotBtn.type = 'button';
        dotBtn.className = 'dot' + (character.classDots[cls] >= dotIndex ? ' filled' : '');
        dotBtn.title = `Set ${cls} to ${dotIndex}`;
        dotBtn.addEventListener('click', () => {
          const current = character.classDots[cls];
          character.classDots[cls] = current === dotIndex ? dotIndex - 1 : dotIndex;
          character.classDots[cls] = clamp(character.classDots[cls], CLASS_DOTS_MIN, CLASS_DOTS_MAX);
          syncClassAssignments(character, cls);
          renderClasses();
          renderTargets();
        });
        grid.appendChild(dotBtn);
      }
      box.appendChild(grid);
    }

    const total = character.classDots[cls];
    if (total > 0) {
      const assignHeader = document.createElement('div');
      assignHeader.className = 'assign-header';
      const assignLabel = document.createElement('span');
      assignLabel.textContent = 'Attack / Defend';
      const assignCount = document.createElement('span');
      assignCount.className = 'assign-count';
      assignCount.textContent = `${getClassAssignedCount(character, cls)} / ${total}`;
      assignHeader.appendChild(assignLabel);
      assignHeader.appendChild(assignCount);
      box.appendChild(assignHeader);

      const assignments = character.classAssignments[cls];
      for (let row = 0; row < Math.ceil(total / CLASS_DOTS_PER_ROW); row += 1) {
        const grid = document.createElement('div');
        grid.className = 'dots-grid assign-grid';
        for (let col = 0; col < CLASS_DOTS_PER_ROW; col += 1) {
          const i = row * CLASS_DOTS_PER_ROW + col;
          if (i >= total) break;
          const state = assignments[i];
          const dotBtn = document.createElement('button');
          dotBtn.type = 'button';
          dotBtn.className = 'dot assign-dot' + (state ? ` assign-${state}` : '');
          dotBtn.title = state ? `${cls} dot ${i + 1}: ${state}` : `${cls} dot ${i + 1}: unassigned (click to assign Attack)`;
          dotBtn.addEventListener('click', () => {
            assignments[i] = state === null ? 'attack' : state === 'attack' ? 'defend' : null;
            renderClasses();
          });
          grid.appendChild(dotBtn);
        }
        box.appendChild(grid);
      }
    }

    el.classesList.appendChild(box);
  });
  renderDerivedStats();
}

function renderTargets() {
  el.targetsBody.innerHTML = '';
  TARGETS.forEach((target) => {
    const row = document.createElement('tr');
    const state = character.targets[target.id];

    const base = target.formula(character);
    const total = base + (Number(state.equipment) || 0) + (Number(state.miscellaneous) || 0);

    const nameCell = document.createElement('td');
    nameCell.textContent = target.name;

    const formulaCell = document.createElement('td');
    formulaCell.className = 'formula-cell';
    formulaCell.textContent = `${target.formulaText} = ${base}`;

    const equipCell = document.createElement('td');
    const equipInput = document.createElement('input');
    equipInput.type = 'number';
    equipInput.value = state.equipment;
    equipInput.addEventListener('change', () => {
      state.equipment = parseInt(equipInput.value, 10) || 0;
      renderTargets();
    });
    equipCell.appendChild(equipInput);

    const miscCell = document.createElement('td');
    const miscInput = document.createElement('input');
    miscInput.type = 'number';
    miscInput.value = state.miscellaneous;
    miscInput.addEventListener('change', () => {
      state.miscellaneous = parseInt(miscInput.value, 10) || 0;
      renderTargets();
    });
    miscCell.appendChild(miscInput);

    const totalCell = document.createElement('td');
    totalCell.className = 'total-cell';
    totalCell.textContent = total;

    const rollCell = document.createElement('td');
    rollCell.className = 'roll-cell';
    const rollBtn = document.createElement('button');
    rollBtn.type = 'button';
    rollBtn.textContent = '🎲 Roll d100';
    const resultSpan = document.createElement('span');
    resultSpan.className = 'roll-result';
    rollBtn.addEventListener('click', () => {
      const roll = 1 + Math.floor(Math.random() * 100);
      const success = roll <= total;
      resultSpan.textContent = `${roll} vs ${total} — ${success ? 'Success' : 'Fail'}`;
      resultSpan.className = 'roll-result ' + (success ? 'success' : 'fail');
    });
    rollCell.appendChild(rollBtn);
    rollCell.appendChild(resultSpan);

    row.appendChild(nameCell);
    row.appendChild(formulaCell);
    row.appendChild(equipCell);
    row.appendChild(miscCell);
    row.appendChild(totalCell);
    row.appendChild(rollCell);
    el.targetsBody.appendChild(row);
  });
}

function renderAll() {
  el.charName.value = character.name;
  renderFocusOptions();
  renderAttributes();
  renderClasses();
  renderTargets();
}

el.charName.addEventListener('change', () => {
  character.name = el.charName.value;
});

el.focusSelect.addEventListener('change', () => {
  character.focus = el.focusSelect.value;
  renderAttributes();
  renderClasses();
});

el.rollAllBtn.addEventListener('click', () => {
  ATTRIBUTES.forEach((attr) => { character.attributes[attr] = rollAttribute(); });
  renderAttributes();
  renderTargets();
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
      renderAll();
    } catch (err) {
      alert('Could not load character file: ' + err.message);
    }
  };
  reader.readAsText(file);
});

function normalizeLoadedCharacter(loaded) {
  const base = createDefaultCharacter();
  const result = {
    name: typeof loaded.name === 'string' ? loaded.name : '',
    focus: CLASSES.includes(loaded.focus) ? loaded.focus : base.focus,
    attributes: { ...base.attributes },
    classDots: { ...base.classDots },
    targets: base.targets,
  };

  ATTRIBUTES.forEach((attr) => {
    const v = loaded.attributes && loaded.attributes[attr];
    if (Number.isFinite(v)) {
      result.attributes[attr] = clamp(v, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
    }
  });

  result.classAssignments = {};
  CLASSES.forEach((cls) => {
    const v = loaded.classDots && loaded.classDots[cls];
    if (Number.isFinite(v)) {
      result.classDots[cls] = clamp(v, CLASS_DOTS_MIN, CLASS_DOTS_MAX);
    }

    const loadedAssignments = (loaded.classAssignments && loaded.classAssignments[cls]) || [];
    result.classAssignments[cls] = loadedAssignments
      .map((a) => (a === 'attack' || a === 'defend' ? a : null));
    syncClassAssignments(result, cls);
  });

  TARGETS.forEach((target) => {
    const stored = loaded.targets && loaded.targets[target.id];
    result.targets[target.id] = {
      equipment: Number.isFinite(stored && stored.equipment) ? stored.equipment : 0,
      miscellaneous: Number.isFinite(stored && stored.miscellaneous) ? stored.miscellaneous : 0,
    };
  });

  return result;
}

renderAll();

})();
