import { Fraunces, Manrope } from 'next/font/google'

import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap'
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap'
})

export const metadata = {
  title: 'Product Review Sentiment Analysis Dashboard',
  description: 'Sentiment analysis and review analytics dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable}`}>
        {children}
      </body>
    </html>
  )
}
