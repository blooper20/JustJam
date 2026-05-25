import '@testing-library/jest-dom';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => {
    const IndexTranslations: Record<string, string> = {
      title: 'PRACTICE,LIKE A PRO',
      getStarted: '지금 시작하기',
      description: 'AI 기반 연습 메이트',
      loading: 'loading',
      preparing: 'preparing',
      progress: 'progress',
      tracksCompleted: 'tracksCompleted',
    };
    return (key: string) => IndexTranslations[key] || key;
  },
  useFormatter: () => ({
    number: (val: number) => String(val),
    dateTime: (val: Date) => String(val),
  }),
  useLocale: () => 'ko',
  useMessages: () => ({}),
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
