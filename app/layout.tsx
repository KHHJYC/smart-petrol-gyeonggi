import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: '스마트펫트롤 | 우리동네 안전지킴이',
  description:
    '반려견과 걷는 일상에 작은 관찰을 더합니다. 경기도 CCTV·보안등 지도와 반려동물 등록 현황, 현장 점검 기록을 연결하는 스마트펫트롤.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
