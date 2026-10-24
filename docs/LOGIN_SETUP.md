# 카카오·네이버 로그인 연결

확인일: 2026-10-24. 기존 사이트는 [moim-juno.web.app](https://moim-juno.web.app)이며 Firebase Spark를 유지합니다. 카카오·네이버 로그인에는 개발자 앱의 로그인 키와 별도 인증 서버가 필요합니다. 인증 서버는 [https://moim-auth.moim-auth-worker.workers.dev](https://moim-auth.moim-auth-worker.workers.dev)에 배포했습니다. Firebase 서버 인증과 SOLAPI Secret 연결은 완료했으며 카카오·네이버 앱의 로그인 키 등록이 남아 있습니다. 기존 서비스에서는 아래 Cloudflare 계정·서비스 계정 생성 단계를 반복할 필요가 없습니다.

현재 연결에서 필요한 작업은 카카오·네이버 개발자 앱의 콜백과 로그인 키 설정입니다. 한 제공자만 먼저 설정해도 됩니다. 아래 서버 준비 단계는 새 프로젝트에서 처음 연결할 때의 절차입니다.

## 1. Cloudflare 계정과 서버 주소 준비

1. [Cloudflare 가입](https://dash.cloudflare.com/sign-up)에서 계정을 만들고 이메일 인증을 마칩니다.
2. 대시보드의 **Workers & Pages**로 이동합니다. **Your subdomain** 옆 **Change**에서 사용할 `workers.dev` 하위 도메인을 확인하거나 정합니다.
3. 이 레포의 Worker 이름은 `moim-auth`입니다. 계정 하위 도메인이 `my-moim`이면 서버 주소는 `https://moim-auth.my-moim.workers.dev`가 됩니다. 별도 도메인 구매나 Firebase Hosting 도메인 이전은 필요하지 않습니다. [공식 workers.dev 설정](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

현재 서버 origin은 `https://moim-auth.moim-auth-worker.workers.dev`입니다. 아래 표와 콘솔 입력에는 이 주소를 사용합니다.

| 입력할 곳 | 값 |
| --- | --- |
| 카카오 로그인 리다이렉트 URI | `https://moim-auth.moim-auth-worker.workers.dev/oauth/kakao/callback` |
| 네이버 로그인 Callback URL | `https://moim-auth.moim-auth-worker.workers.dev/oauth/naver/callback` |
| Worker의 `AUTH_BASE_URL` | `https://moim-auth.moim-auth-worker.workers.dev` |
| 사이트의 `VITE_AUTH_API_URL` | `https://moim-auth.moim-auth-worker.workers.dev` |
| 로그인 완료 후 사이트가 받는 주소 | `https://moim-juno.web.app/auth/callback` |

**카카오·네이버 개발자 콘솔에는 Worker의 콜백 주소를 등록합니다.** 마지막 행의 사이트 주소는 Worker가 인증 처리를 마친 뒤 이동시키는 별도 경로입니다.

Cloudflare는 기본으로 Workers Free를 제공합니다. 현재 무료 한도는 계정 전체 요청 **하루 100,000회**, 요청당 CPU **10ms**입니다. 이 구성은 Workers Paid 전환이나 Firebase Blaze 전환을 요구하지 않으며, 운영 시에는 무료 한도를 확인합니다. [Workers 요금제](https://developers.cloudflare.com/workers/platform/pricing/), [무료 한도](https://developers.cloudflare.com/workers/platform/limits/)

## 2. 카카오 앱 설정

이미 카카오톡 공유용 JavaScript 키를 만든 앱이 있으면 **같은 앱을 사용합니다.** JavaScript 키는 현재 공유 기능에 쓰이며, 이번 서버 로그인은 **REST API 키와 Client Secret**을 사용합니다. 서비스마다 앱 하나를 유지하는 것이 카카오의 안내입니다. [앱과 플랫폼 키](https://developers.kakao.com/docs/ko/app-setting/app)

앱이 없다면 [카카오디벨로퍼스 앱](https://developers.kakao.com/console/app)에서 **앱 생성**을 선택합니다. 앱 이름은 실제 모임/서비스 이름, 회사명은 운영 단체나 개인 개발자 출처, 대표 도메인은 `https://moim-juno.web.app`로 입력합니다. [공식 앱 생성 순서](https://developers.kakao.com/docs/ko/tutorial/start)

1. 해당 앱의 **앱 > 플랫폼 키 > REST API 키**에서 키를 확인합니다. 서버의 `KAKAO_REST_API_KEY`에 사용할 값입니다.
2. 같은 REST API 키의 **카카오 로그인 리다이렉트 URI**에 다음 주소를 추가하고 **저장**합니다.

   ```text
   https://moim-auth.moim-auth-worker.workers.dev/oauth/kakao/callback
   ```

   주소의 프로토콜·경로·끝 슬래시까지 실제 요청과 같아야 합니다. [리다이렉트 URI 등록](https://developers.kakao.com/docs/ko/app-setting/app#redirect-uri)

3. **카카오 로그인 > 사용 설정 > 상태**를 **ON**으로 바꿉니다.
4. **앱 > 플랫폼 키 > REST API 키 > 클라이언트 시크릿**에서 시크릿을 확인합니다. 서버의 `KAKAO_CLIENT_SECRET`에 등록합니다. 현재 카카오 문서는 새 REST API 키의 Client Secret이 기본 활성화된다고 안내하며, 이 서버도 시크릿을 사용합니다.
5. **카카오 로그인 > 동의항목 > 개인정보**에서 필요한 항목을 설정합니다. 닉네임을 이름 입력의 초기값으로 쓰려면 닉네임 항목을 설정합니다. 이메일·전화번호·생일을 로그인 필수 항목으로 추가할 필요는 없습니다. 별도 권한이 필요한 개인정보는 심사를 거쳐야 합니다. [카카오 로그인 사용 설정·시크릿·동의항목](https://developers.kakao.com/docs/ko/kakaologin/prerequisite)

현재 Worker는 REST OAuth로 사용자 정보를 확인하므로 이 절차에서 OpenID Connect 활성화는 요구하지 않습니다. 톡캘린더는 별도 권한이므로 우선 `KAKAO_CALENDAR_ENABLED=false`로 둡니다.

## 3. 네이버 앱 설정

1. [네이버 개발자센터](https://developers.naver.com/)에서 **Application > 애플리케이션 등록**을 선택합니다. 처음이면 약관 동의와 담당자 정보·휴대폰 인증을 진행합니다.
2. 실제 서비스 이름을 입력하고 **사용 API**에서 **네이버 로그인**을 선택합니다.
3. **로그인 오픈 API 서비스 환경**에서 **PC 웹**과 **Mobile 웹**을 추가하고, 각각 다음 값을 입력합니다.

   | 항목 | 값 |
   | --- | --- |
   | 서비스 URL | `https://moim-juno.web.app` |
   | 네이버 로그인 Callback URL | `https://moim-auth.moim-auth-worker.workers.dev/oauth/naver/callback` |

4. 등록 후 **Application > 내 애플리케이션**에서 해당 앱의 **Client ID**와 **Client Secret**을 확인합니다. 각각 서버의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`으로 등록합니다. 환경과 콜백은 **API 설정**에서 수정합니다. [공식 애플리케이션 등록](https://developers.naver.com/docs/common/openapiguide/appregister.md), [콜백 설정 확인](https://help.naver.com/service/23029/contents/19600?lang=ko)

조회 권한은 기본 **이용자 식별자**로 시작할 수 있습니다. 이름·별명 등 추가 정보를 선택하면 서비스에서 실제 사용하는 화면이 검수 대상입니다. 이 사이트는 이름을 직접 입력할 수 있어 전화번호·생일·이메일 조회 권한을 필수로 신청할 필요가 없습니다.

정식으로 일반 멤버에게 열기 전에는 **사전 검수**를 통과해야 합니다. 검수 전에는 앱 관리자와 등록한 테스터만 로그인할 수 있습니다. 테스트 계정으로 로그인 → 정보 입력 → 승인 대기까지의 화면을 준비하고, 추가 조회 정보를 선택했다면 그 활용 화면도 제출합니다. [네이버 사전 검수 기준](https://developers.naver.com/docs/login/verify/verify.md)

## 4. Firebase 서버 인증 정보 준비

이 단계는 `moim-juno` 프로젝트 관리자가 진행합니다. 앱의 Firebase 웹 설정과 서비스 계정 비밀키는 서로 다른 값입니다.

1. [Google Cloud 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts?project=moim-juno)에서 프로젝트가 **moim-juno**인지 확인하고 인증 Worker 전용 서비스 계정을 만듭니다.
2. 프로젝트에서 다음 역할을 부여합니다. Worker 구현은 Firebase 사용자 생성·조회와 인증 상태 문서 저장에 사용합니다.

   - **Firebase Authentication Admin** — `roles/firebaseauth.admin`. [역할 문서](https://firebase.google.com/docs/projects/iam/roles-predefined-product)
   - **Cloud Datastore User** — `roles/datastore.user`. [역할 문서](https://docs.cloud.google.com/iam/docs/roles-permissions/firestore)

3. 해당 서비스 계정의 **Keys > Add key > Create new key > JSON**으로 키를 발급합니다. JSON의 `client_email`과 `private_key`가 각각 Worker의 `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`입니다. 키 파일은 레포 밖에 보관하고 서버 Secret으로만 등록합니다. [공식 키 발급 절차](https://docs.cloud.google.com/iam/docs/keys-create-delete)

## 5. Worker 설정 및 배포

이하 명령은 준비한 인증 서버를 실제로 연결할 때 실행합니다. 레포 루트에서 시작합니다.

```sh
cd services/auth-worker
npm ci
npm run check
npm test
npm run build
npx wrangler login
```

마지막 명령은 Cloudflare 로그인·권한 승인을 위해 브라우저를 엽니다. `npm run build`는 이 Worker 폴더에서 배포 없이 결과를 검사하는 dry run입니다. [Wrangler 시작과 배포](https://developers.cloudflare.com/workers/get-started/guide/)

`services/auth-worker/wrangler.jsonc`의 `vars`를 실제 주소에 맞춥니다. 다음은 예시입니다.

```json
{
  "FIREBASE_PROJECT_ID": "moim-juno",
  "AUTH_BASE_URL": "https://moim-auth.my-moim.workers.dev",
  "ALLOWED_ORIGINS": "https://moim-juno.web.app,https://moim-juno.firebaseapp.com",
  "KAKAO_CALENDAR_ENABLED": "false"
}
```

`ALLOWED_ORIGINS`에는 로그인 화면을 실제로 열 사이트의 **origin**만 넣습니다. 경로와 끝 슬래시는 제외하며, 여러 주소는 쉼표로 구분합니다. 로컬 테스트가 필요하면 해당 개발 서버 origin을 추가합니다.

처음에는 다음 명령으로 Worker를 생성하고 표시된 주소를 확인합니다. Secret이 준비되기 전에는 로그인 제공자가 활성화되지 않습니다.

```sh
npm run deploy
```

Secret은 다음 이름으로 등록합니다. 각 `put` 명령이 값을 묻는 입력창에 해당 값을 넣습니다. 설정한 제공자만 등록해도 됩니다.

```sh
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler secret put STATE_SECRET
npx wrangler secret put TOKEN_ENCRYPTION_KEY
npx wrangler secret put KAKAO_REST_API_KEY
npx wrangler secret put KAKAO_CLIENT_SECRET
npx wrangler secret put NAVER_CLIENT_ID
npx wrangler secret put NAVER_CLIENT_SECRET
```

`STATE_SECRET`과 `TOKEN_ENCRYPTION_KEY`는 개발자가 **서로 다른 32바이트 난수**를 base64url 형식으로 생성해 등록합니다. `FIREBASE_PRIVATE_KEY`는 PEM 헤더와 줄바꿈을 포함합니다. 여러 줄 입력은 Cloudflare의 **Workers & Pages > 해당 Worker > Settings > Variables and Secrets > Add > Secret**에서도 설정할 수 있습니다.

`wrangler secret put`은 Worker 버전을 만들고 즉시 반영하는 배포 작업입니다. 로컬 테스트용 값은 git에서 제외된 `services/auth-worker/.dev.vars`에 두며, 앱 Secret과 Firebase 비밀키에는 `VITE_` 접두사를 붙이지 않습니다. [Secret 등록과 로컬 파일 안내](https://developers.cloudflare.com/workers/configuration/secrets/)

최종 코드를 배포합니다.

```sh
npm run deploy
```

배포 결과의 Worker 주소가 앞서 콘솔에 등록한 주소 및 `AUTH_BASE_URL`과 같은지 확인합니다. `https://moim-auth.moim-auth-worker.workers.dev/config`에서 준비된 제공자가 `true`로 표시되어야 합니다. 이 조회는 사용자 로그인이나 메시지 발송을 실행하지 않습니다.

레포 루트의 git에서 제외된 `.env.local`에는 공개 서버 주소만 추가합니다.

```dotenv
VITE_AUTH_API_URL=https://moim-auth.my-moim.workers.dev
```

이후 사이트를 다시 빌드하고 Firebase Hosting에 배포하면 준비된 제공자의 로그인 버튼이 나타납니다. 이 서버 방식은 Firebase 콘솔에 카카오·네이버 OIDC 제공자를 추가하는 절차를 사용하지 않습니다.

## 6. 기존 Google 계정에 연결

기존 멤버는 **기존 Google 계정으로 먼저 로그인**한 뒤 **내 정보(`/profile`) > 계정**에서 카카오 또는 네이버 행의 **연결**을 선택합니다. 완료되면 **연결됨**으로 표시됩니다. 이후 연결한 로그인 방식을 사용하면 같은 Firebase 사용자로 들어옵니다.

로그아웃한 상태에서 아직 연결하지 않은 카카오·네이버로 처음 로그인하면 별도 신규 계정과 승인 대기가 생길 수 있습니다. 이름이나 이메일이 같다는 이유로 자동 병합하지 않습니다. 이미 다른 계정에 연결됐다는 메시지가 나오면 기존 계정으로 돌아가 연결 상태를 확인합니다. 이 동작은 이 레포의 인증 서버와 계정 연결 구현을 기준으로 합니다.

완료 확인은 기존 계정으로 연결 → 로그아웃 → 연결한 제공자로 로그인 → 같은 프로필·역할·기록 확인 순서로 진행합니다. 신규 가입자의 관리자 승인 절차는 그대로 적용됩니다.
