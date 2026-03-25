import { state } from '../game/state.js';

/**
 * Atualiza os elementos da interface (Heads-Up Display) com base no estado global.
 * Gerencia a exibição de pontuação, onda atual, vidas e nome do usuário.
 * Identifica se o usuário está logado ou jogando como GUEST.
 */
export function updateHUD() {
    try {
        const scoreEl = document.getElementById('scoreDisplay');
        const waveEl  = document.getElementById('waveDisplay');

        if (scoreEl) scoreEl.textContent = String(state.score).padStart(6, '0');
        if (waveEl)  waveEl.textContent  = String(state.wave || 0).padStart(2, '0');

        const livesEl = document.getElementById('livesDisplay');
        if (livesEl) {
            const livesCount = Math.max(0, state.lives || 0);
            livesEl.textContent = Array(livesCount).fill('♦').join(' ') || '—';
        }

        const userEl = document.getElementById('userDisplay');
        if (userEl) {
            const username = state.session
              ? (state.userProfile?.username || state.session.user.email.split('@')[0])
              : 'GUEST';
            userEl.textContent = username;
        }

        // Botão de edição só aparece quando há sessão ativa
        const wrapper = document.getElementById('userDisplayWrapper');
        if (wrapper) {
            wrapper.classList.toggle('no-session', !state.session);
        }
    } catch (err) {
        console.error('[HUD] Error updating UI elements:', err);
    }
}

/**
 * Inicializa o botão de edição inline de username no HUD.
 * Deve ser chamado uma única vez durante o boot.
 *
 * @param {Function} onSave — async (username: string) => void
 *   Callback que persiste o novo nome (localStorage + Supabase).
 */
export function initUsernameEdit(onSave) {
    const wrapper = document.getElementById('userDisplayWrapper');
    const display = document.getElementById('userDisplay');
    const editBtn = document.getElementById('editUsernameBtn');
    if (!wrapper || !display || !editBtn) return;

    editBtn.addEventListener('click', () => {
        if (!state.session) return;
        // Não abre o editor se já estiver aberto
        if (wrapper.querySelector('.hud-username-input')) return;

        const current = display.textContent;

        const input = document.createElement('input');
        input.className  = 'hud-username-input';
        input.value      = current;
        input.maxLength  = 20;
        input.spellcheck = false;

        display.style.display = 'none';
        editBtn.style.display = 'none';
        wrapper.appendChild(input);
        input.focus();
        input.select();

        let _committed = false;

        const cleanup = () => {
            input.remove();
            display.style.display = '';
            editBtn.style.display = '';
        };

        const save = async () => {
            if (_committed) return;
            _committed = true;
            const newName = input.value.trim();
            if (newName && newName !== current && newName.length >= 2) {
                await onSave(newName);
            }
            cleanup();
            // Devolve o foco ao botão de start para que Enter inicie o jogo em seguida
            document.getElementById('startBtn')?.focus();
        };

        const cancel = () => {
            if (_committed) return;
            cleanup();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')  { e.preventDefault(); save(); }
            if (e.key === 'Escape') cancel();
        });
        // Clicar fora cancela (sem salvar)
        input.addEventListener('blur', cancel);
    });
}
