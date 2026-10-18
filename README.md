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

관객 화면은 로그인 없이 보드를 읽을 수 있습니다. 질문 입력 영역이나 주제의 추가 버튼을 누르면 Google 로그인으로 연결되고, 인증 후 선택한 주제와 작성 중이던 내용으로 돌아옵니다. 질문 등록·이동은 Google 로그인이 필요합니다. CMS와 진행 화면은 별도의 로그인 카드 없이 Google 인증으로 바로 연결하며 DB의 관리자 허용 목록에 등록된 계정만 접근할 수 있습니다. 질문은 익명으로 표시하며 이메일·프로필은 공개하지 않습니다. 관객이 로그아웃해도 보드는 계속 볼 수 있습니다.
설정·질문·주제는 Supabase에 저장하며, 보드는 5초 간격 및 창 복귀 시 갱신합니다.
관리자 기능 설정은 Supabase의 `public.talkconcert_settings`에 저장하고 진행 화면에서 5초 간격 및 창 복귀 시 불러옵니다.
연결·조회·저장 실패는 화면에 표시하며 로컬 저장으로 대체하거나 저장 성공으로 표시하지 않습니다.

## 관리자 설정 DB 연결

1. `supabase/migrations/`의 마이그레이션을 순서대로 대상 프로젝트에 적용합니다.
2. `.env`에 위 세 환경 변수를 설정하고, 서버 토큰의 SHA-256 해시를 `talkconcert_private.settings_access`의 `main` 행에 등록합니다. 토큰 원문을 DB·클라이언트 코드에 저장하지 않습니다.
3. `/admin`에서 설정을 바꾼 뒤 새로고침하여 값이 유지되는지 확인합니다.

공개 테이블에는 RLS를 적용합니다. 활성 보드 조회는 공개하고 삭제된 질문·주제는 공개하지 않습니다. 질문 등록·이동 API는 요청마다 `getUser`로 JWT를 검증하고 DB의 검증된 Google identity와 유효한 세션을 확인합니다. 비로그인 사용자는 Supabase에 직접 요청해도 쓰기 RPC를 실행할 수 없습니다. 관리자 API는 추가로 관리자 허용 목록을 확인합니다. 관리 DB 함수에도 같은 권한 검사를 적용하며 서버 토큰만으로는 호출할 수 없습니다.
`SERVER_SETTINGS_ADMIN_TOKEN`은 브라우저 번들에 포함하지 않으며 `.env`는 커밋하지 않습니다. 프로젝트 전체에 접근하는 service_role 키는 사용하지 않습니다.
개발 서버와 쓰기 API는 루프백 접속만 허용합니다. 외부 배포 시에는 HTTPS 백엔드와 OAuth 주소 설정을 제공해야 하며, 정적 빌드만 배포하면 저장 API가 제공되지 않습니다.
여러 화면은 동일한 DB를 읽지만 현재 개발 서버에는 이 PC에서만 접속할 수 있습니다.

## CMS 사용

- ‘주제·질문 관리’에서 주제 추가·이름 변경·삭제를 할 수 있습니다. 주제 삭제 시 질문을 옮길 다른 주제를 선택하며 마지막 주제는 삭제할 수 없습니다.
- 질문은 추가·내용 수정·주제 이동·색 변경·삭제가 가능합니다. ‘삭제한 질문 보기’에서 복구할 수 있습니다.
- 질문 번호는 DB에서 부여하며 수정·이동으로 바뀌지 않습니다.
- 예전 브라우저 로컬 메모는 자동으로 DB에 복사하지 않으며 기존 저장 키는 지우지 않습니다.

## 관객 메모 이동

관객이 작성한 메모에는 이동 손잡이가 표시됩니다. 끌어서 다른 주제·빈 주제로 옮기거나 같은 주제 안에서 순서를 바꿀 수 있습니다. 손잡이에 포커스를 두고 좌우 방향키로 주제, 위아래 방향키로 순서를 변경할 수도 있습니다. 이동은 DB에서 원자적으로 저장하며 질문 번호·내용·색을 유지합니다.

관객 로그인과 별도로 메모의 이동 권한은 기존의 메모별 임의 토큰으로 확인합니다. 브라우저에 원문을 보관하고 비공개 DB 테이블에는 해시만 저장합니다. 다른 사람의 메모는 이동할 수 없으며 본문 수정·삭제 권한도 열지 않습니다. 저장소를 지우거나 다른 브라우저를 쓰면 해당 메모의 이동 권한을 확인할 수 없습니다. Google 계정에 메모 소유권을 연결하는 방식은 아직 적용하지 않습니다.

허용된 Google 관리자는 관객 화면(`/`)과 진행 화면(`/presenter`) 양쪽에서 모든 카드를 이동할 수 있습니다. 작성자 토큰 도입 전의 기존 카드도 관리자가 이동합니다. 관리 API와 DB 모두 Google 세션·허용 이메일·서버 토큰을 확인하며 관객용 이동 RPC에는 관리자 우회를 추가하지 않습니다. 관리자 추가는 비공개 `admin_accounts`에서 관리합니다.

권한 검증과 관리 작업의 `SECURITY DEFINER` 함수는 비공개 스키마에 있고 공개 RPC는 `SECURITY INVOKER`입니다. 비공개 관리자 목록·토큰 해시 테이블의 [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)는 클라이언트 접근을 전부 차단하기 위한 설정입니다.

## Google 관리자 로그인 최초 설정

1. Google Cloud의 Google Auth Platform에서 프로젝트와 앱을 설정합니다. 대상은 외부로 설정하고 데이터 접근 범위는 `openid`, `email`, `profile`만 사용합니다. 기본 로그인 범위만 요청할 때는 테스트 모드여도 테스트 사용자 목록에 없는 계정으로 로그인할 수 있습니다([Google 공식 안내](https://support.google.com/cloud/answer/15549945?hl=en)). 추가 Google API 범위를 요청하면 이 예외는 적용되지 않습니다.
2. OAuth 클라이언트 유형을 웹 애플리케이션으로 만들고 승인된 JavaScript 원본에 `http://127.0.0.1:5173`, 승인된 리디렉션 URI에 `https://gnfvhzmaxqnnudjgrotf.supabase.co/auth/v1/callback`을 등록합니다.
3. 생성된 Client ID와 Client Secret을 Supabase의 Authentication → Sign In / Providers → Google에 입력하고 활성화합니다. Client Secret을 저장소나 브라우저 환경 변수에 넣지 않습니다.
4. Supabase Authentication → URL Configuration에서 Site URL은 `http://127.0.0.1:5173`, Redirect URLs에는 `http://127.0.0.1:5173/auth/callback`을 등록합니다. localhost로도 사용할 경우 해당 원본과 콜백을 추가합니다.
5. `/admin` 또는 `/presenter`에서 Google로 로그인합니다. 로그인 성공 후에도 허용 목록에 없는 계정은 CMS·진행 화면·관리 API에 접근할 수 없습니다. 목록 관리는 DB 운영자만 수행합니다.

현재 OAuth 제공자 설정이 완료되기 전에는 관리자 페이지가 잠깁니다. 실제 Google 로그인 왕복 검증은 위 설정 후 수행합니다. 로그인 세션을 폐기하거나 DB 허용 목록에서 계정을 제거하면 후속 관리자 API 요청이 거부됩니다.

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
