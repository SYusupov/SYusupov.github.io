import type { Dictionary } from './ru';

export const uz: Dictionary = {
  langName: "O'zbekcha",
  langShort: 'UZ',
  langSwitchLabel: 'Sayt tili',
  meta: {
    homeTitle: 'Toshkentda shokoladli favvora ijarasi | ChocoParty',
    homeDescription:
      "Toshkentda shokoladli favvora ijarasi 2015-yildan beri: yetkazib berish, o'rnatish, mevalar va Belgiya shokoladi. 500 dan ortiq buyurtma.",
  },
  brand: {
    homeLink: 'ChocoParty — bosh sahifaga',
  },
  nav: {
    label: "Sayt bo'limlari",
    events: 'Tadbirlar',
    prices: 'Narxlar',
    how: 'Qanday ishlaydi',
    contacts: 'Aloqa',
  },
  cta: {
    book: 'Band qilish',
    bookDate: 'Sanani band qilish',
    prices: 'Narxlar va tariflar',
  },
  hero: {
    eyebrow: 'Shokoladli favvora ijarasi · Toshkent',
    title: 'Toshkentda bayramingiz uchun shokoladli favvora',
    lead: "Olib kelamiz, o'rnatamiz va dasturxonni bezaymiz: Belgiya shokoladi, yangi mevalar va chiroyli taqdimot.",
    since: '{year}-yildan beri',
    orders: '{count} dan ortiq buyurtma',
  },
  events: {
    title: 'Bizning tadbirlarimiz',
    lead: "To'ylar, tug'ilgan kunlar, korporativlar va taqdimotlar — har bir bayram o'z favvorasi bilan.",
    all: 'Barcha tadbirlar',
  },
  eventTypes: {
    wedding: "To'y",
    birthday: "Tug'ilgan kun",
    'kids-party': 'Bolalar bayrami',
    corporate: 'Korporativ',
    exhibition: "Ko'rgazma yoki taqdimot",
    opening: 'Ochilish marosimi',
    other: 'Bayram',
  },
  footer: {
    rights: '© 2015–{year} ChocoParty. Toshkentda shokoladli favvora ijarasi.',
  },
  sizes: {
    small: { name: 'Kichik', guests: '30 nafargacha mehmon', details: '3 qavat · taxminan 40 sm' },
    medium: { name: "O'rtacha", guests: '60 nafar va undan ortiq mehmon', details: '4 qavat · taxminan 60 sm' },
    large: { name: 'Katta', guests: '100 nafar va undan ortiq mehmon', details: '5 qavat · taxminan 80 sm' },
  },
  tariffs: {
    light: { name: 'Light', summary: 'Faqat favvora ijarasi' },
    optima: { name: 'Optima', summary: 'Favvora va Belgiya shokoladi' },
    maxima: { name: 'Maxima', summary: 'Shokolad, mevalar, shirinliklar va kesish' },
  },
  contents: {
    light: ['Favvora ijarasi', "To'ldirishsiz"],
    small: {
      optima: ['2,5 kg Belgiya shokoladi', '0,25 kg Belgiya kakao moyi'],
      maxima: [
        '2,5 kg Belgiya shokoladi',
        '0,25 kg Belgiya kakao moyi',
        '0,5 kg tabiiy sharbatli marshmellou',
        '0,5 kg profiterol',
        '2,5 kg mavsumiy mevalar',
        '1 kg qulupnay',
        'Mevalarni chiroyli kesish',
      ],
    },
    medium: {
      optima: ['5 kg Belgiya shokoladi', '0,5 kg Belgiya kakao moyi'],
      maxima: [
        '5 kg Belgiya shokoladi',
        '0,5 kg Belgiya kakao moyi',
        '1 kg tabiiy sharbatli marshmellou',
        '1 kg profiterol',
        '5 kg mavsumiy mevalar',
        '2 kg qulupnay',
        'Mevalarni chiroyli kesish',
      ],
    },
    large: {
      optima: ['7 kg Belgiya shokoladi', '1 kg Belgiya kakao moyi'],
      maxima: [
        '7 kg Belgiya shokoladi',
        '1 kg Belgiya kakao moyi',
        '1,5 kg tabiiy sharbatli marshmellou',
        '1,5 kg profiterol',
        '8 kg mavsumiy mevalar',
        '3,5 kg qulupnay',
        'Mevalarni chiroyli kesish',
      ],
    },
  },
  calculator: {
    eyebrow: 'Narxlar',
    title: 'Favvora va tarifni tanlang',
    lead: "Narx yakuniy: unga yetkazib berish, o'rnatish, salfetkalar, shpajkalar va idishlar kiradi.",
    sizeLegend: "Favvora o'lchami",
    tariffLegend: 'Tarif',
    contents: 'Nimalar kiradi',
    total: 'Narxi',
    flavours: "Shokolad tanlovi: sutli, oq, apelsinli, qulupnayli, laymli — narx ta'mga bog'liq emas.",
    note: "Tugma Telegramni tayyor xabar bilan ochadi — faqat sana va manzilni yozish qoladi.",
  },
  order: {
    button: "Ushbu to'plamni buyurtma qilish",
    packageText:
      "Assalomu alaykum! Shokoladli favvora buyurtma qilmoqchiman. O'lcham: {size}. Tarif: {tariff}. Saytdagi narx: {price}. Bayram sanasi va manzili: ",
    eventText:
      'Assalomu alaykum! Mana shu tadbirdagidek shokoladli favvora istayman: {title} ({url}). Bayramim sanasi va manzili: ',
  },
};
