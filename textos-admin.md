# Textos corregits per a l'admin

Cada bloc és un camp: copia el contingut sencer del bloc i enganxa'l al camp i idioma indicats.

## GrausFP — projects (IA) (`grausfp`)

**categoria · ca**

```text
cercador
```

**categoria · en**

```text
search engine
```

**categoria · es**

```text
buscador
```

**descripció · ca** (200/200)

```text
Cercador de graus de Formació Professional de tot l’estat que permet buscar per nom, codi, ocupació o cursos FPO, filtrar per família i nivell, consultar centres, guardar favorits, crear alertes, etc.
```

**descripció · en** (195/200)

```text
Search engine for vocational training (FP) degrees across Spain: search by name, code, occupation or FPO course, filter by family and level, look up centres, save favourites, set alerts and more.
```

**descripció · es** (196/200)

```text
Buscador de grados de Formación Profesional de todo el estado que permite buscar por nombre, código, ocupación o cursos FPO, filtrar por familia y nivel, consultar centros, guardar favoritos, etc.
```

**com he fet servir la IA · ca**

```text
Aquesta app va sortir de l'observació que al portal del Ministeri d'Educació (TodoFP) hi ha 3 o 4 cercadors diferents per cercar (aparentment) els mateixos cursos, però que segons com donen resultats diferents, en algun cas són poc amigables i comprensibles per a l'usuari i, a més, no relacionen recursos ni centres d'impartició. Vaig pensar que faria falta una eina que englobés tota la informació que ja és a internet (en força casos al mateix portal, però sense relacionar) i fins i tot ampliar-la amb més recursos de FPO d'altres entitats que no hi surten reflectides i amb formacions que no necessàriament surten descrites al BOE.

Les dades no surten d'una única font oberta: s'obtenen automàticament de set fonts oficials i privades, cadascuna amb la seva tècnica.

Del portal TodoFP (Ministeri d'Educació) es consumeix la seva API JSON interna, es fa scraping HTML dels catàlegs i es parsegen els PDF dels certificats de professionalitat amb pdfplumber.

Els centres s'obtenen dels endpoints JSON del Registre Estatal d'Entitats de Formació.

Els cursos del SOC es recuperen a través del seu índex de cerca Algolia, i els de PIMEC, Foment, Cecot i CCOO combinen API REST de WordPress, sitemaps XML i scraping HTML.

Un pipeline ETL en Python (Flask, BeautifulSoup, APScheduler) s'executa cada setmana sense intervenció manual: extreu, normalitza i deduplica les dades, relaciona títols, mòduls i certificats, i desa snapshots atòmics a SQLite. També inclou salvaguardes de qualitat de dades: rebutja una font si el volum cau a menys de la meitat i avisa per correu si alguna cosa falla. Els canvis detectats a cada actualització alimenten les alertes i un feed RSS/JSON.

L'aplicació no fa inferència d'IA en temps d'execució (no és necessari). La IA s'ha fet servir per construir-la (AI-assisted development / agentic coding): s'ha desenvolupat amb Claude Code (Claude Sonnet) com a agent de programació, amb un flux spec-driven de plans i especificacions, i amb proves al navegador via Playwright MCP.
```

**com he fet servir la IA · en**

```text
This app came from noticing that the Ministry of Education's portal (TodoFP) has 3 or 4 different search engines for (apparently) the same courses, that they return different results depending on which one you use, that some are neither friendly nor easy to understand, and that none of them links resources with the centres that teach them. I thought there should be one tool gathering all the information that is already online (often on that same portal, but unconnected), and even extending it with FPO resources from other organisations that are not listed there and with training that is not necessarily described in the BOE.

The data does not come from a single open source: it is collected automatically from seven official and private sources, each with its own technique.

From the TodoFP portal (Ministry of Education) it consumes the internal JSON API, scrapes the HTML catalogues and parses the PDFs of the professional certificates with pdfplumber.

The centres come from the JSON endpoints of the State Register of Training Entities.

The SOC courses are retrieved through its Algolia search index, and those of PIMEC, Foment, Cecot and CCOO combine the WordPress REST API, XML sitemaps and HTML scraping.

An ETL pipeline in Python (Flask, BeautifulSoup, APScheduler) runs every week with no manual intervention: it extracts, normalises and deduplicates the data, links degrees, modules and certificates, and saves atomic snapshots to SQLite. It also has data-quality safeguards: it rejects a source if its volume drops below half and sends an email if anything fails. The changes detected in each update feed the alerts and an RSS/JSON feed.

The app does not run AI inference at runtime (there is no need). AI was used to build it (AI-assisted development / agentic coding): it was developed with Claude Code (Claude Sonnet) as the coding agent, following a spec-driven workflow of plans and specifications, with browser testing via Playwright MCP.
```

**com he fet servir la IA · es**

```text
Esta app salió de observar que en el portal del Ministerio de Educación (TodoFP) hay 3 o 4 buscadores distintos para buscar (aparentemente) los mismos cursos, pero que según cuál uses dan resultados diferentes, en algún caso son poco amigables y comprensibles para el usuario y, además, no relacionan recursos ni centros de impartición. Pensé que haría falta una herramienta que englobara toda la información que ya está en internet (en bastantes casos en el mismo portal, pero sin relacionar) e incluso ampliarla con más recursos de FPO de otras entidades que no aparecen reflejadas y con formaciones que no necesariamente están descritas en el BOE.

Los datos no salen de una única fuente abierta: se obtienen automáticamente de siete fuentes oficiales y privadas, cada una con su técnica.

Del portal TodoFP (Ministerio de Educación) se consume su API JSON interna, se hace scraping HTML de los catálogos y se parsean los PDF de los certificados de profesionalidad con pdfplumber.

Los centros se obtienen de los endpoints JSON del Registro Estatal de Entidades de Formación.

Los cursos del SOC se recuperan a través de su índice de búsqueda Algolia, y los de PIMEC, Foment, Cecot y CCOO combinan la API REST de WordPress, sitemaps XML y scraping HTML.

Un pipeline ETL en Python (Flask, BeautifulSoup, APScheduler) se ejecuta cada semana sin intervención manual: extrae, normaliza y deduplica los datos, relaciona títulos, módulos y certificados, y guarda snapshots atómicos en SQLite. También incluye salvaguardas de calidad de datos: rechaza una fuente si el volumen cae a menos de la mitad y avisa por correo si algo falla. Los cambios detectados en cada actualización alimentan las alertas y un feed RSS/JSON.

La aplicación no hace inferencia de IA en tiempo de ejecución (no es necesario). La IA se ha usado para construirla (AI-assisted development / agentic coding): se ha desarrollado con Claude Code (Claude Sonnet) como agente de programación, con un flujo spec-driven de planes y especificaciones, y con pruebas en el navegador vía Playwright MCP.
```

## SSCE0110 Links — projects (IA) (`fplinks`)

**categoria · ca**

```text
web app
```

**categoria · en**

```text
web app
```

**categoria · es**

```text
web app
```

**descripció · ca** (183/200)

```text
FP Recursos és una biblioteca col·laborativa d'enllaços sobre temes relacionats amb el certificat de professionalitat SSCE0110 (docència de la formació professional per a l'ocupació).
```

**descripció · en** (153/200)

```text
FP Recursos is a collaborative library of links on topics related to the SSCE0110 professional certificate (teaching vocational training for employment).
```

**descripció · es** (180/200)

```text
FP Recursos es una biblioteca colaborativa de enlaces sobre temas relacionados con el certificado de profesionalidad SSCE0110 (docencia de la formación profesional para el empleo).
```

**com he fet servir la IA · ca**

```text
Inclou rols d'editor, sol·licituds d'accés, missatgeria interna, cinc temes visuals i una extensió de Chrome per desar recursos des del navegador.

L'aplicació fa inferència d'IA en temps d'execució per catalogar automàticament. A partir d'una URL, una Edge Function de Supabase (Deno) descarrega la pàgina, amb protecció contra SSRF, i n'extreu el títol, la meta descripció i el text principal.
Després crida el model obert GPT-OSS 20B a través de l'API de Groq, compatible amb OpenAI, amb fallback a GPT-OSS 120B. El model retorna en mode JSON un títol en català, una descripció breu i la categoria més adequada de la taxonomia existent, i aquesta sortida es valida al servidor abans d'omplir el formulari.

El proveïdor ha evolucionat de Gemini a Llama 3.3 70B i finalment a GPT-OSS.

L'aplicació (React 19, TypeScript, Vite, Supabase) s'ha desenvolupat amb l'ajuda de Claude Code com a agent de programació, amb un flux spec-driven i auditories de seguretat i qualitat assistides per IA que han generat plans de correcció.
```

**com he fet servir la IA · en**

```text
It includes editor roles, access requests, internal messaging, five visual themes and a Chrome extension to save resources from the browser.

The app runs AI inference at runtime to catalogue links automatically. Given a URL, a Supabase Edge Function (Deno) downloads the page, with SSRF protection, and extracts its title, meta description and main text.
It then calls the open GPT-OSS 20B model through Groq's OpenAI-compatible API, with a fallback to GPT-OSS 120B. In JSON mode, the model returns a title in Catalan, a short description and the best-fitting category of the existing taxonomy, and this output is validated on the server before it fills in the form.

The provider has moved from Gemini to Llama 3.3 70B and finally to GPT-OSS.

The app (React 19, TypeScript, Vite, Supabase) was developed with the help of Claude Code as the coding agent, following a spec-driven workflow and AI-assisted security and quality audits that produced fix plans.
```

**com he fet servir la IA · es**

```text
Incluye roles de editor, solicitudes de acceso, mensajería interna, cinco temas visuales y una extensión de Chrome para guardar recursos desde el navegador.

La aplicación hace inferencia de IA en tiempo de ejecución para catalogar automáticamente. A partir de una URL, una Edge Function de Supabase (Deno) descarga la página, con protección contra SSRF, y extrae el título, la meta descripción y el texto principal.
Después llama al modelo abierto GPT-OSS 20B a través de la API de Groq, compatible con OpenAI, con fallback a GPT-OSS 120B. El modelo devuelve en modo JSON un título en catalán, una descripción breve y la categoría más adecuada de la taxonomía existente, y esta salida se valida en el servidor antes de rellenar el formulario.

El proveedor ha evolucionado de Gemini a Llama 3.3 70B y finalmente a GPT-OSS.

La aplicación (React 19, TypeScript, Vite, Supabase) se ha desarrollado con la ayuda de Claude Code como agente de programación, con un flujo spec-driven y auditorías de seguridad y calidad asistidas por IA que han generado planes de corrección.
```

## Fenya — projects (IA) (`fenya`)

**categoria · ca**

```text
web app
```

**categoria · en**

```text
web app
```

**categoria · es**

```text
web app
```

**descripció · ca** (181/200)

```text
Fenya és una eina per buscar feina que permet pujar i gestionar diversos CV, amb el càrrec i la ubicació. Pots editar-los, duplicar-los o esborrar-los per adaptar-los a cada oferta.
```

**descripció · en** (174/200)

```text
Fenya is a job-search tool where you upload and manage several CVs, each with its job title and location. You can edit, duplicate or delete them to tailor them to each offer.
```

**descripció · es** (187/200)

```text
Fenya es una herramienta para buscar trabajo que permite subir y gestionar varios CV, con el cargo y la ubicación. Puedes editarlos, duplicarlos o borrarlos para adaptarlos a cada oferta.
```

**com he fet servir la IA · ca**

```text
Actualment es troba en fase de proves; si vols un accés, si us plau, [escriu-me](mailto:roger@lamosca.com).

Per a cada CV, Fenya agrega ofertes de diverses fonts (Adzuna, Jooble, JSearch/LinkedIn, Feina Activa i d'altres) i les ordena per encaix mitjançant matching semàntic amb LLMs.

L'aplicació (Next.js 16, Postgres/Drizzle) s'ha desenvolupat amb l'ajuda de Claude Code com a agent de programació, amb un flux spec-driven i TDD.

Inferència en temps d'execució:
DeepSeek V4 Flash (via SDK compatible amb OpenAI, amb el reasoning desactivat i sortida en mode JSON) extreu un perfil estructurat del CV, infereix els termes de cerca i puntua cada oferta de 0 a 100 amb una rúbrica ponderada (skills 50%, experiència 25%, ubicació 15%, idioma 10%), justificant la nota i indicant les habilitats que tens i les que et falten.

Com a segon avaluador, a demanda, hi ha el model Jev (TypeSafe SDK). Jev no genera text lliure: tria un nivell dins d'una escala tancada i n'indica la confiança.
En mode rúbrica indexada, puntua per separat els mateixos quatre criteris, cadascun amb cinc nivells descrits.
En mode holístic, fa un sol judici d'encaix global. Així la nota és més determinista i auditable, i es poden comparar tres "jutges" LLM sobre les mateixes ofertes per veure quin s'acosta més al criteri humà.
```

**com he fet servir la IA · en**

```text
It is currently in testing; if you would like access, please [write to me](mailto:roger@lamosca.com).

For each CV, Fenya aggregates offers from several sources (Adzuna, Jooble, JSearch/LinkedIn, Feina Activa and others) and ranks them by fit using semantic matching with LLMs.

The app (Next.js 16, Postgres/Drizzle) was developed with the help of Claude Code as the coding agent, following a spec-driven workflow and TDD.

Runtime inference:
DeepSeek V4 Flash (through an OpenAI-compatible SDK, with reasoning disabled and JSON-mode output) extracts a structured profile from the CV, infers the search terms and scores each offer from 0 to 100 with a weighted rubric (skills 50%, experience 25%, location 15%, language 10%), justifying the score and listing the skills you have and the ones you lack.

As a second evaluator, on demand, there is the Jev model (TypeSafe SDK). Jev does not generate free text: it picks a level on a closed scale and reports its confidence.
In indexed-rubric mode, it scores the same four criteria separately, each with five described levels.
In holistic mode, it makes a single judgement of overall fit. This makes the score more deterministic and auditable, and three LLM "judges" can be compared on the same offers to see which one comes closest to human judgement.
```

**com he fet servir la IA · es**

```text
Actualmente se encuentra en fase de pruebas; si quieres acceso, por favor, [escríbeme](mailto:roger@lamosca.com).

Para cada CV, Fenya agrega ofertas de varias fuentes (Adzuna, Jooble, JSearch/LinkedIn, Feina Activa y otras) y las ordena por encaje mediante matching semántico con LLMs.

La aplicación (Next.js 16, Postgres/Drizzle) se ha desarrollado con la ayuda de Claude Code como agente de programación, con un flujo spec-driven y TDD.

Inferencia en tiempo de ejecución:
DeepSeek V4 Flash (vía SDK compatible con OpenAI, con el reasoning desactivado y salida en modo JSON) extrae un perfil estructurado del CV, infiere los términos de búsqueda y puntúa cada oferta de 0 a 100 con una rúbrica ponderada (skills 50%, experiencia 25%, ubicación 15%, idioma 10%), justificando la nota e indicando las habilidades que tienes y las que te faltan.

Como segundo evaluador, a demanda, está el modelo Jev (TypeSafe SDK). Jev no genera texto libre: elige un nivel dentro de una escala cerrada e indica su confianza.
En modo rúbrica indexada, puntúa por separado los mismos cuatro criterios, cada uno con cinco niveles descritos.
En modo holístico, hace un solo juicio de encaje global. Así la nota es más determinista y auditable, y se pueden comparar tres "jueces" LLM sobre las mismas ofertas para ver cuál se acerca más al criterio humano.
```

## AI Bookmarks — projects (IA) (`ailinks`)

**categoria · ca**

```text
web app
```

**categoria · en**

```text
web app
```

**categoria · es**

```text
web app
```

**descripció · ca** (190/200)

```text
AI Bookmark Manager és un gestor personal de marcadors sobre IA que recull enllaços des de diversos punts d'entrada. (És un producte especialment pensat i adaptat al meu Diògenes digital XD)
```

**descripció · en** (177/200)

```text
AI Bookmark Manager is a personal bookmark manager for AI content that collects links from several entry points. (It's a product designed and tailored to my digital hoarding XD)
```

**descripció · es** (190/200)

```text
AI Bookmark Manager es un gestor personal de marcadores sobre IA que recoge enlaces desde varios puntos de entrada. (Es un producto pensado y adaptado especialmente a mi Diógenes digital XD)
```

**com he fet servir la IA · ca**

```text
Els punts d'entrada són: exportacions de bookmarks de Twitter/X, una extensió de Chrome que desa la pàgina actual o totes les pestanyes obertes d'un tab group, i una {{PWA}} a Android (per guardar enllaços des del mòbil). Tot se sincronitza entre dispositius a través d'una {{API REST}} pròpia.

L'aplicació fa inferència d'IA en temps d'execució per curar el contingut automàticament.

El servidor (Node/Express) crida DeepSeek Flash en mode JSON i amb temperatura baixa. Per a cada tweet, el model filtra si tracta d'IA, genera un títol en català, l'assigna a les categories de la taxonomia de l'usuari i n'extreu els enllaços externs.
Per a qualsevol pàgina desada, en tradueix el títol i en fa un resum breu.
Abans de classificar, els tweets s'enriqueixen via oEmbed i es resolen els enllaços escurçats, i les crides es fan una a una amb reintents i timeout. El proveïdor ha evolucionat de Gemini a Claude, Groq i finalment DeepSeek.

L'aplicació (React 19, TypeScript, Vite) s'ha desenvolupat amb Claude Code com a agent de programació, amb un flux {{spec-driven}} per fases.
```

**com he fet servir la IA · en**

```text
The entry points are: Twitter/X bookmark exports, a Chrome extension that saves the current page or every open tab in a tab group, and an Android {{PWA}} (to save links from the phone). Everything syncs across devices through its own {{API REST}}.

The app runs AI inference at runtime to curate the content automatically.

The server (Node/Express) calls DeepSeek Flash in JSON mode with a low temperature. For each tweet, the model checks whether it is about AI, writes a title in Catalan, assigns it to the categories of the user's taxonomy and extracts the external links.
For any saved page, it translates the title and writes a short summary.
Before classifying, tweets are enriched via oEmbed and shortened links are resolved, and calls are made one at a time with retries and a timeout. The provider has moved from Gemini to Claude, Groq and finally DeepSeek.

The app (React 19, TypeScript, Vite) was built with Claude Code as the coding agent, following a phased {{spec-driven}} workflow.
```

**com he fet servir la IA · es**

```text
Los puntos de entrada son: exportaciones de marcadores de Twitter/X, una extensión de Chrome que guarda la página actual o todas las pestañas abiertas de un grupo de pestañas, y una {{PWA}} en Android (para guardar enlaces desde el móvil). Todo se sincroniza entre dispositivos a través de una {{API REST}} propia.

La aplicación hace inferencia de IA en tiempo de ejecución para curar el contenido automáticamente.

El servidor (Node/Express) llama a DeepSeek Flash en modo JSON y con temperatura baja. Para cada tweet, el modelo filtra si trata de IA, genera un título en catalán, lo asigna a las categorías de la taxonomía del usuario y extrae los enlaces externos.
Para cualquier página guardada, traduce el título y hace un resumen breve.
Antes de clasificar, los tweets se enriquecen vía oEmbed y se resuelven los enlaces acortados, y las llamadas se hacen una a una con reintentos y timeout. El proveedor ha evolucionado de Gemini a Claude, Groq y finalmente DeepSeek.

La aplicación (React 19, TypeScript, Vite) se ha desarrollado con Claude Code como agente de programación, con un flujo {{spec-driven}} por fases.
```

## Persona(s) de interés — projects (IA) (`poi`)

**categoria · ca**

```text
website
```

**categoria · en**

```text
website
```

**categoria · es**

```text
website
```

**descripció · ca** (175/200)

```text
Projecte documental amb breus perfils de membres de la comunitat llatina de Nova York, que en mostren la diversitat i la vitalitat a través d’un mapa interactiu amb marcadors.
```

**descripció · en** (158/200)

```text
Documentary project with short profiles of members of New York's Latino community, showing its diversity and vitality through an interactive map with markers.
```

**descripció · es** (176/200)

```text
Proyecto documental con breves perfiles de miembros de la comunidad latina de Nueva York, que muestran su diversidad y vitalidad a través de un mapa interactivo con marcadores.
```

**com he fet servir la IA · ca**

```text
Persona(s) de interés és un tema de WordPress a mida que situa els protagonistes en un mapa interactiu de Google Maps (Maps JavaScript API amb camps {{ACF}}), amb un estil fosc personalitzat i infowindows que enllacen amb els vídeos.
Amb els anys, Google va canviar l'estructura interna del DOM del mapa i de les infowindows, i les antigues regles CSS van deixar de funcionar: el mapa havia perdut completament el seu aspecte.

La IA s'ha fet servir com a eina de manteniment i depuració de codi heretat (AI-assisted debugging). Amb un agent de programació s'ha analitzat el DOM actual de Google Maps i s'han reescrit els estils sobre les classes estables de l'API.
També s'ha refet la interacció de les infowindows, amb hover i fade en escriptori, comportament específic per a mòbil i la fletxa integrada a la caixa, recuperant el disseny original sense reconstruir el tema.
```

**com he fet servir la IA · en**

```text
Persona(s) de interés is a custom WordPress theme that places its protagonists on an interactive Google Maps map (Maps JavaScript API with {{ACF}} fields), with a custom dark style and infowindows that link to the videos.
Over the years, Google changed the internal DOM structure of the map and the infowindows, and the old CSS rules stopped working: the map had completely lost its look.

AI was used as a tool for maintaining and debugging legacy code (AI-assisted debugging). With a coding agent, the current Google Maps DOM was analysed and the styles were rewritten on top of the API's stable classes.
The infowindow interaction was also rebuilt, with hover and fade on desktop, specific behaviour on mobile and the arrow built into the box, recovering the original design without rebuilding the theme.
```

**com he fet servir la IA · es**

```text
Persona(s) de interés es un tema de WordPress a medida que sitúa a los protagonistas en un mapa interactivo de Google Maps (Maps JavaScript API con campos {{ACF}}), con un estilo oscuro personalizado e infowindows que enlazan con los vídeos.
Con los años, Google cambió la estructura interna del DOM del mapa y de las infowindows, y las antiguas reglas CSS dejaron de funcionar: el mapa había perdido completamente su aspecto.

La IA se ha usado como herramienta de mantenimiento y depuración de código heredado (AI-assisted debugging). Con un agente de programación se ha analizado el DOM actual de Google Maps y se han reescrito los estilos sobre las clases estables de la API.
También se ha rehecho la interacción de las infowindows, con hover y fade en escritorio, comportamiento específico para móvil y la flecha integrada en la caja, recuperando el diseño original sin reconstruir el tema.
```

## R.U.C. — projects (IA) (`ruc`)

**categoria · ca**

```text
joc
```

**categoria · en**

```text
game
```

**categoria · es**

```text
juego
```

**descripció · ca** (188/200)

```text
R.U.C. és un remake en català, jugable al navegador, del clàssic M.U.L.E. (Dani Bunten, 1983) de Commodore 64 (en realitat el joc es va publicar inicialment per a Atari). Work in progress.
```

**descripció · en** (179/200)

```text
R.U.C. is a remake in Catalan, playable in the browser, of the Commodore 64 classic M.U.L.E. (Dani Bunten, 1983); the game was actually first released for Atari. Work in progress.
```

**descripció · es** (190/200)

```text
R.U.C. es un remake en catalán, jugable en el navegador, del clásico M.U.L.E. (Dani Bunten, 1983) de Commodore 64 (en realidad el juego se publicó inicialmente para Atari). Work in progress.
```

**com he fet servir la IA · ca**

```text
La IA no s'executa dins del joc. Els rivals (portats per la "màquina") de moment són agents basats en regles, sense LLM, cadascun amb la seva estratègia, i el motor fa servir un generador pseudoaleatori amb llavor (mulberry32) perquè cada partida sigui reproduïble.

La IA generativa s'ha fet servir per construir-lo: el joc parteix d'una especificació tècnica de 350 línies escrita com a prompt per a Claude Code, que l'ha implementat en un sol index.html amb JavaScript i Canvas 2D, sense dependències ni build.

Els 22 sprites s'han generat amb un prompt per asset amb Nano Banana (Gemini).

El joc es valida amb 75 self-tests que s'executen en Chrome headless dins d'un workflow de GitHub Actions abans de cada desplegament.
```

**com he fet servir la IA · en**

```text
AI does not run inside the game. The rivals (played by the "machine") are, for now, rule-based agents with no LLM, each with its own strategy, and the engine uses a seeded pseudorandom generator (mulberry32) so that every game is reproducible.

Generative AI was used to build it: the game starts from a 350-line technical specification written as a prompt for Claude Code, which implemented it in a single index.html with JavaScript and Canvas 2D, with no dependencies and no build.

The 22 sprites were generated with one prompt per asset using Nano Banana (Gemini).

The game is validated with 75 self-tests that run in headless Chrome inside a GitHub Actions workflow before every deployment.
```

**com he fet servir la IA · es**

```text
La IA no se ejecuta dentro del juego. Los rivales (llevados por la "máquina") de momento son agentes basados en reglas, sin LLM, cada uno con su estrategia, y el motor usa un generador pseudoaleatorio con semilla (mulberry32) para que cada partida sea reproducible.

La IA generativa se ha usado para construirlo: el juego parte de una especificación técnica de 350 líneas escrita como prompt para Claude Code, que lo ha implementado en un solo index.html con JavaScript y Canvas 2D, sin dependencias ni build.

Los 22 sprites se han generado con un prompt por asset con Nano Banana (Gemini).

El juego se valida con 75 self-tests que se ejecutan en Chrome headless dentro de un workflow de GitHub Actions antes de cada despliegue.
```

## Sangre de Toro — projects (a.C.) (`sangre-de-toro`)

**categoria · ca**

```text
website
```

**categoria · en**

```text
website
```

**categoria · es**

```text
website
```

**descripció · ca** (181/200)

```text
Sangre de Toro és una marca de vi espanyol creada per Torres el 1954. Ofereix vins amb bona relació qualitat-preu, es ven a més de 100 països i la majoria dels seus vins són vegans.
```

**descripció · en** (176/200)

```text
Sangre de Toro is a Spanish wine brand created by Torres in 1954. It offers wines with good value for money, is sold in more than 100 countries and most of its wines are vegan.
```

**descripció · es** (187/200)

```text
Sangre de Toro es una marca de vino español creada por Torres en 1954. Ofrece vinos con buena relación calidad-precio, se vende en más de 100 países y la mayoría de sus vinos son veganos.
```

**com es va fer · ca**

```text
El site està desenvolupat sobre WordPress, amb un tema fet a mida.
```

**com es va fer · en**

```text
The site is built on WordPress, with a custom theme.
```

**com es va fer · es**

```text
El site está desarrollado sobre WordPress, con un tema hecho a medida.
```

## Veepee & Privalia — projects (a.C.) (`veepee-privalia`)

**categoria · ca**

```text
landing
```

**categoria · en**

```text
landing
```

**categoria · es**

```text
landing
```

**descripció · ca** (53/200)

```text
Landing pages per a llançaments de Veepee i Privalia.
```

**descripció · en** (47/200)

```text
Landing pages for Veepee and Privalia launches.
```

**descripció · es** (53/200)

```text
Landing pages para lanzamientos de Veepee y Privalia.
```

**com es va fer · ca**

```text
Programació i maquetació de landing pages.
Vam començar amb jQuery i diferents llibreries JavaScript, i més endavant vam passar a un sistema de mòduls predefinits des de la central a França, que maquetàvem i retocàvem amb Vue.js i Sass.
Tot el disseny venia d'agència, realitzat amb Figma.

Per a aquest client també vaig coordinar i supervisar un petit grup de programadors de fora d'Espanya per respondre a l'alt volum de feina.

A "visita el web" es pot veure una recopilació amb les captures de totes les landings (192) i també algunes mostres puntuals: [un exemple](https://masellas.info/landings/live/hellofresh/), [un altre exemple](https://masellas.info/landings/live/ubereats/), [un altre](https://masellas.info/landings/live/claudie-pierlot/) i [un altre](https://masellas.info/landings/live/dyson/).
```

**com es va fer · en**

```text
Coding and layout of landing pages.
We started with jQuery and various JavaScript libraries, and later moved to a system of predefined modules from the head office in France, which we laid out and adjusted with Vue.js and Sass.
All the design came from an agency, made in Figma.

For this client I also coordinated and supervised a small group of developers outside Spain to cope with the high volume of work.

Under "visit site" you can see an index with screenshots of all the landings (192), and here are some individual samples: [an example](https://masellas.info/landings/live/hellofresh/), [another example](https://masellas.info/landings/live/ubereats/), [another](https://masellas.info/landings/live/claudie-pierlot/) and [one more](https://masellas.info/landings/live/dyson/).
```

**com es va fer · es**

```text
Programación y maquetación de landing pages.
Empezamos con jQuery y diferentes librerías JavaScript, y más adelante pasamos a un sistema de módulos predefinidos desde la central en Francia, que maquetábamos y retocábamos con Vue.js y Sass.
Todo el diseño venía de agencia, realizado con Figma.

Para este cliente también coordiné y supervisé un pequeño grupo de programadores de fuera de España para responder al alto volumen de trabajo.

En "visitar la web" se puede ver un índice con las capturas de todas las landings (192) y también algunas muestras individuales: [un ejemplo](https://masellas.info/landings/live/hellofresh/), [otro ejemplo](https://masellas.info/landings/live/ubereats/), [otro](https://masellas.info/landings/live/claudie-pierlot/) y [otro más](https://masellas.info/landings/live/dyson/).
```

## InDret — projects (a.C.) (`indret`)

**categoria · ca**

```text
website
```

**categoria · en**

```text
website
```

**categoria · es**

```text
website
```

**descripció · ca** (116/200)

```text
InDret és una revista en línia per a l'anàlisi del dret, publicada trimestralment pel Departament de Dret de la UPF.
```

**descripció · en** (102/200)

```text
InDret is an online journal for the analysis of law, published quarterly by the UPF Department of Law.
```

**descripció · es** (128/200)

```text
InDret es una revista en línea para el análisis del derecho, publicada trimestralmente por el Departamento de Derecho de la UPF.
```

**com es va fer · ca**

```text
Es tracta d'una publicació amb molt prestigi dins del món de la recerca en dret a escala hispanoamericana.
Al llarg dels anys hem anat redissenyant i programant el website per anar-nos cenyint a les necessitats del client i als avenços tecnològics.
Actualment està basada en WordPress i conté uns 3.000 articles d'investigadors de moltes universitats d'arreu del planeta.
La meva darrera intervenció va ser la programació de la cerca avançada, i estan en curs un RAG i algunes eines internes per redissenyar i deixar llestos per a la publicació els articles que envien regularment els investigadors.
```

**com es va fer · en**

```text
It is a highly regarded publication in the world of legal research across the Spanish-speaking world.
Over the years we have been redesigning and reprogramming the website to keep up with the client's needs and with technological advances.
It currently runs on WordPress and holds about 3,000 articles by researchers from many universities around the world.
My latest work was coding the advanced search; a RAG and some internal tools are under way to redesign the articles that researchers send in regularly and get them ready for publication.
```

**com es va fer · es**

```text
Se trata de una publicación con mucho prestigio dentro del mundo de la investigación en derecho a escala hispanoamericana.
A lo largo de los años hemos ido rediseñando y programando el website para ir ciñéndonos a las necesidades del cliente y a los avances tecnológicos.
Actualmente está basada en WordPress y contiene unos 3.000 artículos de investigadores de muchas universidades de todo el planeta.
Mi última intervención fue la programación de la búsqueda avanzada, y están en curso un RAG y algunas herramientas internas para rediseñar y dejar listos para la publicación los artículos que envían regularmente los investigadores.
```
