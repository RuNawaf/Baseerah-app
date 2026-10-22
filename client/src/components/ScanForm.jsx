import { useI18n } from '../i18n.js';

export function ScanForm({ value, onChange, onSubmit, error, busy, phase, inputRef }) {
  const { t, error: errorText } = useI18n();
  const describedBy = ['url-hint', error ? 'url-error' : null].filter(Boolean).join(' ');

  return (
    <form
      className="scan-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) onSubmit();
      }}
    >
      <label htmlFor="url" className="field-label">
        {t('urlLabel')}
      </label>
      <div className={`command${error ? ' has-error' : ''}`}>
        <input
          ref={inputRef}
          id="url"
          name="url"
          type="text"
          dir="ltr"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="https://www.ksu.edu.sa"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          readOnly={busy}
        />
        <button type="submit" className="command-button" disabled={busy}>
          {phase === 'starting' ? t('checkingButton') : phase === 'scanning' ? t('scanningButton') : t('scanButton')}
        </button>
      </div>
      <p id="url-hint" className="field-hint">
        {t('urlHint')}
      </p>
      {error && (
        <p id="url-error" className="field-error" role="alert">
          <svg className="field-error-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M8 1.5 15 14H1z" />
            <path d="M8 6v3.6M8 11.4v.1" className="stroke" />
          </svg>
          {errorText(error)}
        </p>
      )}
    </form>
  );
}