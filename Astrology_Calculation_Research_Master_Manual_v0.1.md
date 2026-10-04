# Astrology Calculation & Research Master Manual

Version 0.1

This is the canonical working specification for the Astrology project. It separates astronomy, traditional observance rules, and independent validation.

## Core principle
**derive → calculate → validate → document differences → regression-lock**

## Profiles
- Modern astronomy: JPL DE440, IAU 2006 precession, IAU 2000A nutation, Lahiri/Citrāpakṣa, Asia/Kolkata.
- Classical: SS-Original, SS-Current/Transmitted, SS-Bīja.
- Telugu: Amānta lunar months and explicit observance profiles.

## Panchāṅga formulas
### Tithi
E = norm360(λMoon − λSun)

Tithi = floor(E / 12°) + 1.
Boundaries: E = 12°n.

### Nakṣatra
N = floor(λMoon_sidereal / 13°20′) + 1.

### Yoga
Yθ = norm360(λSun_sidereal + λMoon_sidereal)
Yoga = floor(Yθ / 13°20′) + 1.

### Karaṇa
Half-tithi boundaries are E = 6°n. Seven movable karaṇas are Bava, Bālava, Kaulava, Taitila, Gara, Vaṇija, Viṣṭi; fixed end sequence is Śakuni, Catuṣpāda, Nāga, Kiṃstughna. Never use a simple modulo-11 implementation.

### Saṅkrānti
λSun_sidereal = 30°n.

## Astronomy
Modern pipeline:
ephemeris → frame transformation → geocentric/apparent state → ecliptic longitude → tropical → Lahiri sidereal.

Topocentric Moon is required for Moonrise. Sunrise uses an explicit apparent-altitude convention. Exact roots are primary; display rounding is secondary.

## Lunar months
Amānta month boundaries are New Moons. Corrected 2027 sequence:
Mārgaśīrṣa→Jan 8; Pauṣya→Feb 6; Māgha→Mar 8; Phālguna→Apr 6; Caitra→May 6; Vaiśākha→Jun 4; Jyeṣṭha→Jul 4; Āṣāḍha→Aug 2; Śrāvaṇa→Aug 31; Bhādrapada→Sep 30; Āśvayuja→Oct 29; Kārtīka→Nov 28; Mārgaśīrṣa→Dec 27; next Pauṣya→Jan 26 2028.

## Festival architecture
Festival = month + paksha + tithi + anchor + tradition profile. Examples: Ugādi = Caitra Śukla Pratipadā at sunrise; Rāma Navamī = Caitra Śukla Navamī at Madhyāhna; Saṅkaṣṭahara Caturthī = Kṛṣṇa Caturthī at Moonrise; Mahāśivarātri = Māgha Kṛṣṇa Caturdaśī at Niśītha.

## Sūrya Siddhānta
Mahāyuga = 4,320,000 years; transmitted civil days = 1,577,917,828. Revolutions: Sun 4,320,000; Moon 57,753,336; Mars 2,296,832; Mercury śīghrocca 17,937,060; Jupiter 364,220; Venus śīghrocca 7,022,376; Saturn 146,568. Keep original constants separate.

Sine table R=3438: 225,449,671,890,1105,1315,1520,1719,1910,2093,2267,2431,2585,2728,2859,2978,3084,3177,3256,3321,3372,3409,3431,3438.

## Classical visibility
Classical visibility is not raw ecliptic separation. It involves true longitude, dṛkkarma, kālāṃśa, and profile-specific thresholds. Modern angular-separation diagnostics are validation/diagnostic data only, not automatically heliacal visibility.

## Jyotiṣa layers
D1, bhāvas, Vargas, Vimśottarī, Śaḍbala, Aṣṭakavarga, Yoga predicates, Jaimini, transits and timing are separate engines. D60 and other high-precision Vargas must never use rounded longitude.

## Validation
Validation hierarchy: mathematical invariants → astronomical event roots → daily Panchāṅga labels → festivals. Statuses: PASS, FAIL, WARN, PROFILE_DIFFERENCE, UNVALIDATED. Error classes: ephemeris, ayanāṃśa, coordinate frame, root solver, sunrise model, Moonrise/topocentric, tradition/profile, rounding, timezone/time-scale.

## Source policy
Primary astronomical sources provide numerical astronomy. Classical sources provide traditional rules/constants. Panchāṅgas are independent validation unless explicitly designated otherwise. Maintain a source ledger with source ID, subject, source, type, what is taken, what is not taken, and status.

## Build order
Time scales → Julian dates → ephemeris → coordinates → Lahiri → Sun/Moon → Panchāṅga → horizon → lunar months → festivals → eclipses → Sūrya Siddhānta → visibility → D1 → bhāvas → Vargas → Daśās → strength → Jaimini → transits → integrated validation.

## Ethical principle
The system should distinguish observation from interpretation, astronomy from tradition, calculation from validation, and uncertainty from certainty. Its purpose is transparent, reproducible knowledge.
