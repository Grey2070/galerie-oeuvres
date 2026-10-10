// Public pages: photo enlargement and a soft fade between pages on browsers
// without cross-document view transitions.
(function () {
  'use strict';
  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // Enlarge the photo in place
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.zoom');
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    var img = a.querySelector('img');
    var layer = document.createElement('div');
    layer.className = 'layer lightbox';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', 'Photo agrandie');
    var big = document.createElement('img');
    big.src = a.href; big.alt = img ? img.alt : '';
    layer.appendChild(big);
    document.body.appendChild(layer);
    requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add('on'); }); });
    function close() {
      layer.classList.remove('on');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { layer.remove(); }, reduced ? 0 : 460);
    }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    layer.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
  });

  // Fade-out fallback for internal links
  var nativeVT = 'onpagereveal' in window;
  if (!nativeVT && !reduced) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.classList.contains('zoom') || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.indexOf('/img/') === 0) return;
      e.preventDefault();
      document.body.classList.add('leaving');
      setTimeout(function () { location.href = url.href; }, 300);
    });
    window.addEventListener('pageshow', function () { document.body.classList.remove('leaving'); });
  }
})();
