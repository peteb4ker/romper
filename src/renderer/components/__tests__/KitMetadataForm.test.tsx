// Test suite for KitMetadataForm component
import { cleanup,fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import KitMetadataForm from '../KitMetadataForm';

afterEach(() => {
  cleanup();
});

describe('KitMetadataForm', () => {
  const baseKitLabel = {
    label: 'My Kit',
    description: 'A description',
    tags: ['drum', 'snare'],
  };

  it('renders tags and Edit Tags button when tagsEditable', () => {
    render(
      <KitMetadataForm kitLabel={baseKitLabel} tagsEditable={true} onSave={vi.fn()} />
    );
    expect(screen.getByText('drum')).toBeInTheDocument();
    expect(screen.getByText('snare')).toBeInTheDocument();
    expect(screen.getByText('Edit Tags')).toBeInTheDocument();
  });

  it('shows tag editing UI and allows adding/removing tags', () => {
    const onSave = vi.fn();
    render(
      <KitMetadataForm kitLabel={baseKitLabel} tagsEditable={true} onSave={onSave} />
    );
    fireEvent.click(screen.getByText('Edit Tags'));
    // Remove a tag
    fireEvent.click(screen.getAllByTitle('Remove tag')[0]);
    // Add a tag
    const input = screen.getByPlaceholderText('Add tag');
    fireEvent.change(input, { target: { value: 'kick' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Save
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('My Kit', '', ['snare', 'kick']);
  });

  it('shows loading and error states', () => {
    const { rerender } = render(
      <KitMetadataForm kitLabel={baseKitLabel} loading={true} onSave={vi.fn()} />
    );
    expect(screen.getByText('Loading kit metadata...')).toBeInTheDocument();
    rerender(<KitMetadataForm kitLabel={baseKitLabel} error="Something went wrong" onSave={vi.fn()} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows "No tags" if no tags present', () => {
    render(
      <KitMetadataForm kitLabel={{ label: 'Empty', tags: [] }} tagsEditable={true} onSave={vi.fn()} />
    );
    expect(screen.getByText('No tags')).toBeInTheDocument();
  });
});
