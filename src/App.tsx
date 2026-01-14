import { useState } from 'react'
import { Highlight, PrismTheme } from 'prism-react-renderer'
import GraphView from './GraphView'
import {
  parse,
  execute,
  serializeToRSC,
  RecourseDocument,
  ParseError,
  executeQuery,
  buildQuery,
  findEvidenceGaps,
  detectContradictions,
  getChallengeCount,
  getSupportCount,
  getAllQuestions,
  addClaim,
  createEmptyDocument,
} from 'recourse-lang'

// Custom theme with cyan accent
const customTheme: PrismTheme = {
  plain: {
    color: '#d4d4d4',
    backgroundColor: '#0a0a0a',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6a737d' } },
    { types: ['punctuation'], style: { color: '#666666' } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'], style: { color: '#22d3ee' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin'], style: { color: '#a5d6ff' } },
    { types: ['operator', 'entity', 'url'], style: { color: '#888888' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#ff7b72' } },
    { types: ['function', 'class-name'], style: { color: '#d2a8ff' } },
    { types: ['regex', 'important', 'variable'], style: { color: '#22d3ee' } },
  ],
}

// Types for graph visualization
interface GraphNode {
  id: string
  type: 'claim' | 'recourse'
  label: string
  command?: string
}

interface GraphEdge {
  source: string
  target: string
  type: string
  color: string
}

function toGraph(doc: RecourseDocument): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  
  const colorMap: Record<string, string> = {
    PROPOSE: '#3b82f6',
    CHALLENGE: '#ef4444',
    SUPPORT: '#22c55e',
    AMEND: '#f59e0b',
  }

  for (const claim of doc.claims) {
    nodes.push({
      id: claim.id,
      type: 'claim',
      label: claim.statement.slice(0, 50) + (claim.statement.length > 50 ? '...' : ''),
    })
  }

  for (const recourse of doc.recourses) {
    const command = (recourse as any).command || (recourse as any).type || 'UNKNOWN'
    if (recourse.targetClaimId) {
      edges.push({
        source: recourse.id,
        target: recourse.targetClaimId,
        type: command,
        color: colorMap[command] || '#6b7280',
      })
      nodes.push({
        id: recourse.id,
        type: 'recourse',
        label: command,
        command,
      })
    }
  }

  return { nodes, edges }
}

function getAmendCount(doc: RecourseDocument, claimId: string): number {
  return doc.recourses.filter(r => 
    r.targetClaimId === claimId && 
    ((r as any).command === 'AMEND' || (r as any).type === 'Amend')
  ).length
}

// Syntax highlighted code block component
function CodeBlock({ code, language = 'javascript', showLineNumbers = true }: { code: string; language?: string; showLineNumbers?: boolean }) {
  return (
    <Highlight theme={customTheme} code={code.trim()} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre className="code-block" style={{ ...style, background: '#0a0a0a' }}>
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {showLineNumbers && <span className="line-number">{i + 1}</span>}
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}

const EXAMPLES = [
  {
    id: 'bike-share',
    title: 'City Bike Share',
    desc: 'Policy deliberation',
    code: `PROPOSE claim ("We should invest in a city-wide bike-sharing program.") {
  because ("It reduces traffic congestion and carbon emissions.")
  sources ["https://example.com/study-on-bike-shares"]
  because ("It improves public health by encouraging physical activity.")
  sources ["https://cdc.gov/physical-activity"]
  tags [transportation, environment, budget]
}

CHALLENGE claim ("claim-abc-123") {
  because ("The initial investment is too high for our current budget.")
  sources ["https://city.gov/budget-report-2024"]
  question ("Has a cost-benefit analysis been done for our specific city?")
}

SUPPORT claim ("claim-abc-123") {
  because ("Portland saw 15% increase in local business revenue near bike stations.")
  sources ["https://portland-study.com/economic-impact"]
}

AMEND claim ("claim-abc-123") {
  propose ("We should pilot a bike-sharing program in the downtown district first.")
  because ("A pilot program would limit initial cost and allow us to gather data.")
}`
  },
  {
    id: 'ai-deliberation',
    title: 'AI Deliberation',
    desc: 'AI-generated discourse',
    code: `// Human proposes initial claim
PROPOSE claim ("AI systems should be open source by default.") {
  because ("Transparency enables safety auditing and reduces black-box risks.")
  sources ["https://ai-safety.org/transparency-report"]
  tags [ai, policy, safety]
}

// AI Agent analyzes and generates challenge
CHALLENGE claim ("claim-ai-001") {
  because ("Open sourcing advanced AI models could enable malicious actors.")
  because ("Proprietary models fund research through commercial incentives.")
  sources ["https://security-research.com/ai-risks"]
  question ("How do we balance transparency with security concerns?")
}

// AI Agent identifies synthesis opportunity
AMEND claim ("claim-ai-001") {
  propose ("AI systems above certain capability thresholds should require audited transparency reports rather than full open source.")
  because ("This balances safety oversight with security concerns.")
  because ("Tiered approach allows innovation while protecting against misuse.")
}

// AI generates evidence summary
SUPPORT claim ("claim-ai-001") {
  because ("Academic research shows 73% of AI incidents involved proprietary systems with no external review.")
  sources ["https://ai-incident-database.org/2024-report"]
}`
  },
  {
    id: 'remote-work',
    title: 'Remote Work',
    desc: 'Workplace debate',
    code: `PROPOSE claim ("Companies should adopt permanent remote work policies.") {
  because ("Remote work increases employee productivity by 13%.")
  sources ["https://stanford.edu/remote-work-study"]
  because ("It reduces office overhead costs significantly.")
  tags [workplace, productivity, cost]
}

SUPPORT claim ("claim-remote-001") {
  because ("Employee satisfaction surveys show 78% prefer remote options.")
  sources ["https://hr-survey-2024.com/results"]
}

CHALLENGE claim ("claim-remote-001") {
  because ("Team collaboration suffers without in-person interaction.")
  question ("How do we maintain company culture remotely?")
}`
  },
  {
    id: 'ai-regulation',
    title: 'AI Regulation',
    desc: 'Tech policy',
    code: `PROPOSE claim ("AI systems should require mandatory safety audits before deployment.") {
  because ("Unregulated AI poses risks to public safety and privacy.")
  sources ["https://ai-safety-institute.org/report"]
  because ("Other high-risk industries already require safety certifications.")
  tags [ai, regulation, safety]
}

AMEND claim ("claim-ai-001") {
  propose ("Safety audits should be tiered based on AI system risk level.")
  because ("Low-risk AI shouldn't face the same scrutiny as autonomous vehicles.")
}

CHALLENGE claim ("claim-ai-001") {
  question ("Who would conduct these audits?")
  question ("What standards would be used?")
}`
  },
  {
    id: 'simple',
    title: 'Simple Claim',
    desc: 'Minimal example',
    code: `PROPOSE claim ("Coffee improves focus and productivity.") {
  because ("Caffeine blocks adenosine receptors in the brain.")
  tags [health, productivity]
}`
  }
]

const MUTATION_EXAMPLES = [
  {
    id: 'add-claim',
    title: 'Add Claim',
    code: `import { createEmptyDocument, addClaim } from 'recourse-lang';

let doc = createEmptyDocument("My Deliberation");

const claim = {
  id: 'claim-001',
  statement: "We need better public transit",
  reasons: [{
    text: "Reduces emissions",
    sources: [{ url: "https://study.com", type: "academic" }]
  }],
  tags: ["transit", "environment"],
  createdAt: new Date().toISOString()
};

doc = addClaim(doc, claim);`
  },
  {
    id: 'add-challenge',
    title: 'Add Challenge',
    code: `import { addRecourse } from 'recourse-lang';

const challenge = {
  id: 'recourse-001',
  command: 'CHALLENGE',
  targetClaimId: 'claim-001',
  reasons: [{
    text: "Cost is prohibitive",
    sources: []
  }],
  questions: [{ text: "What's the budget?" }],
  createdAt: new Date().toISOString()
};

doc = addRecourse(doc, challenge);`
  },
  {
    id: 'query',
    title: 'Query Document',
    code: `import { executeQuery, buildQuery } from 'recourse-lang';

const result = executeQuery(document, [
  buildQuery('claims', {}, [
    buildQuery('id'),
    buildQuery('statement'),
    buildQuery('challengeCount'),
  ])
]);

// Returns: { claims: [{ id, statement, challengeCount }] }`
  },
  {
    id: 'analyze',
    title: 'Analyze',
    code: `import {
  findEvidenceGaps,
  detectContradictions,
  getChallengeCount,
  getAllQuestions
} from 'recourse-lang';

const gaps = findEvidenceGaps(document);
// [{ claimId, statement, reasonsWithoutSources }]

const questions = getAllQuestions(document);
// [{ recourseId, targetClaimId, questions: string[] }]

const challenges = getChallengeCount(document, 'claim-001');
// number`
  }
]

type TabType = 'editor' | 'graph' | 'query' | 'analysis' | 'mutations' | 'docs' | 'compare'

function App() {
  const [code, setCode] = useState(EXAMPLES[0].code)
  const [activeExample, setActiveExample] = useState(EXAMPLES[0].id)
  const [output, setOutput] = useState<string>('')
  const [document, setDocument] = useState<RecourseDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('editor')
  const [queryResult, setQueryResult] = useState<string>('')
  const [activeMutationExample, setActiveMutationExample] = useState(MUTATION_EXAMPLES[0].id)
  const [newClaimText, setNewClaimText] = useState('')
  const [newReasonText, setNewReasonText] = useState('')

  const handleCompile = () => {
    setError(null)
    setOutput('')
    setDocument(null)

    try {
      const ast = parse(code)
      const doc = execute(ast, 'Playground', 'user')
      setDocument(doc)
      setOutput(serializeToRSC(doc))
    } catch (e) {
      if (e instanceof ParseError) {
        setError(`Line ${e.line}:${e.column} - ${e.message}`)
      } else if (e instanceof Error) {
        setError(e.message)
      }
    }
  }

  const handleExampleSelect = (example: typeof EXAMPLES[0]) => {
    setCode(example.code)
    setActiveExample(example.id)
    setError(null)
    setOutput('')
    setDocument(null)
  }

  const runQuery = () => {
    if (!document) {
      setQueryResult('Compile code first to run queries')
      return
    }
    try {
      const result = executeQuery(document, [
        buildQuery('claims', {}, [
          buildQuery('id'),
          buildQuery('statement'),
          buildQuery('challengeCount'),
        ])
      ])
      setQueryResult(JSON.stringify(result, null, 2))
    } catch (e) {
      setQueryResult(`Query error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  const getAnalysis = () => {
    if (!document) return null
    const gaps = findEvidenceGaps(document)
    const contradictions = detectContradictions(document)
    const questions = getAllQuestions(document)
    let totalChallenges = 0, totalSupports = 0, totalAmends = 0
    document.claims.forEach(c => {
      totalChallenges += getChallengeCount(document, c.id)
      totalSupports += getSupportCount(document, c.id)
      totalAmends += getAmendCount(document, c.id)
    })
    return { gaps, contradictions, questions, totalChallenges, totalSupports, totalAmends }
  }

  const handleAddClaim = () => {
    if (!newClaimText.trim()) return
    const baseDoc = document || createEmptyDocument('Playground')
    const newClaim = {
      id: `claim-${Date.now()}`,
      statement: newClaimText,
      reasons: newReasonText ? [{ text: newReasonText, sources: [] }] : [],
      createdAt: new Date().toISOString(),
    }
    setDocument(addClaim(baseDoc, newClaim))
    setNewClaimText('')
    setNewReasonText('')
  }

  const analysis = document ? getAnalysis() : null
  const graph = document ? toGraph(document) : null

  return (
    <div className="container">
      <div className="hero">
        <h1 className="hero-title">
          <span className="white">Recourse</span>{' '}
          <span className="gray">Language</span>
        </h1>
        <p className="subtitle">Structured deliberation for formal discourse</p>
      </div>

      <div className="gallery">
        <div className="gallery-title">Examples</div>
        <div className="gallery-grid">
          {EXAMPLES.map(ex => (
            <div
              key={ex.id}
              className={`gallery-item ${activeExample === ex.id ? 'active' : ''}`}
              onClick={() => handleExampleSelect(ex)}
            >
              <div className="gallery-item-title">{ex.title}</div>
              <div className="gallery-item-desc">{ex.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tabs">
        {(['editor', 'graph', 'query', 'analysis', 'mutations', 'docs', 'compare'] as TabType[]).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'editor' && (
        <>
          <div className="editor-container">
            <div className="panel">
              <div className="panel-header">Code</div>
              <div className="code-editor-wrapper">
                <div className="code-highlight-layer">
                  <CodeBlock code={code} showLineNumbers={true} />
                </div>
              
              </div>
            </div>
            <div className="panel">
              <div className="panel-header">Output</div>
              <div className="output">
                {error && <span className="error">✗ {error}</span>}
                {output && <CodeBlock code={output} language="json" />}
                {!error && !output && <span className="placeholder">Click compile to see output...</span>}
              </div>
            </div>
          </div>
          <div className="btn-container">
            <button className="btn" onClick={handleCompile}>Compile</button>
            <button className="btn btn-secondary" onClick={() => handleExampleSelect(EXAMPLES[0])}>Reset</button>
          </div>
          {document && document.claims.length > 0 && (
            <div className="claims-list">
              <h2 className="claims-header">Parsed Claims</h2>
              {document.claims.map((claim) => (
                <div key={claim.id} className="claim-card">
                  <div className="claim-statement">{claim.statement}</div>
                  <div className="claim-meta">
                    {claim.id} · {claim.reasons.length} reasons
                    {claim.tags?.map(tag => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'graph' && (
        <div className="graph-section">
          {!document ? (
            <div className="analysis-card"><div className="analysis-label">Compile code first to see graph</div></div>
          ) : graph && (
            <>
              <div className="graph-legend">
                <span className="legend-item"><span className="dot" style={{background: '#3b82f6'}}></span>CLAIM</span>
                <span className="legend-item"><span className="dot" style={{background: '#ef4444'}}></span>CHALLENGE</span>
                <span className="legend-item"><span className="dot" style={{background: '#22c55e'}}></span>SUPPORT</span>
                <span className="legend-item"><span className="dot" style={{background: '#f59e0b'}}></span>AMEND</span>
                <span className="legend-item"><span className="dot" style={{background: '#a855f7'}}></span>QUESTION</span>
              </div>
              <GraphView nodes={graph.nodes} edges={graph.edges} />
              <div className="graph-stats">
                <span>{graph.nodes.filter(n => n.type === 'claim').length} claims</span>
                <span>{graph.nodes.filter(n => n.type === 'recourse').length} recourses</span>
                <span>{graph.edges.length} connections</span>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'query' && (
        <div className="query-section">
          <div className="btn-container">
            <button className="btn" onClick={runQuery}>Run Query</button>
          </div>
          <div className="query-result">
            {queryResult ? <CodeBlock code={queryResult} language="json" /> : 'Query results will appear here...'}
          </div>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="analysis-section">
          {!document ? (
            <div className="analysis-card"><div className="analysis-label">Compile code first to see analysis</div></div>
          ) : (
            <div className="analysis-grid">
              <div className="analysis-card">
                <div className="analysis-card-title">Overview</div>
                <div className="analysis-stat">{document.claims.length}</div>
                <div className="analysis-label">Claims</div>
                <div style={{ marginTop: '1rem' }}>
                  <span className="analysis-stat" style={{ fontSize: '1.5rem' }}>{document.recourses.length}</span>
                  <span className="analysis-label" style={{ marginLeft: '0.5rem' }}>Recourses</span>
                </div>
              </div>
              <div className="analysis-card">
                <div className="analysis-card-title">Engagement</div>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <div className="analysis-stat" style={{color: '#ef4444'}}>{analysis?.totalChallenges || 0}</div>
                    <div className="analysis-label">Challenges</div>
                  </div>
                  <div>
                    <div className="analysis-stat" style={{color: '#22c55e'}}>{analysis?.totalSupports || 0}</div>
                    <div className="analysis-label">Supports</div>
                  </div>
                  <div>
                    <div className="analysis-stat" style={{color: '#f59e0b'}}>{analysis?.totalAmends || 0}</div>
                    <div className="analysis-label">Amends</div>
                  </div>
                </div>
              </div>
              <div className="analysis-card">
                <div className="analysis-card-title">Evidence Gaps</div>
                {analysis?.gaps && analysis.gaps.length > 0 ? (
                  <ul className="analysis-list">
                    {analysis.gaps.map((gap, i) => <li key={i}>{gap.reasonsWithoutSources} unsourced reason(s)</li>)}
                  </ul>
                ) : <div className="analysis-label">All reasons have sources ✓</div>}
              </div>
              <div className="analysis-card">
                <div className="analysis-card-title">Open Questions</div>
                {analysis?.questions && analysis.questions.length > 0 ? (
                  <ul className="analysis-list">
                    {analysis.questions.flatMap(q => q.questions).map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                ) : <div className="analysis-label">No open questions</div>}
              </div>
            </div>
          )}
        </div>
      )}



         {activeTab === 'docs' && (
        <div className="docs-section">
          <div className="doc-card">
            <h2>Getting Started</h2>
            <p>Recourse Language (RPL) is a formal deliberation language for structured discourse. It treats deliberation as a cycle of <strong>claims</strong> and <strong>structured responses (recourses)</strong>.</p>
            <CodeBlock code={`npm install recourse-lang`} />
          </div>

          <div className="doc-card">
            <h2>Language Grammar</h2>
            <p>RPL uses a JavaScript-like syntax with formal commands for deliberation. Every statement is a typed action with explicit relationships.</p>
            
            <h3>Command Structure</h3>
            <CodeBlock code={`COMMAND claim ("target-or-statement") {
  // Body with structured clauses
}`} />

            <h3>Commands (Action Primitives)</h3>
            <p>RPL provides formal commands that define the type of deliberative action:</p>
            <CodeBlock code={`PROPOSE   // Start a new claim
CHALLENGE // Raise objection to existing claim
SUPPORT   // Endorse claim with additional evidence
AMEND     // Propose modification to claim
QUESTION  // Request clarification
EVIDENCE  // Attach proof
RESPONSE  // Address a challenge
ENDORSE   // Express support position
DISSENT   // Express opposition
STATUS    // Query state
RESOLVE   // Close deliberation`} />

            <h3>Clauses (Statement Components)</h3>
            <p>Inside command blocks, use these clauses to structure your reasoning:</p>
            <CodeBlock code={`because ("reason text")
  // Supporting reason for the claim/recourse
  // Can be nested with sources

sources ["url1", "url2"]
  // Evidence URLs (must follow a because clause)
  // Typed: academic, government, case_study, official_data

tags [tag1, tag2, tag3]
  // Categorization labels for filtering

question ("question text")
  // Structured question (used in CHALLENGE/QUESTION)

propose ("amended statement")
  // New statement (used in AMEND)`} />

            <h3>Complete Grammar</h3>
            <CodeBlock code={`// PROPOSE: Start new claim
PROPOSE claim ("statement") {
  because ("reason") {
    sources ["url"]
  }
  tags [tag1, tag2]
}

// CHALLENGE: Object to claim
CHALLENGE claim ("claim-id") {
  because ("objection")
  question ("clarification?")
}

// SUPPORT: Endorse with evidence
SUPPORT claim ("claim-id") {
  because ("additional evidence") {
    sources ["url"]
  }
}

// AMEND: Propose modification
AMEND claim ("claim-id") {
  propose ("modified statement") {
    because ("rationale for change")
  }
}

// QUESTION: Request clarification
QUESTION claim ("claim-id") {
  question ("What about X?")
  question ("How does Y work?")
}`} />
          </div>

          <div className="doc-card">
            <h2>RPL Philosophy</h2>
            <p>Recourse treats discourse as <strong>procedural law</strong> - not just conversation, but formal acts with traceable consequences.</p>
            
            <h3>Key Principles</h3>
            <CodeBlock code={`1. FORMAL ACTS
   Every contribution is a typed command (PROPOSE, CHALLENGE, etc.)
   Not "I think..." but "PROPOSE claim(...)"

2. EXPLICIT RELATIONSHIPS
   Claims reference other claims by ID
   Graph structure is machine-readable

3. EVIDENCE REQUIRED
   Reasons must cite sources
   Source types are validated (academic, government, etc.)

4. IMMUTABLE RECORD
   Acts cannot be edited, only amended
   Full audit trail with timestamps and authors

5. MINORITY PROTECTION
   Unresolved challenges are preserved
   Dissent is structurally represented`} />

            <h3>RPL vs Natural Language</h3>
            <CodeBlock code={`// Natural Language (ambiguous)
"I disagree because it's too expensive"

// RPL (formal, traceable)
CHALLENGE claim ("claim-001") {
  because ("Initial investment exceeds budget by 40%") {
    sources ["https://budget-report.gov/2024"]
  }
  question ("Has cost-benefit analysis been done?")
}`} />

            <h3>Document Structure</h3>
            <p>RPL compiles to a structured document with queryable graph:</p>
            <CodeBlock code={`{
  "claims": [
    {
      "id": "claim-001",
      "statement": "We should...",
      "reasons": [...],
      "tags": [...],
      "createdAt": "2025-01-14T10:00:00Z",
      "authorId": "user-alice"
    }
  ],
  "recourses": [
    {
      "id": "recourse-001",
      "command": "CHALLENGE",
      "targetClaimId": "claim-001",
      "reasons": [...],
      "questions": [...],
      "createdAt": "2025-01-14T10:30:00Z",
      "authorId": "user-bob"
    }
  ],
  "syntheses": [...],
  "metadata": {
    "title": "Deliberation Title",
    "version": "1.0",
    "participants": ["user-alice", "user-bob"]
  }
}`} />
          </div>

          <div className="doc-card">
            <h2>Core Concepts</h2>
            <h3>Claims</h3>
            <p>A claim is a proposition with supporting reasons and evidence.</p>
            <CodeBlock code={`PROPOSE claim ("Your statement here.") {
  because ("Supporting reason")
  sources ["https://evidence.com"]
  tags [topic1, topic2]
}`} />
            <h3>Recourses</h3>
            <p>Structured responses to claims: CHALLENGE, SUPPORT, AMEND, or QUESTION.</p>
            <CodeBlock code={`CHALLENGE claim ("claim-id") {
  because ("Your objection")
  question ("Clarifying question?")
}

SUPPORT claim ("claim-id") {
  because ("Additional evidence")
  sources ["https://more-evidence.com"]
}

AMEND claim ("claim-id") {
  propose ("Modified statement")
  because ("Why this change")
}`} />
          </div>

          <div className="doc-card">
            <h2>AI Integration</h2>
            <p>Recourse enables AI agents to participate in formal deliberation with full auditability.</p>
            
            <h3>AI as Deliberation Participant</h3>
            <p>AI agents can generate claims, challenges, and amendments using the same formal syntax:</p>
            <CodeBlock code={`// AI analyzes human claim and generates structured challenge
const humanClaim = "AI should be open source by default";

// AI generates formal recourse
const aiChallenge = \`
CHALLENGE claim ("claim-001") {
  because ("Open sourcing advanced models could enable malicious actors.")
  because ("Proprietary models fund research through commercial incentives.")
  sources ["https://security-research.com/ai-risks"]
  question ("How do we balance transparency with security?")
}\`;

// Parse and add to document
const ast = parse(aiChallenge);
const doc = execute(ast, "AI Safety Debate", "ai-agent-001");`} />

            <h3>AI Analysis & Synthesis</h3>
            <p>AI can analyze deliberations to identify patterns, gaps, and synthesis opportunities:</p>
            <CodeBlock code={`import { 
  findEvidenceGaps, 
  detectContradictions,
  findSynthesisOpportunities 
} from 'recourse-lang';

// AI identifies missing evidence
const gaps = findEvidenceGaps(document);
// AI suggests: "Claim X needs sources for reason Y"

// AI detects logical conflicts
const conflicts = detectContradictions(document);
// AI highlights: "Claim A and Claim B have mutual challenges"

// AI proposes synthesis
const opportunities = findSynthesisOpportunities(document);
// AI suggests: "Claims with challenges + amendments can be synthesized"`} />

            <h3>AI-Generated Evidence Summaries</h3>
            <p>AI can fetch and summarize evidence, then format it as formal recourses:</p>
            <CodeBlock code={`// AI retrieves research and generates support
async function aiGenerateSupport(claimId, topic) {
  const research = await fetchResearch(topic);
  const summary = await aiSummarize(research);
  
  return \`
SUPPORT claim ("\${claimId}") {
  because ("\${summary.finding}")
  sources ["\${research.url}"]
}\`;
}

// AI adds structured support with citations
const support = await aiGenerateSupport("claim-001", "bike sharing");
const doc = execute(parse(support), "Research Bot", "ai-researcher");`} />

            <h3>Hybrid Human-AI Deliberation</h3>
            <p>Combine human judgment with AI analysis in a traceable workflow:</p>
            <CodeBlock code={`// 1. Human proposes claim
PROPOSE claim ("Universal basic income should be implemented.") {
  because ("Automation will displace millions of jobs.")
  tags [economics, policy, automation]
}

// 2. AI analyzes and generates questions
CHALLENGE claim ("claim-ubi-001") {
  question ("What income level would be considered 'basic'?")
  question ("How would this be funded without causing inflation?")
  question ("What evidence exists from pilot programs?")
}

// 3. Human responds with evidence
SUPPORT claim ("claim-ubi-001") {
  because ("Finland's 2017-2018 pilot showed improved wellbeing.")
  sources ["https://kela.fi/ubi-experiment"]
}

// 4. AI synthesizes into amendment
AMEND claim ("claim-ubi-001") {
  propose ("Implement tiered UBI pilot in regions with high automation displacement.")
  because ("Pilot approach addresses funding concerns while testing effectiveness.")
  because ("Regional targeting allows comparison with control areas.")
}`} />

            <h3>Auditability & Attribution</h3>
            <p>Every AI contribution is traceable with author IDs and timestamps:</p>
            <CodeBlock code={`{
  "id": "recourse-ai-001",
  "command": "CHALLENGE",
  "targetClaimId": "claim-001",
  "reasons": [...],
  "authorId": "ai-agent-gpt4",
  "createdAt": "2025-01-14T10:30:00Z"
}

// Query AI contributions
const aiContributions = document.recourses.filter(
  r => r.authorId?.startsWith('ai-')
);

// Audit trail shows: who (human/AI), what (action), when (timestamp)`} />
          </div>

          <div className="doc-card">
            <h2>API Reference</h2>
            <h3>Parsing & Execution</h3>
            <CodeBlock code={`import { parse, execute, serializeToRSC } from 'recourse-lang';

const ast = parse(code);
const document = execute(ast, "Title", "author-id");
const json = serializeToRSC(document);`} />
            <h3>Querying</h3>
            <CodeBlock code={`import { executeQuery, buildQuery } from 'recourse-lang';

const result = executeQuery(document, [
  buildQuery('claims', { tag: 'environment' }, [
    buildQuery('id'),
    buildQuery('statement'),
    buildQuery('challengeCount'),
  ])
]);`} />
            <h3>Analysis</h3>
            <CodeBlock code={`import {
  findEvidenceGaps,
  detectContradictions,
  getAllQuestions,
  getChallengeCount,
  getSupportCount,
  toGraph
} from 'recourse-lang';`} />
          </div>
        </div>
      )}

      {activeTab === 'mutations' && (
        <div className="mutations-section">
          <div className="mutation-tabs">
            {MUTATION_EXAMPLES.map(ex => (
              <button
                key={ex.id}
                className={`mutation-tab ${activeMutationExample === ex.id ? 'active' : ''}`}
                onClick={() => setActiveMutationExample(ex.id)}
              >
                {ex.title}
              </button>
            ))}
          </div>
          <div className="analysis-card">
            <CodeBlock code={MUTATION_EXAMPLES.find(e => e.id === activeMutationExample)?.code || ''} />
          </div>
          <div className="analysis-card" style={{ marginTop: '1rem' }}>
            <div className="analysis-card-title">Try It</div>
            <input
              className="mutation-input"
              value={newClaimText}
              onChange={(e) => setNewClaimText(e.target.value)}
              placeholder="Enter claim statement..."
            />
            <input
              className="mutation-input"
              value={newReasonText}
              onChange={(e) => setNewReasonText(e.target.value)}
              placeholder="Enter reason (optional)..."
              style={{ marginTop: '0.5rem' }}
            />
            <button className="btn" style={{ marginTop: '1rem' }} onClick={handleAddClaim}>Add Claim</button>
          </div>
          {document && (
            <div className="analysis-card" style={{ marginTop: '1rem' }}>
              <div className="analysis-card-title">Current Document</div>
              <CodeBlock code={serializeToRSC(document)} language="json" />
            </div>
          )}
        </div>
      )}

   

      {activeTab === 'compare' && (
        <div className="compare-section">
          <div className="doc-card">
            <h2>Recourse vs Polis vs Discourse Graph</h2>
            <p>How does Recourse compare to other deliberation tools?</p>
          </div>

          <div className="compare-table-wrapper">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Polis</th>
                  <th>Discourse Graph</th>
                  <th className="highlight">Recourse</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Core Goal</td>
                  <td>Cluster & visualize opinions</td>
                  <td>Map knowledge connections</td>
                  <td className="highlight">Formal deliberation protocol</td>
                </tr>
                <tr>
                  <td>Philosophy</td>
                  <td>Descriptive: what people think</td>
                  <td>Connective: how ideas relate</td>
                  <td className="highlight">Normative: how to reason</td>
                </tr>
                <tr>
                  <td>Statement Type</td>
                  <td>Free-form text</td>
                  <td>Nodes with links</td>
                  <td className="highlight">Typed claims with syntax</td>
                </tr>
                <tr>
                  <td>Responses</td>
                  <td>Agree / Disagree / Pass</td>
                  <td>Link types</td>
                  <td className="highlight">CHALLENGE / SUPPORT / AMEND</td>
                </tr>
                <tr>
                  <td>Evidence</td>
                  <td>Optional</td>
                  <td>Links to sources</td>
                  <td className="highlight">Required with typed sources</td>
                </tr>
                <tr>
                  <td>Auditability</td>
                  <td>Cluster visualization</td>
                  <td>Graph traversal</td>
                  <td className="highlight">Full trace, minority reports</td>
                </tr>
                <tr>
                  <td>Output</td>
                  <td>Opinion clusters</td>
                  <td>Knowledge graph</td>
                  <td className="highlight">Auditable .rsc documents</td>
                </tr>
                <tr>
                  <td>Best For</td>
                  <td>Surveys, public input</td>
                  <td>Research, wikis</td>
                  <td className="highlight">Policy, governance, formal debate</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="doc-card">
            <h2>Key Difference</h2>
            <div className="compare-cards">
              <div className="compare-card polis">
                <h3>Polis</h3>
                <p>"What are people thinking?"</p>
                <ul>
                  <li>Descriptive</li>
                  <li>Emergent patterns</li>
                  <li>Visual clusters</li>
                </ul>
              </div>
              <div className="compare-card discourse">
                <h3>Discourse Graph</h3>
                <p>"How do ideas connect?"</p>
                <ul>
                  <li>Relational</li>
                  <li>Knowledge mapping</li>
                  <li>Flexible structure</li>
                </ul>
              </div>
              <div className="compare-card recourse">
                <h3>Recourse</h3>
                <p>"How must people reason?"</p>
                <ul>
                  <li>Prescriptive</li>
                  <li>Constrained acts</li>
                  <li>Auditable protocol</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="doc-card">
            <h2>Command Mapping</h2>
            <CodeBlock code={`// Polis Statement → Recourse Claim
"We should have more bike lanes"  →  PROPOSE claim ("We should have more bike lanes.")

// Polis Agree → Recourse Support  
[Agree button]  →  SUPPORT claim ("claim-id") { because ("I agree because...") }

// Polis Disagree → Recourse Challenge
[Disagree button]  →  CHALLENGE claim ("claim-id") { because ("I disagree because...") }

// No Polis equivalent → Recourse Amend
N/A  →  AMEND claim ("claim-id") { propose ("Modified version...") }`} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
