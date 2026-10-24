# 카카오·네이버 로그인 연결

현재는 활성화 전입니다. 프런트엔드 코드와 인증 서비스 코드를 준비했으며, 인증 서버 배포와 Firebase 인증 연결은 완료했으며 각 제공자의 앱 등록·키 설정이 끝난 뒤 켤 수 있습니다. `VITE_AUTH_API_URL`이 없거나 서비스의 `/config`에 제공자가 비활성으로 표시되면 해당 로그인 버튼은 나오지 않습니다. 기존 Google 로그인은 그대로 사용할 수 있습니다.

## 등록 순서

1. 현재 인증 서버는 `https://moim-auth.moim-auth-worker.workers.dev`입니다. 새 프로젝트에 연결할 때는 [인증 서비스 안내](../services/auth-worker/README.md)에 따라 별도 서버를 준비합니다.
2. [Kakao Developers](https://developers.kakao.com/docs/latest/ko/kakaologin/prerequisite)에서 앱을 등록하고 카카오 로그인을 활성화합니다. 서비스 README에 지정된 실제 Worker 콜백 주소를 Redirect URI로 등록합니다. REST API 키와 Client Secret은 Worker의 비밀 설정에만 넣습니다.
3. [네이버 Developers](https://developers.naver.com/docs/login/register/register.md)에서 네이버 로그인 애플리케이션을 등록합니다. 서비스 URL은 실제 사이트 주소, Callback URL은 서비스 README의 실제 Worker 콜백 주소로 설정합니다. Client ID와 Client Secret은 Worker에만 둡니다.
4. Worker에 허용할 사이트 origin, 실제 인증 서비스 주소, Firebase 인증 설정과 각 제공자의 키를 입력하고 배포합니다. 현재 서버에는 Firebase/SOLAPI 설정이 등록돼 있으며 카카오·네이버 앱 키 등록만 남아 있습니다.
5. `/config`에서 사용할 제공자만 활성으로 반환하는지 확인한 뒤 프런트엔드의 `VITE_AUTH_API_URL`을 실제 인증 서비스 URL로 설정하고 다시 빌드합니다.

Kakao JavaScript 키는 기존 카카오톡 공유용 설정입니다. 카카오 로그인용 REST API 키·Client Secret과 서로 다른 설정이며, 네이버 Client Secret을 포함한 비밀키를 `VITE_` 변수나 브라우저 코드에 넣으면 안 됩니다.

## 로그인과 기존 계정 연결

- 로그인 화면의 카카오·네이버 버튼은 서비스에서 실제 활성화한 제공자만 표시합니다.
- 기존 멤버는 원래 계정으로 로그인한 뒤 **내 정보 → 계정 → 연결**에서 다른 로그인 방식을 연결합니다. 연결은 현재 Firebase UID에 묶이며, 다른 계정의 정보를 자동으로 합치지 않습니다.
- 새 소셜 계정은 서비스가 가입 승인 대기 상태로 만듭니다. 이후 관리자의 승인이 필요합니다.
- Google 계정이 없는 소셜 로그인 사용자는 내 정보에서 Google을 연결할 수 있습니다. 이미 다른 계정에 쓰인 Google 인증 정보는 자동 병합하지 않습니다.

인증 요청은 브라우저의 암호학적 난수와 SHA-256 challenge로 연결합니다. 브라우저에는 짧게 유지되는 verifier만 `sessionStorage`에 두고, 제공자의 Client Secret·access token·refresh token은 저장하지 않습니다. 콜백 교환 코드는 한 번만 사용하고, 연결 시 현재 Firebase ID token 및 UID를 다시 확인합니다.

## 관련 코드

- `src/lib/social-auth.ts`: 제공자 설정 조회, challenge 생성, 로그인/연결 시작, 일회용 코드 교환
- `src/pages/AuthCallback.tsx`: `/auth/callback` 처리 및 쿼리 제거
- `src/components/AccountConnections.tsx`: 로그인 계정의 제공자 연결 상태
- `services/auth-worker/`: OAuth 제공자 콜백, 신원 연결, Firebase custom token 발급

카카오 캘린더 기능은 로그인 활성화와 별개의 권한·설정이 필요합니다. 로그인 코드가 준비됐다는 이유로 캘린더 전송이 활성화됐다고 표시하지 않습니다.
