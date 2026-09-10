import fs from 'node:fs';
let s=fs.readFileSync('src/App.tsx','utf8');
const r=(a,b)=>{if(!s.includes(a))throw Error('Missing '+a.slice(0,100));s=s.replace(a,b)};
r('import { parseMoney, decimal }','import { Help } from "./Help";\nimport { budgetColor } from "../core/presentation.mjs";\nimport { parseMoney, decimal }');
r('  hint?: string;','  hint?: string;\n  explain?: string;\n  visible?: (values: Data) => boolean;\n  presets?: {label: string; value: string}[];');
r('{fields.map((f) => (','{fields.filter(f=>!f.visible || f.visible(values)).map((f) => (');
r('              {f.label}','              {f.label}\n              {f.explain && <span tabIndex={0} className="help-tip" title={f.explain} aria-label={f.explain}><CircleHelp size={15}/></span>}');
r('            {f.hint && f.type !== "checkbox" && <small>{f.hint}</small>}','            {f.hint && f.type !== "checkbox" && <small>{f.hint}</small>}\n            {f.presets && <div className="quick-presets">{f.presets.map(x=><button type="button" key={x.label} onClick={()=>setValues({...values,[f.name]:x.value})}>{x.label}</button>)}</div>}');
r('const d = await api("snapshot", q);','const d = await api("snapshot", {...q, analysis: page === "analysis"});');
r('  }, [JSON.stringify(query)]);','  }, [JSON.stringify(query), page]);');
r('    const fields: Field[] = [','    const refundable = original ? BigInt(original.amount_minor) - BigInt(data?.refundTotals?.[original.id] || "0") : 0n;\n    const fields: Field[] = [');
r('        hint: msg("最多两位小数"),','        hint: type === "REFUND" ? msg("快捷比例按剩余可退金额计算，向下取整到分") : msg("最多两位小数"),\n        presets: type === "REFUND" && !old ? [25,50,75,100].map(n=>({label:n===100?msg("全部剩余退款"):n+"%",value:decimal(String(refundable*BigInt(n)/100n))})) : undefined,');
r('          relevant.map((c: Data) => ({\n            value: c.id,\n            label: `${c.group_name} / ${c.name}`,\n          })),','          [...relevant.map((c: Data) => ({value:c.id,label:`${c.group_name} / ${c.name}`})),{value:"__custom",label:msg("其他 / 自定义名称")},...(type==="INCOME"?[{value:"__investment",label:msg("理财收益（实际到账）")}]:[])],');
r('    if (type === "INCOME")\n      fields.push({','    if (["EXPENSE","INCOME"].includes(type)) fields.push({name:"custom_category",label:msg("自定义分类名称"),visible:v=>v.category_id==="__custom"});\n    if (type === "INCOME")\n      fields.push({');
r('        hint: msg("用于工资分配助手"),','        hint: msg("用于工资分配助手"),\n        explain: msg("勾选后，这笔收入可用于生成消费、储蓄账户之间的分配计划；只有确认现实转账后才记账，不会自动转账。理财收益请勿勾选工资。"),');
r('                fmt(original?.amount_minor),','                fmt(original?.amount_minor),') ;
r('      body: (\n        <>\n          <div className="segmented transaction-tabs">','      body: (\n        <>\n          {type==="REFUND" && original && <p className="tip">{msg("剩余可退")}：¥ {fmt(String(refundable))}</p>}\n          {type==="INCOME" && <p className="tip">{msg("理财收益只记录实际到账的利息、分红或已实现收益；本金转移请记转账，赎回本金不能重复计为收入。")}</p>}\n          <div className="segmented transaction-tabs">');
r('                    <span className="count-tag">{data.occurrences.length}</span>','                    <div className="row-actions"><span className="count-tag">{data.occurrences.filter((b:Data)=>(b.snoozed_to||b.due_date)<=data.today).length}</span><button onClick={()=>billForm()}><Plus size={15}/>{msg("新增账单")}</button><button onClick={()=>{goto("settings");setSettingsTab("bills")}}>{msg("查看全部")}</button></div>');
r('data.occurrences.slice(0, 4).map','data.occurrences.filter((b:Data)=>(b.snoozed_to||b.due_date)<=data.today).slice(0, 4).map');
r('                  {data.occurrences.length ? (','                  {data.occurrences.some((b:Data)=>(b.snoozed_to||b.due_date)<=data.today) ? (');
// All icon-only controls with accessible names also gain a native tooltip.
s=s.replace(/aria-label=\{msg\(("[^"\n]*")\)\}/g,'aria-label={msg($1)} title={msg($1)}');
r('title={msg("显示或隐藏金额")}','title={msg("隐藏金额仅遮挡界面数字，不加密账本，导出和编辑表单仍显示真实金额")}');
r('                  <Trend days={data.report.days} />','                  <Trend days={data.report.days} start={data.report.start} end={data.report.end} hidden={data.settings.hide_amounts} />');
r('              <div className="analysis-stats">','              <section className="tip">{msg("当前范围无数据时，请切换时间范围。期初、校准和内部转账不属于收支。")}</section>\n              <div className="analysis-stats">');
r('              <div className="two-column">\n                <section className="panel">\n                  <div className="panel-heading">\n                    <div>\n                      <h3>{msg("收支趋势")}</h3>',`              <div className="two-column">
                <section className="panel"><h3>{msg("与前一等长区间比较")}</h3><p className="muted">{data.report.previous?.start} — {data.report.previous && addDays(data.report.previous.end,-1)}</p><table><thead><tr><th>{msg("指标")}</th><th>{msg("本期")}</th><th>{msg("前期")}</th><th>{msg("变化金额")}</th></tr></thead><tbody>{[[msg("收入"),"income"],[msg("净支出"),"net"],[msg("净结余"),"saving"]].map(([label,key])=><tr key={key}><td>{label}</td><td>{fmt(data.report[key])}</td><td>{fmt(data.report.previous?.[key])}</td><td>{fmt(String(BigInt(data.report[key])-BigInt(data.report.previous?.[key]||0)))}</td></tr>)}</tbody></table></section>
                <section className="panel"><h3>{msg("收入结构")}</h3>{(data.report.incomeGroups||[]).map((g:Data)=><div className="setting-row" key={g.id}><span>{g.name}</span><strong>¥ {fmt(g.amount)}</strong></div>)}{!data.report.incomeGroups?.length && <Empty title={msg("本范围暂无收入")}/>}</section>
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>{msg("收支趋势")}</h3>`);
r('                  <div className="setting-row">\n                    <div>\n                      <h3>{msg("外观主题")}</h3>',`                  <div className="setting-row"><div><h3>{msg("余额不足保护")}</h3><p>{msg("默认阻止余额不足的新支出和转账。仅在补录真实历史时开启允许负余额，并及时核对账目。")}</p></div><label><input type="checkbox" checked={!!data.settings.allow_negative} onChange={e=>{const checked=e.target.checked;confirm(msg("更改余额保护"),msg("允许负余额不会增加实际资金，也不代表银行授信。"),async(_,op)=>mutate("saveSettings",{allow_negative:checked},op))}}/>{msg("允许负余额（历史补录）")}</label></div>
                  <div className="setting-row">
                    <div>
                      <h3>{msg("外观主题")}</h3>`);
r('              {settingsTab === "general" && (','              {settingsTab === "help" && <Help/>}\n              {settingsTab === "general" && (');
r('["general", msg("偏好设置")],','["general", msg("偏好设置")],\n                  ["help", msg("帮助与使用手册")],');
r('                      <h3>{msg("关于薪流")}</h3>','                      <h3>{msg("关于薪流")}</h3>\n                      <button onClick={()=>setSettingsTab("help")}><CircleHelp size={16}/>{msg("帮助与使用手册")}</button>');
s=s.replaceAll('0.2.0','0.3.0');
r('                  <section className="panel spaced">\n                    <div className="panel-heading">\n                      <h3>{msg("固定账单规则")}</h3>',`                  <section className="panel spaced"><h3>{msg("处理历史")}</h3><p>{msg("已支付可在交易中查看或撤销；撤销支付后账单重新变为待办。")}</p>{data.occurrenceHistory.map((b:Data)=><div className="setting-row" key={b.id}><span>{b.due_date} · {b.name}</span><span>{b.status==="PAID"?msg("已支付"):msg("已跳过")}</span>{b.transaction_id && <button onClick={()=>goto("transactions",{search:b.name,start:b.due_date,end:addDays(data.today,1)})}>{msg("查看交易")}</button>}</div>)}{!data.occurrenceHistory.length && <Empty title={msg("暂无处理历史")}/>}</section>
                  <section className="panel spaced">
                    <div className="panel-heading">
                      <h3>{msg("固定账单规则")}</h3>`);
r('                      <h3>{msg("固定账单规则")}</h3>','                      <h3>{msg("固定账单规则")}</h3><p>{msg("规则在到期后生成可确认的待办；未来计划尚未产生支出。")}</p>');
// Data controls live alongside existing backup controls.
r('                      <h3>{msg("备份与恢复")}</h3>',`                      <h3>{msg("备份与恢复")}</h3>
                      <button onClick={()=>act(async()=>{await api("chooseDataDirectory");setInfo(await api("dataInfo"))})}>{msg("迁移数据目录")}</button>
                      <button onClick={()=>confirm(msg("清理界面缓存"),msg("只清理浏览器渲染缓存，不删除交易、设置、审计和备份。"),async()=>{await api("clearCache");setToast(msg("缓存已清理"))})}>{msg("清理界面缓存")}</button>`);
// Explain and expose cycle settings directly in the budget page.
r('          {page === "budget" && (\n            <>','          {page === "budget" && (\n            <>\n              <div className="panel setting-row"><span>{msg("周期可在这里调整，历史交易不会静默重新分组。")}</span><button onClick={()=>{goto("settings");setSettingsTab("general")}}>{msg("修改工资日")}</button><button onClick={()=>confirm(msg("更正当前周期边界"),msg("仅允许未结算且包含全部现有交易的边界；结束日期不计入本周期，必须衔接相邻周期。"),async(p,op)=>mutate("adjustCycle",{...p,id:data.cycle.id},op),[{name:"start",label:msg("开始日期"),type:"date"},{name:"end",label:msg("结束日期（不含）"),type:"date"},{name:"reason",label:msg("修改原因")}],{start:data.cycle.start,end:data.cycle.end})}>{msg("更正当前周期边界")}</button></div>');
r('                      <h3>{msg("工资周期")}</h3>','                      <h3>{msg("工资周期")}</h3><p>{data.cycleRules.filter((r:Data)=>r.effective_from>data.today).map((r:Data)=>`${msg("待生效")}：${r.effective_from} · ${r.payday}`).join("；")}</p>');
// Budget bars and row amounts keep numeric status in addition to color.
r('function Trend({ days }: { days: Data[] }) {',`function Trend({ days, start, end, hidden }: { days: Data[]; start:string; end:string; hidden?:boolean }) {
  const byDate = new Map(days.map(d=>[d.date,d]));
  if(days.some(d=>BigInt(d.income)!==0n||BigInt(d.expense)!==0n)) {
    const filled:Data[]=[];
    for(let d=start;d<end;d=addDays(d,1))filled.push(byDate.get(d)||{date:d,income:"0",expense:"0"});
    days=filled;
  } else days=[];`);
r('(Number(d.expense) / max) * (Number(d.expense) < 0 ? 55 : 110)','(Number(d.expense) / max) * 70');
r('(Number(d.income) / max) * 110','(Number(d.income) / max) * 70');
r('    baseline = 160;','    baseline = 135;');
r('{money(d.income)}','{hidden ? "••••" : money(d.income)}');r('{money(d.expense)}','{hidden ? "••••" : money(d.expense)}');
s=s.replace('y="163"','y="138"').replace('[45, 100, 160, 220]','[65, 100, 135, 205]');
fs.writeFileSync('src/App.tsx',s);
