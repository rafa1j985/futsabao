import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

function ErrorFallback({ error }) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', textAlign: 'center', maxWidth: 400, margin: '40px auto' }}>
      <h2 style={{ color: '#c00' }}>Algo deu errado</h2>
      <p style={{ color: '#666', fontSize: 14 }}>{error?.message || 'Erro desconhecido'}</p>
      <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', cursor: 'pointer' }}>
        Atualizar a página
      </button>
    </div>
  )
}

class AppErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('AppErrorBoundary', error, info) }
  render() {
    if (this.state.error)
      return <ErrorFallback error={this.state.error} reset={() => this.setState({ error: null })} />
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
)
