# ASTROLOGY ENGINE — MASTER KNOWLEDGE, RESEARCH & REFERENCE MANUAL
## Canonical research map, calculation specification, source guide, validation plan, and implementation blueprint

**Document status:** Master / living specification  
**Version:** 1.0  
**Purpose:** Provide a single, auditable reference for building a first-principles astronomical, Panchāṅga, traditional calendar, and Jyotiṣa computation system.

---

## 0. Executive purpose

This document is the project's central map.

It answers five questions:

1. **What are we trying to calculate?**
2. **What mathematics is required?**
3. **What external data or references are required?**
4. **Which things should be calculated ourselves and which things should only be used for validation?**
5. **Where are the unresolved traditional or scientific questions?**

The guiding principle is:

> **Do not copy the answer. Reconstruct the answer from documented inputs and rules, then independently validate it.**

The project should therefore keep three layers separate:

### Layer A — Astronomy

Numerical positions, velocities, Earth orientation, coordinate transformations, topocentric effects, solar/lunar horizons, eclipses, and other physical/astronomical quantities.

### Layer B — Traditional calendar/Jyotiṣa rules

Tithi, Nakṣatra, Yoga, Karaṇa, lunar months, festivals, Mūḍham, Daśās, Vargas, Śaḍbala, Aṣṭakavarga, Jaimini, etc.

### Layer C — Validation

Independent ephemerides, official astronomical standards, published Panchāṅgas, classical editions, academic reconstructions, and other sources.

A validation source must not silently become the generator.

---

# 1. Golden architecture

The complete system should conceptually be:

```text
TIME
  ↓
EARTH ORIENTATION
  ↓
EPHEMERIS
  ↓
REFERENCE FRAME
  ↓
GEOCENTRIC / TOPOCENTRIC STATE
  ↓
TROPICAL LONGITUDE
  ↓
AYANĀṂŚA
  ↓
SIDEREAL LONGITUDE
  ↓
ASTRONOMICAL EVENTS
  ├── New Moon
  ├── Full Moon
  ├── Saṅkrānti
  ├── planetary ingress
  ├── stations
  ├── eclipse
  ├── sunrise/sunset
  └── Moonrise/Moonset
  ↓
PANCHĀṄGA
  ├── Tithi
  ├── Nakṣatra
  ├── Yoga
  ├── Karaṇa
  └── Vāra
  ↓
LUNAR MONTH / SOLAR MONTH
  ↓
TRADITION PROFILE
  ↓
FESTIVAL / OBSERVANCE
  ↓
JYOTIṢA
  ├── D1
  ├── Bhāva
  ├── Vargas
  ├── Daśā
  ├── Śaḍbala
  ├── Aṣṭakavarga
  ├── Yogas
  ├── Jaimini
  └── Transits
  ↓
VALIDATION
```

Never reverse this dependency chain by taking a final Panchāṅga answer and feeding it backward into the astronomy engine.

---

# 2. What we already have established

## 2.1 Project profile

Primary regional test:

- Hyderabad, Telangana, India
- Asia/Kolkata
- Telugu tradition
- Amānta lunar months
- Lahiri/Citrāpakṣa sidereal zodiac
- modern astronomical profile
- separate classical Sūrya Siddhānta profiles

## 2.2 Modern astronomical profile

Current project reference:

- JPL DE440 for modern planetary states
- IAU 2006 precession
- IAU 2000A nutation
- modern Earth orientation/IERS framework
- modern reference frames
- apparent corrections when appropriate
- topocentric Moon for horizon events
- Lahiri sidereal conversion

## 2.3 Classical profiles

Maintain:

```text
SS_ORIGINAL
SS_CURRENT_TRANSMITTED
SS_BIJA
```

Additional historical reconstructions may be added later.

Never mix these profiles with the modern DE440 calculation silently.

---

# 3. External reference map

This section answers the practical question:

> "Where do we get the solar, lunar, planetary, time, and Earth data?"

## 3.1 JPL / NASA planetary ephemerides

### Primary use

Obtain modern numerical states of:

- Sun
- Moon
- Mercury
- Venus
- Mars
- Jupiter
- Saturn
- Uranus
- Neptune
- Pluto where desired

### What we take

- position
- velocity
- reference frame
- center
- epoch/time
- ephemeris version

### What we do NOT take

- Panchāṅga labels
- Jyotiṣa interpretations
- festival dates

### Project choice

**DE440** is the preferred modern reference profile for the 2027-era calculations.

### Why it matters

The ephemeris is the numerical foundation. Everything else depends on obtaining a consistent state at the correct time scale and frame.

---

# 4. JPL Horizons

## Purpose

Use Horizons as a practical independent interface to astronomical ephemerides.

It is especially useful for:

- spot-checking Sun longitude
- Moon longitude
- planetary longitude
- geocentric vs heliocentric states
- velocity
- event times
- independent debugging

### Recommended use

Use Horizons for:

```text
OUR ENGINE
    vs
JPL/Horizons
```

Do not treat a Horizons output table as a substitute for understanding the underlying ephemeris.

### Validation pattern

For a test epoch:

```text
input epoch
input observer/center
input frame
input corrections
        ↓
our result
        ↓
Horizons comparison
        ↓
difference classification
```

---

# 5. IERS — Earth orientation

## Purpose

Earth rotation is not perfectly represented by a fixed mathematical clock.

IERS material is required for:

- UT1
- UTC–UT1 relationship
- Earth Orientation Parameters
- polar motion
- Earth rotation angle
- celestial/intermediate pole quantities
- modern high-precision Earth orientation

### Why this matters

For rough calendar work, tiny differences may not matter.

For a research-grade engine they matter because:

- local sidereal time depends on Earth rotation
- Ascendant depends on local sidereal time
- horizon calculations depend on time and observer geometry
- high precision event times can shift with conventions

### Reference class

Use IERS as the authoritative modern Earth-orientation source.

---

# 6. IAU standards

## Purpose

The International Astronomical Union standards provide the modern mathematical framework for:

- precession
- nutation
- reference systems
- astronomical constants
- celestial intermediate origin/pole concepts
- transformations between modern reference systems

### Project profile

Use:

- IAU 2006 precession
- IAU 2000A nutation

Do not mix a modern IAU transformation with an unexplained classical Sūrya Siddhānta correction.

---

# 7. Time scales

This is one of the most important parts of the entire system.

## 7.1 UTC

Civil time.

Used for displaying dates/times to users.

## 7.2 TAI

Atomic time.

UTC differs from TAI by leap seconds.

## 7.3 TT

Terrestrial Time.

Used for many astronomical ephemeris calculations.

Relationship:

\[
TT = TAI + 32.184\;s
\]

## 7.4 UT1

Earth rotation time.

Important for:

- sidereal time
- Earth orientation
- horizon-related astronomy

## 7.5 Never assume

```text
UTC = TT
UTC = UT1
```

They are not interchangeable.

---

# 8. Julian Date and epochs

The engine needs:

- Julian Date
- Modified Julian Date where useful
- Julian centuries from J2000.0
- epoch conversion utilities

J2000.0 corresponds to:

```text
2000-01-01 12:00 TT
```

All functions should document their required time scale.

---

# 9. Coordinate systems

The system should explicitly represent:

- ICRF
- BCRS
- geocentric
- heliocentric
- equatorial
- ecliptic
- horizontal/topocentric
- tropical
- sidereal

A coordinate object should include:

```text
CoordinateState {
    vector
    velocity
    frame
    center
    epoch
    time_scale
    orientation
}
```

Never store a bare three-number vector without its frame and epoch.

---

# 10. Modern solar calculation

## 10.1 What we need

For the Sun:

- geocentric apparent position
- geocentric longitude
- latitude if required
- velocity
- distance
- declination
- right ascension
- local altitude/azimuth

## 10.2 Basic pipeline

```text
DE440
→ Earth/Sun relative state
→ chosen reference frame
→ apparent correction if required
→ equatorial/ecliptic conversion
→ tropical longitude
→ Lahiri
→ sidereal longitude
```

## 10.3 Solar events

Calculate:

- sunrise
- sunset
- solar noon
- solar midnight if needed
- civil/nautical/astronomical twilight if desired

Do not use a fixed "6 AM sunrise" approximation for the final engine.

---

# 11. Solar altitude

Standard spherical relation:

\[
\sin h =
\sin\phi\sin\delta
+
\cos\phi\cos\delta\cos H
\]

where:

- \(h\) = altitude
- \(\phi\) = observer latitude
- \(\delta\) = solar declination
- \(H\) = hour angle

The sunrise model must define the effective altitude.

A common apparent-sun convention uses approximately:

\[
h \approx -0.833^\circ
\]

but the selected convention must be stored in the profile.

---

# 12. Equation of time

Solar noon differs from civil clock noon because of:

- longitude relative to the standard meridian
- equation of time

The engine should calculate:

```text
solar_noon =
standard_meridian_correction
+
equation_of_time
+
timezone convention
```

Do not hard-code 12:00 as Madhyāhna.

---

# 13. Moon calculation

The Moon needs more care than ordinary planets.

Calculate:

- geocentric position
- geocentric longitude
- latitude
- distance
- velocity
- apparent position
- topocentric position

For Moonrise/Moonset, topocentric correction is mandatory for a serious implementation.

---

# 14. Moonrise / Moonset

Required inputs:

- observer latitude
- longitude
- elevation where available
- Moon position
- lunar parallax
- lunar semidiameter
- atmospheric refraction convention
- horizon convention

Solve:

\[
h_{apparent}(t)=h_{threshold}
\]

for the crossing.

Moonrise can be absent on some dates.

The result should allow:

```text
moonrise = null
```

rather than inventing a time.

---

# 15. Lahiri ayanāṃśa

The basic transformation:

\[
\lambda_{sid}
=
\operatorname{norm}_{360}
(\lambda_{trop}-A_{Lahiri})
\]

Store:

```text
Ayanamsa {
    model
    epoch
    algorithm
    timestamp
    value
    source
}
```

Ayanāṃśa is not a generic "subtract 24°" constant.

The engine must calculate/evaluate it according to the chosen model.

---

# 16. Panchāṅga formulas

## 16.1 Tithi

\[
E =
\operatorname{norm}_{360}
(\lambda_M-\lambda_S)
\]

\[
T=
\left\lfloor
\frac{E}{12^\circ}
\right\rfloor+1
\]

Boundaries:

\[
E=12^\circ n
\]

## 16.2 Nakṣatra

\[
N=
\left\lfloor
\frac{\lambda_M^{sid}}
{13^\circ20'}
\right\rfloor+1
\]

## 16.3 Yoga

\[
Y_\theta =
\operatorname{norm}_{360}
(\lambda_S^{sid}+\lambda_M^{sid})
\]

\[
Y=
\left\lfloor
\frac{Y_\theta}
{13^\circ20'}
\right\rfloor+1
\]

## 16.4 Karaṇa

Half-tithi:

\[
6^\circ
\]

Use canonical movable/fixed sequence.

Do not use modulo 11.

---

# 17. Root finding

All event boundaries should use:

```text
1. approximate event time
2. bracket the root
3. Brent or bisection
4. recalculate state
5. evaluate residual
6. accept only if residual < tolerance
```

Examples:

### Tithi

\[
f(t)=E(t)-12n
\]

### Nakṣatra

\[
f(t)=\lambda_M^{sid}(t)-13^\circ20'n
\]

### Yoga

\[
f(t)=
(\lambda_S+\lambda_M)-13^\circ20'n
\]

### Saṅkrānti

\[
f(t)=\lambda_S^{sid}-30^\circ n
\]

---

# 18. Unwrapped angles

For root finding, normalized angles can introduce artificial jumps at 360°.

Therefore maintain:

```text
raw/unwrapped angle
normalized angle
```

and use the unwrapped form for continuous event solving.

---

# 19. Lunar phase engine

## New Moon

\[
D(t)=\lambda_M-\lambda_S
\]

Solve:

\[
D(t)=360n
\]

## Full Moon

Solve:

\[
D(t)=180^\circ+360n
\]

Store exact phase time.

---

# 20. Lunar month engine

Amānta month boundaries occur at New Moon.

Month naming is then determined by the selected traditional rule/profile, not merely by Gregorian month.

Important 2027 corrected sequence:

```text
Mārgaśīrṣa → Jan 8
Pauṣya     → Feb 6
Māgha      → Mar 8
Phālguna   → Apr 6
Caitra     → May 6
Vaiśākha   → Jun 4
Jyeṣṭha    → Jul 4
Āṣāḍha     → Aug 2
Śrāvaṇa    → Aug 31
Bhādrapada → Sep 30
Āśvayuja   → Oct 29
Kārtīka    → Nov 28
Mārgaśīrṣa → Dec 27
```

Two New Moons in one Gregorian month are not by themselves proof of Adhika Māsa.

Solar ingress within lunations must be evaluated.

---

# 21. Saṅkrānti engine

\[
\lambda_S^{sid}=30^\circ n
\]

Solve every sign boundary.

Keep:

```text
astronomical ingress
```

separate from:

```text
puṇya-kāla
```

which is an observance rule.

---

# 22. Daily Panchāṅga

A DailyPanchanga object should contain:

```text
DailyPanchanga {
    date
    weekday
    sunrise
    sunset
    tithi_at_sunrise
    tithi_interval
    nakshatra_at_sunrise
    nakshatra_interval
    yoga_at_sunrise
    yoga_interval
    karana_at_sunrise
    karana_interval
    solar_rashi
    lunar_rashi
    moonrise
    moonset
    rahu_kala
    yamaganda
    gulika
    hora
    madhyahna
    pradosha
    nishitha
    profile
}
```

---

# 23. Festival engine

Represent every festival as a rule.

Example:

```text
Ugadi:
month = Caitra
paksha = Shukla
tithi = Pratipada
anchor = sunrise
profile = Telugu_Amanta
```

The engine then searches continuous tithi intervals and evaluates the anchor.

Do not store:

```text
Ugadi = 2027-04-07
```

as a generator rule.

That date belongs in validation/output data.

---

# 24. Important festival anchor types

Supported anchors should include:

- sunrise
- sunset
- Moonrise
- Madhyāhna
- Niśītha
- daytime
- evening
- night
- specified pāraṇa interval

This makes the festival engine general.

---

# 25. Ekādaśī

The engine must support:

- Smārta
- Vaiṣṇava
- Gauna or other explicitly documented profiles

Store:

```text
EkadashiOccurrence {
    tithi_interval
    sunrise_status
    dvadashi_interval
    parana_window
    profile
}
```

Do not simply label a Gregorian day as Ekādaśī without evaluating the tithi and tradition rule.

---

# 26. Pradoṣa

Pradoṣa should be modeled as:

```text
Trayodashi
+
evening/sunset anchor
+
weekday
```

Examples:

- Soma Pradoṣa
- Bhauma Pradoṣa
- Budha Pradoṣa
- Guru Pradoṣa
- Śukra Pradoṣa
- Śani Pradoṣa

The astronomical tithi and the observance naming are separate fields.

---

# 27. Muhūrta engine

## Day and night Hora

\[
H_{day}=
\frac{sunset-sunrise}{12}
\]

\[
H_{night}=
\frac{next\ sunrise-sunset}{12}
\]

Chaldean order:

```text
Saturn
Jupiter
Mars
Sun
Venus
Mercury
Moon
```

First daytime Hora = weekday lord.

## Rāhu Kāla

Day is divided into eight equal segments.

```text
Sunday 8
Monday 2
Tuesday 7
Wednesday 5
Thursday 6
Friday 4
Saturday 3
```

Use actual local sunrise/sunset.

---

# 28. Sūrya Siddhānta research

## 28.1 Required source categories

We need:

1. Sanskrit/classical editions
2. reliable translations
3. scholarly studies
4. historical reconstructions
5. computational reconstructions
6. independent numerical tests

## 28.2 Current constants

Mahāyuga:

\[
4,320,000
\]

Civil days, transmitted/current:

\[
1,577,917,828
\]

Revolutions:

```text
Sun                    4,320,000
Moon                  57,753,336
Mars                   2,296,832
Mercury śīghrocca     17,937,060
Jupiter                  364,220
Venus śīghrocca        7,022,376
Saturn                    146,568
```

Original-profile differences must be retained.

## 28.3 Sine table

Radius:

\[
3438
\]

Values at 3°45′ intervals:

```text
225 449 671 890 1105 1315
1520 1719 1910 2093 2267 2431
2585 2728 2859 2978 3084 3177
3256 3321 3372 3409 3431 3438
```

## 28.4 Correction algorithm

Published reconstruction:

\[
\alpha=\Gamma-\frac12\sigma(\lambda_s-\lambda)
\]

\[
\beta=\alpha+\frac12\mu(\lambda-\alpha)
\]

\[
\gamma=\lambda-\mu(\lambda-\beta)
\]

\[
L=\gamma+\sigma(\lambda_s-\gamma)
\]

Roles are interchanged for inner planets.

The numerical tables found in published reconstructions must not automatically be considered ground truth. Algorithm, constants, epoch, and convention all require validation.

---

# 29. Classical visibility / Mūḍham

Research required:

- Sūrya Siddhānta visibility chapter
- dṛkkarma
- kālāṃśa
- atmospheric assumptions
- solar altitude
- true geocentric/observer geometry
- planet-specific thresholds

Known threshold records:

```text
Jupiter 11°
Saturn 15°
Mars 17°
Venus 8° / 10°
Mercury 12° / 14°
```

These are not sufficient by themselves to reproduce exact heliacal visibility.

### 2027 diagnostic data already calculated

Jupiter 11° longitude separation:

```text
entry  2027-08-16 14:12:20.95 UTC
exit   2027-09-14 21:42:44.72 UTC
```

Venus 10°:

```text
entry  2027-07-06 15:12:36.37 UTC
exit   2027-09-17 17:18:53.48 UTC
```

Venus 8°:

```text
entry  2027-07-13 23:15:29.68 UTC
exit   2027-09-10 06:17:17.58 UTC
```

These are modern separation diagnostics, not heliacal visibility.

Traditional 2027 records currently held:

```text
Guru Mūḍham  : 16 Aug – 15 Sep
Guru Bālyam  : 15 Sep – 16 Sep
Śukra Mūḍham : 6 Jul – 17 Sep
```

These must remain labeled traditional until the classical visibility model is fully reconstructed and validated.

---

# 30. Eclipse research

## Solar

New Moon + lunar latitude near node.

## Lunar

Full Moon + lunar latitude near node.

Calculate:

- contacts
- greatest eclipse
- magnitude
- obscuration
- gamma
- local visibility

Separate:

```text
astronomical eclipse
local visibility
traditional observance
```

---

# 31. Jyotiṣa D1

Planetary state:

```text
longitude
latitude
velocity
rashi
nakshatra
pada
retrograde state
combustion
```

Lagna:

\[
LAST=GAST+L
\]

Ascendant:

\[
\lambda_L=
\operatorname{atan2}
\left(
-\cos\theta,
\sin\theta\cos\epsilon+
\tan\phi\sin\epsilon
\right)
\]

Then convert to sidereal.

Whole-sign house:

\[
H=
((R_P-R_L)\bmod12)+1
\]

---

# 32. Bhāvas

Keep separate:

- Rāśi
- whole-sign house
- cusp house
- Bhāva Chalit representation

Possible systems:

- Whole Sign
- Equal
- Śrīpati
- Placidus
- others by explicit profile

House-lord data should preserve both:

```text
rashi_house_lord
cusp_house_lord
```

where applicable.

---

# 33. Vargas

Generic object:

```text
VargaPosition {
    varga
    source_sign
    source_degree
    division_index
    target_sign
    target_degree
    lord
    dignity
    profile
}
```

Established:

- D1 Rāśi
- D2
- D3
- D7
- D9
- D10
- D12
- D30

High-precision/profile-sensitive:

- D4
- D16
- D20
- D24
- D27
- D40
- D45
- D60

D60 must never use rounded input.

---

# 34. Vimśottarī

Sequence:

```text
Ketu     7
Venus   20
Sun      6
Moon    10
Mars     7
Rahu    18
Jupiter 16
Saturn  19
Mercury 17
```

Total:

\[
120
\]

Birth Nakṣatra determines starting Mahādaśā.

Elapsed fraction:

\[
f=\frac{x}{800'}
\]

Balance:

\[
B=Y(1-f)
\]

Antardaśā:

\[
D_{M,A}=D_M\frac{Y_A}{120}
\]

All child periods must sum to parent duration.

---

# 35. Chara Daśā

Profile-dependent.

Current project synthetic profile:

```text
Meṣa      9
Vṛṣabha   2
Mithuna   4
Karkaṭa   5
Siṃha    12
Kanyā     2
Tulā     10
Vṛścika   9
Dhanu     5
Makara    2
Kumbha   12
Mīna     10
```

Total:

\[
82
\]

Do not represent this as the only possible Jaimini tradition.

---

# 36. Śaḍbala

\[
Śaḍbala =
Sthāna+Dig+Kāla+Ceṣṭā+Naisargika+Dṛk
\]

Raw unit:

```text
Ṣaṣṭiāṃśa
```

60 = 1 Rūpa.

Natural strengths:

```text
Sun     60
Moon    360/7
Venus   300/7
Jupiter 240/7
Mercury 180/7
Mars    120/7
Saturn   60/7
```

Dig Bala:

```text
Sun/Mars       10th
Moon/Venus      4th
Jupiter/Mercury 1st
Saturn           7th
```

---

# 37. Aṣṭakavarga

Contributors:

```text
Sun
Moon
Mars
Mercury
Jupiter
Venus
Saturn
Lagna
```

Rāhu/Ketu normally excluded.

Store:

```text
BAV
SAV
raw
śodhita
```

Do not invent a universal interpretation score.

---

# 38. Yoga engine

A Yoga is a logical rule.

```text
YogaRule {
    prerequisites
    relationships
    exclusions
    evidence
    profile
}
```

Separate:

```text
existence
activation
expression
```

Do not automatically cancel a Yoga because of combustion unless the actual rule specifies that.

---

# 39. Jaimini

Separate:

- Chara Kāraka
- Rāśi Dṛṣṭi
- Arūḍha
- Chara Daśā

Support 7- and 8-kāraka profiles.

Arūḍha should store:

```text
source sign
lord
lord sign
distance
raw projection
exceptions
```

A1 = AL.

A12 = UL.

---

# 40. Transit engine

For every graha:

```text
sidereal longitude
latitude
velocity
state
```

Solve:

- sign ingress
- Nakṣatra ingress
- pāda ingress
- stations
- aspect applications/separations

Preserve retrograde passes.

Keep:

```text
Parāśari aspect
Jaimini sign aspect
geometric aspect
```

as separate concepts.

---

# 41. Special points / Upagraha

Separate from physical grahas.

Registry:

```text
Gulika
Māndi
Dhūma
Vyatīpāta
Pariveṣa
Indracāpa
Upaketu
```

Rules must be profile-driven.

For Gulika/Māndi:

- use day/night segment methods
- store segment boundaries
- store representative point/time

Derived chains such as Dhūma must preserve full precision.

Do not assign fictional orbital velocities to derived points.

---

# 42. Validation system

## Hierarchy

```text
1. mathematical invariants
2. astronomical roots
3. Panchāṅga labels
4. festival dates
```

## Validation case

```text
ValidationCase {
    id
    subsystem
    input
    expected_root
    expected_label
    tolerance
    profile
    status
}
```

Statuses:

```text
PASS
FAIL
WARN
PROFILE_DIFFERENCE
UNVALIDATED
```

---

# 43. Error taxonomy

```text
A = ephemeris discrepancy
B = ayanāṃśa
C = coordinate frame
D = root solver
E = sunrise model
F = Moonrise/topocentric
G = tradition/profile
H = display rounding
I = timezone/time-scale
```

A discrepancy should be assigned one of these before being "fixed."

---

# 44. 2027 high-value regression data

Known New Moons:

```text
Jan 7
Feb 6
Mar 8
Apr 6
May 6
Jun 4
Jul 4
Aug 2
Aug 31
Sep 30
Oct 29
Nov 28
Dec 27
```

Known exact January New Moon:

```text
2027-01-07 20:24:25 UTC
2027-01-08 01:54:25 IST
```

Known January tests:

```text
Jan 1  sunrise → Kṛṣṇa Navamī / Citrā
Jan 3  sunrise → Kṛṣṇa Ekādaśī
Jan 7/8         → Amāvāsyā / New Moon
Jan 8  sunrise → Śukla Pratipadā
Jan 19 sunrise → Śukla Ekādaśī
Jan 20 sunrise → Trayodaśī
Jan 22          → Pūrṇimā / Full Moon
Jan 25          → Kṛṣṇa Caturthī at Moonrise
Jan 26 sunrise → Kṛṣṇa Pañcamī
Jan 14          → Makara Saṅkrānti
```

Karaṇa regression:

```text
Jan 6 → Viṣṭi → Śakuni
Jan 7 → Catuṣpāda → Nāga
Jan 8 → Kiṃstughna → Bava
```

---

# 45. 2027 Telugu month correction

The corrected sequence is:

```text
Mārgaśīrṣa → Jan 8
Pauṣya     → Feb 6
Māgha      → Mar 8
Phālguna   → Apr 6
Caitra     → May 6
Vaiśākha   → Jun 4
Jyeṣṭha    → Jul 4
Āṣāḍha     → Aug 2
Śrāvaṇa    → Aug 31
Bhādrapada → Sep 30
Āśvayuja   → Oct 29
Kārtīka    → Nov 28
Mārgaśīrṣa → Dec 27
```

This correction is important enough to remain in the regression history.

---

# 46. Source strategy — what to research first

## Tier 1 — must have

### Astronomy

- JPL DE440 documentation/data
- JPL Horizons
- IERS Earth Orientation Parameters
- IAU SOFA / IAU standards
- authoritative time-scale references

### Traditional astronomy

- Sūrya Siddhānta primary editions
- reliable translations
- scholarly astronomical reconstructions

### Panchāṅga

- multiple independent public Panchāṅgas
- at least one Telugu/Andhra-oriented source
- at least one independent astronomical calendar source

## Tier 2 — important

- academic papers on Indian astronomy
- historical studies of Indian calendars
- published computational reconstructions
- traditional Jyotiṣa editions

## Tier 3 — interpretive

- modern astrology references
- school-specific commentary
- regional observance explanations

---

# 47. Recommended source ledger

Every source gets:

```text
SourceRecord {
    id
    title
    author
    organization
    publication
    year
    url_or_identifier
    source_type
    authority_level
    subsystem
    exact_information_used
    profile
    validation_role
    notes
}
```

Authority levels:

```text
PRIMARY
TECHNICAL
ACADEMIC
SECONDARY
VALIDATION
INTERPRETIVE
```

---

# 48. External sources must be used correctly

## Good use

```text
Calculate New Moon ourselves
↓
compare with JPL/Horizons/reference
↓
difference = 0.2 seconds
↓
PASS
```

## Bad use

```text
Website says New Moon at 20:24
↓
put 20:24 into engine
↓
call it our calculation
```

The second process is not acceptable for the core engine.

---

# 49. Solar reference checklist

When someone asks:

> "Where do we get the Sun?"

The answer is:

### Raw astronomical position

Use:

- JPL DE440

### Earth orientation

Use:

- IERS

### Modern transformations

Use:

- IAU standards / SOFA

### Tropical longitude

Calculate ourselves.

### Lahiri sidereal longitude

Calculate ourselves using the selected ayanāṃśa model.

### Sunrise

Calculate from:

- solar apparent/topocentric geometry
- observer coordinates
- chosen horizon/refraction convention

### Validation

Compare with:

- JPL Horizons
- reputable astronomical almanacs
- independent Panchāṅgas where appropriate

---

# 50. Moon reference checklist

### Raw state

- JPL DE440

### Topocentric correction

Calculate ourselves.

### Moonrise

Calculate ourselves.

### Tithi

Calculate ourselves.

### Nakṣatra

Calculate ourselves.

### New Moon / Full Moon

Calculate ourselves.

### Validation

- JPL Horizons
- USNO or other authoritative astronomical event tables
- independent Panchāṅgas

---

# 51. Planet reference checklist

For Mercury through Saturn:

```text
DE440
↓
geocentric state
↓
apparent state if profile requires
↓
ecliptic longitude
↓
tropical longitude
↓
Lahiri
↓
sidereal longitude
```

Then derive:

- Rāśi
- Nakṣatra
- retrograde
- stations
- combustion
- transits

Do not use a Panchāṅga's planet sign as the numerical source.

---

# 52. Sunrise reference checklist

Required:

- latitude
- longitude
- elevation if used
- date
- Earth orientation
- Sun apparent position
- refraction/limb convention

The final calculation should be ours.

External sunrise tables are validation.

---

# 53. Panchāṅga validation strategy

For each month:

1. generate our continuous events
2. generate sunrise labels
3. compare against at least two independent calendars
4. identify disagreements
5. classify each
6. never simply overwrite our value

If multiple Panchāṅgas disagree, investigate:

- location
- sunrise convention
- ayanāṃśa
- ephemeris
- time scale
- tradition
- rounding

---

# 54. Traditional profile registry

The engine should allow:

```text
Profile {
    name
    astronomy_profile
    ayanamsa
    lunar_month_system
    festival_rules
    sunrise_rule
    ekadashi_rule
    eclipse_rule
    mudham_rule
    dasha_rules
    varga_rules
    jaimini_rules
}
```

Examples:

```text
Modern_Lahiri_Telugu
SS_Current
SS_Original
SS_Bija
Telugu_Smarta
Telugu_Vaishnava
```

---

# 55. What must never be silently mixed

Never mix:

```text
DE440 + Sūrya Siddhānta correction
modern sunrise + unexplained classical horizon
Lahiri + another ayanāṃśa
Smārta Ekādaśī + Vaiṣṇava pāraṇa
modern longitude separation + classical heliacal visibility
whole-sign house + cusp lordship
Parāśari aspect + Jaimini aspect
```

unless a profile explicitly defines that hybrid.

---

# 56. Precision rules

## Normal Panchāṅga

High enough precision for:

- seconds internally
- minute-level display where appropriate

## Event roots

Store:

```text
UTC timestamp
TT timestamp if relevant
IST display
residual
```

## D60 and similar Vargas

Use maximum available source precision.

Never use rounded display longitudes.

---

# 57. Data model

Recommended major objects:

```text
TimeState
EarthOrientation
EphemerisState
CoordinateState
AyanamsaState
SolarDay
LunarPhase
TithiInterval
NakshatraInterval
YogaInterval
KaranaInterval
SankrantiEvent
LunarMonth
FestivalOccurrence
EclipseEvent
GrahaState
Bhava
VargaPosition
DashaPeriod
YogaOccurrence
TransitEvent
SpecialPoint
ValidationCase
SourceRecord
Profile
```

---

# 58. Software architecture

Recommended engines:

```text
TimeEngine
EarthOrientationEngine
EphemerisEngine
CoordinateEngine
SiderealEngine
SolarEngine
LunarEngine
PanchangaEngine
LunarMonthEngine
FestivalEngine
MuhurtamEngine
EclipseEngine
SuryaSiddhantaEngine
VisibilityEngine
JyotishaEngine
VargaEngine
DashaEngine
ShadbalaEngine
AshtakavargaEngine
YogaEngine
JaiminiEngine
TransitEngine
ValidationEngine
SourceRegistry
ProfileRegistry
```

Each engine should have:

```text
inputs
outputs
profile
precision
source
tests
```

---

# 59. Research notebook structure

For each research topic use:

```text
Question
↓
Known facts
↓
Primary sources
↓
Secondary sources
↓
Competing interpretations
↓
Mathematical derivation
↓
Implementation
↓
Numerical test
↓
Independent validation
↓
Decision/profile
↓
Open questions
```

---

# 60. Scientific reproducibility checklist

Every published result should identify:

- date
- location
- timezone
- ephemeris
- time scale
- reference frame
- precession
- nutation
- ayanāṃśa
- observer model
- refraction model
- traditional profile
- rounding rule
- software version
- source ledger IDs

---

# 61. Important unresolved research questions

These must be investigated rather than guessed:

1. Exact historical Sūrya Siddhānta constants by recension.
2. Exact epoch conventions in computational reconstructions.
3. Bīja correction history.
4. Classical dṛkkarma implementation.
5. Kālāṃśa definition in visibility calculations.
6. Exact heliacal visibility model.
7. Regional Telugu festival differences.
8. Smārta/Vaiṣṇava Ekādaśī edge cases.
9. Puṇya-kāla traditions.
10. Complete classical Varga variants.
11. Śaḍbala variants.
12. Aṣṭakavarga śodhana variants.
13. Jaimini Kāraka variants.
14. Chara Daśā variants.
15. Upagraha formulas across traditions.

---

# 62. Development sequence

The safest development order is:

```text
PHASE 1
Time
↓
Julian Date
↓
Ephemeris
↓
Coordinate systems
↓
Earth orientation

PHASE 2
Sun/Moon
↓
Lahiri
↓
Tithi
↓
Nakṣatra
↓
Yoga
↓
Karaṇa

PHASE 3
Sunrise/sunset
↓
Moonrise/Moonset
↓
Daily Panchāṅga
↓
Lunar months
↓
Saṅkrānti

PHASE 4
Festival engine
↓
Muhūrta
↓
Eclipses

PHASE 5
Sūrya Siddhānta
↓
Classical visibility
↓
Mūḍham

PHASE 6
D1
↓
Bhāva
↓
Vargas
↓
Daśās

PHASE 7
Śaḍbala
↓
Aṣṭakavarga
↓
Yoga
↓
Jaimini
↓
Transits

PHASE 8
Full-year regression
↓
Multi-source validation
↓
Profile certification
```

---

# 63. 2027 as the golden development year

2027 is particularly useful because it contains:

- normal lunar months
- two New Moons in August
- multiple sign ingresses
- full range of lunar phases
- Mūḍham cases
- eclipse candidates
- retrograde planetary motion
- boundary conditions
- festival cases

It should become the first complete regression year.

---

# 64. 2028 validation

After 2027:

- generate 2028 independently
- validate Ugādi
- validate lunar month transitions
- validate Saṅkrānti
- validate festivals
- compare all event roots

Do not reuse 2027 date patterns.

---

# 65. Example of the intended answer workflow

Question:

> "When is Ugādi 2028?"

Engine:

```text
DE440
↓
Sun/Moon positions
↓
New Moon intervals
↓
Amānta month identification
↓
Caitra boundary
↓
Śukla Pratipadā interval
↓
Hyderabad sunrise
↓
Pratipadā at sunrise?
↓
YES
↓
Ugādi occurrence
```

Only after this:

```text
independent Panchāṅga validation
```

---

# 66. Example of Nakṣatra workflow

Question:

> "What is tomorrow's Nakṣatra?"

Engine:

```text
date
+
location
↓
Moon state
↓
apparent/geocentric longitude according to profile
↓
tropical ecliptic longitude
↓
Lahiri
↓
sidereal longitude
↓
13°20′ sector
↓
Nakṣatra
```

Then compare independently.

---

# 67. Golden rule for answers

When answering users, distinguish:

### CALCULATED

Produced by our engine.

### DERIVED

Mathematically obtained from calculated quantities.

### TRADITIONAL

A rule from a selected tradition/profile.

### VALIDATED

Independently compared with another source.

### PROFILE DIFFERENCE

Legitimate variation between traditions/models.

### UNVALIDATED

Not yet independently checked.

This vocabulary should appear in internal research and, when useful, in user-facing explanations.

---

# 68. Source ledger starter list

The project should research and maintain official/current references for:

### Astronomy

- JPL Solar System Dynamics / DE440 documentation
- JPL Horizons
- IERS
- IAU standards
- IAU SOFA

### Time

- BIPM / SI time references
- IERS UTC/UT1 information
- astronomical Julian Date references

### Solar/lunar events

- USNO astronomical data
- JPL/Horizons
- authoritative astronomical almanacs

### Indian astronomy

- primary Sūrya Siddhānta editions
- scholarly translations
- academic histories of Indian astronomy
- computational reconstruction papers

### Panchāṅga

- multiple independent Panchāṅga providers
- Telugu/Andhra calendar references
- regional temple/calendar sources where documented

### Jyotiṣa

- classical source editions
- scholarly translations
- documented school-specific commentaries

Do not rely on a single website for a foundational claim.

---

# 69. Source selection rule

Prefer:

```text
official primary source
>
primary classical edition
>
peer-reviewed / scholarly reconstruction
>
technical documentation
>
reputable secondary reference
>
public Panchāṅga validation
>
general web page
```

This hierarchy is not absolute: a Panchāṅga can be the correct source for documenting a regional observance convention, while it is not the correct source for planetary ephemeris mathematics.

---

# 70. Final implementation checklist

Before calling the core engine reliable:

### Astronomy

- [ ] Time scales implemented
- [ ] Julian Date implemented
- [ ] DE440 integrated
- [ ] coordinate transformations validated
- [ ] Earth orientation integrated
- [ ] Sun validated
- [ ] Moon validated
- [ ] planets validated

### Sidereal

- [ ] Lahiri documented
- [ ] tropical/sidereal separated
- [ ] precision preserved

### Panchāṅga

- [ ] Tithi
- [ ] Nakṣatra
- [ ] Yoga
- [ ] Karaṇa
- [ ] Vāra
- [ ] sunrise
- [ ] Moonrise
- [ ] lunar months
- [ ] Saṅkrānti

### Observance

- [ ] festivals
- [ ] anchors
- [ ] Ekādaśī profiles
- [ ] Pradoṣa
- [ ] regional rules

### Classical

- [ ] Sūrya Siddhānta constants
- [ ] mean motion
- [ ] corrections
- [ ] visibility
- [ ] Mūḍham

### Jyotiṣa

- [ ] D1
- [ ] Lagna
- [ ] Bhāva
- [ ] Vargas
- [ ] Daśā
- [ ] Śaḍbala
- [ ] Aṣṭakavarga
- [ ] Yoga
- [ ] Jaimini
- [ ] transit

### Validation

- [ ] 2027 full-year regression
- [ ] independent astronomical validation
- [ ] independent Panchāṅga validation
- [ ] source ledger
- [ ] discrepancy classification
- [ ] profile tests

---

# 71. Final principle

The purpose of this project is not to make a black box that says:

> "The Panchāṅga says this."

The purpose is to create a transparent chain:

```text
OBSERVATION / EPHEMERIS
        ↓
PHYSICAL / ASTRONOMICAL MATHEMATICS
        ↓
SIDEREAL TRANSFORMATION
        ↓
EVENT ROOT
        ↓
PANCHĀṄGA MATHEMATICS
        ↓
TRADITIONAL RULE
        ↓
LOCAL OBSERVANCE
        ↓
INDEPENDENT VALIDATION
```

Every link should be inspectable.

Where astronomy is precise, report precision.

Where the tradition has variants, report variants.

Where a reconstruction is uncertain, say so.

Where independent sources disagree, investigate rather than hide the disagreement.

The final system should be useful not only for producing dates, but for **teaching how those dates are produced**.

---

# 72. Immediate next research targets

The next deep research chapters should be:

## Research Block 1 — Modern astronomy implementation
- DE440 acquisition and format
- SPICE/JPL state interpretation
- TT/UTC/UT1
- IERS EOP
- IAU SOFA
- coordinate transformations
- Sun/Moon/planet numerical validation

## Research Block 2 — Complete 2027 Panchāṅga
- every tithi
- every Nakṣatra
- every yoga
- every karaṇa
- every sunrise
- every Moonrise
- every Saṅkrānti
- every lunar month

## Research Block 3 — Festival rulebook
- Telugu festivals
- anchors
- regional differences
- Ekādaśī profiles
- observance edge cases

## Research Block 4 — Sūrya Siddhānta reconstruction
- primary text
- constants
- mean motions
- correction algorithm
- epoch
- bīja
- independent numerical reconstruction

## Research Block 5 — Classical visibility
- dṛkkarma
- kālāṃśa
- heliacal visibility
- Mūḍham/Bālya

## Research Block 6 — Jyotiṣa computation
- D1
- Vargas
- Daśā
- Śaḍbala
- Aṣṭakavarga
- Yogas
- Jaimini
- transits

---

# 73. Closing statement

This document is the project's **master map**.

It should evolve, but its fundamental discipline should not:

> **Calculate first. Document the method. Identify the tradition. Validate independently. Preserve alternatives. Never manufacture certainty.**

