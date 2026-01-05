import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Round } from '../lib/database.types'

interface RoundSelection {
  id: string
  title: string
  topic: string | null
  questionCount: number
}

export function EventEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedRounds, setSelectedRounds] = useState<RoundSelection[]>([])
  const [availableRounds, setAvailableRounds] = useState<RoundSelection[]>([])
  const [showRoundPicker, setShowRoundPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const persistRoundToEvent = useCallback(
    async (roundId: string, position: number) => {
      if (!id) return
      await supabase.from('event_rounds').insert({
        event_id: id,
        round_id: roundId,
        position,
      })
    },
    [id]
  )

  useEffect(() => {
    loadAvailableRounds()
    if (id) {
      loadEvent(id)
    }
  }, [id])

  // Handle newly created round from RoundEditor - add to UI and persist to DB
  useEffect(() => {
    const addRoundId = searchParams.get('addRound')
    if (addRoundId && availableRounds.length > 0 && id) {
      const roundToAdd = availableRounds.find((r) => r.id === addRoundId)
      if (roundToAdd && !selectedRounds.find((r) => r.id === addRoundId)) {
        // Add to UI
        setSelectedRounds((prev) => {
          const newRounds = [...prev, roundToAdd]
          // Persist to database
          persistRoundToEvent(addRoundId, newRounds.length)
          return newRounds
        })
      }
      // Clear the param
      searchParams.delete('addRound')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, availableRounds, selectedRounds, setSearchParams, id, persistRoundToEvent])

  const handleCreateNewRound = async () => {
    let eventId = id

    // If this is a new event, save it first
    if (!eventId) {
      const eventTitle = title.trim() || 'Untitled Trivia Night'
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({ title: eventTitle, date, author_id: user?.id })
        .select()
        .single()

      if (eventError) {
        setError('Failed to save event: ' + eventError.message)
        return
      }
      eventId = newEvent.id
    }

    // Navigate to round editor with return path to this event
    navigate(`/rounds/new?returnTo=${encodeURIComponent(`/events/${eventId}/edit`)}`)
  }

  const loadAvailableRounds = async () => {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, title, topic')
      .order('created_at', { ascending: false })

    if (rounds) {
      // Get question counts for each round
      const roundsWithCounts = await Promise.all(
        rounds.map(async (round) => {
          const { count } = await supabase
            .from('round_questions')
            .select('*', { count: 'exact', head: true })
            .eq('round_id', round.id)

          return {
            ...round,
            questionCount: count || 0,
          }
        })
      )
      setAvailableRounds(roundsWithCounts)
    }
  }

  const loadEvent = async (eventId: string) => {
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (event) {
      setTitle(event.title)
      setDate(event.date)

      const { data: eventRounds } = await supabase
        .from('event_rounds')
        .select('position, rounds(id, title, topic)')
        .eq('event_id', eventId)
        .order('position')

      if (eventRounds) {
        const rounds = await Promise.all(
          eventRounds.map(async (er) => {
            const round = er.rounds as unknown as Round
            const { count } = await supabase
              .from('round_questions')
              .select('*', { count: 'exact', head: true })
              .eq('round_id', round.id)

            return {
              id: round.id,
              title: round.title,
              topic: round.topic,
              questionCount: count || 0,
            }
          })
        )
        setSelectedRounds(rounds)
      }
    }
  }

  const addRound = (round: RoundSelection) => {
    if (!selectedRounds.find((r) => r.id === round.id)) {
      setSelectedRounds([...selectedRounds, round])
    }
    setShowRoundPicker(false)
  }

  const removeRound = (index: number) => {
    setSelectedRounds(selectedRounds.filter((_, i) => i !== index))
  }

  const moveRound = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === selectedRounds.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...selectedRounds]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setSelectedRounds(updated)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Event title is required')
      return
    }

    if (selectedRounds.length === 0) {
      setError('Add at least one round')
      return
    }

    setSaving(true)
    setError('')

    try {
      let eventId = id

      if (isEditing) {
        await supabase
          .from('events')
          .update({ title, date })
          .eq('id', id)

        await supabase.from('event_rounds').delete().eq('event_id', id)
      } else {
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert({ title, date, author_id: user?.id })
          .select()
          .single()

        if (eventError) throw eventError
        eventId = newEvent.id
      }

      // Add rounds to event
      for (let i = 0; i < selectedRounds.length; i++) {
        await supabase.from('event_rounds').insert({
          event_id: eventId,
          round_id: selectedRounds[i].id,
          position: i + 1,
        })
      }

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const unselectedRounds = availableRounds.filter(
    (r) => !selectedRounds.find((s) => s.id === r.id)
  )

  return (
    <div className="event-editor">
      <header>
        <h1>{isEditing ? 'Edit Trivia Night' : 'Create New Trivia Night'}</h1>
        <button onClick={() => navigate('/')} className="back-btn">
          Back
        </button>
      </header>

      <div className="event-meta">
        <input
          type="text"
          placeholder="Event Title (e.g., Tuesday Trivia)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="title-input"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="date-input"
        />
      </div>

      <div className="rounds-list">
        <h2>Rounds ({selectedRounds.length})</h2>

        {selectedRounds.map((round, index) => (
          <div key={round.id} className="round-card">
            <div className="round-info">
              <span className="round-number">Round {index + 1}</span>
              <span className="round-title">{round.title}</span>
              <span className="round-meta-info">
                {round.questionCount} questions
                {round.topic && ` · ${round.topic}`}
              </span>
            </div>
            <div className="round-actions">
              <button onClick={() => moveRound(index, 'up')} disabled={index === 0}>
                ↑
              </button>
              <button
                onClick={() => moveRound(index, 'down')}
                disabled={index === selectedRounds.length - 1}
              >
                ↓
              </button>
              <button onClick={() => removeRound(index)} className="remove-btn">
                ×
              </button>
            </div>
          </div>
        ))}

        <button onClick={() => setShowRoundPicker(true)} className="add-round-btn">
          + Add Round from Library
        </button>

        <button onClick={handleCreateNewRound} className="create-round-btn">
          + Create New Round
        </button>
      </div>

      {showRoundPicker && (
        <div className="modal-overlay" onClick={() => setShowRoundPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Select a Round</h3>
            {unselectedRounds.length === 0 ? (
              <p className="no-rounds">No more rounds available</p>
            ) : (
              <div className="round-picker-list">
                {unselectedRounds.map((round) => (
                  <button
                    key={round.id}
                    onClick={() => addRound(round)}
                    className="round-picker-item"
                  >
                    <span className="round-title">{round.title}</span>
                    <span className="round-meta-info">
                      {round.questionCount} questions
                      {round.topic && ` · ${round.topic}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowRoundPicker(false)} className="close-btn">
              Close
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="save-actions">
        <button onClick={handleSave} disabled={saving} className="save-btn">
          {saving ? 'Saving...' : 'Save Trivia Night'}
        </button>
      </div>
    </div>
  )
}
