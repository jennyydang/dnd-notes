// Party-member chooser for the admin account, which has no character of
// its own to open.
function CharacterPicker({ party, value, onChange }) {
  return (
    <div className="field character-picker">
      <label htmlFor="character-picker">Character</label>
      <select id="character-picker" value={value} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Choose a party member…</option>
        {party.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.race_class ? ` — ${m.race_class}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export default CharacterPicker
