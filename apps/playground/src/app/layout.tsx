
import type { Metadata } from "next"
import "./globals.css"
import Script from "next/script"
import { Toaster } from "../components/ui/toaster"
import { AgentProvider } from "../contexts/AgentContext"
import React from "react"

export const metadata: Metadata = {
  title: "Polkadot Agent Playground",
  description: "Interactive environment for exploring Polkadot Agent Kit on-chain capabilities",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* put this in the <head> */}
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-enabled="true"
          />
        )}
        {/* rest of your scripts go under */}
      </head>
      <body className="antialiased">
        <AgentProvider>
          {children}
          <Toaster />
        </AgentProvider>
      </body>
    </html>
  )
}
