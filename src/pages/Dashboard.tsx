import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/database.types'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })
        .limit(10)

      if (data) {
        setEvents(data)
      }
      setLoading(false)
    }
    loadEvents()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const formatDate = (dateStr: string) => {
    // Add T12:00:00 to avoid timezone shifts (YYYY-MM-DD is parsed as UTC midnight)
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Trivia Master</h1>
        <div className="user-info">
          <span>{user?.email}</span>
          <button onClick={() => navigate('/settings')}>Settings</button>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      <main>
        <section className="actions">
          <h2>What would you like to do?</h2>
          <div className="action-buttons">
            <button onClick={() => navigate('/events/new')}>
              Create New Trivia Night
            </button>
            <button onClick={() => navigate('/rounds/new')}>
              Create New Round
            </button>
          </div>
        </section>

        <section className="recent">
          <h2>Recent Events</h2>
          {loading ? (
            <p>Loading...</p>
          ) : events.length === 0 ? (
            <p>No events yet. Create your first trivia night!</p>
          ) : (
            <div className="events-list">
              {events.map((event) => (
                <div key={event.id} className="event-card">
                  <div className="event-info">
                    <span className="event-title">{event.title}</span>
                    <span className="event-date">{formatDate(event.date)}</span>
                    <span className={`event-status status-${event.status}`}>
                      {event.status}
                    </span>
                  </div>
                  <div className="event-actions">
                    <button onClick={() => navigate(`/events/${event.id}/edit`)}>
                      Edit
                    </button>
                    <button onClick={() => navigate(`/events/${event.id}/print`)}>
                      Print
                    </button>
                    <button
                      onClick={() => navigate(`/events/${event.id}/present`)}
                      className="present-btn"
                    >
                      Present
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
