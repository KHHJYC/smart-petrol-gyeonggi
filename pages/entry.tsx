/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import PetrolApp from '@/components/petrol-app';
import { installHtmlPreview } from '@/html-preview/runtime';
import { installCompressedData } from './runtime';
import { installSharedRecords } from './shared-records';
import '@/app/globals.css';
import './notice.css';

installHtmlPreview({ storageKey: 'smart-petrol-gyeonggi-records-v1', apiError: '이 웹 버전은 기록을 현재 브라우저에 저장합니다.' });
installCompressedData();
const sharedUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const sharedKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (sharedUrl?.startsWith('https://') && sharedKey) {
  installSharedRecords({ url: sharedUrl, key: sharedKey });
  const notice = document.getElementById('record-notice');
  if (notice) notice.textContent = '현장 기록은 관리자 확인 후 모든 이용자의 지도에 표시됩니다. 순찰일지는 작성자만 볼 수 있습니다.';
}
createRoot(document.getElementById('root')!).render(<PetrolApp />);
