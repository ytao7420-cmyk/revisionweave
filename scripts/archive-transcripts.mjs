// Read-only on chain; refreshes selected public RPC evidence locally.
import {verifySavedEvidence} from './verify-evidence.mjs';
console.log(JSON.stringify({readOnly:true,...await verifySavedEvidence({chain:true})},null,2));
