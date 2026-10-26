# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""Small cross-contract consumer pinned to one RevisionWeave provider/domain.

It records reliance; it does not run checklist actions or grant external access.
"""
from genlayer import *
import hashlib
import json
import re

PROFILE = "revisionweave-checklists-v1"


def _json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _fail(message):
    raise gl.vm.UserError(message)


def _address(value):
    if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}", value):
        _fail("Invalid address")
    return value.lower()


def _id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,40}", value):
        _fail("Invalid ID")
    return value


def _sha(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value):
        _fail("Expected lowercase SHA-256")
    return value


def _validate(raw, owner, weave_id, domain, certificate_digest, plan_digest):
    try:
        value = json.loads(raw)
    except (ValueError, TypeError):
        _fail("Provider did not return a certificate")
    if not isinstance(value, dict) or "digest" not in value:
        _fail("Provider did not return a certificate")
    if value["digest"] != _sha(certificate_digest) or value.get("plan_digest") != _sha(plan_digest):
        _fail("Certificate or plan digest does not match consumer intent")
    core = {key: row for key, row in value.items() if key != "digest"}
    if _hash(_json(core)) != value["digest"]:
        _fail("Certificate payload hash mismatch")
    if value.get("profile") != PROFILE or value.get("deployment_domain") != domain:
        _fail("Provider profile or deployment domain mismatch")
    if value.get("owner") != _address(owner) or value.get("weave_id") != _id(weave_id):
        _fail("Certificate owner or weave identity mismatch")
    items = value.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= 8 or _hash(_json(items)) != plan_digest:
        _fail("Merged item payload mismatch")
    ids = [item.get("id") for item in items if isinstance(item, dict)]
    if len(ids) != len(items) or any(not isinstance(identifier, str) for identifier in ids) or len(set(ids)) != len(ids) or ids != sorted(ids):
        _fail("Invalid merged item identities")
    order = value.get("order")
    if not isinstance(order, list) or len(order) != len(ids) or sorted(order) != ids:
        _fail("Certificate order does not cover the exact merged plan")
    return value


class RevisionWeaveConsumer(gl.Contract):
    provider: str
    deployment_domain: str
    receipts: TreeMap[str, str]

    def __init__(self, provider: str, deployment_domain: str):
        self.provider = _address(provider)
        self.deployment_domain = _sha(deployment_domain)

    @gl.public.write
    def consume(self, owner: str, weave_id: str, receipt_id: str, expected_certificate_digest: str, expected_plan_digest: str) -> None:
        sender = _address(gl.message.sender_address.as_hex)
        key = sender + ":" + _id(receipt_id)
        if key in self.receipts:
            _fail("Consumer receipt is immutable")
        provider = gl.get_contract_at(Address(self.provider))
        raw = provider.view().get_certificate(_address(owner), _id(weave_id))
        value = _validate(raw, owner, weave_id, self.deployment_domain, expected_certificate_digest, expected_plan_digest)
        receipt = {"id": receipt_id, "consumer": sender, "provider": self.provider,
                   "deployment_domain": self.deployment_domain, "owner": _address(owner), "weave_id": weave_id,
                   "certificate_digest": value["digest"], "plan_digest": value["plan_digest"],
                   "notice": "Exact provider-bound merged text was read through a cross-contract view; no command was executed"}
        receipt["digest"] = _hash(_json(receipt))
        self.receipts[key] = _json(receipt)

    @gl.public.view
    def get_provider(self) -> str:
        return _json({"provider": self.provider, "deployment_domain": self.deployment_domain, "profile": PROFILE})

    @gl.public.view
    def get_receipt(self, consumer: str, receipt_id: str) -> str:
        return self.receipts.get(_address(consumer) + ":" + _id(receipt_id), "null")
