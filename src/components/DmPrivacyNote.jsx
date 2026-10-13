// Honest framing for DM-only screens: hidden from players in the app,
// but this app has no per-user database security (see schema.sql).
function DmPrivacyNote() {
  return (
    <p className="dm-privacy-note">
      <span aria-hidden="true">🔒</span> Only DMs see this in the app. It isn’t locked like a password-protected
      account, though, so keep big plot secrets in your own notes.
    </p>
  )
}

export default DmPrivacyNote
