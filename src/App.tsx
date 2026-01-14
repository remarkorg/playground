import { useState } from 'react'
import {
  parse,
  execute,
  serializeToRSC,
  RecourseDocument,
  ParseError,
} from 'recourse-lang'

const EXAMPLE_CODE = `claim("We should invest in a city-wide bike-sharing program.") {
  because("It reduces traffic congestion and carbon emissions.") {
    source("https://example.com/study-on-bike-shares", type: "academic");
  }
  because("It improves public health by encouraging physical activity.") {
    source("https://cdc.gov/physical-activity", type: "government");
  }
  tags: ["transportation", "environment", "budget"];
}

recourse("claim-abc-123", "Challenge") {
  because("The initial investment is too high for our current budget.") {
    source("https://city.gov/budget-report-2024", type: "official_data");
  }
  question("Has a cost-benefit analysis been done for our specific city?");
}`

function App() {
  const [code, setCode] = useState(EXAMPLE_CODE)
  const [output, setOutput] = useState<string>('')
  const [document, setDocument] = useState<RecourseDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCompile = () => {
    setError(null)
    setOutput('')
    setDocument(null)

    try {
      const ast = parse(code)
      setOutput('✅ Parsing successful!\n\nAST:\n' + JSON.stringify(ast, null, 2))
      
      const doc = execute(ast, 'Playground Deliberation', 'playground-user')
      setDocument(doc)
      setOutput(prev => prev + '\n\n✅ Execution successful!\n\nDocument:\n' + serializeToRSC(doc))
    } catch (e) {
      if (e instanceof ParseError) {
        setError(`Parse Error at line ${e.line}, column ${e.column}: ${e.message}`)
      } else if (e instanceof Error) {
        setError(e.message)
      }
    }
  }

  return (
    <div className="container">
      <h1>🔄 Recourse Lang Playground</h1>
      <p className="subtitle">A formal deliberation language for structured discourse</p>

      <div className="editor-container">
        <div className="panel">
          <div className="panel-header">📝 Recourse Lang Code</div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="panel">
          <div className="panel-header">📤 Output</div>
          <div className="output">
            {error && <span className="error">❌ {error}</span>}
            {output && <span className="success">{output}</span>}
            {!error && !output && <span style={{ color: '#666' }}>Click "Compile" to see output...</span>}
          </div>
        </div>
      </div>

      <div>
        <button className="btn" onClick={handleCompile}>
          ▶️ Compile
        </button>
        <button className="btn btn-secondary" onClick={() => setCode(EXAMPLE_CODE)}>
          🔄 Reset
        </button>
      </div>

      {document && document.claims.length > 0 && (
        <div className="claims-list">
          <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>📊 Parsed Claims</h2>
          {document.claims.map((claim) => (
            <div key={claim.id} className="claim-card">
              <div className="claim-statement">{claim.statement}</div>
              <div className="claim-meta">
                <strong>ID:</strong> {claim.id} | 
                <strong> Reasons:</strong> {claim.reasons.length} |
                {claim.tags && claim.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
