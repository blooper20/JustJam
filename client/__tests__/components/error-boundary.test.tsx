import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/error-boundary';
import '@testing-library/jest-dom';

let shouldThrow = true;
// 에러를 던지는 컴포넌트
const ProblemChild = () => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>정상 자식</div>;
};

describe('ErrorBoundary', () => {
  // 테스트 중 콘솔 에러 출력을 방지 (JSDOM은 에러 발생 시 콘솔에 출력함)
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  beforeEach(() => {
    shouldThrow = true;
  });

  it('자식 컴포넌트가 정상일 때 그대로 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <div>정상 컴포넌트</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('정상 컴포넌트')).toBeInTheDocument();
  });

  it('에러 발생 시 폴백 UI를 렌더링한다', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('영역 로딩 실패')).toBeInTheDocument();
    expect(screen.getByText('이 영역을 불러오는 중 문제가 발생했습니다.')).toBeInTheDocument();
  });

  it('다시 시도 버튼 클릭 시 상태를 초기화한다', () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>,
    );

    const retryButton = screen.getByRole('button', { name: /다시 시도/i });
    shouldThrow = false;
    fireEvent.click(retryButton);

    // 다시 시도 후 에러 상태가 초기화되었으므로 자식을 정상적으로 렌더링함
    expect(screen.queryByText('영역 로딩 실패')).not.toBeInTheDocument();
    expect(screen.getByText('정상 자식')).toBeInTheDocument();
  });

  it('커스텀 폴백이 제공된 경우 이를 사용한다', () => {
    const Fallback = <div>커스텀 에러 화면</div>;
    render(
      <ErrorBoundary fallback={Fallback}>
        <ProblemChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('커스텀 에러 화면')).toBeInTheDocument();
  });
});
