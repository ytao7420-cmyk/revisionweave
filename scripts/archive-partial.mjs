// Read-only preservation of the original deployment's supported scenario and failure.
import assert from 'node:assert/strict';
import {ROOT,LOCAL,reader,readJson,readJsonContract,saveJson} from './runtime.mjs';
import {verifyScenario,canonicalJson,sha256} from '../lib/evidence.js';
const config=await readJson(new URL('public/deployment.json',ROOT));
assert.equal(config.address,'0x480E227e2759bf88966369B63d9b163ad5893695');
const journal=await readJson(new URL(`workflow-${config.address.toLowerCase()}.json`,LOCAL));
const preset=await readJson(new URL('scripts/demo-preset.json',ROOT));
assert.equal(journal.identity.presetDigest,sha256(canonicalJson(preset)));
const actors=journal.identity.actors,owner=actors.coordinator,read=(method,args)=>readJsonContract(config.address,method,args),id=preset.scenarios[0].id;
const [{plan},left,right,proposal,attestation,certificate,receipt]=await Promise.all([
  read('get_weave',[owner,id]),read('get_branch',[owner,id,'LEFT']),read('get_branch',[owner,id,'RIGHT']),
  read('get_proposal',[owner,id,1]),read('get_attestation',[owner,id,1]),read('get_certificate',[owner,id]),
  readJsonContract(config.consumerAddress,'get_receipt',[actors.consumer,id+'-receipt'])]);
const auto={fixture:'auto-merge',plan,branches:[left,right],proposal,attestation,certificate,receipt};
verifyScenario(auto,config,actors);
const manual=preset.scenarios[1].id;
const [failedAttestation,failedCertificate,failedConsumerReceipt]=await Promise.all([
  read('get_attestation',[owner,manual,1]),read('get_certificate',[owner,manual]),readJsonContract(config.consumerAddress,'get_receipt',[actors.consumer,manual+'-receipt'])]);
assert.equal(failedAttestation,null);assert.equal(failedCertificate,null);assert.equal(failedConsumerReceipt,null);
const failure=await readJson(new URL('public/evidence/attempts/manual-conflict-0x5b92e7f916ce8dbf91e15d09190bb885eedfa57103eb7912fddde6e2e9b1239f.json',ROOT));
const archive={verified:false,supportedScenarioVerified:true,recordedAt:new Date().toISOString(),chainId:61999,
  deployment:config,actors,presetDigest:journal.identity.presetDigest,scenarios:[auto],transactions:journal.transactions,negativeTransactions:[],
  manualFailure:{hash:failure.hash,lifecycle:failure.statusName,consensus:failure.result_name,execution:'ERROR',rollback:'Conflict pairs must be unique, sorted candidate IDs',attestationReadBack:failedAttestation,certificateReadBack:failedCertificate,consumerReceiptReadBack:failedConsumerReceipt},
  incomplete:['manual-conflict certification and consumption','wrong-branch-author negative test','wrong-consumer-digest negative test'],
  notice:'Original deployment partial evidence. Auto-merge completed. Manual attestation failed and was not retried. This is not a complete two-scenario workflow.'};
await saveJson(new URL('public/evidence/partial-original.json',ROOT),archive);
console.log(JSON.stringify({verified:false,supportedScenario:'auto-merge',successfulWorkflowWrites:journal.transactions.filter(row=>row.consensusResult==='MAJORITY_AGREE'&&row.execution==='SUCCESS').length,failedAttestation:failure.hash,manualReadsAllNull:true},null,2));
