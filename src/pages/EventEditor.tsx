import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Round } from '../lib/database.types'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

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
  const [saved, setSaved] = useState(false)

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
    const init = async () => {
      const rounds = await loadAvailableRounds()
      let currentRounds: RoundSelection[] = []

      if (id) {
        currentRounds = await loadEvent(id)
      }

      const addRoundId = searchParams.get('addRound')
      if (addRoundId && id && rounds) {
        const roundToAdd = rounds.find((r) => r.id === addRoundId)
        if (roundToAdd && !currentRounds.find((r) => r.id === addRoundId)) {
          const newRounds = [...currentRounds, roundToAdd]
          setSelectedRounds(newRounds)
          await persistRoundToEvent(addRoundId, newRounds.length)
        }
        searchParams.delete('addRound')
        setSearchParams(searchParams, { replace: true })
      }
    }
    init()
  }, [id])

  const handleCreateNewRound = async () => {
    let eventId = id

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

    navigate(`/rounds/new?returnTo=${encodeURIComponent(`/events/${eventId}/edit`)}`)
  }

  const loadAvailableRounds = async (): Promise<RoundSelection[] | null> => {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, title, topic')
      .order('created_at', { ascending: false })

    if (rounds) {
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
      return roundsWithCounts
    }
    return null
  }

  const loadEvent = async (eventId: string): Promise<RoundSelection[]> => {
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
        return rounds
      }
    }
    return []
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

      for (let i = 0; i < selectedRounds.length; i++) {
        await supabase.from('event_rounds').insert({
          event_id: eventId,
          round_id: selectedRounds[i].id,
          position: i + 1,
        })
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)

      if (!id && eventId) {
        navigate(`/events/${eventId}/edit`, { replace: true })
      }
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
    <Layout
      title={isEditing ? 'Edit Trivia Night' : 'Create New Trivia Night'}
      maxWidth="md"
      backTo="/"
    >
      <div className="space-y-6">
        <div className="flex gap-3">
          <Input
            type="text"
            placeholder="Event Title (e.g., Tuesday Trivia)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 text-lg"
          />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Rounds ({selectedRounds.length})</h2>

          {selectedRounds.map((round, index) => (
            <Card key={round.id} className="py-3">
              <CardContent className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-muted-foreground">Round {index + 1}</span>
                  <span className="font-medium">{round.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {round.questionCount} questions
                    {round.topic && ` · ${round.topic}`}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon-xs" onClick={() => moveRound(index, 'up')} disabled={index === 0}>
                    ↑
                  </Button>
                  <Button variant="outline" size="icon-xs" onClick={() => moveRound(index, 'down')} disabled={index === selectedRounds.length - 1}>
                    ↓
                  </Button>
                  <Button variant="outline" size="icon-xs" className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50" onClick={() => removeRound(index)}>
                    ×
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            className="w-full border-dashed border-2 h-12 text-muted-foreground"
            onClick={() => setShowRoundPicker(true)}
          >
            + Add Round from Library
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-muted-foreground"
            onClick={handleCreateNewRound}
          >
            + Create New Round
          </Button>
        </div>

        <Dialog open={showRoundPicker} onOpenChange={setShowRoundPicker}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select a Round</DialogTitle>
            </DialogHeader>
            {unselectedRounds.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No more rounds available</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {unselectedRounds.map((round) => (
                  <button
                    key={round.id}
                    onClick={() => addRound(round)}
                    className="w-full flex flex-col items-start gap-1 p-3 rounded-md border hover:border-primary hover:bg-accent text-left transition-colors"
                  >
                    <span className="font-medium">{round.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {round.questionCount} questions
                      {round.topic && ` · ${round.topic}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert>
            <AlertDescription className="text-green-600">Saved!</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Trivia Night'}
          </Button>
        </div>
      </div>
    </Layout>
  )
}
