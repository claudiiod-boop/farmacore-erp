import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App Root Component', () => {
  it('should render the FarmaCore header and counter terminal title', () => {
    render(<App />);
    expect(screen.getByText(/FarmaCore/i)).toBeDefined();
    expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();
  });
});
