export function showOverlay(html) {
    const ov = document.getElementById('overlay');
    document.getElementById('pauseIndicator').classList.add('hidden');
    ov.innerHTML = html;
    ov.classList.remove('hidden');
}

export function hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
}
