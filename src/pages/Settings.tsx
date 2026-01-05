import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export function Settings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return

      const { data } = await supabase
        .from('user_settings')
        .select('claude_api_key')
        .eq('user_id', user.id)
        .single()

      if (data?.claude_api_key) {
        // Show masked key
        setApiKey('sk-ant-••••••••' + data.claude_api_key.slice(-4))
      }
      setLoading(false)
    }

    loadSettings()
  }, [user])

  const handleSave = async () => {
    if (!user) return

    // Don't save if it's the masked version
    if (apiKey.includes('••••')) {
      setMessage('Enter a new API key to update')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        claude_api_key: apiKey,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      setMessage('Failed to save: ' + error.message)
    } else {
      setMessage('API key saved!')
      setApiKey('sk-ant-••••••••' + apiKey.slice(-4))
    }

    setSaving(false)
  }

  const handleClear = async () => {
    if (!user) return

    setSaving(true)

    await supabase
      .from('user_settings')
      .update({ claude_api_key: null })
      .eq('user_id', user.id)

    setApiKey('')
    setMessage('API key cleared')
    setSaving(false)
  }

  if (loading) {
    return <div className="settings"><p>Loading...</p></div>
  }

  return (
    <div className="settings">
      <header>
        <h1>Settings</h1>
        <button onClick={() => navigate('/')} className="back-btn">
          Back
        </button>
      </header>

      <section className="settings-section">
        <h2>Claude API Key</h2>
        <p className="settings-description">
          Enter your Claude API key to enable AI-generated trivia questions.
          Get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>
        </p>

        <div className="api-key-input">
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {apiKey && (
            <button onClick={handleClear} disabled={saving} className="clear-btn">
              Clear
            </button>
          )}
        </div>

        {message && <p className="settings-message">{message}</p>}
      </section>
    </div>
  )
}
