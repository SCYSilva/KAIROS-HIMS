// frontend/src/features/manager/pages/LessonsLibrary.tsx

import React, { useState } from 'react';
import { useLessonsSearch } from '../hooks/useManager';
import type { LessonsSearchResult } from '../api/manager.api';

const MIN_QUERY_LENGTH = 2;

// ── Presentational view (controlled; no data fetching, so every state is easy to render) ──
export interface LessonsViewProps {
  text: string;
  onTextChange: (value: string) => void;
  onSearch: () => void;
  searchedFor: string; // the text that was searched; '' means nothing has been searched yet
  isLoading: boolean;
  isError: boolean;
  result: LessonsSearchResult | undefined;
  onRetry: () => void;
}

export const LessonsView: React.FC<LessonsViewProps> = ({
  text,
  onTextChange,
  onSearch,
  searchedFor,
  isLoading,
  isError,
  result,
  onRetry,
}) => {
  const canSearch = text.trim().length >= MIN_QUERY_LENGTH && !isLoading;

  let unavailableMessage: string | null = null;
  if (isError) {
    unavailableMessage = 'The lessons could not be loaded.';
  } else if (result && !result.available) {
    unavailableMessage = result.message;
  }

  const lessons = result && result.available ? result.results : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lessons Learned</h1>
        <p className="text-xs text-slate-500 mt-1">
          Search what past incidents taught us, before you decide on actions.
        </p>
      </div>

      <section
        aria-labelledby="lessons-search-heading"
        className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4"
      >
        <h3 id="lessons-search-heading" className="text-sm font-bold text-slate-800">
          Search Lessons
        </h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch();
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        >
          <div className="md:col-span-2">
            <label htmlFor="lessons-query" className="block text-xs font-semibold text-slate-700 mb-1">
              What do you want to learn about?
            </label>
            <input
              id="lessons-query"
              type="search"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="For example: elevator failures, billing errors"
              maxLength={200}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={!canSearch}
            className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50"
          >
            {isLoading ? 'Searching…' : 'Search'}
          </button>
        </form>

        <div aria-live="polite" className="space-y-3">
          {searchedFor === '' && (
            <p className="text-xs text-slate-500">
              Type a topic and press Search. Results are lessons recorded when incidents were reviewed.
            </p>
          )}

          {searchedFor !== '' && isLoading && (
            <p role="status" className="text-xs text-slate-500">
              Searching lessons…
            </p>
          )}

          {searchedFor !== '' && !isLoading && unavailableMessage && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">{unavailableMessage}</p>
              <p>Please try again in a moment.</p>
              <button
                type="button"
                onClick={onRetry}
                className="font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              >
                Try again
              </button>
            </div>
          )}

          {searchedFor !== '' && !isLoading && lessons && lessons.length === 0 && (
            <p className="text-xs text-slate-600">
              No lessons found for “{searchedFor}”. Try different or fewer words.
            </p>
          )}

          {searchedFor !== '' && !isLoading && lessons && lessons.length > 0 && (
            <>
              <p className="text-xs text-slate-500">
                {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} found for “{searchedFor}”
              </p>
              <ul className="space-y-3">
                {lessons.map((item) => (
                  <li
                    key={item.lesson}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                  >
                    <p className="text-xs text-slate-700 leading-relaxed">{item.lesson}</p>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                      <span>
                        {item.category}
                        {item.department && item.department !== item.category ? ` · ${item.department}` : ''}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 font-semibold text-slate-600 tabular-nums">
                        {item.matchPercent}% match
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

// ── Connected page: the "Lessons" menu item ───────────────────────────────────
export const LessonsLibrary: React.FC = () => {
  const [text, setText] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const { data, isFetching, isError, refetch } = useLessonsSearch(searchedFor);

  const handleSearch = () => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    if (trimmed === searchedFor) {
      void refetch(); // same words again: ask again
    } else {
      setSearchedFor(trimmed);
    }
  };

  return (
    <LessonsView
      text={text}
      onTextChange={setText}
      onSearch={handleSearch}
      searchedFor={searchedFor}
      isLoading={isFetching}
      isError={isError}
      result={data}
      onRetry={() => {
        void refetch();
      }}
    />
  );
};
