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

1. Google Search Console (propietat de domini verificada i sitemaps
   enviats el 2026-11-16): opcional, demanar la indexació d'algunes
   pàgines de projecte i, d'aquí a uns dies, revisar la cobertura.
2. Provar al navegador una pàgina de projecte (p. ex. /projects/fenya/):
   animacions, "projecte següent", tancar, canvi d'idioma i enrere.
3. Admin: Sangre de Toro (text en/es) i descripció de Veepee (punt final,
   "launches") encara no són els de textos-admin.md; glossari: "és Claude
   Code" (ca), "WordPress" (ACF es), "custom post types" (ACF en); any
   d'InDret "des de 2000" surt igual a /en/ i /es/.

Fet el 2026-11-16: nginx retorna 404 per a qualsevol fitxer o carpeta que
comenci per punt (/.atl/, temporals de l'admin), des de l'editor de vhost de
CloudPanel (còpies a /root/vhost-backups/).