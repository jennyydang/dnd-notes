import { useState } from 'react'
import { useCampaignData, useCampaignNav } from '../hooks/useCampaignData.js'
import { useActiveCharacter } from '../hooks/useActiveCharacter.js'
import { useCharacterSheet } from '../hooks/useCharacterSheet.js'
import { getPublicUrl } from '../lib/storage.js'
import TabNav from './TabNav.jsx'
import CharacterPicker from './character/CharacterPicker.jsx'
import MechanicsSheet from './character/MechanicsSheet.jsx'
import RoleplayGuide from './character/RoleplayGuide.jsx'
import RoleplayQuickRef from './character/RoleplayQuickRef.jsx'
import RoleplayAssistant from './character/RoleplayAssistant.jsx'
import { SaveStatus, SectionCard } from './ui.jsx'
import './CharacterTab.scss'

const VIEWS = [
  { id: 'mechanics', label: 'Mechanics' },
  { id: 'roleplay', label: 'Roleplay' },
  { id: 'quickref', label: 'Quick reference' },
  { id: 'assistant', label: 'Assistant' },
]

function CharacterSheetView({ campaignId, character }) {
  const nav = useCampaignNav()
  const sheetApi = useCharacterSheet(campaignId, character.id)
  const [view, setView] = useState('mechanics')
  const photo = getPublicUrl('party-portraits', character.photo_path)

  return (
    <div className="character-tab">
      <header className="character-tab__identity panel">
        {photo ? (
          <img src={photo} alt={`Portrait of ${character.name}`} className="character-tab__portrait" />
        ) : (
          <span className="character-tab__portrait character-tab__portrait--fallback" aria-hidden="true">
            {character.name?.[0]?.toUpperCase() || '?'}
          </span>
        )}
        <div className="character-tab__who">
          <h2 className="character-tab__name">{character.name}</h2>
          <p className="character-tab__meta">
            {[character.race_class || 'Race / class not set', `Level ${character.level}`].join(' · ')}
            {sheetApi.sheet?.narrative.background && ` · ${sheetApi.sheet.narrative.background}`}
          </p>
          <button type="button" className="btn btn--text character-tab__edit-link" onClick={() => nav.goTo('party')}>
            Edit name, portrait, race/class & level on Party
          </button>
        </div>
        <SaveStatus status={sheetApi.status} error={sheetApi.saveError} onRetry={sheetApi.retry} />
      </header>

      <TabNav tabs={VIEWS} activeTab={view} onSelect={setView} className="tab-nav--pill character-tab__views" label="Character sheet sections" />

      {sheetApi.loading ? (
        <p className="inline-state">Loading sheet…</p>
      ) : !sheetApi.sheet ? (
        <p className="inline-state inline-state--error" role="alert">
          Couldn&apos;t load the character sheet{sheetApi.error ? `: ${sheetApi.error}` : ''}. If this
          is a new install, make sure the latest <code>supabase/schema.sql</code> has been run.
        </p>
      ) : (
        <>
          {sheetApi.error && (
            <p className="inline-state inline-state--error" role="alert">
              Couldn&apos;t load the saved sheet ({sheetApi.error}). Changes won&apos;t save until
              the latest <code>supabase/schema.sql</code> has been run.
            </p>
          )}
          {view === 'mechanics' && <MechanicsSheet character={character} sheetApi={sheetApi} />}
          {view === 'roleplay' && <RoleplayGuide character={character} sheetApi={sheetApi} />}
          {view === 'quickref' && (
            <SectionCard title={`Playing ${character.name}`} icon="🎭">
              <RoleplayQuickRef narrative={sheetApi.sheet.narrative} onEdit={() => setView('roleplay')} />
            </SectionCard>
          )}
          {view === 'assistant' && <RoleplayAssistant character={character} narrative={sheetApi.sheet.narrative} />}
        </>
      )}
    </div>
  )
}

// Character overview: mechanics and roleplay kept on separate pages of
// one autosaved sheet. Players see the character they claimed; the admin
// picks any party member.
function CharacterTab() {
  const { campaignId } = useCampaignData()
  const nav = useCampaignNav()
  const { character, party, isAdmin, pick, loading, error } = useActiveCharacter()

  return (
    <>
      {isAdmin && <CharacterPicker party={party} value={character?.id || ''} onChange={pick} />}
      {loading ? (
        <p className="inline-state">Loading…</p>
      ) : error ? (
        <p className="inline-state inline-state--error">{error}</p>
      ) : character ? (
        <CharacterSheetView key={character.id} campaignId={campaignId} character={character} />
      ) : (
        <SectionCard title="No character yet" icon="🎭">
          <p>
            {isAdmin
              ? 'Choose a party member above to view or edit their sheet.'
              : 'Add your character to the party (or claim an existing one) on the Party screen — then their sheet lives here.'}
          </p>
          {!isAdmin && (
            <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="btn btn--primary" onClick={() => nav.goTo('party')}>
                Go to Party
              </button>
            </div>
          )}
        </SectionCard>
      )}
    </>
  )
}

export default CharacterTab
