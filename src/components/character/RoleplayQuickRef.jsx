// A compact, at-the-table summary of how to play the character: voice
// lines, persona, relationships and quirks. Quirks are shown as optional
// prompts with the situation they suit, not as things to do every scene.
function RoleplayQuickRef({ narrative, onEdit }) {
  const n = narrative
  const hasAnything =
    n.voiceExamples.length ||
    n.quirks.length ||
    n.relationships.length ||
    n.publicPersona ||
    n.privateThoughts ||
    n.dialogueGuidance ||
    n.bonds ||
    n.weaknesses

  if (!hasAnything) {
    return (
      <p className="inline-state">
        No roleplay notes yet.{' '}
        {onEdit && (
          <button type="button" className="btn btn--text vitals__setup" onClick={onEdit}>
            Add voice lines, quirks and bonds on the Roleplay page
          </button>
        )}
      </p>
    )
  }

  return (
    <div className="rp-quickref narrative">
      {(n.publicPersona || n.privateThoughts) && (
        <div className="rp-quickref__persona">
          {n.publicPersona && (
            <div>
              <h4>Out loud</h4>
              <p>{n.publicPersona}</p>
            </div>
          )}
          {n.privateThoughts && (
            <div>
              <h4>Inside</h4>
              <p>{n.privateThoughts}</p>
            </div>
          )}
        </div>
      )}

      {n.voiceExamples.length > 0 && (
        <div>
          <h4>Voice</h4>
          <ul className="rp-quickref__lines">
            {n.voiceExamples.map((line, i) => (
              <li key={i}>“{line}”</li>
            ))}
          </ul>
        </div>
      )}

      {n.dialogueGuidance && (
        <div>
          <h4>Dialogue guidance</h4>
          <p>{n.dialogueGuidance}</p>
        </div>
      )}

      {n.quirks.length > 0 && (
        <div>
          <h4>Optional quirks</h4>
          <ul className="rp-quickref__quirks">
            {n.quirks.map((q) => (
              <li key={q.id}>
                <span>{q.text}</span>
                {q.context && <span className="rp-quickref__context">When: {q.context}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(n.relationships.length > 0 || n.bonds) && (
        <div>
          <h4>Bonds</h4>
          {n.bonds && <p>{n.bonds}</p>}
          {n.relationships.length > 0 && (
            <ul className="rp-quickref__bonds">
              {n.relationships.map((r) => (
                <li key={r.id}>
                  <strong>{r.name || 'Unnamed'}</strong>
                  {r.bond && ` — ${r.bond}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {n.weaknesses && (
        <div>
          <h4>Watch out for</h4>
          <p>{n.weaknesses}</p>
        </div>
      )}
    </div>
  )
}

export default RoleplayQuickRef
