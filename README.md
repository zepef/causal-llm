# DEMOCRITUS - Large Causal Models from LLMs

A Next.js implementation of the DEMOCRITUS framework for extracting causal knowledge from Large Language Models and building Large Causal Models (LCMs).

## Overview

DEMOCRITUS extracts structured causal knowledge from LLMs through a multi-stage pipeline, building directed graphs where nodes represent concepts and edges represent causal relations. The framework includes a Geometric Transformer that processes higher-order causal structures (edges and triangles) to refine concept embeddings.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEMOCRITUS Pipeline                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │  Topic   │ → │ Question │ → │Statement │ → │  Triple  │     │
│  │  Graph   │   │Generation│   │Generation│   │Extraction│     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       ↓                                             ↓           │
│  BFS Expansion                              Causal Graph        │
│  via Claude API                             (Nodes + Edges)     │
│                                                     ↓           │
│                                          ┌──────────────────┐   │
│                                          │    Geometric     │   │
│                                          │   Transformer    │   │
│                                          │  (TensorFlow.js) │   │
│                                          └──────────────────┘   │
│                                                     ↓           │
│                                          ┌──────────────────┐   │
│                                          │  UMAP Projection │   │
│                                          │   (3D Manifold)  │   │
│                                          └──────────────────┘   │
│                                                     ↓           │
│                                          ┌──────────────────┐   │
│                                          │ 3D Visualization │   │
│                                          │(react-force-graph)│  │
│                                          └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 6 DEMOCRITUS Modules

| Module | Description | Route |
|--------|-------------|-------|
| **Topic Graph** | BFS expansion of topics via LLM | `/topics` |
| **Causal Questions** | Generate causal questions from topics | `/questions` |
| **Causal Statements** | Generate causal statements from questions | `/statements` |
| **Relational Triples** | Extract (Subject, Relation, Object) triples | `/triples` |
| **Relational Manifold** | 3D UMAP visualization of embeddings | `/manifold` |
| **Topos Slices** | Domain-specific causal subgraphs | `/topos` |

### Geometric Transformer

Processes higher-order causal structures using simplicial complexes:

- **0-simplices (vertices)**: Individual concepts
- **1-simplices (edges)**: Causal relations between concepts
- **2-simplices (triangles)**: Triadic causal motifs (A→B→C→A)

The transformer uses multi-head attention to aggregate structural information back into node embeddings.

### Relation Types

```
causes          → Direct causation
enables         → Prerequisite relationship
prevents        → Inhibitory causation
increases       → Positive modulation
decreases       → Negative modulation
correlates_with → Statistical association
requires        → Dependency
produces        → Output relationship
inhibits        → Suppression
```

## Tech Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **LLM**: Claude API via `@anthropic-ai/sdk`
- **Database**: SQLite via Prisma
- **State**: Zustand
- **ML**: TensorFlow.js
- **Visualization**: react-force-graph-3d + Three.js
- **Dimensionality Reduction**: umap-js

## Project Structure

```
causal-llm/
├── app/
│   ├── (dashboard)/          # Main app routes
│   │   ├── manifold/         # 3D UMAP visualization
│   │   ├── topics/           # Topic explorer
│   │   ├── questions/        # Question generation
│   │   ├── statements/       # Statement generation
│   │   ├── triples/          # Triple extraction
│   │   └── topos/            # Domain slices
│   └── api/
│       ├── llm/              # Claude API endpoints
│       └── embeddings/       # Transformer + UMAP
├── components/
│   ├── manifold/             # 3D visualization components
│   ├── graph/                # Graph components
│   └── ui/                   # Base UI components
├── lib/
│   ├── llm/                  # Anthropic client + prompts
│   ├── graph/                # CausalGraph class
│   ├── embeddings/           # Geometric Transformer
│   │   ├── transformer.ts    # TensorFlow.js transformer
│   │   ├── umap.ts           # UMAP wrapper
│   │   └── simplicial/       # Complex builder
│   └── topos/                # Topos slice manager
├── stores/                   # Zustand stores
├── hooks/                    # Custom React hooks
├── types/                    # TypeScript definitions
└── prisma/                   # Database schema
```

## Getting Started

### Prerequisites

- Node.js 18+
- Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="sk-ant-..."
```

## Key Components

### CausalGraph (`lib/graph/CausalGraph.ts`)

Core graph data structure with:
- Adjacency list representation
- Triangle detection for simplicial complex
- Graph metrics (degree, density, clustering)
- Domain-based subgraph extraction

```typescript
const graph = new CausalGraph();
graph.addNode({ id: 'concept-1', label: 'Climate', type: 'concept', domain: 'climate' });
graph.addEdge({ id: 'edge-1', source: 'concept-1', target: 'concept-2', relationType: 'causes' });

const triangles = graph.findTriangles();
const complex = graph.toSimplicialComplex();
```

### GeometricTransformer (`lib/embeddings/transformer.ts`)

TensorFlow.js implementation of simplicial attention:

```typescript
const transformer = createGeometricTransformer({
  embeddingDim: 128,
  hiddenDim: 256,
  numHeads: 4,
  numLayers: 2,
});

const refinedEmbeddings = await transformer.processComplex(
  complex,
  nodeEmbeddings,
  (progress, message) => console.log(`${progress}%: ${message}`)
);
```

### SimplicialComplexBuilder (`lib/embeddings/simplicial/complex-builder.ts`)

Computes structural features:
- Edge features: Jaccard coefficient, common neighbors
- Triangle features: transitivity, domain homogeneity
- Graph matrices: adjacency, degree, normalized Laplacian

### Stores

| Store | Purpose |
|-------|---------|
| `graphStore` | Graph nodes, edges, selection, filtering |
| `embeddingStore` | Embeddings, UMAP projections, computation status |
| `pipelineStore` | Pipeline execution state |

## API Endpoints

### LLM Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/llm/topics` | POST | Expand topics via BFS |
| `/api/llm/questions` | POST | Generate causal questions |
| `/api/llm/statements` | POST | Generate causal statements |
| `/api/llm/triples` | POST | Extract relational triples |

### Embedding Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/embeddings/compute` | POST | Refine embeddings via Geometric Transformer |
| `/api/embeddings/compute` | GET | Get transformer configuration |

## Visualization

The Manifold page (`/manifold`) provides:
- 3D WebGL visualization of the causal graph
- UMAP projection of concept embeddings
- Domain-based coloring
- Relation type filtering
- Interactive node selection
- "Refine Embeddings" to run Geometric Transformer

## Development

```bash
# Type check
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## References

- DEMOCRITUS: Large Causal Models from LLMs
- Simplicial Neural Networks
- UMAP: Uniform Manifold Approximation and Projection

## License

MIT
