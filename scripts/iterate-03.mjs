import fs from 'node:fs';
const update=(file,fn)=>fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));
const replace=(s,a,b)=>{if(!s.includes(a))throw Error('Missing '+a.slice(0,100));return s.replace(a,b)};
update('core/store.mjs',s=>{
s=replace(s,'"setPayday",','"setPayday",\n      "adjustCycle",');
s=replace(s,'    const source = ["EXPENSE", "TRANSFER"].includes(kind) ? p.source_id : null,','    const source = ["EXPENSE", "TRANSFER"].includes(kind) ? p.source_id : null,');
s=replace(s,'    let cv = null,',`    if (source && this.settings().allow_negative !== true) {
      const balances = this.balances(addDays(s, 1));
      const current = this.balances();
      let available = balances[source] ?? 0n, availableNow = current[source] ?? 0n;
      if (old && !old.deleted) {
        const effect = (old.source_id === source ? -BigInt(old.amount_minor) : 0n) + (old.destination_id === source ? BigInt(old.amount_minor) : 0n);
        if (old.date <= s) available -= effect;
        availableNow -= effect;
      }
      ensure(value <= available && value <= availableNow, "付款账户余额不足：请核对日期、期初余额及漏记收入；历史补录可在偏好设置开启允许负余额。");
    }
    let cv = null,`);
s=replace(s,'      locale: p.locale ?? old.locale ?? "zh-CN",','      locale: p.locale ?? old.locale ?? "zh-CN",\n      allow_negative: p.allow_negative === undefined ? !!old.allow_negative : p.allow_negative === true,');
const start=s.indexOf('    ensure(\n      !this.one(\n        "SELECT id FROM cycle_rules WHERE effective_from>=?",');
const end=s.indexOf('    this.audit(',start);
if(start<0||end<0)throw Error('payday');
s=s.slice(0,start)+`    const pending = this.one("SELECT * FROM cycle_rules WHERE effective_from=?", current.end);
    if (pending) this.run("UPDATE cycle_rules SET payday=? WHERE id=?", payday, pending.id);
    else this.run("INSERT INTO cycle_rules VALUES(?,?,?)", id(), current.end, payday);
`+s.slice(end);
s=replace(s,'  saveSettings(p) {',`  adjustCycle(p) {
    const c=this.one("SELECT * FROM cycles WHERE id=?",p.id);
    ensure(c && c.status!=='CLOSED', '请先重新打开周期');
    ensure(!this.one('SELECT id FROM settlements WHERE cycle_id=?',c.id), '已有结算快照的周期不能重划边界，请仅修改下期工资日');
    const start=date(p.start),end=date(p.end);
    ensure(start<end && start<=this.clock() && end>this.clock(), '当前周期必须包含今天，结束日期不计入本周期');
    const previous=this.one('SELECT * FROM cycles WHERE end<=? AND id!=? ORDER BY end DESC LIMIT 1',c.start,c.id);
    const next=this.one('SELECT * FROM cycles WHERE start>=? AND id!=? ORDER BY start LIMIT 1',c.end,c.id);
    ensure(!previous || start===previous.end, '起点必须衔接已有上一周期');
    ensure(!next || end===next.start, '终点必须衔接已有下一周期');
    ensure(!this.one('SELECT id FROM transactions WHERE cycle_id=? AND deleted=0 AND (date<? OR date>=?)',c.id,start,end), '调整会排除已有交易，请保留包含这些交易的范围');
    ensure(!this.one('SELECT id FROM cycle_rules WHERE effective_from>=?',c.end), '请先让待生效工资日生效，再修改周期边界');
    this.run('UPDATE cycles SET start=?,end=?,revision=revision+1 WHERE id=?',start,end,c.id);
    this.audit('cycle',c.id,c,this.one('SELECT * FROM cycles WHERE id=?',c.id),safeNote(p.reason));
    return {id:c.id};
  }
  saveSettings(p) {`);
s=replace(s,'      nextCycleMissing: !current,',`      occurrenceHistory: this.all("SELECT * FROM bill_occurrences WHERE status!='PENDING' ORDER BY due_date DESC LIMIT 100").map(b=>({...b,amount_minor:String(b.amount_minor)})),
      refundTotals: Object.fromEntries(this.all("SELECT original_id,SUM(amount_minor) amount FROM transactions WHERE kind='REFUND' AND deleted=0 GROUP BY original_id").map(r=>[r.original_id,String(r.amount)])),
      nextCycleMissing: !current,`);
s=replace(s,'    return {\n      settings,\n      today: this.clock(),',`    if(p.analysis){
      const length=Math.round((new Date(end+'T00:00:00Z')-new Date(start+'T00:00:00Z'))/86400000);
      report.previous=this.report(addDays(start,-length),start,p.account_id||null);
      const stmt=this.db.prepare("SELECT v.id,v.name,SUM(t.amount_minor) amount FROM transactions t JOIN category_versions v ON v.id=t.category_version_id WHERE t.deleted=0 AND t.kind='INCOME' AND t.date>=? AND t.date<? GROUP BY v.id ORDER BY amount DESC");stmt.setReadBigInts(true);
      report.incomeGroups=stmt.all(start,end).map(r=>({...r,amount:String(r.amount)}));
    }
    return {
      settings,
      today: this.clock(),`);
s=s.replace('app_version: "0.2.0"','app_version: "0.3.0"');
return s;
});
