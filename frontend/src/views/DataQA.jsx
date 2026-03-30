import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Loader, MessageSquare, Send, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { fetchAgentSchema, runAgentChatStream } from '../lib/api'

const TOOL_LABELS = {
  get_schema: 'Inspecting dataset schema',
  get_aspect_summary: 'Analyzing aspects',
  aggregate_reviews: 'Aggregating reviews',
  find_reviews: 'Fetching review examples',
  explain_negative_drivers: 'Identifying negative drivers',
  get_time_trends: 'Analyzing time trends',
  compare_segments: 'Comparing segments',
  detect_anomalies: 'Detecting anomalies',
  explain_sentiment_drivers: 'Analyzing sentiment drivers',
  statistical_comparison: 'Running statistical test',
  analyze_correlations: 'Analyzing correlations',
  search_review_text: 'Searching review text',
  get_top_keywords: 'Extracting keywords',
  get_aspect_cooccurrence: 'Mapping aspect co-occurrence',
  run_pandas_code: 'Running custom analysis',
}

export default function DataQA() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingSteps, setThinkingSteps] = useState([])
  const [exampleQuestions, setExampleQuestions] = useState([])
  const [schemaLoading, setSchemaLoading] = useState(true)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    fetchAgentSchema()
      .then((schemaResponse) => {
        const questions = schemaResponse.data?.suggested_questions || schemaResponse.suggested_questions || []
        setExampleQuestions(questions)
      })
      .catch((err) => {
        console.error('Failed to load schema:', err)
      })
      .finally(() => {
        setSchemaLoading(false)
      })
  }, [])

  const sendMessage = async (question) => {
    if (!question.trim()) return

    const userMessage = { role: 'user', content: question.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setThinkingSteps([])

    try {
      const history = messages.map((msg) => ({ role: msg.role, content: msg.content }))

      for await (const event of runAgentChatStream({ question: question.trim(), history })) {
        if (event.type === 'tool_call') {
          setThinkingSteps((prev) => [...prev, event.tool])
        } else if (event.type === 'done') {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: event.answer || 'No response received.',
            data: { columns: event.columns || [], rows: event.rows || [], evidence: event.evidence || {} },
          }])
          setLoading(false)
          setThinkingSteps([])
          inputRef.current?.focus()
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `**Error:** ${err.response?.data?.detail || err.message || 'Failed to get response'}`,
        error: true,
      }])
      setLoading(false)
      setThinkingSteps([])
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleExampleClick = (question) => {
    sendMessage(question)
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(251,247,240,0.96))] text-black">
        <div className="border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,rgba(183,121,31,0.18),transparent_35%)] px-5 py-6">
          <p className="section-kicker text-dashboard-copper">Assistant workspace</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-2.5 text-dashboard-copper">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-3xl text-black">Ask Agent</h2>
              <p className="text-sm text-black">Natural-language exploration of the current sentiment dataset.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="rounded-[24px] border border-stone-200 bg-white/92 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-dashboard-copper">How to use it</p>
            <p className="mt-3 text-sm leading-6 text-black">
              Start with one of the suggested prompts or ask a direct question about sentiment, complaints, comparisons, trends, or aspect performance.
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-white/92 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-black">
              <Sparkles className="h-4 w-4 text-dashboard-copper" />
              Suggested prompts
            </div>

            {schemaLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-2xl bg-stone-100" />
                ))}
              </div>
            ) : exampleQuestions.length > 0 ? (
              <div className="space-y-2">
                {exampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(q)}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left text-sm leading-6 text-black transition hover:border-stone-300 hover:bg-stone-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-black">No example questions available.</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="flex min-h-[720px] flex-col overflow-hidden">
        <div className="border-b border-slate-200/70 bg-white/65 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="section-kicker text-dashboard-copper">Conversation</p>
              <h2 className="mt-2 text-2xl font-semibold text-black">AI-guided data analysis</h2>
              <p className="mt-2 text-sm leading-6 text-black">
                Ask direct business questions and review both the narrative answer and any returned supporting tables.
              </p>
            </div>
            <span className="soft-pill text-black">Dataset-backed answers</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 && !schemaLoading && (
            <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
              <div className="w-full rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 px-8 py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-dashboard-copper">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="font-serif text-3xl text-black">Start a conversation</h3>
                <p className="mt-3 text-sm leading-7 text-black">
                  Ask about top complaints, compare segments, explain trend shifts, or request evidence-backed examples from the review set.
                </p>
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((message, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-[26px] px-5 py-4 ${
                    message.role === 'user'
                      ? 'bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(251,247,240,0.96))] text-black shadow-float'
                      : message.error
                        ? 'bg-rose-50 text-rose-900'
                        : 'border border-slate-200 bg-white text-black shadow-sm'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-black">{message.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-black prose-p:text-black prose-a:text-dashboard-copper prose-strong:text-black prose-code:text-dashboard-copper prose-pre:bg-slate-100 prose-li:text-black">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  )}

                  {message.data && message.data.rows && message.data.rows.length > 0 && (
                    <Card className="mt-4 border-slate-200 bg-slate-50/60">
                      <CardContent className="p-3">
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50">
                              <tr className="border-b border-slate-200">
                                {message.data.columns.map((col, i) => (
                                  <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-black">
                                    {col.replace(/_/g, ' ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {message.data.rows.slice(0, 5).map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  {message.data.columns.map((col, j) => (
                                    <td key={j} className="px-3 py-2 text-black">
                                      {typeof row[col] === 'number'
                                        ? row[col].toLocaleString(undefined, {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 2
                                          })
                                        : String(row[col] || '').length > 80
                                          ? String(row[col]).substring(0, 80) + '...'
                                          : String(row[col] || '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {message.data.rows.length > 5 && (
                          <p className="mt-2 text-center text-xs text-black">
                            Showing top 5 of {message.data.rows.length} rows
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex justify-start">
              <div className="min-w-[260px] rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2 text-black">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">Analyzing data...</span>
                </div>
                {thinkingSteps.map((step, i) => (
                  <div key={i} className="pl-6 pt-2 text-xs text-black">
                    {i === thinkingSteps.length - 1 ? '-> ' : 'OK '}
                    {TOOL_LABELS[step] || step}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="mt-auto border-t border-slate-200/70 bg-white/65 px-6 py-5">
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your data..."
              disabled={loading}
              className="flex-1 text-black placeholder:text-slate-500"
            />
            <Button type="submit" disabled={loading || !input.trim()} className="px-5">
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
