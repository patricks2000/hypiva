# Viewtra live zetten: stap voor stap

Je hoeft niet te programmeren. Volg de stappen in deze volgorde.

## 1. Database (Supabase), ongeveer 10 minuten

1. Maak een gratis account op **supabase.com** en klik op **New project**.
   - Naam: `viewtra`
   - Regio: **West EU (Ireland)** of **Central EU (Frankfurt)**
   - Kies een sterk database-wachtwoord en bewaar het goed.
2. Open in je project **SQL Editor** → **New query**.
3. Open het bestand `supabase/migrations/0001_init.sql`, kopieer alles, plak het erin en klik op **Run**.
   Doe daarna hetzelfde met `0002_referrals.sql` (uitnodigingen) en `0003_rates_and_weeks.sql` (eigen tarieven en weekoverzicht) en `0004_bonuses_and_leaderboard.sql` (bonussen en ranglijst), in die volgorde.
   Nu staan alle tabellen, beveiligingsregels en de berekening per video klaar.
4. Ga naar **Project Settings → API** en kopieer:
   - **Project URL**
   - **anon public** key
5. Maak in de projectmap een bestand `.env` (kopieer `.env.example`) en vul die twee waarden in.

## 2. Jezelf eigenaar maken

1. Start de app (zie stap 3) en maak een account aan met je eigen e-mailadres.
2. Ga in Supabase naar **SQL Editor**, plak `supabase/owner.sql`, vervang het e-mailadres door dat van jou en klik op **Run**.
3. Log opnieuw in. Je ziet nu de admin-schermen: **Money, Videos, Campaigns en People**.

Alleen jij kunt nu iemand de rol **Brand** of **Admin** geven, via **People**. Iedereen die zich aanmeldt is eerst **Creator**.

## 3. De app testen op je iPhone

1. Installeer **Expo Go** uit de App Store.
2. Op een computer met de code: `npm install` en daarna `npx expo start`.
3. Scan de QR-code met je camera. De app opent in Expo Go.

## 4. In de App Store

Nodig: **Apple Developer-account** (€99 per jaar). Met je KvK meld je je aan als **organisatie**, zodat er "Viewtra" als maker staat. Apple vraagt daarvoor een gratis **D-U-N-S-nummer**, dat je aanvraagt via de Apple-aanmeldpagina. Reken op een paar dagen.

1. Maak een gratis account op **expo.dev**.
2. In de projectmap:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest build --platform ios --profile production
   ```
   EAS bouwt de app online, je hebt geen Mac nodig. Log in met je Apple-account als erom gevraagd wordt.
3. Upload naar Apple:
   ```bash
   npx eas-cli@latest submit --platform ios
   ```
4. In **App Store Connect** (appstoreconnect.apple.com):
   - **TestFlight**: installeer de app eerst zelf en test alles.
   - Vul in: naam, beschrijving, screenshots, privacybeleid-URL, support-URL en leeftijdsclassificatie.
   - **Review-account**: geef Apple een test-login (creator), anders keuren ze de app af.
   - Klik op **Submit for Review**. Meestal duurt dat 1 tot 3 dagen.

### Waar Apple op let (zit er al in)
- Mensen kunnen hun **account verwijderen** in de app (Profile → Delete account).
- Er wordt niets verkocht in de app, dus in-app aankopen zijn niet nodig. Creators krijgen geld van jou; dat is toegestaan.

## Hoe het geld werkt
- Per campagne stel je in: **bedrag per 1.000 views** (bijvoorbeeld $2) en het **minimum per video** (standaard 1.000).
- Een video verdient pas als **die video zelf** het minimum haalt. Views van verschillende video's worden nooit opgeteld.
  - 3 video's met 500, 800 en 1.000 views → alleen de laatste telt → **$2,00**
  - 1.500 views op één video → **$3,00**
- Alleen **goedgekeurde** video's tellen mee.
- **Money** laat per creator zien wat je nog moet betalen. Tik op iemand voor de berekening per video en het PayPal-adres of IBAN. Maak het geld over, tik op **Mark as paid** en het saldo gaat naar $0.

## Eigen tarief per creator
- Standaard krijgt iedereen het tarief van de campagne (bijvoorbeeld $2 per 1.000 views).
- Wil je iemand $1 geven? **Money → tik op de creator → Set a special rate**. Kies **All campaigns** of één campagne, vul het bedrag in (en eventueel een ander minimum).
- De creator ziet zijn eigen tarief op de campagnekaart ("your rate"). Alles wordt meteen opnieuw berekend.
- Let op: het nieuwe tarief geldt ook voor video's die al gepost zijn. Stel het dus het liefst in voordat iemand begint.

## Per week
- **Money → Per week** laat per week (maandag t/m zondag) zien wat alle creators samen verdiend hebben. Tik op een week voor de lijst per creator, en kopieer die naar Excel.
- Dit werkt doordat de app elke keer onthoudt hoeveel views een video had. Groeit een video van 800 naar 3.000 views, dan telt de groei mee in die week.

## Bonus geven en ranglijst
- **Bonus**: Money → tik op een creator → **Give a bonus**. Kies een reden (bijvoorbeeld "Top creator of September") en een bedrag. De creator ziet de bonus met de reden in de wallet, en het bedrag telt mee in wat je moet betalen. Vergist? Tik op **Remove**, of geef een min-bedrag (bijvoorbeeld -10).
- **Ranglijst**: Money → **Top creators** toont wie deze of vorige maand de meeste views heeft gehaald. Tik op iemand om meteen een bonus te geven.
- De ranglijst staat standaard **alleen voor jou** aan. Wil je creators motiveren? Tik op **Show leaderboard to creators** en vul een prijs in, bijvoorbeeld "$50 for the #1 creator of the month". Creators zien dan alleen voornamen en views, nooit geld.

## Uitnodigingen (creator code)
- Elke creator heeft een eigen code (bijvoorbeeld `VTCJZWPB`) onder **Profile → Your creator code**, met een knop om te kopiëren en te delen.
- Wie zich aanmeldt met die code, levert de uitnodiger een bonus op: standaard **5% van hun goedgekeurde verdiensten, 6 maanden lang, tot maximaal $100 per persoon**. De nieuwe creator levert daar zelf niets voor in.
- Iemand kan de code ook later nog toevoegen, tot 14 dagen na het aanmelden. Eigen codes en dubbel gebruik worden geweigerd.
- De bonus telt automatisch mee in **Money**. Onder **Invites** zie je per uitnodiger wie ze hebben binnengebracht en wat het oplevert.
- De regels (percentage, maanden, maximum, dagen) pas je aan onder **People → Invite program**. Alleen jij als eigenaar kunt dat.

## Views bijwerken
Tot TikTok de koppeling goedkeurt, vul je de views in bij **Videos → Update views**. Het bedrag onder elk getal verandert meteen.
Automatisch views ophalen via de TikTok-API kan later worden toegevoegd.
