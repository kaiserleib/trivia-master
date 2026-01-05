import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Question, Round } from '../lib/database.types'

interface SlideData {
  type: 'cover' | 'round-intro' | 'question' | 'answer'
  title?: string
  date?: string
  roundNumber?: number
  roundTitle?: string
  questionNumber?: number
  questionText?: string
  answer?: string
}

export function Presentation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [slides, setSlides] = useState<SlideData[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAnswer, setShowAnswer] = useState(false)

  useEffect(() => {
    if (id) {
      loadEvent(id)
    }
  }, [id])

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

    const slideList: SlideData[] = []

    // Cover slide
    slideList.push({
      type: 'cover',
      title: event.title,
      date: new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    })

    // Load each round's questions
    for (const er of eventRounds) {
      const round = er.rounds as unknown as Round

      // Round intro slide
      slideList.push({
        type: 'round-intro',
        roundNumber: er.position,
        roundTitle: round.title,
      })

      // Get questions for this round
      const { data: roundQuestions } = await supabase
        .from('round_questions')
        .select('position, questions(*)')
        .eq('round_id', round.id)
        .order('position')

      if (roundQuestions) {
        for (const rq of roundQuestions) {
          const question = rq.questions as unknown as Question

          // Question slide
          slideList.push({
            type: 'question',
            roundNumber: er.position,
            questionNumber: rq.position,
            questionText: question.text,
            answer: question.answer,
          })
        }
      }
    }

    setSlides(slideList)
    setLoading(false)
  }

  const nextSlide = useCallback(() => {
    const current = slides[currentSlide]

    // If we're on a question and answer isn't shown, show answer first
    if (current?.type === 'question' && !showAnswer) {
      setShowAnswer(true)
      return
    }

    // Move to next slide
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
      setShowAnswer(false)
    }
  }, [currentSlide, slides, showAnswer])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
      setShowAnswer(false)
    }
  }, [currentSlide])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        nextSlide()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      } else if (e.key === 'Escape') {
        navigate('/')
      }
    },
    [nextSlide, prevSlide, navigate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const exitPresentation = () => {
    navigate('/')
  }

  if (loading) {
    return <div className="presentation loading">Loading...</div>
  }

  const slide = slides[currentSlide]

  return (
    <div className="presentation" onClick={nextSlide}>
      <div className="slide-counter">
        {currentSlide + 1} / {slides.length}
      </div>

      <button className="exit-btn" onClick={(e) => { e.stopPropagation(); exitPresentation(); }}>
        ×
      </button>

      {slide?.type === 'cover' && (
        <div className="slide slide-cover">
          <h1>{slide.title}</h1>
          <p className="date">{slide.date}</p>
        </div>
      )}

      {slide?.type === 'round-intro' && (
        <div className="slide slide-round-intro">
          <p className="round-label">Round {slide.roundNumber}</p>
          <h1>{slide.roundTitle}</h1>
        </div>
      )}

      {slide?.type === 'question' && (
        <div className="slide slide-question">
          <p className="question-label">
            Round {slide.roundNumber} · Question {slide.questionNumber}
          </p>
          <div className="question-text">{slide.questionText}</div>
          {showAnswer && (
            <div className="answer">
              <span className="answer-label">Answer:</span> {slide.answer}
            </div>
          )}
        </div>
      )}

      <div className="nav-hint">
        Press → or click to advance · Press ← to go back · Press Esc to exit
      </div>
    </div>
  )
}
