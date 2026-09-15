import { STOREFRONT_SITE_URL } from "../storefront/seo.ts";

export const PUBLIC_COMPANY = {
  brandName: "Кибермедика",
  legalName: "Общество с ограниченной ответственностью «Кибермедика»",
  shortLegalName: "ООО «КИМ»",
  inn: "9102256625",
  ogrn: "1199112011020",
  kpp: "910201001",
  phoneDisplay: "+7 (903) 947-72-47",
  phoneHref: "tel:+79039477247",
  email: "info@cyber-medica.ru",
  emailHref: "mailto:info@cyber-medica.ru",
  businessHours: "Пн–Пт, 09:00–18:00",
  legalAddress:
    "295021, Республика Крым, г. Симферополь, ул. Данилова, д. 43, кабинет 32",
  geography: "Российская Федерация",
  specialization:
    "Подбор и поставка медицинского оборудования для государственных и частных организаций",
} as const;

export function buildPublicCompanyStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${STOREFRONT_SITE_URL}/#organization`,
    name: PUBLIC_COMPANY.brandName,
    legalName: PUBLIC_COMPANY.legalName,
    alternateName: PUBLIC_COMPANY.shortLegalName,
    url: STOREFRONT_SITE_URL,
    logo: `${STOREFRONT_SITE_URL}/brand/cybermedica-logo.png`,
    email: PUBLIC_COMPANY.email,
    telephone: PUBLIC_COMPANY.phoneDisplay,
    taxID: PUBLIC_COMPANY.inn,
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "ОГРН",
        value: PUBLIC_COMPANY.ogrn,
      },
      {
        "@type": "PropertyValue",
        propertyID: "КПП",
        value: PUBLIC_COMPANY.kpp,
      },
    ],
    address: {
      "@type": "PostalAddress",
      postalCode: "295021",
      addressCountry: "RU",
      addressRegion: "Республика Крым",
      addressLocality: "Симферополь",
      streetAddress: "ул. Данилова, д. 43, кабинет 32",
    },
    areaServed: {
      "@type": "Country",
      name: PUBLIC_COMPANY.geography,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: PUBLIC_COMPANY.phoneDisplay,
      email: PUBLIC_COMPANY.email,
      availableLanguage: "Russian",
    },
    description: PUBLIC_COMPANY.specialization,
  };
}
