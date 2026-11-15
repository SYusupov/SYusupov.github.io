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
    home: 'Home',
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
  dates: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthYear: '{month} {year}',
  },
  eventNames: {
    wedding: 'Wedding',
    birthday: 'Birthday',
    'kids-party': "Children's party",
    corporate: 'Corporate event',
    exhibition: 'Exhibition',
    opening: 'Opening',
    other: 'Celebration',
  },
  eventPhrases: {
    titleWithClient: '{type}: {client}',
    sentence: '{fountain} {occasion}{venue}, {date}.',
    venue: ', {venue}',
    photoAlt: '{title} — chocolate fountain, photo {n}',
    fountain: {
      none: 'a chocolate fountain',
      small: 'a small chocolate fountain',
      medium: 'a medium chocolate fountain',
      large: 'a large chocolate fountain',
      several: 'several chocolate fountains',
    },
    occasion: {
      wedding: 'at a wedding',
      birthday: 'at a birthday party',
      'kids-party': "at a children's party",
      corporate: 'at a corporate event',
      exhibition: 'at an exhibition',
      opening: 'at an opening',
      other: 'at a celebration',
    },
    occasionWithClient: {
      wedding: 'at a {client} wedding',
      birthday: 'at a {client} birthday party',
      'kids-party': "at a {client} children's party",
      corporate: 'at a {client} corporate event',
      exhibition: 'at a {client} exhibition',
      opening: 'at a {client} opening',
      other: 'at a {client} celebration',
    },
    occasionWithTitle: 'at the {title}',
  },
  eventsPage: {
    metaTitle: 'Events with a chocolate fountain in Tashkent | ChocoParty',
    metaDescription:
      'Weddings, birthdays, corporate events and presentations with a ChocoParty chocolate fountain in Tashkent: photos and videos.',
    typeFilter: 'Event type',
    yearFilter: 'Year',
    allTypes: 'All types',
    allYears: 'All years',
    empty: 'No such events yet — have a look at the others.',
    video: 'Video',
  },
  eventPage: {
    metaTitle: '{title}, {date} — chocolate fountain | ChocoParty',
    breadcrumbs: 'You are here',
    sameAsThis: 'I want the same',
    gallery: 'Photos and videos',
    more: 'More events',
    ctaTitle: 'Would you like the same fountain at your celebration?',
    ctaText: 'Message us on Telegram: we will tell you whether the date is free and help you choose a fountain and a package.',
  },
  lightbox: {
    open: 'Open photo {n} full size',
    close: 'Close',
    previous: 'Previous photo',
    next: 'Next photo',
    counter: '{n} of {total}',
  },
  occasions: {
    title: 'Occasions',
    lead: 'A fountain suits any celebration — see how it looks at ours.',
    eventsTitle: 'How it went',
    noEvents: 'Photos from such celebrations will appear here soon. Meanwhile, have a look at all events.',
    metaTitle: '{title} in Tashkent — rental | ChocoParty',
    pages: {
      wedding: {
        title: 'Chocolate fountain for a wedding',
        lead: 'A chocolate fountain becomes the centre of the wedding table: guests gather around it, and the photos turn out especially beautiful.',
      },
      birthday: {
        title: 'Chocolate fountain for a birthday',
        lead: 'A fountain with Belgian chocolate and fruit is a sweet surprise for the birthday person and guests of any age.',
      },
      'kids-party': {
        title: "Chocolate fountain for a children's party",
        lead: 'Children love dipping fruit and marshmallows into chocolate — the fountain becomes the main entertainment of the party.',
      },
      corporate: {
        title: 'Chocolate fountain for a corporate event',
        lead: 'For corporate parties, conferences and banquets: we deliver and set up the fountain, decorate the table and cut the fruit.',
      },
      exhibition: {
        title: 'Chocolate fountain for an exhibition or presentation',
        lead: 'A fountain draws guests to the stand and makes a presentation memorable.',
      },
      opening: {
        title: 'Chocolate fountain for an opening',
        lead: 'A chocolate fountain at the opening of a shop, restaurant or office gives people a reason to come in and stay.',
      },
    },
  },
  trust: {
    title: 'Trusted by',
    lead: 'Companies that ordered ChocoParty fountains for their events.',
    showAll: 'Show all ({count})',
  },
  reviews: {
    title: 'Reviews',
    lead: 'What clients say after the celebration.',
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
