export function showOverlay(html) {
    const ov = document.getElementById('overlay');
    ov.innerHTML = html;
    ov.classList.remove('hidden');
}

export function hideOverlay() {
    document.getElementById('overlay').classList.add('hidden');
}
