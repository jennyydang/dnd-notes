import { useState } from 'react'
import { useSupabaseTable } from '../hooks/useSupabaseTable.js'

const partyFromRow = (r) => ({ id: r.id, name: r.name })

// One name per line or comma-separated; blanks and repeats dropped.
function parseNames(text) {
  const seen = new Set()
  return text
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase()
      if (!name || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// Fisher–Yates with crypto randomness, so every ordering is equally likely.
function shuffle(list) {
  const result = [...list]
  const random = new Uint32Array(1)
  for (let i = result.length - 1; i > 0; i--) {
    crypto.getRandomValues(random)
    const j = random[0] % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Deal the shuffled names out round-robin, so team sizes never differ by
// more than one.
function makeTeams(names, teamCount) {
  const teams = Array.from({ length: teamCount }, () => [])
  shuffle(names).forEach((name, index) => teams[index % teamCount].push(name))
  return teams
}

// Splits a list of players into random, evenly sized teams. Nothing is
// saved — it's a quick table-side tool, like the currency calculator.
function TeamGenerator({ campaignId }) {
  const { items: party } = useSupabaseTable('party_members', {
    fromRow: partyFromRow,
    filters: { campaign_id: campaignId },
  })
  const [namesText, setNamesText] = useState('')
  const [teamCount, setTeamCount] = useState('2')
  const [teams, setTeams] = useState(null)
  const [formError, setFormError] = useState(null)

  const names = parseNames(namesText)

  function loadParty() {
    setNamesText(party.map((member) => member.name.trim()).filter(Boolean).join('\n'))
    setTeams(null)
    setFormError(null)
  }

  function generate(event) {
    event?.preventDefault()
    const count = Math.floor(Number(teamCount))
    if (names.length < 2) {
      setFormError('Enter at least two players.')
      return
    }
    if (!Number.isFinite(count) || count < 2) {
      setFormError('Split into at least two teams.')
      return
    }
    if (count > names.length) {
      setFormError(`Only ${names.length} players — that's at most ${names.length} teams.`)
      return
    }
    setFormError(null)
    setTeams(makeTeams(names, count))
  }

  return (
    <div className="team-generator panel">
      <h3 className="team-generator__title">Team Generator</h3>
      <p className="team-generator__note">
        Enter the players, pick how many teams, and they&apos;ll be split at random.
      </p>

      <form className="team-generator__form" onSubmit={generate}>
        <div className="field">
          <div className="team-generator__label-row">
            <label htmlFor="team-players">Players ({names.length})</label>
            {party.length > 0 && (
              <button type="button" className="btn btn--text" onClick={loadParty}>
                Use party
              </button>
            )}
          </div>
          <textarea
            id="team-players"
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            placeholder={'One per line or comma-separated\nThessaly\nBorin\nElandra'}
          />
        </div>
        <div className="team-generator__controls">
          <div className="field">
            <label htmlFor="team-count">Teams</label>
            <input
              id="team-count"
              type="number"
              min="2"
              step="1"
              value={teamCount}
              onChange={(e) => setTeamCount(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary">
            {teams ? 'Reshuffle' : 'Generate Teams'}
          </button>
        </div>
      </form>

      {formError && <p className="empty-state empty-state--error">{formError}</p>}

      {teams && !formError && (
        <ol className="team-generator__teams">
          {teams.map((team, index) => (
            <li key={index} className="team-generator__team">
              <h4>Team {index + 1}</h4>
              <ul>
                {team.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default TeamGenerator
