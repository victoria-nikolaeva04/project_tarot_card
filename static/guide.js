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
