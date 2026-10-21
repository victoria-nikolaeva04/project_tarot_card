// Shared by pages: pause-animations toggle, scroll reveals, count-up stats, progress line.
(function () {
    var reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var html_root = document.documentElement;

    // ---- Pause-Animations toggle ----
    var calm_toggle = document.getElementById('calm-toggle');
    function set_calm(on, save) {
        html_root.classList.toggle('calm', on);
        if (calm_toggle) {
            calm_toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
            calm_toggle.textContent = on ? 'Resume animations' : 'Pause animations';
        }
        if (save) { try { localStorage.setItem('calm', on ? '1' : '0'); } catch (e) {} }
    }
    var saved_calm = null;
    try { saved_calm = localStorage.getItem('calm'); } catch (e) {}
    set_calm(saved_calm === null ? reduce_motion : saved_calm === '1', false);
    if (calm_toggle) calm_toggle.addEventListener('click', function () { set_calm(!html_root.classList.contains('calm'), true); });

    // ---- Reveal on Scroll  ----
    var reveal_items = document.querySelectorAll('.reveal, .line_reveal');
    if ('IntersectionObserver' in window) {
        var reveal_observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add('in'); reveal_observer.unobserve(e.target); }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
        reveal_items.forEach(function (el) { reveal_observer.observe(el); });
    } else {
        reveal_items.forEach(function (el) { el.classList.add('in'); });
    }

    // ---- Count-up Stats ----
    var counter_elements = document.querySelectorAll('[data-count]');
    function count_up(el) {
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
    if (!reduce_motion && 'IntersectionObserver' in window) {
        var counter_observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { count_up(e.target); counter_observer.unobserve(e.target); }
            });
        }, { threshold: 0.6 });
        counter_elements.forEach(function (el) { counter_observer.observe(el); });
    }

    if (reduce_motion) return;

    // ---- Progress line ----
    var frame_queued = false;

    function update_scroll_progress() {
        frame_queued = false;
        var max = html_root.scrollHeight - window.innerHeight;
        html_root.style.setProperty('--sp', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    }

    function on_scroll() {
        if (!frame_queued) { frame_queued = true; requestAnimationFrame(update_scroll_progress); }
    }

    window.addEventListener('scroll', on_scroll, { passive: true });
    window.addEventListener('resize', on_scroll);
    update_scroll_progress();
})();
