# Contributing to human.json

human.json is an open spec, and this is where it's worked on: the spec, the JSON Schema, the
shared skill vocabulary, the reference matcher and the instructions for agents.

## What's here

- `protocol.md`: the spec. What the file contains, where agents look for it, how matching and
  feedback work.
- `schema/human.schema.json`: the JSON Schema (draft-07) every file is validated against.
- `vocabulary.json`: the shared skill names agents match on.
- `core.js`: the reference implementation: rendering, imports and matching.
- `skill/SKILL.md`: instructions for an agent that makes or updates someone's file.
- `examples/`: complete files. Noor and Chidi are fictional; Hamza's is his own.

## Proposing a change

1. [Open a spec proposal](https://github.com/htahir1/humanjson/issues/new?template=spec_proposal.md).
   Say what you want to change, why, and show a before and after.
2. Say who it helps: the person publishing the file, or the agent reading it.
3. Discussion happens on the issue. Once there's agreement, send a pull request.

Good proposals are small. New fields should be optional, and a file that's valid today should stay
valid.

## Pull requests

Change these together, in one pull request:

- `protocol.md`
- `schema/human.schema.json`
- `core.js`, if matching or rendering changes
- an example in `examples/` that uses the new field, if it helps
- a line in `CHANGELOG.md`

CI checks that every example validates against the schema and that the reference matcher loads. To
run the same check locally:

```sh
pip install jsonschema
python3 -c "import json,glob,jsonschema; v=jsonschema.Draft7Validator(json.load(open('schema/human.schema.json'))); print(sum(len(list(v.iter_errors(json.load(open(f))))) for f in glob.glob('examples/*/human.json')), 'errors')"
```

## Versions

Every file says its version in `"spec"`, e.g. `"human.json/0.4"`. Optional additions bump the
minor version. Anything that would make existing files invalid needs a new major version and a
migration note. Readers keep accepting older versions.

## Skill names

To add a skill to `vocabulary.json`, add `{"name": "...", "aliases": [...]}` with the name people
actually use and its common variants.

## Ground rules

- Never add a real person's details without their consent.
- Be kind in issues and reviews.
