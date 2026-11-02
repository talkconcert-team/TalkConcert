import test from 'node:test'
import assert from 'node:assert/strict'
import {loadCommentDraft,saveCommentDraft,mergeComments} from './answerComments.js'
function storage(){const data=new Map();return{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}}
test('댓글 초안과 재시도 요청 ID를 답변별로 보관한다',()=>{
  const store=storage();const draft={id:'request',text:'댓글',authorName:'빛나는 부소마인'}
  saveCommentDraft('a',draft,store)
  assert.deepEqual(loadCommentDraft('a',store),draft)
  assert.deepEqual(loadCommentDraft('b',store),{text:''})
  saveCommentDraft('a',null,store)
  assert.deepEqual(loadCommentDraft('a',store),{text:''})
})
test('댓글 페이지와 저장 결과를 중복 없이 시간순으로 합친다',()=>{
  const a={id:'a',cursor:'9007199254740992'},b={id:'b',cursor:'9007199254740993'}
  assert.deepEqual(mergeComments([b],[a,b]),[a,b])
})
