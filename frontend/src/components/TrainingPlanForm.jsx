import { useState } from 'react'
import { DISTANCES, DEFAULT_PROFILE, buildDaysMapping } from '../lib/trainingPlan.js'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DISTANCE_OPTIONS = [...Object.entries(DISTANCES), ['custom', null]]

function minutesToHM(minutes) {
  if (!minutes) return { h: '', m: '' }
  return { h: String(Math.floor(minutes / 60)), m: String(Math.round(minutes % 60)) }
}

function hmToMinutes(h, m) {
  const hh = Number(h) || 0
  const mm = Number(m) || 0
  return hh * 60 + mm > 0 ? hh * 60 + mm : null
}

// Collects everything buildTrainingPlan() needs, pre-filled from an
// existing profile (regenerating/editing) or DEFAULT_PROFILE (first time).
// Calls onSubmit(profile) with a fully-resolved profile object — distance
// resolved from the dropdown/custom field, times converted to minutes, and
// the three day-pickers expanded into the full 7-day `days` mapping.
export default function TrainingPlanForm({ initial, onSubmit, submitting }) {
  const p = initial || DEFAULT_PROFILE
  const initialDistanceKey = Object.entries(DISTANCES).find(([, mi]) => mi === p.raceDistanceMiles)?.[0] || 'custom'

  const [raceName, setRaceName] = useState(p.raceName || '')
  const [raceDateISO, setRaceDateISO] = useState(p.raceDateISO || '')
  const [distanceKey, setDistanceKey] = useState(initialDistanceKey)
  const [customMiles, setCustomMiles] = useState(initialDistanceKey === 'custom' ? String(p.raceDistanceMiles || '') : '')

  const targetHM = minutesToHM(p.targetTimeMinutes)
  const [targetH, setTargetH] = useState(targetHM.h)
  const [targetM, setTargetM] = useState(targetHM.m)

  const [recentDistanceKey, setRecentDistanceKey] = useState(
    Object.entries(DISTANCES).find(([, mi]) => mi === p.recentRaceDistanceMiles)?.[0] || (p.recentRaceDistanceMiles ? 'custom' : '')
  )
  const [recentCustomMiles, setRecentCustomMiles] = useState('')
  const recentHM = minutesToHM(p.recentRaceTimeMinutes)
  const [recentH, setRecentH] = useState(recentHM.h)
  const [recentM, setRecentM] = useState(recentHM.m)

  const [currentWeeklyMileage, setCurrentWeeklyMileage] = useState(String(p.currentWeeklyMileage ?? ''))
  const [longestRecentRunMiles, setLongestRecentRunMiles] = useState(String(p.longestRecentRunMiles ?? ''))

  const daysIn = p.days || DEFAULT_PROFILE.days
  const [longDay, setLongDay] = useState(String(daysIn.long?.[0] ?? 6))
  const [qualityDay, setQualityDay] = useState(String(daysIn.quality?.[0] ?? 3))
  const [strengthDay, setStrengthDay] = useState(String(daysIn.strength?.[0] ?? 2))

  const [equipment, setEquipment] = useState(p.equipment || 'bodyweight')
  const [injuryNotes, setInjuryNotes] = useState(p.injuryNotes || '')

  const resolvedDistance = distanceKey === 'custom' ? Number(customMiles) || 0 : DISTANCES[distanceKey]
  const resolvedRecentDistance = recentDistanceKey === 'custom' ? Number(recentCustomMiles) || null : DISTANCES[recentDistanceKey] || null

  const submit = (e) => {
    e.preventDefault()
    if (!raceName.trim() || !raceDateISO || !resolvedDistance) return

    const profile = {
      raceName: raceName.trim(),
      raceDateISO,
      raceDistanceMiles: resolvedDistance,
      targetTimeMinutes: hmToMinutes(targetH, targetM),
      recentRaceDistanceMiles: resolvedRecentDistance,
      recentRaceTimeMinutes: resolvedRecentDistance ? hmToMinutes(recentH, recentM) : null,
      currentWeeklyMileage: Number(currentWeeklyMileage) || 0,
      longestRecentRunMiles: Number(longestRecentRunMiles) || 0,
      days: buildDaysMapping(Number(longDay), Number(qualityDay), Number(strengthDay)),
      equipment,
      injuryNotes: injuryNotes.trim(),
    }
    onSubmit(profile)
  }

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: 16 }}>
      <div className="section-title">Build your training plan</div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Race name</label>
        <input value={raceName} onChange={(e) => setRaceName(e.target.value)} required />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="field">
          <label>Race date</label>
          <input type="date" value={raceDateISO} onChange={(e) => setRaceDateISO(e.target.value)} required />
        </div>
        <div className="field">
          <label>Distance</label>
          <select value={distanceKey} onChange={(e) => setDistanceKey(e.target.value)}>
            {DISTANCE_OPTIONS.map(([key]) => (
              <option key={key} value={key}>{key === 'custom' ? 'Custom' : key}</option>
            ))}
          </select>
        </div>
        {distanceKey === 'custom' && (
          <div className="field">
            <label>Miles</label>
            <input type="number" step="0.01" min="0" value={customMiles} onChange={(e) => setCustomMiles(e.target.value)} required />
          </div>
        )}
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Target finish time (optional — your stretch goal)</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" min="0" placeholder="hr" style={{ width: 70 }} value={targetH} onChange={(e) => setTargetH(e.target.value)} />
          <span>:</span>
          <input type="number" min="0" max="59" placeholder="min" style={{ width: 70 }} value={targetM} onChange={(e) => setTargetM(e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>A recent race result (optional, but gives a real pace prediction instead of a rough guess)</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={recentDistanceKey} onChange={(e) => setRecentDistanceKey(e.target.value)}>
            <option value="">None</option>
            {DISTANCE_OPTIONS.map(([key]) => (
              <option key={key} value={key}>{key === 'custom' ? 'Custom' : key}</option>
            ))}
          </select>
          {recentDistanceKey === 'custom' && (
            <input type="number" step="0.01" min="0" placeholder="miles" style={{ width: 90 }} value={recentCustomMiles} onChange={(e) => setRecentCustomMiles(e.target.value)} />
          )}
          {recentDistanceKey && (
            <>
              <input type="number" min="0" placeholder="hr" style={{ width: 60 }} value={recentH} onChange={(e) => setRecentH(e.target.value)} />
              <span>:</span>
              <input type="number" min="0" max="59" placeholder="min" style={{ width: 60 }} value={recentM} onChange={(e) => setRecentM(e.target.value)} />
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="field">
          <label>Current weekly mileage</label>
          <input type="number" min="0" value={currentWeeklyMileage} onChange={(e) => setCurrentWeeklyMileage(e.target.value)} />
        </div>
        <div className="field">
          <label>Longest recent run (mi)</label>
          <input type="number" min="0" step="0.1" value={longestRecentRunMiles} onChange={(e) => setLongestRecentRunMiles(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="field">
          <label>Long run day</label>
          <select value={longDay} onChange={(e) => setLongDay(e.target.value)}>
            {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Quality/speed day</label>
          <select value={qualityDay} onChange={(e) => setQualityDay(e.target.value)}>
            {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Strength day</label>
          <select value={strengthDay} onChange={(e) => setStrengthDay(e.target.value)}>
            {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <label>Strength equipment</label>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="bodyweight">Bodyweight only</option>
          <option value="dumbbells">Home dumbbells</option>
          <option value="gym">Full gym</option>
        </select>
      </div>

      <div className="field" style={{ marginBottom: 14 }}>
        <label>Injury history / anything to be careful of (optional)</label>
        <textarea value={injuryNotes} onChange={(e) => setInjuryNotes(e.target.value)} rows={2} />
      </div>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Generating…' : 'Generate my training plan'}
      </button>
    </form>
  )
}
