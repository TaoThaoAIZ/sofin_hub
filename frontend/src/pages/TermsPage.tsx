import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '../components/layout/LegalLayout';
import { markTermsRead } from '../features/auth/legalConsent';

const COMPONENTS = {
  privacy: <Link to="/privacy" className="font-semibold underline" />,
  terms: <Link to="/terms" className="font-semibold underline" />,
  mail: <a href="mailto:support@sofinhub.com" className="font-semibold underline" />,
  b: <b className="text-stone-800" />,
};

export function TermsPage() {
  const { t } = useTranslation('legal');
  return (
    <LegalLayout title={t('terms.title')} updatedAt={t('terms.updatedAt')} onRead={markTermsRead}>
      <p className="m-0 text-[15px] leading-[1.75] text-stone-600 text-pretty">
        {t('terms.intro')}
      </p>

      <LegalSection title={t('terms.s1.title')}>
        <p><Trans ns="legal" i18nKey="terms.s1.p1" components={COMPONENTS} /></p>
      </LegalSection>

      <LegalSection title={t('terms.s2.title')}>
        <ul className="m-0 list-disc pl-5">
          <li>{t('terms.s2.li1')}</li>
          <li>{t('terms.s2.li2')}</li>
          <li>{t('terms.s2.li3')}</li>
          <li>{t('terms.s2.li4')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('terms.s3.title')}>
        <p>{t('terms.s3.p1')}</p>
      </LegalSection>

      <LegalSection title={t('terms.s4.title')}>
        <ul className="m-0 list-disc pl-5">
          <li>{t('terms.s4.li1')}</li>
          <li>{t('terms.s4.li2')}</li>
          <li>{t('terms.s4.li3')}</li>
          <li>{t('terms.s4.li4')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('terms.s5.title')}>
        <p>{t('terms.s5.p1')}</p>
        <ul className="m-0 list-disc pl-5">
          <li>{t('terms.s5.li1')}</li>
          <li>{t('terms.s5.li2')}</li>
          <li>{t('terms.s5.li3')}</li>
          <li>{t('terms.s5.li4')}</li>
        </ul>
        <p>{t('terms.s5.p2')}</p>
      </LegalSection>

      <LegalSection title={t('terms.s6.title')}>
        <p>{t('terms.s6.p1')}</p>
      </LegalSection>

      <LegalSection title={t('terms.s7.title')}>
        <p>{t('terms.s7.p1')}</p>
      </LegalSection>

      <LegalSection title={t('terms.s8.title')}>
        <p>{t('terms.s8.p1')}</p>
      </LegalSection>

      <LegalSection title={t('terms.s9.title')}>
        <p>{t('terms.s9.p1')}</p>
      </LegalSection>

      <LegalSection title={t('terms.s10.title')}>
        <p><Trans ns="legal" i18nKey="terms.s10.p1" components={COMPONENTS} /></p>
      </LegalSection>
    </LegalLayout>
  );
}
