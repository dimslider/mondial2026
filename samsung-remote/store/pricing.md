# Pricing — Pro (`full_unlock`, one-time purchase)

The app is free to download and the basic remote is free forever. The only thing with a price is **Pro**: one in-app product, id `full_unlock`, one-time (non-consumable) – no subscription, no ads. Pro is unlocked free for the first 7 days; after that the app falls back to the free version unless the user buys.

---

## 1. Recommendation

| | Price (USD default) | When |
|---|---|---|
| **Launch price** | **US$2.99** | From the first public release until the app has a solid base of reviews (rule of thumb: 50+ ratings at 4.3★ or more, and about 1–2 months of sales data). |
| **Later test price** | **US$3.99** | Once reviews are in. Run it for at least 2–4 weeks and compare the conversion rate "trial → purchase" and revenue per install against the $2.99 period. Keep whichever earns more per install. |

Why start at $2.99 and not $5.99:
- **New app, no reviews.** With zero ratings the main question a visitor asks is "is this a risk?". A low, impulse-level price removes friction; ratings and installs are worth more than margin in the first months, and Play ranks apps with more installs and good ratings higher.
- **Competitor landscape.** The big third-party remote apps mostly sell **subscriptions – roughly $3–5 per week or $15–30 per year** – and show ads in the free tier. A one-time $2.99 for "pay once, keep it forever" is obviously fairer and easy to say in the listing and in replies to reviews.
- **The official apps are free** (Samsung SmartThings, LG ThinQ, Google TV app). Our basic remote is free too, so the price only has to be justified by the Pro extras (call auto-mute, lock-screen remote, sleep timer, voice, macros, multiple TVs). A price under the "is this worth thinking about?" line ($2.99) works best against free alternatives.
- **Price can go up later, easily.** Raising from $2.99 to $3.99 after the app has reviews is painless (existing buyers keep Pro). Starting high and cutting the price later wastes the launch period.
- $2.99 → $3.99 is a 33% increase; it only pays if conversion drops by less than 25%. That is exactly what the later test checks.

Optional: Play Console offers **price experiments** for in-app products (Monetize with Play → Products → Price experiments, where available for your account). If the option is there, use it for the $2.99 vs $3.99 test instead of switching the whole market manually.

---

## 2. How Play pricing works for a one-time in-app product

- **Where:** Play Console → Monetize with Play → Products → **One-time products** (older UI: In-app products) → `full_unlock` → Purchase option → Price. The product can only be created after an AAB containing the Play Billing library has been uploaded (see the launch checklist, step 5).
- **Default price:** you set **one default price in USD**. Play then generates a local price for every country, **converted at the current exchange rate and including the local tax/VAT** where Play collects tax (e.g. Israel, EU, UK, Australia, India, Japan, Korea…). In the US and Canada the shown price is **before** sales tax, which is added at checkout.
- **Local prices are rounded by Play** to local price patterns, but the straight conversion is often too high for lower-income markets. **You can override any individual country** with your own price (the table below); overridden countries no longer follow later changes of the default price unless you reset them.
- **Price changes are allowed at any time.** A new price applies to new purchases within a few hours. **Existing buyers are unaffected** – a one-time product is owned forever; nobody pays again and nobody is refunded.
- Each currency has a **minimum and maximum price**; Play Console rejects values outside them. If a suggested price below is rejected, use the nearest allowed value.
- **Google's service fee:** **15%** on the first **US$1M** of earnings per year for developers enrolled in the 15% service-fee tier (enrol once under Payments / Account details → "15% service fee tier" – requires setting up the account group), 30% above that. Taxes collected by Google are removed before the fee. Example: US$2.99 sale in the US → about **US$2.54** to you; ₪12.90 sale in Israel (incl. 18% VAT) → ₪10.93 before fee → about ₪9.29 to you.

---

## 3. Suggested local prices (per-country overrides)

These are **suggestions to type into Play Console's per-country override**. They are rounded to natural local price points and, where Play's straight conversion would be too high for local purchasing power, deliberately lowered (marked **PPP**). Exchange rates move: **check the auto-converted value Play Console shows for each country** before overriding, and keep each override within roughly the same ratio to the converted price as shown here.

Columns "Play's straight conversion" are rough approximations (late-2026 order of magnitude, tax included where applicable) only to show why a country is adjusted.

| Country / region | Currency | Tax in shown price | Play's straight conversion ≈ ($2.99 / $3.99) | **Suggested – $2.99 tier** | **Suggested – $3.99 tier** | Note |
|---|---|---|---|---|---|---|
| United States | USD | No (sales tax added at checkout) | $2.99 / $3.99 | **$2.99** | **$3.99** | Default price |
| Israel | ILS ₪ | Yes (VAT 18%) | ₪13 / ₪17.5 | **₪12.90** | **₪16.90** | ₪9.90 is an option for a home-market launch promotion |
| United Kingdom | GBP £ | Yes (VAT 20%) | £2.70 / £3.60 | **£2.79** | **£3.69** | |
| Eurozone (default for € countries) | EUR € | Yes (VAT ~17–25%) | €3.05 / €4.10 | **€2.99** | **€3.99** | One € price for all euro countries |
| – Germany | EUR € | Yes (VAT 19%) | €3.00 / €4.00 | **€2.99** | **€3.99** | Same as Eurozone |
| – France | EUR € | Yes (VAT 20%) | €3.05 / €4.10 | **€2.99** | **€3.99** | Same as Eurozone |
| Canada | CAD | No (tax added at checkout) | CA$4.10 / CA$5.50 | **CA$3.99** | **CA$5.49** | |
| Australia | AUD | Yes (GST 10%) | A$5.00 / A$6.70 | **A$4.99** | **A$6.49** | |
| Poland | PLN zł | Yes (VAT 23%) | 13.5 zł / 18 zł | **9.99 zł** | **12.99 zł** | PPP |
| Turkey | TRY ₺ | Yes (VAT 20%) | ₺145 / ₺195 | **₺59.99** | **₺79.99** | PPP; lira moves fast – re-check every few months |
| India | INR ₹ | Yes (GST 18%) | ₹310 / ₹415 | **₹99** | **₹149** | PPP |
| Brazil | BRL R$ | Yes (taxes incl.) | R$19 / R$25 | **R$7.90** | **R$9.90** | PPP |
| Mexico | MXN | Yes (IVA 16%) | MX$64 / MX$85 | **MX$39** | **MX$49** | PPP |
| Indonesia | IDR Rp | Yes (VAT ~11–12%) | Rp 55,000 / Rp 74,000 | **Rp 19,000** | **Rp 29,000** | PPP |
| Philippines | PHP ₱ | Yes (VAT 12%) | ₱195 / ₱260 | **₱99** | **₱129** | PPP |
| Japan | JPY ¥ | Yes (consumption tax 10%) | ¥490 / ¥650 | **¥400** | **¥500** | Slightly below conversion; round ¥ points convert better |
| South Korea | KRW ₩ | Yes (VAT 10%) | ₩4,500 / ₩6,000 | **₩3,900** | **₩4,900** | |

Other countries: leave Play's automatic conversion, then scan the list once for odd-looking prices (e.g. 3.17) and round them to the nearest natural point (…9, …90, …99).

---

## 4. What to do in Play Console (launch)

1. Product `full_unlock` → default price **US$2.99**.
2. Let Play generate local prices, then override the countries in the table with the **$2.99 tier** column.
3. Activate the product.
4. Later test: change the default to **US$3.99** and the overrides to the **$3.99 tier** column (or run a price experiment). Note the date of the change so that sales before/after can be compared in Play Console → Monetize → Financial reports / Statistics.

Places in the docs that refer to the price point here: `listing-en.md` §6, `listing-he.md` §6, `launch-checklist-he.md` steps 5 and "open items".
