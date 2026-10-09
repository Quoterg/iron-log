# Store listing (Google Play and others)

## Name and short description (≤ 80 characters)

- sv: **Iron Log – näringsdagbok** · "Logga maten, se vitaminer och mineraler. Öppen källkod, ingen spårning."
- en: **Iron Log – nutrition tracker** · "Track food, vitamins and minerals. Open source, no tracking."

## Full description

### Svenska

Iron Log är en snabb och gratis näringsdagbok med öppen källkod.

- Logga maten från Livsmedelsverkets databas (svenska namn och mått som dl, msk och st), USDA
  eller via streckkod (Open Food Facts).
- Se energi, protein, kolhydrater, fett och ett 40-tal vitaminer, mineraler och fettsyror mot de
  nordiska näringsrekommendationerna (NNR 2023), anpassade efter kön, ålder, graviditet och amning.
- Energibehov enligt Katch–McArdle (med fettprocent) eller Mifflin–St Jeor.
- Recept, egna livsmedel och kosttillskott med en daglig checklista.
- Vikt, fettprocent och midjemått med trendlinje; aktiviteter och vatten.
- Rapporter: snitt för dagen, 7 eller 30 dagar, luckor, största källor och svit.
- Inga konton, ingen reklam, ingen spårning: allt sparas på din telefon. Exportera (JSON/CSV) och
  radera när du vill.
- Byggd för att vara snabb även på äldre mobiler, och fungerar offline.

### English

Iron Log is a fast, free, open-source nutrition tracker.

- Log food from the Swedish Food Agency database, USDA FoodData Central, or by barcode (Open Food
  Facts).
- See energy, macros and around 40 vitamins, minerals and fatty acids against the Nordic Nutrition
  Recommendations (NNR 2023), adjusted for sex, age, pregnancy and lactation.
- Energy needs via Katch–McArdle (with body fat) or Mifflin–St Jeor.
- Recipes, custom foods, and supplements with a daily checklist.
- Weight, body fat and waist with a trend line; activities and water.
- Reports: day, 7- and 30-day averages, gaps, top sources and streaks.
- No accounts, no ads, no tracking: everything stays on your phone. Export (JSON/CSV) and delete
  any time.
- Built to be fast on older phones, and works offline.

## Categories and rating

- Category: Health & Fitness. Tags: nutrition, food diary, calorie counter, vitamins.
- Content rating questionnaire: no violence, sexual content, gambling, user-to-user
  communication or location sharing → "Everyone" / PEGI 3.
- Target audience: 18+ (the NNR targets in the app are for adults).

## Data safety form (Google Play)

**Decision (2026-10-09): declare conservatively.** Iron Log has no server and nothing the user
logs ever leaves the device. But two kinds of requests do leave it, and Play counts data sent off
the device — including to third parties — even when the developer never receives it. Declaring
"no data collected" would be arguable at best, and a wrong declaration can get the listing
removed, so we declare what actually leaves the device.

What actually leaves the device:

| Request | Goes to | Contains | When |
|---|---|---|---|
| Barcode lookup | Open Food Facts (world.openfoodfacts.org) | the barcode; the IP address (as any request) | only when the user scans or types a barcode |
| App and food-data files | GitHub Pages (quoterg.github.io) | the IP address (as any request) | loading/updating the app |

Not declared: device-to-device sync (M17) sends the user's data only to another of the user's own
devices, directly and encrypted on the local network, after the user scans a code — no server,
developer or third party receives it. Re-check this against Play's definitions before submitting.

Also not declared: links the user taps (Open Food Facts pages, GitHub issues) open those websites in
the browser; nothing is sent by the app itself.

Also user-initiated (M20b): adding a product to Open Food Facts sends what the user enters (product
name, brand, nutrition), the photos they take and their own OFF username/password to Open Food
Facts, where the product data and photos are published openly.

What we declare on the form:

- **Does your app collect or share any of the required user data types? Yes.**
- **App activity → In-app search history** (the scanned or typed barcode is a product lookup):
  *collected* (sent off the device) and *shared* with Open Food Facts. Processed ephemerally: no
  (we can't promise how OFF logs requests). Required: no — optional, only when the user scans.
  Purpose: **App functionality**. Not used for tracking, ads or analytics; not linked to an
  identity (no accounts).
- **Photos and user-generated content** (product photos and details the user chooses to add to Open
  Food Facts): *shared* with Open Food Facts, optional, user-initiated, purpose App functionality.
  The OFF login is sent with it (needed to publish) and never stored.
- **IP address:** not a data type of its own on the form. It is seen by Open Food Facts and GitHub
  Pages as part of any web request; we don't use it to derive location, so "Location" is not
  declared. This is stated in the privacy policy and here, so the reasoning is public.
- **Health and fitness / personal info** (food log, weight, profile): **not** collected or shared —
  they stay on the device (IndexedDB) and are never transmitted.
- **Encryption in transit:** yes (HTTPS only).
- **Deletion:** users can delete all their data in the app (Settings → Your data). We hold none.
- Privacy policy URL: https://quoterg.github.io/iron-log/privacy.html

The privacy policy (`public/privacy.html`) states the same: the barcode and the IP address go to
Open Food Facts on a lookup, GitHub Pages sees the IP address, camera frames never leave the device.

Re-check this section against Play's current definitions before each submission (they change), and
whenever a feature sends anything new off the device (e.g. M17 sync, M20b uploads):
https://support.google.com/googleplay/android-developer/answer/10787469 ("Provide information for
Google Play's Data safety section"). This is our reading of the rules, not legal advice.

## Graphics checklist

- Icon 512×512: `public/icon-512.png` (check the maskable safe zone).
- Feature graphic 1024×500: to make (green #1f7a4d, logo, "Iron Log").
- Phone screenshots (≥ 2, 1080×1920 or similar): Diary, Nutrients, food search, body chart,
  reports. Take them from the live site in a 360×740 viewport at 3× scale, in Swedish and English.
