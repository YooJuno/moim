# SOLAPI 일정 문자 알림 설정

확인일: 2026-10-24. 사이트는 Firebase Spark를 유지하고, 문자는 별도 Cloudflare Worker에서 SOLAPI로 접수합니다. **문자 발송은 SOLAPI 충전금이 차감되는 유료 작업입니다.** 개발·검증 과정에서는 실제 문자를 발송하지 않습니다.

현재 서버 `https://moim-auth.moim-auth-worker.workers.dev`의 SOLAPI 인증·잔액 있음·발신번호 사용 가능 상태를 읽기 전용으로 확인했습니다. 서버 발송 준비는 완료했고 모임의 문자 사용·자동 발송 옵션은 꺼져 있습니다. 실제 발송과 테스트 문자 전송은 하지 않았습니다.

## SOLAPI에서 준비할 것

1. [SOLAPI 콘솔](https://console.solapi.com/)에서 계정과 본인 인증을 완료합니다.
2. **발신번호 관리**에서 문자에 표시할 발신번호를 등록하고 인증을 완료합니다. 서버의 번호는 등록된 번호와 같아야 합니다. [발신번호·문자 발송 가이드](https://solapi.com/guides/sms-howtosend)
3. **API Key 관리**에서 API Key와 API Secret을 발급합니다. [공식 API Key 인증](https://solapi.com/developers/api/authentication-api-key)
4. 실제 발송 직전에 충전 잔액과 적용 단가를 확인합니다. 현재 표준 LMS 단가는 **45원 + VAT/건**이며 계정별 실제 단가가 다를 수 있습니다. 20건이면 표준가 기준 VAT 포함 약 **990원**입니다. [SOLAPI 가격 정책](https://solapi.com/guides/pricing)

이메일이나 메신저 계정 대신 멤버 프로필의 국내 휴대전화 번호를 사용합니다. 수신번호가 없거나 잘못된 멤버는 미리보기에서 제외됩니다.

## Worker에 키 저장

Cloudflare 계정·인증 Worker가 아직 없다면 [로그인 서버 설정](LOGIN_SETUP.md)의 Cloudflare와 Firebase 서비스 계정 준비 단계를 먼저 진행합니다. 카카오·네이버 키는 문자 기능에 필요하지 않습니다.

키와 발신번호는 **Worker Secret**으로만 저장합니다. 브라우저 `.env`의 `VITE_` 변수에는 넣지 않습니다.

```sh
cd services/auth-worker
npx wrangler secret put SOLAPI_API_KEY
npx wrangler secret put SOLAPI_API_SECRET
npx wrangler secret put SOLAPI_SENDER
```

로컬 테스트용 파일은 git에서 제외된 `services/auth-worker/.dev.vars`입니다. 값이 들어 있는 이 파일을 커밋하거나 출력하지 않습니다. `wrangler secret put`은 서버 설정을 반영하는 배포 작업이며, 위 명령 자체는 문자 발송 API를 호출하지 않습니다.

`wrangler.jsonc`의 `vars`에 다음 값을 설정합니다.

```json
{
  "FIREBASE_PROJECT_ID": "moim-juno",
  "SMS_ENABLED": "false",
  "SOLAPI_LMS_UNIT_PRICE": "45"
}
```

`SOLAPI_LMS_UNIT_PRICE`는 **VAT 별도 LMS 건당 예상 단가**입니다. 실제 계정 단가가 다르면 맞춰 줍니다. 미리보기는 여기에 VAT 10%를 더해 예상 비용을 표시하며, 실제 차감 내역은 SOLAPI에서 확인합니다.

서비스 계정과 `VITE_AUTH_API_URL`은 [Worker 연결 안내](LOGIN_SETUP.md)를 따릅니다. 서버를 배포하고 `/config`에서 `notifications.sms`가 `false`인지 확인합니다. 준비를 마친 뒤에만 `SMS_ENABLED=true`로 바꿔 다시 배포합니다. 이 플래그 변경 자체로 문자가 발송되지는 않습니다.

## 사이트에서 사용

1. 기존 관리자 계정으로 로그인합니다.
2. 모임 설정에서 **문자 알림 사용**을 켭니다. 서버와 사이트 설정이 모두 켜져 있어야 유료 발송이 가능합니다.
3. 확정된 일정의 **문자 알림**에서 대상·마스킹 번호·문구·예상 비용을 확인합니다.
4. 명시적인 **N건 유료 발송** 버튼을 눌렀을 때만 수동 접수합니다. 데모에서는 발송하지 않습니다.

대상은 다음 기준으로 서버에서 다시 계산합니다.

- 현재 활성 멤버 중 일정에 **참여 예정**으로 응답한 사람
- RSVP 응답이 없고, 원본 일정 투표에서 **확정된 전체 연속 시간**에 가능하다고 선택한 사람
- **불참 응답자는 제외**, 같은 전화번호는 한 건으로 합산

브라우저가 보낸 번호나 수신자 명단은 사용하지 않습니다. 미리보기 이후 일정·멤버 상태·번호·투표가 바뀌면 기존 미리보기로 발송할 수 없습니다. 현재 무료 Worker의 외부 요청 한도를 고려해 활성 멤버 **최대 30명** 범위로 제한합니다.

장문 LMS로 일정명·일시·장소·사이트 링크를 보냅니다. 본문은 보수적인 UTF-8 1,900바이트 이내이며 특수 이모지는 제외합니다. 긴 장소명 등은 문자 안에서 줄여 표시하고 전체 내용은 일정 링크에서 확인합니다. [문자 규격](https://solapi.com/guides/sms), [공식 발송 API](https://solapi.com/developers/api/messages)

## 일정 확정 시 자동 알림

기본값은 꺼짐입니다. 관리자가 사이트의 **일정 확정 시 자동 발송**까지 켠 경우에만 확정 처리 후 서버의 자동 경로를 사용합니다. `SMS_ENABLED`, 모임의 `smsEnabled`, `smsAutoOnConfirm`이 모두 켜져 있어야 합니다. 자동 발송을 켜면 매번 별도 발송 버튼 없이 비용이 발생하므로 예상 단가와 프로필 번호를 먼저 확인합니다.

## 결과와 중복 방지

**접수 완료는 휴대전화 수신 완료를 뜻하지 않습니다.** API가 수락한 메시지 ID·그룹 ID와 결과 코드를 서버 전용 `smsDeliveries`에 기록합니다. 실제 전달 결과는 SOLAPI 문자발송 내역에서 확인합니다. [접수 응답 구조](https://solapi.com/developers/api/messages)

같은 일정·같은 문자 내용·같은 번호의 요청은 다시 접수하지 않습니다. 중복 클릭과 동시 요청도 서버에서 차단합니다. 타임아웃·연결 끊김 등으로 결과가 불명확하면 **결과 확인 필요** 또는 **처리 확인 필요**로 남기며 자동 재시도하지 않습니다. SOLAPI에서 해당 발송의 접수 여부를 확인한 뒤 개발자가 기록을 정리해야 재시도할 수 있습니다. 번호·키를 바꾸거나 버튼을 반복해서 눌러 확인하지 않습니다.

## 개발 검증

```sh
cd services/auth-worker
npm run check
npm test
```

테스트는 합성 데이터와 가짜 키, mock HTTP 응답만 사용합니다. 실제 번호·API 인증정보를 테스트 코드에 넣지 않고, 테스트 발송도 실행하지 않습니다.
