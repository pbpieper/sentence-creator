import { useState, useEffect, useCallback, useMemo, type CSSProperties, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Types ───────────────────────────────────────────────────── */

type Language = 'Spanish' | 'French' | 'German' | 'Arabic' | 'Italian' | 'Portuguese' | 'English' | 'Japanese' | 'Korean'
type Difficulty = 'beginner' | 'intermediate' | 'advanced'
type ExerciseType = 'sentences' | 'fill-blank' | 'multiple-choice' | 'story'

interface VocabEntry {
  word: string
  translation: string
}

interface SentenceItem {
  type: 'sentences'
  word: string
  translation: string
  sentence: string
}

interface FillBlankItem {
  type: 'fill-blank'
  word: string
  translation: string
  sentence: string
  blanked: string
}

interface MultipleChoiceItem {
  type: 'multiple-choice'
  word: string
  translation: string
  options: string[]
  correctIndex: number
}

interface StoryItem {
  type: 'story'
  text: string
  words: string[]
}

type ExerciseItem = SentenceItem | FillBlankItem | MultipleChoiceItem | StoryItem

interface ExerciseData {
  title: string
  language: Language
  difficulty: Difficulty
  exerciseType: ExerciseType
  items: ExerciseItem[]
  createdAt: string
  teacherName: string
}

interface SavedExercise {
  id: string
  data: ExerciseData
  shareUrl: string
}

/* ─── RTL Languages ───────────────────────────────────────────── */

const RTL_LANGUAGES: Language[] = ['Arabic']

/* ─── Sentence Templates ──────────────────────────────────────── */

const TEMPLATES: Record<Difficulty, string[]> = {
  beginner: [
    'I have a {word}.',
    'This is a {word}.',
    'I like the {word}.',
    'The {word} is here.',
    'I see a {word}.',
    'That is my {word}.',
    'We need a {word}.',
    'She has a {word}.',
    'The {word} is good.',
    'I want a {word}.',
    'He found a {word}.',
    'It is a nice {word}.',
    'Look at the {word}.',
    'Where is the {word}?',
    'Do you have a {word}?',
  ],
  intermediate: [
    'Yesterday, I noticed a {word} at the market.',
    'The {word} was surprisingly interesting to learn about.',
    'My teacher explained the meaning of {word} in class.',
    'We discussed the {word} during our conversation.',
    'I read about a {word} in the newspaper today.',
    'The children were fascinated by the {word}.',
    'She described the {word} in great detail.',
    'They discovered a beautiful {word} on their trip.',
    'The {word} played an important role in the story.',
    'Have you ever encountered a {word} before?',
    'I would like to learn more about the {word}.',
    'The {word} reminded me of something from my childhood.',
    'Everyone was talking about the {word} at the event.',
  ],
  advanced: [
    'Despite initial skepticism, the {word} proved to be remarkably significant.',
    'The concept of {word} has evolved considerably throughout history.',
    'Researchers have recently uncovered new aspects of the {word}.',
    'The relationship between the {word} and its context is worth examining.',
    'One cannot underestimate the influence of {word} on modern society.',
    'The {word} represents a fundamental shift in our understanding.',
    'Philosophers have long debated the nature of {word}.',
    'The implications of {word} extend far beyond its immediate context.',
    'A nuanced understanding of {word} requires careful analysis.',
    'The {word} has become an indispensable part of the discourse.',
    'Examining the {word} reveals unexpected layers of complexity.',
    'The interplay between {word} and culture is fascinating.',
  ],
}

const STORY_CONNECTORS = [
  'One day, ',
  'After that, ',
  'Later, ',
  'Meanwhile, ',
  'Then, ',
  'Suddenly, ',
  'Finally, ',
  'As a result, ',
  'In the end, ',
  'Not long after, ',
]

const STORY_TEMPLATES: Record<Difficulty, string[]> = {
  beginner: [
    '{connector}I found a {word}.',
    '{connector}there was a {word} nearby.',
    '{connector}I saw the {word} again.',
    '{connector}the {word} was very nice.',
  ],
  intermediate: [
    '{connector}I came across a remarkable {word} that caught my attention.',
    '{connector}the {word} turned out to be more interesting than expected.',
    '{connector}everyone was talking about the {word} they had discovered.',
    '{connector}the {word} became the center of the conversation.',
  ],
  advanced: [
    '{connector}the significance of the {word} became increasingly apparent.',
    '{connector}the {word} revealed itself to be an essential element of the narrative.',
    '{connector}a deeper understanding of the {word} emerged from the discussion.',
    '{connector}the {word} transformed our perspective on the matter entirely.',
  ],
}

/* ─── Generation Logic ────────────────────────────────────────── */

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickTemplate(templates: string[], index: number): string {
  return templates[index % templates.length]
}

function generateSentence(word: string, difficulty: Difficulty, index: number): string {
  const tmpl = pickTemplate(TEMPLATES[difficulty], index)
  return tmpl.replace('{word}', word)
}

function generateExercises(
  vocab: VocabEntry[],
  exerciseType: ExerciseType,
  difficulty: Difficulty,
): ExerciseItem[] {
  switch (exerciseType) {
    case 'sentences':
      return vocab.map((v, i) => ({
        type: 'sentences' as const,
        word: v.word,
        translation: v.translation,
        sentence: generateSentence(v.word, difficulty, i),
      }))

    case 'fill-blank':
      return vocab.map((v, i) => {
        const sentence = generateSentence(v.word, difficulty, i)
        const regex = new RegExp(`\\b${escapeRegex(v.word)}\\b`, 'gi')
        const blanked = sentence.replace(regex, '______')
        return {
          type: 'fill-blank' as const,
          word: v.word,
          translation: v.translation,
          sentence,
          blanked,
        }
      })

    case 'multiple-choice':
      return vocab.map((v) => {
        const others = vocab.filter((o) => o.word !== v.word).map((o) => o.translation)
        const shuffledOthers = shuffleArray(others).slice(0, 3)
        while (shuffledOthers.length < 3) {
          shuffledOthers.push('---')
        }
        const options = shuffleArray([v.translation, ...shuffledOthers])
        return {
          type: 'multiple-choice' as const,
          word: v.word,
          translation: v.translation,
          options,
          correctIndex: options.indexOf(v.translation),
        }
      })

    case 'story': {
      const sentences: string[] = []
      const templates = STORY_TEMPLATES[difficulty]
      vocab.forEach((v, i) => {
        const connector = STORY_CONNECTORS[i % STORY_CONNECTORS.length]
        const tmpl = pickTemplate(templates, i)
        sentences.push(tmpl.replace('{connector}', connector).replace('{word}', v.word))
      })
      return [{
        type: 'story' as const,
        text: sentences.join(' '),
        words: vocab.map((v) => v.word),
      }]
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ─── URL Encoding ────────────────────────────────────────────── */

function encodeExercise(data: ExerciseData): string {
  const json = JSON.stringify(data)
  return btoa(unescape(encodeURIComponent(json)))
}

function decodeExercise(encoded: string): ExerciseData | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    return JSON.parse(json) as ExerciseData
  } catch {
    return null
  }
}

function getShareUrl(data: ExerciseData): string {
  const base = window.location.origin + window.location.pathname
  return `${base}?exercise=${encodeExercise(data)}`
}

/* ─── LocalStorage ────────────────────────────────────────────── */

const STORAGE_KEY = 'sentence-creator-exercises'

function loadSavedExercises(): SavedExercise[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as SavedExercise[] : []
  } catch {
    return []
  }
}

function saveExercise(data: ExerciseData): SavedExercise {
  const exercises = loadSavedExercises()
  const entry: SavedExercise = {
    id: Date.now().toString(36),
    data,
    shareUrl: getShareUrl(data),
  }
  exercises.unshift(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises.slice(0, 50)))
  return entry
}

function deleteSavedExercise(id: string): void {
  const exercises = loadSavedExercises().filter((e) => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exercises))
}

/* ─── Parse Vocab ─────────────────────────────────────────────── */

function parseVocab(raw: string): VocabEntry[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const sep = line.includes('=') ? '=' : line.includes('-') ? '-' : null
      if (sep) {
        const [word, translation] = line.split(sep).map((s) => s.trim())
        return { word: word || line, translation: translation || word || line }
      }
      return { word: line, translation: line }
    })
}

/* ─── Style Helpers ───────────────────────────────────────────── */

const s = {
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '24px 20px 64px',
    minHeight: '100vh',
  } satisfies CSSProperties,

  header: {
    textAlign: 'center' as const,
    marginBottom: 40,
    paddingTop: 32,
  } satisfies CSSProperties,

  title: {
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
    letterSpacing: '-0.5px',
  } satisfies CSSProperties,

  tagline: {
    color: 'var(--text-muted)',
    fontSize: 15,
  } satisfies CSSProperties,

  section: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: 24,
    marginBottom: 20,
    border: '1px solid var(--border)',
  } satisfies CSSProperties,

  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } satisfies CSSProperties,

  textarea: {
    width: '100%',
    minHeight: 140,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    padding: '12px 14px',
    fontSize: 15,
    fontFamily: 'inherit',
    lineHeight: 1.6,
    resize: 'vertical' as const,
    outline: 'none',
    transition: 'border-color 0.2s',
  } satisfies CSSProperties,

  select: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
    minWidth: 160,
  } satisfies CSSProperties,

  row: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const,
    marginBottom: 20,
  } satisfies CSSProperties,

  btnPrimary: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 32px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
    width: '100%',
  } satisfies CSSProperties,

  btnSecondary: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s',
  } satisfies CSSProperties,

  tabBar: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    background: 'var(--bg)',
    borderRadius: 'var(--radius-sm)',
    padding: 4,
  } satisfies CSSProperties,

  tab: (active: boolean) => ({
    flex: 1,
    padding: '8px 4px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap' as const,
  }) satisfies CSSProperties,

  diffBtn: (active: boolean) => ({
    padding: '6px 16px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    transition: 'all 0.2s',
  }) satisfies CSSProperties,

  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px 24px',
    marginBottom: 12,
  } satisfies CSSProperties,

  cardNum: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } satisfies CSSProperties,

  highlightWord: {
    color: 'var(--highlight)',
    fontWeight: 700,
  } satisfies CSSProperties,

  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    padding: '6px 10px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    width: 160,
  } satisfies CSSProperties,

  shareBox: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--text-muted)',
    wordBreak: 'break-all' as const,
    marginTop: 12,
    lineHeight: 1.5,
  } satisfies CSSProperties,

  savedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 8,
    gap: 12,
    flexWrap: 'wrap' as const,
  } satisfies CSSProperties,

  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 99,
    background: 'rgba(59,130,246,0.15)',
    color: 'var(--accent)',
  } satisfies CSSProperties,

  mcOption: (state: 'default' | 'correct' | 'wrong') => ({
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    border: `1px solid ${state === 'correct' ? 'var(--success)' : state === 'wrong' ? 'var(--error)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-sm)',
    cursor: state === 'default' ? 'pointer' : 'default',
    background: state === 'correct' ? 'rgba(34,197,94,0.1)' : state === 'wrong' ? 'rgba(239,68,68,0.1)' : 'var(--bg)',
    color: state === 'correct' ? 'var(--success)' : state === 'wrong' ? 'var(--error)' : 'var(--text)',
    transition: 'all 0.2s',
    marginBottom: 6,
    fontWeight: state !== 'default' ? 600 : 400,
  }) satisfies CSSProperties,

  studentHeader: {
    textAlign: 'center' as const,
    padding: '24px 0 16px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 32,
  } satisfies CSSProperties,

  footer: {
    textAlign: 'center' as const,
    padding: '40px 0 24px',
    color: 'var(--text-muted)',
    fontSize: 13,
  } satisfies CSSProperties,
}

/* ─── Highlight words in text ─────────────────────────────────── */

function highlightWords(text: string, words: string[]): ReactNode[] {
  if (words.length === 0) return [text]
  const pattern = words.map(escapeRegex).join('|')
  const regex = new RegExp(`(\\b(?:${pattern})\\b)`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) => {
    const isMatch = words.some((w) => w.toLowerCase() === part.toLowerCase())
    if (isMatch) {
      return <span key={i} className="highlight-word" style={s.highlightWord}>{part}</span>
    }
    return <span key={i}>{part}</span>
  })
}

/* ─── Components ──────────────────────────────────────────────── */

const LANGUAGES: Language[] = ['Spanish', 'French', 'German', 'Arabic', 'Italian', 'Portuguese', 'English', 'Japanese', 'Korean']
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']
const EXERCISE_TYPES: { id: ExerciseType; label: string }[] = [
  { id: 'sentences', label: 'Example Sentences' },
  { id: 'fill-blank', label: 'Fill-in-the-Blank' },
  { id: 'multiple-choice', label: 'Multiple Choice' },
  { id: 'story', label: 'Story' },
]

/* ─── Exercise Display Components ─────────────────────────────── */

function SentenceCard({ item, index }: { item: SentenceItem; index: number }) {
  return (
    <motion.div
      className="exercise-card"
      style={s.card}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div style={s.cardNum}>Word {index + 1}</div>
      <p style={{ fontSize: 16, lineHeight: 1.7 }}>
        {highlightWords(item.sentence, [item.word])}
      </p>
      {item.translation !== item.word && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          {item.word} = {item.translation}
        </p>
      )}
    </motion.div>
  )
}

function FillBlankCard({ item, index, interactive }: { item: FillBlankItem; index: number; interactive?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const isCorrect = answer.toLowerCase().trim() === item.word.toLowerCase().trim()

  if (interactive) {
    return (
      <motion.div
        className="exercise-card"
        style={s.card}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
      >
        <div style={s.cardNum}>Question {index + 1}</div>
        <p style={{ fontSize: 16, lineHeight: 1.7, marginBottom: 12 }}>{item.blanked}</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{
              ...s.input,
              borderColor: submitted ? (isCorrect ? 'var(--success)' : 'var(--error)') : 'var(--border)',
            }}
            placeholder="Type your answer..."
            value={answer}
            onChange={(e) => { setAnswer(e.target.value); setSubmitted(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') setSubmitted(true) }}
          />
          <button
            style={{ ...s.btnSecondary, fontSize: 13 }}
            onClick={() => setSubmitted(true)}
          >
            Check
          </button>
          {submitted && (
            <span style={{ fontSize: 13, fontWeight: 600, color: isCorrect ? 'var(--success)' : 'var(--error)' }}>
              {isCorrect ? 'Correct!' : `Answer: ${item.word}`}
            </span>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="exercise-card"
      style={{ ...s.card, cursor: 'pointer' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => setRevealed(!revealed)}
    >
      <div style={s.cardNum}>Question {index + 1} {!revealed && <span style={{ fontSize: 11, opacity: 0.6 }}>(click to reveal)</span>}</div>
      <p style={{ fontSize: 16, lineHeight: 1.7 }}>
        {revealed ? highlightWords(item.sentence, [item.word]) : item.blanked}
      </p>
    </motion.div>
  )
}

function MultipleChoiceCard({ item, index }: { item: MultipleChoiceItem; index: number }) {
  const [selected, setSelected] = useState<number | null>(null)

  const getState = (i: number): 'default' | 'correct' | 'wrong' => {
    if (selected === null) return 'default'
    if (i === item.correctIndex) return 'correct'
    if (i === selected && i !== item.correctIndex) return 'wrong'
    return 'default'
  }

  return (
    <motion.div
      className="exercise-card"
      style={s.card}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div style={s.cardNum}>Question {index + 1}</div>
      <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
        What does <span style={s.highlightWord}>{item.word}</span> mean?
      </p>
      <div>
        {item.options.map((opt, i) => (
          <button
            key={i}
            style={s.mcOption(getState(i))}
            onClick={() => { if (selected === null) setSelected(i) }}
            disabled={selected !== null}
          >
            {String.fromCharCode(65 + i)}. {opt}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

function StoryCard({ item, index }: { item: StoryItem; index: number }) {
  return (
    <motion.div
      className="exercise-card"
      style={s.card}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div style={s.cardNum}>Story</div>
      <p style={{ fontSize: 16, lineHeight: 1.8 }}>
        {highlightWords(item.text, item.words)}
      </p>
    </motion.div>
  )
}

function ExerciseDisplay({ data, interactive }: { data: ExerciseData; interactive?: boolean }) {
  const isRTL = RTL_LANGUAGES.includes(data.language)

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {data.items.map((item, i) => {
        switch (item.type) {
          case 'sentences':
            return <SentenceCard key={i} item={item} index={i} />
          case 'fill-blank':
            return <FillBlankCard key={i} item={item} index={i} interactive={interactive} />
          case 'multiple-choice':
            return <MultipleChoiceCard key={i} item={item} index={i} />
          case 'story':
            return <StoryCard key={i} item={item} index={i} />
        }
      })}
    </div>
  )
}

/* ─── Student Mode ────────────────────────────────────────────── */

function StudentView({ data }: { data: ExerciseData }) {
  const typeLabel = EXERCISE_TYPES.find((t) => t.id === data.exerciseType)?.label ?? data.exerciseType

  return (
    <div style={s.container}>
      <div style={s.studentHeader}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{data.title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {typeLabel} &middot; {data.language} &middot; {data.difficulty}
        </p>
        {data.teacherName && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Created by {data.teacherName}
          </p>
        )}
      </div>

      <ExerciseDisplay data={data} interactive />

      <div style={s.footer} className="no-print">
        <a
          href={window.location.pathname}
          style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
        >
          Create Your Own Exercises &rarr;
        </a>
      </div>
    </div>
  )
}

/* ─── Creator Mode ────────────────────────────────────────────── */

function CreatorView() {
  const [vocabText, setVocabText] = useState('')
  const [language, setLanguage] = useState<Language>('Spanish')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [exerciseType, setExerciseType] = useState<ExerciseType>('sentences')
  const [teacherName, setTeacherName] = useState('')
  const [exerciseTitle, setExerciseTitle] = useState('')

  const [generatedData, setGeneratedData] = useState<ExerciseData | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [savedExercises, setSavedExercises] = useState<SavedExercise[]>(loadSavedExercises)
  const [showSaved, setShowSaved] = useState(false)

  const vocabCount = useMemo(() => {
    return parseVocab(vocabText).length
  }, [vocabText])

  const handleGenerate = useCallback(() => {
    const vocab = parseVocab(vocabText)
    if (vocab.length === 0) return

    const title = exerciseTitle.trim() || `${language} Vocabulary Practice`
    const items = generateExercises(vocab, exerciseType, difficulty)
    const data: ExerciseData = {
      title,
      language,
      difficulty,
      exerciseType,
      items,
      createdAt: new Date().toISOString(),
      teacherName: teacherName.trim(),
    }

    setGeneratedData(data)
    const url = getShareUrl(data)
    setShareUrl(url)

    const saved = saveExercise(data)
    setSavedExercises((prev) => [saved, ...prev.filter((e) => e.id !== saved.id)].slice(0, 50))
  }, [vocabText, language, difficulty, exerciseType, exerciseTitle, teacherName])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [shareUrl])

  const handleCopyAll = useCallback(() => {
    if (!generatedData) return
    let text = `${generatedData.title}\n${generatedData.language} - ${generatedData.difficulty}\n\n`
    generatedData.items.forEach((item, i) => {
      if (item.type === 'sentences') {
        text += `${i + 1}. ${item.sentence}\n`
      } else if (item.type === 'fill-blank') {
        text += `${i + 1}. ${item.blanked}\n`
      } else if (item.type === 'multiple-choice') {
        text += `${i + 1}. What does "${item.word}" mean?\n`
        item.options.forEach((opt, j) => {
          text += `   ${String.fromCharCode(65 + j)}) ${opt}${j === item.correctIndex ? ' *' : ''}\n`
        })
        text += '\n'
      } else if (item.type === 'story') {
        text += item.text + '\n'
      }
    })
    navigator.clipboard.writeText(text).catch(() => void 0)
  }, [generatedData])

  const handleDeleteSaved = useCallback((id: string) => {
    deleteSavedExercise(id)
    setSavedExercises((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const handleCopySavedLink = useCallback((url: string) => {
    navigator.clipboard.writeText(url).catch(() => void 0)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate()
    }
  }, [handleGenerate])

  return (
    <div style={s.container} onKeyDown={handleKeyDown}>
      {/* Header */}
      <div style={s.header} className="no-print">
        <h1 style={s.title}>Sentence Creator</h1>
        <p style={s.tagline}>Turn vocabulary into exercises</p>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="print-header" style={{ display: 'none' }}>
        {generatedData?.title ?? 'Vocabulary Exercise'}
      </div>

      {/* Input Section */}
      <div className="no-print">
        <div style={s.section}>
          <label style={s.label}>
            Vocabulary {vocabCount > 0 && <span style={{ color: 'var(--accent)' }}>({vocabCount} words)</span>}
          </label>
          <textarea
            style={s.textarea}
            placeholder="Enter your vocabulary (one word per line, or word = translation)&#10;&#10;hola = hello&#10;gato = cat&#10;libro = book"
            value={vocabText}
            onChange={(e) => setVocabText(e.target.value)}
          />
        </div>

        <div style={s.section}>
          <div style={s.row}>
            <div>
              <label style={s.label}>Language</label>
              <select style={s.select} value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Exercise title (optional)</label>
              <input
                style={{ ...s.input, width: 220 }}
                placeholder="e.g. Unit 3 Vocabulary"
                value={exerciseTitle}
                onChange={(e) => setExerciseTitle(e.target.value)}
              />
            </div>
            <div>
              <label style={s.label}>Your name (optional)</label>
              <input
                style={{ ...s.input, width: 180 }}
                placeholder="Teacher name"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={s.label}>Difficulty</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIFFICULTIES.map((d) => (
                <button key={d} style={s.diffBtn(difficulty === d)} onClick={() => setDifficulty(d)}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={s.label}>Exercise Type</label>
            <div style={s.tabBar}>
              {EXERCISE_TYPES.map((t) => (
                <button key={t.id} style={s.tab(exerciseType === t.id)} onClick={() => setExerciseType(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            style={{
              ...s.btnPrimary,
              opacity: vocabCount === 0 ? 0.5 : 1,
              cursor: vocabCount === 0 ? 'not-allowed' : 'pointer',
            }}
            onClick={handleGenerate}
            disabled={vocabCount === 0}
          >
            Generate Exercise{vocabCount > 0 ? ` (${vocabCount} words)` : ''}
          </button>
        </div>
      </div>

      {/* Generated Output */}
      <AnimatePresence>
        {generatedData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Action Bar */}
            <div
              className="no-print"
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <button style={s.btnSecondary} onClick={handleCopyAll}>
                Copy All
              </button>
              <button style={s.btnSecondary} onClick={() => window.print()}>
                Print
              </button>
              <button
                style={{
                  ...s.btnSecondary,
                  background: 'rgba(59,130,246,0.1)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
                onClick={handleCopyLink}
              >
                {copied ? 'Copied!' : 'Share Link'}
              </button>
            </div>

            {/* Share URL display */}
            {shareUrl && (
              <div className="no-print" style={s.shareBox}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Shareable Link
                </div>
                <div style={{ fontSize: 12, overflowWrap: 'break-word' }}>
                  {shareUrl.length > 200 ? shareUrl.slice(0, 200) + '...' : shareUrl}
                </div>
                <button
                  style={{ ...s.btnSecondary, marginTop: 8, fontSize: 12 }}
                  onClick={handleCopyLink}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}

            {/* Exercise Title for output */}
            <div style={{ textAlign: 'center', margin: '24px 0 16px' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{generatedData.title}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {EXERCISE_TYPES.find((t) => t.id === generatedData.exerciseType)?.label} &middot; {generatedData.language} &middot; {generatedData.difficulty}
              </p>
            </div>

            <ExerciseDisplay data={generatedData} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Exercises */}
      <div className="no-print" style={{ marginTop: 32 }}>
        <button
          style={{
            ...s.btnSecondary,
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
          }}
          onClick={() => setShowSaved(!showSaved)}
        >
          <span style={{ fontWeight: 600 }}>My Exercises</span>
          <span style={s.badge}>{savedExercises.length}</span>
        </button>

        <AnimatePresence>
          {showSaved && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginTop: 8 }}
            >
              {savedExercises.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 20 }}>
                  No exercises saved yet. Generate one above!
                </p>
              ) : (
                savedExercises.map((ex) => (
                  <div key={ex.id} style={s.savedItem}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{ex.data.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(ex.data.createdAt).toLocaleDateString()} &middot; {ex.data.items.length} items &middot; {ex.data.language}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...s.btnSecondary, fontSize: 11, padding: '4px 10px' }} onClick={() => handleCopySavedLink(ex.shareUrl)}>
                        Copy Link
                      </button>
                      <button
                        style={{ ...s.btnSecondary, fontSize: 11, padding: '4px 10px', color: 'var(--error)', borderColor: 'var(--error)' }}
                        onClick={() => handleDeleteSaved(ex.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div style={s.footer} className="no-print">
        <p>Sentence Creator &mdash; Share vocabulary exercises with a link</p>
      </div>
    </div>
  )
}

/* ─── App Root ─────────────────────────────────────────────────── */

export default function App() {
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null)
  const [isStudent, setIsStudent] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('exercise')
    if (encoded) {
      const data = decodeExercise(encoded)
      if (data) {
        setExerciseData(data)
        setIsStudent(true)
      }
    }
  }, [])

  if (isStudent && exerciseData) {
    return <StudentView data={exerciseData} />
  }

  return <CreatorView />
}
