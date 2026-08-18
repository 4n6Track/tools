# 스도쿠 프레스

쉬움 → 마스터, 5단계 난이도의 온라인 스도쿠. 계정을 만들어 로그인하면 완료 기록이
난이도별 순위표에 저장됩니다. GitHub Pages(정적 호스팅)에 그대로 올릴 수 있고,
계정/순위표 저장을 위해 **Firebase**(무료 요금제로 충분)를 백엔드로 사용합니다.

GitHub Pages는 서버가 없는 정적 호스팅이라, 계정·DB 기능을 쓰려면 Firebase처럼
외부 백엔드가 하나는 필요해요. 아래 순서대로 하면 10분 정도 걸립니다.

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 → "프로젝트 추가"
2. 프로젝트 이름 입력 (예: `sudoku-press`) → Google Analytics는 꺼도 무방
3. 생성 완료 후 왼쪽 메뉴에서 **빌드 > Authentication** 이동 → "시작하기"
   → 로그인 방법에서 **이메일/비밀번호** 사용 설정
4. 왼쪽 메뉴에서 **빌드 > Firestore Database** 이동 → "데이터베이스 만들기"
   → 위치는 `asia-northeast3`(서울) 추천 → **프로덕션 모드**로 시작

## 2. 웹 앱 등록 및 설정값 복사

1. 프로젝트 개요 옆 톱니바퀴 → **프로젝트 설정**
2. "내 앱" 섹션에서 `</>` (웹) 아이콘 클릭 → 앱 닉네임 입력 후 등록
3. 표시되는 `firebaseConfig` 객체 값을 복사해서 `firebase-config.js` 파일의
   동일한 자리에 붙여넣기 (`YOUR_API_KEY` 등 자리표시자 교체)

```js
export const firebaseConfig = {
  apiKey: "실제값",
  authDomain: "실제값",
  projectId: "실제값",
  storageBucket: "실제값",
  messagingSenderId: "실제값",
  appId: "실제값",
};
```

## 3. 보안 규칙 & 색인 적용

Firebase 콘솔 > Firestore Database > **규칙** 탭에서 `firestore.rules` 파일의
내용을 그대로 붙여넣고 게시하세요. (본인 uid로만 기록을 남길 수 있고,
한 번 저장된 점수는 수정/삭제할 수 없도록 막아 놨습니다.)

순위표는 "난이도가 같고 점수가 높은 순" 복합 쿼리를 쓰기 때문에 Firestore
색인이 하나 필요합니다. 두 가지 방법 중 편한 걸 쓰세요.

- **간단한 방법**: 배포 후 앱을 실행해 리더보드를 한 번 불러오면, 브라우저 개발자
  도구 콘솔에 "색인을 만들어야 합니다" 링크가 뜹니다. 그 링크를 클릭하면 자동 생성돼요.
- **미리 만드는 방법**: Firebase CLI가 있다면 이 저장소 루트에서
  `firebase deploy --only firestore:indexes` 실행 (firestore.indexes.json 사용)

## 4. GitHub Pages에 배포

1. GitHub에 새 저장소 생성 후 이 폴더의 파일 전체를 푸시
2. 저장소 **Settings > Pages** 에서 Source를 `main` 브랜치, `/root` 로 설정
3. 몇 분 뒤 `https://<username>.github.io/<repo>/` 에서 접속 가능

정적 파일만으로 동작하므로 별도 빌드 과정이 필요 없습니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 페이지 구조 |
| `style.css` | 디자인 (퍼즐북 콘셉트) |
| `sudoku-engine.js` | 퍼즐 생성/검증/채점 로직 (Firebase와 무관, 순수 JS) |
| `firebase-config.js` | Firebase 초기화 — **여기에 본인 설정값 입력** |
| `auth.js` | 아이디/비밀번호 기반 간단 계정 (내부적으로 Firebase Auth 사용) |
| `leaderboard.js` | 점수 저장/조회 |
| `app.js` | 화면 로직 전체를 연결하는 메인 스크립트 |
| `firestore.rules` | Firestore 보안 규칙 |
| `firestore.indexes.json` | 순위표 쿼리용 복합 색인 정의 |

## 참고

- `firebase-config.js`를 설정하지 않아도 퍼즐 플레이 자체는 오프라인으로 정상 동작합니다.
  다만 로그인/회원가입/순위표 저장은 비활성화되고 안내 문구가 표시돼요.
- 아이디는 내부적으로 `아이디@sudoku.local` 형태의 가짜 이메일로 Firebase Auth에
  등록됩니다. 사용자에게는 아이디/비밀번호만 노출되어 "간단한 계정" 경험을 제공합니다.
- 점수 산식: 난이도 기본 점수 − (경과 시간 × 계수) − (실수 횟수 × 60) − (힌트 × 120),
  최저 100점. `sudoku-engine.js`의 `computeScore`에서 조정할 수 있어요.
