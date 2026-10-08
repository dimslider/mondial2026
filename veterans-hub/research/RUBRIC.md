# Rubric for re-tagging services (the Azimut app)

For each service in your file, fill in structured fields **based on the text only** (name, description, how_to_apply, cost_notes, eligibility, location). Do not invent. When the text does not say, write "unknown". Do not use the internet (except for town/coordinates if you really need them).

## Fields (all required, for each id)
- `kind`: what the service is mainly. One value:
  - `treatment`: therapy / mental health / medical (individual or group, with a professional)
  - `activity`: a doing-based activity (sport, sea, nature, farm, art, journeys, volunteering) that is the core of the service
  - `peer`: a peer group / community / mentoring / personal support by volunteers
  - `rights`: help with rights, recognition, legal, bureaucracy
  - `money`: grant / loan / financial assistance / benefit
  - `work`: employment / studies / training
  - `info`: an information page, guide, portal, podcast, reform, recommendations (not a body you contact for a service)
  - `hotline`: a crisis / emergency line
  - `housing`: housing / help with daily life
  - `family`: mainly for family members (partners, children, parents, bereaved families)
- `intensity`: `oneoff` (one call or event) | `light` (occasional, open) | `weekly` (a regular weekly group or session) | `program` (a structured program of weeks or months) | `intensive` (a daily program or day center) | `residential` (with overnight stay: a balancing home, an inpatient alternative, a multi-day retreat) | `unknown`
- `recognition`: does it require recognition by the Ministry of Defense Rehabilitation Department: `required` | `not_required` (it says explicitly that recognition is not needed / also for people not recognized) | `unknown`
- `police`: can a police officer (on active duty or a retiree, without MoD recognition) take part: `yes` (it says police / security forces) | `no` (it says only IDF soldiers, or a specific unit) | `unknown`
- `unit_only`: true if only for graduates or members of a specific unit or organization (an alumni association, a specific brigade), otherwise false
- `war_only`: `"iron-swords"` if only for those hurt in the current war (since October 2023), otherwise null
- `format`: `group` | `individual` | `mixed` | `unknown`
- `town`: the main locality where the activity happens (for example "כרמיאל", "קיבוץ שדות ים", "תל אביב"). If there are many branches, write "סניפים". If it is national, by phone, or online, write "ארצי".
- `lat`, `lng`: approximate coordinates of the town (to 2 decimal places). Leave null for "ארצי" / "סניפים".
- `elig_fix`: only if the eligibility field is clearly wrong according to the text: the full corrected list (allowed values: mod-recognized, mod-in-process, not-recognized, reservists, combat-soldiers, police, security-forces, families, bereaved, terror-victims, civilians). Otherwise null.
- `note`: short, only if something important is unclear.

## Output
A JSON object {"<id>": {...fields...}} in the output file you were given. Check that it is valid JSON and that every id from the file appears. Do not change files in the repo.
