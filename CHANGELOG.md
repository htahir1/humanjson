# Changelog

## 0.5

- `languages`: the languages to write in, most preferred first (BCP 47 tags, optional level).
- `availability`: `booking_url` (offered only to a request that passes every check), `away_until`
  (no replies or follow-ups before that date) and a short `note`.
- `identities`: the person's other accounts. Agents treat one as the same person only if that page
  links back to the file or the person's human.json page.
- Optional `photo` (an https URL).
- v0.4 files stay valid.

## 0.4

- The project is human.json (humanjson.org); the file is `human.json`, found at
  `/.well-known/human.json`, media type `application/human+json`, spec string `human.json/0.4`.
- `open_to` entries can list `topics`; a new `topic` check declines requests on other topics.
- `agent_policy.feedback.url`: agents post a short structured note after deciding.
- Files with `hellohuman/`, `approach/` and `open-hire/` spec strings are still read.

## 0.3

- No longer only about jobs: `open_to` lists everything the person is open to (jobs, freelance,
  advising, speaking, intros, ...), each with its own conditions; `not_open_to` lists what agents
  decline without asking. v0.2 files with one `looking_for` block still read as a single `job` entry.

## 0.2

- One file instead of a separate `llms.txt`; discovery at `/.well-known/`; a JSON Schema, a validation
  API and free hosting.
