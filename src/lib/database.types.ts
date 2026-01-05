export interface Question {
  id: string
  created_at: string
  author_id: string | null
  text: string
  answer: string
  topic: string | null
}

export interface Round {
  id: string
  created_at: string
  author_id: string | null
  title: string
  topic: string | null
}

export interface RoundQuestion {
  id: string
  round_id: string
  question_id: string
  position: number
}

export interface Event {
  id: string
  created_at: string
  author_id: string | null
  title: string
  date: string
  status: 'draft' | 'active' | 'completed'
}

export interface EventRound {
  id: string
  event_id: string
  round_id: string
  position: number
}

export interface UserSettings {
  id: string
  user_id: string
  claude_api_key: string | null
  created_at: string
  updated_at: string
}

// Extended types with relations
export interface RoundWithQuestions extends Round {
  questions: Question[]
}

export interface EventWithRounds extends Event {
  rounds: RoundWithQuestions[]
}
