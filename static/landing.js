// Landing page only: word-by-word headline and hero drift on scroll.
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ---- Headline ----
    var h1 = document.querySelector('.hero_content h1');
    if (h1) {
        var words = h1.textContent.trim().split(/\s+/);
        h1.innerHTML = words.map(function (w, i) {
            var glow = /^illuminate$/i.test(w) ? ' glow' : '';
            return '<span class="w' + glow + '" style="--w:' + i + '">' + w + '</span>';
        }).join(' ');
    }

    // ---- Hero drift ----
    var hero = document.querySelector('.hero_section');
    if (!hero) return;
    var frame_queued = false;

    function update_hero_drift() {
        frame_queued = false;
        var hero_progress = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.8)));
        hero.style.setProperty('--hp', hero_progress.toFixed(3));
    }

    function on_scroll() {
        if (!frame_queued) { frame_queued = true; requestAnimationFrame(update_hero_drift); }
    }

    window.addEventListener('scroll', on_scroll, { passive: true });
    window.addEventListener('resize', on_scroll);
    update_hero_drift();
})();
