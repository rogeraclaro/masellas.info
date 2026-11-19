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
   enviats el 2026-11-16). Revisat el 2026-11-19: totes les pàgines de
   projecte estan indexades; les 6 pàgines de llista (/projects/ i
   /projects-ac/ en ca/en/es) no, perquè Google les va rastrejar entre el
   19 i el 23/10, quan encara tenien noindex. Sol·licitada la indexació
   de les 6 i "Validate fix" al motiu noindex el 2026-11-19. Pendent:
   d'aquí a 1-2 setmanes comprovar que s'han indexat. La resta de no
   indexades són d'altres subdominis (grausfp, poi, fenya) o esperades
   (?p=, http/www, /landings/ amb noindex).
2. Provar al navegador una pàgina de projecte (p. ex. /projects/fenya/):
   animacions, "projecte següent", tancar, canvi d'idioma i enrere.
3. Admin: Sangre de Toro (text en/es) i descripció de Veepee (punt final,
   "launches") encara no són els de textos-admin.md; glossari: "és Claude
   Code" (ca), "WordPress" (ACF es), "custom post types" (ACF en); any
   d'InDret "des de 2000" surt igual a /en/ i /es/.

4. Xat "pregunta'm" (2026-11-17): comprovar la resposta graciosa del temps
   quan estigui desada a l'admin (pestanya "ask me"), i fer la funcionalitat
   nova: un àudio associat a una resposta graciosa ("mañana sol y buen
   tiempo") que soni alhora que surt la resposta, penjat des de l'admin.
   Pendent de Roger: penjar el document de vida laboral a la mateixa pestanya.

Fet el 2026-11-16: nginx retorna 404 per a qualsevol fitxer o carpeta que
comenci per punt (/.atl/, temporals de l'admin), des de l'editor de vhost de
CloudPanel (còpies a /root/vhost-backups/).