const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const {startLocalServer}=await import('../server/signdex/local.mjs');
  const service=await startLocalServer({port:0,reviewPreview:true});
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
    const entry={id:crypto.randomUUID(),name:'Friendly Trainer',work:'Art student',city:'Plano',pokemon:'pikachu',game:'emerald',series:'xy',message:'A lovely portfolio!',consent:true};
    assert.equal((await fetch(service.origin+'/signdex-api/signatures',{method:'POST',headers:{Origin:service.origin,'Content-Type':'application/json'},body:JSON.stringify(entry)})).status,202);
    const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(service.origin+'/signdex-api/review/?entry='+entry.id);
    await page.waitForFunction(()=>document.getElementById('focus-entry').textContent.includes('Friendly Trainer'));
    assert.match(await page.locator('#identity').textContent(),/joshj.jeffrey@gmail.com/);
    assert.match(await page.locator('#entries').textContent(),/Pikachu/);
    const book=async()=>await(await fetch(service.origin+'/signdex-api/signatures')).json();
    assert.equal((await book()).total,0); // Opening the emailed link must not approve anything.
    await page.locator('#focus-entry').getByRole('button',{name:'Approve',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('notice').textContent.startsWith('Approved.'));
    assert.equal((await book()).total,1);
    await page.getByRole('button',{name:'Approved',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('entries').textContent.includes('Friendly Trainer'));
    // Fail a request: the entry must remain visible, with an actionable error.
    await page.route('**/review/api/signatures/*',route=>route.request().method()==='PATCH'?route.abort():route.continue());
    await page.locator('#entries').getByRole('button',{name:'Reject',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Could not reach SignDex'));
    assert.equal(await page.locator('#entries .card').count(),1);assert.equal((await book()).total,1);
    await page.unroute('**/review/api/signatures/*');
    await page.locator('#entries').getByRole('button',{name:'Reject',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('notice').textContent.startsWith('Rejected.'));
    assert.equal((await book()).total,0);
    await page.getByRole('button',{name:'Rejected',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('entries').textContent.includes('Friendly Trainer'));
    for(const width of [390,320]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Review desk overflows at '+width);}
    await page.locator('#entries').getByRole('button',{name:'Delete',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'delete-cancel');
    await page.getByRole('button',{name:'Keep signature'}).click();
    assert.equal(await page.locator('#entries .card').count(),1);
    await page.locator('#entries').getByRole('button',{name:'Delete',exact:true}).click();
    await page.getByRole('button',{name:'Delete permanently'}).click();
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('permanently deleted'));
    assert.equal(await page.locator('#entries .card').count(),0);
    assert.match(await page.locator('#focus-entry').textContent(),/deleted/);
    // An expired Access session must not look like an empty inbox.
    await page.route('**/review/api/session',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Sign in through Cloudflare Access.'})}));
    await page.reload();await page.waitForFunction(()=>document.getElementById('identity').textContent==='Sign-in required');
    assert.match(await page.locator('#notice').textContent(),/Sign in/);assert.deepEqual(errors,[]);
    console.log('PASS: private review desk, email deep link, approve/reject/public book, failed-action recovery, delete confirmation, mobile widths, expired session.');
  }finally{if(browser)await browser.close();await service.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
