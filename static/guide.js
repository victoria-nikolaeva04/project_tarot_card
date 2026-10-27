const search_input = document.getElementById('global_search');
const tab_buttons = document.querySelectorAll('.tab_btn');
const card_boxes = document.querySelectorAll('.card_box');
let active_category = 'all';

function apply_filters() {
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

        const matches_search = word_pattern.test(name) ||
                              word_pattern.test(arcana) ||
                              word_pattern.test(suit) ||
                              word_pattern.test(element) ||
                              word_pattern.test(sign) ||
                              word_pattern.test(meanings);

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

search_input.addEventListener('input', apply_filters);

tab_buttons.forEach(tab => {
    tab.addEventListener('click', () => {
        // clicking the filter that is already on (the one showing an x) turns it off
        const turning_off = tab.classList.contains('active') && tab.getAttribute('data_category') !== 'all';
        const button = turning_off ? document.querySelector('.tab_btn[data_category="all"]') : tab;

        tab_buttons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');

        active_category = button.getAttribute('data_category');
        apply_filters();
    });
});


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

const modal = document.getElementById('card_modal');
const modal_img = document.getElementById('modal_img');
const modal_sparkles = document.getElementById('modal_sparkles');
let previously_focused = null;

function open_modal(card) {
    previously_focused = document.activeElement;

    const grid_img = card.querySelector('.card_img');
    modal_img.src = grid_img.src;
    modal_img.alt = grid_img.alt;
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
    if (previously_focused) previously_focused.focus();
}

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
    modal_sparkles.appendChild(sparkle);
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

modal.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close_modal));

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
