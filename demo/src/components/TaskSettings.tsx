import { useState } from 'react'
import { Card } from '@just-every/demo-ui'

interface TaskSettingsProps {
  onSettingsChange: (settings: {
    metaFrequency: string;
    metamemoryEnabled: boolean;
  }) => void;
}

export default function TaskSettings({ onSettingsChange }: TaskSettingsProps) {
  const [metaFrequency, setMetaFrequency] = useState('5')
  const [metamemoryEnabled, setMetamemoryEnabled] = useState(true)

  const handleFrequencyChange = (value: string) => {
    setMetaFrequency(value)
    onSettingsChange({ metaFrequency: value, metamemoryEnabled })
  }

  const handleMemoryToggle = () => {
    const newValue = !metamemoryEnabled
    setMetamemoryEnabled(newValue)
    onSettingsChange({ metaFrequency, metamemoryEnabled: newValue })
  }

  return (
    <Card>
      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
        Settings
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Metacognition Frequency
          </label>
          <select
            value={metaFrequency}
            onChange={(e) => handleFrequencyChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--surface-glass)',
              borderRadius: '6px',
              color: 'var(--text)',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="5">Every 5 messages</option>
            <option value="10">Every 10 messages</option>
            <option value="20">Every 20 messages</option>
            <option value="40">Every 40 messages</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={metamemoryEnabled}
            onChange={handleMemoryToggle}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '14px', color: 'var(--text)' }}>
            Enable Metamemory
          </span>
        </label>
      </div>
    </Card>
  )
}