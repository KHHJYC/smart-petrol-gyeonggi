import { createRoot } from 'react-dom/client';
import PetrolApp from '@/components/petrol-app';
import { installHtmlPreview } from '@/html-preview/runtime';
import { installCompressedData } from './runtime';
import '@/app/globals.css';
import './notice.css';

installHtmlPreview({ storageKey: 'smart-petrol-gyeonggi-records-v1', apiError: '이 웹 버전은 기록을 현재 브라우저에 저장합니다.' });
installCompressedData();
createRoot(document.getElementById('root')!).render(<PetrolApp />);
