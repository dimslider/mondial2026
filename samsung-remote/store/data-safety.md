# Play Console: App content answers

Everything below is under **Play Console → (your app) → Policy and programs → App content** unless stated otherwise. Answers match the app as built: no account, no ads, no analytics/crash SDKs, no servers; commands go only to the user's own TV on the LAN.

> Before submitting, confirm with the developer that no analytics, crash-reporting (e.g. Firebase Crashlytics) or ads SDK was added to the build. If one ever is, these answers must change.

---

## 1. Data safety form

### Step 1 – Data collection and security

| Question | Answer | Justification (one line) |
|---|---|---|
| Does your app collect or share any of the required user data types? | **No** | Nothing is transmitted to the developer or any third party; commands go only from the phone to the user's own TV on the local network. |

Answering **No** ends the questionnaire: the "Encrypted in transit" and "Deletion request" questions are not shown, and the listing will display **"No data collected"** and **"No data shared with third parties"**.

Notes that justify "No", in case of a review question:
- **Commands/text sent to the TV:** user-initiated, sent directly to a device the user owns on their own network – not to the developer or a third party. No server is involved.
- **Pairing token/certificate, TV list, settings, macros, trial status:** stored only on the device. Google defines data processed only on the device as not "collected".
- **Speech recognition:** done by the phone's system speech service (launched by intent); the app only receives the recognised text from the OS and does not transmit it anywhere except to the user's TV on request.
- **Call state (READ_PHONE_STATE):** read on-device only to trigger mute/pause; nothing is stored or transmitted; no numbers or call logs are read.
- **Purchases:** processed by Google Play Billing. The developer does not receive payment details; the app only queries Play for the purchase state. Google's Data safety guidance does not require developers to declare data that Google Play itself handles for its billing service – re-check the on-screen help text at the time of filling, as Google updates it.

### If Google's form ever asks the follow-ups (only if you answer "Yes" in the future)
| Question | Answer |
|---|---|
| Is all user data encrypted in transit? | Not applicable today (nothing collected). |
| Do you provide a way for users to request that their data be deleted? | Not applicable – no data on our side. Users delete local data by "Clear storage" or uninstalling. |
| Account deletion URL | Not required – the app has no accounts. |

### Privacy policy URL
Enter the public URL where `store/privacy-policy.html` is hosted (see the launch checklist). Required even though no data is collected.

---

## 2. Content rating (IARC questionnaire)

- **Email for IARC:** the developer contact email (`[CONTACT_EMAIL]`).
- **Category:** **"All Other App Types"** (also listed as *Utility, Productivity, Communication or Other*). Not a game, not social, not a reference/news app.
- Answer **No** to every content question: violence, fear, sexuality, nudity, profanity/crude humour, drugs, alcohol, tobacco, gambling/simulated gambling, discrimination.
- Interactive elements:
  - Users can interact or exchange content with other users? **No**
  - Shares the user's current physical location with other users? **No**
  - Allows users to purchase digital goods? **Yes** (one-time unlock via Google Play)
  - Unrestricted internet access (web browser / search engine)? **No**
  - Contains any NFTs/blockchain, or gambling-style rewards (loot boxes)? **No**

**Expected rating:** Everyone / **IARC 3+** – ESRB *Everyone*, PEGI *3*, USK *0*, ClassInd *L*, ACB *G*, with the interactive element **"In-App Purchases"** shown on the listing.

---

## 3. Target audience and content

**Recommendation: select age groups 13–15, 16–17 and 18+ (i.e. 13+). Do not select any group under 13.**

Why:
- It is a general home utility for whoever holds the TV remote at home – mainly adults/teens. It is not designed for children.
- Selecting any group **under 13** (or "all ages" including under-13 groups) puts the app under Google Play's **Families policy**: extra review, Families-compliant SDK requirements, Teacher Approved/Designed-for-Families rules, and stricter rules on the listing and ads. That adds work and review risk with no benefit.
- 13+ still lets anyone download it; it only states who it is *designed* for.

Follow-up questions:
| Question | Answer |
|---|---|
| Could your store listing unintentionally appeal to children? | **No** – dark, utility-style design, no cartoons/characters; describe Simple mode as being for "grandparents, guests and anyone who wants it easy" rather than as a kids' mode. |
| Does the app contain ads? (asked here too) | **No** |

---

## 4. Other App content declarations

| Declaration | Answer | Justification |
|---|---|---|
| **Ads** – does your app contain ads? | **No** | No ad SDKs, no house ads, no promotional pop-ups. |
| **App access** | **All functionality is available without special access** | No login or account. Add a note for reviewers: "No login. A smart TV on the same Wi-Fi is needed to control a TV; without a TV the app opens normally and shows the TV search screen. Trial: all features are unlocked for 7 days." |
| **News app** | **No** | Not a news app. |
| **Government app** | **No** | Not developed by or for a government. |
| **Financial features** | **None of the listed features** ("My app doesn't provide any financial features") | Only a single in-app purchase via Google Play. |
| **Health apps** | **No health features** ("My app does not have any health features") | – |
| **COVID-19 contact tracing/status** | **No** | – |
| **Data safety** | See section 1 | – |
| **Advertising ID** | **No**, the app does not use the advertising ID | No ads/analytics SDKs. (If the manifest merger ever adds `com.google.android.gms.permission.AD_ID`, remove it or answer Yes.) |
| **Any other permission declaration Play Console shows** (photos/videos, full-screen intent, exact alarms…) | Answer from the built manifest; the app's permission list is in the privacy policy. The app does not request photos/videos, location, contacts, SMS/call log or microphone. | – |

---

## 5. Foreground service declaration – `FOREGROUND_SERVICE_CONNECTED_DEVICE`

Location: App content → **Foreground service permissions**. Choose the type **Connected device**.

**User-facing task (text to paste):**
> The app is a Wi-Fi remote control for the user's smart TV. A foreground service of type connectedDevice keeps an active connection to the user's TV on the local network while the user has turned on one of these features: (1) the remote control in the notification and on the lock screen (power, volume, mute, play/pause), (2) automatic mute/pause of the TV when a phone or internet call rings and un-mute when it ends, (3) the sleep timer that turns the TV off after the chosen number of minutes, even with the phone locked. A persistent notification shows the controls or the countdown, with a button to stop it.

**Why it must run in the foreground (text to paste):**
> These features must react immediately while the app is not on screen and the phone may be locked: a lock-screen button press must reach the TV instantly, the TV must be muted the moment a call rings, and the timer must fire at an exact minute. That requires keeping the network connection/pairing session to the TV alive continuously; WorkManager or deferred background jobs would be delayed or killed by the system, so the features would fail. The service runs only while the user has one of these features enabled, its controls disappear automatically when the phone leaves the home Wi-Fi, and stops completely when the user closes the app or taps the X in the notification.

**Impact if deferred/interrupted:** the TV would not mute during a call, lock-screen buttons would not work, and the TV would not turn off on time.

### Demo video – 30-second script
Record the phone screen (Android screen recorder) with the TV visible – ideally film the phone and TV together with a second phone, or picture-in-picture. Upload to YouTube as **Unlisted** and paste the link.

| Time | What to show | On-screen caption (optional) |
|---|---|---|
| 0–4 s | Open the app, it is connected to the TV ("Living room"). | "Connected to the TV over Wi-Fi" |
| 4–9 s | Open Settings → turn on "Remote in notification / lock screen" and "Auto-mute on calls". The persistent notification appears. | "User turns on the features" |
| 9–15 s | Lock the phone. On the lock screen press Volume + and Mute in the notification – the TV reacts. | "Lock-screen remote controls the TV" |
| 15–22 s | From another phone, call this phone. When it rings, the TV mutes; end the call – the TV un-mutes. | "Call rings → TV mutes; call ends → un-mute" |
| 22–27 s | Start a 1-minute sleep timer; show the countdown notification with Cancel (cut to the TV switching off). | "Sleep timer turns the TV off" |
| 27–30 s | Tap the X in the notification – notification and service disappear. | "User stops the service" |

---

## 6. READ_PHONE_STATE justification (if asked)

READ_PHONE_STATE is not in Google's restricted SMS/Call Log group, so normally no declaration form appears. If a reviewer or form asks, use:

> READ_PHONE_STATE is used only to detect when a phone call starts ringing, is answered and ends, so the app can automatically mute or pause the user's TV during the call and restore the sound afterwards. This is an optional feature the user turns on in the app's settings, and the rest of the app works without the permission. The app does not read phone numbers, device identifiers, call logs or contacts, and no call information is stored or transmitted.

Good practice (check with the developer): the app should explain this in one sentence before the system permission prompt appears (prominent disclosure).
