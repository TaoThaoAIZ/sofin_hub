import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LegalLayout, LegalSection } from '../components/layout/LegalLayout';
import { markPrivacyRead } from '../features/auth/legalConsent';

const COMPONENTS = {
  privacy: <Link to="/privacy" className="font-semibold underline" />,
  terms: <Link to="/terms" className="font-semibold underline" />,
  mail: <a href="mailto:support@sofinhub.com" className="font-semibold underline" />,
  b: <b className="text-stone-800" />,
};

export function PrivacyPage() {
  const { t } = useTranslation('legal');
  return (
    <LegalLayout title={t('privacy.title')} updatedAt={t('privacy.updatedAt')} onRead={markPrivacyRead}>
      <p className="m-0 text-[15px] leading-[1.75] text-stone-600 text-pretty">
        {t('privacy.intro')}
      </p>

      <LegalSection title={t('privacy.s1.title')}>
        <ul className="m-0 list-disc pl-5">
          <li><Trans ns="legal" i18nKey="privacy.s1.li1" components={COMPONENTS} /></li>
          <li><Trans ns="legal" i18nKey="privacy.s1.li2" components={COMPONENTS} /></li>
          <li><Trans ns="legal" i18nKey="privacy.s1.li3" components={COMPONENTS} /></li>
          <li><Trans ns="legal" i18nKey="privacy.s1.li4" components={COMPONENTS} /></li>
        </ul>
      </LegalSection>

      <LegalSection title={t('privacy.s2.title')}>
        <ul className="m-0 list-disc pl-5">
          <li>{t('privacy.s2.li1')}</li>
          <li>{t('privacy.s2.li2')}</li>
          <li>{t('privacy.s2.li3')}</li>
          <li>{t('privacy.s2.li4')}</li>
          <li>{t('privacy.s2.li5')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('privacy.s3.title')}>
        <p>{t('privacy.s3.p1')}</p>
      </LegalSection>

      <LegalSection title={t('privacy.s4.title')}>
        <p>{t('privacy.s4.p1')}</p>
        <ul className="m-0 list-disc pl-5">
          <li>{t('privacy.s4.li1')}</li>
          <li>{t('privacy.s4.li2')}</li>
          <li>{t('privacy.s4.li3')}</li>
        </ul>
      </LegalSection>

      <LegalSection title={t('privacy.s5.title')}>
        <p>{t('privacy.s5.p1')}</p>
      </LegalSection>

      <LegalSection title={t('privacy.s6.title')}>
        <p>{t('privacy.s6.p1')}</p>
      </LegalSection>

      <LegalSection title={t('privacy.s7.title')}>
        <ul className="m-0 list-disc pl-5">
          <li>{t('privacy.s7.li1')}</li>
          <li>{t('privacy.s7.li2')}</li>
          <li>{t('privacy.s7.li3')}</li>
          <li>{t('privacy.s7.li4')}</li>
        </ul>
        <p>{t('privacy.s7.p1')}</p>
      </LegalSection>

      <LegalSection title={t('privacy.s8.title')}>
        <p>{t('privacy.s8.p1')}</p>
      </LegalSection>

      <LegalSection title={t('privacy.s9.title')}>
        <p>{t('privacy.s9.p1')}</p>
      </LegalSection>

      <LegalSection title={t('privacy.s10.title')}>
        <p><Trans ns="legal" i18nKey="privacy.s10.p1" components={COMPONENTS} /></p>
      </LegalSection>
    </LegalLayout>
  );
}
