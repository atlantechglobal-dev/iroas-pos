# ADR 0003: Keep `src/` + `server/` layout until the M5 clean install

Status: accepted (2026-10-30)

## Context
A conventional monorepo (`apps/web`, `apps/api`) would be tidier, but the live
test deployment runs from the current paths, and several developers commit to
`src/` daily. A directory move now would break deploy scripts and cause merge
conflicts for in-flight work.

## Decision
Clean up around the code now (docs, ADRs, ury/, removed one-off scripts) and
keep `src/` and `server/` in place. Reconsider the monorepo layout at the M5
clean install, when there is no live deployment to protect and no concurrent
branches.

## Consequences
- No broken deploys or conflicts before the client demo.
- A one-time `git mv` plus path updates is needed later if the move is wanted.
