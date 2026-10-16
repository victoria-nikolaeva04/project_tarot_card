// Variables
const MAX_PICKS = 3;
const POSITIONS = ['Past', 'Present', 'Future'];

const deck_grid = document.getElementById('deck_grid');
const pick_section = document.getElementById('pick_section');
const result_section = document.getElementById('result_section');
const result_grid = document.getElementById('result_grid');
const pick_status = document.getElementById('pick_status');
const reveal_btn = document.getElementById('reveal_btn');
const reset_btn = document.getElementById('reset_btn');
const again_btn = document.getElementById('again_btn');

let picked = [];

// Randomize the Deck
function shuffle_deck() {
    const cards = Array.from(deck_grid.children);
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    cards.forEach(card => deck_grid.appendChild(card));
}

function update_status() {
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

// Results Shown
function build_result(card, index) {
    const is_reversed = Math.random() < 0.25;
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
    result_grid.replaceChildren(...picked.map(build_result));
    pick_section.hidden = true;
    result_section.hidden = false;
    // Stagger the Reveal Animation
    Array.from(result_grid.children).forEach((box, i) => {
        box.style.animationDelay = (i * 0.25) + 's';
    });
});

function reset() {
    picked.forEach(card => card.classList.remove('selected'));
    picked = [];
    shuffle_deck();
    update_status();
    result_section.hidden = true;
    pick_section.hidden = false;
    window.scrollTo({ top: 0 });
}

reset_btn.addEventListener('click', reset);
again_btn.addEventListener('click', reset);

shuffle_deck();
update_status();
