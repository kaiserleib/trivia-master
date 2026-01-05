import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Question, Round } from '../lib/database.types'

interface RoundWithQuestions {
  number: number
  title: string
  questions: {
    number: number
    text: string
    answer: string
  }[]
}

export function PrintView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<RoundWithQuestions[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadEvent = async (eventId: string) => {
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (!event) {
        navigate('/')
        return
      }

      const { data: eventRounds } = await supabase
        .from('event_rounds')
        .select('position, rounds(id, title, topic)')
        .eq('event_id', eventId)
        .order('position')

      if (!eventRounds) {
        navigate('/')
        return
      }

      const loadedRounds: RoundWithQuestions[] = []

      for (const er of eventRounds) {
        const round = er.rounds as unknown as Round

        const { data: roundQuestions } = await supabase
          .from('round_questions')
          .select('position, questions(*)')
          .eq('round_id', round.id)
          .order('position')

        const questions =
          roundQuestions?.map((rq) => {
            const q = rq.questions as unknown as Question
            return {
              number: rq.position,
              text: q.text,
              answer: q.answer,
            }
          }) || []

        loadedRounds.push({
          number: er.position,
          title: round.title,
          questions,
        })
      }

      setRounds(loadedRounds)
      setLoading(false)
    }

    if (id) {
      loadEvent(id)
    }
  }, [id, navigate])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return <div className="print-view loading">Loading...</div>
  }

  return (
    <div className="print-view">
      <div className="print-controls no-print">
        <button onClick={() => navigate('/')} className="back-btn">
          Back
        </button>
        <button onClick={handlePrint} className="print-btn">
          Print
        </button>
      </div>

      {rounds.map((round) => (
        <div key={round.number} className="print-round">
          <div className="round-header">
            <h1>Round {round.number}: {round.title}</h1>
          </div>

          <ol className="questions-list">
            {round.questions.map((q) => (
              <li key={q.number} className="question-item">
                <div className="question-text">{q.text}</div>
                <div className="answer">Answer: {q.answer}</div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
