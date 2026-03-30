import {
  Bot,
  BookOpen,
  Compass,
  Download,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  MessageSquareText,
  Radar,
  Search,
  Sparkles,
  Upload
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

const workflowSteps = [
  {
    title: 'Collect product reviews',
    description:
      'Gather reviews from the sources your team already uses, such as web scrapers, marketplace exports, third-party review services, retailer portals, or Amazon APIs. Combine them into one review table before running sentiment analysis.'
  },
  {
    title: 'Prepare the input table',
    description:
      'Your Excel file can include any number of additional business columns, but it must contain review_id, review_title, and review_text. Those three fields are the mandatory inputs used for sentiment analysis.'
  },
  {
    title: 'Run Sentiment Analysis',
    description:
      'Open the Sentiment Analysis page, choose the API provider if needed, upload the review file, and run the analysis. The tool processes the reviews and extracts review-level and aspect-level sentiment information.'
  },
  {
    title: 'Save the enriched output',
    description:
      'When processing finishes, download sentiment_enriched.xlsx. This is the saved enriched dataset used by the dashboard, benchmark views, review explorer, and Ask Agent.'
  }
]

const inputColumns = [
  {
    name: 'review_id',
    meaning: 'Unique review identifier used to connect each sentiment result back to the original review row.'
  },
  {
    name: 'review_title',
    meaning: 'Review headline or short title provided by the reviewer.'
  },
  {
    name: 'review_text',
    meaning: 'Main review body used by the model to detect sentiment, aspects, and evidence quotes.'
  }
]

const outputColumns = [
  {
    name: 'language',
    meaning: 'Detected language code for the review.'
  },
  {
    name: 'overall_sentiment',
    meaning: 'Overall review sentiment label such as positive, neutral, negative, or mixed.'
  },
  {
    name: 'overall_confidence',
    meaning: 'Model confidence score for the overall sentiment decision.'
  },
  {
    name: 'aspects_json',
    meaning: 'Structured aspect-level sentiment output with aspect names, sentiment labels, evidence quotes, and confidence.'
  },
  {
    name: 'aspect_count',
    meaning: 'Number of aspects extracted from the review.'
  }
]

const dashboardPages = [
  {
    title: 'Analytics Dashboard',
    icon: LayoutDashboard,
    purpose:
      'Use this as the main decision-making page. It summarizes review volume, rating performance, sentiment movement, and the product aspects that customers talk about most.',
    howTo:
      'Start with the Analyze by filter to switch between Overall, Country, Source, Model, Product, Generation, or Region. Then read the KPI cards first, followed by the trend charts and the aspect analysis.',
    features: [
      'Analyze by: changes the scope of every metric and chart on the page.',
      'Insight Summary: generates a plain-language summary for the currently selected scope.',
      'Feedback Count: shows how many reviews are included in the current selection.',
      'Average Rating: shows the average rating for the selected slice of data.',
      'Sentiment Mix: shows the balance of positive, neutral, and negative reviews.',
      'Rating Trend Over Time: explains how star ratings move over time and helps spot periods of improvement or decline.',
      'Sentiment Trend Over Time: shows how customer feeling changes over time, not just star ratings.',
      'Aspect Frequency Analysis: shows which product aspects are discussed most and whether feedback is more positive or negative.',
      'Interpret buttons: request an AI explanation of the visible chart in business language.',
      'Zoom buttons: open a larger version of a chart for closer review.'
    ]
  },
  {
    title: 'Aspect Benchmark',
    icon: Radar,
    purpose:
      'Use this page to compare aspect-level sentiment strength across products, countries, or the overall dataset.',
    howTo:
      'Choose the benchmark scope, optionally limit the source, then compare the plotted items side by side. This is useful when you want to understand where one product or market performs better than another.',
    features: [
      'Scope controls: switch between overall, product-wise, and country-wise comparisons.',
      'Source filter: compare benchmark results within a single review source if needed.',
      'Radar comparison: highlights relative strengths and weaker aspects across the selected entities.',
      'Interpret: generates a narrative summary of the benchmark differences and what they mean.'
    ]
  },
  {
    title: 'Review Explorer',
    icon: Search,
    purpose:
      'Use this page when you want to inspect individual reviews instead of only aggregated charts.',
    howTo:
      'Filter the table by business dimensions or sentiment, then open a row to inspect the review details and extracted aspect information.',
    features: [
      'Search and filters: narrow the review set to the exact slice you want to audit.',
      'Row-level inspection: open individual reviews with their metadata and sentiment output.',
      'Aspect evidence review: check the extracted aspects and supporting evidence from the original review text.',
      'QA workflow: useful for validating model output, checking complaints, and reading real customer language.'
    ]
  },
  {
    title: 'Ask Agent',
    icon: Bot,
    purpose:
      'Use this page for natural-language questions about the currently available sentiment dataset.',
    howTo:
      'Ask direct business questions such as comparisons, top complaints, strongest aspects, country differences, or trend questions. The agent answers using the loaded sentiment-enriched dataset.',
    features: [
      'Natural-language analysis: ask questions without building manual filters or exports.',
      'Data-grounded answers: the agent works from the current dataset rather than generic product knowledge.',
      'Exploratory use cases: useful for follow-up questions after chart review.',
      'No-data behavior: if no sentiment input is available, the page clearly reports that no input data is found.'
    ]
  },
  {
    title: 'Sentiment Analysis',
    icon: Sparkles,
    purpose:
      'Use this page to upload review data, run the sentiment pipeline, preview the enriched output, and download the saved result.',
    howTo:
      'Upload a review file, optionally adjust the batch settings, run the analysis, then download sentiment_enriched.xlsx for future use or review it in the output preview table.',
    features: [
      'API provider selection: choose which configured provider powers the sentiment run.',
      'Upload and run workflow: process a review file directly in the UI.',
      'Download: save the enriched output once the run finishes.',
      'Output preview: inspect the sentiment_enriched table before moving to the dashboard pages.'
    ]
  }
]

export function DocumentationPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
          <BookOpen className="h-4 w-4" />
          Documentation
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tool Guide</h1>
          <p className="max-w-4xl text-base leading-7 text-slate-600">
            This tool turns raw product review data into a structured sentiment dataset that business teams can explore through
            interactive analytics, aspect benchmarking, row-level review inspection, and natural-language questioning. The
            workflow is designed for business users who need to move from raw reviews to actionable signals without building a
            separate reporting pipeline for every new question.
          </p>
          <p className="max-w-4xl text-base leading-7 text-slate-600">
            The core output of the tool is an enriched review file where the original review rows are preserved and augmented
            with language detection, review-level sentiment, and structured aspect-level evidence. That enriched output then
            powers every analysis page in the application.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-sky-100 bg-sky-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-sky-600" />
              Input to Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-700">
              Start from one review Excel file, enrich it with sentiment and aspect extraction, then use the dashboard to move
              from individual reviews to decision-ready summaries.
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <Filter className="h-5 w-5 text-emerald-600" />
              Slice by Business View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-700">
              Analyze the same dataset by overall performance, country, source, product, model, generation, or region without
              recreating the data each time.
            </p>
          </CardContent>
        </Card>

        <Card className="border-violet-100 bg-violet-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <MessageSquareText className="h-5 w-5 text-violet-600" />
              Evidence-Based Review Reading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-700">
              The tool keeps the link to the original customer language so users can move from a chart or summary back to the
              supporting review evidence when needed.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Compass className="h-5 w-5 text-slate-700" />
          <h2 className="text-2xl font-semibold text-slate-900">How to Run and Save Sentiment Analysis</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowSteps.map((step, index) => {
            const stepIcons = [MessageSquareText, FileSpreadsheet, Upload, Download]
            const StepIcon = stepIcons[index]

            return (
              <Card key={step.title} className="h-full border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-base text-slate-900">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <span className="flex items-center gap-2">
                      <StepIcon className="h-4 w-4 text-sky-600" />
                      {step.title}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-slate-600">{step.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Mandatory Input for Sentiment Analysis</CardTitle>
              <CardDescription>
                The uploaded review file may contain extra business columns, but these columns must exist for the analysis to run.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {inputColumns.map((column) => (
                <div key={column.name} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-mono text-sm font-semibold text-slate-900">{column.name}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{column.meaning}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Output Generated by Sentiment Analysis</CardTitle>
              <CardDescription>
                These generated fields are merged back into the uploaded review table by review_id to create sentiment_enriched.xlsx.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {outputColumns.map((column) => (
                <div key={column.name} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-mono text-sm font-semibold text-slate-900">{column.name}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{column.meaning}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-5 w-5 text-slate-700" />
          <h2 className="text-2xl font-semibold text-slate-900">How the Dashboard Works</h2>
        </div>
        <p className="max-w-4xl text-base leading-7 text-slate-600">
          Every page reads from the same sentiment-enriched dataset, but each page answers a different business question. Use the
          guidance below to decide where to start and how to interpret what you see.
        </p>

        <div className="space-y-5">
          {dashboardPages.map((page) => {
            const PageIcon = page.icon

            return (
              <Card key={page.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-xl text-slate-900">
                    <div className="rounded-xl bg-slate-100 p-2">
                      <PageIcon className="h-5 w-5 text-slate-700" />
                    </div>
                    {page.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What this page is for</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{page.purpose}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">How to use it</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{page.howTo}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {page.features.map((feature) => {
                      const [label, detail] = feature.split(': ')
                      return (
                        <div key={feature} className="rounded-xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">{label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{detail || ''}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}

