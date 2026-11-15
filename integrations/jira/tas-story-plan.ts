/**
 * Jira (TAS project) story plan: user stories for every executed TestPilot PW suite.
 *
 * Each story AC maps to:
 *   - tpRefs: the framework AC refs whose executed `verifyAC` steps prove it (empty → test-level result is used)
 *   - testCases: approved test cases from data/test-cases/catalogue.json
 *   - projects (optional): restrict evidence to specific Playwright projects (e.g. firefox)
 * Results are always computed from reports/coverage/ac-coverage.json — never typed in by hand.
 */
import type { AcRef } from '../../utils/traceability.ts';

export interface PlanAC {
  id: string;
  text: string;
  tpRefs: AcRef[];
  testCases: string[];
  projects?: string[];
}

export interface PlanStory {
  id: string; // S01 … — stable key used for idempotent sync (label tpw-key-S01)
  summary: string;
  priority: 'High' | 'Medium' | 'Low';
  asA: string;
  iWant: string;
  soThat: string;
  context: string;
  acs: PlanAC[];
  notes?: string[];
}

export const EPIC = {
  id: 'EPIC',
  summary: 'TestPilot PW — automated quality for TaskPilot',
  description:
    'Umbrella epic for the TestPilot PW automation framework (Playwright + TypeScript). It groups the user stories for every ' +
    'executed test suite (API, UI, hybrid, cross-browser, codegen and demo) and their linked test cases. Execution evidence ' +
    'is attached to each story and test case from real runs only.',
};

const UI_AND_HYBRID = [
  'TC-UI-001', 'TC-UI-002', 'TC-UI-010', 'TC-UI-011', 'TC-UI-012', 'TC-UI-020', 'TC-UI-021', 'TC-UI-022', 'TC-UI-023',
  'TC-UI-030', 'TC-UI-031', 'TC-UI-050', 'TC-UI-051', 'TC-UI-060', 'TC-UI-061',
  'TC-HYB-001', 'TC-HYB-002', 'TC-HYB-003', 'TC-HYB-004', 'TC-HYB-005',
];

export const STORIES: PlanStory[] = [
  {
    id: 'S01', summary: 'Create a new task', priority: 'High',
    asA: 'team member', iWant: 'to create a task with a title and optional details', soThat: 'I can capture work that needs to be done',
    context: 'Covers task creation through the Create task dialog and the POST /api/v1/tasks endpoint.',
    acs: [
      { id: 'AC1', text: 'Given a valid title, when I create a task, then it is saved with a unique id, status "pending" and priority "medium" unless I choose otherwise.', tpRefs: ['TP-101:AC1'], testCases: ['TC-API-010', 'TC-HYB-002'] },
      { id: 'AC2', text: 'Description, status, priority and due date that I enter are saved exactly as entered.', tpRefs: ['TP-101:AC3'], testCases: ['TC-API-011', 'TC-UI-010', 'TC-HYB-002'] },
      { id: 'AC3', text: 'A newly created task immediately appears in the task list; cancelling the dialog creates nothing.', tpRefs: ['TP-101:AC4'], testCases: ['TC-UI-010', 'TC-UI-012', 'TC-HYB-001'] },
    ],
  },
  {
    id: 'S02', summary: 'Validate task input', priority: 'High',
    asA: 'team member', iWant: 'invalid task data to be rejected with a clear message', soThat: 'the task list never contains broken records',
    context: 'Validation rules from the OpenAPI contract: title 1–120 characters (not whitespace-only), description ≤ 2000 characters, enum status/priority, ISO due date.',
    acs: [
      { id: 'AC1', text: 'Titles of 1 and 120 characters are accepted; 121 characters, missing, empty, null or whitespace-only titles are rejected with HTTP 422 and no task is created.', tpRefs: ['TP-101:AC2'], testCases: ['TC-API-012', 'TC-API-013'] },
      { id: 'AC2', text: 'In the UI, submitting a whitespace-only title keeps the dialog open and shows a title validation message.', tpRefs: ['TP-101:AC2'], testCases: ['TC-UI-011'] },
      { id: 'AC3', text: 'A description of 2000 characters is accepted and 2001 is rejected; unknown status, unknown priority and malformed due dates are rejected.', tpRefs: ['TP-101:AC3'], testCases: ['TC-API-014', 'TC-API-015'] },
    ],
  },
  {
    id: 'S03', summary: 'Search tasks', priority: 'High',
    asA: 'team member', iWant: 'to search tasks by text', soThat: 'I can quickly find the work I care about',
    context: 'Search box on /tasks and the `search` query parameter of GET /api/v1/tasks.',
    acs: [
      { id: 'AC1', text: 'Searching returns only tasks whose title or description contains the search text.', tpRefs: ['TP-102:AC1'], testCases: ['TC-API-022', 'TC-UI-020'] },
      { id: 'AC2', text: 'When nothing matches, the "No matching tasks" empty state with a hint is shown and the table is hidden.', tpRefs: ['TP-102:AC3'], testCases: ['TC-UI-022'] },
    ],
  },
  {
    id: 'S04', summary: 'Filter and paginate the task list', priority: 'Medium',
    asA: 'team member', iWant: 'to filter tasks by status and page through long lists', soThat: 'the list stays focused and fast',
    context: 'Status filter and pagination on /tasks; `status`, `limit` and `offset` parameters of GET /api/v1/tasks.',
    acs: [
      { id: 'AC1', text: 'Filtering by a status lists only tasks with that status.', tpRefs: ['TP-102:AC2'], testCases: ['TC-API-023', 'TC-UI-021'] },
      { id: 'AC2', text: 'Page size must be between 1 and 100 (0 and 101 are rejected); offset paging returns every task exactly once; the UI shows "Showing x–y of n tasks" with working page controls.', tpRefs: ['TP-102:AC4'], testCases: ['TC-API-024', 'TC-API-025', 'TC-UI-023'] },
    ],
  },
  {
    id: 'S05', summary: 'View task details', priority: 'High',
    asA: 'team member', iWant: 'to open a task and see all of its information', soThat: 'I understand the work before acting on it',
    context: 'Route /tasks/:taskId and GET /api/v1/tasks/{id}.',
    acs: [
      { id: 'AC1', text: 'The details page and API show title, description, status, priority, due date, id and created/updated timestamps.', tpRefs: ['TP-102:AC5'], testCases: ['TC-API-020', 'TC-UI-050'] },
      { id: 'AC2', text: 'An unknown task id returns 404 not_found (malformed ids 422) and the UI shows "Task not found" without task details.', tpRefs: ['TP-102:AC5'], testCases: ['TC-API-021', 'TC-UI-051'] },
    ],
  },
  {
    id: 'S06', summary: 'Edit task details', priority: 'High',
    asA: 'team member', iWant: 'to edit the title, description, priority and due date of a task', soThat: 'tasks stay accurate as work evolves',
    context: 'Edit task dialog and PATCH /api/v1/tasks/{id}.',
    acs: [
      { id: 'AC1', text: 'Edited title, description, priority and due date are saved, shown in the list and returned by the API.', tpRefs: ['TP-103:AC1'], testCases: ['TC-API-030', 'TC-UI-030'] },
      { id: 'AC2', text: 'Every successful update refreshes updated_at while created_at stays unchanged.', tpRefs: ['TP-103:AC4'], testCases: ['TC-API-030'] },
    ],
  },
  {
    id: 'S07', summary: 'Track progress with task status', priority: 'High',
    asA: 'team member', iWant: 'to move tasks between pending, in progress and completed', soThat: 'everyone sees the real state of work',
    context: 'Status selects in the task list and on the details page; completion is PATCH {status: "completed"}.',
    acs: [
      { id: 'AC1', text: 'Status can move through pending → in_progress → completed → pending and each change is persisted.', tpRefs: ['TP-103:AC2'], testCases: ['TC-API-031'] },
      { id: 'AC2', text: 'Changing the status on the details page or in the list is saved and displayed (completion in the UI is reflected in the API).', tpRefs: ['TP-103:AC2'], testCases: ['TC-UI-031', 'TC-HYB-004'] },
      { id: 'AC3', text: 'A status changed through the API is displayed in the UI.', tpRefs: ['TP-103:AC2'], testCases: ['TC-HYB-003'] },
    ],
  },
  {
    id: 'S08', summary: 'Reject invalid task updates', priority: 'Medium',
    asA: 'team member', iWant: 'invalid edits to be refused', soThat: 'existing tasks are never corrupted',
    context: 'Negative paths of PATCH /api/v1/tasks/{id}.',
    acs: [
      { id: 'AC1', text: 'Updates with an empty title, a title over 120 characters, an unknown status or an unknown priority return 422 and the task is unchanged.', tpRefs: ['TP-103:AC3'], testCases: ['TC-API-032'] },
      { id: 'AC2', text: 'Updating a task that does not exist returns 404 not_found.', tpRefs: ['TP-103:AC3'], testCases: ['TC-API-033'] },
    ],
  },
  {
    id: 'S09', summary: 'Delete a task', priority: 'High',
    asA: 'team member', iWant: 'to delete tasks that are no longer needed, with confirmation', soThat: 'the list stays relevant without accidental loss',
    context: 'Row/detail delete actions (native confirmation dialog) and DELETE /api/v1/tasks/{id}.',
    acs: [
      { id: 'AC1', text: 'Deleting asks for confirmation naming the task; cancelling keeps the task.', tpRefs: ['TP-104:AC1'], testCases: ['TC-HYB-005'] },
      { id: 'AC2', text: 'After confirmation the task disappears from the list and GET returns 404.', tpRefs: ['TP-104:AC2'], testCases: ['TC-API-040', 'TC-HYB-005'] },
      { id: 'AC3', text: 'Deleting a non-existent or already deleted task returns 404 not_found.', tpRefs: ['TP-104:AC3'], testCases: ['TC-API-041', 'TC-API-042'] },
    ],
  },
  {
    id: 'S10', summary: 'Dashboard overview metrics', priority: 'Medium',
    asA: 'team lead', iWant: 'a dashboard with task counts per status', soThat: 'I understand progress at a glance',
    context: 'Dashboard metric cards and GET /api/v1/dashboard/summary.',
    acs: [
      { id: 'AC1', text: 'The summary is internally consistent (pending + in progress + completed = total = sum by priority) and each metric card shows the value returned by the API.', tpRefs: ['TP-105:AC1'], testCases: ['TC-API-050', 'TC-UI-001'] },
      { id: 'AC2', text: 'The dashboard loads fast and is user-friendly.', tpRefs: ['TP-105:AC3'], testCases: ['TC-MAN-001'] },
    ],
    notes: ['AC2 is ambiguous ("fast", "user-friendly") and is NOT automated. Product Owner: please define a measurable target (e.g. metrics visible within 2 s on a warm server).'],
  },
  {
    id: 'S11', summary: 'Recent activity on the dashboard', priority: 'Low',
    asA: 'team lead', iWant: 'to see the most recently updated tasks', soThat: 'I can follow what changed',
    context: 'Recent activity list on the dashboard (recent_activity in the summary API).',
    acs: [
      { id: 'AC1', text: 'A recently updated task is listed under Recent activity (newest first) and its link opens the task details.', tpRefs: ['TP-105:AC2'], testCases: ['TC-API-051', 'TC-UI-002'] },
    ],
  },
  {
    id: 'S12', summary: 'Loading and error feedback', priority: 'Medium',
    asA: 'user', iWant: 'clear feedback while data loads and when the service is unavailable', soThat: 'I am never left looking at a blank screen',
    context: 'Loading indicator and error state with retry on /tasks, verified with network interception.',
    acs: [
      { id: 'AC1', text: 'While tasks are loading, a "Loading tasks…" indicator is shown and is replaced by the table.', tpRefs: ['TP-106:AC1'], testCases: ['TC-UI-060'] },
      { id: 'AC2', text: 'When the API cannot be reached, "Unable to connect to the TaskPilot API." and a "Try again" action are shown; retry recovers once the API is back.', tpRefs: ['TP-106:AC2'], testCases: ['TC-UI-061', 'TC-UI-051'] },
    ],
  },
  {
    id: 'S13', summary: 'API service health and contract', priority: 'High',
    asA: 'API consumer', iWant: 'a health endpoint and responses that match the documented schemas', soThat: 'integrations can rely on the contract',
    context: 'GET /health plus JSON-schema validation (Ajv) applied by every API test. Contract deviations are documented in docs/api-contract-findings.md.',
    acs: [
      { id: 'AC1', text: 'GET /health returns 200 with {"status":"ok"}.', tpRefs: [], testCases: ['TC-API-001'] },
      { id: 'AC2', text: 'Task, task list, dashboard summary and error responses validate against their JSON schemas.', tpRefs: [], testCases: ['TC-API-010', 'TC-API-020', 'TC-API-022', 'TC-API-050', 'TC-API-013', 'TC-API-021'] },
    ],
    notes: ['Known deviation: the live error envelope {"error":{code,message,details}} differs from the OpenAPI HTTPValidationError {detail:[...]}; 404 responses are undocumented.'],
  },
  {
    id: 'S14', summary: 'UI and API stay consistent', priority: 'High',
    asA: 'team member', iWant: 'what I see in the UI to always match what the system stores', soThat: 'I can trust the application',
    context: 'Hybrid scenarios A–E: arrange through one channel, act through another, verify through the other.',
    acs: [
      { id: 'AC1', text: 'A: a task created via the API appears in the UI.', tpRefs: ['TP-101:AC4'], testCases: ['TC-HYB-001'] },
      { id: 'AC2', text: 'B: a task created in the UI exists in the API with the entered values.', tpRefs: ['TP-101:AC1', 'TP-101:AC3'], testCases: ['TC-HYB-002'] },
      { id: 'AC3', text: 'C/D: status changes made in one channel are visible in the other.', tpRefs: ['TP-103:AC2'], testCases: ['TC-HYB-003', 'TC-HYB-004'] },
      { id: 'AC4', text: 'E: a deleted task is no longer available in the UI or the API.', tpRefs: ['TP-104:AC2'], testCases: ['TC-HYB-005'] },
    ],
  },
  {
    id: 'S15', summary: 'Cross-browser support', priority: 'Medium',
    asA: 'user', iWant: 'TaskPilot to work in Chrome, Firefox and Safari engines', soThat: 'I can use my preferred browser',
    context: 'The same UI and hybrid suites executed on Chromium, Firefox and WebKit projects.',
    acs: [
      { id: 'AC1', text: 'All UI and hybrid test cases pass on Chromium.', tpRefs: [], testCases: UI_AND_HYBRID, projects: ['chromium'] },
      { id: 'AC2', text: 'All UI and hybrid test cases pass on Firefox.', tpRefs: [], testCases: UI_AND_HYBRID, projects: ['firefox'] },
      { id: 'AC3', text: 'All UI and hybrid test cases pass on WebKit (Safari engine).', tpRefs: [], testCases: UI_AND_HYBRID, projects: ['webkit'] },
    ],
  },
  {
    id: 'S16', summary: 'Record-and-refactor test authoring with Codegen and demo data', priority: 'Low',
    asA: 'test automation engineer', iWant: 'to record flows with Playwright Codegen and turn them into maintainable tests', soThat: 'new UI coverage can be added quickly without sacrificing quality',
    context: 'Codegen recording refactored into page objects (TC-CG-001) and the opt-in headed demo that creates persistent TPW-DEMO tasks through the UI (TC-DEMO-001).',
    acs: [
      { id: 'AC1', text: 'The refactored Codegen test creates a task through page objects, finds it in the list and shows its details.', tpRefs: ['TP-101:AC4', 'TP-102:AC5'], testCases: ['TC-CG-001'] },
      { id: 'AC2', text: 'The headed demo creates three persistent TPW-DEMO tasks through the UI that are visible in the list and the API.', tpRefs: ['TP-101:AC4'], testCases: ['TC-DEMO-001'] },
    ],
    notes: ['TC-DEMO-001 is opt-in (npm run demo:create-tasks) and is not part of the evidence run; it was executed headed on 2026-11-15 15:17 UTC (3/3 passed).'],
  },
];
