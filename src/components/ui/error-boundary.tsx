'use client'

import React, { Component, type ReactNode } from 'react'
import { ErrorState } from './error-state'
import { generateRequestId } from '@/lib/errors'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error?: Error
  errorId?: string
}

/**
 * Section-level React Error Boundary that isolates component failures
 * without letting an entire dashboard page crash to a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: generateRequestId(),
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[COMPONENT_BOUNDARY_CAUGHT]', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title={this.props.fallbackTitle || 'Unable to display this section'}
          message={
            this.props.fallbackMessage ||
            'A display error occurred while rendering this section. You can try refreshing it.'
          }
          requestId={this.state.errorId}
          onRetry={this.handleRetry}
          retryLabel="Reload Section"
        />
      )
    }

    return this.props.children
  }
}

