document.addEventListener('DOMContentLoaded', () => {
  const targetUrl = 'https://calendar.google.com';
  const retryBtn = document.getElementById('retry-btn');
  const offlineActions = document.getElementById('offline-actions');
  const spinner = document.querySelector('.spinner');
  const statusText = document.getElementById('status-text');

  function tryRedirect() {
    const isOfflineTest = (window.location.search && window.location.search.includes('offline=true')) || window.__DESKTOP_OFFLINE_TEST__;
    if (isOfflineTest) {
      if (spinner) spinner.style.display = 'none';
      if (statusText) statusText.innerText = 'No internet connection detected.';
      if (offlineActions) offlineActions.style.display = 'flex';
      return;
    }
    if (navigator.onLine) {
      window.location.replace(targetUrl);
    } else {
      if (spinner) spinner.style.display = 'none';
      if (statusText) statusText.innerText = 'No internet connection detected.';
      if (offlineActions) offlineActions.style.display = 'flex';
    }
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (spinner) spinner.style.display = 'block';
      if (statusText) statusText.innerText = 'Connecting to Calendar...';
      if (offlineActions) offlineActions.style.display = 'none';
      setTimeout(tryRedirect, 500);
    });
  }

  tryRedirect();
});
