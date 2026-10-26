# 오류 기록

Google 로그인 실패, 화면 오류, Firestore 오류와 Worker가 처리한 실패 응답을 관리자 화면에서 확인합니다. 도입 전 오류는 소급 수집하지 않습니다.

## 기록 항목

- 허용 목록에 있는 오류 코드와 작업 종류
- 고정 페이지 또는 서버 경로 분류. 게시글 ID·일정 ID·쿼리 문자열은 제외
- 배포 식별자, 브라우저 종류, 모바일·PC 구분
- 최대 5개의 소스 파일명·줄·열 번호
- 서버 수집 시각과 중복 구분용 SHA256
- 서버 실패의 HTTP 상태. OAuth 콜백의 논리적 실패는 리다이렉트 응답과 구분하여 상태를 생략

원문 오류 메시지, 전체 스택, 함수명, URL, 요청 헤더·본문, 이메일·전화번호·주소·UID·토큰·게시글 내용은 저장하지 않습니다. 입력 스키마는 공통 [계약](../shared/error-telemetry.ts)과 서버의 허용 목록을 따릅니다. 알 수 없는 클라이언트 오류 코드는 `unknown-error`로 바꿉니다.

## 저장 범위와 제한

`appErrors/slot-000`부터 `slot-255`까지 최대 256개 문서와 `appErrorMeta/budget` 한 개만 사용합니다. 날짜와 fingerprint로 슬롯을 정하며 충돌하면 기존 슬롯을 덮어씁니다. 전체 오류 발생 횟수를 모두 세는 통계 저장소가 아닙니다.

하루 최대 200건의 기록을 저장합니다. 예산 문서와 오류 문서를 원자적으로 갱신하며 버전 조건으로 동시 요청도 상한을 지킵니다. 기록 한 건은 최대 문서 두 개를 씁니다. 같은 fingerprint는 10분 안에 다시 저장하지 않습니다. 관리자 조회는 최근 7일 안의 로그를 최대 50개 반환합니다. `count`는 실제 모든 발생 횟수가 아닌 저장된 기록 횟수입니다.

7일이 지난 문서는 조회에서 제외하며 새로운 로그가 슬롯을 덮어씁니다. 시간에 따른 실제 삭제를 보장하는 방식은 아닙니다. 저장 문서 수가 고정되어 별도 Cron이나 유료 Firestore TTL 기능이 필요하지 않습니다.

공개 수집 요청은 UTF-8 JSON 4KiB로 제한하며, 허용된 Origin에서만 받습니다. DB 접근 전 IP당 분당 5회, Worker isolate 전체 분당 30회로 제한합니다. 메모리 제한은 isolate 사이에서 공유하는 전역 네트워크 방화벽이 아니며, 하루 200건 저장 상한은 Firestore에서 별도로 강제합니다. 기록 요청 처리 중 IP는 메모리 제한 키로만 사용하고 DB에는 남기지 않습니다.

## API

| 경로 | 권한 | 응답 |
| --- | --- | --- |
| `POST /telemetry/errors` | 허용된 Origin. 로그인 전 실패 수집을 위해 익명 허용 | `202 {accepted:true}` |
| `GET /telemetry/errors?limit=50` | 현재 Firebase 계정 확인 + `active/leader` | `{enabled,errors}` |

관리자도 Firebase 클라이언트 SDK로 `appErrors`와 `appErrorMeta`를 직접 조회하거나 변경할 수 없습니다. Worker 서비스 계정이 저장과 조회를 처리하며, 조회 시에도 저장된 필드를 다시 검증합니다.

`TELEMETRY_ENABLED=true`와 기존 Firebase 서버 인증이 준비되면 수집합니다. `TELEMETRY_RELEASE`에 Git SHA 또는 `GitSHA-YYYYMMDDTHHMMSSZ`를 지정할 수 있으며, 없으면 서버 기록의 배포 식별자는 `unknown`입니다. 프런트엔드 배포 식별자는 별도 빌드 값으로 기록합니다.

## 실패 처리와 개인 정보

로그 저장은 `ctx.waitUntil()`에서 처리하여 기존 로그인·검색·일정·문자 응답을 기다리게 하지 않습니다. 기록 중 오류가 발생해도 원래 응답을 바꾸지 않으며, 수집 API의 실패를 다시 수집하지 않습니다. 네트워크 문제나 실행 종료로 기록이 유실될 수 있습니다. [Cloudflare waitUntil](https://developers.cloudflare.com/workers/runtime-apis/context/)

Worker의 일반 Observability는 계속 비활성으로 둡니다. 자동 요청 로그에 OAuth 쿼리 등이 포함되는 대신, 필요한 고정 필드만 Firestore에 직접 씁니다. [Workers invocation logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#invocation-logs)

## 검증

```sh
cd services/auth-worker
npm run check
npm test
npm run build
```

테스트는 합성 데이터와 모의 저장소·HTTP를 사용합니다. 규칙 테스트는 로컬 Firebase 에뮬레이터에서만 실행합니다. 실제 문자 발송이나 외부 일정 생성은 테스트에 포함하지 않습니다.

## 화면 복구와 소스 위치 확인

로그인 오류는 토스트만 표시하지 않고 로그인 화면에 남깁니다. 이미 인증된 세션의 회원 정보 조회 실패는 같은 로그인 버튼으로 복구하고, 다른 계정 선택도 가능합니다. 화면 렌더링과 최초 모듈 로딩 오류는 복구 화면의 **다시 불러오기**로 새 배포본을 불러옵니다.

운영 빌드는 비공개 source map을 `.debug/sourcemaps/<release>/`에 보관합니다. 최근 10개 운영 빌드를 유지하며 demo 빌드는 보관하지 않습니다. `.debug`는 Git에서 제외하고, `*.map`은 Firebase Hosting 업로드에서 제외합니다. 관리 화면의 배포 버전과 파일·줄·열로 원본 코드를 확인합니다.

```sh
node scripts/resolve-error-frame.mjs <release> <asset.js> <line> <column>
```

도입 전 오류는 복원할 수 없습니다. Chrome intent 링크와 UI는 자동화로 검증하지만, 실제 카카오톡→외부 브라우저 전환 및 Google 계정 인증은 실제 기기에서 확인해야 합니다. Google의 embedded user-agent 제한은 [Google OAuth 정책](https://developers.google.com/identity/protocols/oauth2/policies#use-secure-browsers)을 따릅니다.
