// Plan-only unless an explicit execution flag is supplied. No real assets.
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {ROOT,LOCAL,CHAIN_ID,RPC,EXPLORER,reader,readJson,readJsonContract,saveJson,acquireLock,testActor,Journal} from './runtime.mjs';
import {canonicalJson,sha256,verifyScenario,verifyArchive} from '../lib/evidence.js';
import {summarizeReceipt} from '../lib/receipt.js';

const options=process.argv.slice(2),flag=name=>options.includes(name);
const option=name=>{const inline=options.find(arg=>arg.startsWith(name+'='));if(inline)return inline.slice(name.length+1);const i=options.indexOf(name);return i>=0?options[i+1]:undefined;};
const deploying=flag('--deploy'),running=flag('--run');
const preset=await readJson(new URL('demo-preset.json',import.meta.url));
if(flag('--plan')||(!deploying&&!running)){
  console.log(JSON.stringify({planOnly:true,chainId:CHAIN_ID,network:'GenLayer Studionet',value:'0',leaderOnly:false,
    deployCommand:'node scripts/live-test.mjs --deploy --source-sha=<reviewed-main-sha256> --consumer-source-sha=<reviewed-consumer-sha256>',
    runCommand:'node scripts/live-test.mjs --run',contracts:2,scenarios:preset.scenarios.map(row=>row.fixture),
    successfulWorkflowWrites:14,expectedRejectionWrites:2,notice:preset.notice},null,2));process.exit(0);
}
const source=await readFile(new URL('contracts/revisionweave.py',ROOT),'utf8');
const consumerSource=await readFile(new URL('contracts/consumer.py',ROOT),'utf8');
const sourceSha256=sha256(source),consumerSourceSha256=sha256(consumerSource);
if(deploying){
  assert.equal(option('--source-sha'),sourceSha256,'Deployment requires the reviewed main source SHA-256.');
  assert.equal(option('--consumer-source-sha'),consumerSourceSha256,'Deployment requires the reviewed consumer source SHA-256.');
}
const unlock=await acquireLock();
const recovery={recoverLabel:option('--recover-label'),recoverHash:option('--recover-hash')};
try{
  let config=await readJson(new URL('public/deployment.json',ROOT),null);
  if(deploying){
    const domainPath=new URL(`domain-${sourceSha256}.json`,LOCAL);
    let domain=await readJson(domainPath,null);
    if(!domain){domain={value:randomBytes(32).toString('hex')};await saveJson(domainPath,domain);}
    const deploymentDomain=domain.value;
    assert.match(deploymentDomain,/^[a-f0-9]{64}$/);
    const deployer=await testActor('deployer');
    const journal=await Journal.load(new URL(`deployment-${sourceSha256}-${consumerSourceSha256}.json`,LOCAL),{chainId:CHAIN_ID,sourceSha256,consumerSourceSha256,deploymentDomain,deployer:deployer.account.address});
    const first=await journal.transact('deploy-weave',{kind:'deploy',actor:deployer.account.address,sourceSha256,args:[deploymentDomain],value:'0',leaderOnly:false},()=>deployer.deployContract({code:source,args:[deploymentDomain],leaderOnly:false}),recovery);
    const address=first.data?.contract_address??first.txDataDecoded?.contractAddress??first.to_address;
    assert.match(address??'',/^0x[0-9a-f]{40}$/i);assert.equal(sha256(await reader.getContractCode(address)),sourceSha256);
    const metadata=await readJsonContract(address,'get_metadata',[]);
    assert.equal(metadata.deployment_domain,deploymentDomain);
    const second=await journal.transact('deploy-consumer',{kind:'deploy',actor:deployer.account.address,sourceSha256:consumerSourceSha256,args:[address,deploymentDomain],value:'0',leaderOnly:false},()=>deployer.deployContract({code:consumerSource,args:[address,deploymentDomain],leaderOnly:false}),recovery);
    const consumerAddress=second.data?.contract_address??second.txDataDecoded?.contractAddress??second.to_address;
    assert.match(consumerAddress??'',/^0x[0-9a-f]{40}$/i);assert.equal(sha256(await reader.getContractCode(consumerAddress)),consumerSourceSha256);
    const consumerMetadata=await readJsonContract(consumerAddress,'get_provider',[]);
    assert.equal(consumerMetadata.provider,address.toLowerCase());assert.equal(consumerMetadata.deployment_domain,deploymentDomain);
    const historyPath=new URL('public/evidence/deployments.json',ROOT);
    const history=await readJson(historyPath,{notice:'Historical test deployments; a deployed contract is not evidence of a complete workflow.',deployments:[]});
    if(config?.deployed&&!history.deployments.some(row=>row.address===config.address))history.deployments.push(config);
    config={deployed:true,network:'GenLayer Studionet',chainId:CHAIN_ID,rpc:RPC,explorer:EXPLORER,address,consumerAddress,
      sourceSha256,consumerSourceSha256,deploymentDomain,deployer:deployer.account.address,
      deploymentTransactions:journal.state.transactions.map(row=>({hash:row.hash,label:row.label,receipt:row.label==='deploy-weave'?summarizeReceipt(first):summarizeReceipt(second)})),
      verifiedAt:new Date().toISOString(),notice:preset.notice};
    if(!history.deployments.some(row=>row.address===address))history.deployments.push(config);
    await saveJson(historyPath,history);await saveJson(new URL('public/deployment.json',ROOT),config);
    console.log(JSON.stringify({deployed:true,address,consumerAddress,sourceSha256,consumerSourceSha256}));
  }
  if(running){
    assert.ok(config?.deployed,'Deploy both reviewed contracts first.');assert.equal(config.chainId,CHAIN_ID);assert.equal(config.rpc,RPC);
    assert.equal(config.sourceSha256,sourceSha256);assert.equal(config.consumerSourceSha256,consumerSourceSha256);
    assert.equal(sha256(await reader.getContractCode(config.address)),sourceSha256);
    assert.equal(sha256(await reader.getContractCode(config.consumerAddress)),consumerSourceSha256);
    const coordinator=await testActor('coordinator'),left=await testActor('left-author'),right=await testActor('right-author'),consumer=await testActor('consumer');
    const actors={coordinator:coordinator.account.address,left:left.account.address,right:right.account.address,consumer:consumer.account.address};
    assert.equal(new Set(Object.values(actors).map(address=>address.toLowerCase())).size,4);
    const identity={chainId:CHAIN_ID,address:config.address,consumerAddress:config.consumerAddress,sourceSha256,consumerSourceSha256,
      deploymentDomain:config.deploymentDomain,presetDigest:sha256(canonicalJson(preset)),actors};
    const journal=await Journal.load(new URL(`workflow-${config.address.toLowerCase()}.json`,LOCAL),identity);
    const negatives=await Journal.load(new URL(`negative-workflow-${config.address.toLowerCase()}.json`,LOCAL),{...identity,purpose:'expected author and consumer rejection'});
    const send=(label,actor,address,method,args)=>journal.transact(label,{kind:'call',address,actor:actor.account.address,method,args,value:'0',leaderOnly:false},()=>actor.writeContract({address,functionName:method,args,value:0n,leaderOnly:false}),recovery);
    const read=(method,args)=>readJsonContract(config.address,method,args);
    const scenarios=[];
    for(const fixture of preset.scenarios){
      const owner=actors.coordinator,id=fixture.id;
      await send(`${id}-create`,coordinator,config.address,'create_weave',[id,actors.left,actors.right,preset.scope,canonicalJson(fixture.base)]);
      const {plan}=await read('get_weave',[owner,id]);
      await send(`${id}-left`,left,config.address,'submit_branch',[owner,id,'LEFT',plan.base_digest,canonicalJson(fixture.left)]);
      await send(`${id}-right`,right,config.address,'submit_branch',[owner,id,'RIGHT',plan.base_digest,canonicalJson(fixture.right)]);
      const branches=[await read('get_branch',[owner,id,'LEFT']),await read('get_branch',[owner,id,'RIGHT'])];
      await send(`${id}-propose`,coordinator,config.address,'propose_merge',[id,canonicalJson(fixture.choices)]);
      const proposal=await read('get_proposal',[owner,id,1]);
      await send(`${id}-attest`,right,config.address,'attest_merge',[owner,id,1,proposal.digest]);
      const attestation=await read('get_attestation',[owner,id,1]);
      assert.equal(attestation.reconciliation.status,'READY','Consensus did not establish a certifiable candidate; retain the journal and inspect, do not label it success.');
      await send(`${id}-certify`,coordinator,config.address,'certify',[id,1,attestation.digest]);
      const certificate=await read('get_certificate',[owner,id]);
      await send(`${id}-consume`,consumer,config.consumerAddress,'consume',[owner,id,id+'-receipt',certificate.digest,certificate.plan_digest]);
      const receipt=await readJsonContract(config.consumerAddress,'get_receipt',[actors.consumer,id+'-receipt']);
      const item={fixture:fixture.fixture,plan,branches,proposal,attestation,certificate,receipt};
      verifyScenario(item,config,actors);scenarios.push(item);
      console.log(JSON.stringify({fixture:fixture.fixture,certificateDigest:certificate.digest}));
    }
    const owner=actors.coordinator,id=preset.scenarios[0].id,certificate=scenarios[0].certificate;
    const wrongAuthorArgs=[owner,id,'LEFT',scenarios[0].plan.base_digest,canonicalJson(preset.scenarios[0].left)];
    await negatives.transactExpectedRollback('wrong-branch-author',{kind:'call',address:config.address,actor:actors.consumer,method:'submit_branch',args:wrongAuthorArgs,value:'0',leaderOnly:false},()=>consumer.writeContract({address:config.address,functionName:'submit_branch',args:wrongAuthorArgs,value:0n,leaderOnly:false}),'Only the designated branch author may submit',recovery);
    const wrongDigestArgs=[owner,id,'wrong-digest','0'.repeat(64),certificate.plan_digest];
    await negatives.transactExpectedRollback('wrong-consumer-digest',{kind:'call',address:config.consumerAddress,actor:actors.consumer,method:'consume',args:wrongDigestArgs,value:'0',leaderOnly:false},()=>consumer.writeContract({address:config.consumerAddress,functionName:'consume',args:wrongDigestArgs,value:0n,leaderOnly:false}),'Certificate or plan digest does not match consumer intent',recovery);
    const negativeReceiptReadBack=await readJsonContract(config.consumerAddress,'get_receipt',[actors.consumer,'wrong-digest']);
    assert.equal(negativeReceiptReadBack,null);await journal.refresh();
    const archive={verified:true,recordedAt:new Date().toISOString(),network:config.network,chainId:CHAIN_ID,
      contractAddress:config.address,consumerAddress:config.consumerAddress,contractSourceSha256:sourceSha256,consumerSourceSha256,
      deploymentDomain:config.deploymentDomain,presetDigest:identity.presetDigest,notice:preset.notice,actors,scenarios,
      negativeReceiptReadBack,transactions:journal.state.transactions,negativeTransactions:negatives.state.transactions};
    const result=verifyArchive(archive,config,preset);await saveJson(new URL('public/evidence/demo.json',ROOT),archive);
    console.log(JSON.stringify({complete:true,...result}));
  }
}finally{await unlock();}
