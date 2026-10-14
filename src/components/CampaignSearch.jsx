import Icon from './Icon.jsx'

// Search box above the campaign list on the dashboards.
function CampaignSearch({ value, onChange }) {
  return (
    <div className="campaign-search" role="search">
      <Icon name="search" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search your campaigns"
        aria-label="Search campaigns"
      />
    </div>
  )
}

export default CampaignSearch
