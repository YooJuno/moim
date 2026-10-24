# 네이버 장소 이름 검색 연결

농구장·식당 이름으로 검색하고 주소를 선택하는 기능입니다. 검색 결과는 네이버 지역 검색 API에서 가져옵니다. **운영 서버에는 검색 전용 키가 연결되어 있습니다.** 새 환경에서는 아래 순서로 설정하며, 키 미연결 시 네이버지도 외부 검색과 주소 직접 입력을 사용할 수 있습니다.

## 1. 신규 키 발급

현재 날짜 기준(2026-10-24), 새 검색 키는 **NAVER API HUB**에서 발급합니다. 기존 네이버 개발자센터의 검색 API 신규 신청은 2026-07-31 종료됐습니다. 2026-07-31 이전에 신청한 기존 키는 2027-06-30까지 사용할 수 있습니다. [네이버 공식 이관 공지](https://developers.naver.com/notice/article/32530)

1. [네이버 클라우드 플랫폼](https://www.ncloud.com/join/info)에서 계정을 만듭니다. 이미 계정이 있으면 로그인합니다.
2. 콘솔에서 **All Services → Application Services → NAVER API HUB**를 엽니다.
3. **Subscription → 서비스 이용 신청**으로 이동합니다.
4. **Application → Application 등록**에서 **NAVER 검색 → 지역 API**를 선택하고 **다음**을 누릅니다.
5. 앱 이름에 `moim-place-search`를 입력하고 **완료**를 누릅니다.
6. 등록한 Application의 **인증 정보**에서 **Client ID**와 **Client Secret**을 확인합니다. [공식 Application 설정 안내](https://guide.ncloud-docs.com/docs/apihub-application)

NAVER API HUB는 현재 **한시 무료**입니다. 서비스 개요는 NAVER 검색 통합 월 775,000건, 키당 50 RPS와 월 한도 도달 시 차단을 안내합니다. 지역 검색 API 개별 문서에는 일 25,000건 설명도 남아 있으므로, 신청 화면과 콘솔의 현재 요금·한도를 확인합니다. [공식 서비스 개요](https://guide.ncloud-docs.com/docs/apihub-overview), [지역 검색 명세](https://api.ncloud-docs.com/docs/naver-api-hub-search-local)

NCP의 일반 가입 안내에는 결제수단 등록 절차가 있습니다. 결제수단 없이 API HUB만 신청할 수 있는지는 공식 문서에서 확정하지 못했습니다. 상품 신청과 결제수단 등록은 계정 소유자가 직접 진행합니다. Firebase Spark 요금제와는 별도 서비스입니다. [공식 가입 FAQ](https://www.ncloud.com/support/faq/all/2211), [개인회원 결제 안내](https://www.ncloud.com/support/faq/bill/2000?categoryCode2=UPD)

## 2. 검색 키를 서버에 저장

검색 전용 변수는 **`NAVER_SEARCH_CLIENT_ID`**, **`NAVER_SEARCH_CLIENT_SECRET`**입니다. 네이버 로그인용 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`과 구분합니다. 검색 키를 넣어도 네이버 로그인은 활성화되지 않습니다.

레포의 `services/auth-worker` 폴더에서 실행합니다. 각 명령이 값을 물으면 해당 키를 붙여 넣습니다.

```sh
npx wrangler secret put NAVER_SEARCH_CLIENT_ID
npx wrangler secret put NAVER_SEARCH_CLIENT_SECRET
```

`wrangler secret put`은 서버 Secret을 반영하는 배포 작업입니다. 키는 브라우저 코드, `VITE_` 변수, git에 넣지 않습니다. 로컬 테스트는 git에서 제외된 `.dev.vars`를 사용합니다. [Cloudflare Secret 안내](https://developers.cloudflare.com/workers/configuration/secrets/)

`services/auth-worker/wrangler.jsonc`의 새 환경을 준비할 때의 공개 설정은 다음과 같습니다(운영 환경의 활성값은 `true`).

```json
"NAVER_SEARCH_API": "hub",
"NAVER_SEARCH_ENABLED": "false"
```

키 등록과 현재 무료 조건 확인을 마친 뒤 `NAVER_SEARCH_ENABLED`만 `"true"`로 바꾸고 Worker를 배포합니다.

```sh
npm run check
npm test
npm run deploy
```

이미 발급받은 **네이버 개발자센터 검색 API 키**를 사용하는 경우에만 `NAVER_SEARCH_API`를 `"legacy"`로 설정합니다. HUB 키와 기존 개발자센터 키는 인증 체계가 달라 서로 바꿔 사용할 수 없습니다. [공식 이관 가이드](https://guide.ncloud-docs.com/docs/apihub-migration)

## 3. 연결 확인

`https://moim-auth.moim-auth-worker.workers.dev/config`에서 `places.naver`가 `true`인지 확인합니다. 이 주소는 준비 여부만 반환하며 검색 API를 호출하지 않습니다. 사이트에 Google 계정으로 로그인한 뒤 장소 검색을 실행합니다. 승인 대기자도 검색 결과를 볼 수 있고, 장소 저장 권한은 기존 권한을 따릅니다.

검색 서버는 Firebase ID 토큰과 현재 계정 상태를 확인한 뒤 `members/{uid}`의 상태가 `active` 또는 `pending`일 때만 요청을 처리합니다. 프로필·전화번호를 네이버에 전달하지 않습니다. 검색어는 최대 120자, 결과는 최대 5개이며 요청이 10초를 넘으면 중단합니다. 응답과 오류는 `Cache-Control: no-store`로 반환하고 검색 결과를 DB에 저장하지 않습니다.

## 서버 요청 형식

| 설정 | 고정 API 주소 | 서버 인증 헤더 |
| --- | --- | --- |
| `hub` | `https://naverapihub.apigw.ntruss.com/search/v1/local` | `X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY` |
| `legacy` | `https://openapi.naver.com/v1/search/local.json` | `X-Naver-Client-Id`, `X-Naver-Client-Secret` |

요청은 `query`, `display=5`, `start=1`, `sort=random`이며 HUB에서는 `format=json`을 추가합니다. 임의의 외부 주소로 검색 키를 보내지 않습니다. [HUB 인증 명세](https://api.ncloud-docs.com/docs/naver-api-hub-overview), [기존 지역 검색 명세](https://developers.naver.com/docs/serviceapi/search/local/local.md)

응답의 `mapx`는 경도, `mapy`는 위도이며 `10^7`로 나눈 값이 WGS84 좌표입니다. 서버는 한국 좌표 범위에 맞는 값만 반환합니다. 좌표가 없거나 형식이 다르면 생략합니다. `link`는 업체 홈페이지일 수 있어 지도 주소로 사용하지 않고, 네이버지도 검색 주소를 별도로 만듭니다. [공식 좌표 변경 안내](https://developers.naver.com/notice/article/12567)
