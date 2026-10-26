# Validation record

## Current evidence status

**The separately reviewed final source completed the unchanged two-scenario fixture in one run. The original deployment's failed manual attempt remains preserved as history.**

- 38 Python contract/stub tests pass.
- 14 JavaScript evidence, receipt and transport tests pass.
- Fifteen in-memory artifact tamper checks were rejected, covering signatures/actual nonzero value, source or actor substitution, calldata, model payload, missing deployment, incorrect negative intent/rollback, changed read-back, consensus status and human-provenance laundering. These are offline verifier checks, separate from the suite counts.
- Default `npm run plan` reports Studionet 61999, zero value, full validators, two contracts, fourteen intended successful workflow writes and two expected rejections.
- `public/deployment.json` is `deployed:true`: current provider `0xe48724E68AcAc9eb053BfbaA2eB77482486028dF`, consumer `0x9B01ACE337e3318ecB7eCf5fC3b47203Acd70542`.
- The deployed provider source is `f925e7f97a2ff32278a764a4cb1890bba6481cb484680f5a09cd3c746297b7d4`; consumer source is `1fea5923d2217bc81138e7cb17c08aa563465c12ea6fd9d9e5dce20a118d117b`.
- Both scenarios completed all seven writes and their separate contract consumed the exact certificates. Both planned negative calls produced the exact expected rollback under validator majority agreement.
- `public/evidence/demo.json` is `verified:true`. `npm run verify` passes **18 selected public RPC transcripts: 2 deployments, 14 successful workflow writes and 2 expected failed executions**. All 18 public signatures bind actual actor, chain 61999, value 0, destination, ABI calldata and full-validator appdata. Both deployment sources match signed constructor inputs, chain source read-back and local hashes.
- The 2 original readable model outputs are retained and their ABI-decoded semantics equal the stored attestations. Post-negative reads confirm both certificates, both valid consumer receipts and the original LEFT branch are unchanged; the wrong-digest receipt is `null`.

This establishes one completed synthetic run. It does not establish real command execution, real-world safety, adoption, publication or contribution acceptance. Default `npm run verify` is an offline evidence check; its `liveReadReverified:false` result distinguishes that from the collector/`--chain` refresh, which actually re-read the RPC evidence.

## Current complete live results

| Check | Observed evidence |
| --- | --- |
| Automatic merge | Exact `AUTO_LEFT` backup and `AUTO_RIGHT` restart; interpreted `restart -> backup`; deterministic order `backup, restart` |
| Automatic certificate / consumer | Certificate `f89a0398de62dabb3d60956470338db46acc60cd48a007b3322e25aa7a905374`; separate consumer receipt `8104256fe76bb84f480e956e2bf30bd99ba8ef3afbf3c56f3506a6815e5c2b69` |
| Human conflict choice | Exactly one retained `color` item, `KNOWN`, no dependencies, `conflicts:[]`; selected RED remains `HUMAN_LEFT` |
| Manual attestation | `0x2aa2cbbfb6ba0da9cd6f39490d33b5dcf787af8cdd72cb274052dcadae0e41f6`; successful majority agreement and `READY` |
| Manual certificate / consumer | Certificate `ca265b8a33521f3e43f0eb558f8d51974007b952274461656649787fae955472`; real consumer call `0xeb0ef4760dbe4ed75390b69b13c46cb6fed23f2841a32f0514c0d42e05622e66` |
| Wrong branch author | `0xe6778bda2039512a6ea46768c8e262526dda50a06a35622dfe9bc55fa073e8ab`; exact rollback `Only the designated branch author may submit` |
| Wrong consumer digest | `0x6cba9b4fa7876d06e11a955a11da6c333f51ad378ad06dad8cd0f9c6068155bf`; exact rollback `Certificate or plan digest does not match consumer intent` |

Successful calls establish `MAJORITY_AGREE` and VM `SUCCESS`; negative calls establish `MAJORITY_AGREE`, VM `ERROR` and the exact rollback. Both attestation vote maps contain minority disagreement, so no unanimous-agreement claim is made. The automatic attestation's public validator diagnostics include `UserError` at `leader_schema` and `independent_schema`; the exact rejected model fields are not logged. The manual minority rejection has no exception diagnostic, so its exact signature/audit reason is not inferred.

Current proof is in `public/evidence/demo.json` and `transcripts.json`; the latter excludes node/model configuration and all keys, while retaining public signed transactions, original `eq_outputs`/readable data and short stage/type diagnostics.

## History: original deployment's live failure retained

The original provider was `0x480E227e2759bf88966369B63d9b163ad5893695`, consumer `0xD56445cbFb3f2C8b32232686CFF79c6277340AAe`, provider source `b0c4ae32600fb09c575fde677b3e493b2ea5042904f95aae8b9181da33697d39`. Its automatic scenario completed, but its manual scenario and full run remained incomplete. These are separate contracts and evidence from the successful current deployment above.

Manual attestation `0x5b92e7f916ce8dbf91e15d09190bb885eedfa57103eb7912fddde6e2e9b1239f` ended `FINALIZED / MAJORITY_DISAGREE`, with leader VM `ERROR` and exact rollback `Conflict pairs must be unique, sorted candidate IDs`. The leader's equivalence output contains that rollback, rather than a successful semantic tuple. Two validator execution rows disagreed with `ERROR`; two idle rows were cancelled after quorum. These are neither success nor unanimous agreement.

The retained manual candidate contains one `color` item selected from LEFT. The unchanged schema requires conflict endpoints to be two distinct, sorted, retained candidate IDs; no valid conflict pair exists for that single-item candidate. The returned interpretation failed this schema check. The raw model JSON before parsing was not logged, so the precise invalid endpoint values are not claimed. The model/audit boundary between retained candidate text and historical alternatives is clarified in the separately reviewed revision below.

Independent reads confirmed the failed manual attestation, certificate and consumer receipt are all `null`. The original failed call was not rerolled or resubmitted. The original automatic certificate is `38659fd033135b61f335cca13812ac214c0ef50959ec78876784ae78ab7f8743`.

`public/evidence/attempts/manual-conflict-0x5b92e7f916ce8dbf91e15d09190bb885eedfa57103eb7912fddde6e2e9b1239f.json` contains selected public receipt fields, original saved intent and deployment snapshot, including the public signed transaction and exact rollback. Its source snapshot is `attempts/source-b0c4ae32600fb09c575fde677b3e493b2ea5042904f95aae8b9181da33697d39.py`. `node scripts/verify-attempt.mjs` checks the retained source hash, signature-derived actor, actual chain 61999/value 0, full-validator appdata, exact ABI calldata and unexpected failure outcome. It does not certify a completed workflow. Wallet keys and node/model configuration are excluded.

## Reviewed candidate-boundary clarification — separately deployed

Final reviewed/deployed provider SHA-256: `f925e7f97a2ff32278a764a4cb1890bba6481cb484680f5a09cd3c746297b7d4`. Consumer source remains unchanged at `1fea5923d2217bc81138e7cb17c08aa563465c12ea6fd9d9e5dce20a118d117b`. The fixture bytes and canonical digest are unchanged. The original failed address was not retried; the final source was deployed with a new domain and ran the original fixture once.

The interpretation prompt, its actual JSON data key and the substantive audit consistently use `candidate_items` for coexisting instructions. A human-selected version replaces the unselected versions of its identity; historical alternatives cannot introduce obligations, incompatibility or uncertainty. They remain usable only to identify references already stated in retained candidate text. A conflict must identify two distinct retained IDs; fewer than two retained items requires an empty conflict list. Deleted-but-explicitly-referenced prerequisite identities remain supported and still produce unresolved missing dependencies.

The semantic schema, canonical comparison signature, reconciliation and structural merge functions are AST-identical to the original source. Invalid/self/deleted-ID conflict pairs still raise errors; no model output is filtered, repaired or silently accepted. Individual schema exceptions now log only stage and exception type, without model data or exception messages. The candidate diff is in `docs/candidate-boundary-source.diff`.

Five additional Python regressions exercise a selected singleton with an unselected conditional alternative, two retained items whose unselected version would otherwise introduce obligations/conflicts, rejection of single-item self-conflicts, rejection of deleted identities used as conflict candidates, and the continued substantive audit requirement for an empty single-item conflict list. The singleton regression also checks the actual JSON keys in leader, independent and audit prompts. All 38 Python and 14 JavaScript tests pass. GenVM lint/schema pass with the pinned runner (13 methods, 7 views, 6 writes); its only notice is that a newer runner exists. The subsequent current live run completed, while minority model disagreement remains visible; neither result is a guarantee of universal reliability.

## Meaningful offline coverage

Python tests exercise automatic disjoint edits; structural conflicts; exact human choices and retained branch provenance; deleted prerequisites; semantic incompatibility; cycles; UNKNOWN; independent model disagreement; substantive citation-audit failure; forged quotes; complete item coverage; prompt data isolation; designated roles; wrong base; source/domain mismatch; stale revision; anti-reroll; four-round budget; combined identity bounds; cross-contract provider reads; certificate/plan tampering; malformed order; missing provider certificate and immutable receipts.

The stub supplies separate leader and independent replies, so disagreement paths are exercised. The test inputs are not a simulation of real model behavior, network rollback or prompt injection resistance. Passing them does not prove those properties.

JavaScript tests include fixed canonicalization/hash vectors, malformed source/domain bindings, provenance edits, transaction sender/method replacement, nonzero value, leader-only execution, insufficient consensus/VM outcomes, exact expected rollback payloads, actual ABI calldata binding, and a persisted lost-response intention that refuses a second automatic send.

## Completed current actual-chain reproduction

1. Review `contracts/revisionweave.py` and `contracts/consumer.py`, compute their exact SHA-256 values, then pass both to `scripts/live-test.mjs --deploy`.
2. The script uses project-only unfunded test actors, generating them on first use and preserving existing journal identities on resume. It pins chain/RPC, deploys both contracts with full validators and reads their deployed code to match both source hashes. The consumer is constructed with the new provider address and public deployment domain.
3. `--run` makes author-specific writes for two separate synthetic weaves. It does not impersonate neutral people or real users.
4. **Automatic merge:** independently changed backup and restart items merge as exact original fragments, with the restart prerequisite independently interpreted and a deterministic `backup, restart` order. A separate contract reads and consumes the exact certificate.
5. **Human conflict choice:** two incompatible edits of the same item require an explicit LEFT selection. The original BASE/RIGHT remain readable; the certificate and consumer receipt retain `HUMAN_LEFT`, rather than inventing consensus approval of that preference.
6. **Wrong author:** another test wallet tries to submit LEFT. The actual ERROR/rollback payload must be `Only the designated branch author may submit` under full consensus.
7. **Wrong consumer intent:** the consumer contract receives a different certificate digest. Its actual ERROR/rollback must have the exact digest-mismatch message and leave no receipt.
8. The script refreshes all successful receipts and verifies actual sender, target and encoded calldata as well as majority agreement and VM return. Only after all checks does it write `verified: true` evidence.
9. `npm run verify` checks the saved archive against the fixture and source commitments. This is an offline consistency check, not a fresh chain query. `node scripts/verify-evidence.mjs --chain` also freshly queries deployed source and each actual transaction.

The complete current archive satisfies all nine steps and the strengthened 18-transcript verifier, including signed actor/chain/value/calldata, both original readable semantic outputs, deployment source bytes and post-negative read-back. `scripts/archive-transcripts.mjs` is read-only on chain; `node scripts/verify-attempt.mjs` separately checks the preserved original failure. No historical ERROR is relabelled as success.

## Retained artifacts after execution

- `public/deployment.json`: producer/consumer addresses, source hashes, deployment domain and deployment receipt summaries.
- `public/evidence/deployments.json`: previous deployments if applicable; never rewrite a failed old deployment as a successful new one.
- `public/evidence/demo.json`: exact immutable plans, original branches, proposal/attestation/certificate/consumer payloads, successful journal entries and separately labelled expected rejections.
- `.local/`: restricted test keys, full resumable journals and failed receipts; ignored and excluded from publication.

If semantic consensus returns UNRESOLVED for a demo, retain that real result and inspect why. Do not change archived semantics, replace ERROR with SUCCESS, reroll an identical candidate or fabricate a certificate. A model may conservatively find ambiguity even when a fixture is intended to be clear. New fixture/source changes require explicit new deployment/workflow evidence and accurate documentation.

## Limits

The protocol supports at most eight identities and four distinct candidates. It cannot prove action execution, the practical safety of a runbook, independent human authorship, real-world prerequisite completion or globally optimal merges. Strict validator agreement may leave a weave unfinished. Cross-contract reliance only means the pinned provider's exact certified text was read and acknowledged by that consumer. No real assets, paid services or mainnet calls are part of the reproduction.
