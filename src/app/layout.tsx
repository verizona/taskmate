import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TaskMate',
  description: 'TaskMate app',
  icons: {
    icon: '/logo/icon.png',
    shortcut: '/logo/icon.png',
    apple: '/logo/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white text-slate-900 antialiased dark:bg-black dark:text-white">
        {children}
      </body>
    </html>
  )
}
