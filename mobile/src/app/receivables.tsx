import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { DateField } from "@/components/date-field";
import { AppScreen, Card, Divider, LoadingState, MoneyAmount, PageHeader } from "@/components/ui";
import { radius, spacing, useAppTheme } from "@/constants/theme";
import { useFinance } from "@/data/finance-context";
import { createReceivable, loadReceivables, repayReceivable, type ReceivableItem } from "@/data/repository";
import { today } from "@/domain/dates";
import { formatMoney, parseMoneyExpression } from "@/domain/money";

export default function ReceivablesScreen() {
  const colors=useAppTheme(),db=useSQLiteContext();
  const {snapshot,error,refresh}=useFinance();
  const [rows,setRows]=useState<ReceivableItem[]>([]),[creating,setCreating]=useState(false),[busy,setBusy]=useState(false);
  const [person,setPerson]=useState(""),[amount,setAmount]=useState(""),[sourceId,setSourceId]=useState("");
  const [returnId,setReturnId]=useState(""),[lentDate,setLentDate]=useState(today()),[hasDue,setHasDue]=useState(false),[dueDate,setDueDate]=useState(today()),[note,setNote]=useState("");
  const [repaying,setRepaying]=useState<ReceivableItem|null>(null),[repayAmount,setRepayAmount]=useState(""),[repayAccount,setRepayAccount]=useState(""),[repayDate,setRepayDate]=useState(today()),[repayNote,setRepayNote]=useState("");
  const reload=()=>loadReceivables(db).then(setRows).catch((e)=>Alert.alert("读取失败",e instanceof Error?e.message:"请重试"));
  useEffect(()=>{void reload()},[db]);
  useEffect(()=>{if(!snapshot)return;const spending=snapshot.accounts.find(a=>a.roles.includes("PRIMARY_SPENDING"))?.id||snapshot.accounts[0]?.id||"";setSourceId(x=>x||spending);setReturnId(x=>x||spending)},[snapshot]);
  if(!snapshot)return <AppScreen><LoadingState error={error}/></AppScreen>;
  const hidden=!snapshot.settings.amountsVisible;
  const outstanding=rows.filter(x=>x.status==="OPEN").reduce((s,x)=>s+x.outstandingMinor,0);
  const overdue=rows.filter(x=>x.status==="OPEN"&&x.dueDate&&x.dueDate<today()).length;
  const save=async()=>{try{setBusy(true);await createReceivable(db,{person,amountMinor:Number(parseMoneyExpression(amount)),sourceAccountId:sourceId,defaultReturnAccountId:returnId||undefined,lentDate,dueDate:hasDue?dueDate:undefined,note});setPerson("");setAmount("");setNote("");setCreating(false);await Promise.all([reload(),refresh()]);Alert.alert("已记录","账户余额已减少；这笔借出不会计入支出、预算或储蓄率。")}catch(e){Alert.alert("无法保存",e instanceof Error?e.message:"请检查输入")}finally{setBusy(false)}};
  const openRepay=(row:ReceivableItem)=>{setRepaying(row);setRepayAmount((row.outstandingMinor/100).toFixed(2));setRepayAccount(row.defaultReturnAccountId||row.sourceAccountId);setRepayDate(today());setRepayNote("")};
  const saveRepay=async()=>{if(!repaying)return;try{setBusy(true);await repayReceivable(db,{id:repaying.id,revision:repaying.revision,amountMinor:Number(parseMoneyExpression(repayAmount)),destinationAccountId:repayAccount,date:repayDate,note:repayNote});setRepaying(null);await Promise.all([reload(),refresh()]);Alert.alert("归还已登记","回款增加所选账户余额，但不会重复计为收入。")}catch(e){Alert.alert("无法登记",e instanceof Error?e.message:"请检查输入")}finally{setBusy(false)}};
  return <AppScreen>
    <PageHeader title="待收款" subtitle="记录借给他人的临时资金，可选归还日并支持分次归还。" action={<Pressable onPress={()=>setCreating(!creating)} style={[styles.topButton,{backgroundColor:colors.primary}]}><Ionicons name={creating?"close":"add"} size={18} color="#fff"/><Text style={styles.white}>{creating?"取消":"新增"}</Text></Pressable>}/>
    <View style={styles.summary}>
      <Card style={styles.summaryCard}><Text style={[styles.meta,{color:colors.textSecondary}]}>待收总额</Text><MoneyAmount value={outstanding} hidden={hidden} size={23}/></Card>
      <Card style={styles.summaryCard}><Text style={[styles.meta,{color:colors.textSecondary}]}>逾期提醒</Text><Text style={[styles.summaryNumber,{color:overdue?colors.expense:colors.text}]}>{overdue}</Text></Card>
    </View>
    {overdue?<View style={[styles.notice,{backgroundColor:colors.surfaceMuted}]}><Ionicons name="alert-circle-outline" size={20} color={colors.expense}/><Text style={[styles.noticeText,{color:colors.text}]}>有 {overdue} 笔待收款已超过预计归还日，请按实际情况跟进。</Text></View>:null}
    {creating?<Card style={styles.form}><Text style={[styles.formTitle,{color:colors.text}]}>新增待收款</Text>
      <TextInput value={person} onChangeText={setPerson} placeholder="对方名称，例如：小林" placeholderTextColor={colors.textSecondary} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
      <TextInput value={amount} onChangeText={setAmount} placeholder="借出金额，可输入算式" keyboardType="decimal-pad" placeholderTextColor={colors.textSecondary} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
      <Text style={[styles.label,{color:colors.text}]}>借出账户</Text><View style={styles.wrap}>{snapshot.accounts.map(a=><Choice key={a.id} label={a.name} active={sourceId===a.id} onPress={()=>setSourceId(a.id)}/>)}</View>
      <Text style={[styles.label,{color:colors.text}]}>默认收回账户</Text><View style={styles.wrap}>{snapshot.accounts.map(a=><Choice key={a.id} label={a.name} active={returnId===a.id} onPress={()=>setReturnId(a.id)}/>)}</View>
      <DateField label="借出日期" value={lentDate} onChange={setLentDate}/>
      <View style={styles.switchRow}><Text style={[styles.label,{color:colors.text}]}>设置预计归还日期</Text><Switch value={hasDue} onValueChange={setHasDue} trackColor={{true:colors.primary}}/></View>
      {hasDue?<DateField label="预计归还日期" value={dueDate} onChange={setDueDate}/>:null}
      <TextInput value={note} onChangeText={setNote} placeholder="备注（可选）" placeholderTextColor={colors.textSecondary} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
      <Pressable disabled={busy} onPress={()=>void save()} style={[styles.save,{backgroundColor:colors.primary,opacity:busy?.5:1}]}><Text style={styles.white}>{busy?"保存中…":"确认借出"}</Text></Pressable>
    </Card>:null}
    {repaying?<Card style={styles.form}><Text style={[styles.formTitle,{color:colors.text}]}>登记 {repaying.person} 的归还</Text><Text style={[styles.meta,{color:colors.textSecondary}]}>当前待收 {hidden?"¥ ••••":formatMoney(repaying.outstandingMinor)}，可以分次登记。</Text>
      <TextInput value={repayAmount} onChangeText={setRepayAmount} keyboardType="decimal-pad" placeholder="本次归还金额" placeholderTextColor={colors.textSecondary} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
      <Text style={[styles.label,{color:colors.text}]}>收回账户</Text><View style={styles.wrap}>{snapshot.accounts.map(a=><Choice key={a.id} label={a.name} active={repayAccount===a.id} onPress={()=>setRepayAccount(a.id)}/>)}</View>
      <DateField label="实际归还日期" value={repayDate} onChange={setRepayDate}/>
      <TextInput value={repayNote} onChangeText={setRepayNote} placeholder="备注（可选）" placeholderTextColor={colors.textSecondary} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
      <View style={styles.actions}><Pressable onPress={()=>setRepaying(null)} style={[styles.secondary,{borderColor:colors.border}]}><Text style={{color:colors.text}}>取消</Text></Pressable><Pressable disabled={busy} onPress={()=>void saveRepay()} style={[styles.save,{backgroundColor:colors.primary,opacity:busy?.5:1}]}><Text style={styles.white}>确认已归还</Text></Pressable></View>
    </Card>:null}
    <Card style={styles.list}>{rows.length?rows.map((row,index)=>{const past=row.status==="OPEN"&&row.dueDate&&row.dueDate<today();return <View key={row.id}>{index?<Divider/>:null}<View style={styles.row}><View style={{flex:1,gap:5}}><View style={styles.rowTop}><Text style={[styles.person,{color:colors.text}]}>{row.person}</Text><Text style={[styles.status,{color:row.status==="SETTLED"?colors.income:past?colors.expense:colors.primary}]}>{row.status==="SETTLED"?"已结清":past?"已逾期":"待归还"}</Text></View><Text style={[styles.meta,{color:colors.textSecondary}]}>{row.lentDate} 借出 · {row.sourceAccountName}{row.dueDate?" · 预计 "+row.dueDate:" · 未设归还日"}</Text>{row.note?<Text style={[styles.meta,{color:colors.textSecondary}]}>{row.note}</Text>:null}</View><View style={styles.money}><MoneyAmount value={row.outstandingMinor} hidden={hidden} size={17}/>{row.status==="OPEN"?<Pressable onPress={()=>openRepay(row)}><Text style={{color:colors.primary,fontWeight:"800"}}>登记归还</Text></Pressable>:null}</View></View></View>}):<View style={styles.empty}><Ionicons name="people-outline" size={32} color={colors.primary}/><Text style={[styles.person,{color:colors.text}]}>暂时没有待收款</Text><Text style={[styles.meta,{color:colors.textSecondary}]}>借款可不设置归还日；设置后会在这里显示到期和逾期提醒。</Text></View>}</Card>
    <Text style={[styles.foot,{color:colors.textSecondary}]}>借出与归还是资产形态变化，不计入收入、支出、预算执行率或储蓄率。</Text>
  </AppScreen>;
}
function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){const c=useAppTheme();return <Pressable onPress={onPress} style={[styles.choice,{backgroundColor:active?c.primary:c.surface,borderColor:active?c.primary:c.border}]}><Text style={{color:active?"#fff":c.text,fontWeight:"700"}}>{label}</Text></Pressable>}
const styles=StyleSheet.create({
  topButton:{minHeight:40,borderRadius:radius.md,paddingHorizontal:spacing.md,flexDirection:"row",gap:5,alignItems:"center"},white:{color:"#fff",fontWeight:"800"},
  summary:{flexDirection:"row",gap:spacing.md},summaryCard:{flex:1,gap:6},summaryNumber:{fontSize:25,fontWeight:"900"},notice:{padding:spacing.md,borderRadius:radius.md,flexDirection:"row",gap:spacing.sm},noticeText:{flex:1,fontSize:13,lineHeight:19},
  form:{gap:spacing.md},formTitle:{fontSize:18,fontWeight:"900"},input:{minHeight:50,borderWidth:1,borderRadius:radius.md,paddingHorizontal:spacing.md,fontSize:15},label:{fontSize:14,fontWeight:"800"},wrap:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},choice:{minHeight:40,borderWidth:1,borderRadius:radius.pill,paddingHorizontal:spacing.md,justifyContent:"center"},switchRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  save:{minHeight:48,borderRadius:radius.md,paddingHorizontal:spacing.lg,alignItems:"center",justifyContent:"center"},secondary:{minHeight:48,borderWidth:1,borderRadius:radius.md,paddingHorizontal:spacing.lg,alignItems:"center",justifyContent:"center"},actions:{flexDirection:"row",justifyContent:"flex-end",gap:spacing.sm},
  list:{paddingVertical:spacing.xs},row:{padding:spacing.lg,flexDirection:"row",gap:spacing.md,alignItems:"center"},rowTop:{flexDirection:"row",alignItems:"center",gap:spacing.sm},person:{fontSize:16,fontWeight:"800"},status:{fontSize:12,fontWeight:"900"},meta:{fontSize:12,lineHeight:18},money:{alignItems:"flex-end",gap:8},empty:{padding:40,alignItems:"center",gap:spacing.sm},foot:{textAlign:"center",fontSize:12,lineHeight:18}
});
