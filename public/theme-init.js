// Runs before the first paint so the stored theme never flashes; external so the CSP can forbid inline scripts.
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem('smartcattle.theme') || 'null');
    document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light');
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
