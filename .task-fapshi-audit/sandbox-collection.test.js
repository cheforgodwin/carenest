import { describe, it, expect, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
const state = vi.hoisted(() => ({ order: null, orderRef: null, uid: '', firestoreId: '' }));
vi.mock('../api/_firebaseAdmin.js', () => ({
  requireAuthenticatedUser: async () => ({uid:state.uid}),
  getAdminDb: () => ({
    collection: name => ({doc: id => {
      if(name==='serviceRequests') { if(id!==state.firestoreId)throw Error('Unexpected order');return state.orderRef; }
      if(name==='paymentRateLimits')return {get:async()=>({data:()=>({})})};
      throw Error('Unexpected collection');
    }}),
    runTransaction: async callback => callback({get: ref=>ref.get(),set:()=>{},update:(_ref,patch)=>Object.assign(state.order,patch)}),
  }),
}));
import handler from '../api/fapshi.js';
import webhook from '../api/fapshi-webhook.js';
import { getFapshiConfig, getFapshiBaseUrl } from '../api/_fapshi.js';
function response(){return {setHeader(){},end(value){this.body=JSON.parse(value)}}}
const reports=[];
describe('real Fapshi sandbox with isolated in-memory CareNest order',()=>{
  it.each([['670000000','SUCCESSFUL','Paid'],['670000001','FAILED','Failed']])('verifies sandbox phone %s',async(phone,expectedProvider,expectedOrder)=>{
    process.env.FAPSHI_MODE='sandbox';
    process.env.FAPSHI_PAYMENT_FLOW='direct';
    process.env.FAPSHI_SANDBOX_API_URL='https://sandbox.fapshi.com/initiate-pay';
    const {apiUrl,apiUser,apiKey}=getFapshiConfig();
    const base=getFapshiBaseUrl(apiUrl);
    expect(base).toBe('https://sandbox.fapshi.com');
    const originalFetch=globalThis.fetch;
    vi.stubGlobal('fetch',async(input,options)=>{
      if(new URL(input).origin!==base)throw Error('Only Fapshi sandbox requests are permitted');
      return originalFetch(input,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
    });
    state.uid='audit-sandbox-customer';state.firestoreId='audit-'+Date.now()+'-'+phone;
    state.order={id:state.firestoreId,customerUid:state.uid,customerPhone:phone,customerName:'Sandbox Audit',amount:100,paymentStatus:'Pending'};
    state.orderRef={get:async()=>({exists:true,data:()=>({...state.order})}),update:async patch=>Object.assign(state.order,patch)};
    try {
      const initiation=response();
      await handler({method:'POST',headers:{},body:{firestoreId:state.firestoreId}},initiation);
      const report={phone,initiationStatus:initiation.statusCode,initiationCode:initiation.body?.code||null,initiationError:initiation.body?.error||null};
      reports.push(report);
      expect(initiation.statusCode).toBe(202);
      expect(state.order.paymentStatus).toBe('Submitted');
      const reference=state.order.paymentReference;expect(reference).toBeTruthy();report.transactionId=reference;
      let payment;
      for(let i=0;i<20;i++){
        const statusResponse=await fetch(base+'/payment-status/'+encodeURIComponent(reference),{headers:{apiuser:apiUser,apikey:apiKey}});
        expect(statusResponse.ok).toBe(true);payment=await statusResponse.json();
        if(['SUCCESSFUL','FAILED'].includes(payment.status))break;
        await new Promise(r=>setTimeout(r,1500));
      }
      report.providerStatus=payment.status;
      expect(payment.status).toBe(expectedProvider);
      const verified=response();
      await webhook({method:'POST',headers:{'x-forwarded-for':'sandbox-audit'},body:{transId:reference}},verified);
      report.webhookStatus=verified.statusCode;report.orderStatus=state.order.paymentStatus;report.verifiedBy=state.order.paymentVerifiedBy;
      expect(verified.statusCode).toBe(200);expect(state.order.paymentStatus).toBe(expectedOrder);expect(state.order.paymentVerifiedBy).toBe('fapshi-webhook');
      console.log(JSON.stringify(report));
    } finally {
      vi.unstubAllGlobals();
      writeFileSync('.task-fapshi-audit/sandbox-results.json',JSON.stringify(reports,null,2));
    }
  },90000);
});
