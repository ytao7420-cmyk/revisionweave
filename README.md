# RevisionWeave

A reusable GenLayer primitive for merging concurrent edits to a bounded operational checklist. The coordinator freezes a base, a scope and two distinct branch authors. Each author signs one complete branch. Code performs structural three-way reconciliation; GenLayer independently interprets the resulting text's prerequisites and incompatible conditions. Deterministic graph checks prevent an unresolved dependency, cycle, conflict or UNKNOWN from becoming a merge certificate.

**This records the interpretation and provenance of submitted text. It does not execute commands, authenticate a real incident, prove infrastructure safety or certify that a plan is correct.** Demo checklists and all test actors are project-controlled. No funds are handled.

## Why consensus matters

Line-based merging cannot establish whether independently edited instructions still depend on a deleted step or require incompatible conditions. Conversely, asking an LLM to rewrite both branches loses authorship and lets it invent new instructions. RevisionWeave separates these concerns:

1. Author identities, base and branch payloads are frozen on-chain.
2. A structural merge copies exact existing BASE/LEFT/RIGHT item text. It never asks a model to generate the merged checklist.
3. Every validator independently derives the complete dependency/compatibility tuple, then substantively audits the leader's exact quotations against the frozen text. Semantic disagreements do not silently become a successful attestation.
4. Code computes missing prerequisites, dependency cycles, unresolved items and an exact topological order.
5. The coordinator may explicitly select already frozen branch fragments to resolve a conflict. Those selections are labelled `HUMAN_LEFT`, `HUMAN_RIGHT` or `HUMAN_BASE`; they are not represented as validator decisions.
6. A separate consumer contract reads an immutable certificate from a pinned provider and records reliance on the exact certificate and plan digests.

This is not a fork of the GenLayer starter or a re-submission of ClauseDelta. ClauseDelta compared a selected normative criterion across two official document versions. RevisionWeave has participant-signed concurrent branches, a three-way merge, frozen-fragment conflict choices, dependency-graph reconciliation, revision anti-reroll behavior and a cross-contract consumer.

## Bounds and failure behavior

- A base contains 1–8 stable item IDs. Each branch may delete items or add new IDs, but the combined frozen identity set is at most eight. Text is 8–600 characters per item; scope is 10–600 characters.
- A coordinator and the two authors are distinct wallet addresses. An address is not proof of a person's real-world identity or independence.
- Branches cannot be amended. Use a new weave if an author changes the original submission.
- At most four distinct candidate plans can be proposed. An identical merged text cannot be re-attested in the same weave, even under different provenance choices. This intentionally prevents repeated model draws for an unchanged candidate.
- A deleted step referenced by a retained step remains a missing prerequisite. The model cannot hide it by simply deleting the edge.
- `UNKNOWN`, missing prerequisites, incompatible pairs and cycles remain explicit `UNRESOLVED` outcomes. No certificate exists for that candidate.
- Previous proposals and attestations remain readable. Only the latest uncertified proposal may be certified. Certification freezes the weave.
- A 32-byte public deployment domain is immutable and is included in the weave/certificate commitments. It is not a signature or proof of deployment authenticity. Consumers must also pin the intended network, provider address and published source hash. The example consumer pins its provider address and expected domain.

## Run locally

```sh
npm ci
npm test
npm run test:contract
npm run plan
```

Current offline suite: **38 Python contract/stub tests and 14 JavaScript evidence/transport tests**. Stubbed independent model replies do not prove real validator consensus, network rollback or resistance to all prompt injection.

## Deploy and reproduce

The default harness only prints a plan; it creates no wallets or journals and sends no transactions. Deployment requires approval of both exact source hashes:

```text
node scripts/live-test.mjs --deploy --source-sha=<reviewed-main-source-sha256> --consumer-source-sha=<reviewed-consumer-source-sha256>
node scripts/live-test.mjs --run
npm run verify
node scripts/verify-evidence.mjs --chain
```

Execution is restricted to SDK-pinned Studionet **61999**, `value: 0`, `leaderOnly: false`. The first command deploys the producer and the pinned consumer. The workflow uses four project-controlled local test actors and records two end-to-end cases: automatic merge and an explicit human conflict choice. Each has seven successful writes, including a real cross-contract consumption. Two additional expected rejections check a wrong branch author and a mismatched certificate digest. Their executions remain errors and are never counted as successful writes.

The harness records intent before broadcasting and the returned transaction hash before waiting. A lost broadcast response stops the run; a later invocation cannot automatically send the same intention again. Use the documented recovery flags only after identifying the exact existing transaction. The receipt checks distinguish chain lifecycle, validator majority and actual VM execution. Final reads verify source hashes and canonical receipts. `.local/` is ignored and local test keys are never bundled or printed.

The current reviewed deployment completed the unchanged fixture once: **2 deployments, 14 successful workflow writes, 2 exact expected rollbacks and 2 real cross-contract consumer receipts**. Provider: `0xe48724E68AcAc9eb053BfbaA2eB77482486028dF`; consumer: `0x9B01ACE337e3318ecB7eCf5fC3b47203Acd70542`. `public/evidence/demo.json` is `verified:true`, and `npm run verify` checks all **18 selected public RPC transcripts**, their signed actors/chain/value/calldata, both source hashes, two original readable semantic outputs and unchanged post-negative evidence. Both attestation transactions had minority disagreement; the claim is majority agreement, not unanimity or universal model reliability.

The original deployment's manual attestation failed a conflict-pair schema check and was not rerolled. `public/evidence/partial-original.json` and `public/evidence/attempts/` retain its partial results, exact original source and signed failure. The separately reviewed source clarifies that only retained `candidate_items` coexist; unselected branch versions cannot introduce obligations or self-conflicts. The strict schema still rejects invalid output without filtering or correction. See [validation](docs/validation.md) for the complete current evidence and clearly separated history.

```sh
npm run verify                         # offline verification of the complete current archive
node scripts/archive-transcripts.mjs   # read-only RPC refresh; no wallets or broadcasts
node scripts/verify-attempt.mjs        # preserved original failure; not a successful workflow
```

## Files

- `contracts/revisionweave.py`: state machine, exact-fragment merge, independent semantics, graph reconciliation, certificates.
- `contracts/consumer.py`: real cross-contract view consumer pinned to a producer address/domain.
- `scripts/live-test.mjs`: reviewed deployment, resumable full-validator workflows and expected rejections.
- `scripts/verify-evidence.mjs`: saved-evidence checks; `--chain` also freshly checks deployed sources and actual transactions.
- `docs/architecture.md`: API, commitments and state boundaries.

## Attribution

The SDK transport journal, receipt parser and read scheduling are adapted from the same author's MIT-licensed ClauseDelta project. RevisionWeave's merge algorithm, semantic schema, state machine, dependency checks, consumer and fixtures are new work. `genlayer-js` is pinned to 1.1.8; the existing deployed projects' pinned `py-genlayer` dependency is retained. Cross-contract usage follows the official GenLayer [contract-interaction guide](https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-intelligent-contracts) and [ContractProxy API](https://sdk.genlayer.com/v0.2.9/_modules/genlayer/gl/genvm_contracts.html); the retained current certificates and cross-contract consumer receipts establish the tested compatibility on this pinned deployment.
