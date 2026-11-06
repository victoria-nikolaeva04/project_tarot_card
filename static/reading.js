const MAX_PICKS = 3;
const POSITIONS = ['Past', 'Present', 'Future'];
const ARCH_HALF_SPAN = 72;  // degrees either side of the top of the arch
const CARD_RATIO = 1.73;  // card height / width
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
const oracle_btn = document.getElementById('oracle_btn');
const slots_oracle_btn = document.getElementById('slots_oracle_btn');
const oracle_modal = document.getElementById('oracle_modal');
const oracle_crystal = document.getElementById('oracle_crystal');
const oracle_wait = document.getElementById('oracle_wait');
const oracle_panel = document.getElementById('oracle_panel');
const oracle_reading = document.getElementById('oracle_reading');
const oracle_sparkles = document.getElementById('oracle_sparkles');

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

function el(tag, class_name, text) {
    const node = document.createElement(tag);
    if (class_name) node.className = class_name;
    if (text !== undefined) node.textContent = text;
    return node;
}

const roll_reversed = () => Math.random() < REVERSED_CHANCE;

function shuffle_deck() {
    const cards = Array.from(deck_grid.children);
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards.forEach(card => deck_grid.appendChild(card));
}

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
            ? '' // blank, not removed: the line keeps its height until the reveal folds it away
            : `Choose ${MAX_PICKS} cards from the arch (${filled}/${MAX_PICKS})`;
        deck_grid.classList.remove('deck_full');
        return;
    }
    pick_status.textContent = picked.length === MAX_PICKS
        ? 'Your 3 cards are chosen.'
        : `Choose ${MAX_PICKS} cards that call to you (${picked.length}/${MAX_PICKS})`;
    reveal_btn.disabled = picked.length !== MAX_PICKS;
    deck_grid.classList.toggle('deck_full', picked.length === MAX_PICKS);
}

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

function key_points(text) {
    const wrap = el('div', 'key_points');
    text.split(',').map(part => part.trim()).filter(Boolean).forEach(point => {
        wrap.appendChild(el('span', 'key_point', point));
    });
    return wrap;
}

function card_caption(card_data, is_reversed) {
    const title = el('h3', 'card_title', card_data.name);
    const label = el('span', 'orientation_label ' + (is_reversed ? 'label_reversed' : 'label_upright'),
                     is_reversed ? 'Reversed' : 'Upright');
    return [title, label, key_points(is_reversed ? card_data.reversed : card_data.upright)];
}

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

// AI Oracle: only runs when the user presses "Ask the Oracle", so tokens are only spent on request
function make_crystal() {
    const crystal = document.createElement('div');
    crystal.className = 'crystal';
    crystal.setAttribute('aria-hidden', 'true');
    crystal.innerHTML = '<span class="orbit"><i></i></span><span class="orbit orbit--slow"><i></i></span>'
        + '<div class="orb"><span class="mist"></span><span class="mist mist--b"></span><span class="glint"></span></div>'
        + '<div class="crystal_base"></div>';
    return crystal;
}

let current_reading = null;  // { cards, flags } of the spread on the table
let oracle_job = null;       // { key, promise } the request for that spread, kept so closing the pop-up never loses it
let oracle_shown = 0;        // bumps on every open/close so a late answer never lands in a closed pop-up
let oracle_prev_focus = null;

for (let i = 0; i < 28; i++) {
    const sparkle = document.createElement('i');
    sparkle.className = 'sparkle';
    sparkle.style.cssText =
        '--x:' + (Math.random() * 100).toFixed(1) + '%;' +
        '--y:' + (Math.random() * 100).toFixed(1) + '%;' +
        '--sz:' + (3 + Math.random() * 6).toFixed(1) + 'px;' +
        '--dur:' + (4 + Math.random() * 5).toFixed(1) + 's;' +
        '--dx:' + (Math.random() * 60 - 30).toFixed(0) + 'px;' +
        '--delay:' + (-Math.random() * 8).toFixed(1) + 's;';
    if (Math.random() < 0.35) sparkle.classList.add('sparkle--gold');
    oracle_sparkles.appendChild(sparkle);
}

async function fetch_oracle(cards, reversed_flags) {
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
    // The host can answer with an HTML error page (timeouts, gateway errors) instead of JSON
    const data = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.reading !== 'string') {
        const failure = new Error(data.error);
        failure.sign = data.sign;
        failure.aside = data.aside;
        throw failure;
    }
    return data.reading;
}

function card_figure(card, is_reversed, index) {
    const figure = el('figure', 'oracle_card');
    const img = el('img', is_reversed ? 'inverted' : '');
    img.src = card.dataset.image;
    img.alt = card.dataset.name + (is_reversed ? ' (reversed)' : '');
    const caption = el('figcaption');
    caption.append(el('span', 'oracle_card_pos', POSITIONS[index]));
    figure.title = card.dataset.name;
    figure.append(img, caption);
    return figure;
}

function spread_row(cards, flags) {
    const row = el('div', 'oracle_cards');
    cards.forEach((card, i) => row.appendChild(card_figure(card, flags[i], i)));
    return row;
}

function download_reading(text, cards, flags) {
    const today = new Date();
    const stamp = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const lines = [
        'Arcana Noctis - Daily Reading',
        stamp,
        '',
        ...cards.map((card, i) => `${POSITIONS[i]}: ${card.dataset.name} (${flags[i] ? 'Reversed' : 'Upright'})`),
        '',
        text.trim(),
        '',
        'The cards reflect, they do not decide.',
        ''
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tarot-reading-${stamp}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function reading_nodes(text, cards, flags) {
    const eyebrow = el('span', 'section_eyebrow', 'The Oracle Speaks');
    const title = el('h3', '', 'Your Reading');
    title.id = 'oracle_title';
    const divider = el('div', 'oracle_divider');
    divider.setAttribute('aria-hidden', 'true');
    divider.innerHTML = '<span>✦</span>';

    const paragraphs = text.split(/\n\s*\n/).map((part, index) => {
        const paragraph = el('p');
        paragraph.style.setProperty('--i', index);
        fill_with_bold_cards(paragraph, part.trim(), cards.map(card => card.dataset.name));
        return paragraph;
    });
    const sign_off = el('span', 'oracle_sign_off', '☾ ✦ ☽');
    sign_off.setAttribute('aria-hidden', 'true');
    sign_off.style.setProperty('--i', paragraphs.length);
    // an icon beside the close button; the tooltip comes from data-tip
    const save = el('button', 'oracle_download');
    save.type = 'button';
    save.dataset.tip = 'Download.txt';
    save.setAttribute('aria-label', 'Download reading as a .txt file');
    save.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>';
    save.addEventListener('click', () => download_reading(text, cards, flags));
    return [eyebrow, title, divider, ...paragraphs, sign_off, save];
}

function error_nodes(error, crystal) {
    const eyebrow = el('span', 'section_eyebrow', 'The Oracle Is Silent');
    const title = el('h3', '', 'Your Reading');
    title.id = 'oracle_title';
    const status = el('p', 'oracle_status oracle_error',
                      error.message || 'The Oracle is silent right now. Please try again in a moment.');
    if (error.sign) {
        // The failure comes with a sign: stand it by the dimmed crystal ball
        const sign = el('div', 'crystal_sign');
        sign.innerHTML = `<span>${error.sign}</span>`;
        status.textContent += ' ' + error.aside;
        crystal.appendChild(sign);
        crystal.classList.add('asleep');
    }
    const retry = el('button', 'draw-btn oracle_retry', 'Ask the Oracle Again');
    retry.type = 'button';
    retry.addEventListener('click', () => { oracle_job = null; open_oracle(); });
    return [eyebrow, title, status, retry];
}

// The ball glides from the middle of the screen into the dialog's left side as the reading opens
function show_answer(nodes, crystal, spread) {
    const first = crystal.getBoundingClientRect();
    oracle_reading.replaceChildren(...nodes);
    oracle_modal.classList.remove('loading');
    oracle_modal.classList.add('answered');
    oracle_modal.removeAttribute('aria-busy');
    oracle_wait.hidden = true;
    oracle_panel.hidden = false;
    // the ball settles into the dialog's left column, with the spread beneath it
    const side = el('div', 'oracle_side');
    side.append(oracle_crystal);
    if (spread) side.append(spread);
    oracle_panel.prepend(side);
    oracle_modal.scrollTop = 0;
    oracle_panel.querySelector('.oracle_close').focus({ preventScroll: true });

    if (skip_motion()) return;
    const last = crystal.getBoundingClientRect();
    crystal.animate([
        { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width})` },
        { transform: 'none' }
    ], { duration: 900, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
}

function open_oracle() {
    if (!current_reading) return;
    const { cards, flags } = current_reading;
    const shown = ++oracle_shown;
    if (oracle_modal.hidden) oracle_prev_focus = document.activeElement;

    const crystal = make_crystal();
    oracle_panel.querySelector('.oracle_side')?.remove();
    oracle_modal.querySelector('.oracle_stage').prepend(oracle_crystal); // back in the middle while loading
    oracle_crystal.replaceChildren(crystal);
    oracle_reading.replaceChildren();
    oracle_panel.hidden = true;
    oracle_wait.hidden = false;
    oracle_modal.classList.remove('answered');
    oracle_modal.classList.add('loading');
    oracle_modal.setAttribute('aria-busy', 'true');
    oracle_modal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => oracle_modal.classList.add('open'));

    const key = cards.map((card, i) => card.dataset.name + flags[i]).join('|');
    if (!oracle_job || oracle_job.key !== key) {
        oracle_job = { key, promise: fetch_oracle(cards, flags) };
    }
    const job = oracle_job;

    job.promise.then(text => {
        if (shown !== oracle_shown) return;
        show_answer(reading_nodes(text, cards, flags), crystal, spread_row(cards, flags));
    }, error => {
        if (oracle_job === job) oracle_job = null; // a failed request is never reused
        if (shown !== oracle_shown) return;
        show_answer(error_nodes(error, crystal), crystal);
    });
}

function close_oracle() {
    if (oracle_modal.hidden) return;
    oracle_shown++;
    oracle_modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (!oracle_modal.classList.contains('open')) oracle_modal.hidden = true;
    }, skip_motion() ? 0 : 300);
    if (oracle_prev_focus) oracle_prev_focus.focus();
}

oracle_modal.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close_oracle));
oracle_btn.addEventListener('click', open_oracle);
slots_oracle_btn.addEventListener('click', open_oracle);

document.addEventListener('keydown', event => {
    if (oracle_modal.hidden) return;
    if (event.key === 'Escape') close_oracle();
    if (event.key === 'Tab') {
        const items = Array.from(oracle_modal.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        if (!items.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
});

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
    window.scrollTo({ top: 0, behavior: skip_motion() ? 'auto' : 'smooth' });
    Array.from(result_grid.children).forEach((box, i) => {
        box.style.animationDelay = (i * 0.25) + 's';
    });
    current_reading = { cards: picked.slice(), flags: orientations };
});



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
    // Placed in page coordinates (not fixed to the window), so scrolling mid-flight carries it with the page
    fly.style.left = (from.left + window.scrollX + from.width / 2 - card_width / 2) + 'px';
    fly.style.top = (from.top + window.scrollY + from.height / 2 - card_height / 2) + 'px';
    document.body.appendChild(fly);

    fly.animate([
        { transform: `rotate(${angle}deg) scale(1)` },
        { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${to.width / card_width})` }
    ], { duration: 1100, easing: 'cubic-bezier(0.45, 0.05, 0.2, 1)', fill: 'forwards' })
        .finished.then(() => { fly.remove(); land(); })
        .catch(() => {}); // the flight is cancelled if the reading is reset mid-air
}

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

function unplace(slot) {
    if (locked) return;
    const index = slots.indexOf(slot);
    slot_cards[index].classList.remove('placed');
    slot_cards[index] = null;
    clear_slot(slot);
    update_status();
}

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
    window.scrollTo({ top: 0, behavior: skip_motion() ? 'auto' : 'smooth' });

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
    current_reading = { cards: slot_cards.slice(), flags: slots.map(slot => Boolean(slot.dataset.reversed)) };
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
    current_reading = null;
    oracle_job = null;
    oracle_shown++;
    oracle_modal.hidden = true;
    oracle_modal.classList.remove('open');
    document.body.style.overflow = '';
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
