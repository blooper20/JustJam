import '@testing-library/jest-dom';

import koMessages from './messages/ko.json';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    return (key: string) => {
      if (!namespace || namespace === 'Index') {
        const IndexTranslations: Record<string, string> = {
          title: 'PRACTICE,LIKE A PRO',
          getStarted: '지금 시작하기',
          description: 'AI 기반 연습 메이트',
          loading: 'loading',
          preparing: 'preparing',
          progress: 'progress',
          tracksCompleted: 'tracksCompleted',
        };
        if (IndexTranslations[key] !== undefined) {
          return IndexTranslations[key];
        }
      }

      if (namespace) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const section = (koMessages as any)[namespace];
        if (section && section[key] !== undefined) {
          return section[key];
        }
      } else {
        // Flat search across all namespaces
        for (const ns of Object.keys(koMessages)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const section = (koMessages as any)[ns];
          if (section && section[key] !== undefined) {
            return section[key];
          }
        }
      }

      const IndexTranslations: Record<string, string> = {
        title: 'PRACTICE,LIKE A PRO',
        getStarted: '지금 시작하기',
        description: 'AI 기반 연습 메이트',
        loading: 'loading',
        preparing: 'preparing',
        progress: 'progress',
        tracksCompleted: 'tracksCompleted',
      };
      return IndexTranslations[key] !== undefined ? IndexTranslations[key] : key;
    };
  },
  useFormatter: () => ({
    number: (val: number) => String(val),
    dateTime: (val: Date) => String(val),
  }),
  useLocale: () => 'ko',
  useMessages: () => koMessages,
  useNow: () => new Date(),
  useTimeZone: () => 'UTC',
}));

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
