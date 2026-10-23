# Reprendre la sessió

Copia aquest prompt en una sessió nova de Claude Code dins `masellas.info`:

```
Reprenem la feina a masellas.info. Primer recupera el context d'Engram
(mem_context i mem_search "masellas") i llegeix DEPLOY.md i aquest
REPRENDRE.md.

Estat a 2026-10-23 (tot desplegat, develop = main):
- SEO: les pàgines de projectes ja són indexables (sense noindex).
  L'admin (admin/lib/seo-pages.js) injecta la llista i el JSON-LD a les
  pàgines de llista i genera una pàgina per projecte a
  /<idioma>/<col·lecció>/<id>/, més /sitemap-projects.xml i /llms.txt.
  El build genera robots.txt i sitemap.xml. Els id data, css i js estan
  reservats.

Normes: respon en català i curt. Després de canvis de CSS/JS fes
npm run build i passa els tests (npm test a l'arrel i a admin/). Fes
commit, push i deploy només quan t'ho demani (develop → merge ff a main
→ push; el remot es diu masellas.info). Commits convencionals, sense
Co-Authored-By. Abans de cada commit, git diff --cached --stat.
```

## Pendent (per a mi)

1. Google Search Console: donar d'alta https://masellas.info/sitemap.xml
   i https://masellas.info/sitemap-projects.xml (i demanar la indexació
   d'algunes pàgines de projecte).
2. Opcional: esborrar del servidor /.atl/.skill-registry.cache.json
   (publicat per error; només conté un hash).
3. Provar al navegador una pàgina de projecte (p. ex. /projects/fenya/):
   animacions, "projecte següent", tancar, canvi d'idioma i enrere.

## Pendent de la sessió del 2026-10-20 (comprova si encara cal)

1. Definir el terme "projects (B.C.)" al glossari de l'admin (ca/en/es)
   i comprovar el tooltip al navegador.
2. Decidir si eliminem els tokens sense ús --menu-active i --tab-fg-active
   (css/shared/tokens.css).
