# Play Console: App content answers

Everything below is under **Play Console → (your app) → Policy and programs → App content** unless stated otherwise. Answers match the Play build (`play` flavour, package `com.dimslider.tvremote`) as built: no account, no ads, no analytics/crash SDKs, no servers of ours; commands go only to the user's own TV on the LAN.

Business model, for reviewers' notes: free to download; the basic remote is free forever; **Pro** is a one-time in-app purchase (`full_unlock`) that is unlocked free for the first 7 days, after which the app falls back to the free version.

> If an analytics, crash-reporting (e.g. Firebase Crashlytics) or ads SDK is ever added, or any data starts going to a server, these answers must change before that release.

---

## 0. How we checked

- **Manifest:** `app/src/main/AndroidManifest.xml` – every `<uses-permission>` listed in §1.1; `android:allowBackup="true"`, `android:usesCleartextTraffic="true"` (needed for plain `http`/`ws` to TVs on the LAN), two services with `foregroundServiceType="connectedDevice"`. The `play` flavour adds no manifest of its own; `com.android.vending.BILLING` comes from the Play Billing library's manifest merge.
- **Dependencies:** `app/build.gradle.kts` – `okhttp 4.12.0` (all builds), `playImplementation billing 8.0.0` and `playImplementation review 2.0.2` (Play build only), plus the Kotlin standard library. No Firebase, Google Analytics, Crashlytics, ads, attribution or other SDKs.
- **Code:** network calls only target the TV's IP on the local subnet (discovery probes, Samsung/LG/Android TV protocols, Wake-on-LAN); no hard-coded server URLs. Purchase state is stored as a local `purchased` flag; the diagnostics log is kept in memory and only copied to the clipboard on the user's tap.
- Re-check before each release: open the merged manifest of the release AAB (Android Studio → APK Analyzer, or `bundletool dump manifest`) and confirm no new permissions (especially `com.google.android.gms.permission.AD_ID`) appeared.

---

## 1. Data safety form

### 1.1 Permissions in the app – what each one is for

| Permission | Used for (one line) | Leads to data collection? |
|---|---|---|
| `INTERNET` | HTTP/WebSocket/TLS connections to the user's TV on the local network. | No – traffic goes only to the TV on the LAN. |
| `ACCESS_NETWORK_STATE` | Know whether the phone is on Wi-Fi and which network it is on. | No |
| `ACCESS_WIFI_STATE` | Find the phone's subnet to scan for TVs; hide lock-screen controls when leaving home Wi-Fi. | No |
| `CHANGE_NETWORK_STATE` | Multicast (SSDP) discovery of TVs on the LAN. | No |
| `VIBRATE` | Haptic feedback on button presses. | No |
| `POST_NOTIFICATIONS` | Notification/lock-screen remote (Pro) and sleep-timer countdown (Pro). | No |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_CONNECTED_DEVICE` | Keep the TV connection alive for the lock-screen remote, call auto-mute and the sleep timer (all Pro). | No |
| `RECEIVE_BOOT_COMPLETED` | Restore the notification remote after a reboot, only if the user enabled it. | No |
| `READ_PHONE_STATE` | Only the call state (ringing / off-hook / idle) for call auto-mute (Pro); requested at runtime only when the user turns auto-mute on. No numbers, contacts or call log are read. | No – used on-device only, never stored or sent. |
| `WAKE_LOCK` | Make the sleep timer fire on time. | No |
| `com.android.vending.BILLING` | Added by the Play Billing library for the one-time Pro purchase. | See §1.3 (judgement call). |

Not requested: microphone (`RECORD_AUDIO` – voice uses the system speech recognizer via `RecognizerIntent`, the app receives only the recognised text), location, contacts, storage/photos, camera, call log, SMS, Notification Listener, Accessibility service, `QUERY_ALL_PACKAGES`, `AD_ID`.

Call detection: regular calls → telephony call-state callback + the `PHONE_STATE` broadcast (both need `READ_PHONE_STATE`); WhatsApp/internet calls → Android's `AudioManager` audio-mode listener (no permission, Android 12+).

### 1.2 Libraries shipped

| Library | Build | Purpose | Data to the developer / third parties |
|---|---|---|---|
| OkHttp 4.12 | all | HTTP/WebSocket to the TV on the LAN | None – it only talks to the TV's IP. |
| Kotlin stdlib | all | language runtime | None |
| Google Play Billing Library 8.0.0 | Play only | the one-time Pro purchase | Purchase handled by Google Play; the app gets purchase state/token on-device and stores only a "purchased" flag. Nothing goes to the developer. |
| Google Play In-App Review 2.0.2 | Play only | shows Google's rating card | The rating/review is submitted by the user to Google Play; the app receives nothing about it. |

No ads SDK, no analytics, no crash reporting, no Firebase.

### 1.3 Step 1 – Data collection and security

| Question | Recommended answer | Justification (one line) |
|---|---|---|
| Does your app collect or share any of the required user data types? | **No** | Nothing is transmitted off the device to the developer or a third party; commands go only from the phone to the user's own TV on the local network, and on-device processing is not "collection" under Google's definition. |

Answering **No** ends the questionnaire: the "Encrypted in transit" and "Deletion" questions are not shown, and the listing displays **"No data collected"** and **"No data shared with third parties"**.

Reasoning per data area (for a review question):
- **Local network scan:** the app scans only the user's own /24 subnet (HTTP probes on the TV ports 8001/8002 Samsung, 6466/6467 Android TV, 3000/3001 LG) and SSDP multicast. Results (TV IP, name, model, MAC from the TV's own info) are stored only on the device.
- **Commands, typed text, voice text:** user-initiated and sent directly from the phone to a device the user owns on their own network – not to the developer or any third-party server.
- **Pairing tokens/certificates, TV list, settings, macros, trial/purchase flag:** stored only in app-private storage on the device.
- **Android backup (`allowBackup="true"`):** the OS may include the app's data in the **user's own Google backup**. That is a system feature controlled by the user and Google, not transmission to the developer, and Play does not count it as collection by the developer – but say so honestly if asked (the privacy policy mentions it).
- **Speech recognition:** done by the phone's system speech service (launched by intent); the app only receives the recognised text from the OS and sends it nowhere except to the user's TV.
- **Call state (READ_PHONE_STATE / audio mode):** read on-device only to trigger mute/pause; nothing stored or transmitted; no numbers or call logs read.
- **Diagnostics:** the "Copy diagnostic info" button copies a local log (TV IP, connection events) to the clipboard **only when the user taps it**; the user decides whether to paste and send it (e.g. by email). Nothing is sent automatically. Data the user voluntarily sends by email is generally not treated as collection through the app, because the app does not transmit it.

**Judgement call – Billing and In-App Review.** Google's rule is that developers must declare data collected by any SDK in their app, including Google's. However, purchase data here is handled by **Google Play itself as the payment processor**: the Billing library talks to the Play Store app on the device, Google processes the payment, and the developer receives no payment details, no account identity and no purchase history on any server (the app keeps only a local flag). The Google Play SDK Index lists the Billing library's data-safety guidance as "not provided", and I could not confirm an explicit statement in Google's help pages that Play-billing data is exempt, so **this is not 100% certain**. The In-App Review card is likewise Google's own UI; the developer receives nothing.
- **Recommended:** answer **No** (no data collected), as above.
- **Conservative alternative**, if you prefer zero risk of a "misleading declaration" warning: declare **Financial info → Purchase history**: *Collected* = Yes, *Shared* = No, *Processed ephemerally* = No, *Required* (users can't turn it off – but only when buying), *Purpose* = **App functionality**. This makes the listing show "Purchase history" under data collected instead of "No data collected". Re-read the on-screen help text in the form at the time of filling – Google updates it.

**Data shared:** **No** – nothing is shared with third parties (Google Play acting as payment processor for its own billing is not "sharing" by the developer).

### 1.4 Follow-up questions (only shown if you answer "Yes", e.g. with the conservative alternative)

| Question | Answer |
|---|---|
| Is all user data collected by your app encrypted in transit? | **Yes** for anything that would count as collected (purchase data goes from the device to Google Play over Google's encrypted channel). Note on LAN traffic, which is *not* collection: Samsung control uses `wss` on 8002 and Android TV uses TLS (encrypted), but LG may use plain `ws` on port 3000 and the Samsung REST info endpoint uses `http` on 8001 – so do **not** claim that every connection the app makes is encrypted; the answer applies only to collected data. |
| Do you provide a way for users to request that their data be deleted? | Data stays on the device; uninstalling the app or Android Settings → Apps → TV Remote → Storage → **Clear data** removes it. The developer holds no user data to delete. Purchases are managed in the user's Google Play account. |
| Account deletion URL | Not required – the app has no accounts. |

### Privacy policy URL
`https://dimslider.github.io/remote-privacy/` (hosted copy of `store/privacy-policy.html`). Required even though no data is collected.

---

## 2. Content rating (IARC questionnaire)

- **Email for IARC:** the developer contact email (`remotetvforall@gmail.com`).
- **Category:** **"All Other App Types"** (also listed as *Utility, Productivity, Communication or Other*). Not a game, not social, not a reference/news app.
- Answer **No** to every content question: violence, fear, sexuality, nudity, profanity/crude humour, drugs, alcohol, tobacco, gambling/simulated gambling, discrimination.
- Interactive elements:
  - Users can interact or exchange content with other users? **No**
  - Shares the user's current physical location with other users? **No**
  - Allows users to purchase digital goods? **Yes** (one-time Pro purchase via Google Play)
  - Unrestricted internet access (web browser / search engine)? **No**
  - Contains any NFTs/blockchain, or gambling-style rewards (loot boxes)? **No**

**Expected rating:** Everyone / **IARC 3+** – ESRB *Everyone*, PEGI *3*, USK *0*, ClassInd *L*, ACB *G*, with the interactive element **"In-App Purchases"** shown on the listing.

---

## 3. Target audience and content

**Recommendation: select age groups 13–15, 16–17 and 18+ (i.e. 13+). Do not select any group under 13.**

Why:
- It is a general home utility for whoever holds the TV remote at home – mainly adults/teens. It is not designed for children.
- Selecting any group **under 13** puts the app under Google Play's **Families policy**: extra review, Families-compliant SDK requirements and stricter listing rules. That adds work and review risk with no benefit.
- 13+ still lets anyone download it; it only states who it is *designed* for.

Follow-up questions:
| Question | Answer |
|---|---|
| Could your store listing unintentionally appeal to children? | **No** – dark, utility-style design, no cartoons/characters; Simple mode is described as being for "grandparents, guests and anyone who wants it easy", not as a kids' mode. |
| Does the app contain ads? (asked here too) | **No** |

---

## 4. Other App content declarations

| Declaration | Answer | Justification |
|---|---|---|
| **Ads** – does your app contain ads? | **No** | No ad SDKs, no house ads, no promotional pop-ups. |
| **App access** | **All functionality is available without special access** | No login or account. Note for reviewers: "No login. A smart TV on the same Wi-Fi is needed to control a TV; without a TV the app opens normally and shows the TV search screen. The basic remote is free; Pro features (call auto-mute, lock-screen remote, sleep timer, voice, macros, multiple TVs) are unlocked free for the first 7 days after install, so reviewers can test everything without buying." |
| **News app** | **No** | Not a news app. |
| **Government app** | **No** | – |
| **Financial features** | **"My app doesn't provide any financial features"** | Only a single in-app purchase via Google Play. |
| **Health apps** | **"My app does not have any health features"** | – |
| **Advertising ID** | **No**, the app does not use the advertising ID | No ads/analytics SDKs. (If the merged manifest ever contains `com.google.android.gms.permission.AD_ID`, remove it or answer Yes.) |
| **Other permission declarations** (photos/videos, full-screen intent, exact alarms…) | None apply | The app requests none of those permissions (see §1.1). |

### Permissions declaration form
- **READ_PHONE_STATE is not a restricted permission.** The Permissions Declaration Form is for the restricted groups – **SMS, Call Log**, All files access (`MANAGE_EXTERNAL_STORAGE`), `QUERY_ALL_PACKAGES`, Accessibility API used as a non-accessibility tool, background location, etc. None of those are in the app, so **no Permissions Declaration Form is needed**.
- **The foreground service type declaration IS required** (§5) because the app targets Android 14+ and declares `FOREGROUND_SERVICE_CONNECTED_DEVICE`.

---

## 5. Foreground service declaration – `FOREGROUND_SERVICE_CONNECTED_DEVICE`

Location: App content → **Foreground service permissions**. Choose the type **Connected device**.

**User-facing task (text to paste):**
> The app is a Wi-Fi remote control for the user's smart TV. A foreground service of type connectedDevice keeps an active connection to the user's TV on the local network while the user has turned on one of these features: (1) the remote control in the notification and on the lock screen (power, volume, mute, play/pause), (2) automatic mute/pause of the TV when a phone or internet call rings and un-mute when it ends, (3) the sleep timer that turns the TV off after the chosen number of minutes, even with the phone locked. A persistent notification shows the controls or the countdown, with a button to stop it.

**Why it must run in the foreground (text to paste):**
> These features must react immediately while the app is not on screen and the phone may be locked: a lock-screen button press must reach the TV instantly, the TV must be muted the moment a call rings, and the timer must fire at an exact minute. That requires keeping the network connection/pairing session to the TV alive continuously; WorkManager or deferred background jobs would be delayed or killed by the system, so the features would fail. The service runs only while the user has one of these features enabled, its controls disappear automatically when the phone leaves the home Wi-Fi, and it stops completely when the user closes the app or taps the X in the notification.

**Impact if deferred/interrupted:** the TV would not mute during a call, lock-screen buttons would not work, and the TV would not turn off on time.

(These are Pro features. During the first 7 days they are unlocked for everyone, so reviewers can reproduce them on a fresh install.)

### Demo video – 30-second script
Record on a **fresh install (inside the 7-day Pro trial)** or with a license-tester account that has bought Pro. Record the phone screen (Android screen recorder) with the TV visible – ideally film the phone and TV together with a second phone, or picture-in-picture. Upload to YouTube as **Unlisted** and paste the link.

| Time | What to show | On-screen caption (optional) |
|---|---|---|
| 0–4 s | Open the app, connected to the TV ("Living room"); the Pro trial counter (days left) is visible. | "Connected to the TV over Wi-Fi · Pro trial active" |
| 4–9 s | Open Settings → turn on "Remote in notification / lock screen" and "Auto-mute on calls" (accept the phone-state permission prompt). The persistent notification appears. | "User turns on the features" |
| 9–15 s | Lock the phone. On the lock screen press Volume + and Mute in the notification – the TV reacts. | "Lock-screen remote controls the TV" |
| 15–22 s | From another phone, call this phone. When it rings, the TV mutes; end the call – the TV un-mutes. | "Call rings → TV mutes; call ends → un-mute" |
| 22–27 s | Start a 1-minute sleep timer; show the countdown notification with Cancel (cut to the TV switching off). | "Sleep timer turns the TV off" |
| 27–30 s | Tap the X in the notification – notification and service disappear. | "User stops the service" |

---

## 6. READ_PHONE_STATE justification (if asked)

READ_PHONE_STATE is not in Google's restricted SMS/Call Log group, so normally no declaration form appears. If a reviewer or form asks, use:

> READ_PHONE_STATE is used only to detect when a regular phone call starts ringing, is answered and ends, so the app can automatically mute or pause the user's TV during the call and restore the sound afterwards. This is an optional feature the user turns on in the app's settings; the permission is requested at runtime only at that moment, and the rest of the app works without it (internet calls such as WhatsApp are detected through Android's audio-mode listener, which needs no permission). The app does not read phone numbers, device identifiers, call logs or contacts, and no call information is stored or transmitted.

Good practice (check with the developer): the app should explain this in one sentence before the system permission prompt appears (prominent disclosure).

Possible future reduction: if testing shows that on Android 12+ the audio-mode listener reliably detects regular calls too, READ_PHONE_STATE could be limited to Android ≤ 11 (`android:maxSdkVersion="30"`). See the diagnostics check in `launch-checklist-he.md` step 12.
