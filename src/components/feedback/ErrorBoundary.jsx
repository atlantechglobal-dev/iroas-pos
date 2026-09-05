import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Unhandled UI error:', error, info)
    }
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <h1>Something went wrong</h1>
            <p>Please refresh the page or try again.</p>
            <button type="button" className="error-boundary-btn" onClick={this.handleRefresh}>
              Refresh
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
