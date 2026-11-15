---
name: jira-story-reader
description: Retrieve a Jira story by key (connected or fixture mode) and normalize it into structured requirements with acceptance criteria.
---
# Jira Story Reader

## Purpose
Turn a Jira issue key into a normalized, machine-readable story (user story, ACs with ids, notes, findings) that every downstream step uses.

## When to use
- Starting work on a new story ("automate TP-107").
- Re-syncing after the story changed in Jira.
- Teaching the difference between fixture mode and connected mode.

## Required inputs
- Issue key matching `^[A-Z][A-Z0-9]+-\d+$`.
- Mode: `fixture` (default, `data/jira/<KEY>.json`) or `connected` (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`).

## Step-by-step workflow
1. Run `npm run jira:read -- <KEY>` (add `--mode connected` only when credentials exist).
2. The reader fetches the issue (`integrations/jira/story-reader.ts → fetchIssue`). Connected mode calls `GET /rest/api/3/issue/{key}`.
3. ADF description is converted to text (`adf.ts → adfToText`).
4. Sections are split by headings: *User story*, *Acceptance Criteria*, *Notes*.
5. AC bullets become `{ id: 'AC1', ref: 'TP-101:AC1', text }`; un-numbered bullets get sequential ids.
6. `requirements-analyzer.ts` attaches findings (see `requirements-analysis` skill).
7. Output printed and cached to `generated/stories/<KEY>.json`.
8. For a new fixture, copy the JSON shape of `data/jira/TP-101.json` (Jira REST v3 issue format).

## Rules and constraints
- Never require Jira connectivity for test execution.
- Never print credentials or full HTTP requests.
- Do not "fix" the story silently — ambiguities are reported, not rewritten.
- Only connected-mode snapshots override fixtures in the coverage registry.

## Expected outputs
- Console summary with ACs and findings.
- `generated/stories/<KEY>.json` (NormalizedStory).

## Verification checklist
- [ ] Every AC has a unique `ref` (`KEY:ACn`).
- [ ] AC count equals the bullets in Jira.
- [ ] Findings reviewed and blockers resolved before test design.
- [ ] Connected mode tried only with credentials; failure message contains no secrets.
