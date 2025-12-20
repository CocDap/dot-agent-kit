"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface AgentConfig {
    privateKey: string
    keyType: "Sr25519" | "Ed25519"
    chains: string[]
    isConfigured?: boolean
}

interface AgentContextType {
    // Configuration
    config: AgentConfig | null
    isConfigured: boolean

    // Agent instance
    agentKit: any | null
    isInitialized: boolean
    isInitializing: boolean

    // Session management
    sessionExpiry: number | null

    // Actions
    setConfig: (config: AgentConfig) => void
    initializeAgent: (config?: AgentConfig) => Promise<void>
    resetAgent: () => void
    setInitializing: (loading: boolean) => void
    checkSession: () => boolean
    restoreAgent: () => Promise<void>
    getIsInitialized: () => boolean
}

const AgentContext = createContext<AgentContextType | undefined>(undefined)

const STORAGE_KEY = 'polkadot-agent-store'
const SESSION_DURATION = 15 * 60 * 1000 // 15 minutes

export function AgentProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfigState] = useState<AgentConfig | null>(null)
    const [isConfigured, setIsConfigured] = useState(false)
    const [agentKit, setAgentKit] = useState<any | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isInitializing, setIsInitializing] = useState(false)
    const [sessionExpiry, setSessionExpiry] = useState<number | null>(null)
    const hasAttemptedRestore = useRef(false)
    const isHydrated = useRef(false)

    // Load state from localStorage on mount
    useEffect(() => {
        if (typeof window === 'undefined') return

        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const { state } = JSON.parse(stored)
                if (state) {
                    setConfigState(state.config || null)
                    setIsConfigured(state.isConfigured || false)
                    setSessionExpiry(state.sessionExpiry || null)
                    // Don't restore isInitialized - agentKit needs to be recreated
                }
            }
        } catch (error) {
            console.error('[AgentContext] Failed to load from localStorage:', error)
        }

        isHydrated.current = true
    }, [])

    // Persist state to localStorage whenever it changes
    useEffect(() => {
        if (typeof window === 'undefined' || !isHydrated.current) return

        try {
            const stateToStore = {
                config,
                isConfigured,
                sessionExpiry,
                // Don't store agentKit or isInitialized
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                state: stateToStore,
                version: 0
            }))
        } catch (error) {
            console.error('[AgentContext] Failed to save to localStorage:', error)
        }
    }, [config, isConfigured, sessionExpiry])

    const setConfig = useCallback((newConfig: AgentConfig) => {
        setConfigState(newConfig)
        setIsConfigured(newConfig.isConfigured || false)
    }, [])

    const checkSession = useCallback(() => {
        if (!config) return false
        if (!isInitialized) return false
        if (!sessionExpiry) return false

        const now = Date.now()
        if (now > sessionExpiry) {
            // Session expired, reset agent but keep config
            setAgentKit(null)
            setIsInitialized(false)
            setSessionExpiry(null)
            return false
        }
        return true
    }, [config, isInitialized, sessionExpiry])

    const restoreAgent = useCallback(async () => {
        if (!config || !sessionExpiry) return

        const now = Date.now()
        if (now > sessionExpiry) {
            // Session expired
            setAgentKit(null)
            setIsInitialized(false)
            setSessionExpiry(null)
            return
        }

        try {
            setIsInitializing(true)
            console.log('[AgentContext] Restoring agent from session')

            const { PolkadotAgentKit } = await import("@polkadot-agent-kit/sdk")

            const kit = new PolkadotAgentKit({
                privateKey: config.privateKey,
                keyType: config.keyType,
                chains: config.chains as any,
            })

            await kit.initializeApi()

            setAgentKit(kit)
            setIsInitialized(true)
            setIsInitializing(false)
        } catch (error) {
            console.error('[AgentContext] Failed to restore agent:', error)
            setIsInitialized(false)
            setIsInitializing(false)
        }
    }, [config, sessionExpiry])

    const initializeAgent = useCallback(async (newConfig?: AgentConfig) => {
        const configToUse = newConfig || config

        if (!configToUse) {
            console.log('[AgentContext] No config provided')
            throw new Error('Agent not configured')
        }

        setIsInitializing(true)

        try {
            const { PolkadotAgentKit } = await import("@polkadot-agent-kit/sdk")
            console.log('[AgentContext] Initializing agent with configToUse:', configToUse)

            const kit = new PolkadotAgentKit({
                privateKey: configToUse.privateKey,
                keyType: configToUse.keyType,
                chains: configToUse.chains as any,
            })

            await kit.initializeApi()
            console.log('[AgentContext] Agent initialized successfully')

            // Set session expiry to 15 minutes from now
            const expiry = Date.now() + SESSION_DURATION

            setAgentKit(kit)
            setIsInitialized(true)
            setIsInitializing(false)
            setSessionExpiry(expiry)
        } catch (error) {
            console.error('[AgentContext] Failed to initialize agent:', error)
            setIsInitialized(false)
            setIsInitializing(false)
            throw error
        }
    }, [config])

    const resetAgent = useCallback(() => {
        setConfigState(null)
        setIsConfigured(false)
        setAgentKit(null)
        setIsInitialized(false)
        setIsInitializing(false)
        setSessionExpiry(null)
    }, [])

    const getIsInitialized = useCallback(() => {
        return isInitialized && agentKit !== null
    }, [isInitialized, agentKit])

    const value: AgentContextType = {
        config,
        isConfigured,
        agentKit,
        isInitialized,
        isInitializing,
        sessionExpiry,
        setConfig,
        initializeAgent,
        resetAgent,
        setInitializing: setIsInitializing,
        checkSession,
        restoreAgent,
        getIsInitialized,
    }

    return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

// Custom hooks for consuming the context
export function useAgent() {
    const context = useContext(AgentContext)
    if (context === undefined) {
        throw new Error('useAgent must be used within an AgentProvider')
    }
    return context
}

export function useAgentConfig() {
    const { config, isConfigured, setConfig } = useAgent()
    return { config, isConfigured, setConfig }
}

export function useAgentActions() {
    const { initializeAgent, resetAgent, setInitializing, checkSession, restoreAgent } = useAgent()
    return { initializeAgent, resetAgent, setInitializing, checkSession, restoreAgent }
}

export function useIsInitialized() {
    const { agentKit, isInitialized } = useAgent()
    return isInitialized && agentKit !== null
}

export function useAgentRestore() {
    const { isInitialized, agentKit, config, sessionExpiry, restoreAgent } = useAgent()
    const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false)

    useEffect(() => {
        // Skip if already attempted or if we already have a valid agentKit
        if (hasAttemptedRestore || (agentKit && typeof agentKit === 'object' && agentKit.getActions)) {
            return
        }

        // Wait for hydration from localStorage
        const timer = setTimeout(() => {
            // Only restore if we have config
            if (!config) {
                console.log('[useAgentRestore] No config found, skipping restoration')
                setHasAttemptedRestore(true)
                return
            }

            // Check if we have a session expiry that hasn't expired
            if (sessionExpiry) {
                const now = Date.now()
                if (now > sessionExpiry) {
                    console.log('[useAgentRestore] Session expired, user needs to reconnect')
                    setHasAttemptedRestore(true)
                    return
                }

                // We have valid config and non-expired session, but no agentKit - restore it
                console.log('[useAgentRestore] Restoring agent from valid session')
                restoreAgent().catch((error) => {
                    console.error('[useAgentRestore] Failed to restore agent:', error)
                })
            } else {
                console.log('[useAgentRestore] No session expiry, user needs to initialize')
            }

            setHasAttemptedRestore(true)
        }, 200) // Small delay to ensure localStorage has hydrated

        return () => clearTimeout(timer)
    }, [config, sessionExpiry, agentKit, hasAttemptedRestore, restoreAgent])
}
