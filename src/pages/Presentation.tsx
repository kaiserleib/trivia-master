import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Question, Round } from '../lib/database.types'

interface SlideData {
  type: 'cover' | 'round-intro' | 'question'
  title?: string
  date?: string
  roundNumber?: number
  roundTitle?: string
  questionNumber?: number
  questionText?: string
  answer?: string
}

interface RoundInfo {
  number: number
  title: string
  startIndex: number
  questionCount: number
}

export function Presentation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [slides, setSlides] = useState<SlideData[]>([])
  const [rounds, setRounds] = useState<RoundInfo[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reviewingRound, setReviewingRound] = useState<number | null>(null)
  const [answerRevealed, setAnswerRevealed] = useState(false)

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

      const slideList: SlideData[] = []
      const roundList: RoundInfo[] = []

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
        const roundStartIndex = slideList.length

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

        let questionCount = 0
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
            questionCount++
          }
        }

        roundList.push({
          number: er.position,
          title: round.title,
          startIndex: roundStartIndex,
          questionCount,
        })
      }

      setSlides(slideList)
      setRounds(roundList)
      setLoading(false)
    }

    if (id) {
      loadEvent(id)
    }
  }, [id, navigate])

  const nextSlide = useCallback(() => {
    const current = slides[currentSlide]

    // In review mode on a question, reveal answer first before advancing
    if (reviewingRound !== null && current?.type === 'question' && !answerRevealed) {
      setAnswerRevealed(true)
      return
    }

    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
      setAnswerRevealed(false)
    }
  }, [currentSlide, slides, reviewingRound, answerRevealed])

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
      setAnswerRevealed(false)
    }
  }, [currentSlide])

  const goToRound = useCallback((roundNumber: number) => {
    const round = rounds.find((r) => r.number === roundNumber)
    if (round) {
      setCurrentSlide(round.startIndex)
      setReviewingRound(null)
      setAnswerRevealed(false)
    }
  }, [rounds])

  const reviewRound = useCallback((roundNumber: number) => {
    const round = rounds.find((r) => r.number === roundNumber)
    if (round) {
      // Go to first question of the round (skip the intro slide)
      setCurrentSlide(round.startIndex + 1)
      setReviewingRound(roundNumber)
      setAnswerRevealed(false)
    }
  }, [rounds])

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
  const inReviewMode = reviewingRound !== null && slide?.roundNumber === reviewingRound
  const showAnswer = inReviewMode && answerRevealed

  // Parse question text to separate question from multiple choice options
  const parseQuestionText = (text: string): { question: string; options: string[] } => {
    // Look for pattern like "A)" or "A." that indicates start of options
    const optionsMatch = text.match(/^(.*?)\s*([A-D][).]\s*.*)$/s)
    if (optionsMatch) {
      const optionsText = optionsMatch[2]
      // Split options by A) B) C) D) pattern, keeping the letter
      const options = optionsText.split(/(?=[A-D][).]\s*)/).filter(Boolean).map(o => o.trim())
      return {
        question: optionsMatch[1].trim(),
        options,
      }
    }
    return { question: text, options: [] }
  }

  const parsedQuestion = slide?.questionText ? parseQuestionText(slide.questionText) : null

  return (
    <div className="presentation" onClick={nextSlide}>
      {/* Top navigation bar */}
      <div className="presentation-nav" onClick={(e) => e.stopPropagation()}>
        <div className="round-nav">
          {rounds.map((round) => (
            <button
              key={round.number}
              onClick={() => goToRound(round.number)}
              className={slide?.roundNumber === round.number && !reviewingRound ? 'active' : ''}
            >
              Round {round.number}
            </button>
          ))}
        </div>
        <div className="slide-counter">
          {currentSlide + 1} / {slides.length}
        </div>
      </div>

      {/* Right side review buttons */}
      <div className="review-nav" onClick={(e) => e.stopPropagation()}>
        {rounds.map((round) => (
          <button
            key={round.number}
            onClick={() => reviewRound(round.number)}
            className={reviewingRound === round.number ? 'active' : ''}
          >
            Review {round.number}
          </button>
        ))}
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

      {slide?.type === 'question' && parsedQuestion && (
        <div className="slide slide-question">
          <p className="question-label">
            Round {slide.roundNumber} · Question {slide.questionNumber}
            {inReviewMode && ' · Review'}
          </p>
          <div className="question-text">{parsedQuestion.question}</div>
          {parsedQuestion.options.length > 0 && (
            <div className="question-options">
              {parsedQuestion.options.map((option, i) => (
                <div key={i} className="option">{option}</div>
              ))}
            </div>
          )}
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
