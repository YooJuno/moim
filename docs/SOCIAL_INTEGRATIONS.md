# 소셜 연동 설정

## 초대 링크 공유

`모임 초대`는 현재 사이트의 루트 주소를, `일정 공유`는 `/calendar?event=일정ID` 주소를 복사하거나 기기의 공유 화면으로 전달합니다. 전화번호, 이메일, 참석자 명단은 공유하지 않습니다. 링크를 받은 신규 사용자는 로그인 후 둘러볼 수 있고, 글쓰기·투표 등 참여는 관리자 승인 후 가능합니다.

카카오톡 전용 공유 버튼을 사용하려면 카카오디벨로퍼스에서 이 서비스의 앱을 등록하고 다음을 설정합니다.

1. 앱의 JavaScript 키를 `.env.local`의 `VITE_KAKAO_JS_KEY`에 입력합니다. 이 키는 웹 공개용입니다. REST API 키·Client Secret·Admin 키를 넣지 않습니다.
2. 앱의 **플랫폼 키 → JavaScript 키 → JavaScript SDK 도메인**에 실제 접속 출처를 등록합니다. 운영 출처는 `https://moim-juno.web.app`입니다. `firebaseapp.com` 또는 미리보기 출처에서도 사용할 때는 그 출처도 등록합니다.
3. **제품 링크 관리 → 웹 도메인**에 공유 링크의 실제 도메인을 등록합니다.
4. 다시 빌드하고 Hosting에 배포합니다.

키가 없으면 카카오톡 전용 버튼은 표시하지 않습니다. 링크 복사와 기기 공유는 키 없이 사용할 수 있습니다. SDK는 카카오 공식 CDN의 검증된 버전과 SRI를 사용합니다. 실제 공유는 사용자가 버튼을 누르고 카카오톡의 대상 선택 화면에서 선택할 때 진행됩니다.

[카카오 공유 안내](https://developers.kakao.com/docs/ko/kakaotalk-share/common) · [JavaScript 요구사항](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link) · [SDK 다운로드](https://developers.kakao.com/docs/ko/javascript/download)

## 카카오·네이버 로그인과 계정 연결

로그인·계정 연결 코드와 별도 OAuth 인증 서비스는 준비했습니다. **현재 활성화 전**이며, 카카오·네이버 앱 등록과 키 발급, 콜백 주소 설정이 남아 있습니다. 인증 서버와 Firebase 연결은 완료했습니다. 설정이 없거나 서비스의 `/config`에 제공자가 비활성으로 표시되면 해당 로그인 버튼은 나오지 않습니다. Google 로그인은 그대로 사용할 수 있습니다.

기존 멤버는 Google 등 기존 계정으로 로그인한 뒤 **내 정보 → 계정 → 연결**에서 카카오·네이버를 추가합니다. 이름·이메일만으로 같은 사람이라고 판단하지 않고, 검증한 제공자 사용자 ID를 현재 Firebase UID에 명시적으로 연결합니다. 다른 계정에 이미 연결된 인증 정보는 자동으로 병합하지 않습니다.

별도 서비스 `services/auth-worker`가 OAuth 응답과 일회용 코드를 검증하고 Firebase Custom Token을 발급합니다. 제공자 Client Secret과 Firebase 서명용 비밀키는 Worker의 비밀 설정에 두며 `VITE_` 환경 변수나 브라우저 코드에 넣지 않습니다. 프런트엔드에는 공개 서비스 주소인 `VITE_AUTH_API_URL`만 설정합니다. 네이버 일반 사용자 제공 전에는 사전 검수도 필요합니다.

- [등록·설정 안내](LOGIN_SETUP.md)
- [프런트엔드 흐름과 활성화 상태](SOCIAL_AUTH.md)
- [인증 서비스 설치·운영](../services/auth-worker/README.md)
- [Firebase Custom Token](https://firebase.google.com/docs/auth/admin/create-custom-tokens) · [계정 연결](https://firebase.google.com/docs/auth/web/account-linking) · [네이버 검수](https://developers.naver.com/docs/login/verify/verify.md)

카카오톡 공유, 카카오 로그인, 카카오 캘린더는 별도 설정입니다. 로그인 연결만으로 캘린더 기능이 활성화됐다고 표시하지 않습니다.
