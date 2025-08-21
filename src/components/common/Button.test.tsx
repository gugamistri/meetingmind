import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test/utils';

// Simple button component for testing
const Button = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} className='btn'>
    {children}
  </button>
);

describe('Button Component', () => {
  it('should render button with text', () => {
    // Given
    const buttonText = 'Click me';

    // When
    render(<Button>{buttonText}</Button>);

    // Then
    expect(screen.getByRole('button', { name: buttonText })).toBeInTheDocument();
  });

  it('should render button with children', () => {
    // When
    render(
      <Button>
        <span>Custom content</span>
      </Button>
    );

    // Then
    expect(screen.getByText('Custom content')).toBeInTheDocument();
  });
});
