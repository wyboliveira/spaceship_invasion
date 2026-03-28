# Efeitos Sonoros (SFX)

Coloque os arquivos de SFX aqui. O AudioManager tenta `.ogg` primeiro e `.wav` como fallback.

| Arquivo              | Quando toca                                   |
|----------------------|-----------------------------------------------|
| `shoot.wav`          | Jogador atira                                 |
| `enemy_die.wav`      | Inimigo destruído                             |
| `player_hit.wav`     | Jogador leva dano                             |
| `drop_collect.wav`   | Drop coletado (arma ou coração)               |
| `boss_spawn.wav`     | Boss entra na tela (intro)                    |
| `boss_defeated.wav`  | Boss é derrotado                              |
| `wave_clear.wav`     | Wave concluída com sucesso                    |
| `game_over.wav`      | Derrota (jingle curto de game over)           |
| `normal_button.wav`  | Clique em qualquer botão do menu/diálogos     |
| `cancel_button.wav`  | Clique em botão de cancelamento de ação       |

## Observações

- **`boss_spawn`** → toca quando o boss *aparece* (após eliminar todos os inimigos da wave)
- **`boss_defeated`** → toca quando o HP do boss chega a zero
- **`normal_button`** → dispara em todos os botões, exceto Google Auth e Github Auth
- **`cancel_button`** → botão "CANCELAR" nos diálogos de confirmação (reinício, logout, zerar histórico)

## Trocar um SFX

Substitua o arquivo pelo novo com o **mesmo nome**. Nenhum código precisa ser alterado.
Para usar outro nome de arquivo: edite `src/audio/audioConfig.js` → campo `src` do SFX correspondente.

## Ferramentas para gerar SFX retrô gratuitas

- **jsfxr** (8-bit no browser, exporta .wav): https://sfxr.me
- **ZzFX** (parâmetros programáticos): https://killedbyapixel.github.io/ZzFX/
- **Kenney.nl** (packs CC0 prontos): https://kenney.nl/assets/category:Audio
