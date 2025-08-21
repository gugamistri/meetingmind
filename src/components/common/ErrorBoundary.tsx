import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Here you would typically report to error tracking service
    // reportErrorToService(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className='min-h-screen flex items-center justify-center'>
          <div className='card max-w-md w-full mx-4'>
            <div className='card-body text-center'>
              <div className='w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center mx-auto mb-4'>
                <svg
                  className='w-6 h-6 text-danger-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <h2 className='text-lg font-semibold text-danger-800 mb-2'>Something went wrong</h2>
              <p className='text-gray-600 mb-4'>
                An unexpected error occurred. Please try refreshing the page.
              </p>
              {this.state.error && (
                <details className='text-left mb-4'>
                  <summary className='cursor-pointer text-sm text-gray-500 mb-2'>
                    Error Details
                  </summary>
                  <pre className='text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto'>
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <button className='btn btn-primary mr-2' onClick={() => window.location.reload()}>
                Reload Page
              </button>
              <button
                className='btn btn-secondary'
                onClick={() => this.setState({ hasError: false })}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
