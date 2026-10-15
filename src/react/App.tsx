import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import {
  statuses,
  useTracker,
  type BookStatus,
  type LocalBook,
  type LocalQuote,
} from './hooks.ts';

type View = 'dashboard' | 'library' | 'sessions' | 'quotes' | 'statistics' | 'explore' | 'settings';
type LibraryFilter = 'All books' | 'Reading' | 'Finished' | 'To read';
type IconName = 'home' | 'book' | 'clock' | 'quote' | 'chart' | 'search' | 'settings' | 'plus' | 'arrow-right' | 'arrow-down' | 'arrow-left' | 'close' | 'menu' | 'stop' | 'download' | 'enter' | 'check' | 'trash';

const navigation: { id: View; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'library', label: 'My Library', icon: 'book' },
  { id: 'sessions', label: 'Reading Sessions', icon: 'clock' },
  { id: 'quotes', label: 'Quotes & Notes', icon: 'quote' },
  { id: 'statistics', label: 'Statistics', icon: 'chart' },
  { id: 'explore', label: 'Explore', icon: 'search' },
];

const coverColors = ['#587a82', '#9b5d43', '#4d5d77', '#8a7847', '#705b73', '#53745b'];

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const shapes: Record<IconName, ReactNode> = {
    home: <><path d="m3.5 10 8.5-7 8.5 7" /><path d="M5.5 9v11h13V9M9.5 20v-6h5v6" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8M8 11h7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    quote: <><path d="M9.5 11H5.8a3.3 3.3 0 0 1 3.3-3.5V5a5.8 5.8 0 0 0-5.8 5.8V17h6.2zM20.5 11h-3.7a3.3 3.3 0 0 1 3.3-3.5V5a5.8 5.8 0 0 0-5.8 5.8V17h6.2z" /></>,
    chart: <><path d="M4 20V11M10 20V5M16 20v-8M22 20H2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    settings: <><path d="M4 7h8m4 0h4M4 17h4m4 0h8" /><circle cx="14" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    'arrow-right': <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    'arrow-down': <><path d="M12 4v15M5 13l7 7 7-7" /></>,
    'arrow-left': <><path d="M20 12H5M11 5l-7 7 7 7" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    stop: <><rect x="5" y="5" width="14" height="14" rx="2" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
    enter: <><path d="M14 4h5v16h-5M3 12h12M10 7l5 5-5 5" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 14h11l1-14M9 7V4h6v3" /></>,
  };

  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]}</svg>;
}

interface BookSearchResult {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  first_sentence?: string[];
}

async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const response = await fetch(`/api/openlibrary/search.json?q=${encodeURIComponent(query)}&limit=10`);
  if (!response.ok) throw new Error('Failed to search books');
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null || !Array.isArray((data as { docs?: unknown }).docs)) return [];
  return (data as { docs: BookSearchResult[] }).docs;
}

function coverColor(book: LocalBook) {
  const sum = [...book.title].reduce((value, character) => value + character.charCodeAt(0), 0);
  return coverColors[sum % coverColors.length];
}

function durationLabel(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function Cover({ book, className = '' }: { book: LocalBook; className?: string }) {
  return <div className={`cover ${className}`} style={{ '--cover-color': coverColor(book) } as CSSProperties} aria-label={`Cover placeholder for ${book.title}`} role="img">
    <span className="cover-rule" />
    <span className="cover-title">{book.title}</span>
    <span className="cover-author">{book.author}</span>
    <span className="cover-mark" aria-hidden="true">✳</span>
  </div>;
}

function StatusBadge({ status }: { status: BookStatus }) {
  return <span className={`status-badge status-${status.toLowerCase().replace(' ', '-')}`}>{status === 'Finished' ? 'Finished' : status}</span>;
}

function BookForm({ onAdd, onClose }: { onAdd: (book: LocalBook) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<BookStatus>('To read');
  const [pages, setPages] = useState('');
  const [errors, setErrors] = useState<{ title?: string; author?: string; pages?: string }>({});
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResults, setResearchResults] = useState<BookSearchResult[]>([]);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState('');

  async function research() {
    const query = researchQuery.trim();
    if (!query) return;
    setResearching(true);
    setResearchError('');
    try {
      setResearchResults(await searchBooks(query));
    } catch (reason) {
      setResearchResults([]);
      setResearchError(reason instanceof Error ? reason.message : 'Book research is unavailable.');
    } finally {
      setResearching(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const totalPages = pages.trim() ? Number(pages) : undefined;
    const nextErrors = {
      ...(title.trim() ? {} : { title: 'Please enter a title.' }),
      ...(author.trim() ? {} : { author: 'Please enter an author.' }),
      ...(pages.trim() && (!Number.isInteger(totalPages) || (totalPages ?? 0) < 1) ? { pages: 'Enter a whole number greater than zero.' } : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      author: author.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      status,
      createdAt: new Date().toISOString(),
      ...(totalPages ? { totalPages, currentPage: status === 'Finished' ? totalPages : 0 } : {}),
    });
    onClose();
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-book-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
      <p className="eyebrow">A new chapter</p>
      <h2 id="add-book-title">Add a book</h2>
       <p className="muted">A few details are all you need to start.</p>
      <form className="book-form" onSubmit={submit} noValidate>
        <div className="book-research"><label>Research a book<input value={researchQuery} onChange={(event) => setResearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void research(); } }} placeholder="Search Open Library" /></label><button className="button button-light" type="button" disabled={researching || !researchQuery.trim()} onClick={() => void research()}>{researching ? 'Searching...' : 'Search'}</button></div>
        {researchError && <p className="field-error" role="alert">{researchError}. You can still enter the book manually.</p>}
        {researchResults.length > 0 && <div className="book-research-results" aria-label="Book research results">{researchResults.map((result) => <button type="button" key={result.key} onClick={() => { setTitle(result.title ?? ''); setAuthor(result.author_name?.[0] ?? ''); if (result.first_sentence?.length) setDescription(result.first_sentence.join(' ').slice(0, 500)); setResearchResults([]); }}><strong>{result.title || 'Untitled'}</strong><span>{result.author_name?.join(', ') || 'Unknown author'}{result.first_publish_year ? ` · ${result.first_publish_year}` : ''}</span></button>)}</div>}
        <label>Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} placeholder="The book’s title" />{errors.title && <span className="field-error">{errors.title}</span>}</label>
        <label>Author<input value={author} onChange={(event) => setAuthor(event.target.value)} aria-invalid={Boolean(errors.author)} placeholder="Who wrote it?" />{errors.author && <span className="field-error">{errors.author}</span>}</label>
        <label>About this book <span className="optional">(optional, up to 500 characters)</span><textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a brief description or note..." /></label>
        <div className="form-split">
          <label>Total pages <span className="optional">(optional)</span><input type="number" min="1" step="1" value={pages} onChange={(event) => setPages(event.target.value)} aria-invalid={Boolean(errors.pages)} placeholder="e.g. 320" />{errors.pages && <span className="field-error">{errors.pages}</span>}</label>
          <label>Reading status<select value={status} onChange={(event) => setStatus(event.target.value as BookStatus)}>{statuses.map((option) => <option key={option}>{option}</option>)}</select></label>
        </div>
        <div className="form-actions"><button className="button button-light" type="button" onClick={onClose}>Cancel</button><button className="button" type="submit">Add to my library <Icon name="arrow-right" /></button></div>
      </form>
    </section>
  </div>;
}

function LandingIllustration() {
  return <img
    className="landing-illustration"
    src={`${import.meta.env.BASE_URL}images/landing-books-rabbit.png`}
    alt="A vintage blue engraving of a rabbit perched on a stack of books surrounded by foliage"
    width="922"
    height="768"
  />;
}

function LandingPage({ onEnter, onSearch }: { onEnter: () => void; onSearch: (query: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(searchQuery.trim());
  }
  return <main className="landing-page">
    <header className="landing-header">
      <button className="landing-brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>MARGIN</button>
      <nav className="landing-links" aria-label="Landing page navigation">
        <a className="landing-link-active" href="#home">Home</a>
        <a href="#features">Features</a>
        <a href="#library" onClick={(event) => { event.preventDefault(); onSearch(''); }}>Library</a>
        <a href="#about">About</a>
      </nav>
      <form className="landing-search" role="search" onSubmit={submitSearch}><Icon name="search" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search your library" placeholder="Search your library..." /><button type="submit" aria-label="Search"><Icon name="enter" /></button></form>
      <div className="landing-actions"><button className="landing-login" type="button" onClick={onEnter}>Open journal</button><button className="button landing-cta" type="button" onClick={onEnter}>Get started <Icon name="arrow-right" /></button></div>
    </header>
    <section className="landing-hero" id="home">
      <div className="landing-copy">
        <p className="eyebrow">A QUIET PLACE FOR YOUR READING LIFE</p>
        <h1>Make room for<br />more <span className="highlight-word">stories.</span></h1>
        <p className="hero-byline">Your books, your own little corner of the world.</p>
        <p className="hero-description">Keep the stories you’re reading, the ones you’ve loved, and the lines you want to remember—all together in one thoughtful reading journal.</p>
        <div className="hero-actions"><button className="button landing-cta hero-cta" type="button" onClick={onEnter}>Start your journal <Icon name="arrow-right" /></button><a className="hero-secondary" href="#features">Take a look around <Icon name="arrow-down" /></a></div>
        <div className="hero-benefits"><div><span className="benefit-icon"><Icon name="book" /></span><span>Your personal library</span></div><div><span className="benefit-icon"><Icon name="clock" /></span><span>Reading sessions</span></div><div><span className="benefit-icon"><Icon name="quote" /></span><span>Favorite passages</span></div></div>
      </div>
      <div className="landing-art-wrap"><div className="art-orbit art-orbit-one" /><div className="art-orbit art-orbit-two" /><LandingIllustration /><span className="art-small-star art-star-one">✦</span><span className="art-small-star art-star-two">✦</span></div>
    </section>
    <section className="landing-feature-band" id="features">
      <div><span className="feature-number">01</span><span className="feature-band-icon"><Icon name="book" /></span><h2>A shelf that feels like yours</h2><p>Keep your currently reading, finished, and someday books in one lovely place.</p></div>
      <div><span className="feature-number">02</span><span className="feature-band-icon"><Icon name="clock" /></span><h2>Make time for a few pages</h2><p>Start a reading session and let the small, quiet moments add up.</p></div>
      <div><span className="feature-number">03</span><span className="feature-band-icon"><Icon name="quote" /></span><h2>Keep the words that stay</h2><p>Save favorite passages from the books that mean something to you.</p></div>
    </section>
    <section className="landing-story-section" id="how-it-works">
      <div className="story-intro"><p className="eyebrow">A READING JOURNAL, NOT A RACE</p><h2>There’s no right way<br />to read a book.</h2><p>Some days you’ll turn a dozen pages. Some weeks, you’ll simply choose your next story. MARGIN helps you keep a gentle record of it all, without turning reading into another thing to keep up with.</p><button className="text-link" type="button" onClick={onEnter}>Make a little room for reading <Icon name="arrow-right" /></button></div>
      <div className="story-card"><img className="story-illustration" src={`${import.meta.env.BASE_URL}images/reading-journal-still-life.png`} alt="An open reading journal, books, a teacup, and flowers in a vintage blue engraving style" width="1774" height="887" loading="lazy" /></div>
    </section>
    <section className="landing-about" id="about"><p className="eyebrow">MADE FOR READERS</p><h2>Your reading life belongs to you.</h2><p>MARGIN keeps your journal in this browser. No public profile, no pressure, no noise—just a calm place to keep track of the books you love.</p><button className="button landing-cta" type="button" onClick={onEnter}>Open your journal <Icon name="arrow-right" /></button></section>
    <footer className="landing-footer">
      <div className="landing-footer-main">
        <div className="landing-footer-brand">
          <button className="landing-brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>MARGIN</button>
          <p>A thoughtful little home for the books and words you want to keep.</p>
        </div>
        <nav className="landing-footer-links" aria-label="Footer navigation">
          <p className="eyebrow">EXPLORE</p>
          <a href="#features">Features</a>
          <button type="button" onClick={() => onSearch('')}>My library</button>
          <a href="#about">About & privacy</a>
        </nav>
        <div className="landing-footer-invitation">
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <p>Your reading journal is ready when you are.</p>
          <button className="button landing-cta" type="button" onClick={onEnter}>Open your journal <Icon name="arrow-right" /></button>
        </div>
      </div>
      <div className="landing-footer-bottom">
        <small>© {new Date().getFullYear()} MARGIN</small>
        <small>Made for the love of reading.</small>
        <a href="#home">Back to top</a>
      </div>
    </footer>
  </main>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-flower" aria-hidden="true">✳</span><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

function App() {
  const tracker = useTracker();
  const [view, setView] = useState<View>('dashboard');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('All books');
  const [now, setNow] = useState(Date.now());
  const [quoteText, setQuoteText] = useState('');
  const [quoteBookId, setQuoteBookId] = useState('');
  const [quotePage, setQuotePage] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showLanding, setShowLanding] = useState(() => window.location.hash !== '#journal');

  useEffect(() => {
    if (!tracker.activeSession) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [tracker.activeSession]);

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        openView('library');
      }
    }
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  useEffect(() => {
    function handleHistoryNavigation() {
      const landingIsVisible = window.location.hash !== '#journal';
      setShowLanding(landingIsVisible);
      setSelectedBookId(null);
      setMobileMenuOpen(false);
    }
    window.addEventListener('popstate', handleHistoryNavigation);
    return () => window.removeEventListener('popstate', handleHistoryNavigation);
  }, []);

  const selectedBook = tracker.books.find((book) => book.id === selectedBookId) ?? null;
  const currentBook = tracker.books.find((book) => book.id === tracker.activeSession?.bookId)
    ?? tracker.books.find((book) => book.status === 'Reading')
    ?? null;
  const totalReadingSeconds = tracker.sessions.reduce((total, session) => total + session.durationSeconds, 0);
  const activeElapsed = tracker.activeSession ? Math.floor((now - new Date(tracker.activeSession.startedAt).getTime()) / 1000) : 0;
  const search = query.trim().toLocaleLowerCase();
  const filteredBooks = useMemo(() => tracker.books.filter((book) => {
    const matchesQuery = !search || `${book.title} ${book.author}`.toLocaleLowerCase().includes(search);
    const matchesStatus = filter === 'All books' || book.status === filter;
    return matchesQuery && matchesStatus;
  }), [filter, search, tracker.books]);

  function openView(nextView: View) {
    if (showLanding || window.location.hash !== '#journal') {
      window.history.pushState({ screen: 'journal' }, '', `${window.location.pathname}${window.location.search}#journal`);
    }
    setSelectedBookId(null);
    setView(nextView);
    setMobileMenuOpen(false);
    setShowLanding(false);
  }

  function openLanding() {
    if (!showLanding || window.location.hash === '#journal') {
      window.history.pushState({ screen: 'landing' }, '', `${window.location.pathname}${window.location.search}`);
    }
    setSelectedBookId(null);
    setMobileMenuOpen(false);
    setShowLanding(true);
  }

  function startSession(bookId: string) {
    if (tracker.activeSession) return;
    tracker.updateStatus(bookId, 'Reading');
    tracker.setActiveSession({ bookId, startedAt: new Date().toISOString() });
    setView('sessions');
    setSelectedBookId(null);
  }

  function stopSession() {
    if (!tracker.activeSession) return;
    const startedAt = tracker.activeSession.startedAt;
    const durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    tracker.addSession({ id: crypto.randomUUID(), bookId: tracker.activeSession.bookId, startedAt, durationSeconds });
    tracker.setActiveSession(null);
    setNow(Date.now());
  }

  function removeBook(id: string) {
    const book = tracker.books.find((item) => item.id === id);
    if (!book || !window.confirm(`Remove “${book.title}” and its saved sessions and quotes?`)) return;
    tracker.removeBook(id);
    setSelectedBookId((selectedId) => selectedId === id ? null : selectedId);
  }

  function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quoteText.trim() || !quoteBookId) return;
    const page = quotePage.trim() ? Number(quotePage) : undefined;
    if (page !== undefined && (!Number.isInteger(page) || page < 1)) return;
    const quote: LocalQuote = {
      id: crypto.randomUUID(),
      bookId: quoteBookId,
      text: quoteText.trim(),
      createdAt: new Date().toISOString(),
      ...(page ? { page } : {}),
    };
    tracker.addQuote(quote);
    setQuoteText('');
    setQuotePage('');
  }

  function exportLibrary() {
    const data = JSON.stringify({ books: tracker.books, sessions: tracker.sessions, quotes: tracker.quotes }, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    link.download = 'my-reading-journal.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const displayTitle = selectedBook ? selectedBook.title : ({
    dashboard: 'Your reading room',
    library: 'My library',
    sessions: 'Reading sessions',
    quotes: 'Quotes & notes',
    statistics: 'Reading, in reflection',
    explore: 'A world of stories',
    settings: 'Your preferences',
  } satisfies Record<View, string>)[view];

  if (showLanding) {
    return <LandingPage onEnter={() => openView('dashboard')} onSearch={(term) => { setQuery(term); openView('library'); }} />;
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" type="button" onClick={openLanding} aria-label="Return to the MARGIN landing page">
        <span className="brand-emblem" aria-hidden="true">✳</span><span>MARGIN</span>
      </button>
      <div className="sidebar-label">YOUR READING LIFE</div>
      <nav className="primary-nav" aria-label="Main navigation">
        {navigation.map((item) => <button type="button" key={item.id} className={`nav-item ${view === item.id && !selectedBook ? 'active' : ''}`} onClick={() => openView(item.id)}>
          <Icon name={item.icon} className="nav-icon" />{item.label}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <button type="button" className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => openView('settings')}><Icon name="settings" className="nav-icon" />Settings</button>
        <div className="sidebar-note"><span className="note-mark" aria-hidden="true">✦</span><p>A good book opens a quiet door to somewhere new.</p></div>
        <p className="local-note">Your journal is saved on this device.</p>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu-toggle" type="button" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><Icon name={mobileMenuOpen ? 'close' : 'menu'} /></button>
        <div className="global-search" role="search"><input ref={searchInputRef} aria-label="Search your books" placeholder="Search your library..." value={query} onFocus={() => { if (view !== 'library') openView('library'); }} onChange={(event) => { setQuery(event.target.value); if (view !== 'library') openView('library'); }} /><button className="search-button" type="button" aria-label="Focus book search" onClick={() => { searchInputRef.current?.focus(); openView('library'); }}><Icon name="search" className="search-icon" /></button></div>
        <div className="topbar-right"><span className="topbar-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><button className="avatar" type="button" onClick={() => openView('settings')} aria-label="Open settings">M</button></div>
      </header>
      {mobileMenuOpen && <nav className="mobile-secondary-nav" aria-label="More pages"><button type="button" onClick={openLanding}><Icon name="book" />MARGIN landing page</button>{navigation.filter((item) => ['quotes', 'explore'].includes(item.id)).map((item) => <button type="button" key={item.id} onClick={() => openView(item.id)}><Icon name={item.icon} />{item.label}</button>)}<button type="button" onClick={() => openView('settings')}><Icon name="settings" />Settings</button></nav>}

      <div className="page-content">
        {selectedBook ? <BookDetail
          book={selectedBook}
          quotes={tracker.quotes.filter((quote) => quote.bookId === selectedBook.id)}
          active={tracker.activeSession?.bookId === selectedBook.id}
          onBack={() => setSelectedBookId(null)}
          onProgress={(page) => tracker.updateProgress(selectedBook.id, page)}
          onStatus={(status) => tracker.updateStatus(selectedBook.id, status)}
          onDescription={(description) => tracker.updateDescription(selectedBook.id, description)}
          onDelete={() => removeBook(selectedBook.id)}
          onStart={() => startSession(selectedBook.id)}
          onStop={stopSession}
          onQuotes={() => { setQuoteBookId(selectedBook.id); openView('quotes'); }}
        /> : <>
          <div className="page-heading">
            <div><p className="eyebrow">{view === 'dashboard' ? 'A PERSONAL READING JOURNAL' : 'YOUR READING JOURNAL'}</p><h1>{displayTitle}</h1><p className="page-subtitle">{view === 'dashboard' ? 'A little time with a good book goes a long way.' : subtitleFor(view)}</p></div>
            <button className="button add-button" type="button" onClick={() => setAddBookOpen(true)}><Icon name="plus" /> Add a book</button>
          </div>

          {view === 'dashboard' && <Dashboard
            books={tracker.books}
            sessions={tracker.sessions}
            totalReadingSeconds={totalReadingSeconds + activeElapsed}
            quotesCount={tracker.quotes.length}
            activeBook={currentBook}
            activeSession={tracker.activeSession}
            elapsed={activeElapsed}
            onOpenLibrary={() => openView('library')}
            onOpenBook={(id) => setSelectedBookId(id)}
            onStart={startSession}
            onStop={stopSession}
            onAdd={() => setAddBookOpen(true)}
            onDeleteBook={removeBook}
          />}
          {view === 'library' && <Library
            books={filteredBooks}
            filter={filter}
            onFilter={setFilter}
            onOpen={(id) => setSelectedBookId(id)}
            onAdd={() => setAddBookOpen(true)}
            onDeleteBook={removeBook}
            query={query}
          />}
          {view === 'sessions' && <Sessions
            books={tracker.books}
            sessions={tracker.sessions}
            active={tracker.activeSession}
            elapsed={activeElapsed}
            onStart={startSession}
            onStop={stopSession}
          />}
          {view === 'quotes' && <Quotes
            books={tracker.books}
            quotes={tracker.quotes}
            quoteText={quoteText}
            quoteBookId={quoteBookId}
            quotePage={quotePage}
            onText={setQuoteText}
            onBook={setQuoteBookId}
            onPage={setQuotePage}
            onSave={saveQuote}
            onRemove={tracker.removeQuote}
            onOpenBook={(id) => setSelectedBookId(id)}
          />}
          {view === 'statistics' && <Statistics
            books={tracker.books}
            sessions={tracker.sessions}
            quotesCount={tracker.quotes.length}
            totalReadingSeconds={totalReadingSeconds + activeElapsed}
          />}
          {view === 'explore' && <Explore onAdd={() => setAddBookOpen(true)} onLibrary={() => openView('library')} />}
          {view === 'settings' && <Settings
            bookCount={tracker.books.length}
            sessionCount={tracker.sessions.length}
            onExport={exportLibrary}
            onClear={() => {
              if (window.confirm('Delete all books, reading sessions, and quotes saved on this device? This cannot be undone.')) tracker.clearAll();
            }}
          />}
        </>}
      </div>
      <footer className="app-footer"><span>Made for the love of reading.</span><span>One page at a time <span className="footer-star">✦</span></span></footer>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.filter((item) => ['dashboard', 'library', 'sessions', 'statistics'].includes(item.id)).map((item) =>
      <button type="button" key={item.id} className={view === item.id && !selectedBook ? 'active' : ''} onClick={() => openView(item.id)}><Icon name={item.icon} />{item.label === 'Dashboard' ? 'Home' : item.label === 'Statistics' ? 'Stats' : item.label === 'Reading Sessions' ? 'Sessions' : 'Library'}</button>)}</nav>
    {addBookOpen && <BookForm onAdd={(book) => { tracker.addBook(book); setSelectedBookId(book.id); setView('library'); }} onClose={() => setAddBookOpen(false)} />}
  </div>;
}

function subtitleFor(view: View) {
  const subtitles: Record<View, string> = {
    dashboard: 'A little time with a good book goes a long way.',
    library: 'Every story you’ve started, finished, or saved for later.',
    sessions: 'Make a little space for reading, one session at a time.',
    quotes: 'Keep the words you want to carry with you.',
    statistics: 'Small moments add up to a life full of stories.',
    explore: 'Find room on your shelf for the next story.',
    settings: 'Your reading journal, just the way you like it.',
  };
  return subtitles[view];
}

function Dashboard({ books, sessions, totalReadingSeconds, quotesCount, activeBook, activeSession, elapsed, onOpenLibrary, onOpenBook, onDeleteBook, onStart, onStop, onAdd }: {
  books: LocalBook[];
  sessions: { id: string; bookId: string; startedAt: string; durationSeconds: number }[];
  totalReadingSeconds: number;
  quotesCount: number;
  activeBook: LocalBook | null;
  activeSession: { bookId: string; startedAt: string } | null;
  elapsed: number;
  onOpenLibrary: () => void;
  onOpenBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  onStart: (id: string) => void;
  onStop: () => void;
  onAdd: () => void;
}) {
  const finishedCount = books.filter((book) => book.status === 'Finished').length;
  const readingCount = books.filter((book) => book.status === 'Reading').length;
  const recentBooks = books.slice(0, 6);
  return <div className="dashboard-view">
    <div className="dashboard-welcome"><span className="welcome-quote">“</span><p>Today is a lovely day to read a little.</p><span>YOUR READING JOURNAL</span></div>
    <div className="dashboard-grid">
      <section className="panel current-panel">
        <div className="section-heading"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Currently reading</h2></div><span className="live-dot" /></div>
        {activeBook ? <div className="current-book">
          <button className="cover-button" type="button" onClick={() => onOpenBook(activeBook.id)}><Cover book={activeBook} /></button>
          <div className="current-book-info">
            <p className="book-kicker">ON YOUR NIGHTSTAND</p><button className="book-title-link" type="button" onClick={() => onOpenBook(activeBook.id)}>{activeBook.title}</button><p className="book-author">{activeBook.author}</p>
            {activeBook.totalPages ? <><div className="progress-meta"><span>{activeBook.currentPage ?? 0} of {activeBook.totalPages} pages</span><strong>{Math.round(((activeBook.currentPage ?? 0) / activeBook.totalPages) * 100)}%</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, ((activeBook.currentPage ?? 0) / activeBook.totalPages) * 100)}%` }} /></div></> : <p className="muted progress-unavailable">Add a page count to track your progress.</p>}
            {activeSession?.bookId === activeBook.id ? <div className="active-reading-line"><span className="live-dot" /> Reading now · {durationLabel(elapsed)} <button type="button" onClick={onStop}>Finish session</button></div> : <button className="button continue-button" type="button" onClick={() => onStart(activeBook.id)}>Continue reading <Icon name="arrow-right" /></button>}
          </div>
        </div> : <EmptyState title={books.length ? 'Choose your next read' : 'Your next favorite is waiting.'} detail={books.length ? 'Pick a book from your library to start reading.' : 'Add your first book and make this reading room your own.'} action={<button className="button" type="button" onClick={books.length ? onOpenLibrary : onAdd}>        {books.length ? 'Browse my library' : 'Add your first book'} <Icon name="arrow-right" /></button>} />}
      </section>
      <div className="stats-grid">
        <StatCard icon="clock" value={durationLabel(totalReadingSeconds)} label="Time spent reading" />
        <StatCard icon="book" value={String(sessions.length)} label="Reading sessions" />
        <StatCard icon="check" value={String(finishedCount)} label="Books finished" />
        <StatCard icon="quote" value={String(quotesCount)} label="Passages saved" />
      </div>
    </div>
    <section className="shelf-section">
      <div className="section-heading shelf-heading"><div><p className="eyebrow">A FEW FROM YOUR SHELF</p><h2>My library</h2></div><button className="text-link" type="button" onClick={onOpenLibrary}>View all <Icon name="arrow-right" /></button></div>
      {recentBooks.length ? <div className="book-shelf">{recentBooks.map((book) => <BookTile key={book.id} book={book} onOpen={() => onOpenBook(book.id)} onDelete={() => onDeleteBook(book.id)} />)}
        <button className="add-shelf-tile" type="button" onClick={onAdd}><span><Icon name="plus" /></span><small>Add a book</small></button>
      </div> : <div className="shelf-empty"><p>Your shelf is ready when you are.</p><button className="text-link" type="button" onClick={onAdd}>Add a book <Icon name="arrow-right" /></button></div>}
    </section>
    <section className="recent-reading">
      <div className="section-heading"><div><p className="eyebrow">YOUR READING RHYTHM</p><h2>A little progress, often</h2></div><span className="muted small-copy">{readingCount} {readingCount === 1 ? 'book' : 'books'} in progress</span></div>
      <div className="rhythm-strip"><span className="rhythm-mark">✳</span><p>{sessions.length ? `You’ve made time for ${sessions.length} reading ${sessions.length === 1 ? 'session' : 'sessions'}. Keep finding a quiet moment for the next page.` : 'Your reading sessions will gather here. Start a timer whenever you settle in with a book.'}</p><span className="rhythm-count">{sessions.length.toString().padStart(2, '0')}</span></div>
    </section>
  </div>;
}

function StatCard({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return <article className="stat-card"><span className="stat-icon"><Icon name={icon} /></span><div><strong>{value}</strong><span>{label}</span></div></article>;
}

function BookTile({ book, onOpen, onDelete }: { book: LocalBook; onOpen: () => void; onDelete: () => void }) {
  const percent = book.totalPages ? Math.round(((book.currentPage ?? 0) / book.totalPages) * 100) : null;
  return <article className="book-tile">
    <div className="book-tile-cover">
      <button className="tile-open-button" type="button" onClick={onOpen} aria-label={`Open ${book.title}`}>
        <Cover book={book} />
      </button>
      <button className="tile-delete-button" type="button" aria-label={`Delete ${book.title}`} title={`Delete ${book.title}`} onClick={onDelete}><Icon name="trash" /></button>
    </div>
    <button className="tile-title-button" type="button" onClick={onOpen}>{book.title}</button><span className="tile-author">{book.author}</span>
    {book.status === 'Reading' && percent !== null ? <><div className="tile-progress"><span style={{ width: `${Math.min(100, percent)}%` }} /></div><span className="tile-status-line">{percent}% read</span></> : <StatusBadge status={book.status} />}
  </article>;
}

function Library({ books, filter, onFilter, onOpen, onAdd, onDeleteBook, query }: {
  books: LocalBook[];
  filter: LibraryFilter;
  onFilter: (filter: LibraryFilter) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onDeleteBook: (id: string) => void;
  query: string;
}) {
  const filters: LibraryFilter[] = ['All books', 'Reading', 'Finished', 'To read'];
  return <section className="library-view">
    <div className="library-toolbar"><div className="filter-tabs" role="tablist" aria-label="Filter books">{filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'selected' : ''} onClick={() => onFilter(item)}>{item}</button>)}</div><span className="book-count">{books.length} {books.length === 1 ? 'book' : 'books'}</span></div>
    {books.length ? <div className="library-grid">{books.map((book) => <BookTile key={book.id} book={book} onOpen={() => onOpen(book.id)} onDelete={() => onDeleteBook(book.id)} />)}<button className="add-library-tile" type="button" onClick={onAdd}><span><Icon name="plus" /></span><strong>Add a book</strong><small>Make room for another story</small></button></div> :
      <EmptyState title={query ? 'No books found.' : filter === 'All books' ? 'Your shelf is still a blank page.' : `No books marked “${filter}”.`} detail={query ? 'Try another title or author.' : 'Add a book to begin your personal reading collection.'} action={!query && <button className="button" type="button" onClick={onAdd}>Add a book <Icon name="arrow-right" /></button>} />}
  </section>;
}

function BookDetail({ book, quotes, active, onBack, onProgress, onStatus, onDescription, onDelete, onStart, onStop, onQuotes }: {
  book: LocalBook;
  quotes: LocalQuote[];
  active: boolean;
  onBack: () => void;
  onProgress: (page: number) => void;
  onStatus: (status: BookStatus) => void;
  onDescription: (description: string) => void;
  onDelete: () => void;
  onStart: () => void;
  onStop: () => void;
  onQuotes: () => void;
}) {
  const percent = book.totalPages ? Math.round(((book.currentPage ?? 0) / book.totalPages) * 100) : null;
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(book.description ?? '');
  useEffect(() => {
    setDescriptionDraft(book.description ?? '');
    setEditingDescription(false);
  }, [book.id, book.description]);
  return <section className="book-detail-view">
    <button className="back-link" type="button" onClick={onBack}><Icon name="arrow-left" /> Back to my library</button>
    <div className="detail-hero panel">
      <Cover book={book} className="detail-cover" />
      <div className="detail-copy">
        <p className="eyebrow">A BOOK ON YOUR SHELF</p><h1>{book.title}</h1><p className="detail-author">by {book.author}</p>
        <div className="detail-badges"><StatusBadge status={book.status} /><span className="muted">Added {dateLabel(book.createdAt)}</span></div>
        <div className="detail-actions">{active ? <button className="button" type="button" onClick={onStop}>Finish reading session <Icon name="stop" /></button> : book.status !== 'Finished' ? <button className="button" type="button" onClick={onStart}>Start reading <Icon name="arrow-right" /></button> : null}
          {book.status !== 'Finished' && <button className="button button-light" type="button" onClick={() => onStatus('Finished')}>Mark as finished <Icon name="check" /></button>}
          {book.status === 'Finished' && <button className="button button-light" type="button" onClick={() => onStatus('Reading')}>Read again</button>}
        </div>
      </div>
    </div>
    <section className="panel detail-about">
      <div className="section-heading"><div><p className="eyebrow">A FEW WORDS ABOUT THE STORY</p><h2>About this book</h2></div>
        <button className="text-link" type="button" onClick={() => { setDescriptionDraft(book.description ?? ''); setEditingDescription((editing) => !editing); }}>{editingDescription ? 'Cancel' : book.description ? 'Edit note' : 'Add a note'}</button>
      </div>
      {editingDescription ? <form className="description-form" onSubmit={(event) => { event.preventDefault(); onDescription(descriptionDraft.trim()); setEditingDescription(false); }}>
        <label className="visually-hidden" htmlFor="book-description">Short book description</label>
        <textarea id="book-description" rows={3} maxLength={500} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} placeholder="Write a brief description of this book..." />
        <div className="description-actions"><span>{descriptionDraft.length}/500</span><button className="button" type="submit">Save description</button></div>
      </form> : <p className={book.description ? 'detail-description' : 'detail-description muted'}>{book.description || 'Add a short description or note to remember what this book is about.'}</p>}
    </section>
    {book.totalPages ? <section className="panel detail-progress"><div className="section-heading"><div><p className="eyebrow">YOUR PROGRESS</p><h2>One page at a time</h2></div><strong className="detail-percent">{percent}%</strong></div><div className="progress-track large-progress"><span style={{ width: `${Math.min(100, percent ?? 0)}%` }} /></div><div className="page-stepper"><span>{book.currentPage ?? 0} / {book.totalPages} pages</span><label>Current page<input type="number" min="0" max={book.totalPages} value={book.currentPage ?? 0} onChange={(event) => onProgress(Number(event.target.value))} aria-label={`Current page, out of ${book.totalPages}`} /></label></div></section> : <div className="panel no-page-count"><span className="stat-icon"><Icon name="book" /></span><p>Add a page count when you’re ready to track your progress.</p></div>}
    <section className="panel detail-quotes"><div className="section-heading"><div><p className="eyebrow">PASSAGES TO KEEP</p><h2>Quotes from this book</h2></div><button className="text-link" type="button" onClick={onQuotes}>Add a quote <Icon name="plus" /></button></div>
      {quotes.length ? <div className="detail-quote-list">{quotes.slice(0, 2).map((quote) => <blockquote key={quote.id}>“{quote.text}”{quote.page && <cite>Page {quote.page}</cite>}</blockquote>)}</div> : <p className="muted">No saved passages yet. Keep a line that stays with you.</p>}
    </section>
    <button className="danger-link" type="button" onClick={onDelete}>Remove this book and its reading history</button>
  </section>;
}

function Sessions({ books, sessions, active, elapsed, onStart, onStop }: {
  books: LocalBook[];
  sessions: { id: string; bookId: string; startedAt: string; durationSeconds: number }[];
  active: { bookId: string; startedAt: string } | null;
  elapsed: number;
  onStart: (id: string) => void;
  onStop: () => void;
}) {
  const activeBook = books.find((book) => book.id === active?.bookId);
  const readingBooks = books.filter((book) => book.status !== 'Finished');
  return <div className="sessions-view">
    <section className="timer-panel panel">
      <p className="eyebrow">{active ? 'A MOMENT FOR YOURSELF' : 'MAKE A LITTLE TIME'}</p><h2>{active ? activeBook?.title ?? 'Reading session' : 'Settle in with a book.'}</h2><p className="muted">{active ? activeBook?.author : 'A quiet page, a comfortable chair, and nowhere else to be.'}</p>
      <div className={`timer-face ${active ? 'running' : ''}`}><span>{active ? formatClock(elapsed) : '00:00:00'}</span><small>{active ? 'Reading now' : 'Ready when you are'}</small></div>
      {active ? <button className="button stop-button" type="button" onClick={onStop}>Finish session <Icon name="stop" /></button> : readingBooks.length ? <label className="timer-book-select">Choose a book<select id="session-book" defaultValue={readingBooks.find((book) => book.status === 'Reading')?.id ?? readingBooks[0].id}>{readingBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select><button className="button" type="button" onClick={() => { const select = document.getElementById('session-book') as HTMLSelectElement | null; if (select?.value) onStart(select.value); }}>Start reading <Icon name="arrow-right" /></button></label> : <p className="muted">Add a book to begin a reading session.</p>}
      {active && <p className="timer-persistence"><span className="live-dot" /> Timer stays with you if you change pages or refresh.</p>}
    </section>
    <section className="session-history panel"><div className="section-heading"><div><p className="eyebrow">YOUR JOURNAL</p><h2>Past sessions</h2></div><span className="muted small-copy">{sessions.length} total</span></div>
      {sessions.length ? <div className="session-list">{sessions.map((session) => {
        const book = books.find((candidate) => candidate.id === session.bookId);
        return <article className="session-row" key={session.id}><span className="session-icon"><Icon name="clock" /></span><div className="session-book"><strong>{book?.title ?? 'Removed book'}</strong><span>{book?.author ?? 'Book no longer in library'}</span></div><span className="session-date">{dateLabel(session.startedAt)}</span><strong className="session-duration">{durationLabel(session.durationSeconds)}</strong></article>;
      })}</div> : <EmptyState title="Your reading time starts here." detail="Completed sessions will be saved in your reading journal." />}
    </section>
  </div>;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60].map((part) => part.toString().padStart(2, '0')).join(':');
}

function Quotes({ books, quotes, quoteText, quoteBookId, quotePage, onText, onBook, onPage, onSave, onRemove, onOpenBook }: {
  books: LocalBook[];
  quotes: LocalQuote[];
  quoteText: string;
  quoteBookId: string;
  quotePage: string;
  onText: (value: string) => void;
  onBook: (value: string) => void;
  onPage: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: (id: string) => void;
  onOpenBook: (id: string) => void;
}) {
  return <div className="quotes-view">
    <form className="quote-form panel" onSubmit={onSave}>
      <p className="eyebrow">SAVE A PASSAGE</p><h2>Words worth keeping</h2>
      <label>Quote or thought<textarea rows={3} value={quoteText} onChange={(event) => onText(event.target.value)} placeholder="A sentence that stayed with you..." required /></label>
      <div className="form-split"><label>From which book?<select value={quoteBookId} onChange={(event) => onBook(event.target.value)} required><option value="">Choose a book</option>{books.map((book) => <option value={book.id} key={book.id}>{book.title}</option>)}</select></label><label>Page <span className="optional">(optional)</span><input type="number" min="1" step="1" value={quotePage} onChange={(event) => onPage(event.target.value)} placeholder="Page number" /></label></div>
      <button className="button" type="submit" disabled={!books.length}>Save this passage <Icon name="arrow-right" /></button>
    </form>
    <section className="quotes-list"><div className="section-heading"><div><p className="eyebrow">COLLECTED ALONG THE WAY</p><h2>Your commonplace book</h2></div><span className="muted small-copy">{quotes.length} saved</span></div>
      {quotes.length ? <div className="quote-cards">{quotes.map((quote) => {
        const book = books.find((item) => item.id === quote.bookId);
        return <article className="quote-card panel" key={quote.id}><span className="quote-mark" aria-hidden="true">“</span><blockquote>{quote.text}</blockquote><div className="quote-attribution"><button type="button" onClick={() => book && onOpenBook(book.id)}>{book?.title ?? 'Removed book'}</button><span>{quote.page ? `Page ${quote.page}` : dateLabel(quote.createdAt)}</span></div><button className="quote-delete" type="button" aria-label="Delete saved quote" onClick={() => onRemove(quote.id)}><Icon name="trash" /></button></article>;
      })}</div> : <EmptyState title="Save a line that means something." detail={books.length ? 'Your favorite passages and thoughts will find a home here.' : 'Add a book first, then save the words you want to remember.'} />}
    </section>
  </div>;
}

function Statistics({ books, sessions, quotesCount, totalReadingSeconds }: {
  books: LocalBook[];
  sessions: { id: string; bookId: string; startedAt: string; durationSeconds: number }[];
  quotesCount: number;
  totalReadingSeconds: number;
}) {
  const year = new Date().getFullYear();
  const monthlySessions = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, new Date().getMonth() - 5 + index, 1);
    return { label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date), count: sessions.filter((session) => {
      const sessionDate = new Date(session.startedAt);
      return sessionDate.getMonth() === date.getMonth() && sessionDate.getFullYear() === date.getFullYear();
    }).length };
  });
  const maxCount = Math.max(1, ...monthlySessions.map((month) => month.count));
  const finished = books.filter((book) => book.status === 'Finished');
  const pageCount = books.reduce((sum, book) => sum + (book.currentPage ?? 0), 0);
  return <div className="statistics-view">
    <div className="stats-grid wide-stats"><StatCard icon="clock" value={durationLabel(totalReadingSeconds)} label="Time spent reading" /><StatCard icon="book" value={String(sessions.length)} label="Reading sessions" /><StatCard icon="check" value={String(finished.length)} label="Books finished" /><StatCard icon="quote" value={String(quotesCount)} label="Passages saved" /></div>
    <section className="chart-panel panel"><div className="section-heading"><div><p className="eyebrow">THE LAST SIX MONTHS</p><h2>Your reading rhythm</h2></div><span className="chart-legend"><i /> Sessions</span></div>
      {sessions.length ? <div className="bar-chart" role="img" aria-label={`Reading sessions by month for the last six months: ${monthlySessions.map((month) => `${month.label} ${month.count}`).join(', ')}`}><div className="chart-y-labels"><span>{maxCount}</span><span>{Math.ceil(maxCount / 2)}</span><span>0</span></div><div className="chart-bars">{monthlySessions.map((month) => <div className="chart-column" key={month.label}><span className="chart-value">{month.count || ''}</span><div className="chart-bar-track"><i style={{ height: `${month.count ? Math.max(8, (month.count / maxCount) * 100) : 0}%` }} /></div><span className="chart-month">{month.label}</span></div>)}</div></div> : <EmptyState title="Your reading rhythm will take shape here." detail="A few reading sessions will give you a picture of your month." />}
    </section>
    <section className="insight-grid">
      <article className="panel insight-card"><p className="eyebrow">PAGES TURNED</p><strong>{pageCount}</strong><span>pages in your reading journey</span><div className="insight-decoration" aria-hidden="true">✳</div></article>
      <article className="panel insight-card"><p className="eyebrow">ON YOUR SHELF</p><strong>{books.length}</strong><span>{books.length === 1 ? 'story collected so far' : 'stories collected so far'}</span><div className="insight-decoration" aria-hidden="true">❧</div></article>
    </section>
  </div>;
}

function Explore({ onAdd, onLibrary }: { onAdd: () => void; onLibrary: () => void }) {
  return <section className="explore-panel panel">
    <div className="explore-art" aria-hidden="true"><span className="sun-disc" /><span className="leaf leaf-one">❧</span><span className="leaf leaf-two">❧</span><span className="stack-book stack-book-one" /><span className="stack-book stack-book-two" /><span className="stack-book stack-book-three" /><span className="explore-spark">✳</span></div>
    <div className="explore-copy"><p className="eyebrow">THE NEXT CHAPTER</p><h2>Every great reading list starts with one book.</h2><p>Keep a wish list close at hand. Add a title you’ve been meaning to read, or revisit the stories already on your shelf.</p><div className="explore-actions"><button className="button" type="button" onClick={onAdd}>Add a book <Icon name="arrow-right" /></button><button className="button button-light" type="button" onClick={onLibrary}>Browse my library</button></div><span className="explore-note">Your library is private to this browser.</span></div>
  </section>;
}

function Settings({ bookCount, sessionCount, onExport, onClear }: { bookCount: number; sessionCount: number; onExport: () => void; onClear: () => void }) {
  return <div className="settings-view">
    <section className="settings-section panel"><p className="eyebrow">YOUR DATA</p><h2>A journal that stays yours.</h2><p className="muted">This version saves your reading journal in this browser only. It isn’t synced to an account or shared with anyone.</p><div className="data-summary"><div><strong>{bookCount}</strong><span>books on your shelf</span></div><div><strong>{sessionCount}</strong><span>reading sessions saved</span></div></div><div className="settings-actions"><button className="button" type="button" onClick={onExport}>Export my journal <Icon name="download" /></button><p>Download a copy of your books, reading sessions, and saved quotes.</p></div></section>
    <section className="settings-section panel"><p className="eyebrow">A FRESH PAGE</p><h2>Clear this device</h2><p className="muted">Remove all locally saved books, sessions, and quotes from this browser. This action can’t be undone.</p><button className="button button-danger" type="button" onClick={onClear}>Clear my local journal</button></section>
    <p className="settings-footnote">MARGIN is a quiet space for your reading life. Your entries remain on this device unless you export them.</p>
  </div>;
}

export { App };
