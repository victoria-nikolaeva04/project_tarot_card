// Filter/Searchbar JS Script
const search_input = document.getElementById('global_search');
const tab_buttons = document.querySelectorAll('.tab_btn');
const card_boxes = document.querySelectorAll('.card_box');
let active_category = 'all';

function execute_universal_filter() {
    const query = search_input.value.toLowerCase().trim();

    // Match the query only at the start of a word
    const escaped_query = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const word_pattern = new RegExp('(^|[^a-z0-9])' + escaped_query);

    card_boxes.forEach(card => {
        const name = card.getAttribute('data_name');
        const arcana = card.getAttribute('data_arcana');
        const suit = card.getAttribute('data_suit');
        const element = card.getAttribute('data_element');
        const sign = card.getAttribute('data_sign');
        const meanings = card.getAttribute('data_meanings');

        // Text Search Check
        const matches_search = word_pattern.test(name) ||
                              word_pattern.test(arcana) ||
                              word_pattern.test(suit) ||
                              word_pattern.test(element) ||
                              word_pattern.test(sign) ||
                              word_pattern.test(meanings);

        // Tab Filter Check
        let matches_category = false;
        if (active_category === 'all') {
            matches_category = true;
        } else if (active_category === 'major' || active_category === 'minor') {
            matches_category = (arcana === active_category);
        } else {
            matches_category = (element === active_category);
        }

        if (matches_search && matches_category) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

// Search Input Event
search_input.addEventListener('input', execute_universal_filter);

// Category Tab Clicking Event
tab_buttons.forEach(button => {
    button.addEventListener('click', () => {
        tab_buttons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        active_category = button.getAttribute('data_category');
        execute_universal_filter();
    });
});


// Flip Position: Invert the card image and swap upright/reversed meaning
card_boxes.forEach(card => {
    const flip_btn = card.querySelector('.flip_btn');
    const img = card.querySelector('.card_img');
    const text = card.querySelector('.meaning_text');
    const label = card.querySelector('.orientation_label');

    flip_btn.addEventListener('click', () => {
        const is_reversed = img.classList.toggle('inverted');
        text.textContent = '"' + (is_reversed ? text.dataset.reversed : text.dataset.upright) + '"';
        label.textContent = is_reversed ? 'Reversed' : 'Upright';
        label.className = 'orientation_label ' + (is_reversed ? 'label_reversed' : 'label_upright');
    });
});

// Card pop-up: open on card click, fill from the card's data attributes
const modal = document.getElementById('card_modal');
const modal_img = document.getElementById('modal_img');
const modal_sparkles = document.getElementById('modal_sparkles');
let last_focus = null;

function open_modal(card) {
    last_focus = document.activeElement;

    const src_img = card.querySelector('.card_img');
    modal_img.src = src_img.src;
    modal_img.alt = src_img.alt;
    modal_img.classList.remove('inverted');

    const badge = card.querySelector('.badge');
    const modal_badge = document.getElementById('modal_badge');
    modal_badge.className = badge.className;
    modal_badge.textContent = badge.textContent;

    const zodiac = card.getAttribute('data_zodiac');
    const modal_zodiac = document.getElementById('modal_zodiac');
    modal_zodiac.textContent = zodiac ? zodiac : '';
    modal_zodiac.hidden = !zodiac;

    document.getElementById('modal_title').textContent = card.getAttribute('data_title');
    document.getElementById('modal_arcana').textContent = card.querySelector('.arcana_type').textContent;
    document.getElementById('modal_upright').textContent = card.getAttribute('data_upright');
    document.getElementById('modal_reversed').textContent = card.getAttribute('data_reversed');
    document.getElementById('modal_love').textContent = card.getAttribute('data_love');
    document.getElementById('modal_career').textContent = card.getAttribute('data_career');

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('open'));
    modal.querySelector('.modal_close').focus();
}

function close_modal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { modal.hidden = true; }, 300);
    if (last_focus) last_focus.focus();
}

// Floating sparkles around the pop-up
for (let i = 0; i < 28; i++) {
    const s = document.createElement('i');
    s.className = 'sparkle';
    s.style.cssText =
        '--x:' + (Math.random() * 100).toFixed(1) + '%;' +
        '--y:' + (Math.random() * 100).toFixed(1) + '%;' +
        '--sz:' + (3 + Math.random() * 6).toFixed(1) + 'px;' +
        '--dur:' + (4 + Math.random() * 5).toFixed(1) + 's;' +
        '--dx:' + (Math.random() * 60 - 30).toFixed(0) + 'px;' +
        '--delay:' + (-Math.random() * 8).toFixed(1) + 's;';
    if (Math.random() < 0.35) s.classList.add('sparkle--gold');
    modal_sparkles.appendChild(s);
}

card_boxes.forEach(card => {
    card.addEventListener('click', e => {
        if (e.target.closest('.flip_btn')) return;
        open_modal(card);
    });
    card.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
            e.preventDefault();
            open_modal(card);
        }
    });
});

modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close_modal));

document.addEventListener('keydown', e => {
    if (modal.hidden) return;
    if (e.key === 'Escape') close_modal();
    if (e.key === 'Tab') {
        const items = modal.querySelectorAll('button');
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
});
