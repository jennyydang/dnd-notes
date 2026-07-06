import { useState } from 'react'
import { CURRENCIES, formatAmount } from '../lib/currency.js'

function CurrencyCalculator() {
  const [amount, setAmount] = useState('')
  const [fromCurrency, setFromCurrency] = useState('gold')

  const parsedAmount = parseFloat(amount)
  const hasAmount = Number.isFinite(parsedAmount)
  const fromCopperValue = CURRENCIES.find((c) => c.id === fromCurrency).copperValue
  const totalCopper = hasAmount ? parsedAmount * fromCopperValue : null

  return (
    <div className="currency-calculator panel">
      <h3 className="currency-calculator__title">Currency Calculator</h3>
      <p className="currency-calculator__note">
        Gold and platinum are equally rare, worth days of hard labor —
        most towns deal in shillings and copper, reaching up to silver.
      </p>
      <div className="currency-calculator__input">
        <div className="field">
          <label htmlFor="currency-amount">Amount</label>
          <input
            id="currency-amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor="currency-from">Currency</label>
          <select
            id="currency-from"
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <dl className="currency-calculator__results">
        {CURRENCIES.map((c) => (
          <div
            key={c.id}
            className={`currency-calculator__result${
              c.id === fromCurrency ? ' currency-calculator__result--active' : ''
            }`}
          >
            <dt>{c.label}</dt>
            <dd>{totalCopper === null ? '—' : formatAmount(totalCopper / c.copperValue)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default CurrencyCalculator
