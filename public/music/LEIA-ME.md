# Músicas do Jogo

Coloque os arquivos de música aqui. O AudioManager tenta `.ogg` primeiro e `.mp3` como fallback.

| Arquivo         | Quando toca                         | Loop |
|-----------------|-------------------------------------|------|
| `menu.ogg`      | Tela inicial / menu                 | sim  |
| `gameplay.ogg`  | Waves normais — toca continuamente  | sim  |
| `boss.ogg`      | Wave de boss (10, 20, 30...)        | sim  |

## Comportamento por estado de jogo

| Estado       | Música                                                  |
|--------------|---------------------------------------------------------|
| Menu         | `menu` toca em loop                                     |
| Gameplay     | `gameplay` toca em loop (persiste entre waves normais)  |
| Boss wave    | Crossfade de `gameplay` → `boss` quando o boss surge    |
| Pause        | Volume reduzido a 15% (duck); restaurado ao retomar     |
| Wave end     | Normal: `gameplay` continua. Após boss: fade-out        |
| Game over    | Volume reduzido a 15% (duck) — sem trilha separada      |
| Retry        | `gameplay` reinicia do início                           |
| Volta ao menu| Crossfade de volta para `menu`                          |

## Observações

- **Não é necessário um arquivo `game_over`** — o game over reutiliza a música ativa
  com volume reduzido, exatamente como o pause, para não quebrar a imersão.
- A música de `gameplay` toca de forma contínua e não reinicia a cada wave.
  Só é interrompida ao entrar numa boss wave ou voltar ao menu.

## Dicas de formato

- Use `.ogg` para melhor compressão. Coloque o `.mp3` como fallback com o mesmo nome base.
- Para converter: `ffmpeg -i entrada.mp3 saida.ogg`
- Certifique-se que as trilhas têm **loop points** bem marcados (início e fim sem clique/pop).

## Trocar uma música

Substitua o arquivo pelo novo com o **mesmo nome**. Nenhum código precisa ser alterado.
Para usar outro nome de arquivo: edite `src/audio/audioConfig.js` → campo `src` da música correspondente.
