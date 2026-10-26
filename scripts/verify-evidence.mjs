import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {abi} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {parseTransaction,recoverTransactionAddress,decodeFunctionData,fromRlp,hexToBytes,hexToString,keccak256,zeroAddress} from 'viem';
import {verifyArchive,sha256,canonicalJson} from '../lib/evidence.js';
import {assertExecutionSucceeded,assertExpectedRollback,lifecycleStatus,consensusResult} from '../lib/receipt.js';

const normalizedAddress=value=>{assert.match(value??'',/^0x[0-9a-f]{40}$/i);return value.toLowerCase();};
const hex=value=>'0x'+String(value??'').replace(/^0x/,'').toLowerCase();
const plain=value=>value instanceof Map?Object.fromEntries([...value].map(([key,item])=>[key,plain(item)])):Array.isArray(value)?value.map(plain):value;
const diagnostics=entry=>String(entry.genvm_result?.stdout??'').split('\n').map(line=>line.trim()).filter(line=>line.startsWith('REVISIONWEAVE_DIAGNOSTIC ')).map(line=>{
  const value=JSON.parse(line.slice('REVISIONWEAVE_DIAGNOSTIC '.length));
  assert.deepEqual(Object.keys(value).sort(),['exception_type','stage']);return value;
});
export function deploymentReferences(config){
  assert.deepEqual(config.deploymentTransactions.map(row=>row.label),['deploy-weave','deploy-consumer']);
  return config.deploymentTransactions.map((row,index)=>({label:row.label,hash:row.hash,spec:{kind:'deploy',actor:config.deployer,
    sourceSha256:index===0?config.sourceSha256:config.consumerSourceSha256,
    args:index===0?[config.deploymentDomain]:[config.address,config.deploymentDomain],value:'0',leaderOnly:false}}));
}

export async function verifyPublicTranscripts(transcripts,archive,config,preset){
  assert.equal(config.deployed,true);assert.equal(config.rpc,'https://studio.genlayer.com/api');
  assert.equal(transcripts.chainId,61999);assert.equal(transcripts.contractAddress,config.address);
  assert.equal(transcripts.consumerAddress,config.consumerAddress);assert.equal(transcripts.deploymentDomain,config.deploymentDomain);
  assert.equal(transcripts.contractSourceSha256,config.sourceSha256);assert.equal(transcripts.consumerSourceSha256,config.consumerSourceSha256);
  for(const [name,address,hash]of [['provider',config.address,config.sourceSha256],['consumer',config.consumerAddress,config.consumerSourceSha256]]){
    const source=transcripts.sourceReadBack[name];assert.equal(source.address,address);assert.equal(source.sha256,hash);assert.equal(sha256(source.code),hash);
  }
  const a=archive.actors,item=archive.scenarios[0],fixture=preset.scenarios[0],id=fixture.id;
  const expectedNegatives=[
    {label:'wrong-branch-author',spec:{kind:'call',address:config.address,actor:a.consumer,method:'submit_branch',args:[a.coordinator,id,'LEFT',item.plan.base_digest,canonicalJson(fixture.left)],value:'0',leaderOnly:false,expectedRollback:'Only the designated branch author may submit'}},
    {label:'wrong-consumer-digest',spec:{kind:'call',address:config.consumerAddress,actor:a.consumer,method:'consume',args:[a.coordinator,id,'wrong-digest','0'.repeat(64),item.certificate.plan_digest],value:'0',leaderOnly:false,expectedRollback:'Certificate or plan digest does not match consumer intent'}}
  ];
  assert.deepEqual(archive.negativeTransactions.map(({label,spec})=>({label,spec})),expectedNegatives);
  const refs=[...deploymentReferences(config),...archive.transactions,...archive.negativeTransactions];
  assert.equal(refs.length,18);assert.equal(new Set(refs.map(row=>row.hash)).size,18);assert.equal(transcripts.receipts.length,18);
  let modelOutputs=0;
  for(const [index,row]of transcripts.receipts.entries()){
    const ref=refs[index],spec=ref.spec;
    assert.equal(row.reference.label,ref.label);assert.equal(row.reference.hash,ref.hash);assert.equal(row.hash,ref.hash);
    if(ref.expectedRollbackVerified)assertExpectedRollback(row,ref.decodedRollback);else assertExecutionSucceeded(row);
    assert.equal(normalizedAddress(row.from_address),normalizedAddress(spec.actor));assert.equal(row.leader_only,false);
    assert.equal(spec.value,'0');assert.equal(spec.leaderOnly,false);
    const signed=row.signed_rollup_transaction;assert.match(signed??'',/^0x[0-9a-f]+$/i);assert.equal(keccak256(signed),ref.hash);
    const envelope=parseTransaction(signed);assert.equal(envelope.chainId,61999);assert.equal(envelope.value??0n,0n);
    assert.equal(normalizedAddress(await recoverTransactionAddress({serializedTransaction:signed})),normalizedAddress(spec.actor));
    assert.equal(normalizedAddress(envelope.to),normalizedAddress(studionet.consensusMainContract.address));
    const submitted=decodeFunctionData({abi:studionet.consensusMainContract.abi,data:envelope.data});
    assert.equal(submitted.functionName,'addTransaction');assert.equal(normalizedAddress(submitted.args[0]),normalizedAddress(spec.actor));
    const appData=submitted.args[4];assert.equal(hex(row.tx_data),hex(appData));
    const app=fromRlp(appData),deploy=spec.kind==='deploy';assert.equal(app.length,deploy?3:2);
    assert.ok(app.at(-1)==='0x'||BigInt(app.at(-1))===0n,'Signed appdata must use leaderOnly:false.');
    const encoded=abi.calldata.encode(abi.calldata.makeCalldataObject(deploy?undefined:spec.method,spec.args,undefined));
    assert.deepEqual(hexToBytes(app[deploy?1:0]),encoded);assert.deepEqual(Uint8Array.from(row.data.calldata.raw),encoded);
    const leader=row.consensus_data.leader_receipt.filter(entry=>entry.mode==='leader').at(-1);assert.ok(leader);
    if(deploy){
      const name=index===0?'provider':'consumer',target=index===0?config.address:config.consumerAddress;
      assert.equal(normalizedAddress(submitted.args[1]),zeroAddress);assert.equal(normalizedAddress(row.data.contract_address),normalizedAddress(target));
      const code=hexToString(app[0]);assert.equal(sha256(code),spec.sourceSha256);assert.equal(code,transcripts.sourceReadBack[name].code);
    }else{
      assert.equal(normalizedAddress(submitted.args[1]),normalizedAddress(spec.address));assert.equal(normalizedAddress(row.to_address),normalizedAddress(spec.address));
      if(spec.method==='attest_merge'){
        const scenario=archive.scenarios.find(entry=>entry.plan.id===spec.args[1]),output=leader.eq_outputs?.['0'];
        assert.ok(scenario);assert.equal(output?.status,'return');assert.ok(typeof output.payload?.readable==='string'&&output.payload.readable.length>0);
        assert.deepEqual(plain(abi.calldata.decode(Uint8Array.from(output.payload.raw))),scenario.attestation.semantics);modelOutputs++;
      }
    }
  }
  assert.equal(modelOutputs,2);assert.equal(transcripts.readBack.scenarios.length,2);
  for(const [index,read]of transcripts.readBack.scenarios.entries()){
    assert.equal(read.id,archive.scenarios[index].plan.id);assert.deepEqual(read.certificate,archive.scenarios[index].certificate);assert.deepEqual(read.receipt,archive.scenarios[index].receipt);
  }
  assert.deepEqual(transcripts.readBack.originalLeftBranch,item.branches[0]);assert.equal(transcripts.readBack.negativeReceipt,null);
  return {verifiedPublicTranscripts:18,signedTransactionsVerified:18,successfulDeployments:2,readableModelOutputs:2,postNegativeEvidenceUnchanged:true};
}

async function collectPublicTranscripts(archive,config,preset){
  const {reader,readJsonContract,saveJson,ROOT}=await import('./runtime.mjs');
  const sourceReadBack={};
  for(const [name,address,expected]of [['provider',config.address,config.sourceSha256],['consumer',config.consumerAddress,config.consumerSourceSha256]]){
    const code=await reader.getContractCode(address);assert.equal(sha256(code),expected);sourceReadBack[name]={address,sha256:sha256(code),code};
  }
  const rows=[];
  for(const ref of [...deploymentReferences(config),...archive.transactions,...archive.negativeTransactions]){
    const tx=await reader.getTransaction({hash:ref.hash});
    if(ref.expectedRollbackVerified)assertExpectedRollback(tx,ref.decodedRollback);else assertExecutionSucceeded(tx);
    const raw=tx.consensus_data?.leader_receipt,leaders=Array.isArray(raw)?raw:raw?[raw]:[];
    rows.push({reference:{label:ref.label,hash:ref.hash},hash:tx.hash,from_address:tx.from_address,to_address:tx.to_address,
      data:{calldata:tx.data?.calldata,contract_address:tx.data?.contract_address},tx_data:tx.tx_data,signed_rollup_transaction:tx.sim_config?.signed_rollup_transaction,
      statusName:lifecycleStatus(tx),result_name:consensusResult(tx),leader_only:tx.leader_only,
      consensus_data:{votes:tx.consensus_data?.votes??{},leader_receipt:leaders.map(entry=>({mode:entry.mode,execution_result:entry.execution_result,result:entry.result,eq_outputs:entry.eq_outputs,diagnostics:diagnostics(entry)})),
        validators:(tx.consensus_data?.validators??[]).map(entry=>({mode:entry.mode,vote:entry.vote,execution_result:entry.execution_result,diagnostics:diagnostics(entry)}))}});
  }
  const scenarios=[];
  for(const item of archive.scenarios){const id=item.plan.id;scenarios.push({id,
    certificate:await readJsonContract(config.address,'get_certificate',[archive.actors.coordinator,id]),
    receipt:await readJsonContract(config.consumerAddress,'get_receipt',[archive.actors.consumer,id+'-receipt'])});}
  const readBack={scenarios,
    originalLeftBranch:await readJsonContract(config.address,'get_branch',[archive.actors.coordinator,archive.scenarios[0].plan.id,'LEFT']),
    negativeReceipt:await readJsonContract(config.consumerAddress,'get_receipt',[archive.actors.consumer,'wrong-digest'])};
  const transcripts={chainId:61999,contractAddress:config.address,consumerAddress:config.consumerAddress,deploymentDomain:config.deploymentDomain,
    contractSourceSha256:config.sourceSha256,consumerSourceSha256:config.consumerSourceSha256,recordedAt:new Date().toISOString(),
    notice:'Selected public RPC fields, public signed transactions and original readable model outputs. No node/model configuration or wallet-key files. Expected rejections remain VM ERROR.',sourceReadBack,readBack,receipts:rows};
  await verifyPublicTranscripts(transcripts,archive,config,preset);await saveJson(new URL('public/evidence/transcripts.json',ROOT),transcripts);return transcripts;
}

export async function verifySavedEvidence({chain=false}={}){
  const root=new URL('../',import.meta.url);
  const config=JSON.parse(await readFile(new URL('public/deployment.json',root),'utf8'));
  const archive=JSON.parse(await readFile(new URL('public/evidence/demo.json',root),'utf8'));
  const preset=JSON.parse(await readFile(new URL('scripts/demo-preset.json',root),'utf8'));
  assert.equal(sha256(await readFile(new URL('contracts/revisionweave.py',root),'utf8')),config.sourceSha256);
  assert.equal(sha256(await readFile(new URL('contracts/consumer.py',root),'utf8')),config.consumerSourceSha256);
  const result=verifyArchive(archive,config,preset);
  const transcripts=chain?await collectPublicTranscripts(archive,config,preset):JSON.parse(await readFile(new URL('public/evidence/transcripts.json',root),'utf8'));
  Object.assign(result,await verifyPublicTranscripts(transcripts,archive,config,preset),{liveReadReverified:chain});
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log(JSON.stringify(await verifySavedEvidence({chain:process.argv.includes('--chain')}),null,2));
}
