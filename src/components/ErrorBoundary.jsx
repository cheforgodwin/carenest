import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, details) {
    window.dispatchEvent(new CustomEvent('carenest:error', {
      detail: { message: error.message, componentStack: details.componentStack },
    }))
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="system-message">
          <h1>CareNest could not display this page.</h1>
          <p>Your information is safe. Refresh the page and try again. If this continues, contact support.</p>
          <button type="button" onClick={() => window.location.reload()}>Refresh</button>
        </main>
      )
    }
    return this.props.children
  }
}
