// Variables
const MAX_PICKS = 3;
const POSITIONS = ['Past', 'Present', 'Future'];
const ARCH_HALF_SPAN = 72;  // degrees either side of the top of the arch
const CARD_RATIO = 1.73;    // card height / width
const ARCH_TOP_MARGIN = 36;  // px above the highest card of the arch
const REVERSED_CHANCE = 0.25;

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
// "Pause animations" (site.js sets .calm on <html>) skips the waits and flights, but the cards still appear
const skip_motion = () => reduce_motion || document.documentElement.classList.contains('calm');
const sleep = ms => new Promise(resolve => setTimeout(resolve, skip_motion() ? 0 : ms));
const cover_src = deck_grid.querySelector('img').src;

let picked = [];                      // classic mode picks
let whimsy = false;                   // arch + shadow spots mode
let slot_cards = [null, null, null];  // whimsy mode: the card in each spot
let locked = false;                   // whimsy mode: the reveal has started
let run_id = 0;                       // cancels a reveal that is still playing after a reset

// Small DOM helpers
function el(tag, class_name, text) {
    const node = document.createElement(tag);
    if (class_name) node.className = class_name;
    if (text !== undefined) node.textContent = text;
    return node;
}

const roll_reversed = () => Math.random() < REVERSED_CHANCE;

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
        ['--a', '--o', '--i'].forEach(property => card.style.removeProperty(property));
        card.style.top = '';
        card.style.zIndex = '';
    });
}

// Whimsy layout: the deck fans out in an arch (extra rows on narrow screens).
// Sizes the cards and arch radius from the deck width, shares the cards between rows in proportion to
// each row's radius, then sets each card's angle (--a), pivot distance (--o) and index (--i) as CSS variables.
function layout_arch() {
    const cards = Array.from(deck_grid.children);
    const card_count = cards.length;
    deck_grid.classList.add('arch');

    const deck_width = deck_grid.clientWidth;
    const rows = deck_width < 560 ? 3 : deck_width < 900 ? 2 : 1;
    const half_span_rad = ARCH_HALF_SPAN * Math.PI / 180;

    let card_width = 70, arch_radius = 0;
    for (let k = 0; k < 2; k++) {
        arch_radius = Math.min(640, (deck_width / 2 - card_width * 0.6) / Math.sin(half_span_rad));
        card_width = Math.max(50, Math.min(92, arch_radius * 0.15));
    }
    const card_height = card_width * CARD_RATIO;
    const row_gap = card_height * 0.5;

    const row_radii = Array.from({ length: rows }, (_, row) => arch_radius - row * row_gap);
    const total_radius = row_radii.reduce((a, b) => a + b, 0);
    const cards_per_row = row_radii.map(row => Math.round(card_count * row / total_radius));
    cards_per_row[0] += card_count - cards_per_row.reduce((a, b) => a + b, 0);

    let card_index = 0;
    cards_per_row.forEach((count, row) => {
        for (let index_in_row = 0; index_in_row < count; index_in_row++, card_index++) {
            const position_along_arch = count > 1 ? index_in_row / (count - 1) : 0.5;
            const angle = -ARCH_HALF_SPAN + 2 * ARCH_HALF_SPAN * position_along_arch;
            const card = cards[card_index];
            card.style.setProperty('--a', angle.toFixed(2) + 'deg');
            card.style.setProperty('--o', (arch_radius - row * row_gap).toFixed(1) + 'px');
            card.style.setProperty('--i', card_index);
            card.style.top = (ARCH_TOP_MARGIN + row * row_gap) + 'px';
            card.style.zIndex = row * 100 + index_in_row;
        }
    });

    let height = 0;
    row_radii.forEach((radius, row) => {
        const edge = ARCH_TOP_MARGIN + arch_radius - (radius - card_height) * Math.cos(half_span_rad) + (card_width / 2) * Math.sin(half_span_rad);
        const middle = ARCH_TOP_MARGIN + row * row_gap + card_height;
        height = Math.max(height, edge, middle);
    });
    deck_grid.style.setProperty('--cw', card_width.toFixed(1) + 'px');
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
    const wrap = el('div', 'key_points');
    text.split(',').map(part => part.trim()).filter(Boolean).forEach(point => {
        wrap.appendChild(el('span', 'key_point', point));
    });
    return wrap;
}

// Card name, orientation label and key points: shared by the classic results and the whimsy spots
function card_caption(card_data, is_reversed) {
    const title = el('h3', 'card_title', card_data.name);
    const label = el('span', 'orientation_label ' + (is_reversed ? 'label_reversed' : 'label_upright'),
                     is_reversed ? 'Reversed' : 'Upright');
    return [title, label, key_points(is_reversed ? card_data.reversed : card_data.upright)];
}

// Fill a paragraph with text, bolding every mention of a drawn card's name
function fill_with_bold_cards(paragraph, text, card_names) {
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
            paragraph.appendChild(strong);
        } else if (part) {
            paragraph.appendChild(document.createTextNode(part));
        }
    });
}

// AI Oracle: waits for a button press so tokens are only spent when the user asks
function offer_oracle(cards, reversed_flags, box) {
    const eyebrow = el('span', 'section_eyebrow', 'The Oracle Awaits');
    const status = el('p', 'oracle_status', 'Would you like the Oracle to interpret your cards?');
    const ask = oracle_button('Ask the Oracle', cards, reversed_flags, box);
    finish_loading(box);
    box.replaceChildren(make_crystal(), oracle_text(eyebrow, status, ask));
    box.hidden = false;
}

// The crystal ball sits beside the Oracle's words
function make_crystal() {
    const crystal = document.createElement('div');
    crystal.className = 'crystal';
    crystal.setAttribute('aria-hidden', 'true');
    crystal.innerHTML = '<span class="orbit"><i></i></span><span class="orbit orbit--slow"><i></i></span>'
        + '<div class="orb"><span class="mist"></span><span class="mist mist--b"></span><span class="glint"></span></div>'
        + '<div class="crystal_base"></div>';
    return crystal;
}

function oracle_text(...children) {
    const text = el('div', 'oracle_text');
    text.append(...children);
    return text;
}

function oracle_button(label, cards, reversed_flags, box) {
    const button = el('button', 'draw-btn oracle_retry', label);
    button.type = 'button';
    button.addEventListener('click', () => request_oracle(cards, reversed_flags, box));
    return button;
}

function finish_loading(box) {
    box.removeAttribute('aria-busy');
    box.classList.remove('loading');
}

// AI Oracle: sends the picked cards to the server and shows the interpretation
async function request_oracle(cards, reversed_flags, box) {
    const run = run_id;
    const eyebrow = el('span', 'section_eyebrow', 'The Oracle Speaks');
    const title = el('h3', '', '');
    const divider = el('div', 'oracle_divider');
    divider.setAttribute('aria-hidden', 'true');
    divider.innerHTML = '<span>✦</span>';
    const crystal = make_crystal();
    const head = [eyebrow, title, divider];
    const status = el('p', 'oracle_status', 'The Oracle is gazing into your cards...');
    box.replaceChildren(crystal, oracle_text(...head, status));
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
                    reversed: reversed_flags[i]
                }))
            })
        });
        const data = await response.json();
        if (run !== run_id) return;
        if (!response.ok) {
            const failure = new Error(data.error);
            failure.sign = data.sign;
            failure.aside = data.aside;
            throw failure;
        }

        const paragraphs = data.reading.split(/\n\s*\n/).map((text, index) => {
            const paragraph = el('p');
            paragraph.style.setProperty('--i', index);
            fill_with_bold_cards(paragraph, text.trim(), cards.map(card => card.dataset.name));
            return paragraph;
        });
        const sign_off = el('span', 'oracle_sign_off', '☾ ✦ ☽');
        sign_off.setAttribute('aria-hidden', 'true');
        sign_off.style.setProperty('--i', paragraphs.length);
        paragraphs.push(sign_off);
        finish_loading(box);
        box.replaceChildren(crystal, oracle_text(...head, ...paragraphs));
    } catch (error) {
        if (run !== run_id) return;
        finish_loading(box);
        status.textContent = error.message || 'The Oracle is silent right now. Please try again in a moment.';
        status.classList.add('oracle_error');
        if (error.sign) {
            // The failure comes with a sign: stand it by the dimmed crystal ball
            const sign = el('div', 'crystal_sign');
            sign.innerHTML = `<span>${error.sign}</span>`;
            status.textContent += ' ' + error.aside;
            crystal.appendChild(sign);
            crystal.classList.add('asleep');
        }
        const retry = oracle_button('Ask the Oracle Again', cards, reversed_flags, box);
        box.replaceChildren(crystal, oracle_text(...head, status, retry));
    }
}

// Results Shown
function build_result(card, index, is_reversed) {
    const card_data = card.dataset;

    const box = el('div', 'card_box result_card');
    const position = el('span', 'position_badge ' + POSITIONS[index].toLowerCase(), POSITIONS[index]);

    const img = el('img', 'card_img' + (is_reversed ? ' inverted' : ''));
    img.src = card_data.image;
    img.alt = card_data.name;

    box.append(position, img, ...card_caption(card_data, is_reversed));
    return box;
}

reveal_btn.addEventListener('click', () => {
    const orientations = picked.map(roll_reversed);
    result_grid.replaceChildren(...picked.map((card, i) => build_result(card, i, orientations[i])));
    pick_section.hidden = true;
    result_section.hidden = false;
    // Stagger the Reveal Animation
    Array.from(result_grid.children).forEach((box, i) => {
        box.style.animationDelay = (i * 0.25) + 's';
    });
    offer_oracle(picked, orientations, result_oracle);
});


// ---------- Whimsy mode ----------

// A picked card flies from the arch into the first empty shadow spot
function place_card(card) {
    const index = slot_cards.indexOf(null);
    if (locked || index === -1 || card.classList.contains('placed')) return;

    const slot = slots[index];
    const well = slot.querySelector('.slot_well');
    const is_reversed = roll_reversed();
    slot.dataset.reversed = is_reversed ? '1' : '';
    slot_cards[index] = card;
    card.classList.add('placed');
    update_status();

    const land = () => {
        fill_slot(slot, card);
        if (slots.every(slot => slot.classList.contains('filled'))) begin_reveal();
    };
    if (skip_motion()) { land(); return; }

    const from = card.getBoundingClientRect();
    const to = well.getBoundingClientRect();
    const card_width = card.offsetWidth, card_height = card.offsetHeight;
    const angle = parseFloat(card.style.getPropertyValue('--a')) || 0;
    const dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    const dy = (to.top + to.height / 2) - (from.top + from.height / 2);

    const fly = el('img', 'fly_card');
    fly.src = cover_src;
    fly.alt = '';
    fly.style.width = card_width + 'px';
    fly.style.height = card_height + 'px';
    fly.style.left = (from.left + from.width / 2 - card_width / 2) + 'px';
    fly.style.top = (from.top + from.height / 2 - card_height / 2) + 'px';
    document.body.appendChild(fly);

    fly.animate([
        { transform: `rotate(${angle}deg) scale(1)` },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${to.width / card_width})` }
    ], { duration: 1100, easing: 'cubic-bezier(0.45, 0.05, 0.2, 1)', fill: 'forwards' })
        .finished.then(() => { fly.remove(); land(); })
        .catch(() => {}); // the flight is cancelled if the reading is reset mid-air
}

// Put a face-down card in the spot, ready to flip
function fill_slot(slot, card) {
    const well = slot.querySelector('.slot_well');
    const card_data = card.dataset;

    const back = el('div', 'face back');
    const back_img = document.createElement('img');
    back_img.src = cover_src;
    back_img.alt = 'Face-down tarot card';
    back.appendChild(back_img);

    const front = el('div', 'face front');
    const front_img = document.createElement('img');
    front_img.src = card_data.image;
    front_img.alt = card_data.name;
    if (slot.dataset.reversed) front_img.classList.add('inverted');
    front.appendChild(front_img);

    const flipper = el('div', 'flipper');
    flipper.append(back, front);

    const remove = el('button', 'slot_remove', '✕');
    remove.type = 'button';
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
    slots.forEach(slot => slot.querySelector('.slot_remove')?.remove());

    await sleep(300);
    if (run !== run_id) return;
    pick_section.classList.add('revealing');

    // Let the deck finish folding away before scrolling, so the page isn't moving while it reflows
    await sleep(850);
    if (run !== run_id) return;
    slots_wrap.scrollIntoView({ behavior: skip_motion() ? 'auto' : 'smooth', block: 'center' });

    await sleep(600);
    for (let i = 0; i < slots.length; i++) {
        if (run !== run_id) return;
        const slot = slots[i];
        const card_data = slot_cards[i].dataset;
        const is_reversed = Boolean(slot.dataset.reversed);

        slot.querySelector('.flipper').classList.add('flipped');
        await sleep(900);
        if (run !== run_id) return;

        slot.querySelector('.slot_caption').replaceChildren(...card_caption(card_data, is_reversed));
        slot.classList.add('revealed');
        await sleep(500);
    }
    if (run !== run_id) return;
    pick_status.classList.add('done');
    slots_actions.classList.add('show');
    offer_oracle(slot_cards, slots.map(slot => Boolean(slot.dataset.reversed)), slots_oracle);
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
    pick_status.classList.remove('done');
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
