# Baystate Half Marathon — Training Plan

Status: **planning document only.** Nothing here is built yet — see "What's not decided yet" at the bottom before implementation starts.

## The goal, honestly

- Race: Baystate Half Marathon, Sunday Oct 18, 2026
- Today: Jul 29, 2026 — **12 weeks out**
- Current PR: 2:50:00 (12:59/mile)
- Background: Boston Marathon finisher (6:35:00), recent training run of 2.15 miles
- Current weekly volume: ~5-10 miles/week, longest recent run 3-4 miles
- Stated goal: sub-2:15:00 (10:18/mile average; a flat 10:00/mile pace gets you 2:11, which is a safer target to train for since it leaves a ~4 minute cushion for the last few miles slowing down, which almost everyone's do)

**The math:** 12:59/mile → 10:15-10:20/mile is about a 21% pace improvement. On top of that, your longest run right now (2-4 miles) is less than a third of race distance, so mileage has to ramp too. Doing both at once — a large pace jump *and* a large volume jump — in 12 weeks is the exact combination that causes most overuse injuries (shin splints, stress fractures, IT band syndrome). The standard safe guideline is no more than ~10% weekly mileage increase, and most half-marathon plans take 12-16 weeks to build a runner who's *already* running 15-20 mi/week up to race-ready, not someone starting from 5-10.

**How this plan handles it:** two tracks, not one number.

| | Primary goal (realistic, train for this) | Stretch goal (chase it if training goes well) |
|---|---|---|
| Target time | 2:25 - 2:35 | sub-2:15 (10:00-10:18/mile) |
| Pace | 11:00 - 11:50/mile | 10:00 - 10:18/mile |
| Why | Achievable 12-week improvement from your current base without breaking down | What you asked for — kept alive in the workout paces below, not abandoned |

The weekly workouts below are paced toward the stretch goal on the *short, fast* efforts (intervals, tempo) where the injury risk is low — that's exactly what actually improves race pace. The *long run* — where injury risk is highest — stays conservative and volume-focused regardless of pace goal. This is the standard way coaches reconcile "ambitious goal, short build, low base": chase speed in small controlled doses, build the aerobic engine safely. If the first 4-6 weeks go well with zero pain/injury, the primary goal shifts up; if not, nothing breaks.

## Structure: 12 weeks, 3 phases

**Weeks 1-4 — Base building.** Goal: get to ~15-18 mi/week safely, reintroduce the body to consistent running. Long run grows from 3 → 6 miles. No hard speedwork yet beyond light strides.

**Weeks 5-9 — Build.** Goal: peak weekly volume (~22-26 mi/week), long run grows to 10-11 miles by week 9. Introduce one tempo run and one interval session per week at stretch-goal pace.

**Weeks 10-12 — Taper.** Volume drops ~20-30% each week. Long run caps at 8 miles two weeks out, short and easy race week. This is where fitness "shows up" — don't skip it even though it feels like doing less than you could.

## Weekly template (Build phase, weeks 5-9)

| Day | Session | Purpose |
|---|---|---|
| Mon | Rest or 20 min easy walk/mobility | Recovery |
| Tue | Easy run, 3-4 mi, conversational pace | Aerobic base |
| Wed | Strength (lower body + core, 30-40 min) + stretching | Injury prevention — the #1 predictor of half-marathon injury is skipping this |
| Thu | Quality: tempo or intervals at stretch pace (10:00-10:18/mile), 3-5 mi total including warm-up/cooldown | Speed, in small controlled doses |
| Fri | Rest or easy cross-train (bike/swim, 30 min) | Recovery |
| Sat | Easy run, 3-4 mi | Aerobic base |
| Sun | Long run, easy pace (11:30-12:30/mile — slower than race pace on purpose) | Volume, durability |

Stretching: 10 min post-run dynamic/static stretch every running day, not just the dedicated strength day.

## Nearby routes / locations

Once you tell me your general area (town/zip), I can pull actual named routes, trails, or tracks and match them to session type — e.g., a flat track or road loop for the Thursday interval sessions, a scenic longer trail or river path for Sunday long runs. This needs real location input from you before I can suggest anything specific; I won't guess.

## How this plugs into Home Hub

- Each training session becomes a personal event on the Home Hub calendar (same `families/{familyId}/events` collection everything else uses), auto-generated for all 12 weeks once you approve the plan — matches what you said earlier ("auto-added as my events").
- A new `owner: <your uid>` event per session, with `notes` holding the workout detail (e.g., "Tempo: 1mi warm-up, 3mi @ 10:10/mi, 1mi cooldown").
- No new Firestore collection needed — this rides on the existing `events` schema. The only addition is a `trainingPlan` flag or tag in `notes`/a small metadata field, so the app can later show a "Training" filter or a race countdown widget on the dashboard, if you want that.
- Data source for now: manual (you log actual runs somewhere — Garmin, your own notes — and can adjust/reschedule missed sessions in the calendar like any other event). Garmin API integration was flagged earlier as a possible future add-on, not required to ship this.

## What's not decided yet

- **Your location** — needed before I can suggest real routes.
- **Preferred running days** — the weekly template above assumes Tue/Thu/Sat/Sun running + Wed strength; tell me if that clashes with your schedule (or Home Hub's existing family calendar commitments) and I'll rearrange.
- **Injury history** — any past running injuries (shin splints, knee, IT band, etc.) I should build extra caution around?
- **Strength training equipment/access** — gym, home with dumbbells, or bodyweight-only? Changes what the Wednesday sessions actually prescribe.
- **How firm is the Oct 18 date** — confirming there's no flexibility to push the goal race if week 1-4 shows the base build needs more time.

Once these are answered, next step is generating the actual 12-week, ~60-session event list and writing the code that inserts it into `db.js`/Firestore for your account.
