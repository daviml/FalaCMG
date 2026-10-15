# FalaCMG

Voz, chat com imagens e transmissão de tela entre amigos, direto de PC para PC (WebRTC P2P).
Sem servidor próprio, sem conta e sem histórico. Os relays Nostr públicos só ajudam os participantes a se encontrarem.

O mesmo código roda em dois lugares:

| | App do Windows (Electron) | Versão web (navegador) |
|---|---|---|
| Aperte-para-falar | Global (funciona dentro do jogo) | Só com a aba em foco |
| Som na transmissão | Qualquer janela ou tela | Só tela inteira ou aba (Chrome/Edge) |
| Instalação | Portátil, ZIP ou instalador | Nenhuma |

## Desenvolvimento

```bash
npm install
npm run dev        # app do Windows
npm run dev:b      # segunda instância (outro perfil) para testar no mesmo PC
npm run dev:web    # versão web em http://localhost:5173/app/
npm run typecheck
```

## Gerar o app do Windows

```bash
npm run dist       # instalador + portátil + ZIP em dist/
```

Em PCs com política que bloqueia executáveis novos sem assinatura, o instalador (NSIS) falha ao gerar o desinstalador.
Nesse caso, gere só o portátil e o ZIP com `npx electron-builder --win portable zip --x64`, ou use o GitHub Actions
(`.github/workflows/release.yml`).

## Publicar a versão web (Vercel, grátis)

O site fica em `web-dist/`: landing em `/`, página de convite em `/convite/` e o app em `/app/`.

```bash
npm run build:web
npm run preview:web   # http://localhost:4173 (igual ao Vercel)
```

No Vercel, importe o repositório: o `vercel.json` já define o build. Variáveis de ambiente opcionais:

- `FALACMG_DOWNLOAD_URL`: link do download para Windows, por exemplo a página de Releases do GitHub. Sem ela, o botão mostra "Download em breve".
- `VITE_PUBLIC_URL`: endereço do site. No Vercel é detectado sozinho.

Para os convites do **app do Windows** também abrirem a página do site, gere o app com o endereço do site:

```bash
VITE_PUBLIC_URL=https://seu-site.vercel.app npm run dist
```

Sem isso, o app do Windows gera convites `falacmg://`, que só abrem em quem tem o app instalado.
