// ---------------------------------------------------------------------------
// Curated bodyweight strength + stretch moves for the Training page's
// "Strength + stretch" sessions — runner-focused (lower body/core strength,
// the spots that tend to get tight from running). Written from general,
// well-established exercise knowledge rather than copied from any single
// source. `referenceUrl` deliberately points at a YouTube search rather than
// a specific hotlinked page or embedded gif: a search always resolves to
// something relevant and current, instead of risking a stale link or
// reproducing someone else's copyrighted demonstration directly in this app.
// ---------------------------------------------------------------------------

function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

function exercise(id, name, instructions, reps) {
  return { id, name, instructions, reps, referenceUrl: youtubeSearchUrl(`${name} exercise proper form`) }
}

export const STRENGTH_EXERCISES = [
  exercise('squat', 'Bodyweight squat', 'Feet shoulder-width apart, sit hips back and down, knees tracking over toes, chest up.', '3 x 12-15'),
  exercise('reverse-lunge', 'Reverse lunge', 'Step one foot back, lower until both knees are near 90°, push back to standing. Alternate legs.', '3 x 10 per leg'),
  exercise('glute-bridge', 'Glute bridge', 'Lie on your back, knees bent, feet flat. Squeeze glutes to lift hips until body forms a straight line knee-to-shoulder.', '3 x 15'),
  exercise('single-leg-glute-bridge', 'Single-leg glute bridge', 'Same as a glute bridge, one foot lifted off the floor the whole time — more glute/hip stability work per side.', '2-3 x 10 per leg'),
  exercise('clamshell', 'Clamshell', 'Lie on your side, knees bent ~45°, feet together. Keeping feet touching, open your top knee like a clamshell.', '2-3 x 15 per side'),
  exercise('calf-raise', 'Calf raise', 'Stand tall, rise onto the balls of your feet, hold briefly, lower with control. Hold a wall or chair for balance if needed.', '3 x 15-20'),
  exercise('plank', 'Plank', 'Forearms and toes on the floor, body in a straight line from head to heels, core braced.', '3 x 30-45s'),
  exercise('side-plank', 'Side plank', 'Forearm and side of foot on the floor, hips lifted so the body forms a straight line. Switch sides.', '2-3 x 20-30s per side'),
  exercise('bird-dog', 'Bird dog', 'On hands and knees, extend one arm and the opposite leg straight out, keeping hips and back level. Alternate sides.', '2-3 x 10 per side'),
  exercise('step-up', 'Step-up', 'Step fully onto a sturdy stair or box with one foot, drive up to standing, step back down with control.', '3 x 10 per leg'),
  exercise('wall-sit', 'Wall sit', 'Back against a wall, slide down until thighs are roughly parallel to the floor, knees over ankles, hold.', '2-3 x 30-45s'),
  exercise('quadruped-hip-extension', 'Quadruped hip extension (donkey kick)', 'On hands and knees, keeping the knee bent, lift one leg so the sole of the foot faces the ceiling.', '2-3 x 12 per side'),
]

export const STRETCH_EXERCISES = [
  exercise('hip-flexor-stretch', 'Kneeling hip flexor stretch', 'Kneel on one knee, other foot planted in front. Shift weight forward gently until you feel a stretch in the front of the kneeling hip.', '2 x 30s per side'),
  exercise('standing-hamstring-stretch', 'Standing hamstring stretch', 'Prop one heel on a low step or curb, keep the leg straight, hinge forward from the hips until you feel a stretch behind the thigh.', '2 x 30s per side'),
  exercise('standing-quad-stretch', 'Standing quad stretch', 'Standing on one leg, grab the opposite ankle behind you and gently pull the heel toward your glutes, knees together.', '2 x 30s per side'),
  exercise('calf-stretch', 'Wall calf stretch', 'Hands on a wall, one foot back with the heel pressed down and leg straight, lean forward until you feel a stretch in the calf.', '2 x 30s per side'),
  exercise('figure-four-stretch', 'Figure-four glute/piriformis stretch', 'Lying on your back, cross one ankle over the opposite knee, pull the uncrossed thigh toward your chest.', '2 x 30s per side'),
  exercise('standing-it-band-stretch', 'Standing IT band stretch', 'Cross one leg behind the other, lean sideways away from the back leg until you feel a stretch along the outer thigh/hip.', '2 x 30s per side'),
]

// One "week" of variety for strength/stretch sessions — rotates through the
// lists deterministically by weekIndex so the plan doesn't prescribe the
// exact same moves every single week, without needing any random state to
// keep buildTrainingPlan a pure function (same weekIndex always picks the
// same exercises).
export function pickWeeklyExercises(weekIndex, { strengthCount = 4, stretchCount = 2 } = {}) {
  return {
    strength: rotate(STRENGTH_EXERCISES, weekIndex, strengthCount),
    stretch: rotate(STRETCH_EXERCISES, weekIndex, stretchCount),
  }
}

function rotate(list, weekIndex, count) {
  const n = Math.min(count, list.length)
  const start = (weekIndex * n) % list.length
  const picked = []
  for (let i = 0; i < n; i++) picked.push(list[(start + i) % list.length])
  return picked
}

export function exerciseById(id) {
  return STRENGTH_EXERCISES.find((e) => e.id === id) || STRETCH_EXERCISES.find((e) => e.id === id) || null
}
