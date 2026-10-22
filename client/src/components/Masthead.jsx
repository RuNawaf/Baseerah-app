import logo from '../assets/baseerah-logo.png';
import { useI18n } from '../i18n.js';

/** Top bar: the logo, a few plain links, the language switch and one action. */
export function Masthead({ onHome, onScanClick, onToggleLanguage }) {
  const { t } = useI18n();
  return (
    <header className="topbar">
      <a
        className="brand"
        href="#/"
        onClick={(event) => {
          if (onHome) {
            event.preventDefault();
            onHome();
          }
        }}
      >
        <img src={logo} alt={t('home')} width="198" height="49" />
      </a>
      <nav className="topnav" aria-label={t('navHow')}>
        <a href="#how">{t('navHow')}</a>
        <a href="https://github.com/RuNawaf/Baseerah">GitHub</a>
        {/* The name starts with the visible letter (WCAG 2.5.3), then says the language in full. */}
        <button type="button" className="lang-switch" onClick={onToggleLanguage} lang={t('langCode')} title={t('langLabel')}>
          {t('langButton')}
          <span className="visually-hidden"> {t('langLabel')}</span>
        </button>
        <button type="button" className="pill pill-dark" onClick={onScanClick}>
          {t('navScan')}
        </button>
      </nav>
    </header>
  );
}