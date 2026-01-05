import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Question } from '../lib/database.types'

interface QuestionDraft {
  id?: string
  text: string
  answer: string
  isNew?: boolean
}

type EditorMode = 'cards' | 'markdown'

export function RoundEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([])
  const [markdownText, setMarkdownText] = useState('')
  const [editorMode, setEditorMode] = useState<EditorMode>('markdown')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const questionsToMarkdown = (qs: QuestionDraft[]): string => {
    return qs
      .map((q, i) => `${i + 1}. ${q.text}\nAnswer: ${q.answer}`)
      .join('\n\n')
  }

  useEffect(() => {
    const loadRound = async (roundId: string) => {
      const { data: round } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', roundId)
        .single()

      if (round) {
        setTitle(round.title)
        setTopic(round.topic || '')

        const { data: roundQuestions } = await supabase
          .from('round_questions')
          .select('position, questions(*)')
          .eq('round_id', roundId)
          .order('position')

        if (roundQuestions) {
          const loadedQuestions = roundQuestions.map((rq) => {
            const q = rq.questions as unknown as Question
            return {
              id: q.id,
              text: q.text,
              answer: q.answer,
            }
          })
          setQuestions(loadedQuestions)
          setMarkdownText(questionsToMarkdown(loadedQuestions))
        }
      }
    }

    if (id) {
      loadRound(id)
    }
  }, [id])

  const parseMarkdown = (text: string): QuestionDraft[] => {
    const lines = text.split('\n')
    const parsed: QuestionDraft[] = []
    let currentQuestion: { text: string; answer: string } | null = null
    let questionLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // Check if this is an answer line
      if (trimmed.toLowerCase().startsWith('answer:')) {
        if (currentQuestion || questionLines.length > 0) {
          const answer = trimmed.substring(7).trim()
          const questionText = questionLines.join('\n').trim()
          if (questionText) {
            parsed.push({
              text: questionText,
              answer: answer,
              isNew: true,
            })
          }
          questionLines = []
          currentQuestion = null
        }
        continue
      }

      // Check if this starts a new numbered question
      const numberMatch = trimmed.match(/^(\d+)\.\s*(.*)/)
      if (numberMatch) {
        // Save previous question if exists without answer
        if (questionLines.length > 0) {
          const questionText = questionLines.join('\n').trim()
          if (questionText) {
            parsed.push({
              text: questionText,
              answer: '',
              isNew: true,
            })
          }
        }
        questionLines = [numberMatch[2]]
        continue
      }

      // Continue current question
      if (trimmed || questionLines.length > 0) {
        questionLines.push(trimmed)
      }
    }

    // Handle last question if no answer
    if (questionLines.length > 0) {
      const questionText = questionLines.join('\n').trim()
      if (questionText) {
        parsed.push({
          text: questionText,
          answer: '',
          isNew: true,
        })
      }
    }

    return parsed
  }

  const generateWithClaude = async () => {
    if (!topic.trim()) {
      setError('Enter a topic first to generate questions')
      return
    }

    setGenerating(true)
    setError('')

    try {
      // Get user's API key
      const { data: settings } = await supabase
        .from('user_settings')
        .select('claude_api_key')
        .eq('user_id', user?.id)
        .single()

      if (!settings?.claude_api_key) {
        setError('Add your Claude API key in Settings first')
        setGenerating(false)
        return
      }

      const prompt = `Generate 10 trivia questions about "${topic}".

Format each question exactly like this:
- Alternate between short-answer questions and multiple-choice questions
- For short-answer: just the question followed by Answer: on the next line
- For multiple-choice: question followed by A) B) C) D) options, then Answer: with the letter and answer

Example format:
1. What is the capital of France?
Answer: Paris

2. Which planet is known as the Red Planet? A) Venus B) Mars C) Jupiter D) Saturn
Answer: B) Mars

Now generate 10 trivia questions about "${topic}":`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.claude_api_key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'API request failed')
      }

      const data = await response.json()
      const generatedText = data.content[0]?.text || ''

      // Append to existing markdown or set new
      if (markdownText.trim()) {
        setMarkdownText(markdownText + '\n\n' + generatedText)
      } else {
        setMarkdownText(generatedText)
      }

      // Auto-set title if empty
      if (!title.trim()) {
        setTitle(topic)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setGenerating(false)
    }
  }

  const switchToCards = () => {
    const parsed = parseMarkdown(markdownText)
    setQuestions(parsed)
    setEditorMode('cards')
  }

  const switchToMarkdown = () => {
    setMarkdownText(questionsToMarkdown(questions))
    setEditorMode('markdown')
  }

  const addQuestion = () => {
    setQuestions([...questions, { text: '', answer: '', isNew: true }])
  }

  const updateQuestion = (index: number, field: 'text' | 'answer', value: string) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...questions]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setQuestions(updated)
  }

  const handleSave = async () => {
    // Parse markdown if in markdown mode
    let questionsToSave = questions
    if (editorMode === 'markdown') {
      questionsToSave = parseMarkdown(markdownText)
    }

    if (!title.trim()) {
      setError('Round title is required')
      return
    }

    if (questionsToSave.length === 0) {
      setError('Add at least one question')
      return
    }

    for (const q of questionsToSave) {
      if (!q.text.trim() || !q.answer.trim()) {
        setError('All questions must have text and an answer')
        return
      }
    }

    setSaving(true)
    setError('')

    try {
      let roundId = id

      if (isEditing) {
        await supabase
          .from('rounds')
          .update({ title, topic: topic || null })
          .eq('id', id)

        // Delete existing round_questions
        await supabase.from('round_questions').delete().eq('round_id', id)
      } else {
        const { data: newRound, error: roundError } = await supabase
          .from('rounds')
          .insert({ title, topic: topic || null, author_id: user?.id })
          .select()
          .single()

        if (roundError) throw roundError
        roundId = newRound.id
      }

      // Create/update questions and link to round
      for (let i = 0; i < questionsToSave.length; i++) {
        const q = questionsToSave[i]
        let questionId = q.id

        if (q.isNew || !q.id) {
          const { data: newQuestion, error: qError } = await supabase
            .from('questions')
            .insert({
              text: q.text,
              answer: q.answer,
              topic: topic || null,
              author_id: user?.id,
            })
            .select()
            .single()

          if (qError) throw qError
          questionId = newQuestion.id
        } else {
          await supabase
            .from('questions')
            .update({ text: q.text, answer: q.answer })
            .eq('id', q.id)
        }

        await supabase.from('round_questions').insert({
          round_id: roundId,
          question_id: questionId,
          position: i + 1,
        })
      }

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save round')
    } finally {
      setSaving(false)
    }
  }

  const questionCount = editorMode === 'markdown'
    ? parseMarkdown(markdownText).length
    : questions.length

  return (
    <div className="round-editor">
      <header>
        <h1>{isEditing ? 'Edit Round' : 'Create New Round'}</h1>
        <button onClick={() => navigate('/')} className="back-btn">
          Back
        </button>
      </header>

      <div className="round-meta">
        <input
          type="text"
          placeholder="Round Title (e.g., Classic Cars)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="title-input"
        />
        <input
          type="text"
          placeholder="Topic (optional)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="topic-input"
        />
      </div>

      <div className="editor-controls">
        <div className="editor-mode-toggle">
          <button
            className={editorMode === 'markdown' ? 'active' : ''}
            onClick={switchToMarkdown}
          >
            Markdown
          </button>
          <button
            className={editorMode === 'cards' ? 'active' : ''}
            onClick={switchToCards}
          >
            Cards
          </button>
        </div>

        <button
          onClick={generateWithClaude}
          disabled={generating}
          className="generate-btn"
        >
          {generating ? 'Generating...' : 'Generate with Claude'}
        </button>
      </div>

      {editorMode === 'markdown' ? (
        <div className="markdown-editor">
          <div className="markdown-help">
            Format: <code>1. Question text? A) ... B) ... Answer: B) The answer</code>
          </div>
          <textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            placeholder={`1. What is the capital of France?
Answer: Paris

2. Which planet is known as the Red Planet? A) Venus B) Mars C) Jupiter D) Saturn
Answer: B) Mars`}
            rows={20}
          />
          <div className="question-count">{questionCount} questions detected</div>
        </div>
      ) : (
        <div className="questions-list">
          <h2>Questions ({questions.length})</h2>

          {questions.map((q, index) => (
            <div key={index} className="question-card">
              <div className="question-header">
                <span className="question-number">Q{index + 1}</span>
                <div className="question-actions">
                  <button onClick={() => moveQuestion(index, 'up')} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                  >
                    ↓
                  </button>
                  <button onClick={() => removeQuestion(index)} className="remove-btn">
                    ×
                  </button>
                </div>
              </div>
              <textarea
                placeholder="Question text (include multiple choice options if applicable)"
                value={q.text}
                onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                rows={3}
              />
              <input
                type="text"
                placeholder="Answer"
                value={q.answer}
                onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
              />
            </div>
          ))}

          <button onClick={addQuestion} className="add-question-btn">
            + Add Question
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="save-actions">
        <button onClick={handleSave} disabled={saving} className="save-btn">
          {saving ? 'Saving...' : 'Save Round'}
        </button>
      </div>
    </div>
  )
}
