# OBLICK — Seriearkiv

En fristående, statisk webbapp för ett personligt seriearkiv.

## Funktioner
- Affischvy och kompakt listvy
- Sökning, filtrering och sortering
- Statusarna **Påbörjat** och **Sett klart**
- Separat vy för **Min lista**
- Räknare för arkivet och statusar
- Export/import av statusval som JSON
- Statusar sparas i webbläsarens localStorage

## Publicering
Webbappen finns i `index.html`. För att publicera via GitHub Pages: öppna **Settings → Pages**, välj **Deploy from a branch**, välj `main` och `/(root)`, och spara. Publicerad webbplats kan ta en liten stund att bli tillgänglig.

## Viktigt om integritet
Repositoryt är publikt, så källkoden kan ses av andra. Statusvalen sparas lokalt i webbläsaren och skickas inte till GitHub av appen, men de synkas inte mellan enheter och är inte ett inloggningsskydd. Om webbplatsen ska vara helt privat behöver vi välja en hostinglösning med åtkomstkontroll.

## Serieinnehåll
Den första versionen innehåller exempelposter för att göra gränssnittet testbart. Ersätt listan `SERIES` i `index.html` med din fullständiga serielista för att få in hela ditt arkiv. Statusar knyts till seriens titel, så behåll stavningen oförändrad om du vill behålla redan sparade statusval.
