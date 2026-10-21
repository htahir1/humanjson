# Changelog

## 0.4

- The project is human.json (humanjson.org); the file is `human.json`, found at
  `/.well-known/human.json`, media type `application/human+json`, spec string `human.json/0.4`.
- `open_to` entries can list `topics`; a new `topic` check declines requests on other topics.
- `agent_policy.feedback.url`: agents post a short structured note after deciding.
- Files with `hellohuman/`, `approach/` and `open-hire/` spec strings are still read.
- Optional `photo`: an https URL to a picture of the person (for example a GitHub avatar).

## 0.3

- No longer only about jobs: `open_to` lists everything the person is open to (jobs, freelance,
  advising, speaking, intros, ...), each with its own conditions; `not_open_to` lists what agents
  decline without asking. v0.2 files with one `looking_for` block still read as a single `job` entry.

## 0.2

- One file instead of a separate `llms.txt`; discovery at `/.well-known/`; a JSON Schema, a validation
  API and free hosting.
