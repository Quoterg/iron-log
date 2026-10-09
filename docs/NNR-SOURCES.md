# Where the targets come from

Iron Log's daily targets (`src/lib/targets.ts`) follow the **Nordic Nutrition Recommendations 2023**
(NNR 2023, [pub.norden.org/nord2023-003](https://pub.norden.org/nord2023-003/)), tables 12–15
(RI and AI for vitamins and minerals).

## Primary transcription source

The values were transcribed on **2026-10-09** from the Norwegian Directorate of Health's official
NNR 2023 reference-value tables (tables 8–12, "Vitaminer og mineraler"), which reproduce the
NNR 2023 values per sex, age band, trimester and lactation:
<https://www.helsedirektoratet.no/rapporter/referanseverdier-for-energi-og-naeringsstoffer>

The Nordic report itself blocks automated retrieval (HTTP 403), so not every row could be
machine-checked against it.

## Cross-checked against the NNR 2023 report

| Values | NNR 2023 location | Status |
|---|---|---|
| Pregnancy trimester 1: calcium 950 mg, iron 24 mg, zinc 9.7 mg | Table 14 (RI minerals) | ✅ matches |
| Pregnancy trimesters 2–3: iron 25/26 mg, zinc 12.1 mg | Table 14 | ✅ matches |
| Lactation: calcium 950 mg, iron 15 mg, zinc 12.6 mg | Table 14 | ✅ matches |
| Pregnancy folate 600 µg (AI) | Folate chapter | ✅ matches |
| Pregnancy trimester 3 and lactation: iodine 200 µg | Table 15 (AI minerals) | ✅ matches |
| Adults: folate 330 µg | Folate chapter | ✅ matches |
| Older adults (>65): protein 15–20 E% | Box 8, as corrected in the 2023 erratum | ✅ matches |
| Females 15–17: riboflavin 1.6 mg (erratum) | Table 12 | n/a (app starts at 18) |

## Transcribed from Helsedirektoratet only (manual spot-check welcome)

- All 18–24 / 25–50 / 51–70 / 71+ vitamin and mineral rows not listed above.
- Pregnancy trimesters 1–2: iodine 175 / 200 µg; selenium 80 / 85 / 90 µg; vitamin E 10 / 11 / 12 mg;
  riboflavin, B6, B12, vitamin A, vitamin C in pregnancy.
- Lactation: vitamin A 1400 µg, folate 490 µg, vitamin C 155 mg, B12 5.5 µg, riboflavin 2.0 mg,
  B6 1.7 mg, iodine 200 µg, selenium 85 µg.
- M16 (retrieved 2026-10-09, Helsedirektoratet chapter 3.3 "Vitaminer og mineraler"):
  vitamin K AI (table 9) women 65 µg (60 from 51), men 75 µg (70 from 51), pregnancy 65/70/75,
  lactation 65; pantothenic acid AI 5 mg (lactation 7); biotin AI 40 µg (lactation 45);
  copper RI (table 10) 900 µg (pregnancy 1000, lactation 1300); manganese AI (table 11) 3.0 mg.

If you check a row against the printed NNR 2023 tables, move it to the table above (or fix the
value in `targets.ts` and its unit test).

## Energy

Energy need follows **[tdeecalculator.net](https://tdeecalculator.net/)** (chosen by the project
owner), reproduced exactly:

- **With body fat %: Katch–McArdle**, BMR = 370 + 21.6 × lean body mass (kg), where lean body
  mass = weight × (1 − body fat %).
- **Without body fat: Mifflin–St Jeor**, BMR = 10 × kg + 6.25 × cm − 5 × age + 5 (men) / − 161 (women).
- **TDEE = BMR × activity multiplier**: sedentary 1.2 (default for new profiles, as on the site),
  light 1.375, moderate 1.55, heavy 1.725, athlete 1.9; rounded to whole kcal.
- This replaces NNR 2023's own method (Henry equations × PAL, reference PAL 1.6 ≈ between
  "light" and "moderate" here) by the **project owner's decision** (2026-10-09). Sedentary as the
  default gives lower targets than NNR's reference; users should pick their real activity level.
- Profiles saved before the change were migrated once: an unset level (= NNR 1.6) became
  moderate 1.55, others the nearest level; users whose automatic target changed see a notice.
- Verified against the site on 2026-10-09 (pinned in `targets.test.ts`): man 30 y, 80 kg, 180 cm,
  moderate → 2,759 kcal, with 20 % body fat → 2,716; woman 40 y, 65 kg, 168 cm, sedentary →
  1,607, with 30 % body fat → 1,623.
- The site has no pregnancy adjustment; Iron Log adds NNR 2023's extra energy on top:
  +0.3 / +1.2 / +2.3 MJ per day (trimester 1/2/3) and +2.0 MJ per day for exclusive breastfeeding
  (DTU Food's 2025 summary of NNR 2023, secondary source). These assume **pre-pregnancy weight**,
  which is what the app asks for while pregnant.
