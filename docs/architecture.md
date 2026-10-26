# Architecture and API

## Protocol boundary

RevisionWeave interprets a bounded, submitted checklist. It does not have a shell, network source adapter, deployment integration, access-control adapter or money-transfer path. Assertions inside a checklist are user assertions. A phrase such as “restart after backup” can establish a textual prerequisite; it does not prove a backup occurred.

## Frozen input and structural reconciliation

Each weave is namespaced by coordinator address and ID. Its immutable plan binds profile, deployment domain, coordinator, two authors, scope and base. `base_digest` hashes the canonical base separately. Each author submits exactly one complete snapshot while acknowledging that base digest. Its stored branch also commits the weave digest, therefore the scope and author roster.

All items have stable ASCII IDs. For each ID, code compares BASE, LEFT and RIGHT text, including absence:

| Condition | Result |
| --- | --- |
| LEFT equals RIGHT | Copy that exact text/absence, `AUTO_BOTH` |
| LEFT equals BASE | Copy RIGHT, `AUTO_RIGHT` |
| RIGHT equals BASE | Copy LEFT, `AUTO_LEFT` |
| All differ | Require an explicit coordinator selection |
| Explicit selection is present | Copy only the selected BASE/LEFT/RIGHT text/absence, `HUMAN_*` |

A coordinator can also make an explicit frozen-fragment selection to address a semantic conflict discovered in an earlier candidate. It cannot upload replacement text. Provenance includes deletions. Original branches remain immutable.

## Semantic consensus

The proposed checklist and all original variants are supplied as untrusted JSON data. The model returns a strict schema:

```json
{
  "items": [
    {"id": "restart", "certainty": "KNOWN", "requires": [
      {"id": "backup", "source_id": "restart", "quote": "Run restart after backup succeeds."}
    ]}
  ],
  "conflicts": []
}
```

Every candidate identity must occur exactly once. A prerequisite can refer to a frozen identity deleted from the candidate; code then records a missing dependency. Only frozen IDs are permitted. Each edge names a retained evidence item with `source_id` and an exact 8–400 character substring supporting the direction. A requirement can be stated in another retained item: “backup before restart” supports restart -> backup even when the restart item does not repeat it. Unselected branch text helps identify a deleted step but cannot create an obligation. Each conflict pair has a quote from both candidate items.

Leader and validator independently derive the canonical tuple of item certainty, dependency IDs and conflict pairs. The tuple must match exactly. Each validator then performs a separate substantive audit of complete coverage, dependencies, conflicts, uncertainty and citation support. Matching strings or valid substring positions alone are insufficient. Quotations may vary between independent runs, but the leader's actual quotations must be audited against the original text.

The model does not output a final status, executable expression, rewritten text or dependency ordering. Code produces `UNRESOLVED` if any item is UNKNOWN, any prerequisite is missing, any pair is incompatible, or Kahn-style graph reconciliation leaves a cycle/blocked node. Otherwise code produces READY and a deterministic lexicographically tie-broken topological order.

An UNKNOWN is not a negative answer. A cycle/blocked-node list is not a claim that every listed node directly belongs to a strongly connected component. No assumption of transitive semantic compatibility is used.

## State progression and histories

```text
FROZEN PLAN
  -> LEFT BRANCH + RIGHT BRANCH (separate author writes)
  -> PROPOSAL 1
       -> immutable semantic attestation: READY or UNRESOLVED
       -> changed proposal 2..4 (exact frozen-fragment selections)
       -> current READY proposal -> immutable CERTIFICATE
```

The head records only the latest proposal number and certified flag. Earlier proposal and attestation payloads are retained in separate keyed maps. An identical merged-text digest cannot be proposed again, even if the human-choice provenance differs. Thus a candidate cannot receive a fresh draw merely because a prior semantic result was inconvenient. A new weave is a new publicly identifiable process, not continuity of the old one.

## Producer writes

| Method | Caller | Behavior |
| --- | --- | --- |
| `create_weave(id, left, right, scope, base_json)` | Coordinator | Freeze distinct roles and base |
| `submit_branch(owner, id, side, base_digest, items_json)` | Designated side author | Freeze one branch; reject a different base |
| `propose_merge(id, choices_json)` | Coordinator | Copy exact frozen fragments into a new distinct candidate |
| `attest_merge(owner, id, revision, proposal_digest)` | One of the three participants | Run independent GenLayer semantics for the exact current candidate |
| `certify(id, revision, attestation_digest)` | Coordinator | Freeze the current READY candidate |
| `record_reliance(owner, id, receipt_id, certificate_digest, plan_digest)` | Any consumer | Optional same-contract exact-intent receipt |

Views: `get_metadata`, `get_weave`, `get_branch`, `get_proposal`, `get_attestation`, `get_certificate`, `get_receipt`. Payloads are canonical JSON strings. Missing optional records return JSON `null`; invalid weave/revision identities return an error.

## Real cross-contract consumer

`RevisionWeaveConsumer(provider, deployment_domain)` stores a single immutable provider address and expected public domain. Its `consume(...)` calls:

```python
provider = gl.get_contract_at(Address(self.provider))
raw = provider.view().get_certificate(owner, weave_id)
```

It checks expected certificate/plan digests, the canonical certificate hash, owner/weave identity, profile/domain, exact item digest and exact order coverage before writing an immutable consumer-owned receipt. It is a reliance recorder, not an executor. A consumer must deliberately pin a known producer/source; an arbitrary contract returning a self-consistent payload is not a trustworthy producer simply because the JSON hashes match.

## Canonical commitments

Digest encoding is UTF-8 JSON with lexicographically sorted object keys, preserved array order, no extra separators and non-ASCII characters left as UTF-8. Item rows are sorted by ID; dependency rows and conflict pairs are canonicalized before hashing. Each digest hashes the full object excluding its own `digest` field. Producer source hash, consumer source hash, chain ID, addresses and domain are bound in the SDK deployment/workflow identity and retained archive.

## Failure and recovery boundaries

- Unsupported roles, bad base/proposal/attestation digests and stale revisions reject before the intended state write.
- Failed semantic validation stores no attestation. A stored unresolved attestation remains historical evidence and cannot be replaced.
- No mutable external source is fetched; all interpreted text was frozen by the participants.
- GenLayer availability/disagreement may prevent attestation. The protocol has no time-based expiry or guarantee that parties will complete a weave. At most eight identities and four candidate revisions bound its state and repeated interpretation budget.
- Local transaction journals prevent blind resubmission after a lost send response. That protection assumes the journal is retained. Restoring an old journal or deleting local storage can defeat local recovery bookkeeping; on-chain branch/proposal/certificate immutability remains.

## Difference from earlier contributions

The same author's prior projects concerned procurement matching, release suitability, fixed-source criterion changes, data normalization, incident statements and statistical scope. This primitive adds a different trust boundary: concurrent participant-signed edits and a reproducible dependency-consistent merge. Reused transport code is disclosed; the two new project submissions planned elsewhere do not resubmit this contract under another name.
