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

If you check a row against the printed NNR 2023 tables, move it to the table above (or fix the
value in `targets.ts` and its unit test).

## Energy

- NNR 2023 estimates energy need as BMR × PAL (reference PAL 1.6; 1.4 "low active").
  NNR uses the Henry equations; Iron Log uses **Mifflin–St Jeor**, which agrees within a few
  percent for adults.
- Pregnancy +0.3 / +1.2 / +2.3 MJ per day (trimester 1/2/3) and exclusive breastfeeding
  +2.0 MJ per day, from DTU Food's 2025 summary of NNR 2023 (secondary source). The pregnancy
  add-ons assume **pre-pregnancy weight**, which is what the app asks for while pregnant.
