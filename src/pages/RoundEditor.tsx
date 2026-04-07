import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { Question } from '../lib/database.types'
import { triviaPrompt } from '../lib/prompts'
import { Layout } from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

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
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isEditing = Boolean(id)
  const returnTo = searchParams.get('returnTo')

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
    let questionLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.toLowerCase().startsWith('answer:')) {
        if (questionLines.length > 0) {
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
        }
        continue
      }

      const numberMatch = trimmed.match(/^(\d+)\.\s*(.*)/)
      if (numberMatch) {
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

      if (trimmed || questionLines.length > 0) {
        questionLines.push(trimmed)
      }
    }

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
              content: triviaPrompt(topic),
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

      if (markdownText.trim()) {
        setMarkdownText(markdownText + '\n\n' + generatedText)
      } else {
        setMarkdownText(generatedText)
      }

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

      if (returnTo) {
        if (isEditing) {
          navigate(returnTo)
        } else {
          const separator = returnTo.includes('?') ? '&' : '?'
          navigate(`${returnTo}${separator}addRound=${roundId}`)
        }
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save round')
    } finally {
      setSaving(false)
    }
  }

  const questionCount = editorMode === 'markdown'
    ? parseMarkdown(markdownText).length
    : questions.length

  const handleTabChange = (value: string) => {
    if (value === 'cards') switchToCards()
    else switchToMarkdown()
  }

  return (
    <Layout
      title={isEditing ? 'Edit Round' : 'Create New Round'}
      maxWidth="md"
      backTo={returnTo || '/'}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <Input
            type="text"
            placeholder="Round Title (e.g., Classic Cars)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg"
          />
          <Input
            type="text"
            placeholder="Topic (optional)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Tabs value={editorMode} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            onClick={generateWithClaude}
            disabled={generating}
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            {generating ? 'Generating...' : 'Generate with Claude'}
          </Button>
        </div>

        {editorMode === 'markdown' ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Format: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">1. Question text? A) ... B) ... Answer: B) The answer</code>
            </p>
            <Textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              placeholder={`1. What is the capital of France?\nAnswer: Paris\n\n2. Which planet is known as the Red Planet? A) Venus B) Mars C) Jupiter D) Saturn\nAnswer: B) Mars`}
              rows={20}
              className="font-mono"
            />
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{questionCount} questions detected</Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Questions ({questions.length})</h2>

            {questions.map((q, index) => (
              <Card key={index} className="py-3">
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-muted-foreground">Q{index + 1}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon-xs" onClick={() => moveQuestion(index, 'up')} disabled={index === 0}>
                        ↑
                      </Button>
                      <Button variant="outline" size="icon-xs" onClick={() => moveQuestion(index, 'down')} disabled={index === questions.length - 1}>
                        ↓
                      </Button>
                      <Button variant="outline" size="icon-xs" className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50" onClick={() => removeQuestion(index)}>
                        ×
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Question text (include multiple choice options if applicable)"
                    value={q.text}
                    onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                    rows={3}
                  />
                  <Input
                    type="text"
                    placeholder="Answer"
                    value={q.answer}
                    onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                  />
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outline"
              className="w-full border-dashed border-2 h-12 text-muted-foreground"
              onClick={addQuestion}
            >
              + Add Question
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? 'Saving...' : 'Save Round'}
          </Button>
        </div>
      </div>
    </Layout>
  )
}
