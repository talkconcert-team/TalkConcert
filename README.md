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
```

## 실행

```sh
pnpm dev
```

브라우저에서 http://localhost:5173 접속

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
