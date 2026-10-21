# human.json

*Hello, human.* An open spec for one public file that tells AI agents what you've done, what you're
open to, what you're not, and how to approach you. Think `robots.txt`, for people.

- **Spec:** [protocol.md](protocol.md) (v0.5)
- **Schema:** [schema/human.schema.json](schema/human.schema.json) (JSON Schema draft-07)
- **Website:** [humanjson.org](https://humanjson.org) (make one, host one, see an example)
- **Status:** draft. Feedback and proposals welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What's in a human.json

```json
{
  "spec": "human.json/0.5",
  "name": "Noor Haddad",
  "headline": "ML platform engineer.",
  "location": { "city": "Berlin", "country": "DE", "utc_offset": 1 },
  "open_to": [
    { "type": "job", "work_mode": ["remote", "hybrid"],
      "comp": { "currency": "EUR", "base_min": 115000, "disclose": "public" } },
    { "type": "intro", "topics": ["evals", "ML in production"] }
  ],
  "not_open_to": ["sales", "recruiting_agency"],
  "faq": [{ "q": "Remote or office?", "a": "Remote, or hybrid in Berlin." }],
  "agent_policy": {
    "auto_decline": true,
    "intro_requires": ["written_jd"],
    "contact": { "method": "email", "address": "noor@example.com" },
    "feedback": { "url": "https://…/api/feedback/noor-haddad" }
  }
}
```

Four parts agents act on:

| Field | What it does |
|---|---|
| `open_to` | What you're open to (a job, freelance work, advising, speaking, intros), each with its own conditions |
| `not_open_to` | What agents should decline for you without contacting you |
| `faq` | Your answers, which agents quote instead of asking again |
| `agent_policy` | The rules: when to decline, what an intro needs, how to reach you, where to send feedback |

Plus what you've done: `skills` linked to the `projects` that prove them, `experience`, `references`.
Full examples are in [examples/](examples/) (Noor and Chidi are fictional; Hamza's is real).

## Where agents look

1. `https://<your-site>/.well-known/human.json`
2. `https://raw.githubusercontent.com/<user>/<user>/HEAD/human.json` (your GitHub profile repo)
3. A free hosted copy: `https://humanjson.org/u/<handle>/human.json`
4. Any page you own can point to it: `<link rel="alternate" type="application/human+json" href="…">`

## Make one

- **On the website:** [https://humanjson.org/#/make](https://humanjson.org/#/make)
- **With a terminal agent** (Claude Code, Codex): `Read https://humanjson.org/skill/SKILL.md and follow it to make (or update) my human.json and publish it.`
- **By hand:** copy an example, edit it, and check it:

```sh
curl -s -X POST https://humanjson.org/api/validate -H 'Content-Type: application/json' --data-binary @human.json
```

## For agents reading one

Follow the person's `agent_policy`: check your request against the matching `open_to` entry, decline
what's in `not_open_to` or breaks a condition, send at most one message, and if
`agent_policy.feedback.url` is set, post a short note saying why you did or didn't approach.
[core.js](core.js) is the reference implementation of the matching rules.

## This repository

This repo holds the spec and what implementers need. The website and its hosting service are
maintained separately and synced here. See [CHANGELOG.md](CHANGELOG.md) for versions.
