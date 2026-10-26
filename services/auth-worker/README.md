# 소셜 로그인·톡캘린더 Worker

Firebase Hosting 프런트엔드에 연결하는 별도 Cloudflare Worker입니다. Firebase 요금제를 바꾸지 않고 카카오·네이버 OAuth의 비밀키 처리와 Firebase 커스텀 토큰 발급을 분리합니다. 운영 서버는 `https://moim-auth.moim-auth-worker.workers.dev`이며 Firebase 서버 인증과 SOLAPI Secret을 연결했습니다. 카카오·네이버 로그인 앱 키는 아직 등록하지 않았고 실제 문자는 발송하지 않았습니다.

사용자 콘솔 설정: [로그인 설정 안내](../../docs/LOGIN_SETUP.md).

네이버 장소 이름 검색 설정: [NAVER API HUB 연결 안내](../../docs/NAVER_SEARCH_SETUP.md). 검색 키는 로그인 키와 분리하며, 기본 설정은 `NAVER_SEARCH_ENABLED=false`입니다.

관리자용 오류 기록: [오류 수집 범위와 API](../../docs/ERROR_LOGGING.md). 허용된 코드·경로·파일 위치만 기록하며 일반 요청 로그는 활성화하지 않습니다.

## 준비와 검증

```sh
npm ci
npm run check
npm test
npm run build
```

`build`는 `wrangler deploy --dry-run`입니다. Cloudflare 계정이나 운영 비밀키 없이 번들을 검증합니다. 테스트는 메모리 저장소와 모의 OAuth·캘린더를 사용하며 실제 Firebase 사용자나 외부 일정을 만들지 않습니다. 런타임 의존 패키지는 없고 Web Crypto·Fetch만 사용합니다.

## 설정

`wrangler.jsonc`의 공개 변수:

| 이름 | 값 |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID |
| `AUTH_BASE_URL` | Worker의 공개 origin, 경로·마지막 `/` 제외 |
| `ALLOWED_ORIGINS` | 프런트엔드 origin을 쉼표로 구분, 와일드카드 없음 |
| `KAKAO_CALENDAR_ENABLED` | 기본 `false`; 톡캘린더 사용 권한과 사용자 동의 설정 후에만 `true` |
| `NAVER_SEARCH_ENABLED` | 기본 `false`; 검색용 키 연결과 현재 이용요금 확인 후 `true` |
| `NAVER_SEARCH_API` | 신규 키는 `hub`(기본), 기존 개발자센터 키는 `legacy` |
| `TELEMETRY_ENABLED` | `true`일 때 안전한 오류 필드만 최대 하루 200건·256개 슬롯으로 기록 |
| `TELEMETRY_RELEASE` | 선택 Git SHA 또는 `GitSHA-YYYYMMDDTHHMMSSZ`. 미설정 시 `unknown` |

비밀값은 `wrangler secret put NAME`으로 설정합니다. 로컬에서만 `.dev.vars.example`을 `.dev.vars`로 복사해 사용합니다.

| 비밀 이름 | 내용 |
| --- | --- |
| `FIREBASE_CLIENT_EMAIL` | 서버용 서비스 계정 이메일 |
| `FIREBASE_PRIVATE_KEY` | 해당 서비스 계정의 PKCS8 PEM 비밀키 |
| `STATE_SECRET` | 무작위 32바이트의 base64url 값 |
| `TOKEN_ENCRYPTION_KEY` | 별도로 생성한 무작위 32바이트의 base64url 값 |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` | 카카오 REST 앱 설정 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 앱 설정 |
| `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET` | NAVER API HUB 장소 검색 키. OAuth 키와 별도로 저장 |

서비스 계정에는 해당 프로젝트의 Firebase Authentication Admin과 Cloud Datastore User 권한이 필요합니다. 계정 키 JSON은 레포 밖에 보관하고 비밀키를 `VITE_` 변수나 브라우저 코드에 넣지 않습니다. Firebase Admin SDK와 Node 런타임은 사용하지 않습니다.

프런트엔드에는 공개 Worker 주소만 `VITE_AUTH_API_URL=https://<worker>.workers.dev`로 설정합니다. 사용자 콘솔에 등록하는 콜백은 다음과 같습니다.

```text
https://<worker>.workers.dev/oauth/kakao/callback
https://<worker>.workers.dev/oauth/naver/callback
```

Worker가 돌아오는 프런트엔드 경로는 허용한 origin의 `/auth/callback`으로 고정합니다.

## API 계약

| API | 인증·입력 | 응답 |
| --- | --- | --- |
| `GET /config` | 공개 | `{providers:{kakao,naver},calendar:{kakao},notifications:{sms},places:{naver}}`, 불리언만 반환 |
| `GET /places/search?q=검색어` | Firebase Bearer 토큰, 승인된 사용자 또는 승인 대기자, 검색어 최대 120자 | `{places:[{id,name,address,roadAddress,latitude?,longitude?,naverUrl}]}`, 최대 5개 |
| `POST /telemetry/errors` | 허용된 Origin, 최대 4KiB의 허용된 오류 필드, 익명 허용 | `202 {accepted:true}`, 저장 오류가 기존 앱 동작에 영향을 주지 않음 |
| `GET /telemetry/errors?limit=50` | Firebase Bearer 토큰, 현재 승인된 관리자 | `{enabled,errors}`, 최근 7일·최대 50개 |
| `GET /oauth/:provider/start` | `challenge`, `returnOrigin`, 선택 `intent=signin` | 공급자 동의 화면으로 302 |
| `POST /oauth/:provider/link/start` | Firebase Bearer 토큰, JSON `{challenge,returnOrigin}` | `{authorizationUrl}` |
| `GET /oauth/:provider/callback` | 공급자의 `code`, `state` | 프런트엔드 `/auth/callback?code=...&provider=...&intent=...`로 302 |
| `POST /oauth/exchange` | JSON `{code,verifier}`, 연결 시 현재 Firebase Bearer 토큰도 필요 | 로그인 `{firebaseCustomToken,uid,intent:'signin',provider}`, 연결 `{linked:true,uid,intent:'link',provider}` |
| `GET /account/providers` | Firebase Bearer 토큰 | `{google,kakao,naver,calendar:{kakao}}` |
| `POST /calendar/kakao/events/:eventId/add` | Firebase Bearer 토큰, 현재 승인된 참석자 | `{added,alreadySynced,eventId,kakaoEventId}` |

프런트엔드는 32바이트 이상 무작위 verifier를 base64url로 만들고 `sessionStorage`에 보관한 뒤, `base64url(SHA256(verifier))`를 challenge로 전달합니다. 돌아온 provider·intent와 연결 대상 UID가 저장한 시도 정보와 같은지 확인한 뒤 교환합니다. 교환 JSON 외에 Firebase 커스텀 토큰이 전달되는 곳은 없습니다.

모든 POST는 정확한 허용 `Origin`을 요구합니다. CORS는 그 origin 하나만 반환하며 자격 증명 쿠키는 사용하지 않습니다. 연결 시작과 교환에서는 Firebase ID 토큰의 서명·프로젝트·발급자·만료와 비활성화/철회 시각을 확인합니다.

## 계정과 저장소

Firebase UID는 공급자의 검증된 subject에 연결합니다. 이름이나 이메일이 같아도 자동 병합하지 않습니다. 기존 Google 계정에 연결할 때는 검증한 현재 UID와 명시적인 연결 의도만 사용합니다. 다른 UID에 연결된 공급자 계정은 `provider_already_linked`로 거절합니다.

새 소셜 로그인 계정의 공개 멤버 문서는 `pending/member/canCreatePoll:false`, 개인 프로필은 빈 연락처로 생성합니다. 기존 계정의 이름·연락처·사이트 권한은 연결 과정에서 덮어쓰지 않습니다. 매핑된 Firebase Auth 사용자가 삭제되면 소셜 로그인으로 그 UID를 재생성하지 않습니다. 최초 신규 계정 생성 실패만 서버의 provisioning 상태와 권한 없는 pending 상태를 확인해 제한적으로 복구합니다. 카카오·네이버를 Firebase의 기본 제공 provider로 등록하는 방식이 아니라 서버의 subject 매핑과 커스텀 토큰을 사용합니다.

| 서버 전용 컬렉션 | 내용 |
| --- | --- |
| `authStates` | 10분 유효 OAuth 상태, challenge, 연결 UID, 허용 복귀 origin |
| `authExchanges` | 60초 유효 일회용 교환 코드와 암호화한 공급자 응답 |
| `authProviderSubjects` | 공급자 subject 해시 → Firebase UID |
| `authAccounts` | UID별 연결된 공급자 subject 해시 |
| `authProviderTokens` | AES-GCM으로 암호화한 카카오 토큰 |
| `authCalendarLinks` | 사용자별 외부 일정 ID와 마지막 반영 서명 |

기존 Firestore 규칙의 기본 거부가 이 컬렉션들에 적용되어야 합니다. 클라이언트 읽기·쓰기 규칙을 추가하지 마세요. 서비스 계정의 IAM 인증으로만 접근합니다. 상태와 코드는 원자적인 문서 버전 조건으로 한 번만 소비합니다. 만료는 요청 시 검사합니다. 공개 시작 요청은 IP별 분당 30회, 콜백·교환은 각각 60회로 제한합니다. 인메모리 버킷은 최대 2,000개이며 만료 시 재사용합니다. **이 제한은 Worker isolate 안에서만 적용되는 보조 장치로, 여러 isolate를 합친 강제 쿼터가 아닙니다.** 공개 운영에서 추가 제한이 필요하면 계정의 Cloudflare 보안 설정에서 구성해야 합니다.

중단되어 남은 만료 state/exchange는 관리자 PC에서 다음 명령으로 한 번에 최대 100개씩 정리합니다. 사용자·매핑·토큰·일정 문서는 정리 대상이 아닙니다. 서비스 계정 환경 변수는 레포 밖의 안전한 방식으로 제공하세요.

```sh
node --env-file=.dev.vars scripts/cleanup.mjs
node --env-file=.dev.vars scripts/cleanup.mjs --apply
```

첫 명령은 개수만 확인하며 두 번째 명령만 삭제합니다. 삭제 시 문서 버전을 확인해 동시에 소비되거나 수정된 문서를 덮어쓰지 않습니다. 유료 Firestore TTL 삭제나 예약 서비스를 활성화하지 않습니다.

콜백·토큰 교환 URL/본문과 OAuth 공급자의 원문 에러를 로그에 남기지 않습니다. 공개 응답은 정해진 오류 코드만 사용합니다. 저장 토큰은 UID·공급자 문서 경로를 AES-GCM 추가 인증 데이터로 사용해 다른 사용자 문서로 옮겨도 복호화되지 않습니다.

## 톡캘린더 범위

카카오 `talk_calendar` 동의 내역을 확인한 사용자만 본인 캘린더에 일정을 추가할 수 있습니다. 서버가 앱의 활성 멤버 상태와 `going` 참석 응답을 확인합니다. 명단의 다른 사람에게 임의로 일정을 만들거나 초대하지 않습니다. 만료한 카카오 액세스 토큰은 서버에서 갱신하고, 같은 일정을 다시 반영할 때 저장한 외부 일정 ID를 사용합니다. 동일한 내용의 반복 요청은 외부 API를 다시 호출하지 않습니다.

공식 일반 일정 생성 API에는 참석자 목록이나 비공개 일괄 초대 파라미터가 없습니다. 따라서 이 API는 참석자 각각의 **내 톡캘린더에 추가** 기능입니다. 공개 일정/구독 캘린더는 채널 권한을 포함한 별도 기능이며 여기에 구현하지 않았습니다.

일정 생성과 수정은 모두 처리 중 잠금으로 직렬화합니다. 인증 실패·권한 부족 등 외부 API가 명확히 거절한 경우에는 잠금을 원복하므로 다시 연결하고 재시도할 수 있습니다. 신규 외부 일정 생성 후 응답 또는 연결 정보 저장이 실패해 실제 반영 여부가 불명확하면 처리 상태를 자동으로 풀지 않습니다. `calendar_sync_needs_reconciliation`이 반환되면 실제 톡캘린더를 확인하고 관리자 도구로 연결 ID를 복구해야 합니다. 이미 `kakaoEventId`가 있는 경우 관리자가 실제 반영 상태를 확인한 뒤 서버 전용 연결 문서를 `status:synced`로 되돌리고 `signature`를 비우면 다음 요청이 같은 외부 ID를 갱신합니다. 신규 생성의 외부 ID가 불명확하면 이를 먼저 확인하며, 잠금만 삭제해 재생성하지 않습니다. 결과를 모르는 상태에서 자동 재생성해 중복 일정을 만들지 않기 위한 처리입니다. 날짜는 서울 기준이며 카카오 규격에 따라 시작·종료가 5분 단위여야 합니다.

## 배포

계정·키·서비스 계정 준비 후 설정 안내 순서에 따라 실행합니다.

```sh
npx wrangler login
npm run deploy
```

Cloudflare Free Worker만 대상으로 하며 유료 바인딩이나 Firebase Blaze 변경은 포함하지 않습니다. Firebase 서비스 계정의 읽기 권한과 공개 설정·CORS·인증 없는 요청 차단을 확인했습니다. 외부 소셜 OAuth 콜백·실제 메시지 발송·운영 부하는 아직 검증하지 않았습니다. 공개 배포 시 Cloudflare의 요청 제한/남용 방지와 Firestore 무료 사용량을 확인하고, 테스트 앱 모드의 사용자 제한도 공급자 콘솔에서 확인하세요.

공식 문서: [카카오 로그인 REST](https://developers.kakao.com/docs/ko/kakaologin/rest-api), [톡캘린더 REST](https://developers.kakao.com/docs/ko/talkcalendar/rest-api), [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md).
