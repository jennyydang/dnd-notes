import { useState } from 'react'
import { SEIYA_SOURCE, applyGuide, looksLikeSeiya, seiyaGuide } from '../../lib/seiya.js'
import { todayIso } from '../../lib/sessionMode.js'
import { SectionCard } from '../ui.jsx'
import { ListEditor, StringListEditor, TextArea } from './fields.jsx'

// The narrative half of the sheet: who the character is and how to play
// them. Kept visually separate from mechanics (prose styling, no numbers).
function RoleplayGuide({ character, sheetApi }) {
  const { sheet, updateNarrative } = sheetApi
  const n = sheet.narrative
  const set = (key) => (value) => updateNarrative({ [key]: value })
  const [applied, setApplied] = useState(false)

  const offerSeiya = looksLikeSeiya(character.name)

  return (
    <div className="sheet narrative">
      {offerSeiya && (
        <SectionCard title="Seiya’s established voice" icon="🕯️" className="sheet__template">
          <p>
            Fill in Seiya&apos;s persona, voice lines and quirks from her character brief. Only empty
            fields are filled and nothing you&apos;ve written is changed — edit or delete anything
            afterwards.
          </p>
          <p className="field-hint">
            Source: {SEIYA_SOURCE} No Seiya character files were found in this project, so
            relationships, ideals and bonds are left for you to write.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                updateNarrative((current) => applyGuide(current, seiyaGuide()))
                setApplied(true)
              }}
            >
              Apply Seiya&apos;s guide
            </button>
          </div>
          {applied && (
            <p className="save-status save-status--saved" role="status">
              ✓ Applied — see the sections below.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard title="Identity" icon="🪪">
        <div className="sheet__grid sheet__grid--wide">
          <TextArea label="Background" value={n.background} onChange={set('background')} rows={2} />
          <TextArea label="Alignment" value={n.alignment} onChange={set('alignment')} rows={1} />
        </div>
      </SectionCard>

      <SectionCard title="Public persona vs. private thoughts" icon="🎭">
        <div className="sheet__split">
          <TextArea
            label="How others see them"
            value={n.publicPersona}
            onChange={set('publicPersona')}
            rows={4}
          />
          <TextArea
            label="What goes on inside"
            value={n.privateThoughts}
            onChange={set('privateThoughts')}
            rows={4}
          />
        </div>
      </SectionCard>

      <SectionCard title="Voice" icon="🗣️">
        <StringListEditor
          label="Voice examples"
          items={n.voiceExamples}
          onChange={set('voiceExamples')}
          placeholder="A line they might say…"
          addLabel="Add line"
        />
        <TextArea
          label="Dialogue guidance"
          value={n.dialogueGuidance}
          onChange={set('dialogueGuidance')}
          rows={3}
          hint="Tone, word choice, what they'd never say."
        />
      </SectionCard>

      <SectionCard title="Personality & philosophy" icon="🧭">
        <div className="sheet__grid sheet__grid--wide">
          <TextArea label="Personality traits" value={n.personality} onChange={set('personality')} />
          <TextArea label="Ideals" value={n.ideals} onChange={set('ideals')} />
          <TextArea label="Bonds" value={n.bonds} onChange={set('bonds')} />
          <TextArea label="Flaws" value={n.flaws} onChange={set('flaws')} />
          <TextArea label="Motivations" value={n.motivations} onChange={set('motivations')} />
          <TextArea label="Philosophy" value={n.philosophy} onChange={set('philosophy')} />
        </div>
        <TextArea label="Personal history" value={n.history} onChange={set('history')} rows={5} />
      </SectionCard>

      <SectionCard title="Relationships" icon="🤝">
        <ListEditor
          label="People who matter"
          items={n.relationships}
          onChange={set('relationships')}
          fields={[
            { key: 'name', label: 'Who' },
            { key: 'bond', label: 'Bond', placeholder: 'mentor, rival, patient…' },
            { key: 'notes', label: 'History', type: 'textarea' },
          ]}
          newItem={{ name: '', bond: '', notes: '' }}
          addLabel="Add relationship"
          emptyText="Party members, NPCs, family — and how the bond has changed."
        />
      </SectionCard>

      <SectionCard title="Quirks & weaknesses" icon="🪶">
        <ListEditor
          label="Roleplay quirks"
          items={n.quirks}
          onChange={set('quirks')}
          fields={[
            { key: 'text', label: 'Quirk' },
            { key: 'context', label: 'Fits when…', placeholder: 'optional' },
          ]}
          newItem={{ text: '', context: '' }}
          addLabel="Add quirk"
          emptyText="Habits to reach for when they fit — shown as optional reminders at the table."
        />
        <TextArea label="Weaknesses & blind spots" value={n.weaknesses} onChange={set('weaknesses')} />
      </SectionCard>

      <SectionCard title="Development over time" icon="📈">
        <ListEditor
          label="Moments that changed them"
          items={n.development}
          onChange={set('development')}
          fields={[
            { key: 'date', label: 'When', type: 'date' },
            { key: 'text', label: 'What changed', type: 'textarea' },
          ]}
          newItem={{ date: todayIso(), text: '' }}
          addLabel="Add entry"
          emptyText="Log turning points: decisions, losses, shifts in belief or relationships."
        />
      </SectionCard>
    </div>
  )
}

export default RoleplayGuide
