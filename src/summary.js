import { tokenizeSql } from './format.js';
const TYPES = new Set(['SELECT','INSERT','UPDATE','DELETE','MERGE','CREATE','ALTER','DROP','TRUNCATE','WITH','CALL','EXPLAIN','GRANT','REVOKE','BEGIN','COMMIT','ROLLBACK','SAVEPOINT','RELEASE','SET','SHOW']);
export function summarizeSql(sql) {
  const tokens=tokenizeSql(sql);
  const tokenCounts={words:0,quoted:0,numbers:0,parameters:0,operators:0,symbols:0,lineComments:0,blockComments:0,punctuation:0};
  const statementTypes=Object.create(null);
  let statementCount=0,currentType=null,currentTokens=0,maxStatementTokens=0,hasContent=false;
  const finish=()=>{if(!hasContent)return;statementCount++;maxStatementTokens=Math.max(maxStatementTokens,currentTokens);const type=currentType||'UNKNOWN';statementTypes[type]=(statementTypes[type]||0)+1;currentType=null;currentTokens=0;hasContent=false;};
  for(const token of tokens){
    if(token.type==='punct'&&token.value===';'){finish();continue;}
    const key=({word:'words',quoted:'quoted',number:'numbers',parameter:'parameters',operator:'operators',symbol:'symbols','line-comment':'lineComments','block-comment':'blockComments',punct:'punctuation'})[token.type];
    if(key)tokenCounts[key]++;
    if(token.type==='line-comment'||token.type==='block-comment')continue;
    hasContent=true;currentTokens++;
    if(currentType===null&&token.type==='word'){const candidate=token.value.toUpperCase();if(TYPES.has(candidate))currentType=candidate;}
  }
  finish();
  return {format:'sql-tidy-structure-v1',characterCount:sql.length,totalTokens:Object.values(tokenCounts).reduce((a,b)=>a+b,0),statementCount,statementTypes:Object.fromEntries(Object.entries(statementTypes).sort(([a],[b])=>a.localeCompare(b))),tokenCounts,maxStatementTokens,advisory:'Lexical structure only. Statement classification uses the first recognized keyword and does not parse, validate or execute SQL. No SQL values, identifiers, comments or parameter names are included.'};
}