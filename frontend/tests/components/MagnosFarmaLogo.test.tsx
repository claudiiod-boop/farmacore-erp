import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MagnosFarmaLogo } from '../../src/components/brand/MagnosFarmaLogo';

describe('MagnosFarmaLogo Component', () => {
  afterEach(() => {
    cleanup();
  });
  it('1. Renderiza a logo completa com nome MAGNOS FARMA e subtítulo', () => {
    render(<MagnosFarmaLogo variant="full" />);
    expect(screen.getByTestId('magnos-farma-logo')).toBeDefined();
    expect(screen.getByText('MAGNOS')).toBeDefined();
    expect(screen.getByText('FARMA')).toBeDefined();
    expect(screen.getByText('FARMACORE')).toBeDefined();
    expect(screen.getByText('ERP & PDV')).toBeDefined();
  });

  it('2. Renderiza apenas o ícone no modo variant="icon"', () => {
    render(<MagnosFarmaLogo variant="icon" />);
    expect(screen.getByTestId('magnos-farma-logo')).toBeDefined();
    expect(screen.queryByText('MAGNOS')).toBeNull();
  });

  it('3. Renderiza a variante branca para temas escuros', () => {
    render(<MagnosFarmaLogo variant="white" />);
    const magnosText = screen.getByText('MAGNOS');
    expect(magnosText.className).toContain('text-white');
  });
});
