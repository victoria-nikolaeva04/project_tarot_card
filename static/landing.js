// Landing page only: word-by-word headline and hero drift on scroll.
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ---- Headline ----
    var h1 = document.querySelector('.hero_content h1');
    if (h1) {
        var words = h1.textContent.trim().split(/\s+/);
        h1.innerHTML = words.map(function (w, i) {
            return '<span class="w" style="--w:' + i + '">' + w + '</span>';
        }).join(' ');
    }

    // ---- Hero drift ----
    var hero = document.querySelector('.hero_section');
    if (!hero) return;
    var ticking = false;

    function update() {
        ticking = false;
        var hp = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.8)));
        hero.style.setProperty('--hp', hp.toFixed(3));
    }

    function onScroll() {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
})();
