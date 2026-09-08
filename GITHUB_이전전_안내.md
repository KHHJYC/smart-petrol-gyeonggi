# GitHub 배포 운영 안내

배포 저장소 이름: `smart-petrol-gyeonggi`. GitHub Pages의 배포 소스는 GitHub Actions입니다. 기존 `smart-petrol` 및 `new-petrol` 저장소는 이 배포 과정에서 수정하지 않습니다.

1. 저장소의 Actions 비밀값에 `GG_API_KEY`를 등록합니다.
2. Pages 설정에서 GitHub Actions를 선택합니다.
3. `Publish Smart Petrol` 작업의 성공과 배포 URL을 확인합니다.
4. 이후 기본 브랜치 변경과 매일 오전 6시의 수집 작업이 검사에 성공하면 게시 자료를 갱신합니다.

API 키는 경기데이터드림 수집 단계에서만 사용합니다. 브라우저는 검증 후 게시한 공공자료를 읽습니다. 사용자 기록·키·로컬 DB·원시 수집 캐시는 저장소와 공개 사이트에 올리지 않습니다.

GitHub Pages 버전은 브라우저별 기록 저장을 사용합니다. 서버형 소스도 보관하지만 계정 공유 및 서버 DB는 이 배포에 연결되지 않습니다. 순찰과 현장 기록은 내려받기로 백업하세요.

실패한 자동 수집은 기존 사이트를 대체하지 않습니다. Actions 실행 결과에서 실패 단계를 확인하고 키 또는 공급기관 장애를 해결한 뒤 다시 실행합니다. 생성형 AI 검토 메모는 자료 확인 시각이 달라지면 숨겨집니다.

GitHub 예약 작업은 정확한 시각의 실행을 보장하지 않습니다. [GitHub 예약 실행 설명](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

배포 방법: [GitHub Pages 사용자 정의 작업](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
