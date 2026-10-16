// Landing page: scroll reveals, hero parallax, progress line, count-up stats, word-by-word headline.
(function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var root = document.documentElement;

    // ---- Pause-Animations toggle ----
    var toggle = document.getElementById('calm-toggle');
    function setCalm(on, save) {
        root.classList.toggle('calm', on);
        if (toggle) {
            toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
            toggle.textContent = on ? 'Resume animations' : 'Pause animations';
        }
        if (save) { try { localStorage.setItem('calm', on ? '1' : '0'); } catch (e) {} }
    }
    var saved = null;
    try { saved = localStorage.getItem('calm'); } catch (e) {}
    setCalm(saved === null ? reduce : saved === '1', false);
    if (toggle) toggle.addEventListener('click', function () { setCalm(!root.classList.contains('calm'), true); });

    // ---- Reveal on Scroll  ----
    var items = document.querySelectorAll('.reveal, .line_reveal');
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
        items.forEach(function (el) { io.observe(el); });
    } else {
        items.forEach(function (el) { el.classList.add('in'); });
    }

    // ---- Count-up Stats ----
    var counters = document.querySelectorAll('[data-count]');
    function countUp(el) {
        var target = parseInt(el.getAttribute('data-count'), 10);
        var start = null;
        function tick(t) {
            if (start === null) start = t;
            var k = Math.min(1, (t - start) / 1400);
            el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
            if (k < 1) requestAnimationFrame(tick);
        }
        el.textContent = '0';
        requestAnimationFrame(tick);
    }
    if (!reduce && 'IntersectionObserver' in window) {
        var cio = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); }
            });
        }, { threshold: 0.6 });
        counters.forEach(function (el) { cio.observe(el); });
    }

    if (reduce) return;

    // ---- Headline ----
    var h1 = document.querySelector('.hero_content h1');
    if (h1) {
        var words = h1.textContent.trim().split(/\s+/);
        h1.innerHTML = words.map(function (w, i) {
            return '<span class="w" style="--w:' + i + '">' + w + '</span>';
        }).join(' ');
    }

    // ---- Progress line + Hero drift ----
    var hero = document.querySelector('.hero_section');
    var ticking = false;

    function update() {
        ticking = false;
        var y = window.scrollY;
        var max = root.scrollHeight - window.innerHeight;
        root.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);
        if (hero) {
            var hp = Math.min(1, Math.max(0, y / (hero.offsetHeight * 0.8)));
            hero.style.setProperty('--hp', hp.toFixed(3));
        }
    }

    function onScroll() {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
})();
