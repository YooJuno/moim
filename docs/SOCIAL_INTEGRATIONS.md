# 소셜 연동 설정

## 초대 링크 공유

`모임 초대`는 현재 사이트의 루트 주소를, `일정 공유`는 `/calendar?event=일정ID` 주소를 복사하거나 기기의 공유 화면으로 전달합니다. 전화번호, 이메일, 참석자 명단은 공유하지 않습니다. 링크를 받은 신규 사용자는 로그인한 뒤 관리자의 승인을 받아야 합니다.

카카오톡 전용 공유 버튼을 사용하려면 카카오디벨로퍼스에서 이 서비스의 앱을 등록하고 다음을 설정합니다.

1. 앱의 JavaScript 키를 `.env.local`의 `VITE_KAKAO_JS_KEY`에 입력합니다. 이 키는 웹 공개용입니다. REST API 키·Client Secret·Admin 키를 넣지 않습니다.
2. 앱의 **플랫폼 키 → JavaScript 키 → JavaScript SDK 도메인**에 실제 접속 출처를 등록합니다. 운영 출처는 `https://moim-juno.web.app`입니다. `firebaseapp.com` 또는 미리보기 출처에서도 사용할 때는 그 출처도 등록합니다.
3. **제품 링크 관리 → 웹 도메인**에 공유 링크의 실제 도메인을 등록합니다.
4. 다시 빌드하고 Hosting에 배포합니다.

키가 없으면 카카오톡 전용 버튼은 표시하지 않습니다. 링크 복사와 기기 공유는 키 없이 사용할 수 있습니다. SDK는 카카오 공식 CDN의 검증된 버전과 SRI를 사용합니다. 실제 공유는 사용자가 버튼을 누르고 카카오톡의 대상 선택 화면에서 선택할 때 진행됩니다.

[카카오 공유 안내](https://developers.kakao.com/docs/ko/kakaotalk-share/common) · [JavaScript 요구사항](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link) · [SDK 다운로드](https://developers.kakao.com/docs/ko/javascript/download)

## 카카오·네이버 로그인과 계정 연결

로그인 연동은 아직 활성화하지 않았습니다. 각 서비스의 앱 등록, Client ID·Secret, 콜백 주소 설정과 OAuth 응답을 검증할 보안 서버가 필요합니다. 네이버 로그인은 일반 사용자에게 정식 제공하기 전에 사전 검수를 통과해야 합니다. Client Secret이나 Firebase 서명용 비밀키는 `VITE_` 환경 변수나 프런트엔드 코드에 넣지 않습니다.

기존 Google 로그인 상태에서 추가 로그인 인증을 완료하고 명시적으로 계정을 연결해야 합니다. 서비스별 고유 사용자 ID를 기존 Firebase UID에 서버에서 연결하며 이름·이메일만으로 동일인이라고 판단하지 않습니다.

Firebase의 일반 OIDC 공급자는 Identity Platform 업그레이드가 필요합니다. 업그레이드된 **Spark의 OIDC 제한은 하루 활성 사용자 2명**이며, OIDC 월 50명 무료 구간은 Blaze에 해당합니다. Spark를 유지하며 멤버 전체에게 카카오·네이버 로그인을 제공하려면 별도 보안 서버에서 OAuth 검증 후 Firebase Custom Token을 발급하는 구성을 검토해야 합니다. Firebase Functions를 배포하려면 Blaze가 필요하므로 자동으로 유료 전환하지 않습니다.

[Firebase 제한](https://firebase.google.com/docs/auth/) · [계정 연결](https://firebase.google.com/docs/auth/web/account-linking) · [Custom Token](https://firebase.google.com/docs/auth/admin/create-custom-tokens) · [네이버 검수](https://developers.naver.com/docs/login/verify/verify.md)
