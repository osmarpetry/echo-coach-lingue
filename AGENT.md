# Dependabot major-version migration (2026-09-06/07)

Contexto: `.github` central faz automerge via job `dependabot` em
`osmarpetry/.github/.github/workflows/node.yml@main`, condicionado a
`github.actor == 'dependabot[bot]'`.

## Migrado com sucesso (código real ajustado, build verde, push feito na branch do PR)

- **react-day-picker 8.10.1 -> 10.0.1** (PR #6): `src/app/components/ui/calendar.tsx`
  migrado pra API nova (v9+): `classNames` trocou chaves (`table`->`month_grid`,
  `head_row`->`weekdays`, `cell`->`day`, `day`->`day_button`, `day_selected`->`selected`,
  etc.) e `components.IconLeft/IconRight` virou um único `components.Chevron` com prop
  `orientation`. Nota: esse componente `Calendar` não é importado em lugar nenhum do app
  hoje (dead code do scaffold shadcn) — migrei mesmo assim pra não deixar API quebrada
  parada no repo.
- **vite 6.3.5 -> 8.2.2** (PR #8): sem breaking change real pro projeto (config simples,
  sem `manualChunks`/sass/`transformIndexHtml`). Troquei `__dirname` por
  `import.meta.dirname` em `vite.config.ts` (novo config loader nativo do Vite 8 avisa
  que `__dirname` fica deprecado).
- **date-fns 3.6.0 -> 4.4.0** (PR #3): dependência não importada em lugar nenhum do
  `src/` hoje — só bump + lockfile.
- **motion 12.23.24 -> 13.2.0** (PR #7): idem, não importada em `src/` hoje.
- **react-router 7.13.0 -> 8.3.1** (PR #4): idem, não importada em `src/` hoje.
- **lucide-react 0.487.0 -> 1.40.0** (PR #5): usada em 22 arquivos, build limpo, nenhum
  ícone quebrado/renomeado detectado.
- **npm group, 34 updates minor/patch** (PR #1): radix-ui, tailwindcss 4.1->4.3,
  react-hook-form, sonner, tailwind-merge, etc. Sem mudança de código, build verde.

## Adiado (COMPLICADO)

- **@vitejs/plugin-react 4.7.0 -> 6.1.1** (PR #2): incompatível de verdade com o
  `vite@6.3.5` que está em main hoje. `plugin-react@6.1.1` importa o subpath
  `vite/internal`, que só existe no exports map do Vite 8 (motor Rolldown/Oxc); build
  quebra com `ERR_PACKAGE_PATH_NOT_EXPORTED`. Peer dependency confirma:
  `plugin-react@6.1.1` exige `vite ^8.0.0`, `plugin-react@4.7.0` só vai até `^7.0.0`.
  Comentei no PR #2 com `@dependabot ignore this major version` e expliquei o motivo.
  **Retomar depois que o PR #8 (vite 8.2.2) estiver mergeado em main** — só então
  remover o ignore e re-tentar essa bump isoladamente (ou nascer um novo PR do
  dependabot já compatível).

## Decisão técnica não-óbvia

Nenhum teto de versão foi imposto além do caso acima (plugin-react preso em 4.x até
vite 8 estar em main). As demais bumps não exigiram pin.

## Problema descoberto: automerge não dispara depois de um push manual

O job `dependabot` do CI central é gated por `github.actor == 'dependabot[bot]'`.
Ao dar `git push` numa branch de PR do Dependabot como usuário humano (necessário
pra migrar código de verdade, já que o próprio Dependabot só bumps versão em
`package.json`/lockfile), o evento `synchronize` do PR passa a ter
`github.actor` = o humano que fez push, não mais `dependabot[bot]`. Resultado: o job
`dependabot` (automerge) roda como `SKIPPED` mesmo com o `build` verde.

Status ao final desta sessão: PRs #1, #3, #4, #5, #6, #7, #8 estão com CI verde
(`build / build` = SUCCESS) e `mergeStateStatus: CLEAN`, mas **não foram mergeados**
— tentativa de `gh pr merge --squash` foi bloqueada pelo classifier de permissões do
agente (ação sensível, requer decisão humana). PR #2 fica aberto de propósito
(ignore major version já pedido ao Dependabot).

### Próximos passos sugeridos

1. Rodar `gh pr merge --squash <n>` manualmente para os PRs #1, #3, #4, #5, #6, #7, #8
   (nessa ordem ou qualquer ordem — não há dependência entre eles, exceto que #8 deve
   entrar antes de reabrir uma nova bump do `@vitejs/plugin-react`).
2. Se esse padrão (push humano em PR do Dependabot) for recorrente, considerar ajustar
   a condição do job `dependabot` em `osmarpetry/.github` pra checar
   `github.event.pull_request.user.login == 'dependabot[bot]'` em vez de
   `github.actor` — isso sobrevive a pushes de terceiros na mesma branch. (Fora do
   escopo desta sessão: não mexi em `osmarpetry/.github` por instrução explícita.)
3. Depois do PR #8 mergeado, remover o `ignore` do `@vitejs/plugin-react` no
   `dependabot.yml` (ou comentar `@dependabot unignore` no próximo PR que ele abrir)
   e re-rodar a migração — deve ser trivial nessa hora (só bump, sem breaking change
   de código já que o vite 8 já vai estar em main).
