const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
const root = process.env.ASSET_TEST_SOURCE || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'รหัส.js'), 'utf8');
const quiet = { log() {}, warn() {}, error() {} };
const req = '11111111-1111-4111-8111-111111111111';
const req2 = '22222222-2222-4222-8222-222222222222';
function sourceFunction(source, name) {
  const re = new RegExp('^(?:async )?function ' + name + '\\(', 'm');
  const match = re.exec(source);
  if (!match) throw new Error('Missing function ' + name);
  const tail = source.slice(match.index);
  const end = tail.indexOf('\n}');
  assert(end > 0);
  return tail.slice(0, end + 2);
}
function load(ctx, source, names) { for (const name of names) vm.runInContext(sourceFunction(source, name), ctx); }
function fixtureRow(id, name) {
  const row = Array(54).fill('');
  row[0] = id; row[1] = name; row[2] = 'ขายฝาก'; row[15] = 123456;
  row[36] = 'deed-' + id; row[37] = 'location-' + id; row[38] = 'transaction-' + id; row[39] = 'vdo-' + id;
  row[40] = 'old-created'; row[42] = 'ประวัติชำระเดิม'; row[53] = '=SUM(1,2)';
  return row;
}
function makeSheet(rows, state) {
  return { rows,
    getLastRow() { return this.rows.length; }, getLastColumn() { return 54; },
    getDataRange() { return { getValues: () => this.rows.map(row => row.slice()) }; },
    deleteRow(row) { state.deletions++; this.rows.splice(row - 1, 1); },
    getRange(row, col, nr = 1, nc = 1) {
      assert(row > 0 && nr > 0 && col > 0);
      return {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => this.rows[row + i - 1]?.[col + j - 1] ?? '')),
        setValues: values => {
          state.writes++;
          for (let i = 0; i < nr; i++) {
            while (this.rows.length < row + i) this.rows.push([]);
            for (let j = 0; j < nc; j++) this.rows[row + i - 1][col + j - 1] = values[i][j];
          }
          if (state.failAfterWrite) { state.failAfterWrite = false; throw new Error('lost write acknowledgment'); }
        },
        setValue: value => {
          state.writes++;
          while (this.rows.length < row) this.rows.push([]);
          this.rows[row - 1][col - 1] = value;
        },
        clearContent: () => { state.clears = (state.clears || 0) + 1; for(let i=0;i<nr;i++)for(let j=0;j<nc;j++)this.rows[row+i-1][col+j-1]=''; },
        getValue: () => this.rows[row - 1]?.[col - 1] ?? ''
      };
    }
  };
}
function gasFixture() {
  const state = { writes: 0, deletions: 0, folderCreates: 0, fileCreates: 0, lockHeld: false, busy: false, failFolderAt: 0 };
  const db = makeSheet([Array(54).fill('header'), fixtureRow('01', 'Existing A'), fixtureRow('03', 'Existing B')], state);
  const client = makeSheet([['header'], ['01', 'old-main-1'], ['03', 'old-main-3'], ['99', 'preserve-client-only']], state);
  const props = new Map();
  const folders = new Map();
  const user = { email: 'admin@example.test', class: 'admin' };
  function makeFolder(id) {
    const folder = { id, files: new Map(), getId: () => id, getName: () => id, setTrashed(value) { this.trashed = value; },
      createFolder(name) {
        state.folderCreates++;
        if (state.failFolderAt === state.folderCreates) throw new Error('Drive temporarily unavailable');
        const child = makeFolder('created-' + state.folderCreates); child.name = name;
        return child;
      },
      getFilesByName(name) { const file = this.files.get(name); return { hasNext: () => !!file, next: () => file }; },
      createFile(blob) {
        if (state.failUpload || blob.name.includes('fail')) throw new Error('Drive write denied');
        state.fileCreates++;
        const file = { getId: () => 'file-' + state.fileCreates, getName: () => blob.name, getUrl: () => 'https://example.test/file', setSharing() {} };
        this.files.set(blob.name, file); return file;
      }
    };
    folders.set(id, folder); return folder;
  }
  makeFolder('root');
  for (const row of db.rows.slice(1)) for (const id of row.slice(36, 40)) makeFolder(id);
  const properties = { getProperty: key => props.get(key) || null, setProperty(key, value) { props.set(key, value); }, getProperties: () => Object.fromEntries(props) };
  const ctx = vm.createContext({ console: quiet, FOLDER_ROOT: 'root',
    getCurrentUser: () => user, getCurrentUserWithSessionKey: key => key === 'session' ? user : null,
    PropertiesService: { getScriptProperties: () => properties },
    LockService: { getScriptLock: () => {
      let held = false;
      return { waitLock() { if (state.busy || state.lockHeld) throw new Error('lock busy'); held = true; state.lockHeld = true; }, hasLock: () => held, releaseLock() { held = false; state.lockHeld = false; } };
    } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => name === 'DATABASE' ? db : client }), flush() {} },
    DriveApp: { getFolderById(id) { assert(folders.has(id), 'unknown folder ' + id); return folders.get(id); }, Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' } },
    Utilities: { base64Decode: value => value, newBlob: (bytes, mime, name) => ({ bytes, mime, name }) }
  });
  load(ctx, backend, ['getNextRowNumber', 'findRowByNumber', 'reserveNextRowAndFolders', 'deleteIncompleteData', 'uploadFilesByCategory']);
  for (const name of ['assetReservationKey_', 'assetReservationRow_', 'protectAssetReservation_']) if (backend.includes('function ' + name)) load(ctx, backend, [name]);
  const oldDb = structuredClone(db.rows), oldClient = structuredClone(client.rows);
  return { ctx, db, client, props, state, folders, user, oldDb, oldClient,
    create: (id = req, name = 'New asset') => JSON.parse(ctx.reserveNextRowAndFolders(name, id, 'session')),
    unchanged() { assert.deepEqual(db.rows.slice(0, oldDb.length), oldDb); assert.deepEqual(client.rows.slice(0, oldClient.length), oldClient); }
  };
}
const oneFile = name => [{ name, data: 'data:image/png;base64,AA==', mimeType: 'image/png' }];

test('backend and every inline frontend script compile', () => {
  new vm.Script(backend);
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || /application\/ld\+json/.test(match[1])) continue;
    new vm.Script(match[2]); count++;
  }
  assert(count > 0);
});
test('replayed create request returns one row and one folder tree; existing sheet cells are unchanged', () => {
  const f = gasFixture(); const a = f.create(); const writes = f.state.writes;
  const b = f.create();
  assert.equal(a.status, 'success'); assert.deepEqual(b, a);
  assert.equal(f.db.rows.length, f.oldDb.length + 1); assert.equal(f.client.rows.length, f.oldClient.length + 1);
  assert.equal(f.state.folderCreates, 5); assert.equal(f.state.writes, writes); f.unchanged();
});
test('different request IDs get distinct asset IDs without overwriting CLIENT rows', () => {
  const f = gasFixture(); const a = f.create(); const b = f.create(req2, 'Another asset');
  assert.equal(a.status, 'success'); assert.equal(b.status, 'success'); assert.notEqual(a.rowNumber, b.rowNumber); f.unchanged();
});
test('legacy unidentifiable create requests fail before any sheet/Drive writes', () => {
  const fresh = gasFixture(); const result = JSON.parse(fresh.ctx.reserveNextRowAndFolders('Legacy'));
  assert.equal(result.status, 'error'); assert.equal(fresh.state.writes, 0); assert.equal(fresh.state.folderCreates, 0);
});
test('creation resumes the same reservation after a folder error and a competing new request', () => {
  const f = gasFixture(); f.state.failFolderAt = 3;
  assert.equal(f.create().status, 'error');
  f.state.failFolderAt = 0;
  const other = f.create(req2, 'Other'); const resumed = f.create();
  assert.equal(resumed.status, 'success'); assert.notEqual(resumed.rowNumber, other.rowNumber);
  assert.equal(f.db.rows.length, f.oldDb.length + 2); f.unchanged();
});
test('lost sheet write acknowledgment is recovered without a duplicate row', () => {
  const f = gasFixture(); f.state.failAfterWrite = true;
  assert.equal(f.create().status, 'error'); assert.equal(f.create().status, 'success');
  assert.equal(f.db.rows.length, f.oldDb.length + 1); assert.equal(f.state.folderCreates, 5); f.unchanged();
});
test('lock contention and invalid sessions cause zero data writes', () => {
  const f = gasFixture(); f.state.busy = true;
  assert.equal(f.create().status, 'error'); f.state.busy = false;
  assert.equal(JSON.parse(f.ctx.reserveNextRowAndFolders('No', req, 'invalid')).status, 'error');
  assert.equal(f.state.writes, 0); assert.equal(f.state.folderCreates, 0);
});
test('same request ID cannot be used with a different asset name', () => {
  const f = gasFixture(); f.create(); const writes = f.state.writes;
  assert.equal(f.create(req, 'Changed name').status, 'error'); assert.equal(f.state.writes, writes); f.unchanged();
});
test('draft cleanup without a token cannot delete an old row or folder', () => {
  const f = gasFixture(); const result = JSON.parse(f.ctx.deleteIncompleteData('01', 'old-main-1'));
  assert.equal(result.skipped, true); assert.equal(f.state.deletions, 0); f.unchanged();
});
test('only the matching empty new draft can be cancelled; repeated cleanup is harmless', () => {
  const f = gasFixture(); const a = f.create();
  assert.equal(JSON.parse(f.ctx.deleteIncompleteData('01', a.mainFolderId, req, 'session')).skipped, true);
  const result = JSON.parse(f.ctx.deleteIncompleteData(a.rowNumber, a.mainFolderId, req, 'session'));
  assert.equal(result.status, 'success'); assert.equal(f.state.deletions, 0); assert.equal(f.state.clears, 2); f.unchanged();
  assert.equal(JSON.parse(f.ctx.deleteIncompleteData(a.rowNumber, a.mainFolderId, req, 'session')).skipped, true);
  assert.equal(f.create().status, 'error');
});
test('saved or externally filled draft cannot be deleted by form cleanup', () => {
  const f = gasFixture(); const a = f.create();
  f.ctx.protectAssetReservation_({ ...a, requestId: req }, f.user);
  assert.equal(JSON.parse(f.ctx.deleteIncompleteData(a.rowNumber, a.mainFolderId, req, 'session')).skipped, true);
  const b = f.create(req2, 'Manual data'); const row = f.ctx.findRowByNumber(b.rowNumber);
  f.db.rows[row - 1][42] = 'Payment entered directly in sheet';
  assert.equal(JSON.parse(f.ctx.deleteIncompleteData(b.rowNumber, b.mainFolderId, req2, 'session')).skipped, true);
  assert.equal(f.state.deletions, 0); f.unchanged();
});
test('upload resolves the actual asset row with gaps, and does not change sheet cells', () => {
  const f = gasFixture(); const result = JSON.parse(f.ctx.uploadFilesByCategory(oneFile('ok.png'), '03', 'deed'));
  assert.equal(result.status, 'success'); assert.equal(result.assetId, '03'); assert.equal(result.targetSheetRow, 3);
  assert.equal(result.targetFolder, 'deed-03'); assert.equal(f.state.writes, 0); f.unchanged();
});
test('upload returns errors for missing asset, missing folder, and Drive failure', () => {
  const f = gasFixture();
  assert.equal(JSON.parse(f.ctx.uploadFilesByCategory(oneFile('ok.png'), '20', 'deed')).status, 'error');
  assert.equal(JSON.parse(f.ctx.uploadFilesByCategory(oneFile('ok.png'), '03', 'unknown')).status, 'error');
  f.state.failUpload = true;
  const result = JSON.parse(f.ctx.uploadFilesByCategory(oneFile('fail.png'), '01', 'deed'));
  assert.equal(result.status, 'error'); assert.equal(result.uploadedFiles.length, 0); assert.equal(result.failedFiles.length, 1); f.unchanged();
});
test('retrying an upload name returns the existing file without creating a duplicate', () => {
  const f = gasFixture();
  const a = JSON.parse(f.ctx.uploadFilesByCategory(oneFile('once.png'), '01', 'deed'));
  const b = JSON.parse(f.ctx.uploadFilesByCategory(oneFile('once.png'), '01', 'deed'));
  assert.equal(a.status, 'success'); assert.equal(b.status, 'success'); assert.equal(f.state.fileCreates, 1); f.unchanged();
});

function uiFixture() {
  const elements = new Map(), calls = [], alerts = [], pending = [], progress = [];
  const storage = () => { const map = new Map(); return {getItem:key => map.get(key) || null, setItem:(key,value) => map.set(key,value), removeItem:key => map.delete(key)}; };
  const localStorage = storage(), sessionStorage = storage(); localStorage.setItem('userSessionKey', 'session');
  function element(id) {
    if (!elements.has(id)) elements.set(id, { id, value:'', style:{}, dataset:{}, files:[], innerHTML:'', disabled:false,
      classList:{add(){},remove(){},toggle(){}}, reset(){}, removeAttribute(key) {if(key==='data-saved')delete this.dataset.saved;},
      setAttribute(key,value) {if(key==='data-saved')this.dataset.saved=value;}, getAttribute(key) {return key==='data-saved'?this.dataset.saved:null;} });
    return elements.get(id);
  }
  const ids = ['deedImages','locationImages','transactionImages','vdoFiles'];
  for (const id of ids) {
    const input = element(id), label = {style:{}};
    const container = {header:null, querySelector(selector) {return selector==='label'?label:selector==='input[type="file"]'?input:this.header;},
      querySelectorAll() {return this.header?[this.header]:[];}, insertBefore(header) {header.remove=()=>{this.header=null;};this.header=header;} };
    input.closest=()=>container;
  }
  let modalShows = 0;
  const ctx = vm.createContext({ console:quiet, crypto, window:{}, currentUserClass:'admin', localStorage, sessionStorage,
    document:{getElementById:element, querySelectorAll:()=>[], createElement:()=>({})},
    assetNameModal:{show(){},hide(){}},assetModal:{show(){modalShows++;},hide(){}},
    showProgress(){}, hideProgress(){}, updateProgress:(message,value)=>progress.push({message,value}), showAlert:message=>alerts.push(message),
    autoCalc(){}, calculateLandSize(){}, updateSummary(){}, setThaiDateSelectorValue(){},
    FileReader:class {readAsDataURL() {this.result='data:image/png;base64,AA==';this.onload();}},
    google:{script:{get run(){let success,failure;const target={withSuccessHandler(fn){success=fn;return proxy;},withFailureHandler(fn){failure=fn;return proxy;}};
      const proxy=new Proxy(target,{get(obj,key){return obj[key]||((...args)=>{calls.push({fn:key,args});pending.push({success,failure});});}});return proxy;}}}
  });
  vm.runInContext('var isCreatingAsset=false, currentRowData=null, pendingAssetCreation=null, assetFormRevision=0, isSubmitting=false; var assetUploadNames=new WeakMap();',ctx);
  const names=['showAssetNameModal','createAsset','resetForm','disableFileUploadsInEditMode','uploadFiles','uploadAllFiles'];
  if(html.includes('function clearAssetForm()'))names.push('clearAssetForm');
  load(ctx,html,names);
  return {ctx,element,calls,alerts,pending,progress,ids,sessionStorage,modalShows:()=>modalShows,
    finishCreate() {pending.shift().success(JSON.stringify({status:'success',rowNumber:'04',mainFolderId:'new-main',assetName:'New asset',requestId:req}));}
  };
}
test('double-click create dispatches one RPC until the first completes', () => {
  const f=uiFixture();f.element('newAssetName').value='New asset';f.ctx.createAsset();f.ctx.createAsset();
  assert.equal(f.calls.length,1);assert.equal(f.element('createAssetBtn').disabled,true);
});
test('lost create response retries the same request ID, including after reopening the modal', () => {
  const f=uiFixture();f.element('newAssetName').value='New asset';f.ctx.createAsset();const first=f.calls[0];
  f.pending.shift().failure(new Error('lost response'));f.ctx.showAssetNameModal();f.ctx.createAsset();
  assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1].args,first.args);assert(first.args[1]);
});
test('edit -> close -> create restores all file inputs and clears old request state', () => {
  const f=uiFixture();f.element('isEditMode').value='true';f.ctx.disableFileUploadsInEditMode();f.ctx.resetForm();
  f.element('newAssetName').value='New asset';f.ctx.createAsset();f.finishCreate();
  assert.equal(f.element('isEditMode').value,'false');assert(f.ids.every(id=>f.element(id).style.display===''));
  assert.equal(f.element('rowNumber').value,'04');assert(f.element('assetForm').dataset.requestId);assert.equal(f.modalShows(),1);
});
test('closing after a save attempt never requests draft deletion', () => {
  const f=uiFixture();f.element('rowNumber').value='04';f.element('mainFolderId').value='main';f.element('isEditMode').value='false';
  f.element('assetForm').dataset.requestId=req;f.element('assetForm').dataset.saveAttempted='true';f.ctx.resetForm();
  assert.equal(f.calls.length,0);
});
test('closing a new unsaved draft passes the reservation token and session to cleanup', () => {
  const f=uiFixture();f.element('rowNumber').value='04';f.element('mainFolderId').value='main';f.element('isEditMode').value='false';
  f.element('assetForm').dataset.requestId=req;f.ctx.resetForm();
  assert.equal(f.calls[0].fn,'deleteIncompleteData');assert.deepEqual(Array.from(f.calls[0].args),['04','main',req,'session']);
});
test('frontend upload failures are reported and retries keep the same file name', async () => {
  const f=uiFixture(), files=[{name:'photo.png',size:100,type:'image/png'}];
  const a=f.ctx.uploadFiles(files,'04','deed');await new Promise(resolve=>setImmediate(resolve));
  const firstName=f.calls[0].args[0][0].name;f.pending.shift().failure(new Error('lost response'));
  const failed=await a;assert.equal(failed.status,'error');assert.equal(failed.failedFiles.length,1);
  const b=f.ctx.uploadFiles(files,'04','deed');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls[1].args[0][0].name,firstName);
  f.pending.shift().success(JSON.stringify({status:'success',uploadedFiles:[{id:'file'}]}));assert.equal((await b).status,'success');
});
test('aggregate upload does not count failed files as success', async () => {
  const f=uiFixture();f.element('deedImages').files=[{name:'photo.png',size:100,type:'image/png'}];
  const promise=f.ctx.uploadAllFiles('04');const rejected=assert.rejects(promise,/photo.png/);
  await new Promise(resolve=>setImmediate(resolve));f.pending.shift().success(JSON.stringify({status:'error',message:'Drive denied'}));
  await rejected;assert(f.progress.at(-1).message.includes('0/1'));
});
test('new reservation RPC is not retried automatically after an ambiguous network failure', async () => {
  let requests=0;const ctx=vm.createContext({window:{},console:quiet,setTimeout:fn=>fn(),fetch:async()=>{requests++;throw new Error('response lost');}});
  const start=html.indexOf('(function () {\n  // ใส่ Web App URL');const end=html.indexOf('\n</script>',start);
  vm.runInContext(html.slice(start,end),ctx);
  await new Promise(resolve=>ctx.window.google.script.run.withFailureHandler(resolve).reserveNextRowAndFolders('New asset',req,'session'));
  assert.equal(requests,1);
});

test('changed row identities are rejected on replay and save, preserving the replaced data', () => {
  const f = gasFixture(); const created = f.create();
  const row = f.ctx.findRowByNumber(created.rowNumber);
  f.db.rows[row - 1][1] = 'Different existing asset';
  const before = structuredClone(f.db.rows);
  assert.equal(f.create().status, 'error');
  assert.throws(() => f.ctx.protectAssetReservation_({ ...created, requestId: req }, f.user));
  assert.deepEqual(f.db.rows, before);
});
test('empty cancelled rows are hidden while existing populated rows and permissions are preserved', () => {
  const f = gasFixture(); load(f.ctx, backend, ['filterDataByPermission']);
  const existing = f.db.rows.slice(1); const blank = Array(54).fill('');
  assert.equal(f.ctx.filterDataByPermission([...existing, blank], f.user).length, existing.length);
  assert.equal(f.ctx.filterDataByPermission([...existing, blank], {class:'user1',linkedInvestor:'unmatched'}).length, 0);
  f.unchanged();
});

test('an existing CLIENT-only asset number is skipped, never overwritten', () => {
  const f = gasFixture(); f.client.rows.push(['04', 'existing-orphan-folder']);
  const before = structuredClone(f.client.rows);
  const result = f.create();
  assert.equal(result.status, 'success'); assert.equal(result.rowNumber, '05');
  assert.deepEqual(f.client.rows.slice(0, before.length), before);
});
