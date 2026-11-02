import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createAnswerCommentsMiddleware } from './answerCommentsApi.js'
const id='00000000-0000-4000-8000-000000000001'
const payload={action:'create',answerId:id,id:'00000000-0000-4000-8000-000000000002',text:'감사합니다.',authorName:'빛나는 부소마인',visitorToken:'a'.repeat(64)}
async function fixture(t, result={data:{id:payload.id}}) {
  const calls=[]
  const middleware=createAnswerCommentsMiddleware({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public'},()=>({rpc:async(name,args)=>{calls.push({name,args});return result}}))
  const server=createServer((req,res)=>middleware(req,res,()=>{res.writeHead(404);res.end()}))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise(resolve=>server.close(resolve)))
  const origin=`http://127.0.0.1:${server.address().port}`
  return {calls,post:(body,headers={})=>fetch(origin+'/api/answer-comments',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)})}
}
test('로그인 없이 관리자 답변에 익명 댓글을 저장한다',async t=>{
  const f=await fixture(t)
  assert.equal((await f.post(payload)).status,200)
  assert.deepEqual(f.calls[0],{name:'create_talkconcert_answer_comment',args:{p_answer:id,p_id:payload.id,p_text:payload.text,p_name:payload.authorName,p_token:payload.visitorToken}})
})
test('댓글 조회에는 로그인이나 브라우저 토큰이 필요하지 않다',async t=>{
  const f=await fixture(t,{data:{comments:[],hasMore:false}})
  assert.equal((await f.post({action:'list',answerId:id,before:'20'})).status,200)
  assert.equal(f.calls[0].name,'get_talkconcert_answer_comments')
  assert.equal(f.calls[0].args.p_before,'20')
})
test('댓글 좋아요·수정·삭제 및 잘못된 입력은 DB 호출 전에 차단한다',async t=>{
  const f=await fixture(t)
  for(const action of ['like','update','delete'])assert.equal((await f.post({...payload,action})).status,400)
  for(const text of ['', '  ', 'x'.repeat(1001),null])assert.equal((await f.post({...payload,text})).status,400)
  assert.equal((await f.post({...payload,authorName:'신희성'})).status,400)
  assert.equal((await f.post({...payload,visitorToken:''})).status,400)
  assert.equal((await f.post({action:'list',answerId:id,before:'-1'})).status,400)
  assert.equal((await f.post(payload,{Origin:'https://external.example'})).status,403)
  assert.equal(f.calls.length,0)
})
test('답변 없음과 저장 실패를 성공으로 표시하지 않는다',async t=>{
  const f=await fixture(t,{error:{code:'P0002'}})
  assert.equal((await f.post(payload)).status,404)
  const failed=await fixture(t,{error:{code:'XX000',message:'private'}})
  const response=await failed.post(payload)
  assert.equal(response.status,502)
  assert.ok(!(await response.text()).includes('private'))
})
