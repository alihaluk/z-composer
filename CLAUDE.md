# CLAUDE.md

Instructions for AI coding agents working on Z-Composer.

## Project

Z-Composer is a designer for Zebra (ZPL) receipt templates. It outputs a template as JSON and as ZPL with placeholders. The scope is the designer only: filling templates with data and sending them to a printer is the consumer's job (`docs/SCOPE.md`). Do not add filling, printing or server features unless the owner asks.

The contract between the designer and fillers is `docs/OUTPUT_SPEC.md`. `src/lib/zplFill.ts` is the reference filler, and `conformance/` is the language-independent test suite for fillers.

The test printer is a Zebra ZQ521 with 3-inch paper (203 dpi).

## Commands

- `npm run dev`: dev server
- `npm test`: vitest (includes the conformance suite)
- `npm run lint`: ESLint
- `npm run build`: type check and app build
- `npm run build:lib`: library build (`dist-lib`)

CI runs lint, test, build and build:lib. Run all four before committing.

## Layout

- `src/lib/`: template model, ZPL generation (`zplTemplate.ts`), reference filler (`zplFill.ts`), formats, import and export, GİB karekod (`gibQr.ts`)
- `src/preview/`: ZPL parser and canvas renderer for the preview; barcodes come from BWIPP encoders through the `@bwipp` alias
- `src/store/editorStore.ts`: zustand store with undo (zundo)
- `src/components/`: editor UI
- `src/locales/`: `tr.json` and `en.json`; every UI string goes in both
- `docs/`: specification, scope, review findings, GİB karekod notes

## Rules

### Git and releases

- Commit as the owner: `git -c user.name="Ali Haluk Seven" -c user.email="a.halukseven@gmail.com" commit ...`. The machine's global git config has a work address; never commit with it.
- Push directly to `main`. Do not open pull requests.
- Do not publish to npm.
- Never commit `.claude/`.
- A release bumps `package.json`, adds a `CHANGELOG.md` entry and is tagged `vX.Y.Z`.

### Specification and conformance

- A change to the output format starts in `docs/OUTPUT_SPEC.md`. Raise the spec version only for changes old fillers cannot handle.
- Every rule in the specification has a conformance case. When the specification changes, add or update a case in `conformance/cases/`.
- Write expected outputs by hand from the specification. Never copy them from what `zplFill.ts` produces; the suite exists to check the filler.
- Keep the preview faithful to the printer: line breaking, fonts and barcode sizes must match what the ZQ521 prints.

### Records

- Record review findings and owner decisions in `docs/REVIEW_FINDINGS.md`.
- Keep `README.md` and `INTEGRATION_GUIDE.md` in step with user-visible changes.

### Language

- Code, comments, commits and docs are in English.
- The owner writes in Turkish; reply in Turkish.

## Working style

- **Think first.** State assumptions. When a request has more than one reading, say so. Ask the owner only for decisions that are theirs or hard to reverse; otherwise choose a sensible default, say which, and continue.
- **Keep it simple.** Write the least code that solves the problem. No speculative features, options or abstractions.
- **Change only what the task needs.** Match the existing style. Mention unrelated problems instead of fixing them on the side. Remove what your own change left unused.
- **Verify.** Turn the task into a check: a failing test that then passes, a conformance case, or a look at the running app. Do not call a task done before the check passes.
