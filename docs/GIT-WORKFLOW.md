# Flujo de ramas y versionado

Guía de uso del versionado automático del repo: cómo trabajar día a día, cómo escribir los commits y qué hacer cuando algo no sale como esperabas. El porqué de la elección está en [ADR-024](DECISIONS.md#adr-024-versionado-automático-con-semantic-release).

## En una línea

Trabajás en una rama propia, hacés PR a `develop` y al mergear sale una **beta** (`v1.2.0-beta.1`). Cuando `develop` está listo, PR a `main` y al mergear sale la **estable** (`v1.2.0`). El número lo calcula [semantic-release](https://semantic-release.gitbook.io/) a partir de los mensajes de commit; nadie lo edita a mano.

## Ramas

| Rama            | Rol                                                                                                                       | Versión que genera                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `main`          | Producción. Recibe merges desde `develop` (y hotfixes).                                                                   | Estable: `v1.2.0`                        |
| `develop`       | Integración. Recibe los PR de las ramas de trabajo.                                                                       | Prerelease: `v1.2.0-beta.1`, `beta.2`, … |
| rama de trabajo | Una por desarrollo. Nombre libre y descriptivo (`config-vitest`, `modulo-experience`). Sale de `develop` y vuelve por PR. | Ninguna                                  |

```
rama de trabajo ──PR──▶ develop ──PR──▶ main
                           │              │
                    v1.2.0-beta.N      v1.2.0
                           ▲              │
                           └── back-merge ┘
```

## Ciclo de trabajo paso a paso

### 1. Empezar un desarrollo

```bash
git switch develop
git pull
git switch -c modulo-experience
```

### 2. Commitear

Cada commit sigue [Conventional Commits](#cómo-escribir-los-commits). El hook `commit-msg` lo valida al momento:

```bash
git add .
git commit -m "feat: add experience CRUD endpoints"
```

Antes de cada commit corre el hook `pre-commit`: [lint-staged](../.lintstagedrc.json) pasa ESLint (`--fix`) y Prettier **solo sobre los archivos stageados**, y después `yarn typecheck` sobre todo el proyecto. Si ESLint encuentra un error que no puede corregir solo, el commit se cancela y tus archivos quedan como estaban. Antes de cada push corre `yarn test:coverage` (hook `pre-push`).

### 3. Abrir el PR a `develop`

```bash
git push -u origin modulo-experience
gh pr create --base develop --fill
```

En el PR corre el CI: `format:check`, `lint`, `typecheck`, `test:coverage` y `build`. Si falla, no se mergea.

### 4. Mergear a `develop` → sale una beta

Al mergear, el CI vuelve a verificar y corre semantic-release. Si hay algún `feat:` o `fix:` nuevo, publica una beta: tag `v1.2.0-beta.N` + GitHub Release marcada como _pre-release_.

Estrategia de merge:

- **Merge commit**: se conservan todos tus commits, y cada uno cuenta para la versión.
- **Squash**: queda un solo commit cuyo mensaje es **el título del PR**. Entonces el título tiene que respetar el formato (`feat: add experience module`). commitlint no revisa títulos de PR, así que eso queda a tu cargo.

Después, borrá la rama de trabajo (GitHub lo ofrece con un botón) y localmente:

```bash
git switch develop
git pull
git branch -d modulo-experience
```

### 5. Pasar a producción: `develop` → `main`

```bash
gh pr create --base main --head develop --title "release: develop to main" --body ""
```

Mergeá **siempre con "Create a merge commit"**, nunca con squash ni rebase. Así `main` recibe los mismos commits que generaron las betas, y semantic-release promueve `v1.2.0-beta.N` a `v1.2.0`.

El título de este PR no afecta la versión: el merge commit (`Merge pull request #N ...`) se ignora y cuentan los commits que trae adentro.

### 6. Back-merge: traer `main` a `develop` (obligatorio)

El tag estable queda en el merge commit de `main`, que `develop` no tiene. Si no lo traés, `develop` no "ve" que `v1.2.0` ya salió y la próxima beta se numera mal (`v1.2.0-beta.3` en vez de `v1.3.0-beta.1`).

Apenas termine el release en `main`:

```bash
git fetch origin
git switch develop
git pull
git merge origin/main
git push
```

Normalmente es un fast-forward sin conflictos. Ese push a `develop` no genera una beta nueva porque no trae commits sin publicar.

## Cómo escribir los commits

Formato:

```
<tipo>(<scope opcional>): <descripción en inglés, en minúscula, sin punto final>

<cuerpo opcional: el porqué>

<footer opcional: BREAKING CHANGE: ..., Refs #12>
```

### Tipos y su efecto en la versión

| Tipo                                         | Cuándo usarlo                                                                     | Efecto                               |
| -------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------ |
| `feat`                                       | Funcionalidad nueva visible para quien usa la API                                 | **minor** (`1.2.0` → `1.3.0`)        |
| `fix`                                        | Corrección de un bug                                                              | **patch** (`1.2.0` → `1.2.1`)        |
| `perf`                                       | Mejora de rendimiento sin cambio de comportamiento                                | **patch**                            |
| `feat!` / `fix!` o footer `BREAKING CHANGE:` | Cambio que rompe el contrato (endpoint que cambia o desaparece, campo renombrado) | **major** (`1.2.0` → `2.0.0`)        |
| `refactor`                                   | Cambio interno sin efecto visible                                                 | sin release                          |
| `test`                                       | Tests nuevos o corregidos                                                         | sin release                          |
| `docs`                                       | Documentación                                                                     | sin release                          |
| `build`                                      | Dependencias, tsconfig, scripts                                                   | sin release                          |
| `ci`                                         | Workflows de GitHub Actions                                                       | sin release                          |
| `chore`                                      | Mantenimiento que no encaja en otro tipo                                          | sin release                          |
| `style`                                      | Formato, sin cambio de lógica                                                     | sin release                          |
| `revert`                                     | Revierte un commit anterior                                                       | sin release (salvo que se configure) |

Si un rango de commits tiene varios tipos, gana el de mayor impacto: un `feat` y tres `fix` dan un minor.

### Ejemplos

```bash
git commit -m "feat(experience): add PATCH /admin/experiences/:id"
git commit -m "fix(chat): count only substantive messages toward the daily limit"
git commit -m "test(leads): cover duplicate email on POST /leads"
git commit -m "build: bump fastify to 5.13"

# Cambio que rompe el contrato: ! en el tipo y explicación en el footer
git commit -m "feat(profile)!: rename linkedin to linkedinUrl" \
           -m "BREAKING CHANGE: GET /profile now returns linkedinUrl instead of linkedin."
```

### Scopes sugeridos

Coinciden con los módulos y piezas del repo: `profile`, `experience`, `technology`, `education`, `language`, `chat`, `leads`, `auth`, `prisma`, `swagger`, `config`. No son obligatorios ni se validan; sirven para leer el historial y las release notes.

### Qué rechaza commitlint

| Mensaje               | Problema                        |
| --------------------- | ------------------------------- |
| `agregué el módulo`   | falta el tipo                   |
| `feature: add module` | tipo inexistente (es `feat`)    |
| `feat: Add module`    | descripción en mayúscula        |
| `feat: add module.`   | punto final                     |
| `feat:add module`     | falta el espacio después de `:` |

## Ver las versiones

- **GitHub → Releases**: cada versión con sus notas generadas automáticamente. Las betas aparecen como _pre-release_.
- **Desde la terminal**:

```bash
git fetch --tags
git tag --sort=-v:refname | head        # últimas versiones
git describe --tags --abbrev=0          # última versión alcanzable desde tu rama
```

`package.json` siempre dice `0.0.0-semantic-release`: es intencional, la versión vive en los tags.

## Casos y problemas comunes

### "El commit fue rechazado"

commitlint muestra qué regla falló. Corregí el mensaje y volvé a commitear: el commit rechazado no se creó.

### "Ya commiteé con un mensaje que no me gusta"

- **Todavía no lo pusheaste**: `git commit --amend -m "fix: mensaje correcto"`.
- **Ya está en el PR pero no mergeado**: amend + `git push --force-with-lease` sobre **tu** rama de trabajo (nunca sobre `develop` ni `main`). O mergeá con squash y corregí el título del PR.
- **Ya está mergeado**: no se reescribe historia compartida. La versión ya salió; el próximo commit corrige el rumbo.

### "Mergeé y no salió ninguna versión"

Es lo esperado si los commits nuevos son todos `docs`, `test`, `chore`, `refactor`, `ci`, `build` o `style`. Para verificarlo, mirá el log del job `release` en Actions: dice "There are no relevant changes, so no new version is released".

Si el job `verify` falló, `release` no corre. Arreglá el CI y el próximo push a esa rama publica lo pendiente.

### "La beta salió con un número raro después de un release"

Faltó el [back-merge](#6-back-merge-traer-main-a-develop-obligatorio). Hacelo y la siguiente beta se numera bien.

### Hotfix en producción

Para un bug urgente que no puede esperar al siguiente pase de `develop`:

```bash
git switch main
git pull
git switch -c hotfix-chat-limit
git commit -m "fix(chat): ..."
git push -u origin hotfix-chat-limit
gh pr create --base main --fill
```

Al mergear sale un patch estable (`v1.2.1`). Después, hacé el [back-merge](#6-back-merge-traer-main-a-develop-obligatorio) para que el fix también llegue a `develop`.

### Un release salió mal

Los tags y releases publicados no se borran ni se reutilizan. Publicá la corrección como una versión nueva (`fix:` → patch). Si hace falta deshacer un cambio, usá `git revert <sha>` con un commit `fix:` que explique qué se revirtió y por qué.

### Saltear los hooks

`git commit --no-verify` existe, pero no lo uses: el CI corre lo mismo y va a fallar igual, solo que más tarde.

## Referencia: dónde está cada pieza

| Archivo                                                                                                                       | Qué hace                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [.releaserc.json](../.releaserc.json)                                                                                         | Ramas de release (`main` estable, `develop` beta) y plugins de semantic-release                                    |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml)                                                                       | Job `verify` en PR y push; job `release` solo en push a `develop`/`main`                                           |
| [commitlint.config.ts](../commitlint.config.ts)                                                                               | Reglas de formato de commit (`@commitlint/config-conventional`)                                                    |
| [.husky/](../.husky/)                                                                                                         | Hooks locales: `commit-msg` (commitlint), `pre-commit` (lint-staged + typecheck), `pre-push` (tests con cobertura) |
| [eslint.config.ts](../eslint.config.ts), [.prettierrc.json](../.prettierrc.json), [.lintstagedrc.json](../.lintstagedrc.json) | Reglas de lint, formato y qué corre sobre los archivos stageados                                                   |
