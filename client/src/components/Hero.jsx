import { useI18n } from '../i18n.js';
import { ProductPreview } from './ProductPreview.jsx';
import { ScanForm } from './ScanForm.jsx';

export function Hero(props) {
  const { t } = useI18n();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <a className="badge" href="#how">
          <span className="badge-tag">{t('badgeTag')}</span>
          <span>{t('badgeText')}</span>
          <svg className="arrow arrow-forward" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
          </svg>
        </a>
        <h1 id="hero-title">{t('heroTitle')}</h1>
        <p className="tagline">{t('tagline')}</p>
        <p className="hero-lede">{t('heroLede')}</p>
        <ScanForm {...props} />
        <div className="hero-links">
          <a className="pill pill-outline" href="#how">
            {t('howLink')}
            <svg className="arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M8 3v9M4.5 8.5 8 12l3.5-3.5" />
            </svg>
          </a>
        </div>
      </div>
      <ProductPreview />
    </section>
  );
}