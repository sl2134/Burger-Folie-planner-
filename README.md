# Burger Folie Timeplanning

Gratis lokale planning-app voor Burger Folie.

## iPhone

Open de GitHub Pages link in Safari en kies:

`Deel` > `Zet op beginscherm`

## GitHub Pages

Zet deze bestanden in de hoofdmap van een GitHub repository:

- `index.html`
- `app.css`
- `launch.css`
- `app.js`
- `extras.js`
- `sync.js`
- `sw.js`
- `manifest.webmanifest`
- `.nojekyll`
- `assets/`

Schakel daarna GitHub Pages in via:

`Settings` > `Pages` > `Deploy from a branch` > `main` > `/root`

## Opslag

Planninggegevens worden lokaal opgeslagen in de browser van het toestel.

## Sync tussen toestellen (optioneel)

`sync.js` kan de planning (personen + shifts) automatisch delen tussen
toestellen door ze op te slaan in `data/planning.json` in deze repository.
Dit staat standaard uit.

Om het aan te zetten:

1. Maak een **fine-grained personal access token** op
   `https://github.com/settings/personal-access-tokens/new`:
   - Resource owner: jouw account
   - Repository access: alleen deze ene repository
   - Permissions: `Contents` -> `Read and write` (verder niets)
2. Open `sync.js` en vervang `PASTE_YOUR_FINE_GRAINED_GITHUB_TOKEN_HERE`
   door dat token.
3. Commit en push.

**Belangrijk:** dit token staat gewoon leesbaar in `sync.js`, een publiek
bestand dat elke bezoeker van de site kan bekijken (via "Inspect element"
of "View source"). Gebruik daarom altijd een token dat **alleen** toegang
heeft tot deze ene repository ("Contents: Read and write"), nooit een
classic token of een token met bredere rechten - anders kan iedereen met
de link ermee in je andere repositories of accountinstellingen komen.
