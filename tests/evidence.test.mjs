import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {abi} from 'genlayer-js';
import {assertTransactionIntent,Journal} from '../scripts/runtime.mjs';
import {canonicalJson,sha256,assertDigest,verifyArchive} from '../lib/evidence.js';
import {assertExecutionSucceeded,assertExpectedRollback,summarizeReceipt} from '../lib/receipt.js';

// Constructed unit fixtures only. They are never published as chain evidence.
const root=new URL('../',import.meta.url);
const preset=JSON.parse(readFileSync(new URL('scripts/demo-preset.json',root),'utf8'));
const seal=core=>({...core,digest:sha256(canonicalJson(core))});
function fixture(){
  const actors=Object.fromEntries(['coordinator','left','right','consumer'].map((name,i)=>[name,'0x'+String(i+1).repeat(40)]));
  const config={chainId:61999,address:'0x'+'a'.repeat(40),consumerAddress:'0x'+'b'.repeat(40),deploymentDomain:'c'.repeat(64),sourceSha256:'d'.repeat(64),consumerSourceSha256:'e'.repeat(64)};
  const scenarios=preset.scenarios.map(row=>{
    const plan=seal({profile:'revisionweave-checklists-v1',deployment_domain:config.deploymentDomain,id:row.id,
      owner:actors.coordinator,left_author:actors.left,right_author:actors.right,scope:preset.scope,base:row.base,
      base_digest:sha256(canonicalJson(row.base))});
    const branches=['LEFT','RIGHT'].map((side,i)=>seal({side,author:actors[i===0?'left':'right'],weave_digest:plan.digest,base_digest:plan.base_digest,items:row[i===0?'left':'right']}));
    const items=row.fixture==='auto-merge'?[row.left[0],row.right[1]]:row.left;
    const provenance=items.map((item,i)=>({id:item.id,origin:row.fixture==='manual-conflict'?'HUMAN_LEFT':i===0?'AUTO_LEFT':'AUTO_RIGHT',deleted:false,text_sha256:sha256(item.text)}));
    const proposal=seal({profile:plan.profile,revision:1,weave_digest:plan.digest,branch_digests:branches.map(item=>item.digest),
      universe:items.map(item=>item.id),choices:row.choices,structural_conflicts:row.fixture==='manual-conflict'?['color']:[],
      items,provenance,human_choices_are_not_consensus:true,plan_digest:sha256(canonicalJson(items))});
    const semantics={items:items.map(item=>({id:item.id,certainty:'KNOWN',requires:item.id==='restart'?[{id:'backup',source_id:'restart',quote:item.text}]:[]})),conflicts:[]};
    const attestation=seal({profile:plan.profile,weave_digest:plan.digest,proposal_digest:proposal.digest,revision:1,semantics,
      reconciliation:{status:'READY',reasons:[],unknown_ids:[],missing_dependencies:[],cyclic_or_blocked_ids:[],order:items.map(item=>item.id)},notice:'Unit fixture'});
    const certificate=seal({profile:plan.profile,deployment_domain:config.deploymentDomain,owner:plan.owner,weave_id:row.id,
      weave_digest:plan.digest,revision:1,proposal_digest:proposal.digest,plan_digest:proposal.plan_digest,
      attestation_digest:attestation.digest,branch_digests:proposal.branch_digests,items,provenance,order:attestation.reconciliation.order,notice:'Unit fixture'});
    const receipt=seal({id:row.id+'-receipt',consumer:actors.consumer,provider:config.address,deployment_domain:config.deploymentDomain,
      owner:plan.owner,weave_id:row.id,certificate_digest:certificate.digest,plan_digest:certificate.plan_digest,notice:'Unit fixture'});
    return {fixture:row.fixture,plan,branches,proposal,attestation,certificate,receipt};
  });
  const transactions=[];
  for(let i=0;i<preset.scenarios.length;i++){
    const row=preset.scenarios[i],item=scenarios[i],id=row.id,a=actors;
    for(const [suffix,actor,address,method,args] of [
      ['create',a.coordinator,config.address,'create_weave',[id,a.left,a.right,preset.scope,canonicalJson(row.base)]],
      ['left',a.left,config.address,'submit_branch',[a.coordinator,id,'LEFT',item.plan.base_digest,canonicalJson(row.left)]],
      ['right',a.right,config.address,'submit_branch',[a.coordinator,id,'RIGHT',item.plan.base_digest,canonicalJson(row.right)]],
      ['propose',a.coordinator,config.address,'propose_merge',[id,canonicalJson(row.choices)]],
      ['attest',a.right,config.address,'attest_merge',[a.coordinator,id,1,item.proposal.digest]],
      ['certify',a.coordinator,config.address,'certify',[id,1,item.attestation.digest]],
      ['consume',a.consumer,config.consumerAddress,'consume',[a.coordinator,id,id+'-receipt',item.certificate.digest,item.certificate.plan_digest]]
    ])transactions.push({label:id+'-'+suffix,spec:{kind:'call',actor,address,method,args,value:'0',leaderOnly:false},
      hash:'0x'+String(transactions.length+1).padStart(64,'0'),execution:'SUCCESS',consensusResult:'MAJORITY_AGREE',leaderOnly:false,status:'FINALIZED'});
  }
  const negativeTransactions=['wrong-branch-author','wrong-consumer-digest'].map((label,i)=>({label,
    hash:'0x'+String(i+100).padStart(64,'0'),spec:{value:'0',leaderOnly:false},expectedFailure:true,
    expectedRollbackVerified:true,execution:'ERROR',outcome:'EXPECTED_REJECTION',consensusResult:'MAJORITY_AGREE',leaderOnly:false,status:'FINALIZED',
    decodedRollback:i===0?'Only the designated branch author may submit':'Certificate or plan digest does not match consumer intent'}));
  const archive={verified:true,chainId:61999,contractAddress:config.address,consumerAddress:config.consumerAddress,
    contractSourceSha256:config.sourceSha256,consumerSourceSha256:config.consumerSourceSha256,deploymentDomain:config.deploymentDomain,
    presetDigest:sha256(canonicalJson(preset)),actors,scenarios,transactions,negativeTransactions,negativeReceiptReadBack:null};
  return {config,archive};
}

test('canonical JSON and SHA-256 agree with a fixed external vector',()=>{
  assert.equal(sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(canonicalJson({z:1,a:{z:null,a:true},b:['x',2]}),'{"a":{"a":true,"z":null},"b":["x",2],"z":1}');
  assert.equal(canonicalJson(JSON.parse('{"__proto__":{"polluted":true},"a":1}')),'{"__proto__":{"polluted":true},"a":1}');
  assert.equal({}.polluted,undefined);
});
test('a valid constructed archive verifies structurally without pretending to query chain',()=>{
  const {archive,config}=fixture();const result=verifyArchive(archive,config,preset);
  assert.equal(result.successfulWrites,14);assert.equal(result.expectedRejections,2);
});
test('default public evidence is explicitly unverified',()=>{
  const file=JSON.parse(readFileSync(new URL('public/evidence/demo.json',root),'utf8'));
  if(file.verified===false)assert.throws(()=>verifyArchive(file,{},preset),/No successful live workflow/);
  else assert.ok(file.transactions?.length,'A live record must contain retained transactions.');
});
test('changed source or deployment cannot reuse a certificate archive',()=>{
  for(const field of ['sourceSha256','consumerSourceSha256','deploymentDomain','consumerAddress','address']){
    const {archive,config}=fixture();config[field]='f'.repeat(64);assert.throws(()=>verifyArchive(archive,config,preset));
  }
});
test('certificate body edits and manual provenance laundering are detected',()=>{
  const {archive,config}=fixture();archive.scenarios[1].certificate.provenance[0].origin='CONSENSUS_SELECTED';
  assert.throws(()=>verifyArchive(archive,config,preset),/digest mismatch/);
});
test('changing a real transaction method or author invalidates archived workflow',()=>{
  for(const field of ['method','actor']){
    const {archive,config}=fixture();archive.transactions[1].spec[field]='substituted';
    assert.throws(()=>verifyArchive(archive,config,preset),/retained workflow/);
  }
});
test('nonzero value, leader-only and unsuccessful execution do not verify',()=>{
  for(const mutate of [row=>row.spec.value='1',row=>row.spec.leaderOnly=true,row=>row.execution='ERROR',row=>row.consensusResult='DISAGREE']){
    const {archive,config}=fixture();mutate(archive.transactions[0]);assert.throws(()=>verifyArchive(archive,config,preset));
  }
});
test('unknown or changed checklist fixtures cannot silently replace retained scenarios',()=>{
  const {archive,config}=fixture();archive.presetDigest='0'.repeat(64);assert.throws(()=>verifyArchive(archive,config,preset));
});
test('rollback summaries remain errors, not successes',()=>{
  const {archive,config}=fixture();archive.negativeTransactions[0].execution='SUCCESS';assert.throws(()=>verifyArchive(archive,config,preset));
});
test('receipt parser requires committed lifecycle, explicit majority and actual VM return',()=>{
  const successful={statusName:'FINALIZED',resultName:'MAJORITY_AGREE',leader_only:false,consensus_data:{leader_receipt:[{mode:'leader',execution_result:'SUCCESS',result:{status:'return'}}]}};
  assert.equal(assertExecutionSucceeded(successful),successful);
  for(const altered of [{...successful,statusName:'PENDING'},{...successful,resultName:'DISAGREE'},{...successful,leader_only:true},
    {...successful,consensus_data:{leader_receipt:[{mode:'leader',execution_result:'ERROR',result:{status:'rollback'}}]}}]){
    assert.throws(()=>assertExecutionSucceeded(altered));
  }
  assert.equal(summarizeReceipt(successful).execution,'SUCCESS');
});
test('expected rollback needs the exact payload under full validator consensus',()=>{
  const receipt={statusName:'FINALIZED',resultName:'MAJORITY_AGREE',leader_only:false,consensus_data:{leader_receipt:[{mode:'leader',execution_result:'ERROR',result:{status:'rollback',payload:'expected denial'}}]}};
  assertExpectedRollback(receipt,'expected denial');assert.throws(()=>assertExpectedRollback(receipt,'a different error'));
  assert.throws(()=>assertExecutionSucceeded(receipt));
});
test('plan and failed hash approval create no local wallet or broadcast journal',()=>{
  const local=new URL('.local/',root),before=existsSync(local)?readdirSync(local).sort():null;
  const plan=spawnSync(process.execPath,['scripts/live-test.mjs','--plan'],{cwd:root,encoding:'utf8',timeout:15000});
  assert.equal(plan.status,0,plan.stderr);const output=JSON.parse(plan.stdout);
  assert.equal(output.planOnly,true);assert.equal(output.value,'0');assert.equal(output.leaderOnly,false);assert.equal(output.contracts,2);
  const denied=spawnSync(process.execPath,['scripts/live-test.mjs','--deploy','--source-sha='+'0'.repeat(64),'--consumer-source-sha='+'0'.repeat(64)],{cwd:root,encoding:'utf8',timeout:15000});
  assert.notEqual(denied.status,0);assert.match(denied.stderr,/reviewed main source/);
  assert.deepEqual(existsSync(local)?readdirSync(local).sort():null,before);
});
test('actual transaction sender, target and calldata must match the saved intention',()=>{
  const spec={kind:'call',actor:'0x'+'1'.repeat(40),address:'0x'+'2'.repeat(40),method:'propose_merge',args:['demo','{}'],value:'0',leaderOnly:false};
  const receipt={from_address:spec.actor,to_address:spec.address,leader_only:false,
    data:{calldata:{raw:Array.from(abi.calldata.encode(abi.calldata.makeCalldataObject(spec.method,spec.args,undefined)))}}};
  assertTransactionIntent(receipt,spec);
  assert.throws(()=>assertTransactionIntent({...receipt,from_address:'0x'+'3'.repeat(40)},spec),/sender differs/);
  assert.throws(()=>assertTransactionIntent({...receipt,to_address:'0x'+'3'.repeat(40)},spec),/target differs/);
  assert.throws(()=>assertTransactionIntent({...receipt,data:{calldata:{raw:[1,2,3]}}},spec),/ABI arguments differ/);
});
test('a lost broadcast response persists intention and refuses an automatic second send',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'revisionweave-journal-test-'));
  try{
    const path=pathToFileURL(join(directory,'journal.json'));
    const identity={purpose:'unit-only synthetic journal'},spec={kind:'call',actor:'0x'+'1'.repeat(40),address:'0x'+'2'.repeat(40),method:'propose_merge',args:['demo','{}'],value:'0',leaderOnly:false};
    const journal=await Journal.load(path,identity);let sends=0;
    await assert.rejects(journal.transact('uncertain',spec,async()=>{sends++;throw new Error('simulated response loss');}),/simulated response loss/);
    const retained=JSON.parse(await readFile(path,'utf8'));assert.equal(retained.transactions.length,1);assert.equal(retained.transactions[0].hash,undefined);
    const resumed=await Journal.load(path,identity);
    await assert.rejects(resumed.transact('uncertain',spec,async()=>{sends++;throw new Error('must not send');}),/Uncertain broadcast/);
    assert.equal(sends,1);
  }finally{await rm(directory,{recursive:true,force:true});}
});
