import { createRoot } from 'react-dom/client';
import App from './App';
import { GameToastProvider } from './components/ui/GameToastProvider';
import { LocaleProvider } from './i18n/LocaleProvider';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
    <LocaleProvider>
        <GameToastProvider>
            <App />
        </GameToastProvider>
    </LocaleProvider>,
);
