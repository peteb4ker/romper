import React from 'react';
import { render, screen } from '@testing-library/react';
import KitDetails from '../src/renderer/components/KitDetails';

describe('KitDetails voice name controls', () => {
  it('shows edit/rescan controls and a no-name indicator if no voice name is set', async () => {
    render(
      <KitDetails
        kitName="TestKit"
        sdCardPath="/sd"
        onBack={() => {}}
      />
    );
    // Wait for async effects
    // Instead of findByText (which fails if there are multiple), use findAllByText and check count
    const noNameIndicators = await screen.findAllByText('No voice name set');
    expect(noNameIndicators.length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Edit voice name').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Rescan voice name').length).toBeGreaterThan(0);
  });
});
