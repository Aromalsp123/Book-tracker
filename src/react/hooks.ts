import { useEffect, useState } from 'react';

export const statuses = ['To read', 'Reading', 'Finished'] as const;
export type BookStatus = (typeof statuses)[number];

export interface LocalBook {
  id: string;
  title: string;
  author: string;
  description?: string;
  status: BookStatus;
  createdAt: string;
  currentPage?: number;
  totalPages?: number;
}

export interface LocalSession {
  id: string;
  bookId: string;
  startedAt: string;
  durationSeconds: number;
}

export interface LocalQuote {
  id: string;
  bookId: string;
  text: string;
  page?: number;
  createdAt: string;
}

export interface ActiveSession {
  bookId: string;
  startedAt: string;
}

const booksStorageKey = 'book-tracker-books';
const sessionsStorageKey = 'book-tracker-sessions';
const quotesStorageKey = 'book-tracker-quotes';
const activeSessionStorageKey = 'book-tracker-active-session';

function readStored<T>(key: string, validate: (value: unknown) => value is T): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(validate) : [];
  } catch {
    return [];
  }
}

function isBook(value: unknown): value is LocalBook {
  if (typeof value !== 'object' || value === null) return false;
  const book = value as Record<string, unknown>;
  return typeof book.id === 'string'
    && typeof book.title === 'string'
    && typeof book.author === 'string'
    && (book.description === undefined || typeof book.description === 'string')
    && typeof book.createdAt === 'string'
    && Number.isFinite(Date.parse(book.createdAt))
    && statuses.includes(book.status as BookStatus)
    && (book.currentPage === undefined || (typeof book.currentPage === 'number' && book.currentPage >= 0))
    && (book.totalPages === undefined || (typeof book.totalPages === 'number' && book.totalPages > 0));
}

function isSession(value: unknown): value is LocalSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return typeof session.id === 'string'
    && typeof session.bookId === 'string'
    && typeof session.startedAt === 'string'
    && Number.isFinite(Date.parse(session.startedAt))
    && typeof session.durationSeconds === 'number'
    && Number.isFinite(session.durationSeconds)
    && session.durationSeconds >= 0;
}

function isQuote(value: unknown): value is LocalQuote {
  if (typeof value !== 'object' || value === null) return false;
  const quote = value as Record<string, unknown>;
  return typeof quote.id === 'string'
    && typeof quote.bookId === 'string'
    && typeof quote.text === 'string'
    && typeof quote.createdAt === 'string'
    && Number.isFinite(Date.parse(quote.createdAt))
    && (quote.page === undefined || (typeof quote.page === 'number' && quote.page > 0));
}

function readActiveSession(): ActiveSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(activeSessionStorageKey) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const session = value as Record<string, unknown>;
    return typeof session.bookId === 'string' && typeof session.startedAt === 'string' && Number.isFinite(Date.parse(session.startedAt))
      ? { bookId: session.bookId, startedAt: session.startedAt }
      : null;
  } catch {
    return null;
  }
}

export function useTracker() {
  const [books, setBooks] = useState<LocalBook[]>(() => readStored(booksStorageKey, isBook));
  const [sessions, setSessions] = useState<LocalSession[]>(() => readStored(sessionsStorageKey, isSession));
  const [quotes, setQuotes] = useState<LocalQuote[]>(() => readStored(quotesStorageKey, isQuote));
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(readActiveSession);

  useEffect(() => localStorage.setItem(booksStorageKey, JSON.stringify(books)), [books]);
  useEffect(() => localStorage.setItem(sessionsStorageKey, JSON.stringify(sessions)), [sessions]);
  useEffect(() => localStorage.setItem(quotesStorageKey, JSON.stringify(quotes)), [quotes]);
  useEffect(() => {
    if (activeSession) localStorage.setItem(activeSessionStorageKey, JSON.stringify(activeSession));
    else localStorage.removeItem(activeSessionStorageKey);
  }, [activeSession]);

  function updateProgress(id: string, currentPage: number) {
    setBooks((current) => current.map((book) => {
      if (book.id !== id) return book;
      const validPage = Number.isFinite(currentPage) ? Math.floor(currentPage) : (book.currentPage ?? 0);
      const page = Math.max(0, Math.min(validPage, book.totalPages ?? validPage));
      const status: BookStatus = book.totalPages && page >= book.totalPages ? 'Finished' : page > 0 ? 'Reading' : book.status;
      return { ...book, currentPage: page, status };
    }));
  }

  function updateStatus(id: string, status: BookStatus) {
    setBooks((current) => current.map((book) => {
      if (book.id !== id) return book;
      return status === 'Finished' && book.totalPages
        ? { ...book, currentPage: book.totalPages, status }
        : { ...book, status };
    }));
  }

  return {
    books,
    sessions,
    quotes,
    activeSession,
    addBook: (book: LocalBook) => setBooks((current) => [book, ...current]),
    updateProgress,
    updateStatus,
    updateDescription: (id: string, description: string) => setBooks((current) => current.map((book) => (
      book.id === id ? { ...book, description } : book
    ))),
    removeBook: (id: string) => {
      setBooks((current) => current.filter((book) => book.id !== id));
      setSessions((current) => current.filter((session) => session.bookId !== id));
      setQuotes((current) => current.filter((quote) => quote.bookId !== id));
      setActiveSessionState((current) => current?.bookId === id ? null : current);
    },
    addSession: (session: LocalSession) => setSessions((current) => [session, ...current]),
    addQuote: (quote: LocalQuote) => setQuotes((current) => [quote, ...current]),
    removeQuote: (id: string) => setQuotes((current) => current.filter((quote) => quote.id !== id)),
    setActiveSession: setActiveSessionState,
    clearAll: () => {
      setBooks([]);
      setSessions([]);
      setQuotes([]);
      setActiveSessionState(null);
    },
  };
}
