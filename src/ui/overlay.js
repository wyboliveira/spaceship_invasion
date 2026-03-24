export function hideAllScreens() {
    document.querySelectorAll('.ui-screen').forEach(el => el.classList.add('hidden'));
    document.getElementById('pauseIndicator')?.classList.add('hidden');
}

export function showScreen(screenId) {
    hideAllScreens();
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.remove('hidden');
}

export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

/**
 * Transitional function to show arbitrary HTML in an overlay.
 * We will later refactor this to use static HTML elements.
 */
export function showOverlay(contentHtml) {
    const container = document.getElementById('screen-overlay');
    if (container) {
        container.innerHTML = contentHtml;
        container.classList.remove('hidden');
    }
}

export function hideOverlay() {
    const container = document.getElementById('screen-overlay');
    if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
}
