# Screenshots & feature graphic plan

Target folder for the finished images: `store/screenshots/` (phone) and `store/feature-graphic.png`.

## Technical specs (Google Play)
- **Phone screenshots:** PNG or JPEG (no transparency), 16:9 or 9:16, each side between 320 px and 3840 px, long side max 2× the short side. Recommended: **1080 × 1920** (portrait) or 1080 × 2340. Play needs at least 2; upload all 8. For the app to be eligible for richer placements Play asks for at least 4 screenshots of ≥1080 px.
- **Feature graphic:** **1024 × 500** PNG or JPEG, no transparency.
- Layout for each screenshot: caption on top (large, bold, 2 lines max), real app screen below inside a simple phone frame, dark background matching the app's dark design.
- One English set for every store language (international audience); the listing text is localized and says the app is available in English and Hebrew.

## Policy guardrails for graphics
- No brand logos or brand names in the captions or the feature graphic. A real app screen may naturally show the TV's model name in the device list – keep it neutral (e.g. rename the TV to "Living room" before capturing).
- No "free", "no ads", "#1", "best", prices or "download now" text on the images (Play's store-listing rules for preview assets). Keep those messages in the descriptions.
- Screens must be the real app, not mock features.
- **Free vs Pro must be clear.** The basic remote is free forever; Pro is a one-time purchase (free for the first 7 days). Screenshots that show a Pro feature (2, 3, 5, 6, 7 and the multi-TV list/widget in 8) get a small **"PRO"** badge next to the caption – never present a Pro feature as free. The word "PRO" is a feature label, not a promotional/price claim, so it is allowed on the images. Capture Pro screens during the 7-day trial (or with a license-tester account that bought Pro).

## The 8 phone screenshots (in this order)

| # | Screen to capture | Caption EN (≤6 words) | Caption HE (≤6 words) | Free / Pro |
|---|---|---|---|---|
| 1 | Main remote screen, full layout (power, d-pad, volume/channel, colour keys), connected to "Living room" TV | Your TV, right on your phone | הטלוויזיה שלכם, מהטלפון | Free |
| 2 | Call auto-mute settings screen with the switch ON, ideally with an incoming-call overlay composited above it | Phone rings? The TV hushes. | מתקשרים? הטלוויזיה משתתקת | PRO badge |
| 3 | Phone lock screen showing the notification remote (power, volume, mute, play/pause, X) | Remote right on your lock screen | השלט כבר על מסך הנעילה | PRO badge |
| 4 | Simple mode – few, big buttons | Simple mode: big, clear buttons | מצב פשוט: כפתורים גדולים וברורים | Free |
| 5 | Voice: listening dialog, plus the apps panel / shortcut buttons behind it | Say an app – it opens | אומרים אפליקציה – והיא נפתחת | PRO badge (voice; the apps panel itself is free) |
| 6 | Macro recorder: a recorded sequence of key presses with "play" and voice-trigger options | Many presses, one tap | הרבה לחיצות, נגיעה אחת | PRO badge |
| 7 | Sleep timer picker with presets + the countdown notification | Falls asleep? TV turns off. | נרדמתם? הטלוויזיה נכבית | PRO badge |
| 8 | TV list with 2–3 renamed TVs ("Living room", "Bedroom", "Kids' room") + home-screen widget / Quick Settings tiles inset | All your TVs. No account. No tracking. | כל הטלוויזיות. בלי חשבון, בלי מעקב | PRO badge (multiple TVs, widget, tile) |

Caption 1 was changed from "One fast remote for all your TVs" (multiple TVs is a Pro feature) – the caption is already updated in `tools/make-screenshots.js` – regenerate `en-1.png` (and add the PRO badges, which the script does not draw yet) before uploading.

Word counts (checked with a script, punctuation excluded): EN 6, 5, 6, 5, 5, 4, 5, 7 · HE 3, 3, 5, 5, 4, 4, 3, 6.

Tips
- Capture on a clean phone: full battery, no other notifications, time set to something neutral like 20:30.
- Screenshot 2 is the hero message – if you can only polish one, polish this one.
- Keep captions identical in meaning between EN and HE so the sets stay in sync.

## Feature graphic (1024 × 500)

Layout: dark background, phone with the main remote on the right (in the HE version: on the left, text on the right), headline + subline on the other side. Keep important content inside the central safe area – Play may crop the edges or overlay a play button if a promo video is added.

| | English | Hebrew |
|---|---|---|
| Headline | The advanced remote for your smart TVs | השלט שמשתיק את הטלוויזיה כשמתקשרים |
| Subline | Fast · Clean · Mutes the TV when you get a call | שליטה ב-Wi-Fi · שלט במסך הנעילה · פרטי |

(Keep "No ads" / "free" / "one-time purchase" out of the graphic per the guardrails above; the descriptions carry those points, including the FREE FOREVER vs PRO split. The subline mentions call muting and the lock-screen remote, which are Pro – acceptable on the graphic because it makes no price claim, and the listing marks them as Pro.)
