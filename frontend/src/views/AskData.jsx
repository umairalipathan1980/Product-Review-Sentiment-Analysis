import { useEffect, useMemo, useState } from 'react'
import { Bot, Loader, SendHorizonal, Sparkles } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
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

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || 'Unknown error'
}

export function AskData() {
  const [schema, setSchema] = useState(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [error, setError] = useState('')

  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [thinkingSteps, setThinkingSteps] = useState([])

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        setLoadingSchema(true)
        setError('')
        const schemaResponse = await fetchAgentSchema()
        setSchema(schemaResponse?.data || null)
      } catch (err) {
        setError(`Failed to load agent schema: ${getErrorMessage(err)}`)
      } finally {
        setLoadingSchema(false)
      }
    }
    loadInitialState()
  }, [])

  const suggestedQuestions = useMemo(() => schema?.suggested_questions || [], [schema])

  const sendQuestion = async (inputText) => {
    const text = String(inputText || '').trim()
    if (!text || loadingChat) return

    const historyPayload = messages
      .slice(-8)
      .map((msg) => ({ role: msg.role, content: msg.content }))

    const userMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setQuestion('')
    setLoadingChat(true)
    setThinkingSteps([])
    setError('')

    try {
      for await (const event of runAgentChatStream({ question: text, history: historyPayload })) {
        if (event.type === 'tool_call') {
          setThinkingSteps((prev) => [...prev, event.tool])
        } else if (event.type === 'done') {
          setMessages((prev) => [...prev, { role: 'assistant', content: event.answer || 'No answer generated.' }])
          setLoadingChat(false)
          setThinkingSteps([])
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }
    } catch (err) {
      setError(`Agent failed: ${getErrorMessage(err)}`)
      setMessages((prev) => [...prev, { role: 'assistant', content: 'I could not process that question. Please try a narrower query.' }])
      setLoadingChat(false)
      setThinkingSteps([])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ask Data</h1>
          <p className="mt-2 text-slate-500">
            Conversational QA over <span className="font-semibold">sentiment_enriched.xlsx</span> only.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Bot className="h-5 w-5 text-blue-500" />
            Data QA Copilot
          </CardTitle>
          <CardDescription>
            Ask review questions in natural language. Responses are grounded only in the loaded table.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSchema ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Loader className="h-4 w-4 animate-spin" />
              Loading schema...
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {suggestedQuestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendQuestion(item)}
                  disabled={loadingChat}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-60"
                >
                  <span className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
                    <span>{item}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: Compare positive rate by source for Finland in the last 12 months."
              className="min-h-[96px] bg-white"
              disabled={loadingChat}
            />
            {loadingChat && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Loader className="h-3 w-3 animate-spin" />
                  Analyzing data...
                </div>
                {thinkingSteps.map((step, i) => (
                  <div key={i} className="pl-5 text-blue-500">
                    {i === thinkingSteps.length - 1 ? '→ ' : '✓ '}{TOOL_LABELS[step] || step}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => sendQuestion(question)} disabled={loadingChat || !question.trim()} className="gap-2">
                {loadingChat ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Asking...
                  </>
                ) : (
                  <>
                    <SendHorizonal className="h-4 w-4" />
                    Ask
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>Ask follow-up questions naturally in a continuous chat flow.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[560px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">No messages yet. Ask a question to start.</p>
            )}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${
                    isUser
                      ? 'ml-auto bg-blue-600 text-white'
                      : 'mr-auto border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {msg.content}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
