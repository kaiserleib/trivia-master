import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/database.types'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })

      if (data) {
        setEvents(data)
      }
      setLoading(false)
    }
    loadEvents()
  }, [])

  const filteredEvents = events.filter((event) =>
    event.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (event: Event) => {
    if (!window.confirm(`Delete "${event.title}"? This will also remove its round associations.`)) {
      return
    }

    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) {
      alert('Failed to delete event: ' + error.message)
      return
    }
    setEvents((prev) => prev.filter((e) => e.id !== event.id))
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Layout
      title="Quiztoad"
      maxWidth="xl"
      headerActions={
        <>
          <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="outline" onClick={() => navigate('/settings')}>Settings</Button>
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </>
      }
    >
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">What would you like to do?</h2>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => navigate('/events/new')}>
            Create New Trivia Night
          </Button>
          <Button variant="secondary" onClick={() => navigate('/rounds/new')}>
            Create New Round
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Events</h2>
          {events.length > 0 && (
            <Badge variant="secondary">{events.length}</Badge>
          )}
        </div>
        <Input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground">No events yet. Create your first trivia night!</p>
        ) : filteredEvents.length === 0 ? (
          <p className="text-muted-foreground">No events match "{search}"</p>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <Card key={event.id} className="py-3">
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{event.title}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(event.date)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/events/${event.id}/edit`)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/events/${event.id}/print`)}>
                      Print
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/events/${event.id}/present`)}>
                      Present
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(event)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Layout>
  )
}
