# Loser Tracker

An Android app for daily calories, weight and waist. It shares Habby's Supabase
project and login.

## Install

Download `release/loser-tracker-1.0.1.apk` on the phone and open it. Android
will ask to allow installing apps from your browser or file manager the first
time. Later versions install over the top and keep you signed in.

## One-time Supabase step

Run `../supabase_migrations/add_waist_to_daily_health.sql` in the Supabase SQL
editor. It adds a `waist` column; everything else reuses Habby's tables:

| What | Where |
| --- | --- |
| Food items per day | `daily_health.meals` (same shape Habby used) |
| Weight, waist | `daily_health.weight`, `daily_health.waist` |
| Saved foods | `saved_meals` |
| Limits, fine emails, fine history | `app_settings.settings_data.loser_tracker` |
| Sent fine emails (once each) | `habit_alert_log` |

Fine emails go through Habby's `/api/send-accountability-email` on
`habby-gitty.vercel.app`, so Brevo needs no extra setup.

## How fines work

Months are 4-week blocks from the start Monday in Settings (30 Nov 2026 by
default). Daily and weekly limits are colour guides only. A month that ends
over the monthly limit owes calories over × ₹10 (configurable). The next month
is its recovery month: each calorie it ends under the limit wipes ₹10 off.
Whatever is left is emailed to the chosen people the first time the app is
opened after the recovery month ends. Being under never builds a balance.

## Build

Needs Node 20+, JDK 21 and the Android SDK (platform 35).

```sh
npm install
npm test                 # fine, voice and calendar logic
npm run apk              # → android/app/build/outputs/apk/release
```

The project's signing key is `android/keystore/loser-tracker.jks`. Keep using
it, or Android will refuse to install a new APK over the old one.
