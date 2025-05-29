// Test suite for KitMetadataForm component
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import KitMetadataForm from '../KitMetadataForm';

describe('KitMetadataForm', () => {
  const baseProps = {
    label: 'My Kit',
    description: 'A description',
    tags: ['drum', 'snare'],
    onLabelChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onTagsChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    error: null,
  };

  it('renders label, description, and tags', () => {
    render(<KitMetadataForm {...baseProps} />);
    expect(screen.getByDisplayValue('My Kit')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('drum, snare')).toBeInTheDocument();
  });

  it('calls onLabelChange, onDescriptionChange, and onTagsChange', () => {
    const onLabelChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onTagsChange = vi.fn();
    render(
      <KitMetadataForm
        {...baseProps}
        onLabelChange={onLabelChange}
        onDescriptionChange={onDescriptionChange}
        onTagsChange={onTagsChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'New Label' } });
    expect(onLabelChange).toHaveBeenCalledWith('New Label');
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'New Desc' } });
    expect(onDescriptionChange).toHaveBeenCalledWith('New Desc');
    fireEvent.change(screen.getByLabelText(/tags/i), { target: { value: 'kick, hat' } });
    expect(onTagsChange).toHaveBeenCalledWith(['kick', 'hat']);
  });

  it('calls onSave and onCancel', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <KitMetadataForm
        {...baseProps}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows error if provided', () => {
    render(<KitMetadataForm {...baseProps} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
