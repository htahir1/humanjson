# human.json spec v0.4

human.json is an open format for being approached by AI agents. A person publishes **one file,
`human.json`**, that says what they have done, what they are open to (a job, freelance work, advising,
conversations, ...), what they are not, and the rules agents should follow when approaching them. Any agent, platform or tool can read it; nobody has to hold the
person's data but the person.

- Schema (JSON Schema draft-07): [`schema/human.schema.json`](schema/human.schema.json)
- Skill names agents match on: [`vocabulary.json`](vocabulary.json)
- Reference implementation (rendering, imports, matching): [`core.js`](core.js)
- Instructions for an agent that helps someone write theirs: [`skill/SKILL.md`](skill/SKILL.md)
- Source, issues and proposals: [github.com/htahir1/humanjson](https://github.com/htahir1/humanjson)

Changes in v0.4: the project is now human.json (humanjson.org) and the file is `human.json` (found at
`/.well-known/human.json`, media type `application/human+json`, spec `human.json/0.4`). `open_to` entries
can list `topics`, checked by a new `topic` check. Files using `approach/0.x` or `open-hire/0.x` are still read.

Changes in v0.3: the file is no longer only about jobs. `open_to` lists everything the person is
open to (jobs, freelance work, advising, speaking, ...), each with its own conditions, and
`not_open_to` lists what agents should decline without asking (sales pitches, agency recruiters).
Every request an agent brings has a type and is checked against the matching entry. v0.2 files,
which had a single `looking_for` block, are still valid and read as one `job` entry.

Changes in v0.2: the separate `llms.txt` is gone (it repeated human.json as prose; models read
JSON fine), discovery moved to `/.well-known/human.json`, and there is now a schema, a validation
API and free hosting.

## It's public

A human.json is a public file, like `robots.txt`. Anyone, person or agent, can read all of it.
Two things follow:

- **Put in only what you'd tell a stranger.** It's a "how to approach me" card, not a CV. If you
  wouldn't post your minimum pay, leave it out; agents will ask you instead.
- **Your rules are requests, not locks.** Well-behaved agents follow them, and that's the point of
  writing them down, but nothing stops a bad actor from ignoring them.

## 1. Where agents find it

An agent that knows something about a person looks, in order:

1. **Their own site**: `https://<site>/.well-known/human.json`.
2. **A link from any page they own**: `<link rel="alternate" type="application/human+json" href="...">`.
   If the site already has an `llms.txt`, one line in it pointing to the human.json is enough.
3. **GitHub**: `https://raw.githubusercontent.com/<user>/<user>/HEAD/human.json`, the user's profile
   repository, for agents that only know a GitHub handle.
4. **humanjson.org hosting**: `https://<this-site>/u/<handle>/human.json`.

People can also put the URL anywhere a human-written profile goes: a GitHub bio, an email signature,
the "website" field on LinkedIn.

## 2. Making, checking and publishing one

- **Make it** on this site (import from GitHub, a LinkedIn data export or a JSON Resume, then fill in
  the rest), or have your own agent do it by following [`skill/SKILL.md`](skill/SKILL.md).
- **Check it**: `POST /api/validate` with the file as the body. The answer is
  `{"valid": true, "errors": []}` or a list of errors with JSON paths.
- **Publish it** wherever you like (section 1). human.json hosts it for free:
  `POST /api/publish` with `{"profile": <human.json>}` returns `{handle, url, page, token}`. Keep the
  token: send it again as `{"profile": ..., "token": ...}` to update, or as the `X-Human-Token`
  header on `DELETE /api/publish/<handle>` to remove it. All endpoints allow cross-origin calls.

## 3. The file

```jsonc
{
  "spec": "human.json/0.4",
  "handle": "noor-haddad",
  "name": "Noor Haddad",
  "pronouns": "she/her",                    // optional
  "headline": "ML platform engineer",
  "location": { "city": "Berlin", "country": "DE", "utc_offset": 1 },
  "status": "looking",                      // looking | open | not-looking
  "updated": "2026-10-12",
  "summary": "Two or three sentences in the person's own words.",
  "links": [{ "label": "GitHub", "url": "https://..." }],

  "open_to": [                             // anything not listed here is a no
    {
      "type": "job",                        // job | freelance | advising | cofounder | investing | speaking | intro
      "status": "looking",                  // looking | open | not-looking
      "roles": ["ML platform engineer", "Staff engineer, ML infra"],
      "seniority": "staff",                 // junior | mid | senior | staff | principal | lead | head
      "employment": ["full-time"],          // full-time | part-time | contract
      "work_mode": ["remote", "hybrid"],    // remote | hybrid | onsite
      "locations": ["Berlin"],              // cities for hybrid/onsite
      "relocate": false,
      "max_tz_diff_hours": 3,               // for remote: max distance from the person's utc_offset
      "work_auth": ["EU"],                  // where they can already work; "US", "UK", "EU", "CA", ...
      "needs_sponsorship": false,
      "comp": { "currency": "EUR", "base_min": 115000, "target": 130000,
                "disclose": "public" },     // public | human (leave the number out)
      "start": "2027-01-01",
      "stages": ["series-a", "series-b", "growth"],
      "domains_avoid": ["defense", "gambling"],
      "domains_prefer": ["climate", "health"],
      "max_on_call": "light",               // none | light | heavy
      "deal_breakers": ["Plain sentences for a human; the structured fields are what agents check."]
    },
    {
      "type": "freelance", "status": "open",
      "rate": { "currency": "EUR", "day_min": 700 },
      "max_days_per_week": 3, "min_weeks": 4, "max_weeks": 26, "work_mode": ["remote"]
    },
    {
      "type": "advising", "status": "open",
      "max_hours_per_month": 4, "comp": ["paid", "equity"], "stages": ["seed", "series-a"]
    },
    { "type": "intro", "topics": ["agents in production", "evals"],   // requests on other topics are declined
      "notes": "Bring a real problem." },
    { "type": "speaking", "notes": "Free-text conditions for types without structured fields." }
  ],
  "not_open_to": ["sales", "recruiting_agency"],   // decline these without contacting me

  "skills": [
    { "name": "Kubernetes", "level": 5, "years": 6, "evidence": ["gpu-scheduler"] }
  ],                                        // level 1-5; evidence = project ids
  "projects": [
    { "id": "gpu-scheduler", "title": "...", "year": 2025, "role": "...", "summary": "...",
      "outcome": "...", "stack": ["Kubernetes", "Go"], "link": "https://...",
      "source": "github" }                  // optional: github (checkable) | linkedin | json-resume (self-reported)
  ],
  "experience": [{ "org": "...", "title": "...", "from": "2021", "to": "now", "summary": "..." }],
  "faq": [{ "q": "...", "a": "...", "tags": ["on-call", "management"] }],
  "references": [{ "name": "...", "relation": "...", "quote": "...", "contact": "on request" }],
  "sources": [{ "type": "github", "ref": "https://github.com/...", "imported": "2026-10-20" }],  // optional: where parts came from

  "agent_policy": {
    "intro_requires": ["written_jd", "published_comp", "named_hiring_manager"],
    "auto_decline": true,                   // agents may decline on the person's behalf when a hard check fails
    "escalate": ["equity details", "anything about a manager role"],
    "contact": { "method": "email", "address": "noor@example.com", "subject_prefix": "[human.json]" },
    "response_time": "3 working days",
    "feedback": { "url": "https://.../api/feedback/noor-haddad" },  // optional: tell me why (section 7)
    "notes": "Free text for agents."
  }
}
```

Skill names come from a shared vocabulary ([`vocabulary.json`](vocabulary.json)) so matching is a
string comparison, not a guess.

### Importing

Nobody should have to type this from scratch. The reference app fills a draft from:
- **GitHub** (public API): non-fork repositories become projects with `source: "github"`, so an agent
  can open the link and check them; repository languages become skills, with levels estimated from
  their share of the person's public code.
- **LinkedIn**: LinkedIn doesn't let other sites read profiles, so the import reads the data export
  (Settings & Privacy → Data privacy → Get a copy of your data): Profile, Positions, Skills, Projects
  and Recommendations_Received CSVs.
- **JSON Resume** (`resume.json`, https://jsonresume.org/schema) and existing `human.json` files.

Imports only fill empty fields and add what's missing. Conditions (pay, mode, deal-breakers) are never
imported; only the person sets them.

## 4. Requests

Whoever (or whatever) is approaching describes what they want in the same shape, with a `type`
that names the `open_to` entry it should be checked against. See `/requests.json` for examples of
each.

- `job`: `title, company, stage, domain[], seniority, employment, work_mode, locations[], hire_in[],
  tz_utc_range[min,max], visa_sponsorship, comp{currency, base_min, base_max, equity}, start, on_call,
  must_have[], nice_to_have[], hiring_manager, summary, questions[]`.
- `freelance`: `title, company, domain[], work_mode, tz_utc_range, rate{currency, day_min, day_max},
  days_per_week, weeks, start, must_have[], contact_name, summary, questions[]`.
- `advising`: `title, company, stage, domain[], hours_per_month, comp (paid | equity | none),
  must_have[], contact_name, summary, questions[]`.
- Any other type (`sales`, `investing`, `speaking`, `intro`, ...): `title, company, summary,
  contact_name`. These are checked only against `open_to` / `not_open_to` and the domains.

## 5. Matching

First, the type. If the request's type is in `not_open_to`, or there is no `open_to` entry of that
type, the verdict is **decline**: "not open to sales pitches". Nothing else is checked.

Otherwise, the hard checks for that entry (call it `entry`), each `pass`, `fail` or `unknown`.
For a `job`:

| check | passes when |
|---|---|
| work mode | the job's mode is in `entry.work_mode` |
| place | remote: the person's `utc_offset` is inside the job's `tz_utc_range`, and the middle of that range is within `max_tz_diff_hours` of it; hybrid/onsite: a job city is in `locations`, or `relocate` is true |
| work authorisation | one of `work_auth` is in the job's `hire_in`, or the job sponsors visas (not for remote) |
| pay | `comp.base_max` (converted at fixed rates EUR 1 = USD 1.08 = GBP 0.85) is at least `base_min` |
| employment | the job's employment type is in `entry.employment` |
| stage | the job's stage is in `stages` |
| domain | no job domain is in `domains_avoid` |
| on-call | the job's on-call (none < light < heavy) is at most `max_on_call` |
| start | the job's start date is on or after `entry.start`; an earlier date is `unknown` (ask whether it can move) |

For `freelance`: work mode and place as above, domain, start, plus **rate** (`rate.day_max`, converted,
is at least `entry.rate.day_min`), **days a week** (`days_per_week` ≤ `entry.max_days_per_week`) and
**length** (`weeks` between `entry.min_weeks` and `entry.max_weeks`).

For `advising`: stage, domain, **time** (`hours_per_month` ≤ `entry.max_hours_per_month`) and
**compensation** (`comp` is in `entry.comp`).

For any type except `job` and `freelance`: if the entry has `topics`, **topic** passes when one of
them appears in the request's `topics`, or all of its words appear in the request's title or summary.
Anything else fails: "about crypto; they want to talk about agents in production, evals".

Skill fit (only when the request lists skills): each `must_have` counts 1 and each `nice_to_have` 0.4, scaled by the person's level
(level 5 = 1, level 3 = 0.7, level 1 = 0.35). A skill with at least one evidence project counts
in full; a claimed skill without evidence counts half.

Verdict:
- any `fail` → **decline**. If `auto_decline` is true the agent may say no on the person's behalf,
  citing only the failed check, and must not contact them.
- no fails, pay not unknown, skill fit ≥ 0.6, all `intro_requires` met → **intro**: send one message to
  `agent_policy.contact` with the packet below.
- otherwise → **maybe**: same packet, marked as such, listing what is missing.

Screening questions: each employer question is matched to the person's `faq` by shared words and
tags (a tag counts when all its words appear in the question). A match quotes the person's answer
word for word; anything unmatched goes to the person as an open question. The reference
implementation of everything in this section is [core.js](core.js).

## 6. The intro packet

One message replaces the screening call:

```
Subject: [human.json] <job title> at <company> — <verdict>
Role, company, hiring manager, comp band, start, mode, place.
Checks: every hard check and its result.
Fit: each must-have skill, the person's level and the project that proves it.
Answered from your FAQ: the employer's questions with the person's own answers quoted.
Open questions for you: employer questions the FAQ doesn't cover, and anything in `escalate`.
```

Pay: the file is public, so a minimum in it is public too. Agents may say whether a band reaches it.
If the person left the number out (`disclose: "human"`), the pay check is `unknown` and the message
asks. `on-match` from earlier versions is read as `public`; it never kept anything private.

## 7. Feedback

If the file has `agent_policy.feedback.url`, an agent that read it should tell the person what it
decided and why, whichever way it went. One POST per request, after deciding:

```json
{
  "verdict": "declined",                       // approached | asked | declined
  "reasons": [{ "check": "pay", "detail": "Band €95k-€110k is below their minimum of €115k." }],
  "missing": ["published_comp"],               // check ids the request didn't answer, or intro requirements it lacked
  "request": { "type": "job", "title": "Platform Engineer", "company": "Brightloop" },
  "offered": { "currency": "EUR", "base_min": 95000, "base_max": 110000 },   // or day_min/day_max
  "agent": { "name": "Acme recruiting agent", "on_behalf_of": "Brightloop" }
}
```

- `reasons[].check` is one of the check ids from section 5 (`open`, `mode`, `place`, `auth`, `pay`,
  `rate`, `days`, `length`, `hours`, `comp`, `employment`, `stage`, `domain`, `oncall`, `start`,
  `skills`, `intro_requires`). For `approached`, list the checks that made it a fit.
- It's structured on purpose: it can't be used as a second inbox. No pitches, no links.
- The person reads the notes in aggregate (why agents declined, what requests left out, near misses,
  what was offered) and changes their file if a pattern shows up.
- Hosting at humanjson.org adds the URL automatically. Notes are only readable with the
  profile's token.

## 8. Etiquette

- Fetch at most once a day per person. Cache by `updated`.
- Prefer the person's own location (section 1) over copies elsewhere.
- Do not scrape anything the person didn't publish here, and don't enrich it from elsewhere.
- One message per role. No follow-ups unless the person replies.
- One feedback note per request, if the file asks for it.
