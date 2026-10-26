import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export const PROFILE='revisionweave-checklists-v1';
export function canonicalJson(value){
  const normalize=item=>Array.isArray(item)?item.map(normalize):item!==null&&typeof item==='object'
    ?Object.fromEntries(Object.keys(item).sort().map(key=>[key,normalize(item[key])])):item;
  return JSON.stringify(normalize(value));
}
export const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
export function assertDigest(value){
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value),'Expected a digest-bearing object.');
  assert.match(value.digest??'',/^[0-9a-f]{64}$/);
  const {digest,...core}=value;assert.equal(sha256(canonicalJson(core)),digest,'Canonical payload digest mismatch.');
  return value;
}

export function verifyScenario(item,config,actors){
  const {plan,branches,proposal,attestation,certificate,receipt}=item;
  [plan,...branches,proposal,attestation,certificate,receipt].forEach(assertDigest);
  assert.equal(plan.profile,PROFILE);assert.equal(plan.deployment_domain,config.deploymentDomain);
  assert.equal(plan.owner.toLowerCase(),actors.coordinator.toLowerCase());
  assert.equal(plan.left_author.toLowerCase(),actors.left.toLowerCase());
  assert.equal(plan.right_author.toLowerCase(),actors.right.toLowerCase());
  assert.equal(plan.base_digest,sha256(canonicalJson(plan.base)));
  assert.deepEqual(branches.map(row=>row.side),['LEFT','RIGHT']);
  for(const branch of branches){assert.equal(branch.weave_digest,plan.digest);assert.equal(branch.base_digest,plan.base_digest);}
  assert.equal(branches[0].author.toLowerCase(),actors.left.toLowerCase());
  assert.equal(branches[1].author.toLowerCase(),actors.right.toLowerCase());
  assert.equal(proposal.weave_digest,plan.digest);
  assert.deepEqual(proposal.branch_digests,branches.map(row=>row.digest));
  assert.equal(proposal.plan_digest,sha256(canonicalJson(proposal.items)));
  assert.equal(proposal.human_choices_are_not_consensus,true);
  assert.equal(attestation.weave_digest,plan.digest);assert.equal(attestation.proposal_digest,proposal.digest);
  assert.equal(attestation.reconciliation.status,'READY');
  assert.deepEqual(attestation.reconciliation.reasons,[]);
  assert.equal(certificate.deployment_domain,config.deploymentDomain);
  assert.equal(certificate.weave_digest,plan.digest);assert.equal(certificate.proposal_digest,proposal.digest);
  assert.equal(certificate.attestation_digest,attestation.digest);assert.equal(certificate.plan_digest,proposal.plan_digest);
  assert.deepEqual(certificate.items,proposal.items);assert.deepEqual(certificate.provenance,proposal.provenance);
  assert.deepEqual(certificate.order,attestation.reconciliation.order);
  assert.deepEqual([...certificate.order].sort(),certificate.items.map(row=>row.id).sort());
  assert.equal(receipt.provider.toLowerCase(),config.address.toLowerCase());
  assert.equal(receipt.deployment_domain,config.deploymentDomain);
  assert.equal(receipt.consumer.toLowerCase(),actors.consumer.toLowerCase());
  assert.equal(receipt.owner.toLowerCase(),plan.owner.toLowerCase());assert.equal(receipt.weave_id,plan.id);
  assert.equal(receipt.certificate_digest,certificate.digest);assert.equal(receipt.plan_digest,certificate.plan_digest);
  if(item.fixture==='manual-conflict'){
    assert.equal(proposal.choices.color,'LEFT');assert.deepEqual(proposal.structural_conflicts,['color']);
    assert.equal(certificate.provenance.find(row=>row.id==='color').origin,'HUMAN_LEFT');
    assert.equal(certificate.items.find(row=>row.id==='color').text,'Set deployment color to RED.');
  }else if(item.fixture==='auto-merge'){
    assert.deepEqual(proposal.choices,{});assert.deepEqual(proposal.structural_conflicts,[]);
    assert.deepEqual(certificate.provenance.map(row=>row.origin),['AUTO_LEFT','AUTO_RIGHT']);
    assert.deepEqual(certificate.order,['backup','restart']);
    assert.deepEqual(attestation.semantics.items.find(row=>row.id==='restart').requires.map(row=>row.id),['backup']);
  }else{throw new Error('Unrecognized retained scenario.');}
  return {fixture:item.fixture,certificateDigest:certificate.digest,planDigest:certificate.plan_digest};
}

export function verifyArchive(archive,config,preset){
  assert.equal(archive.verified,true,'No successful live workflow archive exists yet.');
  assert.equal(archive.chainId,61999);assert.equal(config.chainId,61999);
  assert.equal(archive.contractAddress,config.address);assert.equal(archive.consumerAddress,config.consumerAddress);
  assert.equal(archive.contractSourceSha256,config.sourceSha256);
  assert.equal(archive.consumerSourceSha256,config.consumerSourceSha256);
  assert.equal(archive.deploymentDomain,config.deploymentDomain);
  assert.equal(archive.presetDigest,sha256(canonicalJson(preset)));
  assert.equal(new Set(Object.values(archive.actors).map(address=>address.toLowerCase())).size,4);
  assert.deepEqual(archive.scenarios.map(row=>row.fixture),['auto-merge','manual-conflict']);
  const results=archive.scenarios.map((row,index)=>{
    const fixture=preset.scenarios[index];
    assert.equal(row.fixture,fixture.fixture);assert.equal(row.plan.id,fixture.id);
    assert.equal(row.plan.scope,preset.scope);assert.deepEqual(row.plan.base,fixture.base);
    assert.deepEqual(row.branches[0].items,fixture.left);assert.deepEqual(row.branches[1].items,fixture.right);
    assert.deepEqual(row.proposal.choices,fixture.choices);
    return verifyScenario(row,config,archive.actors);
  });
  assert.equal(archive.transactions.length,14,'Expected exactly seven successful writes for each retained scenario.');
  for(const tx of archive.transactions){
    assert.match(tx.hash??'',/^0x[0-9a-f]{64}$/i);assert.equal(tx.spec.value,'0');assert.equal(tx.spec.leaderOnly,false);
    assert.equal(tx.execution,'SUCCESS');assert.equal(tx.consensusResult,'MAJORITY_AGREE');assert.equal(tx.leaderOnly,false);
    assert.ok(['ACCEPTED','FINALIZED'].includes(tx.status));
  }
  const expected=[];
  for(let i=0;i<preset.scenarios.length;i++){
    const fixture=preset.scenarios[i],item=archive.scenarios[i],a=archive.actors,id=fixture.id;
    for(const [suffix,actor,address,method,args] of [
      ['create',a.coordinator,config.address,'create_weave',[id,a.left,a.right,preset.scope,canonicalJson(fixture.base)]],
      ['left',a.left,config.address,'submit_branch',[a.coordinator,id,'LEFT',item.plan.base_digest,canonicalJson(fixture.left)]],
      ['right',a.right,config.address,'submit_branch',[a.coordinator,id,'RIGHT',item.plan.base_digest,canonicalJson(fixture.right)]],
      ['propose',a.coordinator,config.address,'propose_merge',[id,canonicalJson(fixture.choices)]],
      ['attest',a.right,config.address,'attest_merge',[a.coordinator,id,1,item.proposal.digest]],
      ['certify',a.coordinator,config.address,'certify',[id,1,item.attestation.digest]],
      ['consume',a.consumer,config.consumerAddress,'consume',[a.coordinator,id,id+'-receipt',item.certificate.digest,item.certificate.plan_digest]]
    ])expected.push({label:id+'-'+suffix,spec:{kind:'call',actor,address,method,args,value:'0',leaderOnly:false}});
  }
  assert.deepEqual(archive.transactions.map(({label,spec})=>({label,spec})),expected,'Archived transactions do not implement the retained workflow.');
  assert.deepEqual(archive.negativeReceiptReadBack,null);
  assert.equal(archive.negativeTransactions.length,2);
  for(const tx of archive.negativeTransactions){
    assert.match(tx.hash??'',/^0x[0-9a-f]{64}$/i);
    assert.equal(tx.expectedFailure,true);assert.equal(tx.expectedRollbackVerified,true);assert.equal(tx.execution,'ERROR');
    assert.equal(tx.outcome,'EXPECTED_REJECTION');assert.equal(tx.spec.value,'0');assert.equal(tx.spec.leaderOnly,false);
    assert.equal(tx.consensusResult,'MAJORITY_AGREE');assert.equal(tx.leaderOnly,false);assert.ok(['ACCEPTED','FINALIZED'].includes(tx.status));
  }
  assert.deepEqual(archive.negativeTransactions.map(row=>row.label),['wrong-branch-author','wrong-consumer-digest']);
  assert.deepEqual(archive.negativeTransactions.map(row=>row.decodedRollback),['Only the designated branch author may submit','Certificate or plan digest does not match consumer intent']);
  return {verified:true,successfulWrites:archive.transactions.length,expectedRejections:archive.negativeTransactions.length,results};
}
