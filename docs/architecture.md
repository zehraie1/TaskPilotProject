# TestPilot PW — Architecture & Flow Diagrams

All diagrams are Mermaid (render on GitHub, Cursor preview, or https://mermaid.live).
Training infographic: [`diagrams/testpilot-infographic.svg`](diagrams/testpilot-infographic.svg).

## 1. Complete automation architecture

```mermaid
flowchart LR
  subgraph REQ["📋 Requirements"]
    JIRA[(Jira Cloud)]
    FIX[data/jira/*.json<br/>fixture mode]
  end
  subgraph AI["🤖 AI-assisted design"]
    READER[Story Reader] --> ANALYZER[Requirements Analyzer] --> GEN[Test Case Generator]
    GEN --> REVIEW{Human review}
    REVIEW -->|approved| CAT[(catalogue.json)]
  end
  subgraph FW["🎭 Playwright Test runner"]
    direction TB
    FXT[fixtures/test.ts] --> POM[pages/ POM]
    FXT --> CLIENT[clients/ TaskApiClient]
    FXT --> FACT[TaskFactory<br/>unique data + cleanup]
    SPECS[tests/ui · api · hybrid] --> FXT
    SPECS --> TRACE[verifyAC steps]
  end
  subgraph SUT["🧩 TaskPilot (system under test)"]
    UI[React + Vite UI]
    API[FastAPI /api/v1]
    DB[(PostgreSQL)]
    UI --> API --> DB
  end
  subgraph OUT["📊 Evidence & reports"]
    HTML[HTML · JUnit · JSON]
    COV[AC coverage matrix]
    EVD[screenshots · videos · traces · API logs]
  end
  JIRA --> READER
  FIX --> READER
  CAT --> SPECS
  POM --> UI
  CLIENT --> API
  TRACE --> COV
  SPECS --> HTML
  SPECS --> EVD
  COV --> PUB[Jira Evidence Publisher] -->|approved only| JIRA
  OUT --> GHA[GitHub Actions artifacts]
```

## 2. UI automation architecture

```mermaid
flowchart TB
  SPEC["tests/ui/*.spec.ts<br/>trace() + verifyAC()"] --> FX["fixtures/test.ts"]
  FX --> DP[DashboardPage]
  FX --> TP[TasksPage]
  FX --> TD[TaskDetails]
  TP --> TF[TaskForm dialog]
  TD --> TF
  DP & TP & TD --> BP["BasePage<br/>nav · heading · loading · error state"]
  BP --> LOC{{"Locator strategy<br/>1 getByRole · 2 getByLabel · 3 getByTestId · 4 text"}}
  LOC --> BROWSER["Chromium (default)<br/>Firefox / WebKit (opt-in)"]
  SPEC -. arrange data .-> FACT[TaskFactory → API]
  SPEC -. deterministic states .-> ROUTE["page.route()<br/>hold / abort responses"]
  SPEC -. evidence .-> SHOT[stepScreenshot]
```

## 3. API automation architecture

```mermaid
flowchart LR
  SPEC["tests/api/*.api.spec.ts"] --> CLIENT["TaskApiClient<br/>(APIRequestContext)"]
  CLIENT -->|HTTP| API["TaskPilot API<br/>/health · /api/v1/tasks · /dashboard/summary"]
  CLIENT --> LOG["ApiEvidenceLog<br/>sanitized request/response"]
  SPEC --> A1["1 · status code"]
  SPEC --> A2["2 · Ajv schema<br/>schemas/*.schema.json"]
  SPEC --> A3["3 · business values"]
  SPEC --> A4["4 · persistence (GET again)"]
  DATA["test-data.ts<br/>builders · boundaries"] --> SPEC
  LOG -->|on failure / full mode| ATT[api-exchanges.json attachment]
```

## 4. Hybrid test execution

```mermaid
sequenceDiagram
  autonumber
  participant T as Hybrid test
  participant F as TaskFactory
  participant API as TaskPilot API
  participant UI as Browser (POM)
  T->>F: create task (unique TPW title)
  F->>API: POST /api/v1/tasks
  API-->>F: 201 {id}
  T->>UI: open /tasks, search title
  UI->>API: GET /api/v1/tasks?search=…
  T->>UI: change status → Completed
  UI->>API: PATCH /api/v1/tasks/{id}
  T->>T: waitForResponse = 200
  T->>API: GET /api/v1/tasks/{id}
  API-->>T: status = completed ✅ (verifyAC)
  T->>F: teardown
  F->>API: DELETE /api/v1/tasks/{id} (204/404)
```

## 5. Jira story → test case generation

```mermaid
flowchart LR
  K[/"Issue key TP-101"/] --> MODE{JIRA_MODE}
  MODE -->|fixture| FX[data/jira/TP-101.json]
  MODE -->|connected| REST["GET /rest/api/3/issue/TP-101"]
  FX & REST --> ADF[ADF → text]
  ADF --> NORM["Normalize<br/>user story · AC1..n · notes"]
  NORM --> ANA{"Analyze<br/>missing / ambiguous?"}
  ANA -->|blocker| PO[Ask Product Owner]
  ANA -->|ok / warnings| GEN["Draft cases<br/>positive · negative · boundary<br/>UI · API · Hybrid"]
  GEN --> AI[Cursor skill enrichment]
  AI --> REV{QA review}
  REV -->|approved| CAT[(data/test-cases/catalogue.json)]
  REV -->|rejected| GEN
  CAT --> CODE[Specs with trace + verifyAC]
```

## 6. Evidence capture and reporting

```mermaid
flowchart TB
  RUN[Playwright run] --> MODE{EVIDENCE}
  MODE -->|standard| STD["screenshot: only-on-failure<br/>video: retain-on-failure<br/>trace: on-first-retry"]
  MODE -->|full| FULL["screenshot · video · trace: on<br/>+ step screenshots + API logs"]
  STD & FULL --> TR[test-results/]
  RUN --> REP["Reporters"]
  REP --> H[reports/html]
  REP --> J[reports/junit/results.xml]
  REP --> JS[reports/json/results.json]
  REP --> C["reports/coverage/<br/>ac-coverage.{json,md,html}<br/>execution-summary.md<br/>failure-summary.md"]
  TR -. linked .-> H
  TR -. paths .-> C
```

## 7. Jira publishing workflow

```mermaid
flowchart TB
  START([npm run jira:publish -- TP-101]) --> LOAD[Load reports/coverage/ac-coverage.json]
  LOAD -->|missing| STOP1[Stop: run tests first<br/>never invent results]
  LOAD --> PLAN[Build plan: comment · attachments · CI link · run marker]
  PLAN --> GATE{"--approve AND<br/>JIRA_PUBLISH_ENABLED=true?"}
  GATE -->|no| DRY[Dry run: print preview<br/>write reports/jira/*.dry-run.json]
  GATE -->|yes| ISSUE[Locate story]
  ISSUE --> DUP{Run marker already<br/>in comments?}
  DUP -->|yes| SKIPC[skip comment]
  DUP -->|no| POST[post ADF comment]
  SKIPC & POST --> ATT{Attachment name exists?}
  ATT -->|yes| SKIPA[skip]
  ATT -->|no| UP[upload coverage HTML + ≤3 screenshots]
  SKIPA & UP --> LINK[remote link to CI run<br/>idempotent globalId]
  LINK --> REC[write reports/jira/*.published.json]
```

## 8. GitHub CI execution

```mermaid
flowchart LR
  TRIG["push / PR / nightly / manual"] --> CO[checkout] --> NODE["setup-node 24 + npm cache"] --> CI[npm ci]
  CI --> BR[install Chromium] --> TC[npm run typecheck] --> TEST[playwright test]
  TEST --> SUM[job summary: execution + AC coverage]
  TEST --> ART[upload reports/ always]
  TEST -->|failure| DIAG[failure summary + health probe + upload test-results/]
  ART --> GATE{manual run with<br/>publish_to_jira?}
  GATE -->|no| END([done])
  GATE -->|yes| ENV["environment 'jira'<br/>required reviewers"] --> PUB[jira:publish --all --approve]
```
