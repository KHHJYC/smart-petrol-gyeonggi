import {createRoot} from 'react-dom/client';
import PetrolApp from '@/components/petrol-app';
import {installHtmlPreview} from './runtime';
installHtmlPreview();
createRoot(document.getElementById('root')!).render(<PetrolApp/>);
