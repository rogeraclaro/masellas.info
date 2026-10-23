# Reprendre la sessió

Copia aquest prompt en una sessió nova de Claude Code dins `masellas.info`:

```
Reprenem la feina a masellas.info. Primer recupera el context d'Engram
(mem_context i mem_search "masellas") i llegeix DEPLOY.md.

Estat a 2026-10-20 (tot desplegat, branca develop = main, darrer commit c05a2b0):
- Admin: títol "admin" en lloc de "projects / admin".
- Menú: la pestanya actual té el fons del hover (css/shared/menu.css).
- Fitxa de projecte: espaiats fixos (.detail__ai 2.5rem, tools/visit 1rem,
  next 2rem + padding 1rem) i el menú de seccions torna a ser clicable
  sobre la fitxa (projects/js/projects.js).
- Tooltip a la pestanya "projectes (a.C.)": el text surt del terme de
  glossari "projects (B.C.)", publicat per l'admin a
  projects/data/menu.<lang>.json. .term-tooltip a 0.9rem.

Pendent:
1. Definir el terme "projects (B.C.)" al glossari de l'admin (ca/en/es)
   i comprovar el tooltip al navegador.
2. Decidir si eliminem els tokens sense ús --menu-active i --tab-fg-active
   (css/shared/tokens.css).
3. Cap dels canvis s'ha verificat al navegador.

Normes: respon en català i curt. Després de canvis de CSS/JS fes
npm run build i passa els tests (npm test a l'arrel i a admin/). Fes
commit, push i deploy només quan t'ho demani (develop → merge ff a main
→ push; el remot es diu masellas.info). Commits convencionals, sense
Co-Authored-By.
```
