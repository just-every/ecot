import { useState } from 'react'
import { Card } from '@just-every/demo-ui'

interface TaskSettingsProps {
  onSettingsChange: (settings: {
    metaFrequency: string;
    metamemoryEnabled: boolean;
  }) => void;
}

export default function TaskSettings({ onSettingsChange }: TaskSettingsProps) {
  const [metaFrequency, setMetaFrequency] = useState<string>('5')
  const [metamemoryEnabled, setMetamemoryEnabled] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleMetaFrequencyChange = (value: string) => {
    setMetaFrequency(value)
    onSettingsChange({ metaFrequency: value, metamemoryEnabled })
  }

  const handleMetamemoryToggle = () => {
    const newValue = !metamemoryEnabled
    setMetamemoryEnabled(newValue)
    onSettingsChange({ metaFrequency, metamemoryEnabled: newValue })
  }

  return (
    <Card>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: isExpanded ? '16px' : 0
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          ⚙️ Task Settings
        </h3>
        <span style={{ 
          fontSize: '14px', 
          color: 'var(--text-secondary)',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metacognition Frequency */}
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500',
              marginBottom: '8px',
              color: 'var(--text)'
            }}>
              Metacognition Frequency
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)',
                marginLeft: '8px'
              }}>
                (every N requests)
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['1', '5', '10', '20', '40'].map(value => (
                <button
                  key={value}
                  onClick={() => handleMetaFrequencyChange(value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: metaFrequency === value 
                      ? 'var(--accent-primary)' 
                      : 'var(--surface-glass)',
                    color: metaFrequency === value 
                      ? 'white' 
                      : 'var(--text)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: metaFrequency === value ? '600' : '400',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--text-secondary)', 
              marginTop: '8px',
              margin: '8px 0 0 0' 
            }}>
              {metaFrequency === '1' && '🚀 Triggers on every request (demo mode)'}
              {metaFrequency === '5' && '⚡ Default setting - good for most tasks'}
              {metaFrequency === '10' && '⚖️ Balanced - less frequent checks'}
              {metaFrequency === '20' && '🐢 Conservative - for longer tasks'}
              {metaFrequency === '40' && '🌙 Minimal - rarely triggers'}
            </p>
          </div>

          {/* Metamemory Toggle */}
          <div>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={metamemoryEnabled}
                onChange={handleMetamemoryToggle}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />
              <div>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '500',
                  color: 'var(--text)'
                }}>
                  Enable Metamemory
                </span>
                <p style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)', 
                  margin: '4px 0 0 0' 
                }}>
                  Tracks conversation threads and tags messages
                </p>
              </div>
            </label>
          </div>
        </div>
      )}
    </Card>
  )
}