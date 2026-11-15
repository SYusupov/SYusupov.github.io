import type { Dictionary } from './ru';

export const en: Dictionary = {
  langName: 'English',
  langShort: 'EN',
  langSwitchLabel: 'Site language',
  meta: {
    homeTitle: 'Chocolate fountain rental in Tashkent | ChocoParty',
    homeDescription:
      'Chocolate fountain rental in Tashkent since 2015: delivery, setup, fruit and Belgian chocolate. More than 500 orders.',
  },
  brand: {
    homeLink: 'ChocoParty — home page',
  },
  nav: {
    label: 'Site sections',
    events: 'Events',
    prices: 'Prices',
    how: 'How it works',
    contacts: 'Contacts',
  },
  cta: {
    book: 'Book',
    bookDate: 'Book a date',
    prices: 'Prices and packages',
  },
  hero: {
    eyebrow: 'Chocolate fountain rental · Tashkent',
    title: 'A chocolate fountain for your celebration in Tashkent',
    lead: 'We deliver, set up and decorate the table: Belgian chocolate, fresh fruit and a beautiful presentation.',
    since: 'Since {year}',
    orders: 'More than {count} orders',
  },
  events: {
    title: 'Our events',
    lead: 'Weddings, birthdays, corporate parties and presentations — each celebration with its own fountain.',
    all: 'All events',
  },
  eventTypes: {
    wedding: 'Wedding',
    birthday: 'Birthday',
    'kids-party': "Children's party",
    corporate: 'Corporate event',
    exhibition: 'Exhibition or presentation',
    opening: 'Opening',
    other: 'Celebration',
  },
  footer: {
    rights: '© 2015–{year} ChocoParty. Chocolate fountain rental in Tashkent.',
  },
  sizes: {
    small: { name: 'Small', guests: 'up to 30 guests', details: '3 tiers · about 40 cm' },
    medium: { name: 'Medium', guests: '60 guests and more', details: '4 tiers · about 60 cm' },
    large: { name: 'Large', guests: '100 guests and more', details: '5 tiers · about 80 cm' },
  },
  tariffs: {
    light: { name: 'Light', summary: 'Fountain rental only' },
    optima: { name: 'Optima', summary: 'Fountain and Belgian chocolate' },
    maxima: { name: 'Maxima', summary: 'Chocolate, fruit, sweets and fruit cutting' },
  },
  contents: {
    light: ['Fountain rental', 'No filling'],
    small: {
      optima: ['2.5 kg of Belgian chocolate', '0.25 kg of Belgian cocoa butter'],
      maxima: [
        '2.5 kg of Belgian chocolate',
        '0.25 kg of Belgian cocoa butter',
        '0.5 kg of natural juice marshmallows',
        '0.5 kg of profiteroles',
        '2.5 kg of seasonal fruit',
        '1 kg of strawberries',
        'Beautiful fruit cutting',
      ],
    },
    medium: {
      optima: ['5 kg of Belgian chocolate', '0.5 kg of Belgian cocoa butter'],
      maxima: [
        '5 kg of Belgian chocolate',
        '0.5 kg of Belgian cocoa butter',
        '1 kg of natural juice marshmallows',
        '1 kg of profiteroles',
        '5 kg of seasonal fruit',
        '2 kg of strawberries',
        'Beautiful fruit cutting',
      ],
    },
    large: {
      optima: ['7 kg of Belgian chocolate', '1 kg of Belgian cocoa butter'],
      maxima: [
        '7 kg of Belgian chocolate',
        '1 kg of Belgian cocoa butter',
        '1.5 kg of natural juice marshmallows',
        '1.5 kg of profiteroles',
        '8 kg of seasonal fruit',
        '3.5 kg of strawberries',
        'Beautiful fruit cutting',
      ],
    },
  },
  calculator: {
    eyebrow: 'Prices',
    title: 'Choose a fountain and a package',
    lead: 'The price is final: delivery, setup, napkins, skewers and tableware are included.',
    sizeLegend: 'Fountain size',
    tariffLegend: 'Package',
    contents: "What's included",
    total: 'Price',
    flavours: 'Chocolate of your choice: milk, white, orange, strawberry, lime — the price is the same for every flavour.',
    note: 'The button opens Telegram with a ready message — just add the date and place.',
  },
  order: {
    button: 'Order this package',
    packageText:
      'Hello! I would like to order a chocolate fountain. Size: {size}. Package: {tariff}. Price on the site: {price}. Date and place of the celebration: ',
    eventText:
      'Hello! I would like a chocolate fountain like at this event: {title} ({url}). Date and place of my celebration: ',
  },
};
