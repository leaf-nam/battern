# Furboaee Draft — 패턴 드래프팅 MVP

React + Vite로 만든 1페이지 패턴 드래프팅 도구 MVP입니다. 요구사항 문서의 "MVP 범위" 항목만 구현했습니다.

## 구현된 기능 (MVP 범위)

- **직선 그리기**: 캔버스에서 드래그해 직선 생성, 속성 패널에서 길이(cm)를 숫자로 직접 수정 가능
- **곡선 그리기**: 드래그로 곡선 생성 → 자동으로 선택/편집 모드 전환 → 금색 조절점(핸들)을 드래그해 곡률 편집
- **SVG 저장**: 실제 물리 크기(cm)가 반영된 SVG 파일로 다운로드 (Illustrator/Inkscape에서 열어도 크기가 정확)
- **SVG → PNG 변환**: 약 150dpi 인쇄 품질 PNG로 내보내기
- **패턴 불러오기/관리**: 브라우저 로컬 저장소(localStorage)에 이름 붙여 저장 → 목록에서 불러오기/삭제
- **인쇄 (1:1)**: 화면 확대/축소와 무관하게 실제 물리 치수(mm/cm)로 인쇄되도록 별도 인쇄 스타일 적용
- **용지 프리셋**: 패턴 블록(400×300mm), A4, A3

## 다음 버전 예정 (요구사항 문서의 "추후 개발 기능")

- 태블릿 펜 압력/기울기 최적화, 손그림 → SVG 벡터 변환
- 시접(seam allowance) 자동 생성 — 툴바에 자리만 마련해 둠
- 패턴 사진 업로드 → AI 초안 생성
- 패턴 버전 관리, 의류 부위별 템플릿
- 여러 장으로 분할 인쇄(타일링)

## 로컬 실행

```bash
npm install
npm run dev
```

## Vercel 배포

1. 이 폴더를 GitHub 레포에 올립니다 (또는 `vercel` CLI로 폴더에서 바로 배포).
2. [vercel.com](https://vercel.com)에서 New Project → 해당 레포 선택.
3. Framework Preset은 **Vite**로 자동 인식됩니다.
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy 클릭하면 끝입니다. 별도 환경 변수나 백엔드가 필요 없는 정적 배포입니다.

CLI로 바로 배포하려면:

```bash
npm install -g vercel
vercel
```

## 기술 스택

- React 18 + Vite 5 (빌드/배포 단순화를 위해 별도 상태관리 라이브러리 없이 구현)
- 순수 SVG 기반 드로잉 엔진 (canvas 라이브러리 없이 직접 좌표 변환/드래그 처리)
- 저장은 현재 `localStorage` 기반 — 추후 백엔드 연동 시 동일한 데이터 구조(`shapes` 배열)를 그대로 API로 옮길 수 있도록 설계

## 디자인 방향

로고의 검정 배지 + 금색(#e3b23c) 스티치 라인 모티프를 이어받아, 캔버스를 재단사의 그레이딩 패턴지(dot-grid, 모서리 registration mark)처럼 표현했습니다. 헤더/버튼은 다크 차콜, 실제 작업 용지는 크림톤 페이퍼 컬러로 대비를 주었습니다.
