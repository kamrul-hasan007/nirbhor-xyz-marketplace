'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bug,
  Boxes,
  ChevronDown,
  Clock3,
  House,
  MapPin,
  Menu,
  Refrigerator,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
  Zap,
} from 'lucide-react'
import type { MarketplaceCatalog, MarketplaceService } from '@/lib/catalog'
import { AccountControls } from '@/components/auth/account-controls'

type Language = 'en' | 'bn'

const categoryIcons = {
  sparkles: Sparkles,
  wrench: Wrench,
  zap: Zap,
  refrigerator: Refrigerator,
  bug: Bug,
  boxes: Boxes,
} as const

const categoryThemes = ['mint', 'lavender', 'peach', 'blue', 'sage', 'sand']
const serviceIconKeys: Record<string, keyof typeof categoryIcons> = {
  cleaning: 'sparkles',
  plumbing: 'wrench',
  electrical: 'zap',
  'appliance-repair': 'refrigerator',
  'pest-control': 'bug',
  moving: 'boxes',
}

const copy = {
  en: {
    announcement: 'A little more ease, right at home',
    navServices: 'Services',
    navHow: 'How it works',
    navWhy: 'Why Nirbhor',
    signIn: 'Sign in',
    bookNow: 'Book a service',
    heroEyebrow: 'GOOD HELP, RIGHT AT HOME',
    heroTitle: 'More time for the things that feel like you.',
    heroText: 'Thoughtful home services, trusted local professionals, and one less thing on your list.',
    locationLabel: 'Your location',
    cityPlaceholder: 'Choose a city',
    areaPlaceholder: 'Choose your area',
    searchPlaceholder: 'What does your home need today?',
    search: 'Find a service',
    serviceNote: 'Available in your neighbourhood',
    cityHelper: 'Serving Dhaka and Chattogram, one neighbourhood at a time.',
    popularEyebrow: 'A GOOD PLACE TO START',
    popularTitle: 'The little things, taken care of.',
    popularDescription: 'Reliable help for the jobs that make home feel like home.',
    allServices: 'Explore all services',
    browseEyebrow: 'MADE FOR YOUR EVERYDAY',
    browseTitle: 'What can we help with?',
    browseDescription: 'Choose a category to find a trusted local professional.',
    all: 'All services',
    starting: 'Starting at',
    reviews: 'reviews',
    verified: 'Verified professionals',
    verifiedText: 'Every provider is screened before they arrive at your door.',
    upfront: 'Clear, upfront pricing',
    upfrontText: 'Know what to expect before you book. No awkward surprises.',
    support: 'Here when you need us',
    supportText: 'A real team is ready to help before, during, and after your service.',
    whyEyebrow: 'A LITTLE MORE PEACE OF MIND',
    whyTitle: 'Good work. Good people. No guesswork.',
    howEyebrow: 'THREE EASY STEPS',
    howTitle: 'Home help, without the hassle.',
    stepOne: 'Pick what you need',
    stepOneText: 'Browse trusted services for the things on your to-do list.',
    stepTwo: 'Choose a time and place',
    stepTwoText: 'Tell us where you are and when works best for you.',
    stepThree: 'We take it from here',
    stepThreeText: 'A vetted local professional arrives ready to help.',
    trustLine: 'A little more room in your day.',
    trustSubline: 'You take care of home. We’ll take care of the rest.',
    browse: 'Browse services',
    noResults: 'No services found',
    noResultsText: 'Try another search or choose a different category.',
    cityPrompt: 'Pick your city',
    areaPrompt: 'Pick your neighbourhood',
    serviceLabel: 'service',
    ratingLabel: 'Rated',
    menu: 'Open navigation',
    footer: 'Care for home, care for you.',
    footerLink: 'Help centre',
    areaAvailability: 'Choose a neighbourhood to check availability.',
  },
  bn: {
    announcement: 'ঘরের কাজে আরও একটু স্বস্তি',
    navServices: 'সার্ভিস',
    navHow: 'যেভাবে কাজ করে',
    navWhy: 'কেন নির্ভর',
    signIn: 'লগ ইন',
    bookNow: 'সার্ভিস বুক করুন',
    heroEyebrow: 'ঘরের জন্য, আপনার কাছেই',
    heroTitle: 'নিজের ভালো লাগার কাজের জন্য আরও একটু সময়।',
    heroText: 'যত্ন নিয়ে ঘরের সার্ভিস, বিশ্বস্ত স্থানীয় পেশাজীবী—আপনার তালিকায় একটি কাজ কম।',
    locationLabel: 'আপনার এলাকা',
    cityPlaceholder: 'শহর বেছে নিন',
    areaPlaceholder: 'এলাকা বেছে নিন',
    searchPlaceholder: 'আজ ঘরের কী দরকার?',
    search: 'সার্ভিস খুঁজুন',
    serviceNote: 'আপনার এলাকায় সার্ভিস পাওয়া যায়',
    cityHelper: 'ঢাকা ও চট্টগ্রামে, পাড়ায় পাড়ায় সেবা।',
    popularEyebrow: 'শুরু করা যাক',
    popularTitle: 'ছোটখাটো কাজ, আমাদের দায়িত্বে।',
    popularDescription: 'ঘরকে আপন করে তোলে—এমন সব কাজে নির্ভরযোগ্য সহায়তা।',
    allServices: 'সব সার্ভিস দেখুন',
    browseEyebrow: 'আপনার প্রতিদিনের জন্য',
    browseTitle: 'কীভাবে সাহায্য করতে পারি?',
    browseDescription: 'বিশ্বস্ত স্থানীয় পেশাজীবী খুঁজতে একটি ক্যাটাগরি বেছে নিন।',
    all: 'সব সার্ভিস',
    starting: 'শুরু',
    reviews: 'টি রিভিউ',
    verified: 'যাচাইকৃত পেশাজীবী',
    verifiedText: 'আপনার দরজায় আসার আগে প্রত্যেক সার্ভিস প্রোভাইডার যাচাই করা হয়।',
    upfront: 'আগেই স্পষ্ট মূল্য',
    upfrontText: 'বুকিংয়ের আগে খরচ জেনে নিন, অপ্রত্যাশিত কিছু নয়।',
    support: 'প্রয়োজনে আমরা আছি',
    supportText: 'সার্ভিসের আগে, চলাকালে ও পরে পাশে আছে আমাদের টিম।',
    whyEyebrow: 'আরও নিশ্চিন্ত থাকার জন্য',
    whyTitle: 'ভালো কাজ। ভালো মানুষ। কোনো দ্বিধা নয়।',
    howEyebrow: 'সহজ তিনটি ধাপ',
    howTitle: 'ঝামেলা ছাড়াই ঘরের সাহায্য।',
    stepOne: 'যা দরকার বেছে নিন',
    stepOneText: 'আপনার কাজের তালিকা থেকে বিশ্বস্ত সার্ভিস খুঁজে নিন।',
    stepTwo: 'সময় ও জায়গা ঠিক করুন',
    stepTwoText: 'আপনার এলাকা ও সুবিধার সময়টি আমাদের জানান।',
    stepThree: 'বাকি দায়িত্ব আমাদের',
    stepThreeText: 'যাচাইকৃত স্থানীয় পেশাজীবী সাহায্যের জন্য পৌঁছে যাবেন।',
    trustLine: 'দিনে আরও একটু সময় আপনার জন্য।',
    trustSubline: 'ঘরের যত্ন নিন, বাকিটা আমাদের ওপর ছেড়ে দিন।',
    browse: 'সার্ভিস দেখুন',
    noResults: 'কোনো সার্ভিস পাওয়া যায়নি',
    noResultsText: 'অন্য শব্দ দিয়ে খুঁজুন বা ভিন্ন ক্যাটাগরি বেছে নিন।',
    cityPrompt: 'শহর বেছে নিন',
    areaPrompt: 'আপনার এলাকা বেছে নিন',
    serviceLabel: 'সার্ভিস',
    ratingLabel: 'রেটিং',
    menu: 'মেনু খুলুন',
    footer: 'ঘরের যত্ন, আপনার যত্ন।',
    footerLink: 'সহায়তা কেন্দ্র',
    areaAvailability: 'সার্ভিস দেখতে একটি এলাকা বেছে নিন।',
  },
} as const

function formatTaka(amount: number, language: Language) {
  return new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en-BD', {
    maximumFractionDigits: 0,
  }).format(amount)
}

function CategoryIcon({ iconKey }: { iconKey: string }) {
  const Icon = categoryIcons[iconKey as keyof typeof categoryIcons] ?? House
  return <Icon aria-hidden="true" />
}

function ServiceCard({
  service,
  language,
  index,
}: {
  service: MarketplaceService
  language: Language
  index: number
}) {
  const isBangla = language === 'bn'
  const theme = categoryThemes[index % categoryThemes.length]

  return (
    <article className="service-card">
      <div className={`service-card__art service-card__art--${theme}`}>
        <span className="service-card__icon"><CategoryIcon iconKey={serviceIconKeys[service.categoryId] ?? 'sparkles'} /></span>
        {service.isPopular && <span className="service-card__badge"><Sparkles aria-hidden="true" /> {isBangla ? 'জনপ্রিয়' : 'Popular'}</span>}
        <span className="service-card__service-id">{service.id.replaceAll('-', ' ')}</span>
      </div>
      <div className="service-card__body">
        <div className="service-card__rating"><Star aria-hidden="true" fill="currentColor" /><span>{service.rating.toFixed(1)}</span><span className="service-card__review-count">({service.reviewCount} {copy[language].reviews})</span></div>
        <h3>{isBangla ? service.nameBn : service.name}</h3>
        <p>{isBangla ? service.descriptionBn : service.description}</p>
        <div className="service-card__footer">
          <span className="service-card__price-label">{copy[language].starting}</span>
          <span className="service-card__price">৳{formatTaka(service.startingPrice, language)}</span>
          <ArrowUpRight aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}

export function NirbhorMarketplace({ catalog }: { catalog: MarketplaceCatalog }) {
  const [language, setLanguage] = useState<Language>('en')
  const [cityId, setCityId] = useState(catalog.cities[0]?.id ?? '')
  const [areaId, setAreaId] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const text = copy[language]
  const isBangla = language === 'bn'

  const cityAreas = useMemo(
    () => catalog.areas.filter((area) => area.cityId === cityId),
    [catalog.areas, cityId],
  )
  const visibleServices = useMemo(() => {
    const queryWords = searchTerm.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
    const searchWords = (service: MarketplaceService) =>
      `${service.name} ${service.description} ${service.nameBn} ${service.descriptionBn}`
        .toLocaleLowerCase()
        .match(/[a-z0-9\u0980-\u09ff]+/g) ?? []
    const locationAreaIds = areaId ? [areaId] : cityAreas.map((area) => area.id)

    return catalog.services.filter((service) => {
      const matchesCategory = activeCategory === 'all' || service.categoryId === activeCategory
      const matchesArea = locationAreaIds.some((id) => service.areaIds.includes(id))
      const words = searchWords(service)
      const matchesQuery = queryWords.every((query) => words.some((word) => word.startsWith(query)))
      return matchesCategory && matchesArea && matchesQuery
    })
  }, [activeCategory, areaId, catalog.services, cityAreas, searchTerm])
  const popularServices = useMemo(
    () => catalog.services
      .filter((service) => service.isPopular && cityAreas.some((area) => service.areaIds.includes(area.id)))
      .slice(0, 4),
    [catalog.services, cityAreas],
  )
  const formatCity = (city: (typeof catalog.cities)[number]) => isBangla ? city.nameBn : city.name
  const formatArea = (area: (typeof catalog.areas)[number]) => isBangla ? area.nameBn : area.name

  function changeCity(nextCityId: string) {
    setCityId(nextCityId)
    setAreaId('')
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main className="marketplace" lang={language === 'bn' ? 'bn' : 'en'}>
      <div className="announcement"><Sparkles aria-hidden="true" /><span>{text.announcement}</span><ArrowRight aria-hidden="true" /></div>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Nirbhor home">
          <span className="brand__mark"><House aria-hidden="true" /></span>
          <span className="brand__word">nirbhor<span>.xyz</span><small>HOME, MADE EASIER</small></span>
        </a>
        <nav className="desktop-nav" aria-label={isBangla ? 'প্রধান নেভিগেশন' : 'Main navigation'}>
          <a href="#services">{text.navServices}</a>
          <a href="#how-it-works">{text.navHow}</a>
          <a href="#why-nirbhor">{text.navWhy}</a>
        </nav>
        <div className="header-actions">
          <button className="language-switch" type="button" onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')} aria-label={language === 'en' ? 'বাংলায় দেখুন' : 'View in English'}>
            <span className={language === 'en' ? 'language-switch__active' : ''}>EN</span><span className="language-switch__divider">/</span><span className={language === 'bn' ? 'language-switch__active' : ''}>বাং</span>
          </button>
          <AccountControls />
          <a className="button button--small" href="#services">{text.bookNow}<ArrowRight aria-hidden="true" /></a>
          <button className="mobile-menu" type="button" aria-label={text.menu} onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}><Menu aria-hidden="true" /></button>
        </div>
      </header>

      <section className="hero" id="top">
        <Image className="hero__image" src="/images/nirbhor-home-services.png" alt="A home-care professional getting ready to help in a bright Dhaka home" fill priority sizes="(max-width: 760px) 100vw, 1200px" />
        <div className="hero__wash" />
        <div className="hero__content">
          <span className="eyebrow"><span className="eyebrow__dot" />{text.heroEyebrow}</span>
          <h1>{text.heroTitle}</h1>
          <p className="hero__description">{text.heroText}</p>
          <form className="search-panel" onSubmit={submitSearch}>
            <div className="search-panel__location">
              <span className="search-panel__icon"><MapPin aria-hidden="true" /></span>
              <label htmlFor="city-select">{text.locationLabel}</label>
              <div className="search-panel__selects">
                <select id="city-select" value={cityId} onChange={(event) => changeCity(event.target.value)} aria-label={text.cityPrompt}>
                  {catalog.cities.map((city) => <option key={city.id} value={city.id}>{formatCity(city)}</option>)}
                </select>
                <ChevronDown aria-hidden="true" />
                <select id="area-select" value={areaId} onChange={(event) => setAreaId(event.target.value)} aria-label={text.areaPrompt}>
                  <option value="">{text.areaPlaceholder}</option>
                  {cityAreas.map((area) => <option key={area.id} value={area.id}>{formatArea(area)}</option>)}
                </select>
                <ChevronDown aria-hidden="true" />
              </div>
            </div>
            <div className="search-panel__service">
              <Search aria-hidden="true" />
              <label className="sr-only" htmlFor="service-search">{text.searchPlaceholder}</label>
              <input id="service-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={text.searchPlaceholder} />
              <button className="button" type="submit">{text.search}<ArrowRight aria-hidden="true" /></button>
            </div>
          </form>
          <p className="hero__caption"><ShieldCheck aria-hidden="true" />{areaId ? text.serviceNote : text.cityHelper}</p>
        </div>
        <div className="hero__seal"><span><BadgeCheck aria-hidden="true" /></span><strong>{isBangla ? 'বিশ্বস্ত' : 'Trusted'}</strong><small>{isBangla ? 'স্থানীয় সহায়তা' : 'local help'}</small></div>
      </section>

      <section className="section popular-section" id="popular-services">
        <div className="section-heading">
          <div><span className="section-eyebrow">{text.popularEyebrow}</span><h2>{text.popularTitle}</h2><p>{text.popularDescription}</p></div>
          <a className="text-link" href="#services">{text.allServices}<ArrowRight aria-hidden="true" /></a>
        </div>
        <div className="service-grid service-grid--popular">
          {popularServices.map((service, index) => <ServiceCard key={service.id} service={service} language={language} index={index} />)}
        </div>
      </section>

      <section className="category-strip" aria-label={text.browseTitle}>
        <div className="category-strip__intro"><span className="section-eyebrow">{text.browseEyebrow}</span><h2>{text.browseTitle}</h2><p>{text.browseDescription}</p></div>
        <div className="category-list">
          {catalog.categories.map((category, index) => (
            <button key={category.id} type="button" className={`category-tile category-tile--${categoryThemes[index % categoryThemes.length]}`} onClick={() => { setActiveCategory(category.id); document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }) }}>
              <span className="category-tile__icon"><CategoryIcon iconKey={category.iconKey} /></span><span>{isBangla ? category.nameBn : category.name}</span><ArrowUpRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="section catalog-section" id="services">
        <div className="section-heading section-heading--catalog">
          <div><span className="section-eyebrow">{text.browseEyebrow}</span><h2>{text.browseTitle}</h2><p>{text.browseDescription}</p></div>
          <span className="catalog-count">{visibleServices.length} {text.serviceLabel}</span>
        </div>
        <div className="catalog-toolbar">
          <div className="filter-chips" role="group" aria-label={text.browseTitle}>
            <button type="button" className={activeCategory === 'all' ? 'filter-chip filter-chip--active' : 'filter-chip'} onClick={() => setActiveCategory('all')}>{text.all}</button>
            {catalog.categories.map((category) => <button key={category.id} type="button" className={activeCategory === category.id ? 'filter-chip filter-chip--active' : 'filter-chip'} onClick={() => setActiveCategory(category.id)}>{isBangla ? category.nameBn : category.name}</button>)}
          </div>
          {areaId ? <span className="area-selection"><MapPin aria-hidden="true" />{formatArea(catalog.areas.find((area) => area.id === areaId)!)}</span> : <span className="area-selection area-selection--muted"><MapPin aria-hidden="true" />{text.areaAvailability}</span>}
        </div>
        {visibleServices.length > 0 ? (
          <div className="service-grid">
            {visibleServices.map((service, index) => <ServiceCard key={service.id} service={service} language={language} index={index} />)}
          </div>
        ) : (
          <div className="empty-state"><span className="empty-state__icon"><Search aria-hidden="true" /></span><h3>{text.noResults}</h3><p>{text.noResultsText}</p><button className="button button--outline" type="button" onClick={() => { setSearchTerm(''); setActiveCategory('all') }}>{text.allServices}<ArrowRight aria-hidden="true" /></button></div>
        )}
      </section>

      <section className="trust-section" id="why-nirbhor">
        <div className="trust-section__heading"><span className="section-eyebrow">{text.whyEyebrow}</span><h2>{text.whyTitle}</h2></div>
        <div className="trust-points">
          <article><span className="trust-point__icon"><BadgeCheck aria-hidden="true" /></span><h3>{text.verified}</h3><p>{text.verifiedText}</p></article>
          <article><span className="trust-point__icon"><ShieldCheck aria-hidden="true" /></span><h3>{text.upfront}</h3><p>{text.upfrontText}</p></article>
          <article><span className="trust-point__icon"><Clock3 aria-hidden="true" /></span><h3>{text.support}</h3><p>{text.supportText}</p></article>
        </div>
      </section>

      <section className="section how-section" id="how-it-works">
        <div className="section-heading"><div><span className="section-eyebrow">{text.howEyebrow}</span><h2>{text.howTitle}</h2></div><ArrowDown className="how-section__arrow" aria-hidden="true" /></div>
        <div className="steps-grid">
          {[text.stepOne, text.stepTwo, text.stepThree].map((title, index) => <article className="step-card" key={title}><span className="step-card__number">0{index + 1}</span><h3>{title}</h3><p>{[text.stepOneText, text.stepTwoText, text.stepThreeText][index]}</p></article>)}
        </div>
      </section>

      <section className="closing-banner"><span className="closing-banner__spark"><Sparkles aria-hidden="true" /></span><h2>{text.trustLine}</h2><p>{text.trustSubline}</p><a className="button button--light" href="#services">{text.browse}<ArrowRight aria-hidden="true" /></a></section>

      <footer className="site-footer"><a className="brand brand--footer" href="#top"><span className="brand__mark"><House aria-hidden="true" /></span><span className="brand__word">nirbhor<span>.xyz</span><small>HOME, MADE EASIER</small></span></a><span>{text.footer}</span><a href="mailto:hello@nirbhor.xyz">{text.footerLink}<ArrowUpRight aria-hidden="true" /></a><span className="site-footer__copyright">© {new Date().getFullYear()} Nirbhor.xyz</span></footer>
      <a className="mobile-booking-bar" href="#services">{text.bookNow}<ArrowRight aria-hidden="true" /></a>
    </main>
  )
}
