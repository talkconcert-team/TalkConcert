# TalkConcert

React와 Vite로 만든 TalkConcert 프로젝트입니다.

## 설치

```sh
cd ~/Desktop/TalkConcert
pnpm install
```

## 환경 변수

프로젝트 루트에 `.env` 파일을 만들고 Supabase 연결 정보를 입력합니다.

```env
SUPABASE_URL=Supabase 프로젝트 URL
SUPABASE_PUBLISHABLE_KEY=Supabase publishable key
# 로컬 서버에서만 사용. SUPABASE_ 접두사로 이름을 바꾸지 않습니다.
SERVER_SETTINGS_ADMIN_TOKEN=설정 저장 전용 임의의 토큰
```

## 실행

```sh
pnpm dev
```

브라우저에서 http://localhost:5173 접속

## 화면 주소

- `/admin`: 관리자 CMS. 주제·질문 관리와 기능 설정을 제공합니다.
- `/presenter`: 진행 화면. 질문 보드 표시와 허용된 랜덤 추첨만 제공합니다. 콘텐츠 편집은 CMS에서 합니다.
- `/`: 관객 화면. 질문을 작성하고 보드를 볼 수 있으며 랜덤 추첨, 주제 추가, 주제 이름 수정은 표시하지 않습니다.

관객은 로그인 없이 질문을 작성하고 보드를 읽을 수 있습니다. 이름은 '찬란한 부소마인'처럼 자동으로 부여하고 같은 브라우저에서 유지합니다. 질문의 작성 미리보기와 등록된 카드에 같은 이름을 표시합니다. CMS와 진행 화면은 Google 인증과 DB 관리자 허용 목록 검증을 유지합니다. 질문 삭제·복구·내용 수정은 관리자만 할 수 있으며 작성자도 자기 질문을 삭제할 수 없습니다.
작성 중인 내용·색·선택 주제는 같은 탭의 세션 저장소에 보관하고 새로고침 후 복원합니다. 등록 중에는 진행 상태를 표시하고, 응답이 끊겨도 같은 질문 ID와 비밀 토큰으로 재시도해 중복 등록을 방지합니다. 저장소가 차단되면 현재 화면 메모리로 참여할 수 있으나 새로고침 후 복구·본인 이동 권한은 유지되지 않을 수 있습니다.
설정·질문·주제는 Supabase에 저장하며, 보드는 5초 간격 및 창 복귀 시 갱신합니다.
관리자 기능 설정은 Supabase의 `public.talkconcert_settings`에 저장하고 진행 화면에서 5초 간격 및 창 복귀 시 불러옵니다.
연결·조회·저장 실패는 화면에 표시하며 로컬 저장으로 대체하거나 저장 성공으로 표시하지 않습니다.

## 관리자 설정 DB 연결

1. `supabase/migrations/`의 마이그레이션을 순서대로 대상 프로젝트에 적용합니다.
2. `.env`에 위 세 환경 변수를 설정하고, 서버 토큰의 SHA-256 해시를 `talkconcert_private.settings_access`의 `main` 행에 등록합니다. 토큰 원문을 DB·클라이언트 코드에 저장하지 않습니다.
3. `/admin`에서 설정을 바꾼 뒤 새로고침하여 값이 유지되는지 확인합니다.

공개 테이블에는 RLS를 적용합니다. 활성 보드 조회와 질문 등록은 공개하고 삭제된 질문·주제는 공개하지 않습니다. 비로그인 작성은 제한된 등록 RPC로만 허용하며, 본인 메모 이동에는 질문별 비밀 토큰을 요구합니다. 테이블 직접 쓰기·삭제 권한은 공개하지 않습니다. 관리자 API와 관리 DB 함수는 Google 세션·관리자 허용 목록·서버 토큰을 확인하므로 서버 토큰만으로는 호출할 수 없습니다.
`SERVER_SETTINGS_ADMIN_TOKEN`은 브라우저 번들에 포함하지 않으며 `.env`는 커밋하지 않습니다. 프로젝트 전체에 접근하는 service_role 키는 사용하지 않습니다.
개발 서버는 루프백 접속만 허용합니다. Vercel 배포에서는 `api/index.js`가 동일한 인증·설정·보드 미들웨어를 실행합니다. 등록된 HTTPS 도메인에서 요청받고, 쓰기는 같은 출처의 JSON 요청으로 제한합니다.
여러 화면은 동일한 DB를 읽습니다. 운영 사이트는 https://talkconcert.vercel.app 입니다.

## Vercel 배포

- `vercel.json`이 Vite 빌드와 `/api/*` 함수 라우팅, `/admin`·`/presenter`·`/auth/callback`의 SPA 진입을 설정합니다. Node.js 22를 사용합니다.
- Vercel Production 환경변수에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SERVER_SETTINGS_ADMIN_TOKEN`, `APP_ORIGIN=https://talkconcert.vercel.app`을 등록합니다. 서버 토큰은 Secret으로 저장합니다. `.env`와 `.vercel` 인증 파일은 배포 소스에 포함하지 않습니다.
- Supabase Site URL은 운영 도메인으로 설정하고 Redirect URLs에 `https://talkconcert.vercel.app/auth/callback`을 추가합니다. 기존 로컬 콜백은 유지합니다.
- 미리보기 로그인 복귀 주소는 `https://talkconcert-*-sins-projects-a8a94543.vercel.app/auth/callback`으로 이 프로젝트의 배포 주소에만 허용합니다. 운영 Site URL은 그대로 유지합니다.
- Google OAuth의 승인된 JavaScript 원본에 운영 도메인을 추가합니다. Google 콜백은 기존 Supabase `/auth/v1/callback`을 유지합니다.
- GitHub의 `talkconcert-team/TalkConcert`를 기존 Vercel 프로젝트에 연결했습니다. `develop`에 푸시·병합하면 운영 사이트에 자동 배포하고, 다른 브랜치의 변경은 PR 미리보기로 배포합니다. 수동 배포가 필요하면 연결된 프로젝트를 확인한 뒤 `pnpm dlx vercel deploy --prod`를 사용합니다.
- 자동 빌드는 `pnpm lint && pnpm test && pnpm build` 순서로 실행해 린트·테스트·빌드가 모두 성공한 버전만 배포합니다. Preview에도 Supabase 연결 변수를 별도로 등록하며 운영·미리보기는 현재 같은 DB를 사용합니다.
- 배포 후 공개 보드 조회·비로그인 작성, 작성자 삭제 차단, 관리자 Google 인증과 CMS 저장을 확인합니다.

## 한글 도메인 연결

추가 주소는 `부소마.서버.한국`이며 ASCII 표기는 `xn--hz2b11e28d.xn--hk3b17f.xn--3e0b707e`입니다. Vercel 프로젝트에 등록했고, DNS 연결과 소유권 인증을 기다리고 있습니다. 기존 `talkconcert.vercel.app` 주소는 계속 유지합니다.

- 운영 환경의 `APP_ORIGINS`에 추가 HTTPS 주소를 등록합니다. 서버는 명시한 주소만 허용하며 한글 주소를 퓨니코드 호스트로 비교합니다.
- 도메인 관리 화면의 CNAME 이름 칸은 비워 기본 주소에 연결하고, 값은 Vercel 프로젝트가 안내하는 전용 CNAME을 사용합니다. 웹포워딩과 HTML 단일페이지는 사용하지 않습니다.
- Vercel이 요구하는 TXT 위치는 `_vercel.서버.한국`입니다. `_vercel.부소마.서버.한국`과 다른 주소이므로 상위 도메인 관리자의 협조가 필요할 수 있습니다. 인증 값은 Vercel 도메인 설정에서 확인하고 기존 TXT를 덮어쓰지 않고 추가합니다.
- DNS 인증 완료 후 HTTPS, 질문 조회·등록을 확인합니다. 새 도메인에서 관리자 로그인을 쓰려면 Supabase의 Redirect URLs에 새 HTTPS 도메인의 `/auth/callback`을 추가하고 실제 로그인 왕복을 확인해야 합니다. 확인 전에는 기존 운영 주소의 `/admin`·`/presenter`를 사용합니다.

## CMS 사용

- 진행 화면의 랜덤 추첨은 `/api/admin/draw`와 Supabase의 비공개 `draw_requests`에 연결됩니다. 질문 ID별 당첨을 한 번만 허용하며 새로고침·동시 관리자 추첨·주제 이동·수정·삭제 후 복원에도 제외 이력이 유지됩니다.
- 모든 질문을 뽑으면 추첨이 멈춥니다. 새 질문은 다시 후보가 되며 이력을 자동으로 초기화하지 않습니다. 본문이 같아도 별도로 등록한 질문은 서로 다른 질문 ID입니다.
- 기본 주제는 '신희성 선배에게 질문하기', '이지우 선배에게 질문하기', '둘 다에게 질문하기'입니다. 크게 보기에는 해당 주제명을 큰 제목으로 표시합니다. 추첨 중에는 슬롯 중앙 질문과 제목이 함께 바뀌며, 최종 당첨 결과에는 당시 주제명을 저장합니다.
- 결과는 애니메이션 전에 저장됩니다. 중간에 화면을 닫아도 당첨은 취소되지 않으며 마지막 결과를 다시 크게 볼 수 있습니다. 통신 실패 시 같은 요청 ID로 재확인하므로 추가 질문을 소비하지 않습니다. 도입 이전의 브라우저 추첨은 이력이 없어 소급 적용하지 않습니다.

- ‘주제·질문 관리’에서 주제 추가·이름 변경·삭제를 할 수 있습니다. 주제 삭제 시 질문을 옮길 다른 주제를 선택하며 마지막 주제는 삭제할 수 없습니다.
- 질문은 추가·내용 수정·주제 이동·색 변경·삭제가 가능합니다. ‘삭제한 질문 보기’에서 복구할 수 있습니다.
- 질문 번호는 DB에서 부여하며 수정·이동으로 바뀌지 않습니다.
- 예전 브라우저 로컬 메모는 자동으로 DB에 복사하지 않으며 기존 저장 키는 지우지 않습니다.

## 관객 메모 이동

관객이 작성한 메모에는 이동 손잡이가 표시됩니다. 끌어서 다른 주제·빈 주제로 옮기거나 같은 주제 안에서 순서를 바꿀 수 있습니다. 손잡이에 포커스를 두고 좌우 방향키로 주제, 위아래 방향키로 순서를 변경할 수도 있습니다. 이동은 DB에서 원자적으로 저장하며 질문 번호·내용·색을 유지합니다.

새 질문의 이동 권한은 브라우저에 저장한 질문별 무작위 비밀 토큰으로 확인합니다. DB의 비공개 `question_owners`에는 토큰 해시만 저장하고 공개 보드에 반환하지 않습니다. 다른 브라우저에서는 본인 질문 표시와 이동 권한이 자동 복원되지 않습니다. 기존 Google 계정에 연결된 질문의 계정 소유권은 유지하며 토큰으로 다른 계정의 질문을 가져갈 수 없습니다.
질문 조회·등록·이동과 CMS 설정 저장에는 15초 제한 시간을 둡니다. 응답을 확인하지 못했을 때 성공으로 표시하지 않으며 목록에서 저장 여부를 확인하도록 안내합니다. 일반 카드의 크게 보기는 보드의 수정·삭제를 반영하고 추첨 결과는 당첨 당시 원문을 유지합니다.

허용된 Google 관리자는 진행 화면(`/presenter`)에서 모든 카드를 이동할 수 있습니다. 작성자 토큰 도입 전의 기존 카드도 관리자가 이동합니다. 관리 API와 DB 모두 Google 세션·허용 이메일·서버 토큰을 확인하며 관객용 이동 RPC에는 관리자 우회를 추가하지 않습니다. 관리자 추가는 비공개 `admin_accounts`에서 관리합니다.

권한 검증과 관리 작업의 `SECURITY DEFINER` 함수는 비공개 스키마에 있고 공개 RPC는 `SECURITY INVOKER`입니다. 비공개 관리자 목록·토큰 해시 테이블의 [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)는 클라이언트 접근을 전부 차단하기 위한 설정입니다.

## Google 관리자 로그인 최초 설정

1. Google Cloud의 Google Auth Platform에서 프로젝트와 앱을 설정합니다. 대상은 외부로 설정하고 데이터 접근 범위는 `openid`, `email`, `profile`만 사용합니다. 기본 로그인 범위만 요청할 때는 테스트 모드여도 테스트 사용자 목록에 없는 계정으로 로그인할 수 있습니다([Google 공식 안내](https://support.google.com/cloud/answer/15549945?hl=en)). 추가 Google API 범위를 요청하면 이 예외는 적용되지 않습니다.
2. OAuth 클라이언트 유형을 웹 애플리케이션으로 만들고 승인된 JavaScript 원본에 `http://127.0.0.1:5173`, 승인된 리디렉션 URI에 `https://gnfvhzmaxqnnudjgrotf.supabase.co/auth/v1/callback`을 등록합니다.
3. 생성된 Client ID와 Client Secret을 Supabase의 Authentication → Sign In / Providers → Google에 입력하고 활성화합니다. Client Secret을 저장소나 브라우저 환경 변수에 넣지 않습니다.
4. Supabase Authentication → URL Configuration에서 Site URL은 `http://127.0.0.1:5173`, Redirect URLs에는 `http://127.0.0.1:5173/auth/callback`을 등록합니다. localhost로도 사용할 경우 해당 원본과 콜백을 추가합니다.
5. `/admin` 또는 `/presenter`에서 Google로 로그인합니다. 로그인 성공 후에도 허용 목록에 없는 계정은 CMS·진행 화면·관리 API에 접근할 수 없습니다. 목록 관리는 DB 운영자만 수행합니다.

OAuth 제공자 설정이 완료되기 전에는 관리자 페이지가 잠깁니다. Google 로그인 왕복 검증은 위 설정 후 수행합니다. 로그인 세션을 폐기하거나 DB 허용 목록에서 계정을 제거하면 후속 관리자 API 요청이 거부됩니다.

## 커밋 규칙

| 타입 | 의미 / 사용 상황 |
| --- | --- |
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 및 추가 (README, 주석 등) |
| `style` | 코드 포맷팅, 세미콜론 누락 등 (코드 로직 변경 없음) |
| `refactor` | 기능 추가나 버그 수정이 없는 코드 구조 개선 |
| `test` | 테스트 코드 추가 및 리팩토링 |
| `chore` | 빌드 업무, 패키지 매니저 설정, 환경 설정 변경 |
