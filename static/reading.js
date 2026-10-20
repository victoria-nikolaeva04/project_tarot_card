// Variables
const MAX_PICKS = 3;
const POSITIONS = ['Past', 'Present', 'Future'];
const ARCH_HALF_SPAN = 72;  // degrees either side of the top of the arch
const CARD_RATIO = 1.73;    // card height / width

const deck_grid = document.getElementById('deck_grid');
const pick_section = document.getElementById('pick_section');
const result_section = document.getElementById('result_section');
const result_grid = document.getElementById('result_grid');
const pick_status = document.getElementById('pick_status');
const reveal_btn = document.getElementById('reveal_btn');
const reset_btn = document.getElementById('reset_btn');
const again_btn = document.getElementById('again_btn');
const whimsy_btn = document.getElementById('whimsy_btn');
const slots_wrap = document.getElementById('slots');
const slots = Array.from(slots_wrap.querySelectorAll('.slot'));
const slots_actions = document.getElementById('slots_actions');
const slots_again_btn = document.getElementById('slots_again_btn');
const result_oracle = document.getElementById('result_oracle');
const slots_oracle = document.getElementById('slots_oracle');

const reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(resolve => setTimeout(resolve, reduce_motion ? 0 : ms));
const cover_src = deck_grid.querySelector('img').src;

let picked = [];                      // classic mode picks
let whimsy = false;                   // arch + shadow spots mode
let slot_cards = [null, null, null];  // whimsy mode: the card in each spot
let locked = false;                   // whimsy mode: the reveal has started
let run_id = 0;                       // cancels a reveal that is still playing after a reset

// Randomize the Deck
function shuffle_deck() {
    const cards = Array.from(deck_grid.children);
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards.forEach(card => deck_grid.appendChild(card));
}

// Classic layout: the deck is dealt in row by row
function clear_arch() {
    deck_grid.classList.remove('arch');
    deck_grid.style.height = '';
    deck_grid.style.removeProperty('--cw');
    Array.from(deck_grid.children).forEach(card => {
        ['--a', '--o', '--i'].forEach(p => card.style.removeProperty(p));
        card.style.top = '';
        card.style.zIndex = '';
    });
}

// Whimsy layout: the deck fans out in an arch (extra rows on narrow screens)
function layout_arch() {
    const cards = Array.from(deck_grid.children);
    const n = cards.length;
    deck_grid.classList.add('arch');

    const W = deck_grid.clientWidth;
    const rows = W < 560 ? 3 : W < 900 ? 2 : 1;
    const A = ARCH_HALF_SPAN * Math.PI / 180;

    let cw = 70, R = 0;
    for (let k = 0; k < 2; k++) {
        R = Math.min(640, (W / 2 - cw * 0.6) / Math.sin(A));
        cw = Math.max(50, Math.min(92, R * 0.15));
    }
    const ch = cw * CARD_RATIO;
    const gap = ch * 0.5;
    const TOP = 36;

    const radii = Array.from({ length: rows }, (_, r) => R - r * gap);
    const total = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map(r => Math.round(n * r / total));
    counts[0] += n - counts.reduce((a, b) => a + b, 0);

    let i = 0;
    counts.forEach((count, r) => {
        for (let j = 0; j < count; j++, i++) {
            const t = count > 1 ? j / (count - 1) : 0.5;
            const angle = -ARCH_HALF_SPAN + 2 * ARCH_HALF_SPAN * t;
            const card = cards[i];
            card.style.setProperty('--a', angle.toFixed(2) + 'deg');
            card.style.setProperty('--o', (R - r * gap).toFixed(1) + 'px');
            card.style.setProperty('--i', i);
            card.style.top = (TOP + r * gap) + 'px';
            card.style.zIndex = r * 100 + j;
        }
    });

    let height = 0;
    radii.forEach((radius, r) => {
        const edge = TOP + R - (radius - ch) * Math.cos(A) + (cw / 2) * Math.sin(A);
        const middle = TOP + r * gap + ch;
        height = Math.max(height, edge, middle);
    });
    deck_grid.style.setProperty('--cw', cw.toFixed(1) + 'px');
    deck_grid.style.height = (height + 24) + 'px';
}

function layout() {
    if (whimsy) {
        layout_arch();
    } else {
        clear_arch();
        const columns = getComputedStyle(deck_grid).gridTemplateColumns.split(' ').length;
        Array.from(deck_grid.children).forEach((card, i) => {
            card.style.setProperty('--row', Math.floor(i / columns));
        });
    }
    deck_grid.classList.remove('dealing');
    void deck_grid.offsetWidth; // restart the animation
    deck_grid.classList.add('dealing');
}

function update_status() {
    if (whimsy) {
        const filled = slot_cards.filter(Boolean).length;
        pick_status.textContent = filled === MAX_PICKS
            ? 'The cards are turning...'
            : `Choose ${MAX_PICKS} cards from the arch (${filled}/${MAX_PICKS})`;
        deck_grid.classList.remove('deck_full');
        return;
    }
    pick_status.textContent = picked.length === MAX_PICKS
        ? 'Your 3 cards are chosen. Flip them when you are ready.'
        : `Choose ${MAX_PICKS} cards that call to you (${picked.length}/${MAX_PICKS})`;
    reveal_btn.disabled = picked.length !== MAX_PICKS;
    deck_grid.classList.toggle('deck_full', picked.length === MAX_PICKS);
}

// Pick / un-pick cards
deck_grid.addEventListener('click', event => {
    const card = event.target.closest('.deck_card');
    if (!card) return;

    if (whimsy) {
        place_card(card);
        return;
    }

    if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        picked = picked.filter(c => c !== card);
    } else if (picked.length < MAX_PICKS) {
        card.classList.add('selected');
        picked.push(card);
    }
    update_status();
});

// Highlighted key-point chips Converter
function key_points(text) {
    const wrap = document.createElement('div');
    wrap.className = 'key_points';
    text.split(',').map(s => s.trim()).filter(Boolean).forEach(point => {
        const chip = document.createElement('span');
        chip.className = 'key_point';
        chip.textContent = point;
        wrap.appendChild(chip);
    });
    return wrap;
}

// Fill a paragraph with text, bolding every mention of a drawn card's name
function fill_with_bold_cards(p, text, card_names) {
    // "The Star" needs its "The", otherwise plain words like "star" would turn bold
    const escaped = card_names.map(name =>
        name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
    const pattern = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'gi');
    text.split(pattern).forEach((part, i) => {
        if (i % 2 === 1) {
            const strong = document.createElement('strong');
            // The match is case-insensitive, so show the card's proper name ("The Fool", not "the fool")
            const proper = card_names.find(name =>
                name.toLowerCase() === part.toLowerCase().replace(/\s+/g, ' '));
            strong.textContent = proper || part;
            p.appendChild(strong);
        } else if (part) {
            p.appendChild(document.createTextNode(part));
        }
    });
}

// AI Oracle: sends the picked cards to the server and shows the interpretation
async function request_oracle(cards, is_reversed_list, box) {
    const run = run_id;
    const eyebrow = document.createElement('span');
    eyebrow.className = 'section_eyebrow';
    eyebrow.textContent = 'The Oracle Speaks';
    const title = document.createElement('h3');
    title.textContent = '';
    const divider = document.createElement('div');
    divider.className = 'oracle_divider';
    divider.setAttribute('aria-hidden', 'true');
    divider.innerHTML = '<span>✦</span>';
    const crystal = document.createElement('div');
    crystal.className = 'crystal';
    crystal.setAttribute('aria-hidden', 'true');
    crystal.innerHTML = '<span class="orbit"><i></i></span><span class="orbit orbit--slow"><i></i></span>'
        + '<div class="orb"><span class="mist"></span><span class="mist mist--b"></span><span class="glint"></span></div>'
        + '<div class="crystal_base"></div>';
    const head = [crystal, eyebrow, title, divider];
    const status = document.createElement('p');
    status.className = 'oracle_status';
    status.textContent = 'The Oracle is gazing into your cards...';
    box.replaceChildren(...head, status);
    box.classList.add('loading');
    box.hidden = false;
    box.setAttribute('aria-busy', 'true');

    try {
        const response = await fetch('/oracle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cards: cards.map((card, i) => ({
                    name: card.dataset.name,
                    reversed: is_reversed_list[i]
                }))
            })
        });
        const data = await response.json();
        if (run !== run_id) return;
        if (!response.ok) throw new Error(data.error);

        const paragraphs = data.reading.split(/\n\s*\n/).map((text, i) => {
            const p = document.createElement('p');
            p.style.setProperty('--i', i);
            fill_with_bold_cards(p, text.trim(), cards.map(card => card.dataset.name));
            return p;
        });
        const sign_off = document.createElement('span');
        sign_off.className = 'oracle_sign_off';
        sign_off.setAttribute('aria-hidden', 'true');
        sign_off.textContent = '☾ ✦ ☽';
        sign_off.style.setProperty('--i', paragraphs.length);
        paragraphs.push(sign_off);
        box.removeAttribute('aria-busy');
        box.classList.remove('loading');
        box.replaceChildren(...head, ...paragraphs);
    } catch (error) {
        if (run !== run_id) return;
        box.removeAttribute('aria-busy');
        box.classList.remove('loading');
        status.textContent = error.message || 'The Oracle is silent right now. Please try again in a moment.';
        status.classList.add('oracle_error');
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'draw-btn oracle_retry';
        retry.textContent = 'Ask the Oracle Again';
        retry.addEventListener('click', () => request_oracle(cards, is_reversed_list, box));
        box.replaceChildren(...head, status, retry);
    }
}

// Results Shown
function build_result(card, index, is_reversed) {
    const d = card.dataset;

    const box = document.createElement('div');
    box.className = 'card_box result_card';

    const position = document.createElement('span');
    position.className = 'position_badge ' + POSITIONS[index].toLowerCase();
    position.textContent = POSITIONS[index];

    const img = document.createElement('img');
    img.className = 'card_img' + (is_reversed ? ' inverted' : '');
    img.src = d.image;
    img.alt = d.name;

    const title = document.createElement('h3');
    title.className = 'card_title';
    title.textContent = d.name;

    const label = document.createElement('span');
    label.className = 'orientation_label ' + (is_reversed ? 'label_reversed' : 'label_upright');
    label.textContent = is_reversed ? 'Reversed' : 'Upright';

    box.append(position, img, title, label,
               key_points(is_reversed ? d.reversed : d.upright));
    return box;
}

reveal_btn.addEventListener('click', () => {
    const orientations = picked.map(() => Math.random() < 0.25);
    result_grid.replaceChildren(...picked.map((card, i) => build_result(card, i, orientations[i])));
    pick_section.hidden = true;
    result_section.hidden = false;
    // Stagger the Reveal Animation
    Array.from(result_grid.children).forEach((box, i) => {
        box.style.animationDelay = (i * 0.25) + 's';
    });
    request_oracle(picked, orientations, result_oracle);
});


// ---------- Whimsy mode ----------

// A picked card flies from the arch into the first empty shadow spot
function place_card(card) {
    const index = slot_cards.indexOf(null);
    if (locked || index === -1 || card.classList.contains('placed')) return;

    const slot = slots[index];
    const well = slot.querySelector('.slot_well');
    const is_reversed = Math.random() < 0.25;
    slot.dataset.reversed = is_reversed ? '1' : '';
    slot_cards[index] = card;
    card.classList.add('placed');
    update_status();

    const land = () => {
        fill_slot(slot, card);
        if (slots.every(s => s.classList.contains('filled'))) begin_reveal();
    };
    if (reduce_motion) { land(); return; }

    const from = card.getBoundingClientRect();
    const to = well.getBoundingClientRect();
    const w = card.offsetWidth, h = card.offsetHeight;
    const angle = parseFloat(card.style.getPropertyValue('--a')) || 0;
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - (from.top + from.height / 2);

    const fly = document.createElement('img');
    fly.className = 'fly_card';
    fly.src = cover_src;
    fly.alt = '';
    fly.style.width = w + 'px';
    fly.style.height = h + 'px';
    fly.style.left = (from.left + from.width / 2 - w / 2) + 'px';
    fly.style.top = (from.top + from.height / 2 - h / 2) + 'px';
    document.body.appendChild(fly);

    fly.animate([
        { transform: `rotate(${angle}deg) scale(1)` },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${to.width / w})` }
    ], { duration: 1100, easing: 'cubic-bezier(0.45, 0.05, 0.2, 1)', fill: 'forwards' })
        .finished.then(() => { fly.remove(); land(); })
        .catch(() => {}); // the flight is cancelled if the reading is reset mid-air
}

// Put a face-down card in the spot, ready to flip
function fill_slot(slot, card) {
    const well = slot.querySelector('.slot_well');
    const d = card.dataset;

    const back = document.createElement('div');
    back.className = 'face back';
    const back_img = document.createElement('img');
    back_img.src = cover_src;
    back_img.alt = 'Face-down tarot card';
    back.appendChild(back_img);

    const front = document.createElement('div');
    front.className = 'face front';
    const front_img = document.createElement('img');
    front_img.src = d.image;
    front_img.alt = d.name;
    if (slot.dataset.reversed) front_img.classList.add('inverted');
    front.appendChild(front_img);

    const flipper = document.createElement('div');
    flipper.className = 'flipper';
    flipper.append(back, front);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'slot_remove';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', 'Return this card to the deck');
    remove.addEventListener('click', () => unplace(slot));

    well.append(flipper, remove);
    slot.classList.add('filled');
}

function clear_slot(slot) {
    slot.classList.remove('filled', 'revealed');
    slot.dataset.reversed = '';
    slot.querySelector('.slot_well').replaceChildren();
    slot.querySelector('.slot_caption').replaceChildren();
}

// Change your mind: send a placed card back to the arch
function unplace(slot) {
    if (locked) return;
    const index = slots.indexOf(slot);
    slot_cards[index].classList.remove('placed');
    slot_cards[index] = null;
    clear_slot(slot);
    update_status();
}

// All three spots are full: focus on them and flip the cards one by one
async function begin_reveal() {
    if (locked) return;
    locked = true;
    const run = run_id;
    slots.forEach(s => s.querySelector('.slot_remove')?.remove());

    await sleep(700);
    if (run !== run_id) return;
    pick_section.classList.add('revealing');

    await sleep(900);
    if (run !== run_id) return;
    slots_wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await sleep(1400);
    for (let i = 0; i < slots.length; i++) {
        if (run !== run_id) return;
        const slot = slots[i];
        const d = slot_cards[i].dataset;
        const is_reversed = Boolean(slot.dataset.reversed);

        slot.querySelector('.flipper').classList.add('flipped');
        await sleep(1500);
        if (run !== run_id) return;

        const title = document.createElement('h3');
        title.className = 'card_title';
        title.textContent = d.name;
        const label = document.createElement('span');
        label.className = 'orientation_label ' + (is_reversed ? 'label_reversed' : 'label_upright');
        label.textContent = is_reversed ? 'Reversed' : 'Upright';
        slot.querySelector('.slot_caption')
            .replaceChildren(title, label, key_points(is_reversed ? d.reversed : d.upright));
        slot.classList.add('revealed');
        await sleep(1200);
    }
    if (run !== run_id) return;
    slots_actions.classList.add('show');
    request_oracle(slot_cards, slots.map(s => Boolean(s.dataset.reversed)), slots_oracle);
}

whimsy_btn.addEventListener('click', () => {
    whimsy = !whimsy;
    whimsy_btn.setAttribute('aria-pressed', whimsy);
    pick_section.classList.toggle('whimsy_on', whimsy);
    slots_wrap.hidden = !whimsy;
    reset();
});

let resize_timer;
window.addEventListener('resize', () => {
    clearTimeout(resize_timer);
    resize_timer = setTimeout(() => { if (whimsy && !locked) layout_arch(); }, 150);
});


function reset() {
    run_id++;
    locked = false;
    picked.forEach(card => card.classList.remove('selected'));
    picked = [];
    slot_cards = [null, null, null];
    slots.forEach(clear_slot);
    Array.from(deck_grid.children).forEach(card => card.classList.remove('placed'));
    pick_section.classList.remove('revealing');
    slots_actions.classList.remove('show');
    [result_oracle, slots_oracle].forEach(box => { box.hidden = true; box.replaceChildren(); });
    document.querySelectorAll('.fly_card').forEach(el => el.remove());

    shuffle_deck();
    update_status();
    result_section.hidden = true;
    pick_section.hidden = false;
    layout();
    window.scrollTo({ top: 0 });
}

reset_btn.addEventListener('click', reset);
again_btn.addEventListener('click', reset);
slots_again_btn.addEventListener('click', reset);

shuffle_deck();
update_status();
layout();
