# Hypiva live zetten: stap voor stap

Je hoeft niet te programmeren. Volg de stappen in deze volgorde.

## 1. Database (Supabase), ongeveer 10 minuten

1. Maak een gratis account op **supabase.com** en klik op **New project**.
   - Naam: `hypiva`
   - Regio: **West EU (Ireland)** of **Central EU (Frankfurt)**
   - Kies een sterk database-wachtwoord en bewaar het goed.
2. Open in je project **SQL Editor** → **New query**.
3. Open het bestand `supabase/migrations/0001_init.sql`, kopieer alles, plak het erin en klik op **Run**.
   Doe daarna hetzelfde met `0002_referrals.sql` (uitnodigingen) en `0003_rates_and_weeks.sql` (eigen tarieven en weekoverzicht) `0004_bonuses_and_leaderboard.sql` (bonussen en ranglijst) `0005_exchange_rate.sql` (euro-bedragen), `0006_content.sql` (kant-en-klare content) en `0007_privacy_hardening.sql` (extra beveiliging), `0008_lock_functions.sql`, `0009_auto_views.sql` (automatische views), `0010_pay_models_and_languages.sql` (betaalvorm en taal), `0011_creator_language.sql` (taal per creator), `0012_owner_verify_signups.sql` (eigenaar, verificatie, meldingen) `0013_fix_period_start.sql` en `0014_hide_costs_from_brands.sql`, in die volgorde.
   Nu staan alle tabellen, beveiligingsregels en de berekening per video klaar.
4. Ga naar **Project Settings → API** en kopieer:
   - **Project URL**
   - **anon public** key
5. Maak in de projectmap een bestand `.env` (kopieer `.env.example`) en vul die twee waarden in.

## 2. De website online zetten (gratis, ongeveer 15 minuten)

Dit is dezelfde app, als website. Creators openen hem in de browser op hun telefoon; jij beheert alles via dezelfde site. Geen App Store nodig, dus geen €99.

1. Zet de code op **GitHub** (maak een leeg project `hypiva` en upload de map, of laat Claude dat doen).
2. Maak een gratis account op **vercel.com** en log in met GitHub.
3. Klik **Add New → Project** en kies `hypiva`. Vercel leest `vercel.json` en weet dan zelf hoe hij moet bouwen.
4. Open **Environment Variables** en vul in:
   - `EXPO_PUBLIC_SUPABASE_URL` = je Project URL uit Supabase
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = je anon public key uit Supabase
5. Klik **Deploy**. Na een paar minuten staat de site op iets als `hypiva.vercel.app`.
6. Ga in Supabase naar **Authentication → URL Configuration** en zet je websiteadres bij **Site URL**, zodat links in e-mails (wachtwoord vergeten) goed werken.
7. Eigen domein (bijvoorbeeld `hypiva.com`)? Voeg het toe in Vercel onder **Settings → Domains**.

Elke keer dat de code op GitHub verandert, zet Vercel de nieuwe versie vanzelf online.

**Op de telefoon als app:** creators openen de site in Safari, tikken op **Delen → Zet op beginscherm**. Dan staat Hypiva als icoon tussen hun apps.
**Slides opslaan op de website:** "Alles opslaan" opent het deelmenu van de telefoon, met **Bewaar afbeelding** (iPhone) om ze in Foto's te zetten.

Netlify werkt ook (het bestand `netlify.toml` staat klaar), op dezelfde manier.

## 3. Jezelf eigenaar maken (admin-toegang)

1. Open de website (of de app) en maak een account aan met je eigen e-mailadres.
2. Ga in Supabase naar **SQL Editor**, plak `supabase/owner.sql`, vervang het e-mailadres door dat van jou en klik op **Run**.
3. Log opnieuw in. Je ziet nu de admin-schermen: **Money, Videos, Campaigns en People**.

Alleen jij kunt nu iemand de rol **Brand** of **Admin** geven, via **People**. Iedereen die zich aanmeldt is eerst **Creator**.

## 4. De app testen op je iPhone (later, voor de App Store)

1. Installeer **Expo Go** uit de App Store.
2. Op een computer met de code: `npm install` en daarna `npx expo start`.
3. Scan de QR-code met je camera. De app opent in Expo Go.

## 5. In de App Store (later)

Nodig: **Apple Developer-account** (€99 per jaar). Met je KvK meld je je aan als **organisatie**, zodat er "Hypiva" als maker staat. Apple vraagt daarvoor een gratis **D-U-N-S-nummer**, dat je aanvraagt via de Apple-aanmeldpagina. Reken op een paar dagen.

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

## Kant-en-klare content (zoals Vyral)
- Admin of merk: **Campaigns → Content & checklist** bij een campagne.
  - **Edit**: schrijf de uitleg ("How to get started") en de checklist (één regel per eis). Creators moeten alles aanvinken voordat ze kunnen insturen.
  - **Add content**: kies afbeeldingen (of plak een link), zet bij elke slide de tekst die erop moet, en vul de titel, beschrijving en hashtags in.
- Creator: tik op een campagne → **Start posting** → kies het TikTok-account → **Save all** (slides naar de foto's) en **Copy caption** → posten op TikTok → **Paste link**, checklist afvinken → **Send for review**.
- Elk TikTok-account krijgt steeds content die het nog **niet** heeft gepost. Bij de content zie je hoe vaak die al gepost is. Zet genoeg content klaar zodat accounts niet opraken.
- Afbeeldingen worden opgeslagen in Supabase Storage (bucket `content`, wordt vanzelf aangemaakt door de migratie).

## Taal
- De app kiest automatisch de taal van de telefoon: **Nederlands** voor Nederlandse telefoons, anders **Engels**.
- Creators wisselen zelf onder **Profile → Account → Language/Taal**.
- Teksten die jij of een merk schrijft (campagnenaam, uitleg, checklist, prijs-tekst, content) worden getoond zoals je ze typt. Schrijf die voor buitenlandse creators in het Engels.
- Een nieuwe taal toevoegen: kopieer `src/lib/i18n.nl.ts` naar bijvoorbeeld `i18n.de.ts`, vertaal de teksten en voeg de taal toe in `src/lib/i18n.tsx`. `npm run check:i18n` laat zien of er iets mist.

## Betalen in euro's
- Alle bedragen in de app zijn in **dollars** (bijvoorbeeld $2 per 1.000 views).
- Je maakt over vanuit je Nederlandse bank. Stel daarom één keer de koers in onder **People → Dollars and euros** (bijvoorbeeld 0.86 als $1 = €0,86). Pas die af en toe aan.
- Daarna laat **Money** bij elke creator zien: **"Transfer from your bank: €77,40"**. Dat bedrag maak je over naar hun IBAN, en daarna tik je op **Mark as paid**.
- Creators zien de koers niet; zij zien hun bedragen in dollars.

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
- Elke creator heeft een eigen code (bijvoorbeeld `HYCJZWPB`) onder **Profile → Your creator code**, met een knop om te kopiëren en te delen.
- Wie zich aanmeldt met die code, levert de uitnodiger een bonus op: standaard **5% van hun goedgekeurde verdiensten, 6 maanden lang, tot maximaal $93 (ongeveer €80) per persoon**. De nieuwe creator levert daar zelf niets voor in.
- Iemand kan de code ook later nog toevoegen, tot 14 dagen na het aanmelden. Eigen codes en dubbel gebruik worden geweigerd.
- Promotie van codes via advertenties, spam, reacties of DM's naar onbekenden, of op kortings- en winactiesites, is niet toegestaan (staat op het uitnodigingsscherm). Zie je misbruik, verwijder dan de uitnodiging of geef een min-bonus.
- De bonus telt automatisch mee in **Money**. Onder **Invites** zie je per uitnodiger wie ze hebben binnengebracht en wat het oplevert.
- De regels (percentage, maanden, maximum, dagen) pas je aan onder **People → Invite program**. Alleen jij als eigenaar kunt dat.

## Views: gaan vanzelf
- Een creator plakt de TikTok-link. Elke 3 uur haalt de server (Supabase-functie `refresh-views`) van alle video's van de laatste 60 dagen de nieuwe views op.
- Hij controleert ook of de video echt van het gekoppelde TikTok-account van die creator is. Zo niet, dan telt hij niet mee en zie je bij **Video's** een ⚠ met de reden.
- Views gaan nooit omlaag door een leesfout. Klopt er iets niet, typ dan zelf het juiste getal bij **Video's**.
- **Refresh views now** bij Video's haalt meteen nieuwe views op.
- Staat een video op privé of is hij verwijderd, dan zie je dat ook bij de ⚠.

## Betaalvorm per campagne
- Bij **Campaigns → New** of **Pay & budget** kies je per campagne:
  - **Per 1K views**: bijvoorbeeld $2 per 1.000 views, pas vanaf het minimum per video.
  - **Fixed per video**: bijvoorbeeld $5 per goedgekeurde video. Zet het minimum op 0 om elke goedgekeurde video te betalen, of op bijvoorbeeld 1.000 om alleen video's met genoeg views te betalen.
- Je kunt dit altijd aanpassen, per klant en budget. Het nieuwe bedrag geldt voor alle video's in die campagne, ook eerdere. Laat het je creators dus weten.
- Een vast bedrag per maand geef je met een **bonus** (Money → creator → Give a bonus).
- Alleen jij (admin) kunt het tarief, minimum en budget van een campagne wijzigen. Merken kunnen hun campagne wel pauzeren.

## Content in meerdere talen
- **Creators kiezen één keer hun taal**: bij het aanmelden ("In welke taal post je?") en later aan te passen onder **Profiel**. Daarna krijgen ze altijd content in die taal, zonder bij elke post te kiezen. Een Nederlandse creator krijgt Nederlandse posts, een Duitse creator Duitse.
- **Jij voegt content in één keer toe voor alle talen** (Campaigns → Content & checklist → Add content):
  1. Kies de afbeeldingen (die zijn in elke taal hetzelfde).
  2. Vink de talen aan. De eerste is de taal waarin je schrijft.
  3. Schrijf titel, beschrijving en tekst per slide, en tik op **Translate** om de andere talen automatisch te laten invullen. Lees ze even na.
  4. Hashtags gelden voor alle talen. Tik op **Save in X languages**.
- Is er voor een campagne nog geen content in de taal van een creator, dan ziet die creator dat netjes en krijgt hij geen post in een andere taal.

### Automatisch vertalen aanzetten (DeepL, gratis)
1. Maak een gratis account op **deepl.com/pro-api** (kies **DeepL API Free**, 500.000 tekens per maand).
2. Kopieer je **Authentication Key** (eindigt op `:fx`).
3. In Supabase: **Edge Functions → Secrets → Add new secret**: naam `DEEPL_API_KEY`, waarde je sleutel.
Klaar. De knop **Translate** werkt dan meteen. Zonder sleutel kun je de talen gewoon zelf invullen.

## Jij als eigenaar
- Meld je aan op de site met **patrickkruiger@icloud.com** en bevestig je e-mail. Je wordt dan vanzelf **eigenaar en admin**. Dit werkt maar één keer: zodra er een eigenaar is, kan niemand anders dat worden, ook niet met hetzelfde e-mailadres.
- Het eigenaar-adres staat in de database (tabel internal.settings) en kan alleen via Supabase worden veranderd.

## Mail op @hypiva.com
- Kies een mailbox voor je domein, bijvoorbeeld **iCloud+ Aangepast e-maildomein** (zit in iCloud+), **Google Workspace** (ongeveer €7 per maand) of **Zoho Mail** (gratis).
- Die dienst geeft je een paar DNS-regels (MX en TXT). Zet die in Vercel onder **Domains → hypiva.com → DNS Records**.

## Nieuwe aanmeldingen
- Onder **People** staat bovenaan hoeveel mensen zich deze week hebben aangemeld, en nieuwe mensen hebben een label **New**.
- Wil je ook een e-mail bij elke aanmelding: maak een gratis account op **resend.com**, voeg daar het domein hypiva.com toe (de DNS-regels die Resend geeft zet je in Vercel), en zet in Supabase onder **Edge Functions → Secrets** de secret `RESEND_API_KEY`. Dan krijg je bij elke aanmelding een mail op patrick@hypiva.com.
- Tip: gebruik Resend ook als **SMTP** in Supabase (**Authentication → Emails → SMTP Settings**), dan komen bevestigingsmails van noreply@hypiva.com en is er geen limiet van een paar mails per uur.

## Accounts verifiëren (tegen fraude)
- Elk TikTok-account krijgt een code (bijvoorbeeld `HY-3F9A2C`). De creator zet die in zijn TikTok-bio en tikt op **Check**; de site controleert het zelf en zet het account op **Verified**.
- Bij het beoordelen van video's zie je **✓ Account verified** of **⚠ Account not verified yet**. Keur video's van niet-geverifieerde accounts alleen goed als je zeker weet dat het account van die creator is.

## Campagnes van merken
- Een campagne die een merk zelf aanmaakt, staat eerst op **pauze**. Jij controleert het bedrag en zet hem live (Campaigns → Make live). Merken kunnen hun campagne wel zelf pauzeren, maar niet het bedrag, minimum of budget wijzigen.

## De website
- **hypiva.com** is de homepage voor klanten (merken), met een knop die je mailt op patrick@hypiva.com. Tekst en plaatjes staan in `public/home.html` en `public/landing/`. Vraag Claude om ze aan te passen.
- De app zit op **hypiva.com/sign-in**. Creators melden zich aan via **Start earning**.
- Supabase: zet onder **Authentication → URL Configuration** de **Site URL** op `https://hypiva.com` en voeg bij **Redirect URLs** `https://hypiva.com/**` toe. Dan werken de links in de mails voor account bevestigen en wachtwoord vergeten.

## Klanten betalen een budget
- Klanten (merken) spreken met jou één budget per campagne af, bijvoorbeeld $40.000. Daaruit betaal jij de creators.
- Klanten zien in de app alleen hun **budget, views en video's**. Ze zien niet wat creators per video of per 1.000 views krijgen, en ook niet hoeveel daarvan al naar creators is gegaan. Dat is jouw marge.
- Vraagt een klant zelf een campagne aan, dan vult hij alleen naam, uitleg en budget in. Jij stelt daarna onder **Campaigns → Pay & budget** in wat creators krijgen, en zet de campagne live.
